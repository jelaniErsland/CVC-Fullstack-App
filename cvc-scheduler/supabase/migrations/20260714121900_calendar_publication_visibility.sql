-- Iteration 12.19: draft/private versus published/live Calendar visibility.
-- Draft Calendar items are private to their creating project contact. Publishing is
-- one-way and does not send email, create public visibility, or activate response links.

alter table public.calendar_items
  add column created_by_project_contact_id uuid references public.project_contacts (id) on delete restrict,
  add column publication_state text not null default 'draft',
  add column published_at timestamptz,
  add column published_by_project_contact_id uuid references public.project_contacts (id) on delete restrict;

comment on column public.calendar_items.created_by_project_contact_id is
  'Project contact that created this scheduled item. 12.19 create derives it from the authenticated scheduler; legacy rows may be null and therefore remain private/fail-closed until reviewed.';
comment on column public.calendar_items.publication_state is
  'Admin visibility state. Draft is private to the creating project contact; published is visible to authorized project contacts. This is not email/delivery truth.';
comment on column public.calendar_items.published_at is
  'Set only by the one-way publish Calendar item command.';
comment on column public.calendar_items.published_by_project_contact_id is
  'Project contact that performed the one-way publish command.';

alter table public.calendar_items
  add constraint calendar_items_publication_state_known check (
    publication_state in ('draft', 'published')
  ),
  add constraint calendar_items_publication_metadata_valid check (
    (
      publication_state = 'draft'
      and published_at is null
      and published_by_project_contact_id is null
    )
    or (
      publication_state = 'published'
      and published_at is not null
      and published_by_project_contact_id is not null
    )
  );

create index calendar_items_workspace_publication_start_idx
  on public.calendar_items (workspace_id, publication_state, start_date, lifecycle);
create index calendar_items_created_by_contact_idx
  on public.calendar_items (created_by_project_contact_id)
  where created_by_project_contact_id is not null;
create index calendar_items_published_by_contact_idx
  on public.calendar_items (published_by_project_contact_id)
  where published_by_project_contact_id is not null;

drop policy if exists calendar_items_select_with_view_capability
on public.calendar_items;

create policy calendar_items_select_with_view_capability
on public.calendar_items
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = calendar_items.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['calendar.view']::text[]
      and (
        calendar_items.publication_state = 'published'
        or calendar_items.created_by_project_contact_id = contact.id
      )
  )
);

drop policy if exists calendar_assignments_select_with_view_capability
on public.calendar_assignments;

create policy calendar_assignments_select_with_view_capability
on public.calendar_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    join public.calendar_items as item
      on item.id = calendar_assignments.calendar_item_id
      and item.workspace_id = calendar_assignments.workspace_id
    where grant_row.workspace_id = calendar_assignments.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['assignments.view']::text[]
      and (
        item.publication_state = 'published'
        or item.created_by_project_contact_id = contact.id
      )
  )
);

drop policy if exists assignment_responses_select_with_view_capability
on public.assignment_responses;

create policy assignment_responses_select_with_view_capability
on public.assignment_responses
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    join public.calendar_assignments as assignment
      on assignment.id = assignment_responses.assignment_id
      and assignment.workspace_id = assignment_responses.workspace_id
    join public.calendar_items as item
      on item.id = assignment.calendar_item_id
      and item.workspace_id = assignment.workspace_id
    where grant_row.workspace_id = assignment_responses.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['assignments.view']::text[]
      and (
        item.publication_state = 'published'
        or item.created_by_project_contact_id = contact.id
      )
  )
);

