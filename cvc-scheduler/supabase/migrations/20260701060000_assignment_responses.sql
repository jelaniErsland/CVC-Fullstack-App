-- Iteration 11.10: assignment and current volunteer-response truth only.
-- Public response tokens, reminders, coverage counters, conflicts, and route cutovers are out of scope.

alter table public.calendar_items
  add constraint calendar_items_workspace_id_id_unique
  unique (workspace_id, id);

create table public.calendar_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  calendar_item_id uuid not null,
  volunteer_profile_id uuid not null,
  lifecycle text not null default 'active',
  assignment_note text,
  created_by_auth_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_assignments_workspace_id_id_unique unique (workspace_id, id),
  constraint calendar_assignments_calendar_workspace_fk foreign key (
    workspace_id,
    calendar_item_id
  ) references public.calendar_items (workspace_id, id) on delete restrict,
  constraint calendar_assignments_volunteer_workspace_fk foreign key (
    workspace_id,
    volunteer_profile_id
  ) references public.volunteer_profiles (workspace_id, id) on delete restrict,
  constraint calendar_assignments_lifecycle_known check (
    lifecycle in ('active', 'canceled', 'archived')
  ),
  constraint calendar_assignments_note_bounded check (
    assignment_note is null
    or (assignment_note = btrim(assignment_note) and char_length(assignment_note) between 1 and 2000)
  )
);

create unique index calendar_assignments_one_active_volunteer_item
  on public.calendar_assignments (calendar_item_id, volunteer_profile_id)
  where lifecycle = 'active';
create index calendar_assignments_workspace_item_idx
  on public.calendar_assignments (workspace_id, calendar_item_id, lifecycle);
create index calendar_assignments_workspace_volunteer_idx
  on public.calendar_assignments (workspace_id, volunteer_profile_id, lifecycle);

comment on table public.calendar_assignments is
  'Workspace-scoped link between scheduled work and a volunteer profile; it contains no questionnaire or emergency-contact truth.';
comment on column public.calendar_assignments.lifecycle is
  'Assignment lifecycle is separate from the volunteer response state.';

create table public.assignment_responses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  assignment_id uuid not null,
  response_status text not null default 'needs_response',
  response_source text not null default 'project_contact',
  response_note text,
  responded_at timestamptz,
  updated_by_auth_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint assignment_responses_assignment_unique unique (assignment_id),
  constraint assignment_responses_assignment_workspace_fk foreign key (
    workspace_id,
    assignment_id
  ) references public.calendar_assignments (workspace_id, id) on delete restrict,
  constraint assignment_responses_status_known check (
    response_status in ('needs_response', 'confirmed', 'declined')
  ),
  constraint assignment_responses_source_known check (
    response_source = 'project_contact'
  ),
  constraint assignment_responses_note_bounded check (
    response_note is null
    or (response_note = btrim(response_note) and char_length(response_note) between 1 and 1000)
  ),
  constraint assignment_responses_timestamp_matches_status check (
    (response_status = 'needs_response' and responded_at is null)
    or (response_status in ('confirmed', 'declined') and responded_at is not null)
  )
);

create index assignment_responses_workspace_status_idx
  on public.assignment_responses (workspace_id, response_status);

comment on table public.assignment_responses is
  'One current response state per assignment. History and public bearer-token response access are deliberately deferred.';
comment on column public.assignment_responses.response_source is
  'Fixed to project_contact in 11.10; public volunteer response sources require a later reviewed token boundary.';

create function public.set_assignment_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_calendar_assignment_updated_at
before update on public.calendar_assignments
for each row
execute function public.set_assignment_updated_at();

create trigger set_assignment_response_updated_at
before update on public.assignment_responses
for each row
execute function public.set_assignment_updated_at();

alter table public.calendar_assignments enable row level security;
alter table public.assignment_responses enable row level security;

revoke all on table public.calendar_assignments from anon, authenticated;
revoke all on table public.assignment_responses from anon, authenticated;
grant select on table public.calendar_assignments to authenticated;
grant select on table public.assignment_responses to authenticated;

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
    where grant_row.workspace_id = calendar_assignments.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['assignments.view']::text[]
  )
);

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
    where grant_row.workspace_id = assignment_responses.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['assignments.view']::text[]
  )
);

create function public.create_calendar_assignment(
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

create function public.cancel_calendar_assignment(p_assignment_id uuid)
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
  returning id into canceled_assignment_id;

  if canceled_assignment_id is null then
    raise exception 'Assignment cancellation is unavailable.' using errcode = '42501';
  end if;

  return canceled_assignment_id;
end;
$$;

create function public.update_assignment_response(
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
  where response.assignment_id = p_assignment_id
    and assignment.lifecycle = 'active'
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
      where current_assignment.id = response.assignment_id
        and current_assignment.lifecycle = 'active'
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

revoke all on function public.create_calendar_assignment(uuid, uuid, text) from public;
grant execute on function public.create_calendar_assignment(uuid, uuid, text) to authenticated;
revoke all on function public.cancel_calendar_assignment(uuid) from public;
grant execute on function public.cancel_calendar_assignment(uuid) to authenticated;
revoke all on function public.update_assignment_response(uuid, text, text) from public;
grant execute on function public.update_assignment_response(uuid, text, text) to authenticated;
