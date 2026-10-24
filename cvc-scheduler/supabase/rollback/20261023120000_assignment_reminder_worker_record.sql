-- Owner-controlled empty-state rollback only. It restores the known broken sync
-- implementation, so delivery MUST stay Off and Cron paused after this rollback.
begin;
set local search_path='';
do $$
declare definition text;
begin
 if current_user <> 'postgres'
  or (select count(*) from supabase_migrations.schema_migrations) <> 56
  or (select max(version) from supabase_migrations.schema_migrations) <> '20261023120000' then
  raise exception 'Expected owner and exact migration56 baseline';
 end if;
 if not exists(select 1 from public.assignment_reminder_activation where singleton and not delivery_enabled)
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events)
  or exists(select 1 from public.communication_operations where kind='reminder') then
  raise exception 'Enabled/history-bearing reminders require forward recovery; rollback refused';
 end if;
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_catalog.pg_proc where oid='public.run_assignment_reminder_worker(text,jsonb)'::regprocedure)
    is distinct from '6084fe5cceeb9b457d28d908c23a0ff8' then
  raise exception 'Unexpected corrected worker source; rollback refused';
 end if;
 select pg_get_functiondef('public.run_assignment_reminder_worker(text,jsonb)'::regprocedure) into definition;
 definition := replace(definition,'assignment_row record;','a record;');
 definition := replace(definition,'for assignment_row in with future_items','for a in with future_items');
 definition := replace(definition,'sync_assignment_reminder(assignment_row.id,clock_at);cursor_id:=assignment_row.id;',
  'sync_assignment_reminder(a.id,clock_at);cursor_id:=a.id;');
 execute definition;
end $$;
delete from supabase_migrations.schema_migrations where version='20261023120000';
commit;