create or replace function public.create_calendar_item(
  p_workspace_id uuid,
  p_task_preset_id uuid,
  p_one_off_title text,
  p_one_off_task_type text,
  p_schedule_kind text,
  p_start_date date,
  p_end_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_needed_count integer,
  p_schedule_notes text,
  p_custom_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  caller_project_contact_id uuid;
  target_timezone text;
  item_title text;
  item_task_type text;
  created_item_id uuid;
begin
  caller_user_id := auth.uid();

  select workspace.timezone, contact.id
  into target_timezone, caller_project_contact_id
  from public.workspaces as workspace
  join public.workspace_contact_grants as grant_row
    on grant_row.workspace_id = workspace.id
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  where workspace.id = p_workspace_id
    and workspace.lifecycle = 'active'
    and contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['calendar.edit']::text[]
  limit 1;

  if caller_user_id is null
    or target_timezone is null
    or caller_project_contact_id is null
    or p_schedule_kind not in ('timed', 'date_based', 'multi_day_window', 'milestone')
    or p_start_date is null
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
    or not (
      (
        p_schedule_kind = 'timed'
        and p_end_date is null
        and p_start_time is not null
        and p_end_time is not null
        and p_end_time > p_start_time
        and p_needed_count between 0 and 99
      )
      or (
        p_schedule_kind = 'date_based'
        and p_end_date is null
        and p_start_time is null
        and p_end_time is null
        and p_needed_count between 0 and 99
      )
      or (
        p_schedule_kind = 'multi_day_window'
        and p_end_date is not null
        and p_end_date > p_start_date
        and p_start_time is null
        and p_end_time is null
        and p_needed_count = 0
      )
      or (
        p_schedule_kind = 'milestone'
        and p_end_date is null
        and p_start_time is null
        and p_end_time is null
        and p_needed_count = 0
      )
    )
  then
    raise exception 'Calendar item creation is unavailable.' using errcode = '42501';
  end if;

  if p_task_preset_id is not null then
    if p_one_off_title is not null or p_one_off_task_type is not null then
      raise exception 'Calendar item task source is invalid.' using errcode = '22023';
    end if;

    select preset.name, preset.task_type
    into item_title, item_task_type
    from public.task_presets as preset
    where preset.id = p_task_preset_id
      and preset.workspace_id = p_workspace_id
      and preset.lifecycle = 'active';

    if item_title is null then
      raise exception 'Calendar item task source is unavailable.' using errcode = '42501';
    end if;
  else
    if p_one_off_title is null
      or char_length(btrim(p_one_off_title)) not between 1 and 160
      or p_one_off_task_type not in ('general', 'food', 'security', 'custom')
    then
      raise exception 'Calendar item task source is invalid.' using errcode = '22023';
    end if;

    item_title := btrim(p_one_off_title);
    item_task_type := p_one_off_task_type;
  end if;

  insert into public.calendar_items (
    workspace_id,
    task_preset_id,
    title_snapshot,
    task_type_snapshot,
    schedule_kind,
    start_date,
    end_date,
    start_time,
    end_time,
    timezone,
    needed_count,
    schedule_notes,
    custom_values,
    lifecycle,
    follow_up_project_contact_id,
    created_by_project_contact_id,
    publication_state
  )
  values (
    p_workspace_id,
    p_task_preset_id,
    item_title,
    item_task_type,
    p_schedule_kind,
    p_start_date,
    p_end_date,
    p_start_time,
    p_end_time,
    target_timezone,
    p_needed_count,
    nullif(btrim(p_schedule_notes), ''),
    p_custom_values,
    'active',
    caller_project_contact_id,
    caller_project_contact_id,
    'draft'
  )
  returning id into created_item_id;

  return created_item_id;
end;
$$;

create or replace function public.publish_calendar_item(p_calendar_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  caller_project_contact_id uuid;
  published_item_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null or p_calendar_item_id is null then
    raise exception 'Calendar item publish is unavailable.' using errcode = '42501';
  end if;

  select contact.id
  into caller_project_contact_id
  from public.calendar_items as item
  join public.workspaces as workspace
    on workspace.id = item.workspace_id
  join public.project_contacts as contact
    on contact.auth_user_id = caller_user_id
    and contact.status = 'active'
  join public.workspace_contact_grants as grant_row
    on grant_row.workspace_id = item.workspace_id
    and grant_row.project_contact_id = contact.id
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.created_by_project_contact_id = contact.id
    and workspace.lifecycle = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['calendar.edit']::text[]
  limit 1;

  if caller_project_contact_id is null then
    raise exception 'Calendar item publish is unavailable.' using errcode = '42501';
  end if;

  update public.calendar_items as item
  set publication_state = 'published',
      published_at = coalesce(item.published_at, now()),
      published_by_project_contact_id = coalesce(
        item.published_by_project_contact_id,
        caller_project_contact_id
      )
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.created_by_project_contact_id = caller_project_contact_id
    and item.publication_state in ('draft', 'published')
  returning item.id into published_item_id;

  if published_item_id is null then
    raise exception 'Calendar item publish is unavailable.' using errcode = '42501';
  end if;

  return published_item_id;
end;
$$;

create or replace function public.update_calendar_item_one_off_timed(
  p_calendar_item_id uuid,
  p_one_off_title text,
  p_one_off_task_type text,
  p_start_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_needed_count integer,
  p_schedule_notes text,
  p_custom_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  updated_item_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_calendar_item_id is null
    or p_start_date is null
    or p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
    or p_needed_count is null
    or p_needed_count not between 0 and 99
    or p_one_off_title is null
    or char_length(btrim(p_one_off_title)) not between 1 and 160
    or p_one_off_task_type not in ('general', 'food', 'security', 'custom')
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
  then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;

  update public.calendar_items as item
  set title_snapshot = btrim(p_one_off_title),
      task_type_snapshot = p_one_off_task_type,
      schedule_kind = 'timed',
      start_date = p_start_date,
      end_date = null,
      start_time = p_start_time,
      end_time = p_end_time,
      needed_count = p_needed_count,
      schedule_notes = nullif(btrim(p_schedule_notes), ''),
      custom_values = p_custom_values
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.task_preset_id is null
    and item.schedule_kind = 'timed'
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
        and grant_row.capabilities @> array['calendar.edit']::text[]
        and (
          item.publication_state = 'published'
          or item.created_by_project_contact_id = contact.id
        )
    )
  returning id into updated_item_id;

  if updated_item_id is null then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;

  return updated_item_id;
end;
$$;

create or replace function public.update_calendar_item_preset_timed(
  p_calendar_item_id uuid,
  p_start_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_needed_count integer,
  p_schedule_notes text,
  p_custom_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  updated_item_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_calendar_item_id is null
    or p_start_date is null
    or p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
    or p_needed_count is null
    or p_needed_count not between 0 and 99
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
  then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;

  update public.calendar_items as item
  set schedule_kind = 'timed',
      start_date = p_start_date,
      end_date = null,
      start_time = p_start_time,
      end_time = p_end_time,
      needed_count = p_needed_count,
      schedule_notes = nullif(btrim(p_schedule_notes), ''),
      custom_values = p_custom_values
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.task_preset_id is not null
    and item.schedule_kind = 'timed'
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
        and grant_row.capabilities @> array['calendar.edit']::text[]
        and (
          item.publication_state = 'published'
          or item.created_by_project_contact_id = contact.id
        )
    )
  returning id into updated_item_id;

  if updated_item_id is null then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;

  return updated_item_id;
end;
$$;

create or replace function public.archive_calendar_item(p_calendar_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  archived_item_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Calendar item archive is unavailable.' using errcode = '42501';
  end if;

  update public.calendar_items as item
  set lifecycle = 'archived'
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
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
        and grant_row.capabilities @> array['calendar.edit']::text[]
        and (
          item.publication_state = 'published'
          or item.created_by_project_contact_id = contact.id
        )
    )
  returning id into archived_item_id;

  if archived_item_id is null then
    raise exception 'Calendar item archive is unavailable.' using errcode = '42501';
  end if;

  return archived_item_id;
end;
$$;

create or replace function public.create_calendar_assignment(
  p_calendar_item_id uuid,
  p_volunteer_profile_id uuid,
  p_assignment_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
    and volunteer.lifecycle = 'active'
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

create or replace function public.create_calendar_assignments_batch(
  p_calendar_item_id uuid,
  p_volunteer_profile_ids uuid[],
  p_assignment_note text
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
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
    and volunteer.lifecycle = 'active'
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

create or replace function public.cancel_calendar_assignment(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  canceled_assignment_id uuid;
begin
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

create or replace function public.update_assignment_response(
  p_assignment_id uuid,
  p_response_status text,
  p_response_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  current_status text;
  updated_assignment_id uuid;
begin
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

create or replace function public.issue_assignment_response_token(
  p_assignment_id uuid,
  p_ttl_hours integer,
  p_internal_note text
)
returns table (
  token_id uuid,
  bearer_token text,
  token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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
    and volunteer.lifecycle = 'active'
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

create or replace function public.replace_assignment_response_token(
  p_assignment_id uuid,
  p_ttl_hours integer
)
returns table (
  token_id uuid,
  bearer_token text,
  token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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
    and volunteer.lifecycle = 'active'
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

create or replace function public.read_assignment_response_by_token(p_bearer_token text)
returns table (
  workspace_display_name text,
  assignment_reference uuid,
  task_title text,
  schedule_kind text,
  start_date date,
  end_date date,
  start_time time without time zone,
  end_time time without time zone,
  schedule_timezone text,
  current_response_status text
)
language sql
security definer
set search_path = ''
as $$
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
    and volunteer.lifecycle = 'active'
    and volunteer.readiness_status = 'ready'
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
    and workspace.lifecycle = 'active'
  limit 1;
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

  select token.id, assignment.id, response.response_status
  into verified_token_id, verified_assignment_id, existing_response_status
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
  then
    raise exception 'Assignment response token is unavailable.' using errcode = '42501';
  end if;

  recorded_at := now();

  update public.assignment_responses as response
  set response_status = p_response_status,
      response_source = 'public_token',
      response_note = nullif(btrim(p_response_note), ''),
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

create or replace function public.reveal_assignment_response_link(
  p_assignment_id uuid,
  p_ttl_hours integer,
  p_reveal_mode text,
  p_metadata jsonb
)
returns table (
  response_token_id uuid,
  audit_event_id uuid,
  token_expires_at timestamptz,
  bearer_token text,
  event_reveal_surface text,
  event_reveal_mode text
)
language plpgsql
security definer
set search_path = ''
as $$
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
    and volunteer.lifecycle = 'active'
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

create or replace function public.read_assignment_detail_context(
  p_assignment_id uuid
)
returns table (
  assignment_reference uuid,
  assignment_lifecycle text,
  workspace_reference uuid,
  workspace_display_name text,
  calendar_item_reference uuid,
  task_title text,
  schedule_kind text,
  scheduled_date date,
  scheduled_end_date date,
  scheduled_start_time time,
  scheduled_end_time time,
  schedule_timezone text,
  planned_needed_count integer,
  volunteer_profile_reference uuid,
  volunteer_display_name text,
  volunteer_congregation text,
  current_response_status text,
  current_response_updated_at timestamptz,
  current_response_source text,
  can_edit_assignment boolean,
  response_link_product_surface_available boolean,
  future_response_link_surface text
)
language sql
stable
security definer
set search_path = ''
as $$
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
    volunteer.full_name,
    volunteer.congregation,
    response.response_status,
    response.updated_at,
    response.response_source,
    grant_row.capabilities @> array['assignments.edit']::text[],
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
    and volunteer.lifecycle = 'active'
    and volunteer.readiness_status = 'ready';
$$;

revoke all on function public.publish_calendar_item(uuid) from public;
grant execute on function public.publish_calendar_item(uuid) to authenticated;
