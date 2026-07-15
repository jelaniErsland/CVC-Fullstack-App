-- Iteration 12.16: narrow Calendar item create/edit management.
-- Adds permanent follow-up contact provenance and one allowlisted timed one-off update RPC.
-- Assignments, publication, recurrence, drag/drop, resize, copy, delivery, and response links remain out of scope.

alter table public.calendar_items
  add column follow_up_project_contact_id uuid references public.project_contacts (id) on delete restrict;

comment on column public.calendar_items.follow_up_project_contact_id is
  'Project contact responsible for follow-up on this scheduled item. 12.16 create derives it from the authenticated scheduler; legacy rows may be null until reviewed backfill.';

create index calendar_items_follow_up_contact_idx
  on public.calendar_items (follow_up_project_contact_id)
  where follow_up_project_contact_id is not null;

alter table public.calendar_items
  drop constraint calendar_items_needed_count_valid,
  add constraint calendar_items_needed_count_valid check (
    (
      schedule_kind in ('timed', 'date_based')
      and needed_count between 0 and 99
    )
    or (
      schedule_kind in ('multi_day_window', 'milestone')
      and needed_count = 0
    )
  );

create or replace function public.create_calendar_item(
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
  caller_project_contact_id uuid;
  target_timezone text;
  item_title text;
  item_task_type text;
  created_item_id uuid;
begin
  caller_user_id := auth.uid();

  select workspace.timezone, contact.id
  into target_timezone, caller_project_contact_id
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
    and grant_row.capabilities @> array['calendar.edit']::text[]
  limit 1;

  if caller_user_id is null
    or target_timezone is null
    or caller_project_contact_id is null
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
        and p_needed_count between 0 and 99
      )
      or (
        p_schedule_kind = 'date_based'
        and p_end_date is null
        and p_start_time is null
        and p_end_time is null
        and p_needed_count between 0 and 99
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
    lifecycle,
    follow_up_project_contact_id
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
    'active',
    caller_project_contact_id
  )
  returning id into created_item_id;

  return created_item_id;
end;
$$;

create function public.update_calendar_item_one_off_timed(
  p_calendar_item_id uuid,
  p_one_off_title text,
  p_one_off_task_type text,
  p_start_date date,
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
  updated_item_id uuid;
begin
  caller_user_id := auth.uid();

  if caller_user_id is null
    or p_calendar_item_id is null
    or p_start_date is null
    or p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
    or p_needed_count is null
    or p_needed_count not between 0 and 99
    or p_one_off_title is null
    or char_length(btrim(p_one_off_title)) not between 1 and 160
    or p_one_off_task_type not in ('general', 'food', 'security', 'custom')
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
  then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;

  update public.calendar_items as item
  set title_snapshot = btrim(p_one_off_title),
      task_type_snapshot = p_one_off_task_type,
      schedule_kind = 'timed',
      start_date = p_start_date,
      end_date = null,
      start_time = p_start_time,
      end_time = p_end_time,
      needed_count = p_needed_count,
      schedule_notes = nullif(btrim(p_schedule_notes), ''),
      custom_values = p_custom_values
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.task_preset_id is null
    and item.schedule_kind = 'timed'
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
  returning id into updated_item_id;

  if updated_item_id is null then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;

  return updated_item_id;
end;
$$;

revoke all on function public.update_calendar_item_one_off_timed(
  uuid, text, text, date, time without time zone, time without time zone, integer, text, jsonb
) from public;
grant execute on function public.update_calendar_item_one_off_timed(
  uuid, text, text, date, time without time zone, time without time zone, integer, text, jsonb
) to authenticated;
