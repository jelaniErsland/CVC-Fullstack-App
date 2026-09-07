-- Breakfast and Lunch are persisted system task presets in every existing workspace.
-- Fail closed if an active user preset already occupies either reserved display name.
alter table public.task_presets add column color_key text not null default 'blue';
alter table public.task_presets add constraint task_presets_color_key_valid check (
  color_key in ('blue','sky','cyan','teal','emerald','green','lime','yellow','gold','orange','coral','red','rose','pink','magenta','violet','purple','indigo','navy','slate','graphite','sand')
);

update public.task_presets
set color_key = case
  when system_key = 'breakfast' then 'orange'
  when system_key = 'lunch' then 'gold'
  when task_type = 'food' then 'teal'
  when task_type = 'security' then 'violet'
  when task_type = 'custom' then 'slate'
  else 'blue'
end;

do $$
begin
  if exists (
    select 1
    from public.workspaces as workspace
    cross join (values ('Breakfast', 'breakfast'), ('Lunch', 'lunch')) as required(name, system_key)
    join public.task_presets as preset
      on preset.workspace_id = workspace.id
      and lower(preset.name) = lower(required.name)
      and preset.lifecycle = 'active'
    where preset.is_system_preset = false or preset.system_key is distinct from required.system_key
  ) then
    raise exception 'Breakfast or Lunch task preset name is already in use.' using errcode = '23505';
  end if;
end;
$$;

insert into public.task_presets (
  workspace_id, name, description, task_type, default_needed_count,
  volunteer_visible, is_system_preset, system_key, custom_field_definitions, lifecycle, color_key
)
select workspace.id, required.name, null, 'food', 1,
  true, true, required.system_key, '[]'::jsonb, 'active', case when required.system_key = 'breakfast' then 'orange' else 'gold' end
from public.workspaces as workspace
cross join (values ('Breakfast', 'breakfast'), ('Lunch', 'lunch')) as required(name, system_key)
on conflict (workspace_id, system_key) where system_key is not null do nothing;

-- Associate already-saved 12.45 meal occurrences with their canonical preset.
-- Meal details, publication state, assignments and historical values are unchanged.
update public.calendar_items as item
set task_preset_id = preset.id
from public.task_presets as preset
where item.workspace_id = preset.workspace_id
  and item.meal_kind = preset.system_key
  and preset.is_system_preset = true
  and preset.task_type = 'food';

create or replace function public.save_calendar_meal(
  p_workspace_id uuid, p_calendar_item_id uuid, p_meal_kind text, p_date date,
  p_start_time time, p_end_time time, p_provider text, p_contact text,
  p_menu text, p_total integer, p_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid;
  item_id uuid;
  item_kind text;
  meal_preset_id uuid;
begin
  select contact.id into actor_id
  from public.project_contacts contact
  join public.workspace_contact_grants g on g.project_contact_id = contact.id
  join public.workspaces w on w.id = g.workspace_id
  where contact.auth_user_id = auth.uid() and contact.status = 'active'
    and w.id = p_workspace_id and w.lifecycle = 'active'
    and g.status = 'active' and g.revoked_at is null and g.valid_from <= now()
    and (g.valid_until is null or g.valid_until > now())
    and g.capabilities @> array['workspace.read', 'calendar.edit']::text[] limit 1;
  if actor_id is null then raise exception 'Meal editing unavailable.' using errcode = '42501'; end if;
  if p_meal_kind is null or p_meal_kind not in ('breakfast', 'lunch') or p_date is null
    or ((p_start_time is null) <> (p_end_time is null))
    or (p_start_time is not null and p_end_time <= p_start_time)
    or (p_total is not null and p_total not between 0 and 100000)
    or char_length(coalesce(p_provider,'')) > 300 or char_length(coalesce(p_contact,'')) > 500
    or char_length(coalesce(p_menu,'')) > 2000 or char_length(coalesce(p_notes,'')) > 4000
  then raise exception 'Invalid meal details.' using errcode = '22023'; end if;

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
    item_id := public.create_calendar_item(p_workspace_id, meal_preset_id,
      null, null, item_kind, p_date, null, p_start_time, p_end_time,
      0, nullif(btrim(p_notes), ''), '{}'::jsonb);
    perform public.publish_calendar_item(item_id);
  else
    select id into item_id from public.calendar_items
    where id = p_calendar_item_id and workspace_id = p_workspace_id
      and lifecycle = 'active' and meal_kind is not null and publication_state = 'published'
    for update;
    if item_id is null then raise exception 'Meal editing unavailable.' using errcode = '42501'; end if;
  end if;
  update public.calendar_items set meal_kind = p_meal_kind,
    task_preset_id = meal_preset_id,
    title_snapshot = case when p_meal_kind = 'breakfast' then 'Breakfast' else 'Lunch' end,
    task_type_snapshot = 'food', start_date = p_date, schedule_kind = item_kind,
    start_time = p_start_time, end_time = p_end_time,
    meal_provider = nullif(btrim(p_provider), ''), meal_contact = nullif(btrim(p_contact), ''),
    meal_menu = nullif(btrim(p_menu), ''), meal_total = p_total,
    needed_count = 0, schedule_notes = nullif(btrim(p_notes), '')
  where id = item_id;
  return item_id;
end;
$$;

revoke all on function public.save_calendar_meal(uuid,uuid,text,date,time,time,text,text,text,integer,text) from public, anon;
grant execute on function public.save_calendar_meal(uuid,uuid,text,date,time,time,text,text,text,integer,text) to authenticated, service_role;

-- Extend the existing independent-item repeat command so meal system presets use
-- the same range/weekday transaction as every other task. This is not a series:
-- only independent calendar_items and the existing idempotency receipt are saved.
drop function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb
);

