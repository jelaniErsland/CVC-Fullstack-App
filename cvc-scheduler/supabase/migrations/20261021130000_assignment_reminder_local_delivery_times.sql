-- 12.57B: fixed project-local reminder clocks. No activation, backfill, jobs or delivery.
begin;
do $$ begin
 if not exists(select 1 from public.assignment_reminder_activation where singleton and not delivery_enabled and baseline_at is null)
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events) then
   raise exception 'Reminder timing change requires disabled, unactivated reminders with no history';
 end if;
end $$;

-- Both scheduling and the SELECT-only preview use this owner-only helper.
create or replace function public.assignment_reminder_local_offset(p_instant timestamptz,p_zone text,p_days integer) returns timestamptz
language sql immutable security invoker set search_path='' as $$
select (((p_instant at time zone p_zone)::date + p_days) + case when p_days = -1 then time '17:00' else time '09:00' end) at time zone p_zone
$$;

commit;
