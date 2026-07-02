-- Iteration 11.8: reusable task definitions only.
-- Calendar placement, assignments, responses, and scheduling fields are out of scope.

create function public.task_custom_field_definitions_are_valid(p_fields jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  field_value jsonb;
  option_value jsonb;
  option_text text;
  field_key text;
  field_type text;
  seen_keys text[] := array[]::text[];
  seen_options text[];
begin
  if jsonb_typeof(p_fields) is distinct from 'array'
    or jsonb_array_length(p_fields) > 20
    or octet_length(p_fields::text) > 16384
  then
    return false;
  end if;

  for field_value in select value from jsonb_array_elements(p_fields)
  loop
    if jsonb_typeof(field_value) is distinct from 'object'
      or field_value - array['key', 'label', 'type', 'required', 'options'] <> '{}'::jsonb
      or jsonb_typeof(field_value -> 'key') is distinct from 'string'
      or jsonb_typeof(field_value -> 'label') is distinct from 'string'
      or jsonb_typeof(field_value -> 'type') is distinct from 'string'
      or jsonb_typeof(field_value -> 'required') is distinct from 'boolean'
    then
      return false;
    end if;

    field_key := field_value ->> 'key';
    field_type := field_value ->> 'type';

    if field_key !~ '^[a-z][a-z0-9_]{0,39}$'
      or field_key = any(seen_keys)
      or char_length(btrim(field_value ->> 'label')) not between 1 and 80
      or field_type not in ('short_text', 'long_text', 'number', 'select', 'checkbox')
    then
      return false;
    end if;

    seen_keys := array_append(seen_keys, field_key);

    if field_type = 'select' then
      if jsonb_typeof(field_value -> 'options') is distinct from 'array'
        or jsonb_array_length(field_value -> 'options') not between 1 and 20
      then
        return false;
      end if;

      seen_options := array[]::text[];
      for option_value in select value from jsonb_array_elements(field_value -> 'options')
      loop
        option_text := btrim(option_value #>> '{}');
        if jsonb_typeof(option_value) is distinct from 'string'
          or char_length(option_text) not between 1 and 100
          or option_text = any(seen_options)
        then
          return false;
        end if;
        seen_options := array_append(seen_options, option_text);
      end loop;
    elsif field_value ? 'options' and field_value -> 'options' <> '[]'::jsonb then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.task_custom_field_definitions_are_valid(jsonb) from public;

create table public.task_presets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  name text not null,
  description text,
  task_type text not null,
  default_needed_count integer not null default 1,
  volunteer_visible boolean not null default true,
  is_system_preset boolean not null default false,
  system_key text,
  custom_field_definitions jsonb not null default '[]'::jsonb,
  lifecycle text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint task_presets_name_present check (
    name = btrim(name)
    and char_length(name) between 1 and 160
  ),
  constraint task_presets_description_bounded check (
    description is null
    or (description = btrim(description) and char_length(description) between 1 and 2000)
  ),
  constraint task_presets_type_known check (
    task_type in ('general', 'food', 'security', 'custom')
  ),
  constraint task_presets_needed_count_bounded check (
    default_needed_count between 1 and 99
  ),
  constraint task_presets_system_consistent check (
    (is_system_preset = true and system_key is not null)
    or (is_system_preset = false and system_key is null)
  ),
  constraint task_presets_system_key_format check (
    system_key is null or system_key ~ '^[a-z][a-z0-9_]{0,39}$'
  ),
  constraint task_presets_custom_fields_valid check (
    public.task_custom_field_definitions_are_valid(custom_field_definitions)
  ),
  constraint task_presets_lifecycle_known check (
    lifecycle in ('active', 'archived')
  )
);

create unique index task_presets_active_name_unique
  on public.task_presets (workspace_id, lower(name))
  where lifecycle = 'active';
create unique index task_presets_system_key_unique
  on public.task_presets (workspace_id, system_key)
  where system_key is not null;
create index task_presets_workspace_type_idx
  on public.task_presets (workspace_id, task_type, name);

comment on table public.task_presets is
  'Reusable workspace work definitions only; rows do not schedule work or assign volunteers.';
comment on column public.task_presets.default_needed_count is
  'Default for a future scheduled instance, not a filled or assigned count.';
comment on column public.task_presets.system_key is
  'Trusted system identity such as lunch; application create commands cannot set it.';
comment on column public.task_presets.custom_field_definitions is
  'Bounded reusable field definitions. Values belong to future scheduled instances, not this preset.';

create function public.set_task_preset_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_task_preset_updated_at
before update on public.task_presets
for each row
execute function public.set_task_preset_updated_at();

alter table public.task_presets enable row level security;

revoke all on table public.task_presets from anon, authenticated;
grant select on table public.task_presets to authenticated;

create policy task_presets_select_with_view_capability
on public.task_presets
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = task_presets.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['tasks.view']::text[]
  )
);

create function public.create_task_preset(
  p_workspace_id uuid,
  p_name text,
  p_description text,
  p_task_type text,
  p_default_needed_count integer,
  p_volunteer_visible boolean,
  p_custom_field_definitions jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  created_preset_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_name is null
    or char_length(btrim(p_name)) not between 1 and 160
    or (p_description is not null and char_length(btrim(p_description)) not between 1 and 2000)
    or p_task_type is null
    or p_task_type not in ('general', 'food', 'security', 'custom')
    or p_default_needed_count is null
    or p_default_needed_count not between 1 and 99
    or p_volunteer_visible is null
    or not public.task_custom_field_definitions_are_valid(p_custom_field_definitions)
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
        and grant_row.capabilities @> array['tasks.edit']::text[]
    )
  then
    raise exception 'Task preset creation is unavailable.' using errcode = '42501';
  end if;

  insert into public.task_presets (
    workspace_id,
    name,
    description,
    task_type,
    default_needed_count,
    volunteer_visible,
    is_system_preset,
    system_key,
    custom_field_definitions,
    lifecycle
  )
  values (
    p_workspace_id,
    btrim(p_name),
    nullif(btrim(p_description), ''),
    p_task_type,
    p_default_needed_count,
    p_volunteer_visible,
    false,
    null,
    p_custom_field_definitions,
    'active'
  )
  returning id into created_preset_id;

  return created_preset_id;
end;
$$;

create function public.archive_task_preset(p_preset_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  archived_preset_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Task preset archive is unavailable.' using errcode = '42501';
  end if;

  update public.task_presets as preset
  set lifecycle = 'archived'
  where preset.id = p_preset_id
    and preset.lifecycle = 'active'
    and preset.is_system_preset = false
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = preset.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['tasks.edit']::text[]
    )
  returning id into archived_preset_id;

  if archived_preset_id is null then
    raise exception 'Task preset archive is unavailable.' using errcode = '42501';
  end if;

  return archived_preset_id;
end;
$$;

revoke all on function public.create_task_preset(uuid, text, text, text, integer, boolean, jsonb)
  from public;
grant execute on function public.create_task_preset(uuid, text, text, text, integer, boolean, jsonb)
  to authenticated;
revoke all on function public.archive_task_preset(uuid) from public;
grant execute on function public.archive_task_preset(uuid) to authenticated;
