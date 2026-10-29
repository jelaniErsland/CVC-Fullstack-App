-- 12.62: scrubbed project identity and atomic operational withdrawal. No activation or delivery.
begin;

alter table public.volunteer_profiles
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.project_contacts(id) on delete restrict;
alter table public.volunteer_profiles drop constraint volunteer_profiles_contact_present;
alter table public.volunteer_profiles add constraint volunteer_profiles_live_contact_present
  check (deleted_at is not null or email is not null or phone is not null);
alter table public.volunteer_profiles add constraint volunteer_profiles_deleted_identity_minimal check (
  (deleted_at is null and deleted_by is null) or
  (deleted_at is not null and deleted_by is not null and lifecycle='archived' and readiness_status='on_hold'
    and email is null and phone is null and congregation is null and preferred_contact_method is null
    and date_of_birth is null and emergency_contact_name is null and emergency_contact_phone is null
    and emergency_contact_relationship is null and profile_notes='' and availability_snapshot='{}'::jsonb
    and skills_help_snapshot='{}'::jsonb and cardinality(available_work_days)=0
    and housing_option='unknown' and after_hours_security_availability='unknown'
    and builder_assistant_communication='unknown' and available_two_plus_days='unknown'
    and skills_experience is null and other_support is null));

alter table public.calendar_assignments add column removal_reason text;
alter table public.calendar_assignments add constraint calendar_assignments_removal_reason_known
  check (removal_reason is null or (removal_reason='volunteer_deleted' and lifecycle='canceled'));
alter table public.questionnaire_submissions add column personal_data_redacted_at timestamptz;
alter table public.questionnaire_submissions add constraint questionnaire_redaction_minimal check (
  personal_data_redacted_at is null or answers='{"aboutYou":{},"availability":{},"skillsExperience":{},"emergencyContact":{},"otherWaysToHelp":{}}'::jsonb);

alter table public.communication_recipients add column recipient_redacted_at timestamptz;
alter table public.communication_recipients alter column email drop not null;
alter table public.communication_recipients add constraint communication_recipient_redaction_valid
  check ((email is not null and recipient_redacted_at is null) or (email is null and recipient_redacted_at is not null));
alter table public.volunteer_welcome_deliveries add column recipient_redacted_at timestamptz;
alter table public.volunteer_welcome_deliveries alter column email drop not null;
alter table public.volunteer_welcome_deliveries add constraint volunteer_welcome_redaction_valid
  check ((email is not null and recipient_redacted_at is null) or (email is null and recipient_redacted_at is not null));
alter table public.assignment_notification_deliveries add column recipient_redacted_at timestamptz;
alter table public.assignment_notification_deliveries add constraint assignment_notification_redaction_valid
  check (recipient_redacted_at is null or recipient_email_snapshot is null);
alter table public.assignment_notification_deliveries drop constraint assignment_notification_deliveries_state_metadata_valid;
alter table public.assignment_notification_deliveries add constraint assignment_notification_deliveries_state_metadata_valid check (
  (delivery_state='sending' and sending_started_at is not null and sending_expires_at is not null and sent_at is null and failed_at is null and safe_failure_code is null)
  or (delivery_state='sent' and sent_at is not null and failed_at is null and safe_failure_code is null and (recipient_email_snapshot is not null or recipient_redacted_at is not null))
  or (delivery_state='failed' and failed_at is not null and safe_failure_code is not null));

-- A shared row lock is the dispatch/access/creation authorization boundary.
-- Deletion takes the conflicting profile lock. This does not hold a DB transaction over HTTP.
create function public.lock_live_volunteer_profile(p_workspace uuid,p_profile uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare removed timestamptz;
begin
  select deleted_at into removed from public.volunteer_profiles
    where workspace_id=p_workspace and id=p_profile for share;
  return found and removed is null;
end $$;

create function public.guard_live_volunteer_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_value jsonb:=to_jsonb(new); person uuid;
begin
  if tg_table_name='calendar_assignments' and tg_op='UPDATE' and row_value->>'lifecycle'<>'active' then return new;end if;
  person:=coalesce(row_value->>'volunteer_profile_id',row_value->>'volunteer_id')::uuid;
  if not public.lock_live_volunteer_profile((row_value->>'workspace_id')::uuid,person) then
    raise exception 'Volunteer is unavailable in this project.' using errcode='42501';
  end if;
  return new;
end $$;
create trigger calendar_assignment_live_volunteer before insert or update of volunteer_profile_id,workspace_id,lifecycle
  on public.calendar_assignments for each row execute function public.guard_live_volunteer_reference();
create trigger schedule_token_live_volunteer before insert or update of volunteer_profile_id,workspace_id
  on public.volunteer_schedule_access_tokens for each row execute function public.guard_live_volunteer_reference();
create trigger response_token_live_volunteer before insert or update of volunteer_profile_id,workspace_id
  on public.assignment_response_tokens for each row execute function public.guard_live_volunteer_reference();
create trigger away_period_live_volunteer before insert or update on public.volunteer_away_periods
  for each row execute function public.guard_live_volunteer_reference();
create trigger recipient_live_volunteer before insert or update of volunteer_id,workspace_id
  on public.communication_recipients for each row execute function public.guard_live_volunteer_reference();
create trigger reminder_enrollment_live_volunteer before insert or update on public.assignment_reminder_enrollments
  for each row execute function public.guard_live_volunteer_reference();

create function public.volunteer_assignment_end_at(p_item uuid) returns timestamptz
language sql stable set search_path='' as $$
  select case when i.schedule_kind='timed' and i.end_time is not null
    then (coalesce(i.end_date,i.start_date)+i.end_time) at time zone i.timezone
    else ((coalesce(i.end_date,i.start_date)+1)::timestamp) at time zone i.timezone end
  from public.calendar_items i where i.id=p_item;
$$;

create function public.volunteer_deletion_impact(p_workspace uuid,p_profile uuid,p_now timestamptz) returns jsonb
language sql stable set search_path='' as $$
  with affected as (
    select a.id,a.updated_at,i.id item_id,i.updated_at item_version,i.publication_state,i.title_snapshot title,i.start_date,i.end_date,i.start_time,i.end_time,i.timezone,
      public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,i.timezone) start_at
    from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=a.workspace_id
    where a.workspace_id=p_workspace and a.volunteer_profile_id=p_profile and a.lifecycle='active'
      and public.volunteer_assignment_end_at(i.id)>p_now
  ) select jsonb_build_object('affectedCount',count(*),'upcomingCount',count(*) filter(where start_at>p_now),
    'inProgressCount',count(*) filter(where start_at<=p_now or start_at is null),
    'fingerprint',md5(coalesce(jsonb_agg(jsonb_build_array(id,updated_at,item_id,item_version) order by id)::text,'[]')),
    'nearest',(select jsonb_build_object('title',title,'date',start_date,'startTime',start_time,'timezone',timezone)
      from affected where publication_state='published' order by start_at nulls first,id limit 1)) from affected;
$$;

create function public.review_volunteer_deletion(p_workspace_id uuid,p_profile_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; capabilities text[]; person public.volunteer_profiles%rowtype; impact jsonb;
begin
  select c.id,array_agg(distinct capability) into actor,capabilities from public.workspace_contact_grants g
    join public.project_contacts c on c.id=g.project_contact_id join public.workspaces w on w.id=g.workspace_id
    cross join lateral unnest(g.capabilities) capability
    where g.workspace_id=p_workspace_id and c.auth_user_id=auth.uid() and c.status='active' and w.lifecycle='active'
      and g.status='active' and g.revoked_at is null and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
    group by c.id having array_agg(distinct capability) @> array['workspace.read','volunteers.view','volunteers.edit']::text[];
  if actor is null then raise exception 'Volunteer deletion is unavailable.' using errcode='42501';end if;
  select * into person from public.volunteer_profiles where id=p_profile_id and workspace_id=p_workspace_id;
  if not found then raise exception 'Volunteer is unavailable in this project.' using errcode='42501';end if;
  if person.deleted_at is not null then return jsonb_build_object('kind','already_deleted');end if;
  impact:=public.volunteer_deletion_impact(p_workspace_id,p_profile_id,statement_timestamp());
  if not (capabilities @> array['calendar.view','assignments.view']::text[]) then impact:=impact-'nearest';end if;
  return impact||jsonb_build_object('kind','review','profileId',person.id,'name',person.full_name,'version',person.updated_at,
    'canDelete',(impact->>'affectedCount')::integer=0 or capabilities @> array['calendar.view','assignments.view','assignments.edit']::text[]);
end $$;

create function public.delete_volunteer_profile(p_workspace_id uuid,p_profile_id uuid,p_expected_updated_at timestamptz,p_expected_impact text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; capabilities text[]; person public.volunteer_profiles%rowtype; impact jsonb; clock_at timestamptz;
begin
  perform set_config('lock_timeout','3s',true);
  select c.id,array_agg(distinct capability) into actor,capabilities from public.workspace_contact_grants g
    join public.project_contacts c on c.id=g.project_contact_id join public.workspaces w on w.id=g.workspace_id
    cross join lateral unnest(g.capabilities) capability
    where g.workspace_id=p_workspace_id and c.auth_user_id=auth.uid() and c.status='active' and w.lifecycle='active'
      and g.status='active' and g.revoked_at is null and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
    group by c.id having array_agg(distinct capability) @> array['workspace.read','volunteers.view','volunteers.edit']::text[];
  if actor is null then raise exception 'Volunteer deletion is unavailable.' using errcode='42501';end if;
  perform 1 from public.workspaces where id=p_workspace_id for update;
  select * into person from public.volunteer_profiles where id=p_profile_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'Volunteer is unavailable in this project.' using errcode='42501';end if;
  if person.deleted_at is not null then return jsonb_build_object('kind','already_deleted');end if;
  if p_expected_updated_at is null or person.updated_at<>p_expected_updated_at then raise exception 'Profile changed. Review the deletion again.' using errcode='40001';end if;
  perform 1 from public.calendar_items i where i.workspace_id=p_workspace_id and exists(
    select 1 from public.calendar_assignments a where a.workspace_id=p_workspace_id and a.volunteer_profile_id=p_profile_id and a.calendar_item_id=i.id)
    order by i.id for update;
  perform 1 from public.calendar_assignments where workspace_id=p_workspace_id and volunteer_profile_id=p_profile_id order by id for update;
  clock_at:=clock_timestamp(); impact:=public.volunteer_deletion_impact(p_workspace_id,p_profile_id,clock_at);
  if p_expected_impact is null or p_expected_impact<>impact->>'fingerprint' then raise exception 'Assignments changed. Review the deletion again.' using errcode='40001';end if;
  if (impact->>'affectedCount')::integer>0 and not (capabilities @> array['calendar.view','assignments.view','assignments.edit']::text[]) then
    raise exception 'Assignment editing access is required to remove current or upcoming assignments.' using errcode='42501';end if;
  update public.calendar_assignments set lifecycle='canceled',removal_reason='volunteer_deleted'
    where workspace_id=p_workspace_id and volunteer_profile_id=p_profile_id and lifecycle='active'
      and public.volunteer_assignment_end_at(calendar_item_id)>clock_at;
  update public.calendar_assignments set assignment_note=null where workspace_id=p_workspace_id and volunteer_profile_id=p_profile_id;
  -- Bulk plans duplicate the person-specific assignment-note input. Keep IDs
  -- and shared item creation context, but do not retain this redundant note.
  update public.calendar_bulk_assignment_operations b set plan=jsonb_set(b.plan,'{note}','null'::jsonb,false)
    where b.workspace_id=p_workspace_id and b.plan ? 'note' and exists(
      select 1 from jsonb_array_elements(coalesce(b.plan->'volunteers','[]'::jsonb)) v where (v->>'id')::uuid=p_profile_id);
  update public.assignment_responses r set response_note=null where r.workspace_id=p_workspace_id and exists(
    select 1 from public.calendar_assignments a where a.id=r.assignment_id and a.workspace_id=p_workspace_id and a.volunteer_profile_id=p_profile_id);
  update public.volunteer_schedule_access_tokens set revoked_at=coalesce(revoked_at,clock_at)
    where workspace_id=p_workspace_id and volunteer_profile_id=p_profile_id;
  update public.assignment_response_tokens set revoked_at=coalesce(revoked_at,clock_at),internal_note=null
    where workspace_id=p_workspace_id and volunteer_profile_id=p_profile_id;
  delete from public.volunteer_away_periods where workspace_id=p_workspace_id and volunteer_profile_id=p_profile_id;
  update public.assignment_reminder_occurrences o set scheduling_state='canceled',next_attempt_at=null
    where workspace_id=p_workspace_id and volunteer_id=p_profile_id and scheduling_state='active'
      and not exists(select 1 from public.communication_recipients r where r.id=o.recipient_id and r.state='sent');
  -- Sending/unknown/failed history is not rewritten into a fictitious non-send.
  update public.communication_recipients set state='excluded',failure_code='eligibility_changed',finalized_at=clock_at
    where workspace_id=p_workspace_id and volunteer_id=p_profile_id and state='ready';
  update public.communication_recipients r set email=null,recipient_redacted_at=clock_at,
    snapshot=jsonb_build_object('name',person.full_name,'workspaceName',coalesce(r.snapshot->>'workspaceName',r.snapshot->>'project'),
      'kind',r.snapshot->'kind','occurrenceKey',r.snapshot->'occurrenceKey','dueAt',r.snapshot->'dueAt',
      'assignments',coalesce((select jsonb_agg(jsonb_build_object('assignmentId',e->'assignmentId','itemId',e->'itemId',
        'title',e->'title','date',e->'date','endDate',e->'endDate','startTime',e->'startTime','endTime',e->'endTime','response',e->'response'))
        from jsonb_array_elements(coalesce(r.snapshot->'assignments','[]'::jsonb)) e),'[]'::jsonb))
    where r.workspace_id=p_workspace_id and r.volunteer_id=p_profile_id;
  update public.volunteer_welcome_deliveries set email=null,recipient_redacted_at=clock_at where workspace_id=p_workspace_id and volunteer_id=p_profile_id;
  update public.assignment_notification_deliveries set recipient_email_snapshot=null,recipient_redacted_at=clock_at
    where workspace_id=p_workspace_id and volunteer_profile_id=p_profile_id;
  update public.questionnaire_submissions set answers='{"aboutYou":{},"availability":{},"skillsExperience":{},"emergencyContact":{},"otherWaysToHelp":{}}',personal_data_redacted_at=clock_at
    where id=person.source_submission_id and workspace_id=p_workspace_id;
  update public.volunteer_profiles set deleted_at=clock_at,deleted_by=actor,lifecycle='archived',readiness_status='on_hold',
    email=null,phone=null,congregation=null,preferred_contact_method=null,profile_notes='',date_of_birth=null,
    emergency_contact_name=null,emergency_contact_phone=null,emergency_contact_relationship=null,
    availability_snapshot='{}',skills_help_snapshot='{}',available_work_days='{}',available_two_plus_days='unknown',
    housing_option='unknown',after_hours_security_availability='unknown',builder_assistant_communication='unknown',
    skills_experience=null,other_support=null where id=p_profile_id and workspace_id=p_workspace_id;
  return jsonb_build_object('kind','deleted','affectedCount',(impact->>'affectedCount')::integer);
end $$;

-- EXISTING_BOUNDARY_UPDATES

-- Existing boundary: assignment_reminder_context
CREATE OR REPLACE FUNCTION public.assignment_reminder_context(p_assignment uuid, p_now timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
select jsonb_build_object('assignmentId',a.id,'volunteerId',v.id,'workspaceId',w.id,
  'name',v.full_name,'email',lower(nullif(btrim(v.email),'')),'project',w.display_name,
  'title',i.title_snapshot,'date',i.start_date,'endDate',i.end_date,'startTime',i.start_time,'endTime',i.end_time,
  'timezone',w.timezone,'startAt',public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,w.timezone),
  'response',r.response_status,'version',jsonb_build_array(a.updated_at,i.updated_at,r.updated_at,v.updated_at,w.updated_at),
  'createdAt',a.created_at,'respondedAt',coalesce(r.responded_at,r.created_at),
  'followUp',case when c.id is not null then jsonb_build_object('name',c.volunteer_facing_display_name,'email',c.volunteer_facing_email,'phone',c.volunteer_facing_phone) end)
from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=a.workspace_id
join public.workspaces w on w.id=a.workspace_id
join public.volunteer_profiles v on v.id=a.volunteer_profile_id and v.workspace_id=a.workspace_id
join public.assignment_responses r on r.assignment_id=a.id and r.workspace_id=a.workspace_id
left join public.project_contacts c on c.id=i.follow_up_project_contact_id and c.status='active'
 and nullif(btrim(c.volunteer_facing_display_name),'') is not null
 and exists(select 1 from public.workspace_contact_grants g where g.project_contact_id=c.id and g.workspace_id=w.id
   and g.status='active' and g.revoked_at is null and g.valid_from<=p_now and (g.valid_until is null or g.valid_until>p_now))
where a.id=p_assignment and a.lifecycle='active' and i.lifecycle='active' and i.publication_state='published'
 and i.schedule_kind in ('timed','date_based') and i.meal_kind is null
 and w.lifecycle='active' and v.lifecycle='active' and v.deleted_at is null and v.readiness_status='ready'
 and r.response_status in ('confirmed','needs_response')
 and public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,w.timezone)>p_now
$$;

-- Existing boundary: assignment_reminder_dispatch_context
CREATE OR REPLACE FUNCTION public.assignment_reminder_dispatch_context(p_recipient uuid, p_claim uuid, p_now timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare o public.assignment_reminder_occurrences%rowtype; r public.communication_recipients%rowtype; c jsonb;
begin
 perform public.lock_live_volunteer_profile(x.workspace_id,x.volunteer_id)
   from public.assignment_reminder_occurrences x where x.recipient_id=p_recipient;
 select * into o from public.assignment_reminder_occurrences where recipient_id=p_recipient for update;
 select * into r from public.communication_recipients where id=p_recipient for update;
 if o.id is null or r.state<>'sending' or r.claim_id is distinct from p_claim then return null;end if;
 c:=public.assignment_reminder_context(o.assignment_id,p_now);
 if not exists(select 1 from public.assignment_reminder_activation where singleton and delivery_enabled)
   or o.scheduling_state<>'active' or c is null or c->'version' is distinct from r.snapshot->'version'
   or c->>'email' is distinct from r.email or (c->>'startAt')::timestamptz<>o.start_at
   or (o.kind='response') is distinct from (c->>'response'='needs_response') then
   update public.communication_recipients set state='excluded',failure_code='eligibility_changed',finalized_at=p_now where id=r.id;
   insert into public.assignment_reminder_events(occurrence_id,workspace_id,recipient_id,event,happened_at,due_at,attempt) values(o.id,o.workspace_id,r.id,'excluded',p_now,o.due_at,r.attempt);
   return null;
 end if;
 return r.snapshot||jsonb_build_object('recipientId',r.id,'operationId',r.operation_id,'claimId',r.claim_id,'attempt',r.attempt,'occurrenceId',o.id,
 'insideCutoff',o.start_at<=p_now+interval '48 hours');
end $$;

-- Existing boundary: assignment_reminder_report
CREATE OR REPLACE FUNCTION public.assignment_reminder_report(p_workspace uuid, p_now timestamp with time zone, p_after uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $_$
declare candidate record; e public.assignment_reminder_enrollments%rowtype; prior record;
 start_instant timestamptz; due timestamptz; anchor timestamptz; reason text; k text; d integer; n integer;
 inspected integer:=0; last_id uuid; more boolean:=false; would_enroll boolean; zone text;
 planning jsonb:='[]'; reminders jsonb; history jsonb; included uuid[]:='{}';
begin
 select timezone into zone from public.workspaces where id=p_workspace;
 -- Start-date scope: today and future, including excluded assignments on those
 -- items. No historical assignment walk. Read 100 assignments plus one sentinel.
 for candidate in with future_items as materialized (
   select id from public.calendar_items where workspace_id=p_workspace
    and start_date>=(p_now at time zone zone)::date
 ) select ca.id,ca.volunteer_profile_id,ca.lifecycle assignment_lifecycle,
   v.full_name,v.email,v.lifecycle volunteer_lifecycle,v.readiness_status,
   i.title_snapshot,i.lifecycle item_lifecycle,i.publication_state,i.schedule_kind,i.meal_kind,i.start_date,i.start_time,
   r.response_status,w.lifecycle workspace_lifecycle
 from future_items fi cross join lateral (
   select id,workspace_id,calendar_item_id,volunteer_profile_id,lifecycle from public.calendar_assignments
   where workspace_id=p_workspace and calendar_item_id=fi.id and (p_after is null or id>p_after) order by id limit 101
 ) ca
 join public.calendar_items i on i.id=ca.calendar_item_id and i.workspace_id=ca.workspace_id
 join public.volunteer_profiles v on v.id=ca.volunteer_profile_id and v.workspace_id=ca.workspace_id and v.deleted_at is null
 join public.workspaces w on w.id=ca.workspace_id
 left join public.assignment_responses r on r.assignment_id=ca.id and r.workspace_id=ca.workspace_id
 order by ca.id limit 101 loop
   if inspected=100 then more:=true;exit;end if;
   inspected:=inspected+1;last_id:=candidate.id;reminders:='[]';would_enroll:=false;
   start_instant:=public.calendar_assignment_response_start_at(candidate.schedule_kind,candidate.start_date,candidate.start_time,zone);
   reason:=case
     when candidate.workspace_lifecycle<>'active' then 'Project is inactive'
     when candidate.assignment_lifecycle<>'active' then 'Assignment is canceled or inactive'
     when candidate.item_lifecycle<>'active' then 'Calendar item is inactive'
     when candidate.publication_state<>'published' then 'Calendar item is unpublished'
     when candidate.meal_kind is not null or candidate.schedule_kind not in ('timed','date_based') then 'Meal or information-only item'
     when candidate.volunteer_lifecycle<>'active' or candidate.readiness_status<>'ready' then 'Volunteer is inactive or not ready'
     when candidate.response_status='declined' then 'Volunteer declined'
     when candidate.response_status is null or candidate.response_status not in ('confirmed','needs_response') then 'No actionable response state'
     when start_instant is null or start_instant<=p_now then 'Assignment has already started'
     when candidate.email is null or btrim(candidate.email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(btrim(candidate.email))>254 then 'No valid delivery destination'
   end;
   if reason is null then
     select * into e from public.assignment_reminder_enrollments where workspace_id=p_workspace and assignment_id=candidate.id;
     for d in select unnest(case when candidate.response_status='confirmed' then array[30,14,7,3,1] else array[0] end) loop
       if candidate.response_status='confirmed' then
         k:='shift:'||d;due:=public.assignment_reminder_local_offset(start_instant,zone,-d);
       else
         -- Existing enrollment retains its real anchor. Without enrollment this
         -- is hypothetical activation NOW, never historical notification catch-up.
         anchor:=coalesce(e.pending_anchor,p_now);
         n:=greatest(1,((p_now at time zone zone)::date-(anchor at time zone zone)::date)/3);
         due:=public.assignment_reminder_local_offset(anchor,zone,n*3);
         if due<=p_now then n:=n+1;due:=public.assignment_reminder_local_offset(anchor,zone,n*3);end if;
         k:='pending:'||n;
       end if;
       if due<=p_now or due>=start_instant then continue;end if;
       select o.id,o.due_at,o.scheduling_state,r.state,r.attempt,r.claimed_at,r.finalized_at,r.failure_code into prior from public.assignment_reminder_occurrences o
         left join public.communication_recipients r on r.id=o.recipient_id and r.workspace_id=o.workspace_id
         where o.workspace_id=p_workspace and o.assignment_id=candidate.id and o.volunteer_id=candidate.volunteer_profile_id
           and o.kind=case when candidate.response_status='confirmed' then 'shift' else 'response' end and o.occurrence_key=k;
       if prior.id is not null then
         included:=array_append(included,prior.id);
         reminders:=reminders||jsonb_build_array(jsonb_build_object('id',prior.id,'source','existing','occurrence_key',k,'due_at',prior.due_at,
           'state',coalesce(prior.state,prior.scheduling_state),'scheduling_state',prior.scheduling_state,
           'attempt',prior.attempt,'claimed_at',prior.claimed_at,'finalized_at',prior.finalized_at,'failure_code',prior.failure_code,
           'events',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from
             (select ev.id,ev.event,ev.happened_at,ev.due_at,ev.attempt from public.assignment_reminder_events ev where ev.occurrence_id=prior.id order by ev.id desc limit 25) h),'[]')));
       else
         would_enroll:=true;
         reminders:=reminders||jsonb_build_array(jsonb_build_object('id',null,'source','hypothetical','occurrence_key',k,'due_at',due,'state','Would enroll'));
       end if;
     end loop;
     reason:=case when jsonb_array_length(reminders)=0 then
       case when candidate.response_status='confirmed' then 'No remaining future confirmed threshold' else 'No future pending reminder before assignment start' end
       when would_enroll then case when candidate.response_status='confirmed' then 'Future thresholds only; no catch-up' else 'Every 3 project-local days until start' end
       else 'Existing occurrence identities; no duplicate enrollment' end;
   end if;
   planning:=planning||jsonb_build_array(jsonb_build_object('assignment_id',candidate.id,'volunteer',candidate.full_name,'assignment',candidate.title_snapshot,
     'response',candidate.response_status,'start_at',start_instant,'destination',case when candidate.email is null then 'No email' else left(btrim(candidate.email),1)||'***@'||split_part(btrim(candidate.email),'@',2) end,
     'classification',case when would_enroll then 'would_enroll' when jsonb_array_length(reminders)>0 then 'existing' else 'excluded' end,
     'reason',reason,'reminders',reminders));
 end loop;
 -- Limit history BEFORE live context/audit calculation; the index avoids scanning
 -- all historical deliveries. Existing identities on this planning page appear once.
 with recent as materialized (
   select * from public.assignment_reminder_occurrences where workspace_id=p_workspace order by due_at desc,id limit 200
 )
 select coalesce(jsonb_agg(to_jsonb(t) order by t.eligible desc nulls last,t.due_at desc,t.id),'[]') into history from (
 select o.id,o.assignment_id,o.kind,o.occurrence_key,o.due_at,o.scheduling_state,
   coalesce(c->>'name',v.full_name)||case when v.deleted_at is not null then ' · Deleted volunteer' else '' end volunteer,coalesce(c->>'title',i.title_snapshot) assignment,
   ar.response_status response,case when v.email is null then 'No email' else left(v.email,1)||'***@'||split_part(v.email,'@',2) end destination,
   r.state,r.attempt,r.claimed_at,r.finalized_at,r.failure_code,
   (c is not null and (c->>'startAt')::timestamptz=o.start_at
    and (o.kind='response')=(c->>'response'='needs_response')
    and c->>'email' ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(c->>'email')<=254
    and o.scheduling_state='active' and o.due_at<=p_now and o.due_at>=p_now-interval '15 minutes'
    and coalesce(o.next_attempt_at,o.due_at)<=p_now and coalesce(r.state,'ready') in ('ready','failed') and coalesce(r.attempt,0)<3) eligible,
   case when c is null or (o.kind='response') is distinct from (c->>'response'='needs_response') or (c->>'startAt')::timestamptz is distinct from o.start_at then 'Assignment eligibility changed'
    when o.scheduling_state='invalid_destination' or c->>'email' is null or c->>'email' !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then 'Add a valid delivery destination'
    when r.state in ('sending','unknown') then 'Outcome needs reconciliation; automatic retry blocked'
    when r.state='failed' and r.attempt>=3 then 'Retry limit reached'
    when o.due_at>p_now then 'Future occurrence' else 'Enrolled occurrence in dispatch window' end reason,
   coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from (select ev.id,ev.event,ev.happened_at,ev.due_at,ev.attempt from public.assignment_reminder_events ev where ev.occurrence_id=o.id order by ev.id desc limit 25) h),'[]') events
 from recent o
 join public.volunteer_profiles v on v.id=o.volunteer_id and v.workspace_id=o.workspace_id
 join public.calendar_assignments a on a.id=o.assignment_id and a.workspace_id=o.workspace_id
 join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=o.workspace_id
 join public.assignment_responses ar on ar.assignment_id=a.id
 left join public.communication_recipients r on r.id=o.recipient_id
 left join lateral (select public.assignment_reminder_context(o.assignment_id,p_now) c) ctx on true
 where not(o.id=any(included))) t;
 return jsonb_build_object('enabled',(select delivery_enabled from public.assignment_reminder_activation where singleton),
 'baselineAt',(select baseline_at from public.assignment_reminder_activation where singleton),
 'prospective',jsonb_build_object('at',p_now,'timezone',zone,'scope','Assignments starting today or later in the project timezone',
   'inspected',inspected,'limit',100,'nextAfter',case when more then last_id end,'rows',planning),
 'rows',history);
