-- Phase B1 setup, AFTER migration + healthy guarded deployment + Vault provisioning.
-- This installs the clock. It does not activate, enroll, claim or send.
begin;
do $$ begin
 if current_user<>'postgres' then raise exception 'Owner-only scheduler setup' using errcode='42501';end if;
 if (select max(version) from supabase_migrations.schema_migrations)<>'20261022120000' then raise exception 'Unexpected migration baseline';end if;
 if not exists(select 1 from public.assignment_reminder_activation where singleton and not delivery_enabled and baseline_at is null)
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events) then raise exception 'Reminders must remain Off and unactivated';end if;
 if exists(select 1 from cron.job where jobname='project-local-assignment-reminders') then raise exception 'Reminder scheduler already exists; inspect rather than duplicate';end if;
 if (select count(*) from vault.decrypted_secrets where name='project_local_reminder_worker_secret' and octet_length(decrypted_secret)=64)<>1 then raise exception 'Reminder request secret missing';end if;
end $$;
select cron.schedule('project-local-assignment-reminders','*/5 * * * *',
 'select project_local_reminder_infrastructure.invoke_worker();');
commit;
