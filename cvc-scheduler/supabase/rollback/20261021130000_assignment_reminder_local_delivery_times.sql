-- Empty, unactivated rollback only; preserve all reminder history.
begin;
do $$ begin
 if not exists(select 1 from public.assignment_reminder_activation where singleton and not delivery_enabled and baseline_at is null)
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events) then
   raise exception 'Reminder timing change requires disabled, unactivated reminders with no history';
 end if;
end $$;
do $$ begin if exists(select 1 from supabase_migrations.schema_migrations where version>'20261021130000') then raise exception 'Later migrations prevent rollback';end if;end $$;
create or replace function public.assignment_reminder_local_offset(p_instant timestamptz,p_zone text,p_days integer) returns timestamptz
language sql immutable security invoker set search_path='' as $$
select ((p_instant at time zone p_zone) + make_interval(days=>p_days)) at time zone p_zone
$$;

delete from supabase_migrations.schema_migrations where version='20261021130000';
commit;