end $_$;

-- Existing boundary: cancel_calendar_assignment
CREATE OR REPLACE FUNCTION public.cancel_calendar_assignment(p_assignment_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  canceled_assignment_id uuid;
begin
  if not exists(select 1 from public.calendar_assignments a where a.id=p_assignment_id
    and public.lock_live_volunteer_profile(a.workspace_id,a.volunteer_profile_id)) then
    raise exception 'Assignment is unavailable.' using errcode='42501';end if;
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Assignment cancellation is unavailable.' using errcode = '42501';
  end if;

  update public.calendar_assignments as assignment
  set lifecycle = 'canceled'
  where assignment.id = p_assignment_id
    and assignment.lifecycle = 'active'
    and exists (
      select 1
      from public.calendar_items as item
      join public.workspace_contact_grants as grant_row
        on grant_row.workspace_id = assignment.workspace_id
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where item.id = assignment.calendar_item_id
        and item.workspace_id = assignment.workspace_id
        and item.lifecycle = 'active'
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
        and (
          item.publication_state = 'published'
          or item.created_by_project_contact_id = contact.id
        )
    )
  returning id into canceled_assignment_id;

  if canceled_assignment_id is null then
    raise exception 'Assignment cancellation is unavailable.' using errcode = '42501';
  end if;

  return canceled_assignment_id;
end;
$$;

-- Existing boundary: claim_assignment_reminder
CREATE OR REPLACE FUNCTION public.claim_assignment_reminder(p_occurrence uuid, p_now timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare o public.assignment_reminder_occurrences%rowtype; c jsonb; r public.communication_recipients%rowtype; operation uuid; claim uuid;
begin
 if not exists(select 1 from public.assignment_reminder_occurrences x where x.id=p_occurrence
   and public.lock_live_volunteer_profile(x.workspace_id,x.volunteer_id)) then return null;end if;
 if not exists(select 1 from public.assignment_reminder_activation where singleton and delivery_enabled and baseline_at<=p_now) then return null; end if;
 select * into o from public.assignment_reminder_occurrences where id=p_occurrence for update skip locked;
 if not found or o.scheduling_state<>'active' or o.due_at>p_now or coalesce(o.next_attempt_at,o.due_at)>p_now then return null; end if;
 -- Fifteen-minute dispatch window. Outage recovery never blasts missed occurrences.
 if o.due_at<p_now-interval '15 minutes' then update public.assignment_reminder_occurrences set scheduling_state='expired' where id=o.id;return null;end if;
 c:=public.assignment_reminder_context(o.assignment_id,p_now);
 if c is null or (c->>'startAt')::timestamptz<>o.start_at or (o.kind='response') is distinct from (c->>'response'='needs_response') then
   update public.assignment_reminder_occurrences set scheduling_state='canceled' where id=o.id;return null;
 end if;
 if c->>'email' is null or length(c->>'email')>254 or c->>'email' !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
   update public.assignment_reminder_occurrences set scheduling_state='invalid_destination' where id=o.id;return null;
 end if;
 if o.recipient_id is null then
   operation:=gen_random_uuid();
   insert into public.communication_operations(id,workspace_id,kind,mode,plan) values(operation,o.workspace_id,'reminder','automatic',jsonb_build_object('occurrence',o.id));
   insert into public.communication_recipients(workspace_id,operation_id,volunteer_id,email,snapshot)
     values(o.workspace_id,operation,o.volunteer_id,c->>'email',c||jsonb_build_object('kind',o.kind,'occurrenceKey',o.occurrence_key,'dueAt',o.due_at,'assignments',jsonb_build_array(jsonb_build_object('assignmentId',o.assignment_id)))) returning * into r;
   update public.assignment_reminder_occurrences set recipient_id=r.id where id=o.id;
 else
   select * into r from public.communication_recipients where id=o.recipient_id for update;
   if r.state not in ('ready','failed') or r.attempt>=3 then return null;end if;
 end if;
 claim:=gen_random_uuid();
 update public.communication_recipients set state='sending',attempt=attempt+1,claim_id=claim,claimed_at=p_now,finalized_at=null where id=r.id returning * into r;
 insert into public.assignment_reminder_events(occurrence_id,workspace_id,recipient_id,event,happened_at,due_at,attempt) values(o.id,o.workspace_id,r.id,'claimed',p_now,o.due_at,r.attempt);
 return r.snapshot||jsonb_build_object('recipientId',r.id,'operationId',r.operation_id,'claimId',claim,'attempt',r.attempt,'occurrenceId',o.id);
end $_$;

-- Existing boundary: claim_communication_recipient
CREATE OR REPLACE FUNCTION public.claim_communication_recipient(p_recipient_id uuid, p_retry boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare row public.communication_recipients%rowtype; actor uuid; operation public.communication_operations%rowtype;
  claim uuid; current_email text; valid boolean;
begin
  if exists(select 1 from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id where r.id=p_recipient_id and o.kind='reminder') then raise exception 'System-owned reminder.' using errcode='42501';end if;
  select * into row from public.communication_recipients where id=p_recipient_id;
  actor:=public.communication_actor(row.workspace_id);
  perform 1 from public.workspaces where id=row.workspace_id for update;
  select * into row from public.communication_recipients where id=p_recipient_id for update;
  if row.recipient_redacted_at is not null then return null;end if;
  if row.state<>'ready' and not (p_retry is true and row.state='failed') then return null; end if;
  if row.attempt>=25 then return null; end if;
  select * into operation from public.communication_operations where id=row.operation_id;
  select lower(btrim(email)) into current_email from public.volunteer_profiles
    where id=row.volunteer_id and workspace_id=row.workspace_id and lifecycle='active' and deleted_at is null for share;
  valid:=current_email is not null and current_email=row.email;
  if exists(select 1 from public.volunteer_profiles v where v.workspace_id=row.workspace_id
    and v.id<>row.volunteer_id and v.lifecycle='active' and v.deleted_at is null and lower(btrim(v.email))=row.email)
    and coalesce((row.snapshot->>'sharedContact')::boolean,false)=false then valid:=false; end if;
  if operation.kind='schedule' then
    perform 1 from public.calendar_items i join public.communication_assignment_coverage c on c.recipient_id=row.id
      join public.calendar_assignments a on a.id=c.assignment_id and a.calendar_item_id=i.id order by i.id for share of i,a;
    if exists(select 1 from jsonb_array_elements(row.snapshot->'assignments') e
      left join public.calendar_assignments a on a.id=(e->>'assignmentId')::uuid
      left join public.calendar_items i on i.id=a.calendar_item_id
      left join public.assignment_responses r on r.assignment_id=a.id
      where a.id is null or a.lifecycle<>'active' or i.lifecycle<>'active' or i.publication_state<>'published'
        or r.response_status='declined' or r.response_status is null or i.updated_at<>(e->>'itemVersion')::timestamptz
        or a.updated_at<>(e->>'assignmentVersion')::timestamptz
        or public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,i.timezone)<=now()) then valid:=false; end if;
  end if;
  if not valid then
    update public.communication_recipients set state='excluded',failure_code='eligibility_changed',finalized_at=now() where id=row.id;
    -- Preserve the ledger reservation. A fresh reviewed operation can take
    -- ownership of an excluded, never-dispatched claim; legacy sends stay blocked.
    return null;
  end if;
  claim:=gen_random_uuid();
  update public.communication_recipients set state='sending',attempt=attempt+1,claim_id=claim,claimed_by=actor,
    claimed_at=now(),finalized_at=null,failure_code=null where id=row.id;
  return row.snapshot||jsonb_build_object('operationId',row.operation_id,'recipientId',row.id,'claimId',claim,'attempt',row.attempt+1);
end $$;

-- Existing boundary: claim_initial_assignment_notification_deliveries
CREATE OR REPLACE FUNCTION public.claim_initial_assignment_notification_deliveries(p_calendar_item_id uuid) RETURNS TABLE(delivery_id uuid, calendar_assignment_id uuid, volunteer_profile_id uuid, recipient_email text, volunteer_display_name text, workspace_display_name text, workspace_timezone text, calendar_item_id uuid, task_title text, task_type text, schedule_kind text, start_date date, end_date date, start_time time without time zone, end_time time without time zone, needed_count integer, schedule_notes text, follow_up_contact_display_name text, follow_up_contact_email text, follow_up_contact_phone text, send_status text, attempt_count integer, idempotency_key text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  caller_user_id uuid;
  caller_project_contact_id uuid;
  target_workspace_id uuid;
  item_start_at timestamptz;
  candidate record;
  existing_delivery public.assignment_notification_deliveries%rowtype;
  claimed_delivery public.assignment_notification_deliveries%rowtype;
  normalized_recipient_email text;
  candidate_status text;
  candidate_failure text;
begin
  caller_user_id := auth.uid();

  select item.workspace_id, contact.id,
    public.calendar_assignment_response_start_at(
      item.schedule_kind,
      item.start_date,
      item.start_time,
      item.timezone
    )
  into target_workspace_id, caller_project_contact_id, item_start_at
  from public.calendar_items as item
  join public.workspaces as workspace
    on workspace.id = item.workspace_id
  join public.workspace_contact_grants as grant_row
    on grant_row.workspace_id = item.workspace_id
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and workspace.lifecycle = 'active'
    and contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['assignments.edit']::text[]
  limit 1;

  if caller_user_id is null
    or p_calendar_item_id is null
    or target_workspace_id is null
    or caller_project_contact_id is null
    or item_start_at is null
    or item_start_at <= now()
  then
    raise exception 'Initial assignment notification is unavailable.' using errcode = '42501';
  end if;

  perform 1 from public.workspaces where id=target_workspace_id for update;
  for candidate in
    select
      assignment.id as assignment_id,
      assignment.volunteer_profile_id,
      volunteer.full_name as volunteer_display_name,
      lower(nullif(btrim(volunteer.email), '')) as normalized_email,
      volunteer.lifecycle as volunteer_lifecycle,
      volunteer.readiness_status,
      workspace.display_name as workspace_display_name,
      workspace.timezone as workspace_timezone,
      item.id as item_id,
      item.title_snapshot,
      item.task_type_snapshot,
      item.schedule_kind,
      item.start_date,
      item.end_date,
      item.start_time,
      item.end_time,
      item.needed_count,
      item.schedule_notes,
      follow_contact.volunteer_facing_display_name as follow_up_display_name,
      lower(nullif(btrim(follow_contact.volunteer_facing_email), '')) as follow_up_email,
      follow_contact.volunteer_facing_phone as follow_up_phone,
      (
        follow_contact.id is not null
        and follow_contact.volunteer_facing_display_name is not null
        and follow_contact.volunteer_facing_email is not null
        and follow_contact.volunteer_facing_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        and exists (
          select 1
          from public.workspace_contact_grants as follow_grant
          where follow_grant.workspace_id = item.workspace_id
            and follow_grant.project_contact_id = follow_contact.id
            and follow_grant.status = 'active'
            and follow_grant.revoked_at is null
            and follow_grant.valid_from <= now()
            and (follow_grant.valid_until is null or follow_grant.valid_until > now())
        )
      ) as has_follow_up_contact
    from public.calendar_assignments as assignment
    join public.calendar_items as item
      on item.id = assignment.calendar_item_id
      and item.workspace_id = assignment.workspace_id
    join public.workspaces as workspace
      on workspace.id = assignment.workspace_id
    join public.volunteer_profiles as volunteer
      on volunteer.id = assignment.volunteer_profile_id
      and volunteer.workspace_id = assignment.workspace_id
    left join public.project_contacts as follow_contact
      on follow_contact.id = item.follow_up_project_contact_id
      and follow_contact.status = 'active'
    where assignment.workspace_id = target_workspace_id
      and assignment.calendar_item_id = p_calendar_item_id
      and assignment.lifecycle = 'active'
    order by assignment.created_at asc, assignment.id asc
  loop
    if not public.lock_live_volunteer_profile(target_workspace_id,candidate.volunteer_profile_id) then continue;end if;
    normalized_recipient_email := candidate.normalized_email;
    if normalized_recipient_email is not null
      and normalized_recipient_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      normalized_recipient_email := null;
    end if;
    candidate_status := 'sendable';
    candidate_failure := null;

    select *
    into existing_delivery
    from public.assignment_notification_deliveries as delivery
    where delivery.calendar_assignment_id = candidate.assignment_id
      and delivery.notification_kind = 'initial_assignment'
      and delivery.template_version = 'initial-assignment.v1'
    for update;

    if existing_delivery.id is not null and existing_delivery.delivery_state = 'sent' then
      delivery_id := existing_delivery.id;
      calendar_assignment_id := candidate.assignment_id;
      volunteer_profile_id := candidate.volunteer_profile_id;
      recipient_email := existing_delivery.recipient_email_snapshot;
      volunteer_display_name := candidate.volunteer_display_name;
      workspace_display_name := candidate.workspace_display_name;
      workspace_timezone := candidate.workspace_timezone;
      calendar_item_id := candidate.item_id;
      task_title := candidate.title_snapshot;
      task_type := candidate.task_type_snapshot;
      schedule_kind := candidate.schedule_kind;
      start_date := candidate.start_date;
      end_date := candidate.end_date;
      start_time := candidate.start_time;
      end_time := candidate.end_time;
      needed_count := candidate.needed_count;
      schedule_notes := candidate.schedule_notes;
      follow_up_contact_display_name := candidate.follow_up_display_name;
      follow_up_contact_email := candidate.follow_up_email;
      follow_up_contact_phone := candidate.follow_up_phone;
      send_status := 'already_sent';
      attempt_count := existing_delivery.attempt_count;
      idempotency_key := existing_delivery.idempotency_key;
      return next;
      existing_delivery := null;
      continue;
    end if;

    if existing_delivery.id is not null
      and existing_delivery.delivery_state = 'sending'
      and existing_delivery.sending_expires_at > now()
    then
      delivery_id := existing_delivery.id;
      calendar_assignment_id := candidate.assignment_id;
      volunteer_profile_id := candidate.volunteer_profile_id;
      recipient_email := existing_delivery.recipient_email_snapshot;
      volunteer_display_name := candidate.volunteer_display_name;
      workspace_display_name := candidate.workspace_display_name;
      workspace_timezone := candidate.workspace_timezone;
      calendar_item_id := candidate.item_id;
      task_title := candidate.title_snapshot;
      task_type := candidate.task_type_snapshot;
      schedule_kind := candidate.schedule_kind;
      start_date := candidate.start_date;
      end_date := candidate.end_date;
      start_time := candidate.start_time;
      end_time := candidate.end_time;
      needed_count := candidate.needed_count;
      schedule_notes := candidate.schedule_notes;
      follow_up_contact_display_name := candidate.follow_up_display_name;
      follow_up_contact_email := candidate.follow_up_email;
      follow_up_contact_phone := candidate.follow_up_phone;
      send_status := 'already_sending';
      attempt_count := existing_delivery.attempt_count;
      idempotency_key := existing_delivery.idempotency_key;
      return next;
      existing_delivery := null;
      continue;
    end if;

    if candidate.volunteer_lifecycle <> 'active'
      or candidate.readiness_status <> 'ready'
    then
      candidate_status := 'not_eligible';
      candidate_failure := 'not_eligible';
    elsif normalized_recipient_email is null
      or normalized_recipient_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      candidate_status := 'missing_recipient_email';
      candidate_failure := 'missing_recipient_email';
    elsif not candidate.has_follow_up_contact then
      candidate_status := 'missing_follow_up_contact';
      candidate_failure := 'missing_follow_up_contact';
    end if;

    if candidate_status = 'sendable' then
      if existing_delivery.id is null then
        insert into public.assignment_notification_deliveries (
          workspace_id,
          calendar_item_id,
          calendar_assignment_id,
          volunteer_profile_id,
          notification_kind,
          template_version,
          delivery_state,
          attempt_count,
          recipient_email_snapshot,
          idempotency_key,
          initiated_by_project_contact_id,
          sending_started_at,
          sending_expires_at
        )
        values (
          target_workspace_id,
          candidate.item_id,
          candidate.assignment_id,
          candidate.volunteer_profile_id,
          'initial_assignment',
          'initial-assignment.v1',
          'sending',
          1,
          normalized_recipient_email,
          'initial_assignment:initial-assignment.v1:' || candidate.assignment_id::text,
          caller_project_contact_id,
          now(),
          now() + interval '15 minutes'
        )
        returning * into claimed_delivery;
      else
        update public.assignment_notification_deliveries as delivery
        set delivery_state = 'sending',
            attempt_count = least(delivery.attempt_count + 1, 25),
            recipient_email_snapshot = normalized_recipient_email,
            provider_message_id = null,
            safe_failure_code = null,
            initiated_by_project_contact_id = caller_project_contact_id,
            sending_started_at = now(),
            sending_expires_at = now() + interval '15 minutes',
            sent_at = null,
            failed_at = null
        where delivery.id = existing_delivery.id
          and (
            existing_delivery.delivery_state = 'failed'
            or (
              existing_delivery.delivery_state = 'sending'
              and existing_delivery.sending_expires_at <= now()
            )
          )
        returning * into claimed_delivery;
      end if;
    else
      if existing_delivery.id is null then
        insert into public.assignment_notification_deliveries (
          workspace_id,
          calendar_item_id,
          calendar_assignment_id,
          volunteer_profile_id,
          notification_kind,
          template_version,
          delivery_state,
          attempt_count,
          recipient_email_snapshot,
          safe_failure_code,
          idempotency_key,
          initiated_by_project_contact_id,
          failed_at
        )
        values (
          target_workspace_id,
          candidate.item_id,
          candidate.assignment_id,
          candidate.volunteer_profile_id,
          'initial_assignment',
          'initial-assignment.v1',
          'failed',
          1,
          normalized_recipient_email,
          candidate_failure,
          'initial_assignment:initial-assignment.v1:' || candidate.assignment_id::text,
          caller_project_contact_id,
          now()
        )
        returning * into claimed_delivery;
      else
        update public.assignment_notification_deliveries as delivery
        set delivery_state = 'failed',
            recipient_email_snapshot = normalized_recipient_email,
            provider_message_id = null,
            safe_failure_code = candidate_failure,
            initiated_by_project_contact_id = caller_project_contact_id,
            sending_started_at = null,
            sending_expires_at = null,
            sent_at = null,
            failed_at = now()
        where delivery.id = existing_delivery.id
          and delivery.delivery_state <> 'sent'
        returning * into claimed_delivery;
      end if;
    end if;

    if claimed_delivery.id is not null then
      delivery_id := claimed_delivery.id;
      calendar_assignment_id := candidate.assignment_id;
      volunteer_profile_id := candidate.volunteer_profile_id;
      recipient_email := claimed_delivery.recipient_email_snapshot;
      volunteer_display_name := candidate.volunteer_display_name;
      workspace_display_name := candidate.workspace_display_name;
      workspace_timezone := candidate.workspace_timezone;
      calendar_item_id := candidate.item_id;
      task_title := candidate.title_snapshot;
      task_type := candidate.task_type_snapshot;
      schedule_kind := candidate.schedule_kind;
      start_date := candidate.start_date;
      end_date := candidate.end_date;
      start_time := candidate.start_time;
      end_time := candidate.end_time;
      needed_count := candidate.needed_count;
      schedule_notes := candidate.schedule_notes;
      follow_up_contact_display_name := candidate.follow_up_display_name;
      follow_up_contact_email := candidate.follow_up_email;
      follow_up_contact_phone := candidate.follow_up_phone;
      send_status := candidate_status;
      attempt_count := claimed_delivery.attempt_count;
      idempotency_key := claimed_delivery.idempotency_key;
      return next;
    end if;

    existing_delivery := null;
    claimed_delivery := null;
  end loop;
end;
$_$;

-- Existing boundary: communication_preview
CREATE OR REPLACE FUNCTION public.communication_preview(p_workspace uuid, p_plan jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  person record; entries jsonb; recipient jsonb;
  recipients jsonb:='[]'; exclusions jsonb:='[]';
  selected_kind text:=p_plan->>'kind'; selected_mode text:=p_plan->>'mode';
  ids uuid[]; start_day date; end_day date; reason text;
  previous_email text; busy boolean; shared_contact boolean; new_count integer; old_count integer;
  workspace_name text; excluded_count integer:=0; prior_snapshot jsonb; prior_sent_at timestamptz; changed_count integer; removed_count integer;
begin
  perform public.communication_actor(p_workspace);
  if jsonb_typeof(p_plan) is distinct from 'object' or octet_length(p_plan::text)>20000
    or (p_plan-array['kind','mode','startDate','endDate','volunteerIds'])<>'{}'
    or selected_kind is null or selected_kind not in ('welcome','schedule') or selected_mode is null or selected_mode not in ('new','all','resend')
    or jsonb_typeof(p_plan->'volunteerIds') is distinct from 'array'
    or jsonb_array_length(p_plan->'volunteerIds')>200
    or (selected_kind='welcome' and selected_mode='all')
  then raise exception 'Invalid communication selection.' using errcode='22023'; end if;
  select coalesce(array_agg(value::uuid),'{}') into ids from jsonb_array_elements_text(p_plan->'volunteerIds');
  if cardinality(ids)<>(select count(distinct id) from unnest(ids) id)
    or array_position(ids,null) is not null or (selected_mode='resend' and cardinality(ids)=0)
    or exists(select 1 from unnest(ids) requested(id) where not exists(select 1 from public.volunteer_profiles v where v.id=requested.id and v.workspace_id=p_workspace and v.deleted_at is null))
  then raise exception 'Invalid recipient selection.' using errcode='42501'; end if;
  if selected_kind='schedule' then
    start_day:=(p_plan->>'startDate')::date; end_day:=(p_plan->>'endDate')::date;
    if start_day is null or end_day is null or end_day<start_day or end_day-start_day>366 then
      raise exception 'Choose a date range of up to one year.' using errcode='22023'; end if;
  end if;
  select display_name into workspace_name from public.workspaces where id=p_workspace;
  for person in select id,full_name,lower(nullif(btrim(email),'')) email,updated_at
    from public.volunteer_profiles where workspace_id=p_workspace and lifecycle='active' and deleted_at is null
      and (cardinality(ids)=0 or id=any(ids)) order by full_name,id limit 501 loop
    if jsonb_array_length(recipients)+jsonb_array_length(exclusions)>=500 then
      raise exception 'Choose at most 500 volunteers to preview.' using errcode='22023'; end if;
    reason:=null; entries:='[]'; previous_email:=null; prior_snapshot:=null; prior_sent_at:=null; changed_count:=null; removed_count:=null;
    select exists(select 1 from public.volunteer_profiles household
      where household.workspace_id=p_workspace and household.id<>person.id
        and household.lifecycle='active' and household.deleted_at is null and lower(btrim(household.email))=person.email)
      into shared_contact;
    select email into previous_email from public.volunteer_welcome_deliveries
      where workspace_id=p_workspace and volunteer_id=person.id and campaign='project-welcome.v1';
    select exists(select 1 from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id
      where r.workspace_id=p_workspace and r.volunteer_id=person.id and o.kind=selected_kind and r.state in ('ready','sending','unknown','failed')) into busy;
    if person.email is null or person.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then reason:='missing_email';

    elsif busy then reason:='pending_or_unknown_delivery';
    elsif selected_kind='welcome' and previous_email is not null and selected_mode<>'resend' then
      reason:=case when previous_email=person.email then 'already_welcomed' else 'email_changed_requires_resend_review' end;
    end if;
    if selected_kind='schedule' then
      select coalesce(jsonb_agg(jsonb_build_object('assignmentId',a.id,'itemId',i.id,
        'date',i.start_date,'endDate',i.end_date,'title',i.title_snapshot,'startTime',i.start_time,'endTime',i.end_time,
        'itemVersion',i.updated_at,'assignmentVersion',a.updated_at,'response',r.response_status,
        'delivered',d.delivery_state='sent') order by i.start_date,i.start_time,i.id),'[]') into entries
        from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id
        join public.assignment_responses r on r.assignment_id=a.id
        left join public.assignment_notification_deliveries d on d.calendar_assignment_id=a.id
          and d.notification_kind='initial_assignment' and d.template_version='initial-assignment.v1'
        where a.workspace_id=p_workspace and a.volunteer_profile_id=person.id and a.lifecycle='active'
          and i.lifecycle='active' and i.publication_state='published' and r.response_status<>'declined'
          and i.start_date between start_day and end_day
          and public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,i.timezone)>now();
      select r.snapshot, o.created_at into prior_snapshot, prior_sent_at from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id where r.workspace_id=p_workspace and r.volunteer_id=person.id and o.kind='schedule' and r.state='sent' order by o.created_at desc,r.id desc limit 1;
      if prior_snapshot is not null then
        select count(*) into changed_count from jsonb_array_elements(entries) current_entry where not exists (select 1 from jsonb_array_elements(coalesce(prior_snapshot->'assignments','[]'::jsonb)) previous_entry where previous_entry->>'assignmentId'=current_entry->>'assignmentId' and previous_entry->>'itemVersion'=current_entry->>'itemVersion' and previous_entry->>'assignmentVersion'=current_entry->>'assignmentVersion');
        select count(*) into removed_count from jsonb_array_elements(coalesce(prior_snapshot->'assignments','[]'::jsonb)) previous_entry where not exists (select 1 from jsonb_array_elements(entries) current_entry where current_entry->>'assignmentId'=previous_entry->>'assignmentId');
      end if;
      select count(*) into new_count from jsonb_array_elements(entries) e where coalesce((e->>'delivered')::boolean,false)=false;
      old_count:=jsonb_array_length(entries)-new_count;
      if jsonb_array_length(entries)=0 then reason:=coalesce(reason,'no_eligible_assignments');
      elsif selected_mode='new' and new_count=0 then reason:=coalesce(reason,'already_delivered'); end if;
      -- Legacy failed rows cannot prove non-delivery; require human resolution.
      if exists(select 1 from public.assignment_notification_deliveries d where d.volunteer_profile_id=person.id
        and d.calendar_assignment_id in (select (e->>'assignmentId')::uuid from jsonb_array_elements(entries) e)
        and d.delivery_state<>'sent' and not exists(select 1 from public.communication_recipients prior where prior.id=d.communication_recipient_id and prior.state='excluded')) then reason:=coalesce(reason,'existing_delivery_requires_review'); end if;
      select count(*) into excluded_count from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id
        join public.assignment_responses r on r.assignment_id=a.id
        where a.workspace_id=p_workspace and a.volunteer_profile_id=person.id and i.start_date between start_day and end_day
          and (a.lifecycle<>'active' or i.lifecycle<>'active' or i.publication_state<>'published' or r.response_status='declined'
            or public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,i.timezone)<=now());
    else new_count:=0; old_count:=0; excluded_count:=0; end if;
    recipient:=jsonb_build_object('volunteerId',person.id,'name',person.full_name,'email',person.email,
      'version',person.updated_at,'assignments',entries,'newAssignments',new_count,'previousAssignments',old_count,
      'excludedAssignments',excluded_count,'lastSentAt',prior_sent_at,'changedSinceLastSend',changed_count,'removedSinceLastSend',removed_count,'sharedContact',shared_contact,'emailChanged',previous_email is not null and previous_email<>person.email,
      'deliveryRevision',(select md5(coalesce(jsonb_agg(jsonb_build_array(r.id,r.state,r.attempt) order by r.id)::text,'[]'))
        from public.communication_recipients r where r.workspace_id=p_workspace and r.volunteer_id=person.id));
    if reason is null then recipients:=recipients||jsonb_build_array(recipient);
    else exclusions:=exclusions||jsonb_build_array(jsonb_build_object('volunteerId',person.id,'name',person.full_name,'reason',reason,'excludedAssignments',excluded_count)); end if;
  end loop;
  return jsonb_build_object('workspaceName',workspace_name,'kind',selected_kind,'mode',selected_mode,'recipients',recipients,'exclusions',exclusions,'plan',p_plan);
end $_$;

-- Existing boundary: confirm_all_volunteer_schedule_assignments
CREATE OR REPLACE FUNCTION public.confirm_all_volunteer_schedule_assignments(p_bearer_token text) RETURNS TABLE(confirmed_count integer, response_recorded_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  verified_token_id uuid;
  verified_workspace_id uuid;
  verified_volunteer_profile_id uuid;
  eligible_count integer;
  recorded_at timestamptz;
begin
  perform public.lock_live_volunteer_profile(t.workspace_id,t.volunteer_profile_id) from public.volunteer_schedule_access_tokens t where length(p_bearer_token)=43 and t.token_verifier_hash=extensions.digest(p_bearer_token,'sha256');
  if p_bearer_token is null
    or char_length(p_bearer_token) <> 43
    or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$'
  then
    raise exception 'Volunteer schedule confirmation is unavailable.' using errcode = '42501';
  end if;

  select token.id, token.workspace_id, token.volunteer_profile_id
  into verified_token_id, verified_workspace_id, verified_volunteer_profile_id
  from public.volunteer_schedule_access_tokens as token
  join public.workspaces as workspace
    on workspace.id = token.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = token.volunteer_profile_id
    and volunteer.workspace_id = token.workspace_id
  where token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'volunteer_schedule_access'
    and token.token_version = 1
    and token.revoked_at is null
    and token.expires_at > now()
    and workspace.lifecycle = 'active'
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
  limit 1;

  if verified_token_id is null then
    raise exception 'Volunteer schedule confirmation is unavailable.' using errcode = '42501';
  end if;

  select count(*)::integer
  into eligible_count
  from public.calendar_assignments as assignment
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  where assignment.workspace_id = verified_workspace_id
    and assignment.volunteer_profile_id = verified_volunteer_profile_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and response.response_status = 'needs_response'
    and public.calendar_assignment_response_start_at(
      item.schedule_kind,
      item.start_date,
      item.start_time,
      item.timezone
    ) > now();

  if eligible_count > 100 then
    raise exception 'Volunteer schedule confirmation is unavailable.' using errcode = '42501';
  end if;

  recorded_at := now();

  update public.assignment_responses as response
  set response_status = 'confirmed',
      response_source = 'volunteer_schedule',
      response_note = null,
      responded_at = recorded_at,
      updated_by_auth_user_id = null
  where response.assignment_id in (
    select assignment.id
    from public.calendar_assignments as assignment
    join public.calendar_items as item
      on item.id = assignment.calendar_item_id
      and item.workspace_id = assignment.workspace_id
    where assignment.workspace_id = verified_workspace_id
      and assignment.volunteer_profile_id = verified_volunteer_profile_id
      and assignment.lifecycle = 'active'
      and item.lifecycle = 'active'
      and item.publication_state = 'published'
      and public.calendar_assignment_response_start_at(
        item.schedule_kind,
        item.start_date,
        item.start_time,
        item.timezone
      ) > now()
  )
    and response.workspace_id = verified_workspace_id
    and response.response_status = 'needs_response';

  update public.volunteer_schedule_access_tokens as token
  set last_used_at = recorded_at
  where token.id = verified_token_id
    and token.revoked_at is null
    and token.expires_at > recorded_at;

  if not found then
    raise exception 'Volunteer schedule confirmation is unavailable.' using errcode = '42501';
  end if;

  return query
  select eligible_count, recorded_at;
end;
$_$;

-- Existing boundary: convert_questionnaire_submission_to_volunteer_profile
CREATE OR REPLACE FUNCTION public.convert_questionnaire_submission_to_volunteer_profile(p_submission_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare caller_user_id uuid; source_submission public.questionnaire_submissions%rowtype; created_profile_id uuid; days text[];
begin
  caller_user_id := auth.uid(); if caller_user_id is null then raise exception 'Volunteer profile conversion is unavailable.' using errcode='42501'; end if;
  select submission.* into source_submission from public.questionnaire_submissions submission where submission.id=p_submission_id and submission.status='submitted' and submission.personal_data_redacted_at is null and submission.questionnaire_version=1 and exists (select 1 from public.workspace_contact_grants grant_row join public.project_contacts contact on contact.id=grant_row.project_contact_id where grant_row.workspace_id=submission.workspace_id and contact.auth_user_id=caller_user_id and contact.status='active' and grant_row.status='active' and grant_row.revoked_at is null and grant_row.valid_from<=now() and (grant_row.valid_until is null or grant_row.valid_until>now()) and grant_row.capabilities @> array['questionnaires.review','volunteers.edit']::text[]);
  if not found then raise exception 'Volunteer profile conversion is unavailable.' using errcode='42501'; end if;
  if exists(select 1 from public.volunteer_profiles where source_submission_id=source_submission.id) then raise exception 'Questionnaire submission already has a volunteer profile.' using errcode='23505'; end if;
  select coalesce(array_agg(day), '{}'::text[]) into days from (select distinct value #>> '{}' as day from jsonb_array_elements(coalesce(source_submission.answers#>'{availability,weekdays}','[]'::jsonb)) value where value #>> '{}' in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')) safe_days;
  perform 1 from public.workspaces where id=source_submission.workspace_id for update; insert into public.volunteer_profiles(workspace_id,source_submission_id,lifecycle,readiness_status,full_name,email,phone,congregation,preferred_contact_method,availability_snapshot,skills_help_snapshot,profile_notes,date_of_birth,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,housing_option,after_hours_security_availability,builder_assistant_communication,available_work_days,available_two_plus_days,skills_experience,other_support) values(source_submission.workspace_id,source_submission.id,'active','ready',btrim(source_submission.answers#>>'{aboutYou,name}'),nullif(btrim(source_submission.answers#>>'{aboutYou,email}'),''),nullif(btrim(source_submission.answers#>>'{aboutYou,phone}'),''),nullif(btrim(source_submission.answers#>>'{aboutYou,congregation}'),''),nullif(btrim(source_submission.answers#>>'{aboutYou,preferredContactMethod}'),''),coalesce(source_submission.answers->'availability','{}'),jsonb_build_object('skillsExperience',source_submission.answers->'skillsExperience','otherWaysToHelp',source_submission.answers->'otherWaysToHelp'),'',nullif(source_submission.answers#>>'{aboutYou,dateOfBirth}','')::date,nullif(btrim(source_submission.answers#>>'{emergencyContact,name}'),''),nullif(btrim(source_submission.answers#>>'{emergencyContact,phone}'),''),nullif(btrim(source_submission.answers#>>'{emergencyContact,relationship}'),''),case when source_submission.answers#>>'{otherWaysToHelp,housingOption}' in ('yes','no','unknown') then source_submission.answers#>>'{otherWaysToHelp,housingOption}' else 'unknown' end,case when source_submission.answers#>>'{availability,afterHoursSecurityAvailability}' in ('yes','no','unknown') then source_submission.answers#>>'{availability,afterHoursSecurityAvailability}' else 'unknown' end,case when source_submission.answers#>>'{aboutYou,builderAssistantCommunication}' in ('yes','no','unknown') then source_submission.answers#>>'{aboutYou,builderAssistantCommunication}' else 'unknown' end,days,case when source_submission.answers#>>'{availability,availableTwoPlusDays}' in ('yes','no','unknown') then source_submission.answers#>>'{availability,availableTwoPlusDays}' else 'unknown' end,nullif(btrim(concat_ws(E'\n',source_submission.answers#>>'{skillsExperience,details}',source_submission.answers#>>'{skillsExperience,physicalWorkNotes}')),''),nullif(btrim(concat_ws(E'\n',source_submission.answers#>>'{otherWaysToHelp,other}',source_submission.answers#>>'{otherWaysToHelp,notes}')),'')) returning id into created_profile_id;
  return created_profile_id;
exception when check_violation or invalid_text_representation then raise exception 'Volunteer profile conversion is unavailable.' using errcode='22023'; end;
$$;

-- Existing boundary: create_calendar_assignment
CREATE OR REPLACE FUNCTION public.create_calendar_assignment(p_calendar_item_id uuid, p_volunteer_profile_id uuid, p_assignment_note text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  target_workspace_id uuid;
  created_assignment_id uuid;
begin
  caller_user_id := auth.uid();

  select item.workspace_id
  into target_workspace_id
  from public.calendar_items as item
  join public.volunteer_profiles as volunteer
    on volunteer.id = p_volunteer_profile_id
    and volunteer.workspace_id = item.workspace_id
  join public.workspaces as workspace
    on workspace.id = item.workspace_id
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.schedule_kind in ('timed', 'date_based')
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
    and workspace.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = item.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
        and (
          item.publication_state = 'published'
          or item.created_by_project_contact_id = contact.id
        )
    );

  if caller_user_id is null
    or target_workspace_id is null
    or (
      p_assignment_note is not null
      and char_length(btrim(p_assignment_note)) not between 1 and 2000
    )
  then
    raise exception 'Assignment creation is unavailable.' using errcode = '42501';
  end if;

  insert into public.calendar_assignments (
    workspace_id,
    calendar_item_id,
    volunteer_profile_id,
    lifecycle,
    assignment_note,
    created_by_auth_user_id
  )
  values (
    target_workspace_id,
    p_calendar_item_id,
    p_volunteer_profile_id,
    'active',
    nullif(btrim(p_assignment_note), ''),
    caller_user_id
  )
  returning id into created_assignment_id;

  insert into public.assignment_responses (
    workspace_id,
    assignment_id,
    response_status,
    response_source,
    response_note,
    responded_at,
    updated_by_auth_user_id
  )
  values (
    target_workspace_id,
    created_assignment_id,
    'needs_response',
    'project_contact',
    null,
    null,
    caller_user_id
  );

  return created_assignment_id;
exception
  when unique_violation then
    raise exception 'Volunteer already has an active assignment for this Calendar item.' using errcode = '23505';
end;
$$;

-- Existing boundary: create_calendar_assignments_batch
CREATE OR REPLACE FUNCTION public.create_calendar_assignments_batch(p_calendar_item_id uuid, p_volunteer_profile_ids uuid[], p_assignment_note text) RETURNS uuid[]
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  target_workspace_id uuid;
  selected_count integer;
  distinct_count integer;
  ready_volunteer_count integer;
  existing_assignment_count integer;
  created_assignment_ids uuid[];
begin
  caller_user_id := auth.uid();

  selected_count := coalesce(cardinality(p_volunteer_profile_ids), 0);

  select count(distinct volunteer_id)
  into distinct_count
  from unnest(coalesce(p_volunteer_profile_ids, array[]::uuid[])) as selected(volunteer_id);

  select item.workspace_id
  into target_workspace_id
  from public.calendar_items as item
  join public.workspaces as workspace
    on workspace.id = item.workspace_id
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.schedule_kind in ('timed', 'date_based')
    and workspace.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = item.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
        and (
          item.publication_state = 'published'
          or item.created_by_project_contact_id = contact.id
        )
    );

  if caller_user_id is null
    or target_workspace_id is null
    or selected_count < 1
    or selected_count > 25
    or distinct_count <> selected_count
    or exists (
      select 1
      from unnest(coalesce(p_volunteer_profile_ids, array[]::uuid[])) as selected(volunteer_id)
      where selected.volunteer_id is null
    )
    or (
      p_assignment_note is not null
      and char_length(btrim(p_assignment_note)) not between 1 and 2000
    )
  then
    raise exception 'Assignment creation is unavailable.' using errcode = '42501';
  end if;

  select count(*)
  into ready_volunteer_count
  from public.volunteer_profiles as volunteer
  where volunteer.workspace_id = target_workspace_id
    and volunteer.id = any(p_volunteer_profile_ids)
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready';

  if ready_volunteer_count <> selected_count then
    raise exception 'Assignment creation is unavailable.' using errcode = '42501';
  end if;

  select count(*)
  into existing_assignment_count
  from public.calendar_assignments as assignment
  where assignment.workspace_id = target_workspace_id
    and assignment.calendar_item_id = p_calendar_item_id
    and assignment.volunteer_profile_id = any(p_volunteer_profile_ids)
    and assignment.lifecycle = 'active';

  if existing_assignment_count > 0 then
    raise exception 'Volunteer already has an active assignment for this Calendar item.' using errcode = '23505';
  end if;

  with selected as (
    select volunteer_id, ordinality
    from unnest(p_volunteer_profile_ids) with ordinality as selected(volunteer_id, ordinality)
  ),
  inserted as (
    insert into public.calendar_assignments (
      workspace_id,
      calendar_item_id,
      volunteer_profile_id,
      lifecycle,
      assignment_note,
      created_by_auth_user_id
    )
    select
      target_workspace_id,
      p_calendar_item_id,
      selected.volunteer_id,
      'active',
      nullif(btrim(p_assignment_note), ''),
      caller_user_id
    from selected
    returning id, volunteer_profile_id
  )
  select array_agg(inserted.id order by selected.ordinality)
  into created_assignment_ids
  from inserted
  join selected
    on selected.volunteer_id = inserted.volunteer_profile_id;

  insert into public.assignment_responses (
    workspace_id,
    assignment_id,
    response_status,
    response_source,
    response_note,
    responded_at,
    updated_by_auth_user_id
  )
  select
    target_workspace_id,
    assignment_id,
    'needs_response',
    'project_contact',
    null,
    null,
    caller_user_id
  from unnest(created_assignment_ids) as created(assignment_id);

  return coalesce(created_assignment_ids, array[]::uuid[]);
exception
  when unique_violation then
    raise exception 'Volunteer already has an active assignment for this Calendar item.' using errcode = '23505';
end;
$$;

-- Existing boundary: delete_history_free_volunteer_profile
CREATE OR REPLACE FUNCTION public.delete_history_free_volunteer_profile(p_profile_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
begin
  raise exception 'Use the reviewed volunteer deletion workflow.' using errcode='42501';
end $$;

-- Existing boundary: finalize_communication_recipient
CREATE OR REPLACE FUNCTION public.finalize_communication_recipient(p_recipient_id uuid, p_claim_id uuid, p_outcome text, p_provider_id text, p_failure_code text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare row public.communication_recipients%rowtype; actor uuid; operation_kind text;
begin
  if exists(select 1 from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id where r.id=p_recipient_id and o.kind='reminder') then raise exception 'System-owned reminder.' using errcode='42501';end if;
  select * into row from public.communication_recipients where id=p_recipient_id;
  actor:=public.communication_actor(row.workspace_id);
  perform 1 from public.workspaces where id=row.workspace_id for update;
  select * into row from public.communication_recipients where id=p_recipient_id for update;
  if row.claimed_by<>actor or row.claim_id is distinct from p_claim_id then raise exception 'Claim unavailable.' using errcode='42501'; end if;
  if row.state<>'sending' then return row.state; end if;
  if p_outcome not in ('sent','failed','unknown') or p_outcome is null
    or (p_outcome='sent' and (p_provider_id is null or p_provider_id !~ '^[A-Za-z0-9._:-]{1,200}$' or p_failure_code is not null))
    or (p_outcome='failed' and (p_failure_code is null or p_failure_code not in ('provider_rejected','schedule_access_unavailable')))
    or (p_outcome='unknown' and p_failure_code is distinct from 'provider_outcome_unknown')
  then raise exception 'Invalid delivery outcome.' using errcode='22023'; end if;
  update public.communication_recipients set state=p_outcome,provider_message_id=case when p_outcome='sent' then p_provider_id end,
    failure_code=p_failure_code,finalized_at=now() where id=row.id;
  if p_outcome='sent' then
    update public.assignment_notification_deliveries set delivery_state='sent',provider_message_id=p_provider_id,
      sent_at=now(),failed_at=null,safe_failure_code=null,sending_expires_at=null
      where communication_recipient_id=row.id and delivery_state='sending';
    select kind into operation_kind from public.communication_operations where id=row.operation_id;
    if operation_kind='welcome' then
      insert into public.volunteer_welcome_deliveries(workspace_id,volunteer_id,campaign,recipient_id,email,recipient_redacted_at)
        values(row.workspace_id,row.volunteer_id,'project-welcome.v1',row.id,row.email,row.recipient_redacted_at)
        on conflict(workspace_id,volunteer_id,campaign) do update set recipient_id=excluded.recipient_id,email=excluded.email,recipient_redacted_at=excluded.recipient_redacted_at,sent_at=now();
    end if;
  end if;
  return p_outcome;
end $_$;

-- Existing boundary: import_volunteer_profiles
CREATE OR REPLACE FUNCTION public.import_volunteer_profiles(p_workspace_id uuid, p_request_id uuid, p_rows jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  actor uuid; previous public.volunteer_csv_import_operations%rowtype; payload_hash text;
  entry jsonb; patch jsonb; current_profile public.volunteer_profiles%rowtype; merged jsonb;
  new_count integer:=0; update_count integer:=0; profile_id uuid; touched uuid[]:='{}';
  result jsonb; key text; candidate_email text; candidate_phone text;
begin
  select c.id into actor from public.project_contacts c join public.workspace_contact_grants g on g.project_contact_id=c.id
    join public.workspaces w on w.id=g.workspace_id where c.auth_user_id=auth.uid() and c.status='active'
      and w.id=p_workspace_id and w.lifecycle='active' and g.status='active' and g.revoked_at is null
      and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
      and g.capabilities @> array['workspace.read','volunteers.view','volunteers.edit']::text[];
  if actor is null then raise exception 'Import unavailable.' using errcode='42501'; end if;
  if p_request_id is null or jsonb_typeof(p_rows) is distinct from 'array'
    or jsonb_array_length(p_rows) not between 1 and 500 or octet_length(p_rows::text)>1048576 then
    raise exception 'Invalid import.' using errcode='22023'; end if;
  perform 1 from public.workspaces where id=p_workspace_id for update;
  payload_hash:=encode(extensions.digest(p_rows::text,'sha256'),'hex');
  select * into previous from public.volunteer_csv_import_operations where workspace_id=p_workspace_id and request_id=p_request_id;
  if found then
    if previous.actor_id<>actor or previous.payload_hash<>payload_hash then raise exception 'Import request already used.' using errcode='22023'; end if;
    return previous.result;
  end if;
  -- Lock reviewed existing profiles in stable order before applying any patch.
  perform 1 from public.volunteer_profiles v where v.workspace_id=p_workspace_id
    and v.id in(select (e->>'profileId')::uuid from jsonb_array_elements(p_rows) e)
    order by v.id for update;
  for entry in select value from jsonb_array_elements(p_rows) loop
    patch:=entry->'patch';
    if jsonb_typeof(entry)<>'object' or (entry-array['profileId','expectedUpdatedAt','patch','previouslyDeletedId'])<>'{}'
      or jsonb_typeof(patch) is distinct from 'object'
      or (patch-array['fullName','email','phone','congregation','preferredContactMethod','lifecycle','readinessStatus','profileNotes',
        'dateOfBirth','emergencyContactName','emergencyContactPhone','emergencyContactRelationship','housingOption',
        'afterHoursSecurityAvailability','builderAssistantCommunication','availableWorkDays','availableTwoPlusDays','skillsExperience','otherSupport'])<>'{}'
    then raise exception 'Invalid import fields.' using errcode='22023'; end if;
    for key in select jsonb_object_keys(patch) loop
      if patch->key='null'::jsonb or (jsonb_typeof(patch->key)='string' and btrim(patch->>key)='')
        or octet_length((patch->key)::text)>16002 then
        raise exception 'Blank CSV fields cannot erase profile information.' using errcode='22023'; end if;
    end loop;
    profile_id:=(entry->>'profileId')::uuid;
    if entry->>'previouslyDeletedId' is not null and (profile_id is not null or not exists(
      select 1 from public.volunteer_profiles v where v.id=(entry->>'previouslyDeletedId')::uuid
      and v.workspace_id=p_workspace_id and v.deleted_at is not null)) then
      raise exception 'Previously deleted identity is unavailable. Review the import again.' using errcode='40001';
    end if;
    if profile_id is null then
      if entry->>'expectedUpdatedAt' is not null then raise exception 'Invalid new row.' using errcode='22023'; end if;
      merged:=patch;
    else
      if profile_id=any(touched) then raise exception 'Duplicate profile in import.' using errcode='22023'; end if;
      select * into current_profile from public.volunteer_profiles where id=profile_id and workspace_id=p_workspace_id and deleted_at is null;
      if not found then raise exception 'Profile unavailable.' using errcode='42501'; end if;
      if entry->>'expectedUpdatedAt' is null or current_profile.updated_at<>(entry->>'expectedUpdatedAt')::timestamptz then
        raise exception 'This profile changed. Review the latest version.' using errcode='40001'; end if;
      merged:=jsonb_build_object('fullName',current_profile.full_name,'email',current_profile.email,'phone',current_profile.phone,
        'congregation',current_profile.congregation,'preferredContactMethod',current_profile.preferred_contact_method,
        'lifecycle',current_profile.lifecycle,'readinessStatus',current_profile.readiness_status,'profileNotes',current_profile.profile_notes,
        'dateOfBirth',current_profile.date_of_birth,'emergencyContactName',current_profile.emergency_contact_name,
        'emergencyContactPhone',current_profile.emergency_contact_phone,'emergencyContactRelationship',current_profile.emergency_contact_relationship,
        'housingOption',current_profile.housing_option,'afterHoursSecurityAvailability',current_profile.after_hours_security_availability,
        'builderAssistantCommunication',current_profile.builder_assistant_communication,'availableWorkDays',current_profile.available_work_days,
        'availableTwoPlusDays',current_profile.available_two_plus_days,'skillsExperience',current_profile.skills_experience,'otherSupport',current_profile.other_support)
        || patch || jsonb_build_object('expectedUpdatedAt',current_profile.updated_at);
    end if;
    candidate_email:=lower(nullif(btrim(merged->>'email'),''));
    candidate_phone:=nullif(regexp_replace(coalesce(merged->>'phone',''),'[^0-9]','','g'),'');
    if candidate_email is not null and candidate_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Invalid email.' using errcode='22023'; end if;
    -- Only an internal profile ID authorizes an update. Contact methods may be shared.
    -- A new row with an existing name still requires individual review.
    if profile_id is null and exists(select 1 from public.volunteer_profiles v
      where v.workspace_id=p_workspace_id and v.deleted_at is null
        and lower(btrim(regexp_replace(v.full_name,'[[:space:]]+',' ','g')))=lower(btrim(regexp_replace(merged->>'fullName','[[:space:]]+',' ','g')))) then
      raise exception 'Matching volunteer changed. Review the import again.' using errcode='40001'; end if;
    if profile_id is null then
      profile_id:=public.create_manual_volunteer_profile(p_workspace_id,merged);
      new_count:=new_count+1;
    else
      perform public.update_volunteer_profile_manual_fields(profile_id,merged);
      update_count:=update_count+1;
    end if;
    touched:=array_append(touched,profile_id);
  end loop;
  result:=jsonb_build_object('created',new_count,'updated',update_count,'profileIds',touched);
  insert into public.volunteer_csv_import_operations(workspace_id,request_id,actor_id,payload_hash,result)
    values(p_workspace_id,p_request_id,actor,payload_hash,result);
  return result;
end $_$;

-- Existing boundary: issue_assignment_response_token
CREATE OR REPLACE FUNCTION public.issue_assignment_response_token(p_assignment_id uuid, p_ttl_hours integer, p_internal_note text) RETURNS TABLE(token_id uuid, bearer_token text, token_expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  target_workspace_id uuid;
  target_volunteer_profile_id uuid;
  issued_token_id uuid;
  issued_bearer_token text;
  issued_expires_at timestamptz;
begin
  caller_user_id := auth.uid();

  select assignment.workspace_id, assignment.volunteer_profile_id
  into target_workspace_id, target_volunteer_profile_id
  from public.calendar_assignments as assignment
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = assignment.volunteer_profile_id
    and volunteer.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = assignment.workspace_id
  where assignment.id = p_assignment_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
    and workspace.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = assignment.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    );

  if caller_user_id is null
    or target_workspace_id is null
    or p_ttl_hours not between 1 and 720
    or (
      p_internal_note is not null
      and char_length(btrim(p_internal_note)) not between 1 and 500
    )
  then
    raise exception 'Assignment response token issuance is unavailable.' using errcode = '42501';
  end if;

  issued_bearer_token := rtrim(
    translate(
      encode(extensions.gen_random_bytes(32), 'base64'),
      '+/',
      '-_'
    ),
    '='
  );
  issued_expires_at := now() + make_interval(hours => p_ttl_hours);

  insert into public.assignment_response_tokens (
    workspace_id,
    assignment_id,
    volunteer_profile_id,
    token_verifier_hash,
    purpose,
    expires_at,
    internal_note,
    created_by_auth_user_id
  )
  values (
    target_workspace_id,
    p_assignment_id,
    target_volunteer_profile_id,
    extensions.digest(issued_bearer_token, 'sha256'),
    'assignment_response',
    issued_expires_at,
    nullif(btrim(p_internal_note), ''),
    caller_user_id
  )
  returning id into issued_token_id;

  return query
  select issued_token_id, issued_bearer_token, issued_expires_at;
end;
$$;

-- Existing boundary: issue_volunteer_schedule_access
CREATE OR REPLACE FUNCTION public.issue_volunteer_schedule_access(p_volunteer_profile_id uuid, p_ttl_hours integer) RETURNS TABLE(token_id uuid, bearer_token text, token_expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  caller_project_contact_id uuid;
  target_workspace_id uuid;
  ttl_hours integer;
  issued_token_id uuid;
  issued_bearer_token text;
  issued_expires_at timestamptz;
begin
  caller_user_id := auth.uid();
  ttl_hours := coalesce(p_ttl_hours, 720);

  select volunteer.workspace_id, contact.id
  into target_workspace_id, caller_project_contact_id
  from public.volunteer_profiles as volunteer
  join public.workspaces as workspace
    on workspace.id = volunteer.workspace_id
  join public.workspace_contact_grants as grant_row
    on grant_row.workspace_id = volunteer.workspace_id
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  where volunteer.id = p_volunteer_profile_id
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
    and workspace.lifecycle = 'active'
    and contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['assignments.edit']::text[]
  limit 1;

  if caller_user_id is null
    or target_workspace_id is null
    or caller_project_contact_id is null
    or ttl_hours not between 1 and 2160
  then
    raise exception 'Volunteer schedule access issuance is unavailable.' using errcode = '42501';
  end if;

  issued_bearer_token := rtrim(
    translate(
      encode(extensions.gen_random_bytes(32), 'base64'),
      '+/',
      '-_'
    ),
    '='
  );
  issued_expires_at := now() + make_interval(hours => ttl_hours);

  insert into public.volunteer_schedule_access_tokens (
    workspace_id,
    volunteer_profile_id,
    token_verifier_hash,
    purpose,
    token_version,
    expires_at,
    issued_by_project_contact_id
  )
  values (
    target_workspace_id,
    p_volunteer_profile_id,
    extensions.digest(issued_bearer_token, 'sha256'),
    'volunteer_schedule_access',
    1,
    issued_expires_at,
    caller_project_contact_id
  )
  returning id into issued_token_id;

  return query
  select issued_token_id, issued_bearer_token, issued_expires_at;
end;
$$;

-- Existing boundary: manage_volunteer_away
CREATE OR REPLACE FUNCTION public.manage_volunteer_away(p_token text, p_command text, p_id uuid, p_start date, p_end date, p_expected_preview text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare identity record; conflicts jsonb; fingerprint text; previous public.volunteer_away_periods%rowtype; project_today date;
begin
  perform public.lock_live_volunteer_profile(t.workspace_id,t.volunteer_profile_id) from public.volunteer_schedule_access_tokens t where length(p_token)=43 and t.token_verifier_hash=extensions.digest(p_token,'sha256');
  select * into identity from public.volunteer_home_identity(p_token);
  if not found then raise exception 'Schedule unavailable.' using errcode='42501'; end if;
  -- Use the bulk-scheduling lock order; never mutate assignments or responses.
  select (now() at time zone w.timezone)::date into project_today from public.workspaces w where w.id=identity.workspace_id for update;
  perform 1 from public.volunteer_profiles where id=identity.volunteer_id for update;
  if p_command='remove' then
    delete from public.volunteer_away_periods where id=p_id and volunteer_profile_id=identity.volunteer_id and workspace_id=identity.workspace_id;
    return jsonb_build_object('kind','removed');
  end if;
  if p_command is null or p_command not in ('preview','save') or p_start is null or p_end is null
    or p_end<p_start or p_end-p_start>366 or p_start<project_today or p_end>project_today+730 or p_id is null then
    raise exception 'Invalid away period.' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'date',i.start_date,'title',i.title_snapshot,'response',r.response_status)
    order by i.start_date,a.id),'[]') into conflicts
    from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=a.workspace_id
    left join public.assignment_responses r on r.assignment_id=a.id
    where a.workspace_id=identity.workspace_id and a.volunteer_profile_id=identity.volunteer_id and a.lifecycle='active'
      and i.lifecycle='active' and i.publication_state='published' and coalesce(r.response_status,'needs_response')<>'declined'
      and i.start_date<=p_end and coalesce(i.end_date,i.start_date)>=p_start;
  fingerprint:=md5(jsonb_build_object('start',p_start,'end',p_end,'conflicts',conflicts)::text);
  if p_command='preview' then return jsonb_build_object('kind','preview','conflicts',conflicts,'fingerprint',fingerprint); end if;
  if p_expected_preview is distinct from fingerprint then raise exception 'Assignments changed. Review this away period again.' using errcode='40001'; end if;
  select * into previous from public.volunteer_away_periods where id=p_id;
  if found then
    if previous.workspace_id<>identity.workspace_id or previous.volunteer_profile_id<>identity.volunteer_id or previous.starts_on<>p_start or previous.ends_on<>p_end
    then raise exception 'Away request unavailable.' using errcode='42501'; end if;
    return jsonb_build_object('kind','saved');
  end if;
  if (select count(*) from public.volunteer_away_periods where volunteer_profile_id=identity.volunteer_id)>=50
    or exists(select 1 from public.volunteer_away_periods where volunteer_profile_id=identity.volunteer_id and starts_on<=p_end and ends_on>=p_start)
  then raise exception 'Review existing away periods.' using errcode='22023'; end if;
  insert into public.volunteer_away_periods(id,workspace_id,volunteer_profile_id,starts_on,ends_on) values(p_id,identity.workspace_id,identity.volunteer_id,p_start,p_end);
  return jsonb_build_object('kind','saved');
end $$;

-- Existing boundary: plan_calendar_assignments
CREATE OR REPLACE FUNCTION public.plan_calendar_assignments(p_workspace_id uuid, p_request_id uuid, p_plan jsonb, p_expected_preview text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor uuid;
  item_ids uuid[];
  volunteer_ids uuid[];
  selected_ids uuid[];
  created_ids uuid[] := '{}';
  assignment_ids uuid[] := '{}';
  current_item public.calendar_items%rowtype;
  preset public.task_presets%rowtype;
  creation jsonb;
  days date[];
  weekdays smallint[];
  day date;
  preview jsonb;
  items_preview jsonb := '[]';
  volunteers_preview jsonb;
  existing_preview jsonb;
  conflicts_preview jsonb;
  fingerprint text;
  old_operation public.calendar_bulk_assignment_operations%rowtype;
begin
  if auth.uid() is null or p_request_id is null or p_workspace_id is null
    or jsonb_typeof(p_plan) is distinct from 'object'
    or octet_length(p_plan::text) > 100000
    or (p_plan - array['itemIds','volunteers','create','note']) <> '{}'
    or jsonb_typeof(p_plan->'volunteers') is distinct from 'array'
    or jsonb_array_length(p_plan->'volunteers') not between 1 and 25
    or char_length(coalesce(p_plan->>'note','')) > 2000
  then raise exception 'Invalid assignment operation.' using errcode='22023'; end if;

  select c.id into actor from public.project_contacts c
  join public.workspace_contact_grants g on g.project_contact_id=c.id
  join public.workspaces w on w.id=g.workspace_id
  where c.auth_user_id=auth.uid() and c.status='active' and w.lifecycle='active'
    and g.workspace_id=p_workspace_id and g.status='active' and g.revoked_at is null
    and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
    and g.capabilities @> array['workspace.read','calendar.view','assignments.view','assignments.edit','volunteers.view']::text[];
  if actor is null then raise exception 'Assignment operation unavailable.' using errcode='42501'; end if;

  -- Serializes operation replay and bulk mutations. Individual item row locks
  -- below also serialize with ordinary edits, publication and archiving.
  perform 1 from public.workspaces where id=p_workspace_id for update;
  select * into old_operation from public.calendar_bulk_assignment_operations
    where workspace_id=p_workspace_id and request_id=p_request_id;
  if found then
    if old_operation.actor_id<>actor or old_operation.plan<>p_plan then
      raise exception 'Request already used.' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_array_elements(p_plan->'volunteers') selected
      join public.volunteer_profiles v on v.id=(selected->>'id')::uuid and v.workspace_id=p_workspace_id where v.deleted_at is not null) then
      raise exception 'Volunteer selection unavailable.' using errcode='42501';end if;
    return old_operation.result;
  end if;

  if exists(select 1 from jsonb_array_elements(p_plan->'volunteers') v
    where jsonb_typeof(v) <> 'object' or (v-array['id','excludeDates'])<>'{}'
      or jsonb_typeof(v->'excludeDates') is distinct from 'array'
      or jsonb_array_length(v->'excludeDates')>100) then
    raise exception 'Invalid volunteer selection.' using errcode='22023';
  end if;
  select array_agg((v->>'id')::uuid order by v->>'id') into volunteer_ids
    from jsonb_array_elements(p_plan->'volunteers') v;
  if cardinality(volunteer_ids) <> (select count(distinct id) from unnest(volunteer_ids) id)
    or array_position(volunteer_ids,null) is not null then
    raise exception 'Invalid volunteer selection.' using errcode='22023';
  end if;
  perform 1 from public.volunteer_profiles where id=any(volunteer_ids)
    and workspace_id=p_workspace_id order by id for update;
  select jsonb_agg(jsonb_build_object('id',id,'name',full_name,'version',updated_at) order by id)
    into volunteers_preview from public.volunteer_profiles
    where id=any(volunteer_ids) and workspace_id=p_workspace_id
      and lifecycle='active' and readiness_status='ready' and deleted_at is null;
  if coalesce(jsonb_array_length(volunteers_preview),0)<>cardinality(volunteer_ids) then
    raise exception 'Volunteer selection unavailable.' using errcode='42501';
  end if;

  creation:=p_plan->'create';
  if creation is not null and creation <> 'null'::jsonb then
    if jsonb_typeof(creation)<>'object' or coalesce(p_plan->'itemIds','[]')<>'[]'
      or (creation-array['presetId','title','taskType','startDate','endDate','endDayOffset','weekdays','startTime','endTime','neededCount','notes','customValues','meal'])<>'{}'
      or not exists(select 1 from public.workspace_contact_grants g where g.project_contact_id=actor
        and g.workspace_id=p_workspace_id and g.status='active' and g.revoked_at is null
        and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
        and g.capabilities @> array['workspace.read','calendar.edit']::text[])
    then raise exception 'Creation unavailable.' using errcode='42501'; end if;
    if (creation->>'startDate')::date is null or (creation->>'endDate')::date is null
      or (creation->>'endDate')::date < (creation->>'startDate')::date
      or (creation->>'endDate')::date - (creation->>'startDate')::date > 366
      or (creation->>'startTime')::time is null or (creation->>'endTime')::time is null
      or coalesce((creation->>'endDayOffset')::integer,0) not between 0 and 7
      or (coalesce((creation->>'endDayOffset')::integer,0)=0 and (creation->>'endTime')::time <= (creation->>'startTime')::time)
      or (creation->>'neededCount')::integer is null
      or (creation->>'neededCount')::integer not between 0 and 99
      or jsonb_typeof(creation->'weekdays') is distinct from 'array'
    then raise exception 'Invalid dates or times.' using errcode='22023'; end if;
    select array_agg(value::smallint order by value::smallint) into weekdays
      from jsonb_array_elements_text(creation->'weekdays');
    if coalesce(cardinality(weekdays),0) not between 1 and 7
      or exists(select 1 from unnest(weekdays) d where d not between 0 and 6)
      or cardinality(weekdays)<>(select count(distinct d) from unnest(weekdays) d)
    then raise exception 'Invalid weekdays.' using errcode='22023'; end if;
    select array_agg(d::date order by d) into days
      from generate_series((creation->>'startDate')::date,(creation->>'endDate')::date,interval '1 day') d
      where extract(dow from d)::smallint=any(weekdays);
    if coalesce(cardinality(days),0) not between 1 and 100 then
      raise exception 'Choose between 1 and 100 dates.' using errcode='22023'; end if;
    if creation->>'presetId' is not null then
      select * into preset from public.task_presets where id=(creation->>'presetId')::uuid
        and workspace_id=p_workspace_id and lifecycle='active' for share;
      if not found then raise exception 'Task unavailable.' using errcode='42501'; end if;
    end if;
    foreach day in array days loop
      items_preview:=items_preview || jsonb_build_array(jsonb_build_object(
        'id',null,'date',day,'title',coalesce(preset.name,creation->>'title'),
        'endDate',case when coalesce((creation->>'endDayOffset')::integer,0)=0 then null else day+((creation->>'endDayOffset')::integer) end,'startTime',creation->>'startTime','endTime',creation->>'endTime',
        'neededCount',(creation->>'neededCount')::integer,'assignedCount',0,
        'publication',case when creation->'meal'->>'kind' is null then 'draft' else 'published' end,
        'presetVersion',preset.updated_at));
    end loop;
    item_ids:='{}';
  else
    if jsonb_typeof(p_plan->'itemIds') is distinct from 'array'
      or jsonb_array_length(p_plan->'itemIds') not between 1 and 100 then
      raise exception 'Choose between 1 and 100 items.' using errcode='22023'; end if;
    select array_agg(value::uuid order by value::uuid) into item_ids
      from jsonb_array_elements_text(p_plan->'itemIds');
    if cardinality(item_ids)<>(select count(distinct id) from unnest(item_ids) id)
      or array_position(item_ids,null) is not null then
      raise exception 'Duplicate item selection.' using errcode='22023'; end if;
    for current_item in select * from public.calendar_items where id=any(item_ids)
      and workspace_id=p_workspace_id and lifecycle='active'
      and schedule_kind in ('timed','date_based')
      and (publication_state='published' or created_by_project_contact_id=actor)
      order by id for update loop
      items_preview:=items_preview || jsonb_build_array(jsonb_build_object(
        'id',current_item.id,'date',current_item.start_date,'title',current_item.title_snapshot,
        'endDate',current_item.end_date,'startTime',current_item.start_time,'endTime',current_item.end_time,
        'neededCount',current_item.needed_count,'publication',current_item.publication_state,
        'version',current_item.updated_at,'assignedCount',(select count(*) from public.calendar_assignments
          where calendar_item_id=current_item.id and lifecycle='active')));
    end loop;
    if jsonb_array_length(items_preview)<>cardinality(item_ids) then
      raise exception 'Calendar selection unavailable.' using errcode='42501'; end if;
    select array_agg(distinct (i->>'date')::date) into days from jsonb_array_elements(items_preview) i;
  end if;

  if exists(select 1 from jsonb_array_elements(p_plan->'volunteers') v,
    jsonb_array_elements_text(v->'excludeDates') d where not d::date=any(days)) then
    raise exception 'Exception date is outside the selection.' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('itemId',a.calendar_item_id,'volunteerId',a.volunteer_profile_id,
    'assignmentId',a.id,'version',a.updated_at) order by a.id),'[]') into existing_preview
    from public.calendar_assignments a where a.calendar_item_id=any(item_ids)
      and a.volunteer_profile_id=any(volunteer_ids) and a.lifecycle='active';

  select coalesce(jsonb_agg(to_jsonb(conflict) order by conflict."assignmentId"),'[]'::jsonb) into conflicts_preview
  from (
    select distinct on (a.id) a.volunteer_profile_id as "volunteerId",
      i.start_date as "date", i.title_snapshot as "title", a.id as "assignmentId",
      a.updated_at as "version", i.updated_at as "itemVersion"
    from public.calendar_assignments a
    join public.calendar_items i on i.id=a.calendar_item_id
    join public.workspaces w on w.id=i.workspace_id
    where a.workspace_id=p_workspace_id and a.volunteer_profile_id=any(volunteer_ids)
      and a.lifecycle='active' and i.lifecycle='active'
      and i.schedule_kind in ('timed','date_based') and not i.id=any(item_ids)
      and (i.publication_state='published' or i.created_by_project_contact_id=actor)
      and exists (
        select 1 from jsonb_array_elements(items_preview) selected
        where tstzrange(
          (((selected->>'date')::date + coalesce((selected->>'startTime')::time,time '00:00')) at time zone w.timezone),
          (((coalesce((selected->>'endDate')::date,(selected->>'date')::date)
            + coalesce((selected->>'endTime')::time,time '00:00'))
            + case when selected->>'startTime' is null then interval '1 day' else interval '0' end) at time zone w.timezone),
          '[)') && tstzrange(
          ((i.start_date+coalesce(i.start_time,time '00:00')) at time zone w.timezone),
          (((coalesce(i.end_date,i.start_date)+coalesce(i.end_time,time '00:00'))
            + case when i.schedule_kind='date_based' then interval '1 day' else interval '0' end) at time zone w.timezone),
          '[)')
      )
    order by a.id
  ) conflict;
  preview:=jsonb_build_object('items',items_preview,'volunteers',volunteers_preview,
    'awayPeriods',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'volunteerId',a.volunteer_profile_id,'start',a.starts_on,'end',a.ends_on) order by a.id),'[]'::jsonb)
    from public.volunteer_away_periods a where a.workspace_id=p_workspace_id and a.volunteer_profile_id=any(volunteer_ids)
      and exists(select 1 from jsonb_array_elements(items_preview) i where (i->>'date')::date between a.starts_on and a.ends_on)), 'existingAssignments',existing_preview,'sameDayWork',conflicts_preview,'plan',p_plan);
  fingerprint:=md5(preview::text);
  if p_expected_preview is null then return preview || jsonb_build_object('fingerprint',fingerprint,'saved',false); end if;
  if p_expected_preview<>fingerprint then
    raise exception 'This selection changed. Review the latest preview.' using errcode='40001'; end if;

  if creation is not null and creation<>'null'::jsonb then
    if exists(select 1 from public.calendar_repeat_creation_requests where workspace_id=p_workspace_id and request_key=p_request_id) then
      raise exception 'Request already used.' using errcode='22023'; end if;
    created_ids:=public.create_current_workspace_repeated_calendar_items(p_request_id,
      (creation->>'presetId')::uuid,creation->>'title',creation->>'taskType',
      (creation->>'startDate')::date,(creation->>'endDate')::date,coalesce((creation->>'endDayOffset')::integer,0),weekdays,
      (creation->>'startTime')::time,(creation->>'endTime')::time,(creation->>'neededCount')::integer,
      nullif(creation->>'notes',''),coalesce(creation->'customValues','{}'),
      creation->'meal'->>'kind',creation->'meal'->>'provider',creation->'meal'->>'contact',
      creation->'meal'->>'menu',(creation->'meal'->>'total')::integer);
    item_ids:=created_ids;
  end if;
  for current_item in select * from public.calendar_items where id=any(item_ids) order by id loop
    if current_item.workspace_id<>p_workspace_id then
      raise exception 'Workspace mismatch.' using errcode='42501'; end if;
    select array_agg((v->>'id')::uuid order by v->>'id') into selected_ids
      from jsonb_array_elements(p_plan->'volunteers') v
      where not (v->'excludeDates') ? current_item.start_date::text
        and not exists(select 1 from public.calendar_assignments a where a.calendar_item_id=current_item.id
          and a.volunteer_profile_id=(v->>'id')::uuid and a.lifecycle='active');
    if coalesce(cardinality(selected_ids),0)>0 then
      assignment_ids:=assignment_ids || public.create_calendar_assignments_batch(
        current_item.id,selected_ids,nullif(p_plan->>'note',''));
    end if;
  end loop;
  preview:=jsonb_build_object('saved',true,'itemIds',item_ids,'createdItemIds',created_ids,
    'assignmentIds',assignment_ids,'createdAssignmentCount',cardinality(assignment_ids));
  insert into public.calendar_bulk_assignment_operations(workspace_id,request_id,actor_id,plan,result)
    values(p_workspace_id,p_request_id,actor,p_plan,preview);
  return preview;
end;
$$;

-- Existing boundary: read_assignment_detail_context
CREATE OR REPLACE FUNCTION public.read_assignment_detail_context(p_assignment_id uuid) RETURNS TABLE(assignment_reference uuid, assignment_lifecycle text, workspace_reference uuid, workspace_display_name text, calendar_item_reference uuid, task_title text, schedule_kind text, scheduled_date date, scheduled_end_date date, scheduled_start_time time without time zone, scheduled_end_time time without time zone, schedule_timezone text, planned_needed_count integer, volunteer_profile_reference uuid, volunteer_display_name text, volunteer_congregation text, current_response_status text, current_response_updated_at timestamp with time zone, current_response_source text, can_edit_assignment boolean, response_link_product_surface_available boolean, future_response_link_surface text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    assignment.id,
    assignment.lifecycle,
    workspace.id,
    workspace.display_name,
    item.id,
    item.title_snapshot,
    item.schedule_kind,
    item.start_date,
    item.end_date,
    item.start_time,
    item.end_time,
    item.timezone,
    item.needed_count,
    volunteer.id,
    case when volunteer.deleted_at is null then volunteer.full_name else volunteer.full_name||' · Deleted volunteer' end,
    volunteer.congregation,
    response.response_status,
    response.updated_at,
    response.response_source,
    volunteer.deleted_at is null and grant_row.capabilities @> array['assignments.edit']::text[],
    false,
    'future_project_contact_assignment_response_reveal'::text
  from public.calendar_assignments as assignment
  join public.workspaces as workspace
    on workspace.id = assignment.workspace_id
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = assignment.volunteer_profile_id
    and volunteer.workspace_id = assignment.workspace_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  join public.project_contacts as contact
    on contact.auth_user_id = auth.uid()
    and contact.status = 'active'
  join public.workspace_contact_grants as grant_row
    on grant_row.workspace_id = assignment.workspace_id
    and grant_row.project_contact_id = contact.id
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['assignments.view']::text[]
  where auth.uid() is not null
    and assignment.id = p_assignment_id
    and assignment.lifecycle = 'active'
    and workspace.lifecycle = 'active'
    and item.lifecycle = 'active'
    and (
      item.publication_state = 'published'
      or item.created_by_project_contact_id = contact.id
    )
    and ((volunteer.deleted_at is null and volunteer.lifecycle='active' and volunteer.readiness_status='ready')
      or (volunteer.deleted_at is not null and public.volunteer_assignment_end_at(item.id)<=statement_timestamp()));
$$;

-- Existing boundary: read_assignment_picker_away_periods
CREATE OR REPLACE FUNCTION public.read_assignment_picker_away_periods(p_workspace_id uuid, p_volunteer_ids uuid[], p_from date, p_through date) RETURNS TABLE(volunteer_profile_id uuid, starts_on date, ends_on date)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor uuid;
begin
  if auth.uid() is null or p_workspace_id is null or p_volunteer_ids is null
    or cardinality(p_volunteer_ids) not between 1 and 1000
    or array_position(p_volunteer_ids,null) is not null
    or cardinality(p_volunteer_ids) <> (select count(distinct id) from unnest(p_volunteer_ids) id)
    or p_from is null or p_through is null or p_through < p_from
    or p_through - p_from > 373
  then raise exception 'Assignment picker context unavailable.' using errcode='22023'; end if;

  select c.id into actor from public.project_contacts c
  join public.workspace_contact_grants g on g.project_contact_id=c.id
  join public.workspaces w on w.id=g.workspace_id
  where c.auth_user_id=auth.uid() and c.status='active' and w.lifecycle='active'
    and g.workspace_id=p_workspace_id and g.status='active' and g.revoked_at is null
    and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
    and g.capabilities @> array['workspace.read','calendar.view','assignments.view','assignments.edit','volunteers.view']::text[]
  limit 1;
  if actor is null or (select count(*) from public.volunteer_profiles v
      where v.id=any(p_volunteer_ids) and v.workspace_id=p_workspace_id
        and v.lifecycle='active' and v.deleted_at is null and v.readiness_status='ready') <> cardinality(p_volunteer_ids)
  then raise exception 'Assignment picker context unavailable.' using errcode='42501'; end if;

  return query select a.volunteer_profile_id,a.starts_on,a.ends_on
    from public.volunteer_away_periods a
    where a.workspace_id=p_workspace_id and a.volunteer_profile_id=any(p_volunteer_ids)
      and a.starts_on<=p_through and a.ends_on>=p_from
    order by a.volunteer_profile_id,a.starts_on,a.id;
end $$;

-- Existing boundary: read_assignment_reminder_workspace
CREATE OR REPLACE FUNCTION public.read_assignment_reminder_workspace(p_workspace_id uuid, p_view text DEFAULT 'summary'::text, p_search text DEFAULT NULL::text, p_cursor jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 25) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  observed timestamptz := statement_timestamp(); zone text; search_value text;
  cursor_id uuid; cursor_at timestamptz; rows_value jsonb; next_value jsonb;
  next_due timestamptz; next_count bigint; last_activity jsonb; failures bigint; unknowns bigint;
begin
  -- Authorization precedes every private read, including status and validation.
  perform public.communication_actor(p_workspace_id);
  if p_view is null or p_view not in ('summary','upcoming','history','why_not') then
    raise exception 'Invalid reminder view.' using errcode='22023';
  end if;
  if p_limit is null or p_limit<1 or p_limit>50 then
    raise exception 'Reminder page size must be between 1 and 50.' using errcode='22023';
  end if;
  search_value := nullif(btrim(p_search),'');
  if length(p_search)>100 then raise exception 'Reminder search is limited to 100 characters.' using errcode='22023'; end if;
  if p_cursor is not null then
    if octet_length(p_cursor::text)>512 or p_view='summary' or jsonb_typeof(p_cursor)<>'object' or
      not (p_cursor ? 'id') or jsonb_typeof(p_cursor->'id')<>'string' or
      (p_view='why_not' and (p_cursor - 'id')<>'{}'::jsonb) or
      (p_view<>'why_not' and (not(p_cursor ? 'at') or jsonb_typeof(p_cursor->'at')<>'string' or (p_cursor - 'id' - 'at')<>'{}'::jsonb)) then
      raise exception 'Invalid reminder page. Start again.' using errcode='22023';
    end if;
    begin
      cursor_id := (p_cursor->>'id')::uuid;
      if p_view<>'why_not' then
        cursor_at := (p_cursor->>'at')::timestamptz;
        if not isfinite(cursor_at) or p_cursor->>'at' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Invalid timestamp'; end if;
      end if;
    exception when others then raise exception 'Invalid reminder page. Start again.' using errcode='22023'; end;
  end if;
  select w.timezone into zone from public.workspaces w where w.id=p_workspace_id;

  if p_view='summary' then
    -- A single coherent project-wide result; never affected by list/search state.
    select min(o.due_at) into next_due
    from public.assignment_reminder_occurrences o
    join public.calendar_assignments a on a.id=o.assignment_id and a.workspace_id=o.workspace_id
    join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=o.workspace_id
    join public.volunteer_profiles v on v.id=o.volunteer_id and v.workspace_id=o.workspace_id
    join public.assignment_responses ar on ar.assignment_id=a.id and ar.workspace_id=o.workspace_id
    left join public.communication_recipients r on r.id=o.recipient_id and r.workspace_id=o.workspace_id
    where o.workspace_id=p_workspace_id and o.scheduling_state='active'
      and o.start_at>observed and o.due_at>=observed-interval '15 minutes'
      and a.lifecycle='active' and i.lifecycle='active' and i.publication_state='published'
      and v.lifecycle='active' and v.deleted_at is null and v.readiness_status='ready'
      and ar.response_status=case o.kind when 'response' then 'needs_response' else 'confirmed' end
      and o.start_at=public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,zone)
      and coalesce(r.state,'ready') in ('ready','failed') and coalesce(r.attempt,0)<3;
    select count(*) into next_count
    from public.assignment_reminder_occurrences o
    join public.calendar_assignments a on a.id=o.assignment_id and a.workspace_id=o.workspace_id
    join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=o.workspace_id
    join public.volunteer_profiles v on v.id=o.volunteer_id and v.workspace_id=o.workspace_id
    join public.assignment_responses ar on ar.assignment_id=a.id and ar.workspace_id=o.workspace_id
    left join public.communication_recipients r on r.id=o.recipient_id and r.workspace_id=o.workspace_id
    where o.workspace_id=p_workspace_id and o.due_at=next_due and o.scheduling_state='active'
      and o.start_at>observed and a.lifecycle='active' and i.lifecycle='active' and i.publication_state='published'
      and v.lifecycle='active' and v.deleted_at is null and v.readiness_status='ready'
      and ar.response_status=case o.kind when 'response' then 'needs_response' else 'confirmed' end
      and o.start_at=public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,zone)
      and coalesce(r.state,'ready') in ('ready','failed') and coalesce(r.attempt,0)<3;
    -- Actual processing only. Rescheduling by itself is not a delivery attempt.
    with activity as (
      select o.id,o.occurrence_key,v.full_name||case when v.deleted_at is not null then ' · Deleted volunteer' else '' end volunteer,i.title_snapshot assignment,
        greatest(e.happened_at,r.claimed_at,r.finalized_at) activity_at,
        case when e.happened_at is not null and (greatest(r.claimed_at,r.finalized_at) is null or e.happened_at>=greatest(r.claimed_at,r.finalized_at))
          then case e.event when 'claimed' then 'sending' else e.event end else r.state end state
      from public.assignment_reminder_occurrences o
      join public.volunteer_profiles v on v.id=o.volunteer_id and v.workspace_id=o.workspace_id
      join public.calendar_assignments a on a.id=o.assignment_id and a.workspace_id=o.workspace_id
      join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=o.workspace_id
      left join public.communication_recipients r on r.id=o.recipient_id and r.workspace_id=o.workspace_id
      left join lateral (select ev.event,ev.happened_at from public.assignment_reminder_events ev
        where ev.occurrence_id=o.id and ev.workspace_id=p_workspace_id and ev.event in ('claimed','sent','failed','unknown','excluded')
        order by ev.happened_at desc,ev.id desc limit 1) e on true
      where o.workspace_id=p_workspace_id
    ) select (select to_jsonb(t) from (select * from activity where activity_at is not null order by activity_at desc,id desc limit 1) t),
      count(*) filter(where state='failed'),count(*) filter(where state='unknown')
      into last_activity,failures,unknowns from activity;
    return jsonb_build_object('view','summary','observedAt',observed,'timezone',zone,
      'enabled',(select delivery_enabled from public.assignment_reminder_activation where singleton),
      'nextBatch',case when next_due is not null then jsonb_build_object('dueAt',next_due,'count',next_count) end,
      'lastActivity',last_activity,'failedCount',failures,'unknownCount',unknowns);
  elsif p_view='upcoming' then
    with page as materialized (
      select o.id,o.assignment_id,o.volunteer_id,v.full_name||case when v.deleted_at is not null then ' · Deleted volunteer' else '' end volunteer,i.title_snapshot assignment,
        o.start_at,o.due_at,o.occurrence_key,ar.response_status response,
        case when r.state='failed' then 'retry_scheduled' else 'scheduled' end state,o.next_attempt_at retry_at
      from public.assignment_reminder_occurrences o
      join public.calendar_assignments a on a.id=o.assignment_id and a.workspace_id=o.workspace_id
      join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=o.workspace_id
      join public.volunteer_profiles v on v.id=o.volunteer_id and v.workspace_id=o.workspace_id
      join public.assignment_responses ar on ar.assignment_id=a.id and ar.workspace_id=o.workspace_id
      left join public.communication_recipients r on r.id=o.recipient_id and r.workspace_id=o.workspace_id
      where o.workspace_id=p_workspace_id and o.scheduling_state='active'
        and o.start_at>observed and o.due_at>=observed-interval '15 minutes'
        and a.lifecycle='active' and i.lifecycle='active' and i.publication_state='published'
        and v.lifecycle='active' and v.deleted_at is null and v.readiness_status='ready'
        and ar.response_status=case o.kind when 'response' then 'needs_response' else 'confirmed' end
        and o.start_at=public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,zone)
        and coalesce(r.state,'ready') in ('ready','failed') and coalesce(r.attempt,0)<3
        and (search_value is null or strpos(lower(v.full_name),lower(search_value))>0 or strpos(lower(i.title_snapshot),lower(search_value))>0)
        and (cursor_id is null or (o.due_at,o.id)>(cursor_at,cursor_id))
      order by o.due_at,o.id limit p_limit+1
    ), visible as (select * from page order by due_at,id limit p_limit)
    select coalesce((select jsonb_agg(to_jsonb(v) order by v.due_at,v.id) from visible v),'[]'),
      case when (select count(*) from page)>p_limit then (select jsonb_build_object('at',due_at,'id',id) from visible order by due_at desc,id desc limit 1) end
      into rows_value,next_value;
  elsif p_view='history' then
    with activity as (
      select o.id,o.assignment_id,o.volunteer_id,v.full_name||case when v.deleted_at is not null then ' · Deleted volunteer' else '' end volunteer,i.title_snapshot assignment,
        o.start_at,o.due_at,o.occurrence_key,greatest(coalesce(r.attempt,0),coalesce(e.attempt,0)) attempt,
        greatest(e.happened_at,r.claimed_at,r.finalized_at) activity_at,
        case when e.happened_at is not null and (greatest(r.claimed_at,r.finalized_at) is null or e.happened_at>=greatest(r.claimed_at,r.finalized_at))
          then case e.event when 'claimed' then 'sending' else e.event end else r.state end state
      from public.assignment_reminder_occurrences o
      join public.volunteer_profiles v on v.id=o.volunteer_id and v.workspace_id=o.workspace_id
      join public.calendar_assignments a on a.id=o.assignment_id and a.workspace_id=o.workspace_id
      join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=o.workspace_id
      left join public.communication_recipients r on r.id=o.recipient_id and r.workspace_id=o.workspace_id
      left join lateral (select ev.event,ev.happened_at,ev.attempt from public.assignment_reminder_events ev
        where ev.occurrence_id=o.id and ev.workspace_id=p_workspace_id and ev.event in ('claimed','sent','failed','unknown','excluded')
        order by ev.happened_at desc,ev.id desc limit 1) e on true
      where o.workspace_id=p_workspace_id
        and (search_value is null or strpos(lower(v.full_name),lower(search_value))>0 or strpos(lower(i.title_snapshot),lower(search_value))>0)
    ), page as materialized (
      select * from activity where activity_at is not null
        and (cursor_id is null or (activity_at,id)<(cursor_at,cursor_id))
      order by activity_at desc,id desc limit p_limit+1
    ), visible as (select * from page order by activity_at desc,id desc limit p_limit)
    select coalesce((select jsonb_agg(to_jsonb(v) order by v.activity_at desc,v.id desc) from visible v),'[]'),
      case when (select count(*) from page)>p_limit then (select jsonb_build_object('at',activity_at,'id',id) from visible order by activity_at,id limit 1) end
      into rows_value,next_value;
  else
    -- Current persisted assignment context, not a second eligibility/scheduling engine.
    with page as materialized (
      select a.id,a.id assignment_id,v.id volunteer_id,v.full_name||case when v.deleted_at is not null then ' · Deleted volunteer' else '' end volunteer,i.title_snapshot assignment,
        public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,zone) start_at,
        ar.response_status response,
        case when a.lifecycle<>'active' then 'Assignment canceled or inactive'
          when i.lifecycle<>'active' or i.publication_state<>'published' then 'Calendar item inactive or unpublished'
          when v.lifecycle<>'active' or v.readiness_status<>'ready' then 'Volunteer inactive or not ready'
          when ar.response_status='declined' then 'Volunteer declined'
          when public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,zone)<=observed then 'Assignment has started'
          when i.meal_kind is not null or i.schedule_kind not in ('timed','date_based') then 'Not an actionable volunteer assignment'
          when exists(select 1 from public.assignment_reminder_occurrences o where o.assignment_id=a.id and o.workspace_id=p_workspace_id and o.scheduling_state='active') then 'A reminder is recorded. See Upcoming or History for its current state.'
          when exists(select 1 from public.assignment_reminder_occurrences o where o.assignment_id=a.id and o.workspace_id=p_workspace_id and o.scheduling_state='invalid_destination') then 'Delivery address unavailable'
          else 'No outstanding reminder is recorded. This read does not predict or schedule reminders.' end reason
      from public.calendar_assignments a
      join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=a.workspace_id
      join public.volunteer_profiles v on v.id=a.volunteer_profile_id and v.workspace_id=a.workspace_id and v.deleted_at is null
      left join public.assignment_responses ar on ar.assignment_id=a.id and ar.workspace_id=a.workspace_id
      where a.workspace_id=p_workspace_id and (cursor_id is null or a.id>cursor_id)
        and (search_value is null or strpos(lower(v.full_name),lower(search_value))>0 or strpos(lower(i.title_snapshot),lower(search_value))>0)
      order by a.id limit p_limit+1
    ), visible as (select * from page order by id limit p_limit)
    select coalesce((select jsonb_agg(to_jsonb(v) order by v.id) from visible v),'[]'),
      case when (select count(*) from page)>p_limit then (select jsonb_build_object('id',id) from visible order by id desc limit 1) end
      into rows_value,next_value;
  end if;
  return jsonb_build_object('view',p_view,'observedAt',observed,'timezone',zone,'rows',rows_value,'nextCursor',next_value);
