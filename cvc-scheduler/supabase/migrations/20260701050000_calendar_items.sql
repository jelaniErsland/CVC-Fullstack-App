-- Iteration 11.9: scheduled work and project-context items only.
-- Assignments, responses, coverage counters, recurrence, and reminders are out of scope.

alter table public.task_presets
  add constraint task_presets_workspace_id_id_unique
  unique (workspace_id, id);

create function public.calendar_custom_values_are_valid(p_values jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  value_key text;
  value_json jsonb;
begin
  if jsonb_typeof(p_values) is distinct from 'object'
    or octet_length(p_values::text) > 16384
  then
    return false;
  end if;

  if (select count(*) from jsonb_object_keys(p_values)) > 20 then
    return false;
  end if;

  for value_key, value_json in select key, value from jsonb_each(p_values)
  loop
    if value_key !~ '^[a-z][a-z0-9_]{0,39}$'
      or jsonb_typeof(value_json) not in ('string', 'number', 'boolean', 'null')
      or (
        jsonb_typeof(value_json) = 'string'
        and char_length(value_json #>> '{}') > 2000
      )
    then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.calendar_custom_values_are_valid(jsonb) from public;

create table public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  task_preset_id uuid,
  title_snapshot text not null,
  task_type_snapshot text not null,
  schedule_kind text not null,
  start_date date not null,
  end_date date,
  start_time time without time zone,
  end_time time without time zone,
  timezone text not null,
  needed_count integer not null,
  schedule_notes text,
  custom_values jsonb not null default '{}'::jsonb,
  lifecycle text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint calendar_items_task_preset_workspace_fk foreign key (
    workspace_id,
    task_preset_id
  ) references public.task_presets (workspace_id, id) on delete restrict,
  constraint calendar_items_title_present check (
    title_snapshot = btrim(title_snapshot)
    and char_length(title_snapshot) between 1 and 160
  ),
  constraint calendar_items_task_type_known check (
    task_type_snapshot in ('general', 'food', 'security', 'custom')
  ),
  constraint calendar_items_schedule_kind_known check (
    schedule_kind in ('timed', 'date_based', 'multi_day_window', 'milestone')
  ),
  constraint calendar_items_schedule_shape_valid check (
    (
      schedule_kind = 'timed'
      and end_date is null
      and start_time is not null
      and end_time is not null
      and end_time > start_time
    )
    or (
      schedule_kind in ('date_based', 'milestone')
      and end_date is null
      and start_time is null
      and end_time is null
    )
    or (
      schedule_kind = 'multi_day_window'
      and end_date is not null
      and end_date > start_date
      and start_time is null
      and end_time is null
    )
  ),
  constraint calendar_items_timezone_present check (
    timezone = btrim(timezone)
    and char_length(timezone) between 1 and 100
  ),
  constraint calendar_items_needed_count_valid check (
    (
      schedule_kind in ('timed', 'date_based')
      and needed_count between 1 and 99
    )
    or (
      schedule_kind in ('multi_day_window', 'milestone')
      and needed_count = 0
    )
  ),
  constraint calendar_items_notes_bounded check (
    schedule_notes is null
    or (schedule_notes = btrim(schedule_notes) and char_length(schedule_notes) between 1 and 4000)
  ),
  constraint calendar_items_custom_values_valid check (
    public.calendar_custom_values_are_valid(custom_values)
  ),
  constraint calendar_items_lifecycle_known check (
    lifecycle in ('active', 'archived', 'canceled')
  )
);

create index calendar_items_workspace_start_idx
  on public.calendar_items (workspace_id, start_date, lifecycle);
create index calendar_items_task_preset_idx
  on public.calendar_items (task_preset_id)
  where task_preset_id is not null;

comment on table public.calendar_items is
  'Scheduled work or deliberate project context; assignments and response truth live elsewhere later.';
comment on column public.calendar_items.task_preset_id is
  'Nullable: null means title/type are a deliberate one-off snapshot, not a new reusable preset.';
comment on column public.calendar_items.title_snapshot is
  'Historical item title copied from a preset or supplied for one-off work.';
comment on column public.calendar_items.needed_count is
  'Planned item headcount only. Filled/confirmed/denied/waiting/open counts are never stored here.';
comment on column public.calendar_items.timezone is
  'Copied from and enforced against the workspace at mutation time.';

create function public.enforce_calendar_item_workspace_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_timezone text;
begin
  select workspace.timezone
  into expected_timezone
  from public.workspaces as workspace
  where workspace.id = new.workspace_id;

  if expected_timezone is null or new.timezone is distinct from expected_timezone then
    raise exception 'Calendar item timezone must match its workspace.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger enforce_calendar_item_workspace_timezone
before insert or update of workspace_id, timezone on public.calendar_items
for each row
execute function public.enforce_calendar_item_workspace_timezone();

create function public.set_calendar_item_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_calendar_item_updated_at
before update on public.calendar_items
for each row
execute function public.set_calendar_item_updated_at();

alter table public.calendar_items enable row level security;

revoke all on table public.calendar_items from anon, authenticated;
grant select on table public.calendar_items to authenticated;

create policy calendar_items_select_with_view_capability
on public.calendar_items
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    where grant_row.workspace_id = calendar_items.workspace_id
      and contact.auth_user_id = (select auth.uid())
      and contact.status = 'active'
      and grant_row.status = 'active'
      and grant_row.revoked_at is null
      and grant_row.valid_from <= now()
      and (grant_row.valid_until is null or grant_row.valid_until > now())
      and grant_row.capabilities @> array['calendar.view']::text[]
  )
);

