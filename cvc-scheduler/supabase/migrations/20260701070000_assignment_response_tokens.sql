-- Iteration 11.11: opaque assignment-scoped bearer authorization only.
-- No public route, lookup, email, reminder delivery, or remembered-device behavior is added.

create extension if not exists pgcrypto with schema extensions;

alter table public.calendar_assignments
  add constraint calendar_assignments_workspace_id_id_volunteer_unique
  unique (workspace_id, id, volunteer_profile_id);

alter table public.assignment_responses
  drop constraint assignment_responses_source_known,
  add constraint assignment_responses_source_known check (
    response_source in ('project_contact', 'public_token')
  );

create table public.assignment_response_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  assignment_id uuid not null,
  volunteer_profile_id uuid not null,
  token_verifier_hash bytea not null,
  purpose text not null default 'assignment_response',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  internal_note text,
  created_by_auth_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint assignment_response_tokens_assignment_volunteer_workspace_fk foreign key (
    workspace_id,
    assignment_id,
    volunteer_profile_id
  ) references public.calendar_assignments (
    workspace_id,
    id,
    volunteer_profile_id
  ) on delete restrict,
  constraint assignment_response_tokens_verifier_unique unique (token_verifier_hash),
  constraint assignment_response_tokens_verifier_sha256 check (
    octet_length(token_verifier_hash) = 32
  ),
  constraint assignment_response_tokens_purpose_known check (
    purpose = 'assignment_response'
  ),
  constraint assignment_response_tokens_expiry_valid check (
    expires_at > created_at
  ),
  constraint assignment_response_tokens_revocation_valid check (
    revoked_at is null or revoked_at >= created_at
  ),
  constraint assignment_response_tokens_use_valid check (
    last_used_at is null or last_used_at >= created_at
  ),
  constraint assignment_response_tokens_note_bounded check (
    internal_note is null
    or (internal_note = btrim(internal_note) and char_length(internal_note) between 1 and 500)
  )
);

create index assignment_response_tokens_assignment_metadata_idx
  on public.assignment_response_tokens (workspace_id, assignment_id, created_at desc);

comment on table public.assignment_response_tokens is
  'Opaque assignment-response bearer verifiers. Raw bearer values are never stored and are returned only by issuance.';
comment on column public.assignment_response_tokens.token_verifier_hash is
  'SHA-256 verifier of a database-generated 256-bit opaque bearer; never expose through table reads.';
comment on column public.assignment_response_tokens.last_used_at is
  'Updated only after a successful public response mutation; verification reads do not consume the token.';

create trigger set_assignment_response_token_updated_at
before update on public.assignment_response_tokens
for each row
execute function public.set_assignment_updated_at();

alter table public.assignment_response_tokens enable row level security;

revoke all on table public.assignment_response_tokens from anon, authenticated;

create function public.issue_assignment_response_token(
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

create function public.revoke_assignment_response_token(p_token_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  revoked_token_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Assignment response token revocation is unavailable.' using errcode = '42501';
  end if;

  update public.assignment_response_tokens as token
  set revoked_at = now()
  where token.id = p_token_id
    and token.revoked_at is null
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = token.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  returning token.id into revoked_token_id;

  if revoked_token_id is null then
    raise exception 'Assignment response token revocation is unavailable.' using errcode = '42501';
  end if;

  return revoked_token_id;
end;
$$;

create function public.read_assignment_response_by_token(p_bearer_token text)
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
    and workspace.lifecycle = 'active'
  limit 1;
$$;

create function public.submit_assignment_response_by_token(
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
    and workspace.lifecycle = 'active'
  for update of token, response;

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
end;
$$;

revoke all on function public.issue_assignment_response_token(uuid, integer, text) from public;
grant execute on function public.issue_assignment_response_token(uuid, integer, text) to authenticated;
revoke all on function public.revoke_assignment_response_token(uuid) from public;
grant execute on function public.revoke_assignment_response_token(uuid) to authenticated;

revoke all on function public.read_assignment_response_by_token(text) from public;
grant execute on function public.read_assignment_response_by_token(text) to anon, authenticated;
revoke all on function public.submit_assignment_response_by_token(text, text, text) from public;
grant execute on function public.submit_assignment_response_by_token(text, text, text) to anon, authenticated;