end $_$;

-- Existing boundary: read_assignment_response_by_token
CREATE OR REPLACE FUNCTION public.read_assignment_response_by_token(p_bearer_token text) RETURNS TABLE(workspace_display_name text, assignment_reference uuid, task_title text, schedule_kind text, start_date date, end_date date, start_time time without time zone, end_time time without time zone, schedule_timezone text, current_response_status text)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select
    workspace.display_name,
    assignment.id,
    item.title_snapshot,
    item.schedule_kind,
    item.start_date,
    item.end_date,
    item.start_time,
    item.end_time,
    item.timezone,
    response.response_status
  from public.assignment_response_tokens as token
  join public.calendar_assignments as assignment
    on assignment.id = token.assignment_id
    and assignment.workspace_id = token.workspace_id
    and assignment.volunteer_profile_id = token.volunteer_profile_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = token.volunteer_profile_id
    and volunteer.workspace_id = token.workspace_id
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = token.workspace_id
  where char_length(p_bearer_token) = 43
    and p_bearer_token ~ '^[A-Za-z0-9_-]{43}$'
    and token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'assignment_response'
    and token.revoked_at is null
    and token.expires_at > now()
    and assignment.lifecycle = 'active'
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and workspace.lifecycle = 'active'
  limit 1;
$_$;

