-- Iteration 12.44E.3: hash-only, project-scoped access to the existing safe
-- Project Quick View projection. The raw bearer is returned only at issuance.

create table public.project_quick_view_access_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  token_verifier_hash bytea not null,
  purpose text not null default 'project_quick_view_access',
  token_version integer not null default 1,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  issued_by_project_contact_id uuid references public.project_contacts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_quick_view_access_tokens_verifier_unique unique (token_verifier_hash),
  constraint project_quick_view_access_tokens_verifier_sha256 check (
    octet_length(token_verifier_hash) = 32
  ),
  constraint project_quick_view_access_tokens_purpose_known check (
    purpose = 'project_quick_view_access'
  ),
  constraint project_quick_view_access_tokens_version_known check (
    token_version = 1
  ),
  constraint project_quick_view_access_tokens_expiry_valid check (
    expires_at > created_at
  ),
  constraint project_quick_view_access_tokens_revocation_valid check (
    revoked_at is null or revoked_at >= created_at
  ),
  constraint project_quick_view_access_tokens_use_valid check (
    last_used_at is null or last_used_at >= created_at
  )
);

create index project_quick_view_access_tokens_workspace_idx
  on public.project_quick_view_access_tokens (workspace_id, created_at desc);
create index project_quick_view_access_tokens_active_idx
  on public.project_quick_view_access_tokens (workspace_id, expires_at)
  where revoked_at is null;

comment on table public.project_quick_view_access_tokens is
  'Hash-only project Quick View access bearers. Each bearer authorizes only the existing redacted Quick View for one workspace.';
comment on column public.project_quick_view_access_tokens.token_verifier_hash is
  'SHA-256 verifier of a database-generated 256-bit opaque bearer; the raw bearer is returned only by issuance and never stored.';

create trigger set_project_quick_view_access_token_updated_at
before update on public.project_quick_view_access_tokens
for each row
execute function public.set_assignment_updated_at();

alter table public.project_quick_view_access_tokens enable row level security;
alter table public.project_quick_view_access_tokens force row level security;

revoke all on table public.project_quick_view_access_tokens from anon, authenticated;

create function public.issue_project_quick_view_access(p_workspace_id uuid)
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
  project_timezone text;
  project_ends_on date;
  issued_token_id uuid;
  issued_bearer_token text;
  issued_expires_at timestamptz;
begin
  caller_user_id := auth.uid();

  select contact.id, workspace.timezone, workspace.ends_on
  into caller_project_contact_id, project_timezone, project_ends_on
  from public.workspaces as workspace
  join public.workspace_contact_grants as grant_row
    on grant_row.workspace_id = workspace.id
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  where workspace.id = p_workspace_id
    and workspace.lifecycle = 'active'
    and workspace.ends_on is not null
    and (now() at time zone workspace.timezone)::date <= workspace.ends_on
    and contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['workspace.read', 'calendar.edit']::text[]
  limit 1;

  if caller_user_id is null
    or p_workspace_id is null
    or caller_project_contact_id is null
    or project_timezone is null
    or project_ends_on is null
  then
    raise exception 'Project Quick View sharing is unavailable.' using errcode = '42501';
  end if;

  issued_expires_at := (project_ends_on + 1)::timestamp at time zone project_timezone;
  if issued_expires_at <= now() then
    raise exception 'Project Quick View sharing is unavailable.' using errcode = '42501';
  end if;

  -- Bound stored lifecycle residue and the number of simultaneously useful links.
  delete from public.project_quick_view_access_tokens as token
  where token.workspace_id = p_workspace_id
    and (
      token.expires_at < now() - interval '30 days'
      or token.revoked_at < now() - interval '30 days'
    );

  with active_tokens as (
    select token.id
    from public.project_quick_view_access_tokens as token
    where token.workspace_id = p_workspace_id
      and token.revoked_at is null
      and token.expires_at > now()
    order by token.created_at desc, token.id desc
    offset 4
  )
  update public.project_quick_view_access_tokens as token
  set revoked_at = now()
  from active_tokens
  where token.id = active_tokens.id;

  issued_bearer_token := rtrim(
    translate(
      encode(extensions.gen_random_bytes(32), 'base64'),
      '+/',
      '-_'
    ),
    '='
  );

  insert into public.project_quick_view_access_tokens (
    workspace_id,
    token_verifier_hash,
    expires_at,
    issued_by_project_contact_id
  )
  values (
    p_workspace_id,
    extensions.digest(issued_bearer_token, 'sha256'),
    issued_expires_at,
    caller_project_contact_id
  )
  returning id into issued_token_id;

  return query
  select issued_token_id, issued_bearer_token, issued_expires_at;
end;
$$;