create function public.create_calendar_item(
  p_workspace_id uuid,
  p_task_preset_id uuid,
  p_one_off_title text,
  p_one_off_task_type text,
  p_schedule_kind text,
  p_start_date date,
  p_end_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_needed_count integer,
  p_schedule_notes text,
  p_custom_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  target_timezone text;
  item_title text;
  item_task_type text;
  created_item_id uuid;
begin
  caller_user_id := auth.uid();

  select workspace.timezone
  into target_timezone
  from public.workspaces as workspace
  where workspace.id = p_workspace_id
    and workspace.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = workspace.id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['calendar.edit']::text[]
    );

  if caller_user_id is null
    or target_timezone is null
    or p_schedule_kind not in ('timed', 'date_based', 'multi_day_window', 'milestone')
    or p_start_date is null
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
    or not (
      (
        p_schedule_kind = 'timed'
        and p_end_date is null
        and p_start_time is not null
        and p_end_time is not null
        and p_end_time > p_start_time
        and p_needed_count between 1 and 99
      )
      or (
        p_schedule_kind = 'date_based'
        and p_end_date is null
        and p_start_time is null
        and p_end_time is null
        and p_needed_count between 1 and 99
      )
      or (
        p_schedule_kind = 'multi_day_window'
        and p_end_date is not null
        and p_end_date > p_start_date
        and p_start_time is null
        and p_end_time is null
        and p_needed_count = 0
      )
      or (
        p_schedule_kind = 'milestone'
        and p_end_date is null
        and p_start_time is null
        and p_end_time is null
        and p_needed_count = 0
      )
    )
  then
    raise exception 'Calendar item creation is unavailable.' using errcode = '42501';
  end if;

  if p_task_preset_id is not null then
    if p_one_off_title is not null or p_one_off_task_type is not null then
      raise exception 'Calendar item task source is invalid.' using errcode = '22023';
    end if;

    select preset.name, preset.task_type
    into item_title, item_task_type
    from public.task_presets as preset
    where preset.id = p_task_preset_id
      and preset.workspace_id = p_workspace_id
      and preset.lifecycle = 'active';

    if item_title is null then
      raise exception 'Calendar item task source is unavailable.' using errcode = '42501';
    end if;
  else
    if p_one_off_title is null
      or char_length(btrim(p_one_off_title)) not between 1 and 160
      or p_one_off_task_type not in ('general', 'food', 'security', 'custom')
    then
      raise exception 'Calendar item task source is invalid.' using errcode = '22023';
    end if;

    item_title := btrim(p_one_off_title);
    item_task_type := p_one_off_task_type;
  end if;

  insert into public.calendar_items (
    workspace_id,
    task_preset_id,
    title_snapshot,
    task_type_snapshot,
    schedule_kind,
    start_date,
    end_date,
    start_time,
    end_time,
    timezone,
    needed_count,
    schedule_notes,
    custom_values,
    lifecycle
  )
  values (
    p_workspace_id,
    p_task_preset_id,
    item_title,
    item_task_type,
    p_schedule_kind,
    p_start_date,
    p_end_date,
    p_start_time,
    p_end_time,
    target_timezone,
    p_needed_count,
    nullif(btrim(p_schedule_notes), ''),
    p_custom_values,
    'active'
  )
  returning id into created_item_id;

  return created_item_id;
end;
$$;

create function public.archive_calendar_item(p_calendar_item_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  archived_item_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null then
    raise exception 'Calendar item archive is unavailable.' using errcode = '42501';
  end if;

  update public.calendar_items as item
  set lifecycle = 'archived'
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact
        on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = item.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['calendar.edit']::text[]
    )
  returning id into archived_item_id;

  if archived_item_id is null then
    raise exception 'Calendar item archive is unavailable.' using errcode = '42501';
  end if;

  return archived_item_id;
end;
$$;

revoke all on function public.create_calendar_item(
  uuid, uuid, text, text, text, date, date,
  time without time zone, time without time zone, integer, text, jsonb
) from public;
grant execute on function public.create_calendar_item(
  uuid, uuid, text, text, text, date, date,
  time without time zone, time without time zone, integer, text, jsonb
) to authenticated;
revoke all on function public.archive_calendar_item(uuid) from public;
grant execute on function public.archive_calendar_item(uuid) to authenticated;