-- Existing boundary: read_communication_history
CREATE OR REPLACE FUNCTION public.read_communication_history(p_workspace_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.communication_actor(p_workspace_id);
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.recipient_id) from (
    select o.id operation_id,o.kind,o.mode,o.created_at,r.id recipient_id,r.volunteer_id,(r.snapshot->>'name')||case when r.recipient_redacted_at is not null then ' · Deleted volunteer' else '' end name,
      r.email,r.state,r.attempt,r.failure_code,r.claimed_at,r.finalized_at,
      jsonb_array_length(r.snapshot->'assignments') assignment_count
    from public.communication_operations o join public.communication_recipients r on r.operation_id=o.id
    where o.workspace_id=p_workspace_id and o.kind<>'reminder' order by o.created_at desc,r.id limit 1000
  ) r),'[]');
end $$;

-- Existing boundary: read_initial_assignment_notification_summaries
CREATE OR REPLACE FUNCTION public.read_initial_assignment_notification_summaries(p_calendar_item_ids uuid[]) RETURNS TABLE(calendar_item_id uuid, active_assignment_count integer, eligible_to_send_count integer, already_sent_count integer, missing_email_count integer, missing_follow_up_contact_count integer, failed_retryable_count integer, sending_count integer, ineligible_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  caller_user_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_calendar_item_ids is null
    or coalesce(cardinality(p_calendar_item_ids), 0) > 100
    or exists (
      select 1
      from unnest(coalesce(p_calendar_item_ids, array[]::uuid[])) as requested(id)
      where requested.id is null
    )
  then
    raise exception 'Initial assignment notification summaries are unavailable.' using errcode = '42501';
  end if;

  return query
  with requested_items as (
    select distinct requested.id as calendar_item_id
    from unnest(p_calendar_item_ids) as requested(id)
  ),
  authorized_items as (
    select item.*, workspace.lifecycle as workspace_lifecycle
    from requested_items
    join public.calendar_items as item
      on item.id = requested_items.calendar_item_id
    join public.workspaces as workspace
      on workspace.id = item.workspace_id
    where exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = item.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and workspace.lifecycle = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  ),
  item_follow_up as (
    select
      item.id as calendar_item_id,
      (
        follow_contact.id is not null
        and follow_contact.volunteer_facing_display_name is not null
        and follow_contact.volunteer_facing_email is not null
        and follow_contact.volunteer_facing_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        and exists (
          select 1
          from public.workspace_contact_grants as follow_grant
          where follow_grant.workspace_id = item.workspace_id
            and follow_grant.project_contact_id = follow_contact.id
            and follow_grant.status = 'active'
            and follow_grant.revoked_at is null
            and follow_grant.valid_from <= now()
            and (follow_grant.valid_until is null or follow_grant.valid_until > now())
        )
      ) as has_follow_up_contact,
      public.calendar_assignment_response_start_at(
        item.schedule_kind,
        item.start_date,
        item.start_time,
        item.timezone
      ) as assignment_start_at
    from authorized_items as item
    left join public.project_contacts as follow_contact
      on follow_contact.id = item.follow_up_project_contact_id
      and follow_contact.status = 'active'
  ),
  assignment_scope as (
    select
      item.id as calendar_item_id,
      assignment.id as assignment_id,
      volunteer.lifecycle as volunteer_lifecycle,
      volunteer.readiness_status,
      lower(nullif(btrim(volunteer.email), '')) as recipient_email,
      exists (
        select 1 from public.volunteer_profiles household
        where household.workspace_id=item.workspace_id
          and household.id<>volunteer.id and household.lifecycle='active' and household.deleted_at is null
          and lower(btrim(household.email))=lower(btrim(volunteer.email))
      ) as shared_contact,
      item.publication_state,
      item.lifecycle as item_lifecycle,
      follow_up.has_follow_up_contact,
      follow_up.assignment_start_at,
      delivery.delivery_state,
      delivery.safe_failure_code,
      delivery.sending_expires_at
    from authorized_items as item
    left join item_follow_up as follow_up
      on follow_up.calendar_item_id = item.id
    left join public.calendar_assignments as assignment
      on assignment.workspace_id = item.workspace_id
      and assignment.calendar_item_id = item.id
      and assignment.lifecycle = 'active'
    left join public.volunteer_profiles as volunteer
      on volunteer.workspace_id = assignment.workspace_id
      and volunteer.id = assignment.volunteer_profile_id
    left join public.assignment_notification_deliveries as delivery
      on delivery.workspace_id = assignment.workspace_id
      and delivery.calendar_assignment_id = assignment.id
      and delivery.notification_kind = 'initial_assignment'
      and delivery.template_version = 'initial-assignment.v1'
  )
  select
    scope.calendar_item_id,
    count(scope.assignment_id)::integer as active_assignment_count,
    count(*) filter (
      where scope.assignment_id is not null
        and scope.publication_state = 'published'
        and scope.item_lifecycle = 'active'
        and scope.assignment_start_at > now()
        and scope.volunteer_lifecycle = 'active'
        and scope.readiness_status = 'ready'
        and scope.recipient_email is not null
        and scope.recipient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        and scope.has_follow_up_contact
        and scope.delivery_state is distinct from 'sent'
        and not coalesce(
          scope.delivery_state = 'sending'
          and scope.sending_expires_at > now(),
          false
        )
    )::integer as eligible_to_send_count,
    count(*) filter (where scope.delivery_state = 'sent')::integer as already_sent_count,
    count(*) filter (
      where scope.assignment_id is not null
        and scope.volunteer_lifecycle = 'active'
        and scope.readiness_status = 'ready'
        and (
          scope.recipient_email is null
          or scope.recipient_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
        )
    )::integer as missing_email_count,
    count(*) filter (
      where scope.assignment_id is not null
        and scope.publication_state = 'published'
        and not scope.has_follow_up_contact
    )::integer as missing_follow_up_contact_count,
    count(*) filter (
      where scope.delivery_state = 'failed'
        and scope.safe_failure_code not in ('missing_recipient_email', 'missing_follow_up_contact', 'not_eligible')
    )::integer as failed_retryable_count,
    count(*) filter (
      where scope.delivery_state = 'sending'
        and scope.sending_expires_at > now()
    )::integer as sending_count,
    count(*) filter (
      where scope.assignment_id is not null
        and not (
          scope.publication_state = 'published'
          and scope.item_lifecycle = 'active'
          and scope.assignment_start_at > now()
          and scope.volunteer_lifecycle = 'active'
          and scope.readiness_status = 'ready'
        )
    )::integer as ineligible_count
  from assignment_scope as scope
  group by scope.calendar_item_id
  order by scope.calendar_item_id;
end;
$_$;

-- Existing boundary: read_project_quick_view_assigned_contact
CREATE OR REPLACE FUNCTION public.read_project_quick_view_assigned_contact(p_bearer_token text, p_assignment_id uuid, p_project_date date DEFAULT NULL::date) RETURNS TABLE(contact_name text, phone text, email text, congregation text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  select volunteer.full_name, volunteer.phone, volunteer.email, volunteer.congregation
  from public.project_quick_view_access_tokens token
  join public.workspaces workspace on workspace.id = token.workspace_id
  join public.calendar_assignments assignment
    on assignment.id = p_assignment_id
    and assignment.workspace_id = token.workspace_id
    and assignment.lifecycle = 'active'
  join public.calendar_items item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = token.workspace_id
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
  join public.volunteer_profiles volunteer
    on volunteer.id = assignment.volunteer_profile_id
    and volunteer.workspace_id = token.workspace_id and volunteer.deleted_at is null
  where p_bearer_token is not null
    and char_length(p_bearer_token) = 43
    and p_bearer_token ~ '^[A-Za-z0-9_-]{43}$'
    and token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'project_quick_view_access'
    and token.token_version = 1
    and token.revoked_at is null
    and token.expires_at > now()
    and workspace.lifecycle = 'active'
    and workspace.ends_on is not null
    and (now() at time zone workspace.timezone)::date <= workspace.ends_on
    and coalesce(p_project_date, (now() at time zone workspace.timezone)::date) <= workspace.ends_on
    and item.start_date < coalesce(p_project_date, (now() at time zone workspace.timezone)::date) + 42
    and coalesce(item.end_date, item.start_date) >= coalesce(p_project_date, (now() at time zone workspace.timezone)::date) - 31
  limit 1;
$_$;

-- Existing boundary: read_project_quick_view_by_token
CREATE OR REPLACE FUNCTION public.read_project_quick_view_by_token(p_bearer_token text, p_project_date date DEFAULT NULL::date) RETURNS TABLE(access_state text, workspace_display_name text, workspace_timezone text, project_date date, project_starts_on date, project_ends_on date, token_expires_at timestamp with time zone, expected_on_site_count integer, schedule_sources jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare verified_token_id uuid; verified_workspace_id uuid; verified_workspace_name text; verified_workspace_timezone text; verified_project_starts_on date; verified_project_ends_on date; verified_token_expires_at timestamptz; selected_date date;
begin
  if p_bearer_token is null or char_length(p_bearer_token) <> 43 or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return;
  end if;
  select token.id,token.workspace_id,workspace.display_name,workspace.timezone,workspace.starts_on,workspace.ends_on,token.expires_at
  into verified_token_id,verified_workspace_id,verified_workspace_name,verified_workspace_timezone,verified_project_starts_on,verified_project_ends_on,verified_token_expires_at
  from public.project_quick_view_access_tokens token join public.workspaces workspace on workspace.id=token.workspace_id
  where token.token_verifier_hash=extensions.digest(p_bearer_token,'sha256') and token.purpose='project_quick_view_access' and token.token_version=1 and token.revoked_at is null and token.expires_at>now() and workspace.lifecycle='active' and workspace.ends_on is not null and (now() at time zone workspace.timezone)::date<=workspace.ends_on limit 1;
  if verified_token_id is null then return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return; end if;
  selected_date:=coalesce(p_project_date,(now() at time zone verified_workspace_timezone)::date);
  if selected_date>verified_project_ends_on then return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return; end if;
  update public.project_quick_view_access_tokens set last_used_at=now() where id=verified_token_id;
  return query select 'ready'::text,verified_workspace_name,verified_workspace_timezone,selected_date,verified_project_starts_on,verified_project_ends_on,verified_token_expires_at,null::integer,coalesce(schedule.items,'[]'::jsonb)
  from (select 1) anchor left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id',item.id,'workspace_id',item.workspace_id,'task_preset_id',item.task_preset_id,'title_snapshot',item.title_snapshot,'task_type_snapshot',item.task_type_snapshot,'schedule_kind',item.schedule_kind,'start_date',item.start_date,'end_date',item.end_date,'start_time',item.start_time,'end_time',item.end_time,'timezone',item.timezone,'needed_count',item.needed_count,'schedule_notes',null,'meal_kind',item.meal_kind,'meal_provider',item.meal_provider,'meal_contact',item.meal_contact,'meal_menu',item.meal_menu,'meal_total',item.meal_total,'lifecycle',item.lifecycle,'publication_state',item.publication_state,'published_at',item.published_at,'task_preset_label',preset.name,'task_preset_color_key',preset.color_key,'task_description',null,'custom_values','{}'::jsonb,'assignments',coalesce(assigned.rows,'[]'::jsonb)
    ) order by item.start_date,item.start_time nulls last,item.title_snapshot,item.id) items
    from public.calendar_items item left join public.task_presets preset on preset.id=item.task_preset_id and preset.workspace_id=item.workspace_id
    left join lateral (select jsonb_agg(jsonb_build_object('assignmentId',a.id,'calendarItemId',item.id,'volunteerProfileId',v.id,'volunteerDisplayName',v.full_name,'volunteerDeleted',v.deleted_at is not null,'responseStatus',coalesce(r.response_status,'needs_response')) order by v.full_name,a.id) rows from public.calendar_assignments a join public.volunteer_profiles v on v.id=a.volunteer_profile_id and v.workspace_id=item.workspace_id left join public.assignment_responses r on r.assignment_id=a.id and r.workspace_id=item.workspace_id where a.calendar_item_id=item.id and a.workspace_id=item.workspace_id and a.lifecycle='active' and (v.deleted_at is null or public.volunteer_assignment_end_at(item.id)<=now())) assigned on true
    where item.workspace_id=verified_workspace_id and item.lifecycle='active' and item.publication_state='published' and item.start_date<selected_date+42 and coalesce(item.end_date,item.start_date)>=selected_date-31
  ) schedule on true;