create function public.create_current_workspace_repeated_calendar_items(
  p_request_key uuid,
  p_task_preset_id uuid,
  p_one_off_title text,
  p_one_off_task_type text,
  p_start_date date,
  p_end_date date,
  p_weekdays smallint[],
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_needed_count integer,
  p_schedule_notes text,
  p_custom_values jsonb,
  p_meal_kind text,
  p_meal_provider text,
  p_meal_contact text,
  p_meal_menu text,
  p_meal_total integer
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_user_id uuid;
  target_workspace_ids uuid[];
  target_contact_ids uuid[];
  target_workspace_id uuid;
  actor_project_contact_id uuid;
  target_timezone text;
  item_title text;
  item_task_type text;
  preset_system_key text;
  preset_is_system boolean;
  generated_dates date[];
  created_ids uuid[];
  normalized_weekdays smallint[];
begin
  caller_user_id := auth.uid();
  if caller_user_id is null
    or p_request_key is null
    or p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or p_start_time is null
    or p_end_time is null
    or p_end_time <= p_start_time
    or p_needed_count not between 0 and 99
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
  then
    raise exception 'Repeat scheduling is unavailable.' using errcode = '42501';
  end if;

  if p_meal_kind is null then
    if p_meal_provider is not null or p_meal_contact is not null
      or p_meal_menu is not null or p_meal_total is not null
    then
      raise exception 'Repeat meal details are invalid.' using errcode = '22023';
    end if;
  elsif p_meal_kind not in ('breakfast', 'lunch')
    or p_task_preset_id is null
    or p_one_off_title is not null
    or p_one_off_task_type is not null
    or p_custom_values <> '{}'::jsonb
    or (p_meal_total is not null and p_meal_total not between 0 and 100000)
    or char_length(coalesce(p_meal_provider, '')) > 300
    or char_length(coalesce(p_meal_contact, '')) > 500
    or char_length(coalesce(p_meal_menu, '')) > 2000
  then
    raise exception 'Repeat meal details are invalid.' using errcode = '22023';
  end if;

  select array_agg(distinct grant_row.workspace_id), array_agg(distinct contact.id)
  into target_workspace_ids, target_contact_ids
  from public.workspace_contact_grants as grant_row
  join public.project_contacts as contact on contact.id = grant_row.project_contact_id
  join public.workspaces as workspace on workspace.id = grant_row.workspace_id
  where contact.auth_user_id = caller_user_id
    and contact.status = 'active'
    and workspace.lifecycle = 'active'
    and grant_row.status = 'active'
    and grant_row.revoked_at is null
    and grant_row.valid_from <= now()
    and (grant_row.valid_until is null or grant_row.valid_until > now())
    and grant_row.capabilities @> array['workspace.read', 'calendar.edit']::text[];

  if coalesce(array_length(target_workspace_ids, 1), 0) <> 1
    or coalesce(array_length(target_contact_ids, 1), 0) <> 1
  then
    raise exception 'Repeat scheduling is unavailable.' using errcode = '42501';
  end if;

  target_workspace_id := target_workspace_ids[1];
  actor_project_contact_id := target_contact_ids[1];

  select workspace.timezone into target_timezone
  from public.workspaces as workspace
  where workspace.id = target_workspace_id and workspace.lifecycle = 'active';

  select array_agg(distinct weekday order by weekday)
  into normalized_weekdays
  from unnest(coalesce(p_weekdays, array[]::smallint[])) as selected(weekday)
  where weekday between 0 and 6;

  if target_timezone is null
    or coalesce(cardinality(normalized_weekdays), 0) <> coalesce(cardinality(p_weekdays), 0)
    or coalesce(cardinality(normalized_weekdays), 0) = 0
  then
    raise exception 'Repeat scheduling is unavailable.' using errcode = '42501';
  end if;

  select request.created_item_ids into created_ids
  from public.calendar_repeat_creation_requests as request
  where request.workspace_id = target_workspace_id and request.request_key = p_request_key;
  if created_ids is not null then
    return created_ids;
  end if;

  if p_task_preset_id is not null then
    if p_one_off_title is not null or p_one_off_task_type is not null then
      raise exception 'Repeat scheduling task source is invalid.' using errcode = '22023';
    end if;
    select preset.name, preset.task_type, preset.system_key, preset.is_system_preset
    into item_title, item_task_type, preset_system_key, preset_is_system
    from public.task_presets as preset
    where preset.id = p_task_preset_id
      and preset.workspace_id = target_workspace_id
      and preset.lifecycle = 'active';
    if item_title is null then
      raise exception 'Repeat scheduling task source is unavailable.' using errcode = '42501';
    end if;
  else
    if p_one_off_title is null
      or char_length(btrim(p_one_off_title)) not between 1 and 160
      or p_one_off_task_type not in ('general', 'food', 'security', 'custom')
    then
      raise exception 'Repeat scheduling task source is invalid.' using errcode = '22023';
    end if;
    item_title := btrim(p_one_off_title);
    item_task_type := p_one_off_task_type;
  end if;

  if p_meal_kind is null then
    if preset_system_key in ('breakfast', 'lunch') then
      raise exception 'Meal preset requires meal details.' using errcode = '22023';
    end if;
  elsif preset_is_system is distinct from true
    or preset_system_key is distinct from p_meal_kind
    or item_task_type is distinct from 'food'
  then
    raise exception 'Meal task preset is unavailable.' using errcode = '42501';
  end if;

  select array_agg(series_date::date order by series_date)
  into generated_dates
  from generate_series(p_start_date, p_end_date, interval '1 day') as generated(series_date)
  where extract(dow from series_date)::smallint = any(normalized_weekdays);

  if coalesce(cardinality(generated_dates), 0) not between 1 and 100 then
    raise exception 'Repeat scheduling date range is unavailable.' using errcode = '22023';
  end if;

  with inserted as (
    insert into public.calendar_items (
      workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
      schedule_kind, start_date, end_date, start_time, end_time, timezone,
      needed_count, schedule_notes, custom_values, lifecycle,
      follow_up_project_contact_id, created_by_project_contact_id,
      publication_state, published_at, published_by_project_contact_id,
      meal_kind, meal_provider, meal_contact, meal_menu, meal_total
    )
    select
      target_workspace_id, p_task_preset_id, item_title, item_task_type,
      'timed', selected_date, null, p_start_time, p_end_time, target_timezone,
      case when p_meal_kind is null then p_needed_count else 0 end,
      nullif(btrim(p_schedule_notes), ''), p_custom_values, 'active',
      actor_project_contact_id, actor_project_contact_id,
      case when p_meal_kind is null then 'draft' else 'published' end,
      case when p_meal_kind is null then null else now() end,
      case when p_meal_kind is null then null else actor_project_contact_id end,
      p_meal_kind, nullif(btrim(p_meal_provider), ''), nullif(btrim(p_meal_contact), ''),
      nullif(btrim(p_meal_menu), ''), p_meal_total
    from unnest(generated_dates) as selected(selected_date)
    returning id, start_date
  )
  select array_agg(id order by start_date) into created_ids from inserted;

  insert into public.calendar_repeat_creation_requests (
    workspace_id, request_key, created_by_project_contact_id, created_item_ids
  ) values (
    target_workspace_id, p_request_key, actor_project_contact_id, created_ids
  );

  return created_ids;
end;
$$;

alter function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb, text, text, text, text, integer
) owner to postgres;
revoke all on function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb, text, text, text, text, integer
) from public, anon, authenticated, service_role;
grant execute on function public.create_current_workspace_repeated_calendar_items(
  uuid, uuid, text, text, date, date, smallint[], time without time zone,
  time without time zone, integer, text, jsonb, text, text, text, text, integer
) to authenticated, service_role;

