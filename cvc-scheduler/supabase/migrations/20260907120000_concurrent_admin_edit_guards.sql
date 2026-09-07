begin;

drop function public.update_calendar_item_one_off_timed(
  uuid, text, text, date, time without time zone, time without time zone,
  integer, text, jsonb
);

create function public.update_calendar_item_one_off_timed(
  p_calendar_item_id uuid,
  p_one_off_title text,
  p_one_off_task_type text,
  p_start_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_needed_count integer,
  p_schedule_notes text,
  p_custom_values jsonb,
  p_expected_updated_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  current_updated_at timestamp with time zone;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null
    or p_calendar_item_id is null
    or p_expected_updated_at is null
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

  select item.updated_at
  into current_updated_at
  from public.calendar_items as item
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.task_preset_id is null
    and item.schedule_kind = 'timed'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = item.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['calendar.edit']::text[]
        and (item.publication_state = 'published' or item.created_by_project_contact_id = contact.id)
    )
  for update;

  if current_updated_at is null then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;
  if current_updated_at <> p_expected_updated_at then
    raise exception 'Calendar item changed while editing.'
      using errcode = '40001', detail = 'calendar_item_edit_conflict';
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
  where item.id = p_calendar_item_id;
  return p_calendar_item_id;
end;
$$;

alter function public.update_calendar_item_one_off_timed(
  uuid, text, text, date, time without time zone, time without time zone,
  integer, text, jsonb, timestamp with time zone
) owner to postgres;
revoke all on function public.update_calendar_item_one_off_timed(
  uuid, text, text, date, time without time zone, time without time zone,
  integer, text, jsonb, timestamp with time zone
) from public, anon, authenticated, service_role;
grant execute on function public.update_calendar_item_one_off_timed(
  uuid, text, text, date, time without time zone, time without time zone,
  integer, text, jsonb, timestamp with time zone
) to authenticated, service_role;

drop function public.update_calendar_item_preset_timed(
  uuid, date, time without time zone, time without time zone, integer, text, jsonb
);

create function public.update_calendar_item_preset_timed(
  p_calendar_item_id uuid,
  p_start_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_needed_count integer,
  p_schedule_notes text,
  p_custom_values jsonb,
  p_expected_updated_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  current_updated_at timestamp with time zone;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null
    or p_calendar_item_id is null
    or p_expected_updated_at is null
    or p_start_date is null
    or p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
    or p_needed_count is null
    or p_needed_count not between 0 and 99
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
  then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;

  select item.updated_at
  into current_updated_at
  from public.calendar_items as item
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.task_preset_id is not null
    and item.schedule_kind = 'timed'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact on contact.id = grant_row.project_contact_id
      where grant_row.workspace_id = item.workspace_id
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['calendar.edit']::text[]
        and (item.publication_state = 'published' or item.created_by_project_contact_id = contact.id)
    )
  for update;

  if current_updated_at is null then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
  end if;
  if current_updated_at <> p_expected_updated_at then
    raise exception 'Calendar item changed while editing.'
      using errcode = '40001', detail = 'calendar_item_edit_conflict';
  end if;

  update public.calendar_items as item
  set schedule_kind = 'timed',
      start_date = p_start_date,
      end_date = null,
      start_time = p_start_time,
      end_time = p_end_time,
      needed_count = p_needed_count,
      schedule_notes = nullif(btrim(p_schedule_notes), ''),
      custom_values = p_custom_values
  where item.id = p_calendar_item_id;
  return p_calendar_item_id;
end;
$$;

alter function public.update_calendar_item_preset_timed(
  uuid, date, time without time zone, time without time zone, integer, text,
  jsonb, timestamp with time zone
) owner to postgres;
revoke all on function public.update_calendar_item_preset_timed(
  uuid, date, time without time zone, time without time zone, integer, text,
  jsonb, timestamp with time zone
) from public, anon, authenticated, service_role;
grant execute on function public.update_calendar_item_preset_timed(
  uuid, date, time without time zone, time without time zone, integer, text,
  jsonb, timestamp with time zone
) to authenticated, service_role;

drop function public.update_task_preset_color(uuid, text);

