-- Iteration 11.18: atomic authenticated replacement of assignment-response tokens.
-- No link display, delivery, lookup, token deletion, or table-read policy is added.

create function public.replace_assignment_response_token(
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

  -- This assignment-scoped row lock serializes replacement calls without a global lock.
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

comment on function public.replace_assignment_response_token(uuid, integer) is
  'Atomically revokes older unrevoked assignment-response tokens and returns one replacement bearer once.';

revoke all on function public.replace_assignment_response_token(uuid, integer) from public;
grant execute on function public.replace_assignment_response_token(uuid, integer) to authenticated;
