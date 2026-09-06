-- 12.45: additive occurrence metadata. Historical Project Day data is untouched.
alter table public.calendar_items
  add column meal_kind text,
  add column meal_provider text,
  add column meal_contact text,
  add column meal_menu text,
  add column meal_total integer,
  add constraint calendar_items_meal_valid check (
    (meal_kind is null and meal_provider is null and meal_contact is null and meal_menu is null and meal_total is null)
    or (meal_kind is not null and meal_kind in ('breakfast', 'lunch') and task_type_snapshot = 'food'
      and schedule_kind in ('timed', 'date_based')
      and publication_state = 'published'
      and (meal_total is null or meal_total between 0 and 100000)
      and (meal_provider is null or char_length(meal_provider) between 1 and 300)
      and (meal_contact is null or char_length(meal_contact) between 1 and 500)
      and (meal_menu is null or char_length(meal_menu) between 1 and 2000))
  );

-- One authoritative Breakfast and Lunch occurrence per day; archived history is retained.
create unique index calendar_items_active_meal_day_unique
  on public.calendar_items (workspace_id, start_date, meal_kind)
  where meal_kind is not null and lifecycle = 'active';
comment on column public.project_days.expected_on_site_count is
  'Historical general total retained intact for audit. Retired from active operational UI by 12.45. Never interpreted as Breakfast or Lunch.';
comment on column public.calendar_items.meal_total is
  'Authoritative total for this Breakfast or Lunch occurrence only. Null means not supplied, zero is explicit.';

