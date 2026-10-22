-- Empty/unprovisioned migration rollback ONLY. Preserve real infrastructure/audit.
begin;
do $$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>55
  or (select max(version) from supabase_migrations.schema_migrations)<>'20261022120000'
  or exists(select 1 from public.assignment_reminder_activation where delivery_enabled or baseline_at is not null)
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events)
  or exists(select 1 from project_local_reminder_infrastructure.invocations)
  or exists(select 1 from cron.job)
  or exists(select 1 from vault.secrets where name like 'project_local_reminder_%') then
  raise exception 'Provisioned/history-bearing infrastructure requires forward recovery, not destructive rollback';
 end if;
end $$;
drop function project_local_reminder_infrastructure.activate_delivery(text);
drop function project_local_reminder_infrastructure.invoke_worker();
drop table project_local_reminder_infrastructure.invocations;
drop schema project_local_reminder_infrastructure;
drop extension pg_net;
drop extension pg_cron;
delete from supabase_migrations.schema_migrations where version='20261022120000';
commit;