-- Task colors belong to reusable presets. Calendar occurrences intentionally
-- retain only their preset reference, so a later color change is reflected everywhere.
drop function public.create_task_preset(uuid, text, text, text, integer, boolean, jsonb);
create function public.create_task_preset(
  p_workspace_id uuid, p_name text, p_description text, p_task_type text,
  p_default_needed_count integer, p_volunteer_visible boolean,
  p_custom_field_definitions jsonb, p_color_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_user_id uuid; created_preset_id uuid;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null or p_name is null or char_length(btrim(p_name)) not between 1 and 160
    or (p_description is not null and char_length(btrim(p_description)) not between 1 and 2000)
    or p_task_type not in ('general','food','security','custom')
    or p_default_needed_count not between 1 and 99 or p_volunteer_visible is null
    or p_color_key not in ('blue','sky','cyan','teal','emerald','green','lime','yellow','gold','orange','coral','red','rose','pink','magenta','violet','purple','indigo','navy','slate','graphite','sand')
    or not public.task_custom_field_definitions_are_valid(p_custom_field_definitions)
    or not exists (select 1 from public.workspaces w join public.workspace_contact_grants g on g.workspace_id=w.id join public.project_contacts c on c.id=g.project_contact_id
      where w.id=p_workspace_id and w.lifecycle='active' and c.auth_user_id=caller_user_id and c.status='active'
        and g.status='active' and g.revoked_at is null and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now()) and g.capabilities @> array['tasks.edit']::text[])
  then raise exception 'Task preset creation is unavailable.' using errcode='42501'; end if;
  insert into public.task_presets (workspace_id,name,description,task_type,default_needed_count,volunteer_visible,is_system_preset,system_key,custom_field_definitions,lifecycle,color_key)
  values (p_workspace_id,btrim(p_name),nullif(btrim(p_description),''),p_task_type,p_default_needed_count,p_volunteer_visible,false,null,p_custom_field_definitions,'active',p_color_key)
  returning id into created_preset_id;
  return created_preset_id;
