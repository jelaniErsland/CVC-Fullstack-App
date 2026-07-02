-- Iteration 11.5: project-contact identity and workspace-read grants only.
-- Product permissions and project-owned product tables remain out of scope.

create table public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_contacts_auth_user_unique unique (auth_user_id),
  constraint project_contacts_status_known check (
    status in ('active', 'inactive')
  )
);

create table public.workspace_contact_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_contact_id uuid not null references public.project_contacts (id) on delete cascade,
  role text not null,
  capabilities text[] not null default array['workspace.read']::text[],
  status text not null default 'active',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspace_contact_grants_contact_workspace_unique unique (
    project_contact_id,
    workspace_id
  ),
  constraint workspace_contact_grants_role_known check (
    role in ('main_contact', 'assistant_contact', 'on_site_contact')
  ),
  constraint workspace_contact_grants_status_known check (
    status in ('active', 'inactive', 'revoked')
  ),
  constraint workspace_contact_grants_capabilities_bounded check (
    cardinality(capabilities) between 1 and 32
    and array_position(capabilities, null) is null
    and capabilities @> array['workspace.read']::text[]
  ),
  constraint workspace_contact_grants_validity_ordered check (
    valid_until is null or valid_until > valid_from
  ),
  constraint workspace_contact_grants_revocation_consistent check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create index workspace_contact_grants_workspace_id_idx
  on public.workspace_contact_grants (workspace_id);
create index workspace_contact_grants_project_contact_id_idx
  on public.workspace_contact_grants (project_contact_id);

comment on table public.project_contacts is
  'Application contact identity linked to one Supabase Auth user; this row alone grants no workspace access.';
comment on table public.workspace_contact_grants is
  'Explicit workspace-scoped role and capability grant for one project contact.';
comment on column public.workspace_contact_grants.capabilities is
  'Server-managed capability names. Iteration 11.5 enforces workspace.read only.';

create function public.set_project_authorization_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_project_contacts_updated_at
before update on public.project_contacts
for each row
execute function public.set_project_authorization_updated_at();

create trigger set_workspace_contact_grants_updated_at
before update on public.workspace_contact_grants
for each row
execute function public.set_project_authorization_updated_at();

alter table public.project_contacts enable row level security;
alter table public.project_contacts force row level security;
alter table public.workspace_contact_grants enable row level security;
alter table public.workspace_contact_grants force row level security;

revoke all on table public.project_contacts from anon, authenticated;
revoke all on table public.workspace_contact_grants from anon, authenticated;
grant select on table public.project_contacts to authenticated;
grant select on table public.workspace_contact_grants to authenticated;

create policy project_contacts_select_self
on public.project_contacts
for select
to authenticated
using ((select auth.uid()) = auth_user_id);

create policy workspace_contact_grants_select_current_active
on public.workspace_contact_grants
for select
to authenticated
using (
  status = 'active'
  and revoked_at is null
  and valid_from <= now()
  and (valid_until is null or valid_until > now())
  and capabilities @> array['workspace.read']::text[]
  and exists (
    select 1
    from public.project_contacts as contact
    where contact.id = project_contact_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
  )
);

-- Replace the 11.4 deny-all posture with one narrow authenticated read policy.
-- There is deliberately no anon policy and no authenticated write policy.
revoke all on table public.workspaces from anon;
revoke all on table public.workspaces from authenticated;
grant select on table public.workspaces to authenticated;

create policy workspaces_select_with_active_contact_grant
on public.workspaces
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = workspaces.id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['workspace.read']::text[]
  )
);

