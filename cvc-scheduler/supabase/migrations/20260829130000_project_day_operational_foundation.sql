-- Iteration 12.44E.1: one shared, manually authoritative operational fact row
-- per project date. Calendar, Food, and future safe project projections consume
-- this shared truth rather than maintaining feature-specific copies.

create table public.project_days (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  project_date date not null,
  expected_on_site_count integer,
  created_by_project_contact_id uuid not null references public.project_contacts (id) on delete restrict,
  updated_by_project_contact_id uuid not null references public.project_contacts (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_days_workspace_date_unique unique (workspace_id, project_date),
  constraint project_days_expected_on_site_count_valid check (
    expected_on_site_count is null or expected_on_site_count >= 0
  )
);

comment on table public.project_days is
  'Shared manually authoritative project-date operational truth. The expected count is not derived from Project Local assignments.';
comment on column public.project_days.expected_on_site_count is
  'Nullable manual total for all expected people on site, including people not represented by Project Local assignments.';

create function public.set_project_day_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_project_day_updated_at
before update on public.project_days
for each row
execute function public.set_project_day_updated_at();

alter table public.project_days enable row level security;
alter table public.project_days force row level security;

revoke all privileges on table public.project_days from anon, authenticated, PUBLIC;
grant select on table public.project_days to authenticated;

create policy project_days_select_with_calendar_view
on public.project_days
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    join public.workspaces as workspace
      on workspace.id = grant_row.workspace_id
    where grant_row.workspace_id = project_days.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and workspace.lifecycle = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['workspace.read', 'calendar.view']::text[]
  )
);

-- The caller supplies only the operational value and date. Workspace and actor
-- are resolved from the current verified Auth identity. Ambiguous multi-project
-- access fails closed instead of accepting a browser-provided workspace id.
create function public.set_current_project_day_expected_on_site(
  p_project_date date,
  p_expected_on_site_count integer
)
returns table (
  project_date date,
  expected_on_site_count integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  target_workspace_ids uuid[];
  target_project_contact_ids uuid[];
  target_workspace_id uuid;
  actor_project_contact_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_project_date is null
    or (p_expected_on_site_count is not null and p_expected_on_site_count < 0)
  then
    raise exception 'Project Day update is unavailable.' using errcode = '42501';
  end if;

  select
    array_agg(distinct grant_row.workspace_id),
    array_agg(distinct contact.id)
  into target_workspace_ids, target_project_contact_ids
  from public.workspace_contact_grants as grant_row
  join public.project_contacts as contact
    on contact.id = grant_row.project_contact_id
  join public.workspaces as workspace
    on workspace.id = grant_row.workspace_id
  where contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and workspace.lifecycle = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['workspace.read', 'calendar.edit']::text[];

  if coalesce(array_length(target_workspace_ids, 1), 0) <> 1
    or coalesce(array_length(target_project_contact_ids, 1), 0) <> 1
  then
    raise exception 'Project Day update is unavailable.' using errcode = '42501';
  end if;

  target_workspace_id := target_workspace_ids[1];
  actor_project_contact_id := target_project_contact_ids[1];

  return query
  insert into public.project_days as project_day (
    workspace_id,
    project_date,
    expected_on_site_count,
    created_by_project_contact_id,
    updated_by_project_contact_id
  )
  values (
    target_workspace_id,
    p_project_date,
    p_expected_on_site_count,
    actor_project_contact_id,
    actor_project_contact_id
  )
  on conflict on constraint project_days_workspace_date_unique
  do update set
    expected_on_site_count = excluded.expected_on_site_count,
    updated_by_project_contact_id = actor_project_contact_id
  returning
    project_day.project_date,
    project_day.expected_on_site_count,
    project_day.created_at,
    project_day.updated_at;
end;
$$;

revoke all on function public.set_current_project_day_expected_on_site(date, integer)
  from public;
grant execute on function public.set_current_project_day_expected_on_site(date, integer)
  to authenticated;
