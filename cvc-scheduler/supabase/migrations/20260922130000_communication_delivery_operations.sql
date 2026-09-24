-- 12.47. Local draft: explicit reviewed operations, never automatic delivery.
begin;
create table public.communication_operations (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  actor_id uuid not null references public.project_contacts(id) on delete restrict,
  kind text not null check(kind in ('welcome','schedule')),
  mode text not null check(mode in ('new','all','resend')),
  plan jsonb not null,
  created_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create table public.communication_recipients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  operation_id uuid not null,
  volunteer_id uuid not null,
  email text not null check(length(email) between 3 and 254 and email=lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  snapshot jsonb not null,
  state text not null default 'ready' check(state in ('ready','sending','sent','failed','unknown','excluded')),
  attempt integer not null default 0 check(attempt between 0 and 25),
  claim_id uuid,
  claimed_by uuid references public.project_contacts(id) on delete restrict,
  claimed_at timestamptz,
  finalized_at timestamptz,
  provider_message_id text check(provider_message_id is null or provider_message_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  failure_code text check(failure_code is null or failure_code in ('provider_rejected','provider_outcome_unknown','schedule_access_unavailable','eligibility_changed')),
  foreign key(workspace_id,operation_id) references public.communication_operations(workspace_id,id) on delete restrict,
  foreign key(workspace_id,volunteer_id) references public.volunteer_profiles(workspace_id,id) on delete restrict,
  unique(operation_id,volunteer_id), unique(operation_id,email), unique(workspace_id,id)
);
create table public.communication_assignment_coverage (
  workspace_id uuid not null,
  recipient_id uuid not null,
  assignment_id uuid not null,
  initially_unsent boolean not null,
  foreign key(workspace_id,recipient_id) references public.communication_recipients(workspace_id,id) on delete restrict,
  foreign key(workspace_id,assignment_id) references public.calendar_assignments(workspace_id,id) on delete restrict,
  primary key(recipient_id,assignment_id)
);
create table public.volunteer_welcome_deliveries (
  workspace_id uuid not null,
  volunteer_id uuid not null,
  campaign text not null check(campaign='project-welcome.v1'),
  recipient_id uuid not null,
  email text not null,
  sent_at timestamptz not null default now(),
  foreign key(workspace_id,volunteer_id) references public.volunteer_profiles(workspace_id,id) on delete restrict,
  foreign key(workspace_id,recipient_id) references public.communication_recipients(workspace_id,id) on delete restrict,
  primary key(workspace_id,volunteer_id,campaign)
);
create index communication_recipients_pending on public.communication_recipients(workspace_id,volunteer_id,state);
alter table public.assignment_notification_deliveries add column communication_recipient_id uuid;
alter table public.assignment_notification_deliveries add constraint notification_communication_recipient_fk
  foreign key(workspace_id,communication_recipient_id) references public.communication_recipients(workspace_id,id) on delete restrict;
do $$ declare t text; begin
  foreach t in array array['communication_operations','communication_recipients','communication_assignment_coverage','volunteer_welcome_deliveries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
end $$;

-- Shared internal capability check, invoked only under reviewed definers.
create function public.communication_actor(p_workspace uuid) returns uuid language plpgsql security invoker set search_path='' as $$
declare actor uuid;
begin
  select c.id into actor from public.project_contacts c
    join public.workspace_contact_grants g on g.project_contact_id=c.id
    join public.workspaces w on w.id=g.workspace_id
    where c.auth_user_id=auth.uid() and c.status='active' and w.lifecycle='active'
      and g.workspace_id=p_workspace and g.status='active' and g.revoked_at is null
      and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
      and g.capabilities @> array['workspace.read','volunteers.view','volunteers.edit','calendar.view','assignments.view','assignments.edit']::text[];
  if actor is null then raise exception 'Communications unavailable.' using errcode='42501'; end if;
  return actor;
end $$;

create function public.communication_preview(p_workspace uuid,p_plan jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  person record; entries jsonb; recipient jsonb;
  recipients jsonb:='[]'; exclusions jsonb:='[]';
  selected_kind text:=p_plan->>'kind'; selected_mode text:=p_plan->>'mode';
  ids uuid[]; start_day date; end_day date; reason text;
  previous_email text; busy boolean; new_count integer; old_count integer;
  workspace_name text; excluded_count integer:=0;
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
    or exists(select 1 from unnest(ids) requested(id) where not exists(select 1 from public.volunteer_profiles v where v.id=requested.id and v.workspace_id=p_workspace))
  then raise exception 'Invalid recipient selection.' using errcode='42501'; end if;
  if selected_kind='schedule' then
    start_day:=(p_plan->>'startDate')::date; end_day:=(p_plan->>'endDate')::date;
    if start_day is null or end_day is null or end_day<start_day or end_day-start_day>366 then
      raise exception 'Choose a date range of up to one year.' using errcode='22023'; end if;
  end if;
  select display_name into workspace_name from public.workspaces where id=p_workspace;
  for person in select id,full_name,lower(nullif(btrim(email),'')) email,updated_at
    from public.volunteer_profiles where workspace_id=p_workspace and lifecycle='active'
      and (cardinality(ids)=0 or id=any(ids)) order by full_name,id limit 501 loop
    if jsonb_array_length(recipients)+jsonb_array_length(exclusions)>=500 then
      raise exception 'Choose at most 500 volunteers to preview.' using errcode='22023'; end if;
    reason:=null; entries:='[]'; previous_email:=null;
    select email into previous_email from public.volunteer_welcome_deliveries
      where workspace_id=p_workspace and volunteer_id=person.id and campaign='project-welcome.v1';
    select exists(select 1 from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id
      where r.workspace_id=p_workspace and r.volunteer_id=person.id and o.kind=selected_kind and r.state in ('ready','sending','unknown','failed')) into busy;
    if person.email is null or person.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then reason:='missing_email';
    elsif exists(select 1 from public.volunteer_profiles v where v.workspace_id=p_workspace and v.id<>person.id
      and v.lifecycle='active' and lower(btrim(v.email))=person.email) then reason:='shared_email_requires_review';
    elsif busy then reason:='pending_or_unknown_delivery';
    elsif selected_kind='welcome' and previous_email is not null and selected_mode<>'resend' then
      reason:=case when previous_email=person.email then 'already_welcomed' else 'email_changed_requires_resend_review' end;
    end if;
    if selected_kind='schedule' then
      select coalesce(jsonb_agg(jsonb_build_object('assignmentId',a.id,'itemId',i.id,
        'date',i.start_date,'title',i.title_snapshot,'startTime',i.start_time,'endTime',i.end_time,
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
      'excludedAssignments',excluded_count,'emailChanged',previous_email is not null and previous_email<>person.email,
      'deliveryRevision',(select md5(coalesce(jsonb_agg(jsonb_build_array(r.id,r.state,r.attempt) order by r.id)::text,'[]'))
        from public.communication_recipients r where r.workspace_id=p_workspace and r.volunteer_id=person.id));
    if reason is null then recipients:=recipients||jsonb_build_array(recipient);
    else exclusions:=exclusions||jsonb_build_array(jsonb_build_object('volunteerId',person.id,'name',person.full_name,'reason',reason,'excludedAssignments',excluded_count)); end if;
  end loop;
  return jsonb_build_object('workspaceName',workspace_name,'kind',selected_kind,'mode',selected_mode,'recipients',recipients,'exclusions',exclusions,'plan',p_plan);
end $$;

create function public.review_communications(p_workspace_id uuid,p_plan jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  result:=public.communication_preview(p_workspace_id,p_plan);
  return result||jsonb_build_object('fingerprint',md5(result::text));
end $$;

create function public.confirm_communication_operation(p_workspace_id uuid,p_operation_id uuid,p_plan jsonb,p_expected_preview text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; preview jsonb; person jsonb; assignment jsonb; recipient uuid; existing public.communication_operations%rowtype;
begin
  actor:=public.communication_actor(p_workspace_id);
  if p_operation_id is null or p_expected_preview is null then raise exception 'Review recipients before sending.' using errcode='22023'; end if;
  perform 1 from public.workspaces where id=p_workspace_id for update;
  select * into existing from public.communication_operations where id=p_operation_id;
  if found then
    if existing.workspace_id<>p_workspace_id or existing.actor_id<>actor or existing.plan<>p_plan then
      raise exception 'Operation ID already used.' using errcode='42501'; end if;
    return existing.id;
  end if;
  preview:=public.communication_preview(p_workspace_id,p_plan);
  if md5(preview::text)<>p_expected_preview then raise exception 'Recipients changed. Review the latest preview.' using errcode='40001'; end if;
  if jsonb_array_length(preview->'recipients')>200 then raise exception 'Select at most 200 recipients per operation.' using errcode='22023'; end if;
  if jsonb_array_length(preview->'recipients')=0 then raise exception 'No eligible recipients.' using errcode='22023'; end if;
  insert into public.communication_operations(id,workspace_id,actor_id,kind,mode,plan)
    values(p_operation_id,p_workspace_id,actor,p_plan->>'kind',p_plan->>'mode',p_plan);
  for person in select value from jsonb_array_elements(preview->'recipients') loop
    insert into public.communication_recipients(workspace_id,operation_id,volunteer_id,email,snapshot)
      values(p_workspace_id,p_operation_id,(person->>'volunteerId')::uuid,person->>'email',
        person||jsonb_build_object('workspaceName',preview->>'workspaceName','kind',p_plan->>'kind','mode',p_plan->>'mode')) returning id into recipient;
    for assignment in select value from jsonb_array_elements(person->'assignments') loop
      insert into public.communication_assignment_coverage(workspace_id,recipient_id,assignment_id,initially_unsent)
        values(p_workspace_id,recipient,(assignment->>'assignmentId')::uuid,coalesce((assignment->>'delivered')::boolean,false)=false);
      if coalesce((assignment->>'delivered')::boolean,false)=false then
        -- Infinity deliberately blocks the legacy claim RPC. Only this operation
        -- may finalize/retry its own rows; no lease expiry silently sends again.
        insert into public.assignment_notification_deliveries(workspace_id,calendar_item_id,calendar_assignment_id,
          volunteer_profile_id,delivery_state,recipient_email_snapshot,idempotency_key,initiated_by_project_contact_id,
          sending_started_at,sending_expires_at,communication_recipient_id)
          values(p_workspace_id,(assignment->>'itemId')::uuid,(assignment->>'assignmentId')::uuid,
            (person->>'volunteerId')::uuid,'sending',person->>'email',
            'initial_assignment:initial-assignment.v1:'||(assignment->>'assignmentId'),actor,now(),'infinity',recipient)
          on conflict(calendar_assignment_id,notification_kind,template_version) do update
            set communication_recipient_id=excluded.communication_recipient_id,recipient_email_snapshot=excluded.recipient_email_snapshot,
              initiated_by_project_contact_id=excluded.initiated_by_project_contact_id,sending_started_at=now(),sending_expires_at='infinity'
            where public.assignment_notification_deliveries.delivery_state<>'sent' and exists(select 1 from public.communication_recipients prior
              where prior.id=public.assignment_notification_deliveries.communication_recipient_id and prior.state='excluded');
        if not found then raise exception 'Delivery ownership changed. Review again.' using errcode='40001'; end if;
      end if;
    end loop;
  end loop;
  return p_operation_id;
exception when unique_violation then raise exception 'Recipients changed. Review the latest preview.' using errcode='40001';
end $$;

create function public.claim_communication_recipient(p_recipient_id uuid,p_retry boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.communication_recipients%rowtype; actor uuid; operation public.communication_operations%rowtype;
  claim uuid; current_email text; valid boolean;
begin
  select * into row from public.communication_recipients where id=p_recipient_id;
  actor:=public.communication_actor(row.workspace_id);
  perform 1 from public.workspaces where id=row.workspace_id for update;
  select * into row from public.communication_recipients where id=p_recipient_id for update;
  if row.state<>'ready' and not (p_retry is true and row.state='failed') then return null; end if;
  if row.attempt>=25 then return null; end if;
  select * into operation from public.communication_operations where id=row.operation_id;
  select lower(btrim(email)) into current_email from public.volunteer_profiles
    where id=row.volunteer_id and workspace_id=row.workspace_id and lifecycle='active' for share;
  valid:=current_email is not null and current_email=row.email;
  if exists(select 1 from public.volunteer_profiles v where v.workspace_id=row.workspace_id
    and v.id<>row.volunteer_id and v.lifecycle='active' and lower(btrim(v.email))=row.email) then valid:=false; end if;
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

create function public.finalize_communication_recipient(p_recipient_id uuid,p_claim_id uuid,p_outcome text,p_provider_id text,p_failure_code text) returns text
language plpgsql security definer set search_path='' as $$
declare row public.communication_recipients%rowtype; actor uuid; operation_kind text;
begin
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
      insert into public.volunteer_welcome_deliveries(workspace_id,volunteer_id,campaign,recipient_id,email)
        values(row.workspace_id,row.volunteer_id,'project-welcome.v1',row.id,row.email)
        on conflict(workspace_id,volunteer_id,campaign) do update set recipient_id=excluded.recipient_id,email=excluded.email,sent_at=now();
    end if;
  end if;
  return p_outcome;
end $$;

create function public.read_communication_history(p_workspace_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.communication_actor(p_workspace_id);
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.recipient_id) from (
    select o.id operation_id,o.kind,o.mode,o.created_at,r.id recipient_id,r.volunteer_id,r.snapshot->>'name' name,
      r.email,r.state,r.attempt,r.failure_code,r.claimed_at,r.finalized_at,
      jsonb_array_length(r.snapshot->'assignments') assignment_count
    from public.communication_operations o join public.communication_recipients r on r.operation_id=o.id
    where o.workspace_id=p_workspace_id order by o.created_at desc,r.id limit 1000
  ) r),'[]');
end $$;

do $$ declare signature text; begin
  foreach signature in array array['communication_actor(uuid)','communication_preview(uuid,jsonb)',
    'review_communications(uuid,jsonb)','confirm_communication_operation(uuid,uuid,jsonb,text)',
    'claim_communication_recipient(uuid,boolean)','finalize_communication_recipient(uuid,uuid,text,text,text)','read_communication_history(uuid)'] loop
    execute 'alter function public.'||signature||' owner to postgres';
    execute 'revoke all on function public.'||signature||' from public,anon,authenticated,service_role';
    if signature not in ('communication_actor(uuid)','communication_preview(uuid,jsonb)') then
      execute 'grant execute on function public.'||signature||' to authenticated,service_role';
    end if;
  end loop;
end $$;
commit;
