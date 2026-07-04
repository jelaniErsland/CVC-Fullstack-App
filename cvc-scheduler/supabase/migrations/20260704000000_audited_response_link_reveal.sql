-- Iteration 11.23: atomic authenticated response-link replacement plus reveal audit.
-- This command returns one bearer once; it adds no route, delivery, lookup, or table policy.

create function public.reveal_assignment_response_link(
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

  -- The assignment lock serializes reveal/replacement state for this assignment only.
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

comment on function public.reveal_assignment_response_link(uuid, integer, text, jsonb) is
  'Atomically replaces an assignment-response token, records a credential-free reveal audit, and returns one bearer once.';

revoke all on function public.reveal_assignment_response_link(uuid, integer, text, jsonb) from public;
grant execute on function public.reveal_assignment_response_link(uuid, integer, text, jsonb) to authenticated;
