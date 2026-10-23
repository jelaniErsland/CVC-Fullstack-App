-- Empty, unactivated infrastructure rollback ONLY. Never erase real history.
begin;
do $$ begin
 if current_user<>'postgres' then raise exception 'Owner-only infrastructure rollback' using errcode='42501';end if;
 if (select count(*) from supabase_migrations.schema_migrations)<>55
  or (select max(version) from supabase_migrations.schema_migrations)<>'20261022120000'
  or exists(select 1 from public.assignment_reminder_activation where delivery_enabled or baseline_at is not null)
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events)
  or exists(select 1 from public.communication_operations where kind='reminder') then
  raise exception 'Activated/history-bearing infrastructure requires forward recovery, not destructive rollback';
 end if;
end $$;
drop function project_local_reminder_infrastructure.activate_delivery(text);
drop schema project_local_reminder_infrastructure;
delete from supabase_migrations.schema_migrations where version='20261022120000';
commit;
