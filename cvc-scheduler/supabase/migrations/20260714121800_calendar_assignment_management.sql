create function public.create_calendar_assignments_batch(
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

revoke all on function public.create_calendar_assignments_batch(uuid, uuid[], text) from public;
grant execute on function public.create_calendar_assignments_batch(uuid, uuid[], text) to authenticated;
