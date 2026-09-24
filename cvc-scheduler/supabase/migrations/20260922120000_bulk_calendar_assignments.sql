-- 12.47 Phase 1. Local-only until reviewed. Existing item/assignment RPCs remain
-- authoritative; this operation composes them in one transaction.
begin;

create table public.calendar_bulk_assignment_operations (
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  request_id uuid not null,
  actor_id uuid not null references public.project_contacts(id) on delete restrict,
  plan jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, request_id)
);
alter table public.calendar_bulk_assignment_operations enable row level security;
alter table public.calendar_bulk_assignment_operations force row level security;
revoke all on public.calendar_bulk_assignment_operations from public, anon, authenticated;

create function public.plan_calendar_assignments(
  p_workspace_id uuid, p_request_id uuid, p_plan jsonb, p_expected_preview text
) returns jsonb language plpgsql security definer set search_path = '' as $$
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
      and lifecycle='active' and readiness_status='ready';
  if coalesce(jsonb_array_length(volunteers_preview),0)<>cardinality(volunteer_ids) then
    raise exception 'Volunteer selection unavailable.' using errcode='42501';
  end if;

  creation:=p_plan->'create';
  if creation is not null and creation <> 'null'::jsonb then
    if jsonb_typeof(creation)<>'object' or coalesce(p_plan->'itemIds','[]')<>'[]'
      or (creation-array['presetId','title','taskType','startDate','endDate','weekdays','startTime','endTime','neededCount','notes','customValues','meal'])<>'{}'
      or not exists(select 1 from public.workspace_contact_grants g where g.project_contact_id=actor
        and g.workspace_id=p_workspace_id and g.status='active' and g.revoked_at is null
        and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now())
        and g.capabilities @> array['workspace.read','calendar.edit']::text[])
    then raise exception 'Creation unavailable.' using errcode='42501'; end if;
    if (creation->>'startDate')::date is null or (creation->>'endDate')::date is null
      or (creation->>'endDate')::date < (creation->>'startDate')::date
      or (creation->>'endDate')::date - (creation->>'startDate')::date > 366
      or (creation->>'startTime')::time is null or (creation->>'endTime')::time is null
      or (creation->>'endTime')::time <= (creation->>'startTime')::time
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
        'startTime',creation->>'startTime','endTime',creation->>'endTime',
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
        'startTime',current_item.start_time,'endTime',current_item.end_time,
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
  -- Same-day work is a warning, not a new capacity/publication rule.
  select coalesce(jsonb_agg(jsonb_build_object('volunteerId',a.volunteer_profile_id,
    'date',i.start_date,'title',i.title_snapshot,'assignmentId',a.id,'version',a.updated_at,
    'itemVersion',i.updated_at) order by a.id),'[]') into conflicts_preview
    from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id
    where a.workspace_id=p_workspace_id and a.volunteer_profile_id=any(volunteer_ids)
      and a.lifecycle='active' and i.lifecycle='active' and i.start_date=any(days)
      and not i.id=any(item_ids)
      and (i.publication_state='published' or i.created_by_project_contact_id=actor);
  preview:=jsonb_build_object('items',items_preview,'volunteers',volunteers_preview,
    'existingAssignments',existing_preview,'sameDayWork',conflicts_preview,'plan',p_plan);
  fingerprint:=md5(preview::text);
  if p_expected_preview is null then return preview || jsonb_build_object('fingerprint',fingerprint,'saved',false); end if;
  if p_expected_preview<>fingerprint then
    raise exception 'This selection changed. Review the latest preview.' using errcode='40001'; end if;

  if creation is not null and creation<>'null'::jsonb then
    if exists(select 1 from public.calendar_repeat_creation_requests where workspace_id=p_workspace_id and request_key=p_request_id) then
      raise exception 'Request already used.' using errcode='22023'; end if;
    created_ids:=public.create_current_workspace_repeated_calendar_items(p_request_id,
      (creation->>'presetId')::uuid,creation->>'title',creation->>'taskType',
      (creation->>'startDate')::date,(creation->>'endDate')::date,weekdays,
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
alter function public.plan_calendar_assignments(uuid,uuid,jsonb,text) owner to postgres;
revoke all on function public.plan_calendar_assignments(uuid,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.plan_calendar_assignments(uuid,uuid,jsonb,text) to authenticated,service_role;
commit;