end;
$_$;

-- Existing boundary: read_volunteer_schedule
CREATE OR REPLACE FUNCTION public.read_volunteer_schedule(p_bearer_token text) RETURNS TABLE(schedule_state text, workspace_display_name text, workspace_timezone text, volunteer_display_name text, assignment_reference uuid, task_title text, task_type text, schedule_kind text, start_date date, end_date date, start_time time without time zone, end_time time without time zone, needed_count integer, schedule_notes text, current_response_status text, response_note text, can_confirm boolean, can_decline boolean, response_locked boolean, response_lock_reason text, active_assigned_count integer, confirmed_count integer, declined_count integer, follow_up_contact_display_name text, follow_up_contact_email text, follow_up_contact_phone text, meal_details jsonb, fellow_worker_names text[])
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  verified_token_id uuid;
  verified_workspace_id uuid;
  verified_volunteer_profile_id uuid;
  valid_assignment_count integer;
begin
  if p_bearer_token is null
    or char_length(p_bearer_token) <> 43
    or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$'
  then
    return query
    select
      'unavailable'::text,
      null::text,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::date,
      null::date,
      null::time without time zone,
      null::time without time zone,
      null::integer,
      null::text,
      null::text,
      null::text,
      null::boolean,
      null::boolean,
      null::boolean,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text,
      '[]'::jsonb,
      '{}'::text[];
    return;
  end if;

  select token.id, token.workspace_id, token.volunteer_profile_id
  into verified_token_id, verified_workspace_id, verified_volunteer_profile_id
  from public.volunteer_schedule_access_tokens as token
  join public.workspaces as workspace
    on workspace.id = token.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = token.volunteer_profile_id
    and volunteer.workspace_id = token.workspace_id
  where token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'volunteer_schedule_access'
    and token.token_version = 1
    and token.revoked_at is null
    and token.expires_at > now()
    and workspace.lifecycle = 'active'
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
  limit 1;

  if verified_token_id is null then
    return query
    select
      'unavailable'::text,
      null::text,
      null::text,
      null::text,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::date,
      null::date,
      null::time without time zone,
      null::time without time zone,
      null::integer,
      null::text,
      null::text,
      null::text,
      null::boolean,
      null::boolean,
      null::boolean,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text,
      '[]'::jsonb,
      '{}'::text[];
    return;
  end if;

  update public.volunteer_schedule_access_tokens as token
  set last_used_at = now()
  where token.id = verified_token_id;

  select count(*)::integer
  into valid_assignment_count
  from public.calendar_assignments as assignment
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = assignment.workspace_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  where assignment.workspace_id = verified_workspace_id
    and assignment.volunteer_profile_id = verified_volunteer_profile_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and item.start_date between
      coalesce(workspace.starts_on, (current_date - interval '365 days')::date)
      and coalesce(workspace.ends_on, (current_date + interval '365 days')::date);

  if valid_assignment_count = 0 then
    return query
    select
      'ready_empty'::text,
      workspace.display_name,
      workspace.timezone,
      volunteer.full_name,
      null::uuid,
      null::text,
      null::text,
      null::text,
      null::date,
      null::date,
      null::time without time zone,
      null::time without time zone,
      null::integer,
      null::text,
      null::text,
      null::text,
      null::boolean,
      null::boolean,
      null::boolean,
      null::text,
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text,
      '[]'::jsonb,
      '{}'::text[]
    from public.workspaces as workspace
    join public.volunteer_profiles as volunteer
      on volunteer.workspace_id = workspace.id
    where workspace.id = verified_workspace_id
      and volunteer.id = verified_volunteer_profile_id;
    return;
  end if;

  return query
  with visible_assignments as materialized (
    select own_assignment.id, own_assignment.calendar_item_id
    from public.calendar_assignments as own_assignment
    join public.calendar_items as own_item
      on own_item.id = own_assignment.calendar_item_id
      and own_item.workspace_id = own_assignment.workspace_id
    join public.assignment_responses as own_response
      on own_response.assignment_id = own_assignment.id
      and own_response.workspace_id = own_assignment.workspace_id
    join public.workspaces as own_workspace
      on own_workspace.id = own_assignment.workspace_id
    where own_assignment.workspace_id = verified_workspace_id
      and own_assignment.volunteer_profile_id = verified_volunteer_profile_id
      and own_assignment.lifecycle = 'active'
      and own_item.lifecycle = 'active'
      and own_item.publication_state = 'published'
      and own_item.start_date between
        coalesce(own_workspace.starts_on, (current_date - interval '365 days')::date)
        and coalesce(own_workspace.ends_on, (current_date + interval '365 days')::date)
    order by own_item.start_date, own_item.start_time nulls first, own_assignment.id
    limit 100
  ), fellow_workers as (
    select fellow_assignment.calendar_item_id,
      array_agg(fellow_profile.full_name order by lower(fellow_profile.full_name), fellow_profile.full_name, fellow_assignment.id) as names
    from public.calendar_assignments as fellow_assignment
    join public.assignment_responses as fellow_response
      on fellow_response.assignment_id = fellow_assignment.id
      and fellow_response.workspace_id = fellow_assignment.workspace_id
    join public.volunteer_profiles as fellow_profile
      on fellow_profile.id = fellow_assignment.volunteer_profile_id
      and fellow_profile.workspace_id = fellow_assignment.workspace_id
    where fellow_assignment.workspace_id = verified_workspace_id
      and fellow_assignment.calendar_item_id in (select distinct calendar_item_id from visible_assignments)
      and fellow_assignment.volunteer_profile_id <> verified_volunteer_profile_id
      and fellow_assignment.lifecycle = 'active'
      and fellow_response.response_status in ('needs_response', 'confirmed')
      and fellow_profile.lifecycle = 'active' and fellow_profile.deleted_at is null
      and fellow_profile.readiness_status = 'ready'
    group by fellow_assignment.calendar_item_id
  )
  select
    'ready'::text,
    workspace.display_name,
    workspace.timezone,
    volunteer.full_name,
    assignment.id,
    item.title_snapshot,
    item.task_type_snapshot,
    item.schedule_kind,
    item.start_date,
    item.end_date,
    item.start_time,
    item.end_time,
    item.needed_count,
    case when item.meal_kind is null then item.schedule_notes else null::text end,
    response.response_status,
    response.response_note,
    (
      response.response_status in ('needs_response', 'declined')
      and policy.assignment_start_at > now()
    )::boolean as can_confirm,
    (
      response.response_status in ('needs_response', 'confirmed')
      and policy.assignment_start_at > now()
      and now() < policy.assignment_start_at - interval '48 hours'
    )::boolean as can_decline,
    (
      policy.assignment_start_at <= now()
      or (
        response.response_status in ('needs_response', 'confirmed')
        and now() >= policy.assignment_start_at - interval '48 hours'
      )
    )::boolean as response_locked,
    case
      when policy.assignment_start_at <= now() then 'started'
      when response.response_status in ('needs_response', 'confirmed')
        and now() >= policy.assignment_start_at - interval '48 hours'
        then 'inside_48_hours'
      else null::text
    end as response_lock_reason,
    coverage.active_assigned_count,
    coverage.confirmed_count,
    coverage.declined_count,
    follow_contact.volunteer_facing_display_name,
    lower(nullif(btrim(follow_contact.volunteer_facing_email), '')),
    follow_contact.volunteer_facing_phone,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind',meal.meal_kind,'provider',meal.meal_provider,'menu',meal.meal_menu,
        'startTime',meal.start_time,'endTime',meal.end_time
      ) order by meal.meal_kind)
      from public.calendar_items meal
      where meal.workspace_id = verified_workspace_id and meal.start_date = item.start_date
        and meal.lifecycle = 'active' and meal.publication_state = 'published' and meal.meal_kind is not null
    ), '[]'::jsonb),
    case when response.response_status in ('needs_response', 'confirmed')
      then coalesce(fellow_workers.names, '{}'::text[])
      else '{}'::text[]
    end
  from visible_assignments as visible
  join public.calendar_assignments as assignment
    on assignment.id = visible.id
    and assignment.workspace_id = verified_workspace_id
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = assignment.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = assignment.volunteer_profile_id
    and volunteer.workspace_id = assignment.workspace_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  left join public.project_contacts as follow_contact
    on follow_contact.id = item.follow_up_project_contact_id
    and follow_contact.status = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as follow_grant
      where follow_grant.workspace_id = item.workspace_id
        and follow_grant.project_contact_id = follow_contact.id
        and follow_grant.status = 'active'
        and follow_grant.revoked_at is null
        and follow_grant.valid_from <= now()
        and (follow_grant.valid_until is null or follow_grant.valid_until > now())
    )
  cross join lateral (
    select public.calendar_assignment_response_start_at(
      item.schedule_kind,
      item.start_date,
      item.start_time,
      item.timezone
    ) as assignment_start_at
  ) as policy
  cross join lateral (
    select
      count(*) filter (
        where current_assignment.lifecycle = 'active'
          and current_response.response_status in ('needs_response', 'confirmed')
      )::integer as active_assigned_count,
      count(*) filter (
        where current_assignment.lifecycle = 'active'
          and current_response.response_status = 'confirmed'
      )::integer as confirmed_count,
      count(*) filter (
        where current_assignment.lifecycle = 'active'
          and current_response.response_status = 'declined'
      )::integer as declined_count
    from public.calendar_assignments as current_assignment
    join public.assignment_responses as current_response
      on current_response.assignment_id = current_assignment.id
      and current_response.workspace_id = current_assignment.workspace_id
    where current_assignment.workspace_id = item.workspace_id
      and current_assignment.calendar_item_id = item.id
  ) as coverage
  left join fellow_workers
    on fellow_workers.calendar_item_id = item.id
  where assignment.workspace_id = verified_workspace_id
    and assignment.volunteer_profile_id = verified_volunteer_profile_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and item.start_date between
      coalesce(workspace.starts_on, (current_date - interval '365 days')::date)
      and coalesce(workspace.ends_on, (current_date + interval '365 days')::date)
  order by
    item.start_date asc,
    item.start_time asc nulls first,
    assignment.id asc
  limit 100;