create function public.update_task_preset_color(
  p_preset_id uuid,
  p_color_key text,
  p_expected_updated_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  current_updated_at timestamp with time zone;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null
    or p_expected_updated_at is null
    or p_color_key not in ('blue','sky','cyan','teal','emerald','green','lime','yellow','gold','orange','coral','red','rose','pink','magenta','violet','purple','indigo','navy','slate','graphite','sand')
  then
    raise exception 'Task preset color update is unavailable.' using errcode = '42501';
  end if;

  select preset.updated_at
  into current_updated_at
  from public.task_presets as preset
  where preset.id = p_preset_id
    and preset.lifecycle = 'active'
    and exists (
      select 1
      from public.workspace_contact_grants as grant_row
      join public.project_contacts as contact on contact.id = grant_row.project_contact_id
      join public.workspaces as workspace on workspace.id = grant_row.workspace_id
      where grant_row.workspace_id = preset.workspace_id
        and workspace.lifecycle = 'active'
        and contact.auth_user_id = caller_user_id
        and contact.status = 'active'
        and grant_row.status = 'active'
        and grant_row.revoked_at is null
        and grant_row.valid_from <= now()
        and (grant_row.valid_until is null or grant_row.valid_until > now())
        and grant_row.capabilities @> array['tasks.edit']::text[]
    )
  for update;

  if current_updated_at is null then
    raise exception 'Task preset color update is unavailable.' using errcode = '42501';
  end if;
  if current_updated_at <> p_expected_updated_at then
    raise exception 'Task preset changed while editing.'
      using errcode = '40001', detail = 'task_preset_edit_conflict';
  end if;

  update public.task_presets as preset
  set color_key = p_color_key
  where preset.id = p_preset_id;
  return p_preset_id;
end;
$$;

alter function public.update_task_preset_color(uuid, text, timestamp with time zone) owner to postgres;
revoke all on function public.update_task_preset_color(uuid, text, timestamp with time zone)
  from public, anon, authenticated, service_role;
grant execute on function public.update_task_preset_color(uuid, text, timestamp with time zone)
  to authenticated, service_role;

drop function public.save_calendar_meal(
  uuid, uuid, text, date, time without time zone, time without time zone,
  text, text, text, integer, text
);

create function public.save_calendar_meal(
  p_workspace_id uuid,
  p_calendar_item_id uuid,
  p_meal_kind text,
  p_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_provider text,
  p_contact text,
  p_menu text,
  p_total integer,
  p_notes text,
  p_expected_updated_at timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  item_id uuid;
  item_kind text;
  meal_preset_id uuid;
  current_updated_at timestamp with time zone;
begin
  select contact.id into actor_id
  from public.project_contacts contact
  join public.workspace_contact_grants grant_row on grant_row.project_contact_id = contact.id
  join public.workspaces workspace on workspace.id = grant_row.workspace_id
  where contact.auth_user_id = auth.uid()
    and contact.status = 'active'
    and workspace.id = p_workspace_id
    and workspace.lifecycle = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['workspace.read', 'calendar.edit']::text[]
  limit 1;
  if actor_id is null then
    raise exception 'Meal editing unavailable.' using errcode = '42501';
  end if;
  if p_meal_kind is null
    or p_meal_kind not in ('breakfast', 'lunch')
    or p_date is null
    or ((p_start_time is null) <> (p_end_time is null))
    or (p_start_time is not null and p_end_time <= p_start_time)
    or (p_total is not null and p_total not between 0 and 100000)
    or char_length(coalesce(p_provider, '')) > 300
    or char_length(coalesce(p_contact, '')) > 500
    or char_length(coalesce(p_menu, '')) > 2000
    or char_length(coalesce(p_notes, '')) > 4000
  then
    raise exception 'Invalid meal details.' using errcode = '22023';
  end if;

  select preset.id into meal_preset_id
  from public.task_presets as preset
  where preset.workspace_id = p_workspace_id
    and preset.lifecycle = 'active'
    and preset.is_system_preset = true
    and preset.system_key = p_meal_kind
    and preset.task_type = 'food';
  if meal_preset_id is null then
    raise exception 'Meal task preset is unavailable.' using errcode = '42501';
  end if;

  item_kind := case when p_start_time is null then 'date_based' else 'timed' end;
  if p_calendar_item_id is null then
    if p_expected_updated_at is not null then
      raise exception 'Invalid meal details.' using errcode = '22023';
    end if;
    item_id := public.create_calendar_item(
      p_workspace_id, meal_preset_id, null, null, item_kind, p_date, null,
      p_start_time, p_end_time, 0, nullif(btrim(p_notes), ''), '{}'::jsonb
    );
    perform public.publish_calendar_item(item_id);
  else
    if p_expected_updated_at is null then
      raise exception 'Invalid meal details.' using errcode = '22023';
    end if;
    select item.id, item.updated_at
    into item_id, current_updated_at
    from public.calendar_items as item
    where item.id = p_calendar_item_id
      and item.workspace_id = p_workspace_id
      and item.lifecycle = 'active'
      and item.meal_kind is not null
      and item.publication_state = 'published'
    for update;
    if item_id is null then
      raise exception 'Meal editing unavailable.' using errcode = '42501';
    end if;
    if current_updated_at <> p_expected_updated_at then
      raise exception 'Calendar item changed while editing.'
        using errcode = '40001', detail = 'calendar_item_edit_conflict';
    end if;
  end if;

  update public.calendar_items
  set meal_kind = p_meal_kind,
      task_preset_id = meal_preset_id,
      title_snapshot = case when p_meal_kind = 'breakfast' then 'Breakfast' else 'Lunch' end,
      task_type_snapshot = 'food',
      start_date = p_date,
      schedule_kind = item_kind,
      start_time = p_start_time,
      end_time = p_end_time,
      meal_provider = nullif(btrim(p_provider), ''),
      meal_contact = nullif(btrim(p_contact), ''),
      meal_menu = nullif(btrim(p_menu), ''),
      meal_total = p_total,
      needed_count = 0,
      schedule_notes = nullif(btrim(p_notes), '')
  where id = item_id;
  return item_id;
end;
$$;

alter function public.save_calendar_meal(
  uuid, uuid, text, date, time without time zone, time without time zone,
  text, text, text, integer, text, timestamp with time zone
) owner to postgres;
revoke all on function public.save_calendar_meal(
  uuid, uuid, text, date, time without time zone, time without time zone,
  text, text, text, integer, text, timestamp with time zone
) from public, anon, authenticated, service_role;
grant execute on function public.save_calendar_meal(
  uuid, uuid, text, date, time without time zone, time without time zone,
  text, text, text, integer, text, timestamp with time zone
) to authenticated, service_role;

commit;