end;
$$;
alter function public.create_task_preset(uuid,text,text,text,integer,boolean,jsonb,text) owner to postgres;
revoke all on function public.create_task_preset(uuid,text,text,text,integer,boolean,jsonb,text) from public, anon, authenticated, service_role;
grant execute on function public.create_task_preset(uuid,text,text,text,integer,boolean,jsonb,text) to authenticated, service_role;

create function public.update_task_preset_color(p_preset_id uuid, p_color_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare caller_user_id uuid; updated_preset_id uuid;
begin
  caller_user_id := auth.uid();
  if caller_user_id is null or p_color_key not in ('blue','sky','cyan','teal','emerald','green','lime','yellow','gold','orange','coral','red','rose','pink','magenta','violet','purple','indigo','navy','slate','graphite','sand') then
    raise exception 'Task preset color update is unavailable.' using errcode='42501';
  end if;
  update public.task_presets preset set color_key=p_color_key
  where preset.id=p_preset_id and preset.lifecycle='active' and exists (
    select 1 from public.workspace_contact_grants g join public.project_contacts c on c.id=g.project_contact_id join public.workspaces w on w.id=g.workspace_id
    where g.workspace_id=preset.workspace_id and w.lifecycle='active' and c.auth_user_id=caller_user_id and c.status='active'
      and g.status='active' and g.revoked_at is null and g.valid_from<=now() and (g.valid_until is null or g.valid_until>now()) and g.capabilities @> array['tasks.edit']::text[])
  returning id into updated_preset_id;
  if updated_preset_id is null then raise exception 'Task preset color update is unavailable.' using errcode='42501'; end if;
  return updated_preset_id;
end;
$$;
alter function public.update_task_preset_color(uuid,text) owner to postgres;
revoke all on function public.update_task_preset_color(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.update_task_preset_color(uuid,text) to authenticated, service_role;

-- Keep the trusted bearer projection on the same preset-owned color source as
-- authenticated Calendar reads. The audience and all token checks are unchanged.
create or replace function public.read_project_quick_view_by_token(p_bearer_token text, p_project_date date default null)
returns table (access_state text, workspace_display_name text, workspace_timezone text, project_date date, project_starts_on date, project_ends_on date, token_expires_at timestamptz, expected_on_site_count integer, schedule_sources jsonb)
language plpgsql security definer set search_path = '' as $$
declare verified_token_id uuid; verified_workspace_id uuid; verified_workspace_name text; verified_workspace_timezone text; verified_project_starts_on date; verified_project_ends_on date; verified_token_expires_at timestamptz; selected_date date;
begin
  if p_bearer_token is null or char_length(p_bearer_token) <> 43 or p_bearer_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return;
  end if;
  select token.id,token.workspace_id,workspace.display_name,workspace.timezone,workspace.starts_on,workspace.ends_on,token.expires_at
  into verified_token_id,verified_workspace_id,verified_workspace_name,verified_workspace_timezone,verified_project_starts_on,verified_project_ends_on,verified_token_expires_at
  from public.project_quick_view_access_tokens token join public.workspaces workspace on workspace.id=token.workspace_id
  where token.token_verifier_hash=extensions.digest(p_bearer_token,'sha256') and token.purpose='project_quick_view_access' and token.token_version=1 and token.revoked_at is null and token.expires_at>now() and workspace.lifecycle='active' and workspace.ends_on is not null and (now() at time zone workspace.timezone)::date<=workspace.ends_on limit 1;
  if verified_token_id is null then return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return; end if;
  selected_date:=coalesce(p_project_date,(now() at time zone verified_workspace_timezone)::date);
  if selected_date>verified_project_ends_on then return query select 'unavailable'::text,null::text,null::text,null::date,null::date,null::date,null::timestamptz,null::integer,'[]'::jsonb; return; end if;
  update public.project_quick_view_access_tokens set last_used_at=now() where id=verified_token_id;
  return query select 'ready'::text,verified_workspace_name,verified_workspace_timezone,selected_date,verified_project_starts_on,verified_project_ends_on,verified_token_expires_at,null::integer,coalesce(schedule.items,'[]'::jsonb)
  from (select 1) anchor left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id',item.id,'workspace_id',item.workspace_id,'task_preset_id',item.task_preset_id,'title_snapshot',item.title_snapshot,'task_type_snapshot',item.task_type_snapshot,'schedule_kind',item.schedule_kind,'start_date',item.start_date,'end_date',item.end_date,'start_time',item.start_time,'end_time',item.end_time,'timezone',item.timezone,'needed_count',item.needed_count,'schedule_notes',item.schedule_notes,'meal_kind',item.meal_kind,'meal_provider',item.meal_provider,'meal_contact',item.meal_contact,'meal_menu',item.meal_menu,'meal_total',item.meal_total,'lifecycle',item.lifecycle,'publication_state',item.publication_state,'published_at',item.published_at,'task_preset_label',preset.name,'task_preset_color_key',preset.color_key,'task_description',preset.description,'custom_values',item.custom_values,'assignments',coalesce(assigned.rows,'[]'::jsonb)
    ) order by item.start_date,item.start_time nulls last,item.title_snapshot,item.id) items
    from public.calendar_items item left join public.task_presets preset on preset.id=item.task_preset_id and preset.workspace_id=item.workspace_id
    left join lateral (select jsonb_agg(jsonb_build_object('assignmentId',a.id,'calendarItemId',item.id,'volunteerProfileId',v.id,'volunteerDisplayName',v.full_name,'responseStatus',coalesce(r.response_status,'needs_response')) order by v.full_name,a.id) rows from public.calendar_assignments a join public.volunteer_profiles v on v.id=a.volunteer_profile_id and v.workspace_id=item.workspace_id left join public.assignment_responses r on r.assignment_id=a.id and r.workspace_id=item.workspace_id where a.calendar_item_id=item.id and a.workspace_id=item.workspace_id and a.lifecycle='active') assigned on true
    where item.workspace_id=verified_workspace_id and item.lifecycle='active' and item.publication_state='published' and item.start_date<selected_date+42 and coalesce(item.end_date,item.start_date)>=selected_date-31
  ) schedule on true;
end;
$$;
alter function public.read_project_quick_view_by_token(text,date) owner to postgres;
revoke all on function public.read_project_quick_view_by_token(text,date) from public, anon, authenticated, service_role;
grant execute on function public.read_project_quick_view_by_token(text,date) to anon, authenticated, service_role;