end;
$_$;

-- Existing boundary: replace_assignment_response_token
CREATE OR REPLACE FUNCTION public.replace_assignment_response_token(p_assignment_id uuid, p_ttl_hours integer) RETURNS TABLE(token_id uuid, bearer_token text, token_expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  target_workspace_id uuid;
  target_volunteer_profile_id uuid;
  replacement_time timestamptz;
  replacement_token_id uuid;
  replacement_bearer_token text;
  replacement_expires_at timestamptz;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null or p_ttl_hours not between 1 and 168 then
    raise exception 'Assignment response token replacement is unavailable.' using errcode = '42501';
  end if;

  select assignment.workspace_id, assignment.volunteer_profile_id
  into target_workspace_id, target_volunteer_profile_id
  from public.calendar_assignments as assignment
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = assignment.volunteer_profile_id
    and volunteer.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = assignment.workspace_id
  where assignment.id = p_assignment_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
    and workspace.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = assignment.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= clock_timestamp()
        and (grant_row.valid_until is null or grant_row.valid_until > clock_timestamp())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  for update of assignment;

  if target_workspace_id is null or target_volunteer_profile_id is null then
    raise exception 'Assignment response token replacement is unavailable.' using errcode = '42501';
  end if;

  replacement_time := clock_timestamp();

  update public.assignment_response_tokens as token
  set revoked_at = replacement_time,
      updated_at = replacement_time
  where token.workspace_id = target_workspace_id
    and token.assignment_id = p_assignment_id
    and token.purpose = 'assignment_response'
    and token.revoked_at is null;

  replacement_bearer_token := rtrim(
    translate(
      encode(extensions.gen_random_bytes(32), 'base64'),
      '+/',
      '-_'
    ),
    '='
  );
  replacement_expires_at := replacement_time + make_interval(hours => p_ttl_hours);

  insert into public.assignment_response_tokens (
    workspace_id,
    assignment_id,
    volunteer_profile_id,
    token_verifier_hash,
    purpose,
    expires_at,
    internal_note,
    created_by_auth_user_id,
    created_at,
    updated_at
  )
  values (
    target_workspace_id,
    p_assignment_id,
    target_volunteer_profile_id,
    extensions.digest(replacement_bearer_token, 'sha256'),
    'assignment_response',
    replacement_expires_at,
    null,
    caller_user_id,
    replacement_time,
    replacement_time
  )
  returning id into replacement_token_id;

  return query
  select replacement_token_id, replacement_bearer_token, replacement_expires_at;
end;
$$;

-- Existing boundary: resolve_volunteer_schedule_contact
CREATE OR REPLACE FUNCTION public.resolve_volunteer_schedule_contact(p_contact text, p_choice text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare normalized_contact text; contact_is_email boolean; limiter public.volunteer_lookup_attempts%rowtype;
  contact_bucket text; contact_attempts integer; matches jsonb; selected jsonb; bearer text; expires timestamptz;
begin
  select * into limiter from public.volunteer_lookup_attempts where bucket='global' for update;
  if not found or limiter.secret is null then return '{"status":"unverified"}'::jsonb; end if;
  if limiter.window_started_at<=now()-interval '15 minutes' then
    update public.volunteer_lookup_attempts set attempts=0,window_started_at=now() where bucket='global';
    limiter.attempts:=0;
  end if;
  if limiter.attempts>=200 then return '{"status":"unverified"}'::jsonb; end if;
  update public.volunteer_lookup_attempts set attempts=public.volunteer_lookup_attempts.attempts+1 where bucket='global';
  delete from public.volunteer_lookup_attempts where bucket<>'global' and window_started_at<=now()-interval '15 minutes';
  if p_contact is null or octet_length(p_contact)>1024 then return '{"status":"unverified"}'::jsonb; end if;
  normalized_contact:=lower(btrim(p_contact));
  if char_length(normalized_contact) not between 3 and 254 then return '{"status":"unverified"}'::jsonb; end if;
  contact_is_email:=position('@' in normalized_contact)>0;
  if contact_is_email then
    if normalized_contact !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return '{"status":"unverified"}'::jsonb; end if;
  else
    if normalized_contact !~ '^\+?[0-9() .-]+$' then return '{"status":"unverified"}'::jsonb; end if;
    normalized_contact:=regexp_replace(normalized_contact,'[^0-9]','','g');
    if char_length(normalized_contact) not between 7 and 15 then return '{"status":"unverified"}'::jsonb; end if;
  end if;
  contact_bucket:=encode(extensions.hmac(convert_to('contact:'||normalized_contact,'UTF8'),limiter.secret,'sha256'),'hex');
  insert into public.volunteer_lookup_attempts(bucket,attempts) values(contact_bucket,1)
    on conflict(bucket) do update set attempts=least(public.volunteer_lookup_attempts.attempts+1,7)
    returning attempts into contact_attempts;
  if contact_attempts>6 then return '{"status":"unverified"}'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('volunteer_id',v.id,'workspace_id',w.id,
    'name',v.full_name,'project',w.display_name,'congregation',v.congregation,
    'choice',encode(extensions.hmac(convert_to('volunteer:'||w.id||':'||v.id||':'||normalized_contact,'UTF8'),limiter.secret,'sha256'),'hex'))
    order by w.display_name,v.full_name,v.id),'[]'::jsonb) into matches
  from public.volunteer_profiles v join public.workspaces w on w.id=v.workspace_id
  where v.lifecycle='active' and v.deleted_at is null and v.readiness_status='ready' and w.lifecycle='active'
    and ((contact_is_email and lower(btrim(v.email))=normalized_contact)
      or (not contact_is_email and btrim(v.phone)~'^\+?[0-9() .-]+$'
        and regexp_replace(v.phone,'[^0-9]','','g')=normalized_contact));
  if jsonb_array_length(matches)=0 or jsonb_array_length(matches)>20 then return '{"status":"unverified"}'::jsonb; end if;
  if p_choice is null and jsonb_array_length(matches)>1 then
    return jsonb_build_object('status','choose_volunteer','volunteers',
      (select jsonb_agg(jsonb_build_object('choice',m->>'choice','name',m->>'name','project',m->>'project',
        'congregation',m->>'congregation')) from jsonb_array_elements(matches) m));
  end if;
  select m into selected from jsonb_array_elements(matches) m
    where p_choice is null or (m->>'choice')=p_choice;
  if selected is null then return '{"status":"unverified"}'::jsonb; end if;
  bearer:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
  expires:=now()+interval '30 days';
  insert into public.volunteer_schedule_access_tokens(workspace_id,volunteer_profile_id,token_verifier_hash,expires_at)
    values((selected->>'workspace_id')::uuid,(selected->>'volunteer_id')::uuid,extensions.digest(bearer,'sha256'),expires);
  return jsonb_build_object('status','verified','bearer_token',bearer,'expires_at',expires);
