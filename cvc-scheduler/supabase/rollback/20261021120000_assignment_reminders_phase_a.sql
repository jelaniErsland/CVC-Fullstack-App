-- LOCAL/REVIEWED RECOVERY ONLY. Never discard reminders or delivery audit history.
begin;
do $$ begin
 if exists(select 1 from public.assignment_reminder_occurrences) or exists(select 1 from public.assignment_reminder_enrollments)
   or exists(select 1 from public.communication_operations where kind='reminder') then
   raise exception 'Reminder history exists. Disable worker and retain audit state; destructive rollback refused.';
 end if;
end $$;
do $$ declare s text; definition text; original text; begin
 foreach s in array array['claim_communication_recipient(uuid,boolean)','finalize_communication_recipient(uuid,uuid,text,text,text)'] loop
   select pg_get_functiondef(('public.'||s)::regprocedure) into definition;original:=definition;
   definition:=replace(definition,E'\n  if exists(select 1 from public.communication_recipients r join public.communication_operations o on o.id=r.operation_id where r.id=p_recipient_id and o.kind=''reminder'') then raise exception ''System-owned reminder.'' using errcode=''42501'';end if;','');
   if original=definition then raise exception 'Rollback guard target missing';end if;
   execute definition;
 end loop;
end $$;
do $$ declare definition text; original text; begin
 select pg_get_functiondef('public.read_communication_history(uuid)'::regprocedure) into definition;original:=definition;
 definition:=replace(definition,'where o.workspace_id=p_workspace_id and o.kind<>''reminder'' order by','where o.workspace_id=p_workspace_id order by');
 if original=definition then raise exception 'History rollback target missing.';end if;
 execute definition;
end $$;
drop index if exists public.assignment_reminder_coverage_anchor;
drop function public.run_assignment_reminder_worker(text,jsonb);
drop function public.read_assignment_reminders(uuid);
drop function public.assignment_reminder_report(uuid,timestamptz);
drop function public.finalize_assignment_reminder(uuid,uuid,text,text,timestamptz);
drop function public.assignment_reminder_dispatch_context(uuid,uuid,timestamptz);
drop function public.claim_assignment_reminder(uuid,timestamptz);
drop function public.sync_assignment_reminder(uuid,timestamptz);
drop function public.assignment_reminder_local_offset(timestamptz,text,integer);
drop function public.assignment_reminder_context(uuid,timestamptz);
drop table public.assignment_reminder_events;
drop table public.assignment_reminder_occurrences;
drop table public.assignment_reminder_enrollments;
drop table public.assignment_reminder_activation;
alter table public.communication_operations drop constraint communication_operations_actor_source;
alter table public.communication_operations alter column actor_id set not null;
alter table public.communication_operations drop constraint communication_operations_kind_check;
alter table public.communication_operations add constraint communication_operations_kind_check check(kind in ('welcome','schedule'));
alter table public.communication_operations drop constraint communication_operations_mode_check;
alter table public.communication_operations add constraint communication_operations_mode_check check(mode in ('new','all','resend'));
revoke usage on schema public from project_local_reminder_worker;
revoke project_local_reminder_worker from authenticator;
drop role project_local_reminder_worker;
delete from supabase_migrations.schema_migrations where version='20261021120000';
commit;
