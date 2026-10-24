-- 12.57E: disambiguate the sync loop record from its SQL assignment alias.
-- No timing, authorization, activation, history, transport or scheduler change.
begin;
set local search_path='';
do $$
declare definition text;
begin
 if current_user <> 'postgres'
  or (select count(*) from supabase_migrations.schema_migrations) <> 55
  or (select max(version) from supabase_migrations.schema_migrations) <> '20261022120000' then
  raise exception 'Expected owner and exact migration55 baseline';
 end if;
 if not exists(select 1 from public.assignment_reminder_activation where singleton and not delivery_enabled) then
  raise exception 'Reminder worker correction requires delivery Off';
 end if;
 -- Windows local fixtures may retain CRLF; all non-line-ending bytes must match.
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_catalog.pg_proc where oid='public.run_assignment_reminder_worker(text,jsonb)'::regprocedure)
    is distinct from '6bf562e67dadd71de5f20455286a3163' then
  raise exception 'Unexpected reminder worker source; review before correction';
 end if;
 select pg_get_functiondef('public.run_assignment_reminder_worker(text,jsonb)'::regprocedure) into definition;
 definition := replace(definition, 'cursor_id uuid; a record;', 'cursor_id uuid; assignment_row record;');
 definition := replace(definition, 'for a in with future_items', 'for assignment_row in with future_items');
 definition := replace(definition, 'sync_assignment_reminder(a.id,clock_at);cursor_id:=a.id;',
  'sync_assignment_reminder(assignment_row.id,clock_at);cursor_id:=assignment_row.id;');
 if position('assignment_row record;' in definition)=0
  or position('for assignment_row in with future_items' in definition)=0
  or position('sync_assignment_reminder(assignment_row.id,clock_at);cursor_id:=assignment_row.id;' in definition)=0 then
  raise exception 'Reminder worker correction target missing';
 end if;
 -- CREATE OR REPLACE retains the existing owner, ACL, signature and settings.
 execute definition;
end $$;
commit;