end $_$;

-- Existing boundary: reveal_assignment_response_link
CREATE OR REPLACE FUNCTION public.reveal_assignment_response_link(p_assignment_id uuid, p_ttl_hours integer, p_reveal_mode text, p_metadata jsonb) RETURNS TABLE(response_token_id uuid, audit_event_id uuid, token_expires_at timestamp with time zone, bearer_token text, event_reveal_surface text, event_reveal_mode text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  target_workspace_id uuid;
  target_volunteer_profile_id uuid;
  target_actor_project_contact_id uuid;
  reveal_time timestamptz;
  replacement_token_id uuid;
  recorded_audit_event_id uuid;
  replacement_bearer_token text;
  replacement_expires_at timestamptz;
  normalized_metadata jsonb;
  reveal_surface constant text := 'future_project_contact_assignment_response_reveal';
begin
  caller_user_id := auth.uid();
  normalized_metadata := coalesce(p_metadata, '{}'::jsonb);

  if caller_user_id is null
    or p_ttl_hours not between 1 and 168
    or p_reveal_mode not in ('copy_link', 'email_delivery', 'reminder_delivery')
    or not public.response_link_reveal_metadata_is_valid(normalized_metadata)
  then
    raise exception 'Assignment response link reveal is unavailable.' using errcode = '42501';
  end if;

  select
    assignment.workspace_id,
    assignment.volunteer_profile_id,
    contact.id
  into
    target_workspace_id,
    target_volunteer_profile_id,
    target_actor_project_contact_id
  from public.calendar_assignments as assignment
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = assignment.volunteer_profile_id
    and volunteer.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = assignment.workspace_id
  join public.project_contacts as contact
    on contact.auth_user_id = caller_user_id
    and contact.status = 'active'
  where assignment.id = p_assignment_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
    and workspace.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      where grant_row.workspace_id = assignment.workspace_id
        and grant_row.project_contact_id = contact.id
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= clock_timestamp()
        and (grant_row.valid_until is null or grant_row.valid_until > clock_timestamp())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  for update of assignment;

  if target_workspace_id is null
    or target_volunteer_profile_id is null
    or target_actor_project_contact_id is null
  then
    raise exception 'Assignment response link reveal is unavailable.' using errcode = '42501';
  end if;

  reveal_time := clock_timestamp();

  update public.assignment_response_tokens as token
  set revoked_at = reveal_time,
      updated_at = reveal_time
  where token.workspace_id = target_workspace_id
    and token.assignment_id = p_assignment_id
    and token.purpose = 'assignment_response'
    and token.revoked_at is null;

  replacement_bearer_token := rtrim(
    translate(
      encode(extensions.gen_random_bytes(32), 'base64'),
      '+/',
      '-_'
    ),
    '='
  );
  replacement_expires_at := reveal_time + make_interval(hours => p_ttl_hours);

  insert into public.assignment_response_tokens (
    workspace_id,
    assignment_id,
    volunteer_profile_id,
    token_verifier_hash,
    purpose,
    expires_at,
    internal_note,
    created_by_auth_user_id,
    created_at,
    updated_at
  )
  values (
    target_workspace_id,
    p_assignment_id,
    target_volunteer_profile_id,
    extensions.digest(replacement_bearer_token, 'sha256'),
    'assignment_response',
    replacement_expires_at,
    null,
    caller_user_id,
    reveal_time,
    reveal_time
  )
  returning id into replacement_token_id;

  insert into public.assignment_response_link_reveal_events (
    workspace_id,
    assignment_id,
    response_token_id,
    actor_project_contact_id,
    action,
    reveal_surface,
    reveal_mode,
    expires_at,
    occurred_at,
    metadata
  )
  values (
    target_workspace_id,
    p_assignment_id,
    replacement_token_id,
    target_actor_project_contact_id,
    'response_link_revealed',
    reveal_surface,
    p_reveal_mode,
    replacement_expires_at,
    reveal_time,
    normalized_metadata
  )
  returning id into recorded_audit_event_id;

  return query
  select
    replacement_token_id,
    recorded_audit_event_id,
    replacement_expires_at,
    replacement_bearer_token,
    reveal_surface,
    p_reveal_mode;
end;
$$;

-- Existing boundary: set_volunteer_profile_updated_at
CREATE OR REPLACE FUNCTION public.set_volunteer_profile_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if old.deleted_at is not null then raise exception 'Deleted volunteer identities cannot be edited.' using errcode='42501';end if;
  new.updated_at = now();
  return new;
end;
$$;

-- Existing boundary: submit_assignment_response_by_token
CREATE OR REPLACE FUNCTION public.submit_assignment_response_by_token(p_bearer_token text, p_response_status text, p_response_note text) RETURNS TABLE(assignment_reference uuid, current_response_status text, response_recorded_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  verified_token_id uuid;
  verified_assignment_id uuid;
  existing_response_status text;
  assignment_start_at timestamptz;
  recorded_at timestamptz;
begin
  perform public.lock_live_volunteer_profile(t.workspace_id,t.volunteer_profile_id) from public.assignment_response_tokens t where length(p_bearer_token)=43 and t.token_verifier_hash=extensions.digest(p_bearer_token,'sha256');
  if char_length(p_bearer_token) <> 43
    or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$'
    or p_response_status not in ('confirmed', 'declined')
    or (
      p_response_note is not null
      and char_length(btrim(p_response_note)) not between 1 and 1000
    )
  then
    raise exception 'Assignment response token is unavailable.' using errcode = '42501';
  end if;

  select token.id, assignment.id, response.response_status,
    public.calendar_assignment_response_start_at(
      item.schedule_kind,
      item.start_date,
      item.start_time,
      item.timezone
    )
  into verified_token_id, verified_assignment_id, existing_response_status, assignment_start_at
  from public.assignment_response_tokens as token
  join public.calendar_assignments as assignment
    on assignment.id = token.assignment_id
    and assignment.workspace_id = token.workspace_id
    and assignment.volunteer_profile_id = token.volunteer_profile_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = token.volunteer_profile_id
    and volunteer.workspace_id = token.workspace_id
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.workspaces as workspace
    on workspace.id = token.workspace_id
  where token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'assignment_response'
    and token.revoked_at is null
    and token.expires_at > now()
    and assignment.lifecycle = 'active'
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and workspace.lifecycle = 'active'
  for update of token, response nowait;

  if verified_token_id is null
    or existing_response_status is null
    or existing_response_status = p_response_status
    or assignment_start_at is null
    or assignment_start_at <= now()
    or (
      p_response_status = 'declined'
      and now() >= assignment_start_at - interval '48 hours'
    )
  then
    raise exception 'Assignment response token is unavailable.' using errcode = '42501';
  end if;

  recorded_at := now();

  update public.assignment_responses as response
  set response_status = p_response_status,
      response_source = 'public_token',
      response_note = case
        when p_response_status = 'confirmed' then null
        else nullif(btrim(p_response_note), '')
      end,
      responded_at = recorded_at,
      updated_by_auth_user_id = null
  where response.assignment_id = verified_assignment_id
    and response.response_status = existing_response_status;

  if not found then
    raise exception 'Assignment response changed concurrently.' using errcode = '40001';
  end if;

  update public.assignment_response_tokens as token
  set last_used_at = recorded_at
  where token.id = verified_token_id
    and token.revoked_at is null
    and token.expires_at > recorded_at;

  if not found then
    raise exception 'Assignment response token is unavailable.' using errcode = '42501';
  end if;

  return query
  select verified_assignment_id, p_response_status, recorded_at;
exception
  when lock_not_available then
    raise exception 'Assignment response changed concurrently.' using errcode = '40001';
end;
$_$;

-- Existing boundary: submit_volunteer_schedule_assignment_response
CREATE OR REPLACE FUNCTION public.submit_volunteer_schedule_assignment_response(p_bearer_token text, p_assignment_id uuid, p_response_status text, p_response_note text) RETURNS TABLE(assignment_reference uuid, current_response_status text, response_note text, response_recorded_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  verified_token_id uuid;
  verified_assignment_id uuid;
  existing_response_status text;
  existing_response_note text;
  assignment_start_at timestamptz;
  normalized_note text;
  recorded_at timestamptz;
begin
  perform public.lock_live_volunteer_profile(t.workspace_id,t.volunteer_profile_id) from public.volunteer_schedule_access_tokens t where length(p_bearer_token)=43 and t.token_verifier_hash=extensions.digest(p_bearer_token,'sha256');
  normalized_note := nullif(btrim(p_response_note), '');

  if p_bearer_token is null
    or char_length(p_bearer_token) <> 43
    or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$'
    or p_assignment_id is null
    or p_response_status not in ('confirmed', 'declined')
    or (
      normalized_note is not null
      and char_length(normalized_note) not between 1 and 1000
    )
  then
    raise exception 'Volunteer schedule response is unavailable.' using errcode = '42501';
  end if;

  select token.id, assignment.id, response.response_status, response.response_note,
    public.calendar_assignment_response_start_at(
      item.schedule_kind,
      item.start_date,
      item.start_time,
      item.timezone
    )
  into verified_token_id, verified_assignment_id, existing_response_status,
    existing_response_note, assignment_start_at
  from public.volunteer_schedule_access_tokens as token
  join public.workspaces as workspace
    on workspace.id = token.workspace_id
  join public.volunteer_profiles as volunteer
    on volunteer.id = token.volunteer_profile_id
    and volunteer.workspace_id = token.workspace_id
  join public.calendar_assignments as assignment
    on assignment.workspace_id = token.workspace_id
    and assignment.volunteer_profile_id = token.volunteer_profile_id
    and assignment.id = p_assignment_id
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  join public.assignment_responses as response
    on response.assignment_id = assignment.id
    and response.workspace_id = assignment.workspace_id
  where token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'volunteer_schedule_access'
    and token.token_version = 1
    and token.revoked_at is null
    and token.expires_at > now()
    and workspace.lifecycle = 'active'
    and volunteer.lifecycle = 'active' and volunteer.deleted_at is null
    and volunteer.readiness_status = 'ready'
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
  for update of token, response nowait;

  if verified_token_id is null
    or verified_assignment_id is null
    or existing_response_status is null
    or assignment_start_at is null
    or assignment_start_at <= now()
    or (
      p_response_status = 'declined'
      and now() >= assignment_start_at - interval '48 hours'
    )
  then
    raise exception 'Volunteer schedule response is unavailable.' using errcode = '42501';
  end if;

  recorded_at := now();

  if existing_response_status <> p_response_status
    or (
      p_response_status = 'declined'
      and normalized_note is not null
      and normalized_note is distinct from existing_response_note
    )
  then
    update public.assignment_responses as response
    set response_status = p_response_status,
        response_source = 'volunteer_schedule',
        response_note = case
          when p_response_status = 'confirmed' then null
          when normalized_note is null then response.response_note
          else normalized_note
        end,
        responded_at = recorded_at,
        updated_by_auth_user_id = null
    where response.assignment_id = verified_assignment_id
      and response.response_status = existing_response_status;

    if not found then
      raise exception 'Volunteer schedule response changed concurrently.' using errcode = '40001';
    end if;
  end if;

  update public.volunteer_schedule_access_tokens as token
  set last_used_at = recorded_at
  where token.id = verified_token_id
    and token.revoked_at is null
    and token.expires_at > recorded_at;

  if not found then
    raise exception 'Volunteer schedule response is unavailable.' using errcode = '42501';
  end if;

  return query
  select response.assignment_id, response.response_status, response.response_note, response.responded_at
  from public.assignment_responses as response
  where response.assignment_id = verified_assignment_id
    and response.workspace_id = (
      select token.workspace_id
      from public.volunteer_schedule_access_tokens as token
      where token.id = verified_token_id
    );
exception
  when lock_not_available then
    raise exception 'Volunteer schedule response changed concurrently.' using errcode = '40001';
end;
$_$;

-- Existing boundary: sync_assignment_reminder
CREATE OR REPLACE FUNCTION public.sync_assignment_reminder(p_assignment uuid, p_now timestamp with time zone) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare c jsonb; e public.assignment_reminder_enrollments%rowtype; o record; due timestamptz;
 baseline timestamptz; anchor timestamptz; start_instant timestamptz; response_at timestamptz; n integer; d integer; k text; kind_value text; rec_state text;
begin
 if not exists(select 1 from public.calendar_assignments a where a.id=p_assignment
   and public.lock_live_volunteer_profile(a.workspace_id,a.volunteer_profile_id)) then return;end if;
 select baseline_at into baseline from public.assignment_reminder_activation where singleton;
 if baseline is null or baseline>p_now then return; end if;
 -- Serializes enrollment/rescheduling, not provider delivery.
 perform 1 from public.calendar_assignments where id=p_assignment for update;
 c:=public.assignment_reminder_context(p_assignment,p_now);
 if c is null then
   update public.assignment_reminder_occurrences set scheduling_state='canceled' where assignment_id=p_assignment and scheduling_state='active';
   return;
 end if;
 start_instant:=(c->>'startAt')::timestamptz;
 select * into e from public.assignment_reminder_enrollments where assignment_id=p_assignment;
 select min(first_sent) into anchor from (
   select sent_at first_sent from public.assignment_notification_deliveries where calendar_assignment_id=p_assignment and delivery_state='sent'
   union all select r.finalized_at from public.communication_assignment_coverage ac join public.communication_recipients r on r.id=ac.recipient_id
     where ac.assignment_id=p_assignment and ac.initially_unsent and r.state='sent'
 ) initial_delivery;
 if (c->>'createdAt')::timestamptz<=baseline then anchor:=baseline; end if;
 response_at:=greatest(baseline,(c->>'respondedAt')::timestamptz);
 if e.assignment_id is not null and e.response_status=c->>'response' then response_at:=e.response_baseline; end if;
 insert into public.assignment_reminder_enrollments(assignment_id,workspace_id,volunteer_id,pending_anchor,response_status,response_baseline,start_at)
 values(p_assignment,(c->>'workspaceId')::uuid,(c->>'volunteerId')::uuid,anchor,c->>'response',response_at,start_instant)
 on conflict(assignment_id) do update set pending_anchor=coalesce(assignment_reminder_enrollments.pending_anchor,excluded.pending_anchor),
 response_status=excluded.response_status,response_baseline=excluded.response_baseline,start_at=excluded.start_at
 returning * into e;
 -- Existing attempts remain truthful. Unknown/sending/sent identities never get reopened.
 for o in select x.*,r.state delivery_state from public.assignment_reminder_occurrences x left join public.communication_recipients r on r.id=x.recipient_id where x.assignment_id=p_assignment loop
   if o.start_at is distinct from start_instant and coalesce(o.delivery_state,'ready') not in ('sent','sending','unknown') then
     insert into public.assignment_reminder_events(occurrence_id,workspace_id,recipient_id,event,happened_at,due_at)
       values(o.id,o.workspace_id,o.recipient_id,'rescheduled',p_now,o.due_at);
     update public.assignment_reminder_occurrences set scheduling_state='superseded',recipient_id=null,next_attempt_at=null where id=o.id;
   end if;
   if (o.kind='response') is distinct from (c->>'response'='needs_response') then
     update public.assignment_reminder_occurrences set scheduling_state='canceled' where id=o.id;
   end if;
 end loop;
 for d in select unnest(case when c->>'response'='confirmed' then array[30,14,7,3,1] else array[0,1] end) loop
   if c->>'response'='confirmed' then
     kind_value:='shift';k:='shift:'||d;
     due:=public.assignment_reminder_local_offset(start_instant,c->>'timezone',-d);
     if due<=response_at then continue; end if;
   else
     if e.pending_anchor is null then continue; end if;
     n:=greatest(1,((p_now at time zone (c->>'timezone'))::date-(e.pending_anchor at time zone (c->>'timezone'))::date)/3)+d;
     kind_value:='response';k:='pending:'||n;
     due:=public.assignment_reminder_local_offset(e.pending_anchor,c->>'timezone',n*3);
   end if;
   if due>=start_instant then continue; end if;
   select r.state into rec_state from public.assignment_reminder_occurrences x join public.communication_recipients r on r.id=x.recipient_id
     where x.assignment_id=p_assignment and x.kind=kind_value and x.occurrence_key=k;
   if rec_state in ('sent','sending','unknown') then continue; end if;
   -- Existing enrolled occurrences can mature; rescheduled/new ones must be future.
   if due<=p_now and not exists(select 1 from public.assignment_reminder_occurrences x where x.assignment_id=p_assignment and x.kind=kind_value and x.occurrence_key=k and x.start_at=start_instant and x.scheduling_state='active') then continue; end if;
   insert into public.assignment_reminder_occurrences(workspace_id,assignment_id,volunteer_id,kind,occurrence_key,due_at,start_at,enrolled_at)
   values(e.workspace_id,p_assignment,e.volunteer_id,kind_value,k,due,start_instant,p_now)
   on conflict(workspace_id,assignment_id,volunteer_id,kind,occurrence_key) do update
     set due_at=excluded.due_at,start_at=excluded.start_at,scheduling_state='active'
     where assignment_reminder_occurrences.scheduling_state in ('active','superseded','canceled','invalid_destination');
 end loop;
end $$;

-- Existing boundary: update_assignment_response
CREATE OR REPLACE FUNCTION public.update_assignment_response(p_assignment_id uuid, p_response_status text, p_response_note text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  caller_user_id uuid;
  current_status text;
  updated_assignment_id uuid;
begin
  if not exists(select 1 from public.calendar_assignments a where a.id=p_assignment_id
    and public.lock_live_volunteer_profile(a.workspace_id,a.volunteer_profile_id)) then
    raise exception 'Assignment is unavailable.' using errcode='42501';end if;
  caller_user_id := auth.uid();

  select response.response_status
  into current_status
  from public.assignment_responses as response
  join public.calendar_assignments as assignment
    on assignment.id = response.assignment_id
    and assignment.workspace_id = response.workspace_id
  join public.calendar_items as item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = assignment.workspace_id
  where response.assignment_id = p_assignment_id
    and assignment.lifecycle = 'active'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = assignment.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  for update of response nowait;

  if caller_user_id is null
    or current_status is null
    or p_response_status not in ('needs_response', 'confirmed', 'declined')
    or p_response_status = current_status
    or not (
      (current_status = 'needs_response' and p_response_status in ('confirmed', 'declined'))
      or (current_status = 'confirmed' and p_response_status in ('needs_response', 'declined'))
      or (current_status = 'declined' and p_response_status in ('needs_response', 'confirmed'))
    )
    or (
      p_response_note is not null
      and char_length(btrim(p_response_note)) not between 1 and 1000
    )
  then
    raise exception 'Assignment response update is unavailable.' using errcode = '42501';
  end if;

  update public.assignment_responses as response
  set response_status = p_response_status,
      response_source = 'project_contact',
      response_note = nullif(btrim(p_response_note), ''),
      responded_at = case
        when p_response_status = 'needs_response' then null
        else now()
      end,
      updated_by_auth_user_id = caller_user_id
  where response.assignment_id = p_assignment_id
    and response.response_status = current_status
    and exists (
      select 1
      from public.calendar_assignments as current_assignment
      join public.calendar_items as item
        on item.id = current_assignment.calendar_item_id
        and item.workspace_id = current_assignment.workspace_id
      where current_assignment.id = response.assignment_id
        and current_assignment.lifecycle = 'active'
        and item.lifecycle = 'active'
        and item.publication_state = 'published'
    )
  returning response.assignment_id into updated_assignment_id;

  if updated_assignment_id is null then
    raise exception 'Assignment response changed concurrently.' using errcode = '40001';
  end if;

  return updated_assignment_id;
exception
  when lock_not_available then
    raise exception 'Assignment response changed concurrently.' using errcode = '40001';
end;
$$;

-- Existing boundary: update_volunteer_profile_manual_fields
CREATE OR REPLACE FUNCTION public.update_volunteer_profile_manual_fields(p_profile_id uuid, p_profile jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare caller_user_id uuid; target_workspace_id uuid;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null or jsonb_typeof(p_profile) <> 'object' then raise exception 'Volunteer profile management is unavailable.' using errcode='42501'; end if;
  select workspace_id into target_workspace_id from public.volunteer_profiles where id=p_profile_id and deleted_at is null;
  if target_workspace_id is null or not exists (select 1 from public.workspace_contact_grants grant_row join public.project_contacts contact on contact.id=grant_row.project_contact_id join public.workspaces workspace on workspace.id=grant_row.workspace_id where grant_row.workspace_id=target_workspace_id and workspace.lifecycle='active' and contact.auth_user_id=caller_user_id and contact.status='active' and grant_row.status='active' and grant_row.revoked_at is null and grant_row.valid_from<=now() and (grant_row.valid_until is null or grant_row.valid_until>now()) and grant_row.capabilities @> array['volunteers.edit']::text[]) then raise exception 'Volunteer profile management is unavailable.' using errcode='42501'; end if;

  perform 1 from public.workspaces where id=target_workspace_id for update;
  perform 1 from public.volunteer_profiles where id=p_profile_id for update;
  if p_profile->>'expectedUpdatedAt' is null or not exists(select 1 from public.volunteer_profiles where id=p_profile_id and updated_at=(p_profile->>'expectedUpdatedAt')::timestamptz) then
    raise exception 'This profile changed. Review the latest version.' using errcode='40001';
  end if;
  update public.volunteer_profiles set lifecycle=coalesce(nullif(btrim(p_profile->>'lifecycle'),''),'active'),readiness_status=coalesce(nullif(btrim(p_profile->>'readinessStatus'),''),'ready'),full_name=btrim(coalesce(p_profile->>'fullName','')),email=nullif(btrim(p_profile->>'email'),''),phone=nullif(btrim(p_profile->>'phone'),''),congregation=nullif(btrim(p_profile->>'congregation'),''),preferred_contact_method=nullif(btrim(p_profile->>'preferredContactMethod'),''),profile_notes=btrim(coalesce(p_profile->>'profileNotes','')),date_of_birth=nullif(p_profile->>'dateOfBirth','')::date,emergency_contact_name=nullif(btrim(p_profile->>'emergencyContactName'),''),emergency_contact_phone=nullif(btrim(p_profile->>'emergencyContactPhone'),''),emergency_contact_relationship=nullif(btrim(p_profile->>'emergencyContactRelationship'),''),housing_option=coalesce(nullif(p_profile->>'housingOption',''),'unknown'),after_hours_security_availability=coalesce(nullif(p_profile->>'afterHoursSecurityAvailability',''),'unknown'),builder_assistant_communication=coalesce(nullif(p_profile->>'builderAssistantCommunication',''),'unknown'),available_work_days=array(select jsonb_array_elements_text(coalesce(p_profile->'availableWorkDays','[]'::jsonb))),available_two_plus_days=coalesce(nullif(p_profile->>'availableTwoPlusDays',''),'unknown'),skills_experience=nullif(btrim(p_profile->>'skillsExperience'),''),other_support=nullif(btrim(p_profile->>'otherSupport'),'') where id=p_profile_id and workspace_id=target_workspace_id;
  if not found then raise exception 'Volunteer profile management is unavailable.' using errcode='42501'; end if;
  return p_profile_id;
exception when check_violation or invalid_text_representation then raise exception 'Volunteer profile input is invalid.' using errcode='22023'; end;
$$;

-- Existing boundary: verify_volunteer_schedule_lookup
CREATE OR REPLACE FUNCTION public.verify_volunteer_schedule_lookup(p_full_name text, p_contact text, p_project_choice text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  normalized_last_name text;
  normalized_contact text;
  contact_is_email boolean;
  name_bucket text;
  limiter public.volunteer_lookup_attempts%rowtype;
  name_attempts integer;
  matches jsonb;
  selected_match jsonb;
  bearer text;
  expires timestamptz;
begin
  select * into limiter from public.volunteer_lookup_attempts where bucket = 'global' for update;
  if not found or limiter.secret is null then return '{"status":"unverified"}'::jsonb; end if;
  if limiter.window_started_at <= now() - interval '15 minutes' then
    update public.volunteer_lookup_attempts set attempts = 0, window_started_at = now() where bucket = 'global';
    limiter.attempts := 0;
  end if;
  if limiter.attempts >= 200 then return '{"status":"unverified"}'::jsonb; end if;
  update public.volunteer_lookup_attempts set attempts = attempts + 1 where bucket = 'global';
  delete from public.volunteer_lookup_attempts where bucket <> 'global' and window_started_at <= now() - interval '15 minutes';

  if p_full_name is null or p_contact is null or octet_length(p_full_name) > 640 or octet_length(p_contact) > 1024 then return '{"status":"unverified"}'::jsonb; end if;
  normalized_last_name := lower(btrim(regexp_replace(p_full_name, '[[:space:]]+', ' ', 'g')));
  normalized_contact := lower(btrim(p_contact));
  if char_length(normalized_last_name) not between 1 and 160 or char_length(normalized_contact) not between 3 and 254 then return '{"status":"unverified"}'::jsonb; end if;

  -- Keep the existing serialized, keyed rate-limit design. The bucket is not a readable name hash.
  name_bucket := encode(extensions.hmac(convert_to(normalized_last_name, 'UTF8'), limiter.secret, 'sha256'), 'hex');
  insert into public.volunteer_lookup_attempts (bucket, attempts) values (name_bucket, 1)
    on conflict (bucket) do update set attempts = least(public.volunteer_lookup_attempts.attempts + 1, 7)
    returning attempts into name_attempts;
  if name_attempts > 6 then return '{"status":"unverified"}'::jsonb; end if;

  contact_is_email := position('@' in normalized_contact) > 0;
  if not contact_is_email then
    if normalized_contact !~ '^\+?[0-9() .-]+$' then return '{"status":"unverified"}'::jsonb; end if;
    normalized_contact := regexp_replace(normalized_contact, '[^0-9]', '', 'g');
    if char_length(normalized_contact) not between 7 and 15 then return '{"status":"unverified"}'::jsonb; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('workspace_id', w.id, 'name', w.display_name, 'volunteer_id', v.id) order by w.display_name, w.id), '[]'::jsonb)
  into matches
  from public.volunteer_profiles v join public.workspaces w on w.id = v.workspace_id
  where v.lifecycle = 'active' and v.deleted_at is null and v.readiness_status = 'ready' and w.lifecycle = 'active'
    and regexp_replace(lower(btrim(regexp_replace(v.full_name, '[[:space:]]+', ' ', 'g'))), '^.* ', '') = normalized_last_name
    and ((contact_is_email and lower(btrim(v.email)) = normalized_contact)
      or (not contact_is_email and btrim(v.phone) ~ '^\+?[0-9() .-]+$' and regexp_replace(v.phone, '[^0-9]', '', 'g') = normalized_contact));

  -- A shared contact plus a public surname does not establish which household
  -- member is present. Keep individual links and a separately held phone path.
  if exists (
    select 1 from jsonb_array_elements(matches) m
    where exists (
      select 1 from public.volunteer_profiles other
      where other.workspace_id=(m->>'workspace_id')::uuid
        and other.lifecycle='active' and other.deleted_at is null
        and other.id<>(m->>'volunteer_id')::uuid
        and ((contact_is_email and lower(btrim(other.email))=normalized_contact)
          or (not contact_is_email and btrim(other.phone) ~ '^\+?[0-9() .-]+$'
            and regexp_replace(other.phone, '[^0-9]', '', 'g')=normalized_contact))
    )
  ) then return '{"status":"unverified"}'::jsonb; end if;

  if jsonb_array_length(matches) = 0 or jsonb_array_length(matches) > 20 or exists (select 1 from jsonb_array_elements(matches) m group by m->>'workspace_id' having count(*) > 1) then return '{"status":"unverified"}'::jsonb; end if;
  if p_project_choice is null and jsonb_array_length(matches) > 1 then
    return jsonb_build_object('status', 'choose_project', 'projects', (select jsonb_agg(jsonb_build_object('choice', encode(extensions.hmac(convert_to('choice:' || (m->>'workspace_id') || ':' || normalized_last_name || ':' || normalized_contact, 'UTF8'), limiter.secret, 'sha256'), 'hex'), 'name', m->>'name')) from jsonb_array_elements(matches) m));
  end if;
  select m into selected_match from jsonb_array_elements(matches) m where p_project_choice is null or encode(extensions.hmac(convert_to('choice:' || (m->>'workspace_id') || ':' || normalized_last_name || ':' || normalized_contact, 'UTF8'), limiter.secret, 'sha256'), 'hex') = p_project_choice;
  if selected_match is null then return '{"status":"unverified"}'::jsonb; end if;
  bearer := rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  expires := now() + interval '24 hours';
  insert into public.volunteer_schedule_access_tokens (workspace_id, volunteer_profile_id, token_verifier_hash, expires_at) values ((selected_match->>'workspace_id')::uuid, (selected_match->>'volunteer_id')::uuid, extensions.digest(bearer, 'sha256'), expires);
  return jsonb_build_object('status', 'verified', 'bearer_token', bearer, 'expires_at', expires);
end;
$_$;

-- Existing boundary: volunteer_home_identity
CREATE OR REPLACE FUNCTION public.volunteer_home_identity(p_token text) RETURNS TABLE(workspace_id uuid, volunteer_id uuid)
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $_$
  select t.workspace_id,t.volunteer_profile_id from public.volunteer_schedule_access_tokens t
  join public.workspaces w on w.id=t.workspace_id
  join public.volunteer_profiles v on v.id=t.volunteer_profile_id and v.workspace_id=t.workspace_id
  where length(p_token)=43 and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and t.token_verifier_hash=extensions.digest(p_token,'sha256') and t.purpose='volunteer_schedule_access'
    and t.token_version=1 and t.revoked_at is null and t.expires_at>now()
    and w.lifecycle='active' and v.lifecycle='active' and v.deleted_at is null and v.readiness_status='ready' limit 1;
$_$;

-- NEW_FUNCTION_PRIVILEGES

-- Last database authorization before HTTP; an already authorized request may complete.
-- No provider I/O occurs here and no authorization can be acquired after deletion commits.
create function public.revalidate_volunteer_dispatch(p_source text,p_delivery_id uuid,p_claim_id uuid default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare recipient public.communication_recipients%rowtype; delivery public.assignment_notification_deliveries%rowtype;
  operation public.communication_operations%rowtype; actor uuid; destination text; valid boolean;
begin
  if p_source='communication' then
    select * into recipient from public.communication_recipients where id=p_delivery_id;
    if not found then return false;end if;
    actor:=public.communication_actor(recipient.workspace_id);
    perform 1 from public.workspaces where id=recipient.workspace_id for update;
    if not public.lock_live_volunteer_profile(recipient.workspace_id,recipient.volunteer_id) then return false;end if;
    select * into recipient from public.communication_recipients where id=p_delivery_id for update;
    select * into operation from public.communication_operations where id=recipient.operation_id;
    if operation.kind='reminder' or recipient.state<>'sending' or recipient.claim_id is distinct from p_claim_id
      or recipient.claimed_by is distinct from actor or recipient.recipient_redacted_at is not null then return false;end if;
    select lower(btrim(email)) into destination from public.volunteer_profiles
      where id=recipient.volunteer_id and workspace_id=recipient.workspace_id and deleted_at is null and lifecycle='active';
    valid:=destination is not null and destination=recipient.email;
    if operation.kind='schedule' then
      perform 1 from public.calendar_items i join public.calendar_assignments a on a.calendar_item_id=i.id
        join public.communication_assignment_coverage c on c.assignment_id=a.id and c.workspace_id=a.workspace_id
        where c.recipient_id=recipient.id order by i.id,a.id for share of i,a;
      if exists(select 1 from jsonb_array_elements(recipient.snapshot->'assignments') e
        left join public.calendar_assignments a on a.id=(e->>'assignmentId')::uuid
        left join public.calendar_items i on i.id=a.calendar_item_id
        left join public.assignment_responses r on r.assignment_id=a.id
        where a.id is null or a.workspace_id<>recipient.workspace_id or a.volunteer_profile_id<>recipient.volunteer_id
          or a.lifecycle<>'active' or i.lifecycle<>'active' or i.publication_state<>'published' or r.response_status='declined'
          or r.response_status is null or i.updated_at<>(e->>'itemVersion')::timestamptz or a.updated_at<>(e->>'assignmentVersion')::timestamptz
          or public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,i.timezone)<=statement_timestamp()) then valid:=false;end if;
    end if;
    if not valid then update public.communication_recipients set state='excluded',failure_code='eligibility_changed',finalized_at=statement_timestamp() where id=recipient.id;end if;
    return valid;
  elsif p_source='initial_assignment' then
    select * into delivery from public.assignment_notification_deliveries where id=p_delivery_id;
    if not found then return false;end if;
    -- Match the existing initial-assignment claim contract, which does not
    -- require the broader Communications management capability bundle.
    select c.id into actor from public.project_contacts c join public.workspace_contact_grants g on g.project_contact_id=c.id
      join public.workspaces w on w.id=g.workspace_id
      where c.auth_user_id=auth.uid() and c.id=delivery.initiated_by_project_contact_id and c.status='active'
        and g.workspace_id=delivery.workspace_id and w.lifecycle='active' and g.status='active' and g.revoked_at is null
        and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
        and g.capabilities @> array['assignments.edit']::text[];
    if actor is null then return false;end if;
    perform 1 from public.workspaces where id=delivery.workspace_id for update;
    if not public.lock_live_volunteer_profile(delivery.workspace_id,delivery.volunteer_profile_id) then return false;end if;
    select * into delivery from public.assignment_notification_deliveries where id=p_delivery_id for update;
    return delivery.delivery_state='sending' and delivery.initiated_by_project_contact_id=actor
      and delivery.recipient_redacted_at is null and delivery.sending_expires_at>statement_timestamp()
      and exists(select 1 from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id
        join public.volunteer_profiles v on v.id=a.volunteer_profile_id and v.workspace_id=a.workspace_id
        join public.assignment_responses r on r.assignment_id=a.id and r.workspace_id=a.workspace_id
        where a.id=delivery.calendar_assignment_id and a.workspace_id=delivery.workspace_id and a.lifecycle='active'
          and i.lifecycle='active' and i.publication_state='published' and v.deleted_at is null
          and v.lifecycle='active' and v.readiness_status='ready' and r.response_status<>'declined'
          and lower(btrim(v.email))=delivery.recipient_email_snapshot
          and public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,i.timezone)>statement_timestamp());
  end if;
  raise exception 'Invalid delivery boundary.' using errcode='22023';
end $$;

alter function public.lock_live_volunteer_profile(uuid,uuid) owner to postgres;
alter function public.guard_live_volunteer_reference() owner to postgres;
alter function public.volunteer_assignment_end_at(uuid) owner to postgres;
alter function public.volunteer_deletion_impact(uuid,uuid,timestamptz) owner to postgres;
alter function public.review_volunteer_deletion(uuid,uuid) owner to postgres;
alter function public.delete_volunteer_profile(uuid,uuid,timestamptz,text) owner to postgres;
alter function public.revalidate_volunteer_dispatch(text,uuid,uuid) owner to postgres;
revoke all on function public.lock_live_volunteer_profile(uuid,uuid),public.guard_live_volunteer_reference(),
  public.volunteer_assignment_end_at(uuid),public.volunteer_deletion_impact(uuid,uuid,timestamptz),
  public.review_volunteer_deletion(uuid,uuid),public.delete_volunteer_profile(uuid,uuid,timestamptz,text),
  public.revalidate_volunteer_dispatch(text,uuid,uuid)
  from public,anon,authenticated,service_role,project_local_reminder_worker,project_local_reminder_runner;
grant execute on function public.review_volunteer_deletion(uuid,uuid),public.delete_volunteer_profile(uuid,uuid,timestamptz,text),
  public.revalidate_volunteer_dispatch(text,uuid,uuid) to authenticated,service_role;

notify pgrst,'reload schema';
commit;
