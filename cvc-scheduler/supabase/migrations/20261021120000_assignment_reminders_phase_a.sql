-- 12.57 Phase A. No jobs, credentials, network calls, enrollment or sends on migration.
begin;
do $$ begin
  if exists(select 1 from pg_roles where rolname='project_local_reminder_worker') then
    raise exception 'Unexpected existing reminder worker role; review its privileges before migration.';
  else
    create role project_local_reminder_worker nologin noinherit nosuperuser nobypassrls;
  end if;
end $$;
grant usage on schema public to project_local_reminder_worker;
-- A separately provisioned, server-held JWT may assume ONLY this restricted role.
grant project_local_reminder_worker to authenticator;

alter table public.communication_operations alter column actor_id drop not null;
alter table public.communication_operations drop constraint communication_operations_kind_check;
alter table public.communication_operations add constraint communication_operations_kind_check check(kind in ('welcome','schedule','reminder'));
alter table public.communication_operations drop constraint communication_operations_mode_check;
alter table public.communication_operations add constraint communication_operations_mode_check check(mode in ('new','all','resend','automatic'));
alter table public.communication_operations add constraint communication_operations_actor_source check(
  (kind='reminder' and mode='automatic' and actor_id is null) or
  (kind in ('welcome','schedule') and mode in ('new','all','resend') and actor_id is not null));