create function public.save_calendar_meal(
  p_workspace_id uuid, p_calendar_item_id uuid, p_meal_kind text, p_date date,
  p_start_time time, p_end_time time, p_provider text, p_contact text,
  p_menu text, p_total integer, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid;
  item_id uuid;
  item_kind text;
begin
  select contact.id into actor_id
  from public.project_contacts contact
  join public.workspace_contact_grants g on g.project_contact_id = contact.id
  join public.workspaces w on w.id = g.workspace_id
  where contact.auth_user_id = auth.uid() and contact.status = 'active'
    and w.id = p_workspace_id and w.lifecycle = 'active'
    and g.status = 'active' and g.revoked_at is null and g.valid_from <= now()
    and (g.valid_until is null or g.valid_until > now())
    and g.capabilities @> array['workspace.read', 'calendar.edit']::text[] limit 1;
  if actor_id is null then raise exception 'Meal editing unavailable.' using errcode = '42501'; end if;
  if p_meal_kind is null or p_meal_kind not in ('breakfast', 'lunch') or p_date is null
    or ((p_start_time is null) <> (p_end_time is null))
    or (p_start_time is not null and p_end_time <= p_start_time)
    or (p_total is not null and p_total not between 0 and 100000)
    or char_length(coalesce(p_provider,'')) > 300 or char_length(coalesce(p_contact,'')) > 500
    or char_length(coalesce(p_menu,'')) > 2000 or char_length(coalesce(p_notes,'')) > 4000
  then raise exception 'Invalid meal details.' using errcode = '22023'; end if;
  item_kind := case when p_start_time is null then 'date_based' else 'timed' end;
  if p_calendar_item_id is null then
    item_id := public.create_calendar_item(p_workspace_id, null,
      case when p_meal_kind = 'breakfast' then 'Breakfast' else 'Lunch' end, 'food',
      item_kind, p_date, null, p_start_time, p_end_time, 0, nullif(btrim(p_notes), ''), '{}'::jsonb);
    perform public.publish_calendar_item(item_id);
  else
    select id into item_id from public.calendar_items
    where id = p_calendar_item_id and workspace_id = p_workspace_id
      and lifecycle = 'active' and meal_kind is not null and publication_state = 'published'
    for update;
    if item_id is null then raise exception 'Meal editing unavailable.' using errcode = '42501'; end if;
  end if;
  update public.calendar_items set meal_kind = p_meal_kind,
    title_snapshot = case when p_meal_kind = 'breakfast' then 'Breakfast' else 'Lunch' end,
    start_date = p_date, schedule_kind = item_kind, start_time = p_start_time, end_time = p_end_time,
    meal_provider = nullif(btrim(p_provider), ''), meal_contact = nullif(btrim(p_contact), ''),
    meal_menu = nullif(btrim(p_menu), ''), meal_total = p_total, schedule_notes = nullif(btrim(p_notes), '')
  where id = item_id;
  return item_id;
end;
$$;

create function public.duplicate_calendar_item(
  p_calendar_item_id uuid, p_target_date date, p_start_time time default null, p_end_time time default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  source public.calendar_items%rowtype;
  actor_id uuid;
  new_id uuid;
begin
  select item.* into source from public.calendar_items item
  join public.workspaces w on w.id = item.workspace_id and w.lifecycle = 'active'
  where item.id = p_calendar_item_id and item.lifecycle = 'active' for share of item;
  select contact.id into actor_id from public.project_contacts contact
  join public.workspace_contact_grants g on g.project_contact_id = contact.id
  where contact.auth_user_id = auth.uid() and contact.status = 'active'
    and g.workspace_id = source.workspace_id and g.status = 'active' and g.revoked_at is null
    and g.valid_from <= now() and (g.valid_until is null or g.valid_until > now())
    and g.capabilities @> array['workspace.read', 'calendar.view', 'calendar.edit']::text[]
    and (source.publication_state = 'published' or source.created_by_project_contact_id = contact.id) limit 1;
  if actor_id is null then raise exception 'Duplication unavailable.' using errcode = '42501'; end if;
  if p_target_date is null or ((p_start_time is null) <> (p_end_time is null))
    or (p_start_time is not null and (source.schedule_kind <> 'timed' or p_end_time <= p_start_time))
  then raise exception 'Invalid target date or time.' using errcode = '22023'; end if;
  -- Copy the saved definition, including an archived preset reference, without rereading
  -- or reinterpreting the preset. No assignment/response/token tables are written.
  insert into public.calendar_items (
    workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
    start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes, custom_values,
    lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
    publication_state, published_at, published_by_project_contact_id,
    meal_kind, meal_provider, meal_contact, meal_menu, meal_total
  ) values (
    source.workspace_id, source.task_preset_id, source.title_snapshot, source.task_type_snapshot, source.schedule_kind,
    p_target_date, case when source.end_date is null then null else p_target_date + (source.end_date-source.start_date) end,
    coalesce(p_start_time,source.start_time), coalesce(p_end_time,source.end_time), source.timezone,
    source.needed_count, source.schedule_notes, source.custom_values, 'active', actor_id, actor_id,
    case when source.meal_kind is null then 'draft' else 'published' end,
    case when source.meal_kind is null then null else now() end,
    case when source.meal_kind is null then null else actor_id end,
    source.meal_kind, source.meal_provider, source.meal_contact, source.meal_menu, source.meal_total
  ) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.save_calendar_meal(uuid,uuid,text,date,time,time,text,text,text,integer,text) from public, anon;
grant execute on function public.save_calendar_meal(uuid,uuid,text,date,time,time,text,text,text,integer,text) to authenticated, service_role;
revoke all on function public.duplicate_calendar_item(uuid,date,time,time) from public, anon;
grant execute on function public.duplicate_calendar_item(uuid,date,time,time) to authenticated, service_role;


-- Previously issued links promised a narrower audience projection. Require deliberate
-- reissuance for the trusted on-site view; retain the prior token records for audit.
update public.project_quick_view_access_tokens set revoked_at = now()
where revoked_at is null and expires_at > now();

-- Same reviewed bearer boundary: revocation, expiry, project scope and date checks remain.
-- Explicit trusted projection, no profile contacts/notes, responses or token secrets.
create or replace function public.read_project_quick_view_by_token(
  p_bearer_token text,
  p_project_date date default null
)
returns table (
  access_state text,
  workspace_display_name text,
  workspace_timezone text,
  project_date date,
  project_starts_on date,
  project_ends_on date,
  token_expires_at timestamptz,
  expected_on_site_count integer,
  schedule_sources jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_token_id uuid;
  verified_workspace_id uuid;
  verified_workspace_name text;
  verified_workspace_timezone text;
  verified_project_starts_on date;
  verified_project_ends_on date;
  verified_token_expires_at timestamptz;
  selected_date date;
begin
  if p_bearer_token is null
    or char_length(p_bearer_token) <> 43
    or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$'
  then
    return query select 'unavailable'::text, null::text, null::text, null::date,
      null::date, null::date, null::timestamptz, null::integer, '[]'::jsonb;
    return;
  end if;

  select
    token.id,
    token.workspace_id,
    workspace.display_name,
    workspace.timezone,
    workspace.starts_on,
    workspace.ends_on,
    token.expires_at
  into
    verified_token_id,
    verified_workspace_id,
    verified_workspace_name,
    verified_workspace_timezone,
    verified_project_starts_on,
    verified_project_ends_on,
    verified_token_expires_at
  from public.project_quick_view_access_tokens as token
  join public.workspaces as workspace
    on workspace.id = token.workspace_id
  where token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'project_quick_view_access'
    and token.token_version = 1
    and token.revoked_at is null
    and token.expires_at > now()
    and workspace.lifecycle = 'active'
    and workspace.ends_on is not null
    and (now() at time zone workspace.timezone)::date <= workspace.ends_on
  limit 1;

  if verified_token_id is null then
    return query select 'unavailable'::text, null::text, null::text, null::date,
      null::date, null::date, null::timestamptz, null::integer, '[]'::jsonb;
    return;
  end if;

  selected_date := coalesce(
    p_project_date,
    (now() at time zone verified_workspace_timezone)::date
  );
  if selected_date > verified_project_ends_on then
    return query select 'unavailable'::text, null::text, null::text, null::date,
      null::date, null::date, null::timestamptz, null::integer, '[]'::jsonb;
    return;
  end if;

  update public.project_quick_view_access_tokens as token
  set last_used_at = now()
  where token.id = verified_token_id;

  return query
  select
    'ready'::text,
    verified_workspace_name,
    verified_workspace_timezone,
    selected_date,
    verified_project_starts_on,
    verified_project_ends_on,
    verified_token_expires_at,
    null::integer, -- historical general count is deliberately dormant
    coalesce(schedule.items, '[]'::jsonb)
  from (select 1) as anchor
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id',item.id,'workspace_id',item.workspace_id,'task_preset_id',item.task_preset_id,
        'title_snapshot',item.title_snapshot,'task_type_snapshot',item.task_type_snapshot,
        'schedule_kind',item.schedule_kind,'start_date',item.start_date,'end_date',item.end_date,
        'start_time',item.start_time,'end_time',item.end_time,'timezone',item.timezone,
        'needed_count',item.needed_count,'schedule_notes',item.schedule_notes,
        'meal_kind',item.meal_kind,'meal_provider',item.meal_provider,'meal_contact',item.meal_contact,
        'meal_menu',item.meal_menu,'meal_total',item.meal_total,
        'lifecycle',item.lifecycle,'publication_state',item.publication_state,'published_at',item.published_at,
        'task_preset_label',preset.name,'task_description',preset.description,'custom_values',item.custom_values,
        'assignments',coalesce(assigned.rows,'[]'::jsonb)
      ) order by item.start_date, item.start_time nulls last, item.title_snapshot, item.id
    ) as items
    from public.calendar_items item
    left join public.task_presets preset on preset.id=item.task_preset_id and preset.workspace_id=item.workspace_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'assignmentId',a.id,'calendarItemId',item.id,'volunteerProfileId',v.id,
        'volunteerDisplayName',v.full_name,
        'responseStatus',coalesce(r.response_status,'needs_response')
      ) order by v.full_name,a.id) as rows
      from public.calendar_assignments a
      join public.volunteer_profiles v on v.id=a.volunteer_profile_id and v.workspace_id=item.workspace_id
      left join public.assignment_responses r on r.assignment_id=a.id and r.workspace_id=item.workspace_id
      where a.calendar_item_id=item.id and a.workspace_id=item.workspace_id and a.lifecycle='active'
    ) assigned on true
    where item.workspace_id=verified_workspace_id and item.lifecycle='active' and item.publication_state='published'
      and item.start_date < selected_date + 42 and coalesce(item.end_date,item.start_date) >= selected_date - 31
  ) schedule on true;
end;
$$;


-- Add a volunteer-safe meal projection to the existing credential-scoped RPC.
-- Token checks, assignment filtering, response policy and contact model are preserved.
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
  meal_details jsonb
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
      '[]'::jsonb;
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
      '[]'::jsonb;
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
      '[]'::jsonb
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
    ), '[]'::jsonb)
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
