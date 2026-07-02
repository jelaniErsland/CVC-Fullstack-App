-- Iteration 11.4: workspace identity only.
-- Contact grants and every project-owned product table remain out of scope.

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null,
  display_name text not null,
  lifecycle text not null default 'draft',
  timezone text not null default 'UTC',
  starts_on date,
  ends_on date,
  public_intake_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspaces_workspace_key_unique unique (workspace_key),
  constraint workspaces_workspace_key_format check (
    workspace_key = lower(workspace_key)
    and workspace_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(workspace_key) between 3 and 80
  ),
  constraint workspaces_display_name_present check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 160
  ),
  constraint workspaces_lifecycle_known check (
    lifecycle in ('draft', 'active', 'archived')
  ),
  constraint workspaces_timezone_present check (
    timezone = btrim(timezone)
    and char_length(timezone) between 1 and 100
  ),
  constraint workspaces_date_range_ordered check (
    starts_on is null or ends_on is null or starts_on <= ends_on
  )
);

comment on table public.workspaces is
  'Canonical project/workspace identity and scope root. A row does not grant any user access.';
comment on column public.workspaces.id is
  'Canonical immutable scope key for future project-owned rows.';
comment on column public.workspaces.workspace_key is
  'Stable human-readable lookup key; display names may change independently.';
comment on column public.workspaces.public_intake_enabled is
  'Configuration only. This does not implement a public intake read or submission policy.';

create function public.set_workspace_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_workspace_updated_at
before update on public.workspaces
for each row
execute function public.set_workspace_updated_at();

alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;

-- Intentionally no RLS policy exists in 11.4. Auth identity alone grants no
-- workspace visibility. The grants slice must add reviewed project membership
-- policies before normal authenticated reads can return rows.
revoke all on table public.workspaces from anon, authenticated;
grant select on table public.workspaces to anon, authenticated;

