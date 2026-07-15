-- Iteration 12.17: Calendar task-preset source selection and one-off definition path.
-- Adds the narrow preset-backed timed edit RPC used by the Calendar UI.
-- Tasks route cutover, assignments, publication, delivery, recurrence, drag/drop,
-- resize, copy, and delete remain out of scope.

create function public.update_calendar_item_preset_timed(
  p_calendar_item_id uuid,
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
    or not public.calendar_custom_values_are_valid(p_custom_values)
    or (p_schedule_notes is not null and char_length(btrim(p_schedule_notes)) not between 1 and 4000)
  then
    raise exception 'Calendar item update is unavailable.' using errcode = '42501';
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
  where item.id = p_calendar_item_id
    and item.lifecycle = 'active'
    and item.task_preset_id is not null
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

revoke all on function public.update_calendar_item_preset_timed(
  uuid, date, time without time zone, time without time zone, integer, text, jsonb
) from public;
grant execute on function public.update_calendar_item_preset_timed(
  uuid, date, time without time zone, time without time zone, integer, text, jsonb
) to authenticated;
