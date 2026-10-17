begin;

-- Add only coworker display names to the existing token-scoped volunteer schedule read.
-- Keep all existing token checks, assignment filtering, and grants.
drop function public.read_volunteer_schedule(text);
create function public.read_volunteer_schedule(p_bearer_token text)
returns table (
  schedule_state text,
  workspace_display_name text,
  workspace_timezone text,
  volunteer_display_name text,
  assignment_reference uuid,
  task_title text,
  task_type text,
  schedule_kind text,
  start_date date,
  end_date date,
  start_time time without time zone,
  end_time time without time zone,
  needed_count integer,
  schedule_notes text,
  current_response_status text,
  response_note text,
  can_confirm boolean,
  can_decline boolean,
  response_locked boolean,
  response_lock_reason text,
  active_assigned_count integer,
  confirmed_count integer,
  declined_count integer,
  follow_up_contact_display_name text,
  follow_up_contact_email text,
  follow_up_contact_phone text,
  meal_details jsonb,
  fellow_worker_names text[]
)
language plpgsql
security definer
set search_path = ''
as $$
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
    and volunteer.lifecycle = 'active'
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
      and fellow_profile.lifecycle = 'active'
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
$$;
revoke all on function public.read_volunteer_schedule(text) from public;
grant execute on function public.read_volunteer_schedule(text) to anon, authenticated, service_role;

commit;
