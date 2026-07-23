-- Iteration 12.21: volunteer Confirm/Deny round trip from account-light schedules.
-- This adds response mutation boundaries for existing volunteer schedule credentials
-- and tightens assignment-response bearer submissions with the same start/cutoff
-- policy. It does not add email, lookup, remembered devices, response-link reveal,
-- assignment-detail entry links, publication changes, or service-role product paths.

create or replace function public.calendar_assignment_response_start_at(
  p_schedule_kind text,
  p_start_date date,
  p_start_time time without time zone,
  p_timezone text
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_start_date is null or p_timezone is null then null::timestamptz
    when p_schedule_kind = 'timed' and p_start_time is not null
      then (p_start_date + p_start_time) at time zone p_timezone
    when p_schedule_kind in ('date_based', 'multi_day_window', 'milestone')
      then (p_start_date::timestamp) at time zone p_timezone
    else null::timestamptz
  end;
$$;

comment on function public.calendar_assignment_response_start_at(text, date, time without time zone, text) is
  'Trusted helper for volunteer response cutoffs. The database derives assignment start instants from persisted Calendar item fields and workspace/item timezone.';

revoke all on function public.calendar_assignment_response_start_at(text, date, time without time zone, text) from public;

alter table public.assignment_responses
  drop constraint assignment_responses_source_known,
  add constraint assignment_responses_source_known check (
    response_source in ('project_contact', 'public_token', 'volunteer_schedule')
  );

comment on column public.assignment_responses.response_source is
  'Current response provenance: project_contact for admin actions, public_token for assignment_response_tokens, volunteer_schedule for account-light /v/schedule credentials.';

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
  follow_up_contact_phone text
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
      null::text;
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
      null::text;
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
      null::text
    from public.workspaces as workspace
    join public.volunteer_profiles as volunteer
      on volunteer.workspace_id = workspace.id
    where workspace.id = verified_workspace_id
      and volunteer.id = verified_volunteer_profile_id;
    return;
  end if;

  return query
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
    item.schedule_notes,
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
    null::text,
    null::text,
    null::text
  from public.calendar_assignments as assignment
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

drop function if exists public.submit_volunteer_schedule_assignment_response(text, uuid, text, text);

create function public.submit_volunteer_schedule_assignment_response(
  p_bearer_token text,
  p_assignment_id uuid,
  p_response_status text,
  p_response_note text
)
returns table (
  assignment_reference uuid,
  current_response_status text,
  response_note text,
  response_recorded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_token_id uuid;
  verified_assignment_id uuid;
  existing_response_status text;
  existing_response_note text;
  assignment_start_at timestamptz;
  normalized_note text;
  recorded_at timestamptz;
begin
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
    and volunteer.lifecycle = 'active'
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
$$;

drop function if exists public.confirm_all_volunteer_schedule_assignments(text);

create function public.confirm_all_volunteer_schedule_assignments(p_bearer_token text)
returns table (
  confirmed_count integer,
  response_recorded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_token_id uuid;
  verified_workspace_id uuid;
  verified_volunteer_profile_id uuid;
  eligible_count integer;
  recorded_at timestamptz;
begin
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
    and volunteer.lifecycle = 'active'
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
$$;

create or replace function public.submit_assignment_response_by_token(
  p_bearer_token text,
  p_response_status text,
  p_response_note text
)
returns table (
  assignment_reference uuid,
  current_response_status text,
  response_recorded_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_token_id uuid;
  verified_assignment_id uuid;
  existing_response_status text;
  assignment_start_at timestamptz;
  recorded_at timestamptz;
begin
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
    and volunteer.lifecycle = 'active'
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
$$;

revoke all on function public.read_volunteer_schedule(text) from public;
grant execute on function public.read_volunteer_schedule(text) to anon, authenticated;
revoke all on function public.submit_volunteer_schedule_assignment_response(text, uuid, text, text) from public;
grant execute on function public.submit_volunteer_schedule_assignment_response(text, uuid, text, text) to anon, authenticated;
revoke all on function public.confirm_all_volunteer_schedule_assignments(text) from public;
grant execute on function public.confirm_all_volunteer_schedule_assignments(text) to anon, authenticated;
revoke all on function public.submit_assignment_response_by_token(text, text, text) from public;
grant execute on function public.submit_assignment_response_by_token(text, text, text) to anon, authenticated;