create table public.assignment_reminder_activation (
  singleton boolean primary key default true check(singleton),
  delivery_enabled boolean not null default false,
  baseline_at timestamptz,
  scan_cursors jsonb not null default '{}' check(jsonb_typeof(scan_cursors)='object' and octet_length(scan_cursors::text)<=32768),
  check(not delivery_enabled or baseline_at is not null)
);
insert into public.assignment_reminder_activation(singleton) values(true);
create table public.assignment_reminder_enrollments (
  assignment_id uuid primary key,
  workspace_id uuid not null,
  volunteer_id uuid not null,
  pending_anchor timestamptz,
  response_status text not null check(response_status in ('confirmed','needs_response','declined')),
  response_baseline timestamptz not null,
  start_at timestamptz not null,
  foreign key(workspace_id,assignment_id) references public.calendar_assignments(workspace_id,id),
  foreign key(workspace_id,volunteer_id) references public.volunteer_profiles(workspace_id,id),
  unique(workspace_id,assignment_id,volunteer_id)
);
create table public.assignment_reminder_occurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  assignment_id uuid not null,
  volunteer_id uuid not null,
  policy_version text not null default 'assignment-reminders.v1' check(policy_version='assignment-reminders.v1'),
  kind text not null check(kind in ('response','shift')),
  occurrence_key text not null check(occurrence_key ~ '^(pending:[1-9][0-9]{0,5}|shift:(30|14|7|3|1))$'),
  due_at timestamptz not null,
  start_at timestamptz not null,
  enrolled_at timestamptz not null,
  scheduling_state text not null default 'active' check(scheduling_state in ('active','canceled','superseded','invalid_destination','expired')),
  recipient_id uuid,
  next_attempt_at timestamptz,
  unique(workspace_id,id),
  foreign key(workspace_id,assignment_id,volunteer_id) references public.assignment_reminder_enrollments(workspace_id,assignment_id,volunteer_id),
  foreign key(workspace_id,recipient_id) references public.communication_recipients(workspace_id,id),
  unique(workspace_id,assignment_id,volunteer_id,kind,occurrence_key)
);
create table public.assignment_reminder_events (
  id bigint generated always as identity primary key,
  occurrence_id uuid not null,
  workspace_id uuid not null,
  recipient_id uuid,
  event text not null check(event in ('rescheduled','claimed','sent','failed','unknown','excluded')),
  happened_at timestamptz not null,
  due_at timestamptz not null,
  attempt integer not null default 0,
  foreign key(workspace_id,occurrence_id) references public.assignment_reminder_occurrences(workspace_id,id),
  foreign key(workspace_id,recipient_id) references public.communication_recipients(workspace_id,id)
);
-- Due queue access, independent of historical deliveries. Plan verified in local regression.
create index assignment_reminder_due on public.assignment_reminder_occurrences(workspace_id,due_at,id) where scheduling_state='active';
create index assignment_reminder_events_history on public.assignment_reminder_events(occurrence_id,id desc);
-- Measured on 10,000 historical coverage rows: 0.346ms sequential probe ->
-- 0.023ms indexed probe. Avoid repeating a history scan for new enrollments.
create index assignment_reminder_coverage_anchor on public.communication_assignment_coverage(assignment_id) where initially_unsent;
do $$ declare t text; begin
  foreach t in array array['assignment_reminder_activation','assignment_reminder_enrollments','assignment_reminder_occurrences','assignment_reminder_events'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role,project_local_reminder_worker',t);
  end loop;
end $$;

-- Safe minimal context. Never include private instructions, coworker data, or tokens.
create function public.assignment_reminder_context(p_assignment uuid,p_now timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
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
 and w.lifecycle='active' and v.lifecycle='active' and v.readiness_status='ready'
 and r.response_status in ('confirmed','needs_response')
 and public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,w.timezone)>p_now
$$;

-- Calendar-local arithmetic first. A controlled clock can exercise internal helpers locally;
-- neither the worker nor admin API accepts a caller-controlled production clock.
create function public.assignment_reminder_local_offset(p_instant timestamptz,p_zone text,p_days integer) returns timestamptz
language sql immutable security invoker set search_path='' as $$
select ((p_instant at time zone p_zone) + make_interval(days=>p_days)) at time zone p_zone
$$;

create function public.sync_assignment_reminder(p_assignment uuid,p_now timestamptz) returns void
language plpgsql security invoker set search_path='' as $$
declare c jsonb; e public.assignment_reminder_enrollments%rowtype; o record; due timestamptz;
 baseline timestamptz; anchor timestamptz; start_instant timestamptz; response_at timestamptz; n integer; d integer; k text; kind_value text; rec_state text;
begin
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

create function public.claim_assignment_reminder(p_occurrence uuid,p_now timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.assignment_reminder_occurrences%rowtype; c jsonb; r public.communication_recipients%rowtype; operation uuid; claim uuid;
begin
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
end $$;

create function public.assignment_reminder_dispatch_context(p_recipient uuid,p_claim uuid,p_now timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.assignment_reminder_occurrences%rowtype; r public.communication_recipients%rowtype; c jsonb;
begin
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

create function public.finalize_assignment_reminder(p_recipient uuid,p_claim uuid,p_outcome text,p_provider text,p_now timestamptz) returns text
language plpgsql security invoker set search_path='' as $$
declare o public.assignment_reminder_occurrences%rowtype; r public.communication_recipients%rowtype;
begin
 select * into o from public.assignment_reminder_occurrences where recipient_id=p_recipient for update;
 select * into r from public.communication_recipients where id=p_recipient for update;
 if o.id is null or r.claim_id is distinct from p_claim then raise exception 'Reminder claim unavailable.' using errcode='42501';end if;
 if r.state<>'sending' then return r.state;end if;
 if p_outcome is null or p_outcome not in ('sent','failed','unknown') or
   (p_outcome='sent' and (p_provider is null or p_provider !~ '^[A-Za-z0-9._:-]{1,200}$')) or (p_outcome<>'sent' and p_provider is not null) then raise exception 'Invalid reminder outcome.';end if;
 update public.communication_recipients set state=p_outcome,provider_message_id=p_provider,finalized_at=p_now,
   failure_code=case p_outcome when 'failed' then 'provider_rejected' when 'unknown' then 'provider_outcome_unknown' end where id=r.id;
 if p_outcome='failed' and r.attempt<3 then update public.assignment_reminder_occurrences set next_attempt_at=p_now+make_interval(mins=>case r.attempt when 1 then 5 else 10 end) where id=o.id;end if;
 insert into public.assignment_reminder_events(occurrence_id,workspace_id,recipient_id,event,happened_at,due_at,attempt) values(o.id,o.workspace_id,r.id,p_outcome,p_now,o.due_at,r.attempt);
 return p_outcome;
end $$;

create function public.assignment_reminder_report(p_workspace uuid,p_now timestamptz) returns jsonb
language sql stable security invoker set search_path='' as $$
select jsonb_build_object('enabled',(select delivery_enabled from public.assignment_reminder_activation where singleton),
 'baselineAt',(select baseline_at from public.assignment_reminder_activation where singleton),
 'rows',coalesce((select jsonb_agg(to_jsonb(t) order by t.eligible desc nulls last,t.due_at desc,t.id) from (
 select o.id,o.assignment_id,o.kind,o.occurrence_key,o.due_at,o.scheduling_state,
   coalesce(c->>'name',v.full_name) volunteer,coalesce(c->>'title',i.title_snapshot) assignment,
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
 from public.assignment_reminder_occurrences o
 join public.volunteer_profiles v on v.id=o.volunteer_id and v.workspace_id=o.workspace_id
 join public.calendar_assignments a on a.id=o.assignment_id and a.workspace_id=o.workspace_id
 join public.calendar_items i on i.id=a.calendar_item_id and i.workspace_id=o.workspace_id
 join public.assignment_responses ar on ar.assignment_id=a.id
 left join public.communication_recipients r on r.id=o.recipient_id
 left join lateral (select public.assignment_reminder_context(o.assignment_id,p_now) c) ctx on true
 where o.workspace_id=p_workspace order by eligible desc nulls last,o.due_at desc,o.id limit 200) t),'[]'))
$$;

create function public.read_assignment_reminders(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.communication_actor(p_workspace_id);
 return public.assignment_reminder_report(p_workspace_id,statement_timestamp());
end $$;

-- One RPC capability for a non-login system role. No access to ordinary admin RPCs
-- or direct tables. No activation command and no caller-supplied clock.
create function public.run_assignment_reminder_worker(p_command text,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare clock_at timestamptz:=statement_timestamp(); w uuid; cursor_id uuid; a record; ids jsonb; count_value integer:=0;
begin
 if octet_length(p_payload::text)>4096 then raise exception 'Invalid worker request.';end if;
 if p_command='status' then
   return jsonb_build_object('enabled',(select delivery_enabled from public.assignment_reminder_activation where singleton),
    'workspaces',(select coalesce(jsonb_agg(id),'[]') from (select id from public.workspaces where lifecycle='active' order by id limit 20) w));
 elsif p_command='sync' then
   w:=(p_payload->>'workspaceId')::uuid;
   select coalesce((p_payload->>'after')::uuid,(scan_cursors->>w::text)::uuid) into cursor_id from public.assignment_reminder_activation where singleton for update;
   if not exists(select 1 from public.workspaces where id=w and lifecycle='active') then raise exception 'Workspace unavailable.';end if;
   -- Items are bounded to future dates by the existing workspace/start_date index;
   -- cursor pages prevent a large active roster from starving later assignments.
   for a in with future_items as materialized (
     select id from public.calendar_items where workspace_id=w and lifecycle='active' and publication_state='published'
       and start_date>=(clock_at at time zone (select timezone from public.workspaces where id=w))::date
   ) select a.id from future_items i cross join lateral (
     select id from public.calendar_assignments where workspace_id=w and calendar_item_id=i.id and lifecycle='active'
       and (cursor_id is null or id>cursor_id) order by id limit 200
   ) a order by a.id limit 200 loop
       perform public.sync_assignment_reminder(a.id,clock_at);cursor_id:=a.id;count_value:=count_value+1;
   end loop;
   update public.assignment_reminder_activation set scan_cursors=case when count_value=200 then jsonb_set(scan_cursors,array[w::text],to_jsonb(cursor_id)) else scan_cursors-w::text end where singleton;
   return jsonb_build_object('evaluated',count_value,'after',case when count_value=200 then cursor_id end);
 elsif p_command='preview' then
   return public.assignment_reminder_report((p_payload->>'workspaceId')::uuid,clock_at);
 elsif p_command='due' then
   select coalesce(jsonb_agg(id),'[]') into ids from (select o.id from public.assignment_reminder_occurrences o
    left join public.communication_recipients r on r.id=o.recipient_id where o.workspace_id=(p_payload->>'workspaceId')::uuid and o.scheduling_state='active'
    and o.due_at between clock_at-interval '15 minutes' and clock_at and coalesce(o.next_attempt_at,o.due_at)<=clock_at
    and coalesce(r.state,'ready') in ('ready','failed') and coalesce(r.attempt,0)<3 order by o.due_at,o.id limit 20) q;
   return ids;
 elsif p_command='claim' then return public.claim_assignment_reminder((p_payload->>'occurrenceId')::uuid,clock_at);
 elsif p_command='revalidate' then return public.assignment_reminder_dispatch_context((p_payload->>'recipientId')::uuid,(p_payload->>'claimId')::uuid,clock_at);
 elsif p_command='finalize' then return to_jsonb(public.finalize_assignment_reminder((p_payload->>'recipientId')::uuid,(p_payload->>'claimId')::uuid,p_payload->>'outcome',p_payload->>'providerId',clock_at));
 end if;
 raise exception 'Unknown reminder worker command.' using errcode='22023';
end $$;

-- Keep admin claims/finalization from crossing the new system-owned boundary.
do $$ declare definition text; original text; signature text; begin
 foreach signature in array array['claim_communication_recipient(uuid,boolean)','finalize_communication_recipient(uuid,uuid,text,text,text)'] loop
   select pg_get_functiondef(('public.'||signature)::regprocedure) into definition;original:=definition;
   definition:=replace(definition,'begin',E'begin\n  if exists(select 1 from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id where r.id=p_recipient_id and o.kind=''reminder'') then raise exception ''System-owned reminder.'' using errcode=''42501'';end if;');
   if definition=original then raise exception 'Manual Communications guard target missing.';end if;
   execute definition;
 end loop;
end $$;

-- Reminders have their own progressive history projection and no manual resend UI.
do $$ declare definition text; original text; begin
 select pg_get_functiondef('public.read_communication_history(uuid)'::regprocedure) into definition;original:=definition;
 definition:=replace(definition,'where o.workspace_id=p_workspace_id order by', 'where o.workspace_id=p_workspace_id and o.kind<>''reminder'' order by');
 if original=definition then raise exception 'Communication history guard target missing.';end if;
 execute definition;
end $$;

-- Exact grants, no default PUBLIC execution and no implicit service-role worker.
do $$ declare s text; begin
 foreach s in array array['assignment_reminder_context(uuid,timestamp with time zone)',
 'assignment_reminder_local_offset(timestamp with time zone,text,integer)','sync_assignment_reminder(uuid,timestamp with time zone)',
 'claim_assignment_reminder(uuid,timestamp with time zone)','assignment_reminder_dispatch_context(uuid,uuid,timestamp with time zone)',
 'finalize_assignment_reminder(uuid,uuid,text,text,timestamp with time zone)','assignment_reminder_report(uuid,timestamp with time zone)',
 'read_assignment_reminders(uuid)','run_assignment_reminder_worker(text,jsonb)'] loop
   execute 'alter function public.'||s||' owner to postgres';
   execute 'revoke all on function public.'||s||' from public,anon,authenticated,service_role,project_local_reminder_worker';
 end loop;
end $$;
grant execute on function public.read_assignment_reminders(uuid) to authenticated,service_role;
grant execute on function public.run_assignment_reminder_worker(text,jsonb) to project_local_reminder_worker;
commit;
