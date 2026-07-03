-- Iteration 11.21: credential-free response-link reveal audit persistence only.
-- No bearer display, copy UI, delivery, lookup, token deletion, or table-read policy is added.

alter table public.assignment_response_tokens
  add constraint assignment_response_tokens_workspace_assignment_id_unique
  unique (workspace_id, assignment_id, id);

create function public.response_link_reveal_metadata_is_valid(p_metadata jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  metadata_key_count integer;
begin
  if p_metadata is null
    or jsonb_typeof(p_metadata) <> 'object'
    or octet_length(p_metadata::text) > 2000
  then
    return false;
  end if;

  select count(*) into metadata_key_count
  from jsonb_object_keys(p_metadata);

  if metadata_key_count > 3 then
    return false;
  end if;

  return not exists (
    select 1
    from jsonb_each(p_metadata) as entry
    where entry.key not in ('reason_code', 'delivery_requested', 'request_correlation_id')
      or (entry.key = 'reason_code' and (
        jsonb_typeof(entry.value) <> 'string'
        or (entry.value #>> '{}') !~ '^[a-z0-9_]{1,50}$'
      ))
      or (entry.key = 'delivery_requested' and jsonb_typeof(entry.value) <> 'boolean')
      or (entry.key = 'request_correlation_id' and (
        jsonb_typeof(entry.value) <> 'string'
        or (entry.value #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ))
  );
end;
$$;

revoke all on function public.response_link_reveal_metadata_is_valid(jsonb) from public;

create table public.assignment_response_link_reveal_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  assignment_id uuid not null,
  response_token_id uuid not null,
  actor_project_contact_id uuid not null references public.project_contacts (id) on delete restrict,
  action text not null default 'response_link_revealed',
  reveal_surface text not null,
  reveal_mode text not null,
  expires_at timestamptz not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint assignment_response_link_reveal_events_token_scope_fk foreign key (
    workspace_id,
    assignment_id,
    response_token_id
  ) references public.assignment_response_tokens (
    workspace_id,
    assignment_id,
    id
  ) on delete restrict,
  constraint assignment_response_link_reveal_events_action_known check (
    action = 'response_link_revealed'
  ),
  constraint assignment_response_link_reveal_events_surface_known check (
    reveal_surface = 'future_project_contact_assignment_response_reveal'
  ),
  constraint assignment_response_link_reveal_events_mode_known check (
    reveal_mode in ('copy_link', 'email_delivery', 'reminder_delivery')
  ),
  constraint assignment_response_link_reveal_events_expiry_after_event check (
    expires_at > occurred_at
  ),
  constraint assignment_response_link_reveal_events_metadata_valid check (
    public.response_link_reveal_metadata_is_valid(metadata)
  )
);

create index assignment_response_link_reveal_events_assignment_time_idx
  on public.assignment_response_link_reveal_events (
    workspace_id,
    assignment_id,
    occurred_at desc
  );

comment on table public.assignment_response_link_reveal_events is
  'Credential-free audit events for a future explicit response-link reveal surface.';
comment on column public.assignment_response_link_reveal_events.response_token_id is
  'Token row reference only; raw bearer, full URL, and verifier hash are prohibited.';
comment on column public.assignment_response_link_reveal_events.metadata is
  'Allowlisted reason_code, delivery_requested, and request_correlation_id only.';

alter table public.assignment_response_link_reveal_events enable row level security;
revoke all on table public.assignment_response_link_reveal_events from anon, authenticated;

create function public.record_assignment_response_link_reveal_event(
  p_assignment_id uuid,
  p_response_token_id uuid,
  p_reveal_surface text,
  p_reveal_mode text,
  p_expires_at timestamptz,
  p_metadata jsonb
)
returns table (
  event_id uuid,
  assignment_reference uuid,
  response_token_reference uuid,
  actor_project_contact_reference uuid,
  event_action text,
  event_reveal_surface text,
  event_reveal_mode text,
  token_expires_at timestamptz,
  event_occurred_at timestamptz,
  event_metadata jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  target_workspace_id uuid;
  target_actor_project_contact_id uuid;
  verified_token_expires_at timestamptz;
  recorded_event_id uuid;
  recorded_at timestamptz;
  normalized_metadata jsonb;
begin
  caller_user_id := auth.uid();
  recorded_at := clock_timestamp();
  normalized_metadata := coalesce(p_metadata, '{}'::jsonb);

  if caller_user_id is null
    or p_reveal_surface <> 'future_project_contact_assignment_response_reveal'
    or p_reveal_mode not in ('copy_link', 'email_delivery', 'reminder_delivery')
    or p_expires_at is null
    or not public.response_link_reveal_metadata_is_valid(normalized_metadata)
  then
    raise exception 'Response link reveal audit is unavailable.' using errcode = '42501';
  end if;

  select
    token.workspace_id,
    contact.id,
    token.expires_at
  into
    target_workspace_id,
    target_actor_project_contact_id,
    verified_token_expires_at
  from public.assignment_response_tokens as token
  join public.calendar_assignments as assignment
    on assignment.id = token.assignment_id
    and assignment.workspace_id = token.workspace_id
  join public.project_contacts as contact
    on contact.auth_user_id = caller_user_id
    and contact.status = 'active'
  where token.id = p_response_token_id
    and token.assignment_id = p_assignment_id
    and token.purpose = 'assignment_response'
    and token.revoked_at is null
    and token.expires_at > recorded_at
    and token.expires_at = p_expires_at
    and assignment.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      where grant_row.workspace_id = token.workspace_id
        and grant_row.project_contact_id = contact.id
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= recorded_at
        and (grant_row.valid_until is null or grant_row.valid_until > recorded_at)
        and grant_row.capabilities @> array['assignments.edit']::text[]
    )
  for share of token;

  if target_workspace_id is null
    or target_actor_project_contact_id is null
    or verified_token_expires_at is null
  then
    raise exception 'Response link reveal audit is unavailable.' using errcode = '42501';
  end if;

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
    p_response_token_id,
    target_actor_project_contact_id,
    'response_link_revealed',
    p_reveal_surface,
    p_reveal_mode,
    verified_token_expires_at,
    recorded_at,
    normalized_metadata
  )
  returning id into recorded_event_id;

  return query
  select
    recorded_event_id,
    p_assignment_id,
    p_response_token_id,
    target_actor_project_contact_id,
    'response_link_revealed'::text,
    p_reveal_surface,
    p_reveal_mode,
    verified_token_expires_at,
    recorded_at,
    normalized_metadata;
end;
$$;

revoke all on function public.record_assignment_response_link_reveal_event(
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  jsonb
) from public;
grant execute on function public.record_assignment_response_link_reveal_event(
  uuid,
  uuid,
  text,
  text,
  timestamptz,
  jsonb
) to authenticated;
