-- Additive read-only rollback; preserves every reminder and all delivery history.
begin;
drop function public.read_assignment_reminder_workspace(uuid,text,text,jsonb,integer);
delete from supabase_migrations.schema_migrations where version='20261026120000';
commit;
