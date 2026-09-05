-- Iteration 12.44F.4A: authoritative project dates, safe volunteer cleanup,
-- and one-shot repeat scheduling. Every command resolves a current authorized
-- workspace from Auth; browser-provided workspace scope is never trusted.

create table public.calendar_repeat_creation_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  request_key uuid not null,
  created_by_project_contact_id uuid not null references public.project_contacts (id) on delete restrict,
  created_item_ids uuid[] not null,
  created_at timestamptz not null default now(),
  constraint calendar_repeat_creation_requests_workspace_key_unique unique (workspace_id, request_key),
  constraint calendar_repeat_creation_requests_item_count_valid check (
    cardinality(created_item_ids) between 1 and 100
  )
);

alter table public.calendar_repeat_creation_requests enable row level security;
alter table public.calendar_repeat_creation_requests force row level security;
revoke all privileges on table public.calendar_repeat_creation_requests from anon, authenticated, public;

create function public.update_current_workspace_project_dates(
  p_starts_on date,
  p_ends_on date
)
returns table (
  starts_on date,
  ends_on date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  target_workspace_ids uuid[];
  target_workspace_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_starts_on is null
    or p_ends_on is null
    or p_starts_on > p_ends_on
  then
    raise exception 'Project dates cannot be updated.' using errcode = '42501';
  end if;

  select array_agg(distinct grant_row.workspace_id)
  into target_workspace_ids
  from public.workspace_contact_grants as grant_row
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  join public.workspaces as workspace
    on workspace.id = grant_row.workspace_id
  where contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and workspace.lifecycle = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['workspace.read', 'calendar.edit']::text[];

  if coalesce(array_length(target_workspace_ids, 1), 0) <> 1 then
    raise exception 'Project dates cannot be updated.' using errcode = '42501';
  end if;

  target_workspace_id := target_workspace_ids[1];

  return query
  update public.workspaces as workspace
  set starts_on = p_starts_on,
      ends_on = p_ends_on
  where workspace.id = target_workspace_id
    and workspace.lifecycle = 'active'
  returning workspace.starts_on, workspace.ends_on;

  if not found then
    raise exception 'Project dates cannot be updated.' using errcode = '42501';
  end if;
end;
$$;

create function public.delete_history_free_volunteer_profile(
  p_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  target_workspace_id uuid;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null or p_profile_id is null then
    raise exception 'Volunteer deletion is unavailable.' using errcode = '42501';
  end if;

  select profile.workspace_id
  into target_workspace_id
  from public.volunteer_profiles as profile
  where profile.id = p_profile_id
  for update;

  if target_workspace_id is null
    or not exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      join public.workspaces as workspace
        on workspace.id = grant_row.workspace_id
      where grant_row.workspace_id = target_workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and workspace.lifecycle = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['volunteers.edit']::text[]
    )
  then
    raise exception 'Volunteer deletion is unavailable.' using errcode = '42501';
  end if;

  -- An assignment preserves every downstream response, delivery, and
  -- assignment-response-token relationship. A schedule-access credential also
  -- preserves a volunteer-specific access history even without an assignment.
  if exists (
    select 1 from public.calendar_assignments
    where workspace_id = target_workspace_id and volunteer_profile_id = p_profile_id
  ) or exists (
    select 1 from public.volunteer_schedule_access_tokens
    where workspace_id = target_workspace_id and volunteer_profile_id = p_profile_id
  ) then
    return 'has_history';
  end if;

  begin
    delete from public.volunteer_profiles
    where id = p_profile_id and workspace_id = target_workspace_id;
  exception when foreign_key_violation then
    -- A newly introduced protected dependency must fail closed rather than
    -- cascade meaningful scheduling history away.
    return 'has_history';
  end;

  if not found then
    raise exception 'Volunteer deletion is unavailable.' using errcode = '42501';
  end if;

  return 'deleted';
end;
$$;

create function public.create_current_workspace_repeated_calendar_items(
  p_request_key uuid,
  p_task_preset_id uuid,
  p_one_off_title text,
  p_one_off_task_type text,
  p_start_date date,
  p_end_date date,
  p_weekdays smallint[],
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_needed_count integer,
  p_schedule_notes text,
  p_custom_values jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  target_workspace_ids uuid[];
  target_contact_ids uuid[];
  target_workspace_id uuid;
  actor_project_contact_id uuid;
  target_timezone text;
  item_title text;
  item_task_type text;
  generated_dates date[];
  created_ids uuid[];
  normalized_weekdays smallint[];
begin
  caller_user_id := auth.uid();
  if caller_user_id is null
    or p_request_key is null
    or p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
    or p_needed_count not between 0 and 99
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
  then
    raise exception 'Repeat scheduling is unavailable.' using errcode = '42501';
  end if;

  select array_agg(distinct grant_row.workspace_id), array_agg(distinct contact.id)
  into target_workspace_ids, target_contact_ids
  from public.workspace_contact_grants as grant_row
  join public.project_contacts as contact on contact.id = grant_row.project_contact_id
  join public.workspaces as workspace on workspace.id = grant_row.workspace_id
  where contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and workspace.lifecycle = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['workspace.read', 'calendar.edit']::text[];

  if coalesce(array_length(target_workspace_ids, 1), 0) <> 1
    or coalesce(array_length(target_contact_ids, 1), 0) <> 1
  then
    raise exception 'Repeat scheduling is unavailable.' using errcode = '42501';
  end if;

  target_workspace_id := target_workspace_ids[1];
  actor_project_contact_id := target_contact_ids[1];

  select workspace.timezone into target_timezone
  from public.workspaces as workspace
  where workspace.id = target_workspace_id and workspace.lifecycle = 'active';

  select array_agg(distinct weekday order by weekday)
  into normalized_weekdays
  from unnest(coalesce(p_weekdays, array[]::smallint[])) as selected(weekday)
  where weekday between 0 and 6;

  if target_timezone is null
    or coalesce(cardinality(normalized_weekdays), 0) <> coalesce(cardinality(p_weekdays), 0)
    or coalesce(cardinality(normalized_weekdays), 0) = 0
  then
    raise exception 'Repeat scheduling is unavailable.' using errcode = '42501';
  end if;

  select request.created_item_ids into created_ids
  from public.calendar_repeat_creation_requests as request
  where request.workspace_id = target_workspace_id and request.request_key = p_request_key;
  if created_ids is not null then
    return created_ids;
  end if;

  if p_task_preset_id is not null then
    if p_one_off_title is not null or p_one_off_task_type is not null then
      raise exception 'Repeat scheduling task source is invalid.' using errcode = '22023';
    end if;
    select preset.name, preset.task_type into item_title, item_task_type
    from public.task_presets as preset
    where preset.id = p_task_preset_id
      and preset.workspace_id = target_workspace_id
      and preset.lifecycle = 'active';
    if item_title is null then
      raise exception 'Repeat scheduling task source is unavailable.' using errcode = '42501';
    end if;
  else
    if p_one_off_title is null
      or char_length(btrim(p_one_off_title)) not between 1 and 160
      or p_one_off_task_type not in ('general', 'food', 'security', 'custom')
    then
      raise exception 'Repeat scheduling task source is invalid.' using errcode = '22023';
    end if;
    item_title := btrim(p_one_off_title);
    item_task_type := p_one_off_task_type;
  end if;

  select array_agg(series_date::date order by series_date)
  into generated_dates
  from generate_series(p_start_date, p_end_date, interval '1 day') as generated(series_date)
  where extract(dow from series_date)::smallint = any(normalized_weekdays);

  if coalesce(cardinality(generated_dates), 0) not between 1 and 100 then
    raise exception 'Repeat scheduling date range is unavailable.' using errcode = '22023';
  end if;

  with inserted as (
    insert into public.calendar_items (
      workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
      schedule_kind, start_date, end_date, start_time, end_time, timezone,
      needed_count, schedule_notes, custom_values, lifecycle,
      follow_up_project_contact_id, created_by_project_contact_id, publication_state
    )
    select
      target_workspace_id, p_task_preset_id, item_title, item_task_type,
      'timed', selected_date, null, p_start_time, p_end_time, target_timezone,
      p_needed_count, nullif(btrim(p_schedule_notes), ''), p_custom_values, 'active',
      actor_project_contact_id, actor_project_contact_id, 'draft'
    from unnest(generated_dates) as selected(selected_date)
    returning id, start_date
  )
  select array_agg(id order by start_date) into created_ids from inserted;

  insert into public.calendar_repeat_creation_requests (
    workspace_id, request_key, created_by_project_contact_id, created_item_ids
  ) values (
    target_workspace_id, p_request_key, actor_project_contact_id, created_ids
  );

  return created_ids;
end;
$$;

revoke all on function public.update_current_workspace_project_dates(date, date) from public;
grant execute on function public.update_current_workspace_project_dates(date, date) to authenticated;
revoke all on function public.delete_history_free_volunteer_profile(uuid) from public;
grant execute on function public.delete_history_free_volunteer_profile(uuid) to authenticated;
revoke all on function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb
) from public;
grant execute on function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb
) to authenticated;
