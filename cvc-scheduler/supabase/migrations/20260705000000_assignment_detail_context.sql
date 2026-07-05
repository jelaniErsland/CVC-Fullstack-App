-- Iteration 11.26: narrow assignments.view detail context for one active assignment.
-- No token table, intake table, route, reveal, delivery, or write path is added.

create function public.read_assignment_detail_context(
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
    and volunteer.lifecycle = 'active'
    and volunteer.readiness_status = 'ready';
$$;

comment on function public.read_assignment_detail_context(uuid) is
  'Returns one safe active assignment detail projection to an authenticated assignments.view contact.';

revoke all on function public.read_assignment_detail_context(uuid) from public;
grant execute on function public.read_assignment_detail_context(uuid) to authenticated;
