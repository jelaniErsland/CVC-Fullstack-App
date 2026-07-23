-- Iteration 12.20: secure account-light volunteer schedule access.
-- Schedule credentials are workspace/volunteer-scoped and separate from
-- assignment-response tokens. No email, response mutation, public lookup,
-- remembered-device behavior, or response-link reveal/copy UI is added.

create table public.volunteer_schedule_access_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  volunteer_profile_id uuid not null,
  token_verifier_hash bytea not null,
  purpose text not null default 'volunteer_schedule_access',
  token_version integer not null default 1,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  issued_by_project_contact_id uuid references public.project_contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint volunteer_schedule_tokens_volunteer_workspace_fk foreign key (
    workspace_id,
    volunteer_profile_id
  ) references public.volunteer_profiles (
    workspace_id,
    id
  ) on delete restrict,
  constraint volunteer_schedule_tokens_verifier_unique unique (token_verifier_hash),
  constraint volunteer_schedule_tokens_verifier_sha256 check (
    octet_length(token_verifier_hash) = 32
  ),
  constraint volunteer_schedule_tokens_purpose_known check (
    purpose = 'volunteer_schedule_access'
  ),
  constraint volunteer_schedule_tokens_version_known check (
    token_version = 1
  ),
  constraint volunteer_schedule_tokens_expiry_valid check (
    expires_at > created_at
  ),
  constraint volunteer_schedule_tokens_revocation_valid check (
    revoked_at is null or revoked_at >= created_at
  ),
  constraint volunteer_schedule_tokens_use_valid check (
    last_used_at is null or last_used_at >= created_at
  )
);

create index volunteer_schedule_tokens_volunteer_idx
  on public.volunteer_schedule_access_tokens (workspace_id, volunteer_profile_id, created_at desc);
create index volunteer_schedule_tokens_active_idx
  on public.volunteer_schedule_access_tokens (expires_at, revoked_at)
  where revoked_at is null;

comment on table public.volunteer_schedule_access_tokens is
  'Hash-only volunteer schedule access bearers. They authorize read-only access to one volunteer schedule in one workspace.';
comment on column public.volunteer_schedule_access_tokens.token_verifier_hash is
  'SHA-256 verifier of a database-generated 256-bit opaque bearer; the raw bearer is returned only by issuance and never stored.';
comment on column public.volunteer_schedule_access_tokens.purpose is
  'Dedicated token purpose. This must not be reused as an assignment-response credential.';
comment on column public.volunteer_schedule_access_tokens.last_used_at is
  'Updated after successful volunteer schedule reads only; this does not touch assignment-response tokens.';

create trigger set_volunteer_schedule_access_token_updated_at
before update on public.volunteer_schedule_access_tokens
for each row
execute function public.set_assignment_updated_at();

alter table public.volunteer_schedule_access_tokens enable row level security;

revoke all on table public.volunteer_schedule_access_tokens from anon, authenticated;

create function public.issue_volunteer_schedule_access(
  p_volunteer_profile_id uuid,
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
  caller_project_contact_id uuid;
  target_workspace_id uuid;
  ttl_hours integer;
  issued_token_id uuid;
  issued_bearer_token text;
  issued_expires_at timestamptz;
begin
  caller_user_id := auth.uid();
  ttl_hours := coalesce(p_ttl_hours, 720);

  select volunteer.workspace_id, contact.id
  into target_workspace_id, caller_project_contact_id
  from public.volunteer_profiles as volunteer
  join public.workspaces as workspace
    on workspace.id = volunteer.workspace_id
  join public.workspace_contact_grants as grant_row
    on grant_row.workspace_id = volunteer.workspace_id
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  where volunteer.id = p_volunteer_profile_id
    and volunteer.lifecycle = 'active'
    and volunteer.readiness_status = 'ready'
    and workspace.lifecycle = 'active'
    and contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['assignments.edit']::text[]
  limit 1;

  if caller_user_id is null
    or target_workspace_id is null
    or caller_project_contact_id is null
    or ttl_hours not between 1 and 2160
  then
    raise exception 'Volunteer schedule access issuance is unavailable.' using errcode = '42501';
  end if;

  issued_bearer_token := rtrim(
    translate(
      encode(extensions.gen_random_bytes(32), 'base64'),
      '+/',
      '-_'
    ),
    '='
  );
  issued_expires_at := now() + make_interval(hours => ttl_hours);

  insert into public.volunteer_schedule_access_tokens (
    workspace_id,
    volunteer_profile_id,
    token_verifier_hash,
    purpose,
    token_version,
    expires_at,
    issued_by_project_contact_id
  )
  values (
    target_workspace_id,
    p_volunteer_profile_id,
    extensions.digest(issued_bearer_token, 'sha256'),
    'volunteer_schedule_access',
    1,
    issued_expires_at,
    caller_project_contact_id
  )
  returning id into issued_token_id;

  return query
  select issued_token_id, issued_bearer_token, issued_expires_at;
end;
$$;

create function public.revoke_volunteer_schedule_access(p_token_id uuid)
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

  if caller_user_id is null or p_token_id is null then
    raise exception 'Volunteer schedule access revocation is unavailable.' using errcode = '42501';
  end if;

  update public.volunteer_schedule_access_tokens as token
  set revoked_at = coalesce(token.revoked_at, now())
  where token.id = p_token_id
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      join public.workspaces as workspace
        on workspace.id = token.workspace_id
      where grant_row.workspace_id = token.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and workspace.lifecycle = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  returning token.id into revoked_token_id;

  if revoked_token_id is null then
    raise exception 'Volunteer schedule access revocation is unavailable.' using errcode = '42501';
  end if;

  return revoked_token_id;
end;
$$;

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
  active_assigned_count integer,
  confirmed_count integer,
  declined_count integer,
  follow_up_contact_display_name text,
  follow_up_contact_email text,
  follow_up_contact_phone text
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
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text;
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
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text;
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
      null::integer,
      null::integer,
      null::integer,
      null::text,
      null::text,
      null::text
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
    item.schedule_notes,
    response.response_status,
    coverage.active_assigned_count,
    coverage.confirmed_count,
    coverage.declined_count,
    null::text,
    null::text,
    null::text
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

revoke all on function public.issue_volunteer_schedule_access(uuid, integer) from public;
grant execute on function public.issue_volunteer_schedule_access(uuid, integer) to authenticated;
revoke all on function public.revoke_volunteer_schedule_access(uuid) from public;
grant execute on function public.revoke_volunteer_schedule_access(uuid) to authenticated;
revoke all on function public.read_volunteer_schedule(text) from public;
grant execute on function public.read_volunteer_schedule(text) to anon, authenticated;
