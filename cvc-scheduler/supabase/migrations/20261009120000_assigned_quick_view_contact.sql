-- A shared Quick View bearer may read contact details only for an assignment
-- already visible in that project's published, date-bounded schedule.
begin;

create function public.read_project_quick_view_assigned_contact(
  p_bearer_token text,
  p_assignment_id uuid,
  p_project_date date default null
) returns table (contact_name text, phone text, email text, congregation text)
language sql stable security definer set search_path = '' as $$
  select volunteer.full_name, volunteer.phone, volunteer.email, volunteer.congregation
  from public.project_quick_view_access_tokens token
  join public.workspaces workspace on workspace.id = token.workspace_id
  join public.calendar_assignments assignment
    on assignment.id = p_assignment_id
    and assignment.workspace_id = token.workspace_id
    and assignment.lifecycle = 'active'
  join public.calendar_items item
    on item.id = assignment.calendar_item_id
    and item.workspace_id = token.workspace_id
    and item.lifecycle = 'active'
    and item.publication_state = 'published'
  join public.volunteer_profiles volunteer
    on volunteer.id = assignment.volunteer_profile_id
    and volunteer.workspace_id = token.workspace_id
  where p_bearer_token is not null
    and char_length(p_bearer_token) = 43
    and p_bearer_token ~ '^[A-Za-z0-9_-]{43}$'
    and token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'project_quick_view_access'
    and token.token_version = 1
    and token.revoked_at is null
    and token.expires_at > now()
    and workspace.lifecycle = 'active'
    and workspace.ends_on is not null
    and (now() at time zone workspace.timezone)::date <= workspace.ends_on
    and coalesce(p_project_date, (now() at time zone workspace.timezone)::date) <= workspace.ends_on
    and item.start_date < coalesce(p_project_date, (now() at time zone workspace.timezone)::date) + 42
    and coalesce(item.end_date, item.start_date) >= coalesce(p_project_date, (now() at time zone workspace.timezone)::date) - 31
  limit 1;
$$;

alter function public.read_project_quick_view_assigned_contact(text,uuid,date) owner to postgres;
revoke all on function public.read_project_quick_view_assigned_contact(text,uuid,date)
  from public, anon, authenticated, service_role;
grant execute on function public.read_project_quick_view_assigned_contact(text,uuid,date)
  to anon;
comment on function public.read_project_quick_view_assigned_contact(text,uuid,date) is
  'Read-only four-field contact card for one published assignment visible to a live, project-scoped Quick View bearer.';

commit;