create function public.read_project_quick_view_share_state(p_workspace_id uuid)
returns table (
  shared_access_enabled boolean,
  active_link_count integer,
  latest_expires_at timestamptz
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  caller_user_id uuid;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null
    or p_workspace_id is null
    or not exists (
      select 1
      from public.workspaces as workspace
      join public.workspace_contact_grants as grant_row
        on grant_row.workspace_id = workspace.id
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where workspace.id = p_workspace_id
        and workspace.lifecycle = 'active'
        and workspace.ends_on is not null
        and (now() at time zone workspace.timezone)::date <= workspace.ends_on
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['workspace.read', 'calendar.edit']::text[]
    )
  then
    raise exception 'Project Quick View sharing is unavailable.' using errcode = '42501';
  end if;

  return query
  select
    count(*) > 0,
    count(*)::integer,
    max(token.expires_at)
  from public.project_quick_view_access_tokens as token
  where token.workspace_id = p_workspace_id
    and token.revoked_at is null
    and token.expires_at > now();
end;
$$;

create function public.revoke_project_quick_view_access(p_workspace_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  revoked_count integer;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null
    or p_workspace_id is null
    or not exists (
      select 1
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
        and grant_row.capabilities @> array['workspace.read', 'calendar.edit']::text[]
    )
  then
    raise exception 'Project Quick View sharing is unavailable.' using errcode = '42501';
  end if;

  update public.project_quick_view_access_tokens as token
  set revoked_at = now()
  where token.workspace_id = p_workspace_id
    and token.revoked_at is null
    and token.expires_at > now();
  get diagnostics revoked_count = row_count;
  return revoked_count;
end;
$$;

create function public.read_project_quick_view_by_token(
  p_bearer_token text,
  p_project_date date default null
)
returns table (
  access_state text,
  workspace_display_name text,
  workspace_timezone text,
  project_date date,
  project_starts_on date,
  project_ends_on date,
  token_expires_at timestamptz,
  expected_on_site_count integer,
  schedule_sources jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified_token_id uuid;
  verified_workspace_id uuid;
  verified_workspace_name text;
  verified_workspace_timezone text;
  verified_project_starts_on date;
  verified_project_ends_on date;
  verified_token_expires_at timestamptz;
  selected_date date;
begin
  if p_bearer_token is null
    or char_length(p_bearer_token) <> 43
    or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$'
  then
    return query select 'unavailable'::text, null::text, null::text, null::date,
      null::date, null::date, null::timestamptz, null::integer, '[]'::jsonb;
    return;
  end if;

  select
    token.id,
    token.workspace_id,
    workspace.display_name,
    workspace.timezone,
    workspace.starts_on,
    workspace.ends_on,
    token.expires_at
  into
    verified_token_id,
    verified_workspace_id,
    verified_workspace_name,
    verified_workspace_timezone,
    verified_project_starts_on,
    verified_project_ends_on,
    verified_token_expires_at
  from public.project_quick_view_access_tokens as token
  join public.workspaces as workspace
    on workspace.id = token.workspace_id
  where token.token_verifier_hash = extensions.digest(p_bearer_token, 'sha256')
    and token.purpose = 'project_quick_view_access'
    and token.token_version = 1
    and token.revoked_at is null
    and token.expires_at > now()
    and workspace.lifecycle = 'active'
    and workspace.ends_on is not null
    and (now() at time zone workspace.timezone)::date <= workspace.ends_on
  limit 1;

  if verified_token_id is null then
    return query select 'unavailable'::text, null::text, null::text, null::date,
      null::date, null::date, null::timestamptz, null::integer, '[]'::jsonb;
    return;
  end if;

  selected_date := coalesce(
    p_project_date,
    (now() at time zone verified_workspace_timezone)::date
  );
  if selected_date > verified_project_ends_on then
    return query select 'unavailable'::text, null::text, null::text, null::date,
      null::date, null::date, null::timestamptz, null::integer, '[]'::jsonb;
    return;
  end if;

  update public.project_quick_view_access_tokens as token
  set last_used_at = now()
  where token.id = verified_token_id;

  return query
  select
    'ready'::text,
    verified_workspace_name,
    verified_workspace_timezone,
    selected_date,
    verified_project_starts_on,
    verified_project_ends_on,
    verified_token_expires_at,
    project_day.expected_on_site_count,
    coalesce(schedule.items, '[]'::jsonb)
  from (select 1) as anchor
  left join lateral (
    select day_row.expected_on_site_count
    from public.project_days as day_row
    where day_row.workspace_id = verified_workspace_id
      and day_row.project_date = selected_date
    limit 1
  ) as project_day on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'title', item.title_snapshot,
        'taskType', item.task_type_snapshot,
        'scheduleKind', item.schedule_kind,
        'startDate', item.start_date,
        'endDate', item.end_date,
        'startTime', item.start_time,
        'endTime', item.end_time,
        'neededCount', item.needed_count,
        'lifecycle', item.lifecycle,
        'publicationState', item.publication_state
      ) order by item.start_time nulls last, item.title_snapshot
    ) as items
    from public.calendar_items as item
    where item.workspace_id = verified_workspace_id
      and item.lifecycle = 'active'
      and item.publication_state = 'published'
      and item.task_type_snapshot <> 'security'
      and (
        item.start_date = selected_date
        or (item.start_date <= selected_date and item.end_date >= selected_date)
      )
  ) as schedule on true;
end;
$$;

revoke all on function public.issue_project_quick_view_access(uuid) from public;
grant execute on function public.issue_project_quick_view_access(uuid) to authenticated;
revoke all on function public.read_project_quick_view_share_state(uuid) from public;
grant execute on function public.read_project_quick_view_share_state(uuid) to authenticated;
revoke all on function public.revoke_project_quick_view_access(uuid) from public;
grant execute on function public.revoke_project_quick_view_access(uuid) to authenticated;
revoke all on function public.read_project_quick_view_by_token(text, date) from public;
grant execute on function public.read_project_quick_view_by_token(text, date) to anon, authenticated;
