-- 12.58: additive admin read only. No engine, table, index or delivery changes.
begin;
create function public.read_assignment_reminder_workspace(
  p_workspace_id uuid, p_view text default 'summary', p_search text default null,
  p_cursor jsonb default null, p_limit integer default 25
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
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
      and v.lifecycle='active' and v.readiness_status='ready'
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
      and v.lifecycle='active' and v.readiness_status='ready'
      and ar.response_status=case o.kind when 'response' then 'needs_response' else 'confirmed' end
      and o.start_at=public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,zone)
      and coalesce(r.state,'ready') in ('ready','failed') and coalesce(r.attempt,0)<3;
    -- Actual processing only. Rescheduling by itself is not a delivery attempt.
    with activity as (
      select o.id,o.occurrence_key,v.full_name volunteer,i.title_snapshot assignment,
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
      select o.id,o.assignment_id,o.volunteer_id,v.full_name volunteer,i.title_snapshot assignment,
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
        and v.lifecycle='active' and v.readiness_status='ready'
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
      select o.id,o.assignment_id,o.volunteer_id,v.full_name volunteer,i.title_snapshot assignment,
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
      select a.id,a.id assignment_id,v.id volunteer_id,v.full_name volunteer,i.title_snapshot assignment,
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
      join public.volunteer_profiles v on v.id=a.volunteer_profile_id and v.workspace_id=a.workspace_id
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
end $$;
alter function public.read_assignment_reminder_workspace(uuid,text,text,jsonb,integer) owner to postgres;
revoke all on function public.read_assignment_reminder_workspace(uuid,text,text,jsonb,integer) from public,anon,authenticated,service_role,project_local_reminder_worker,project_local_reminder_runner;
grant execute on function public.read_assignment_reminder_workspace(uuid,text,text,jsonb,integer) to authenticated,service_role;
commit;
