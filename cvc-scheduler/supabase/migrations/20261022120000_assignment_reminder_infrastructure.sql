-- 12.57C: external Cloudflare clock. Owner ignition support ONLY.
-- No password, extension, scheduler, JWT, enrollment or provider installation.
begin;
do $$ begin
 if current_user<>'postgres' then raise exception 'Owner-only infrastructure installation' using errcode='42501';end if;
 if (select count(*) from supabase_migrations.schema_migrations)<>54
  or (select max(version) from supabase_migrations.schema_migrations)<>'20261021130000' then
  raise exception 'Expected exact migration54 baseline';
 end if;
 if not exists(select 1 from public.assignment_reminder_activation where singleton and not delivery_enabled and baseline_at is null)
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events)
  or exists(select 1 from public.communication_operations where kind='reminder') then
  raise exception 'Reminder infrastructure requires disabled, unactivated reminders with no history';
 end if;
end $$;
-- A passwordless login is inert until separate owner-controlled provisioning.
-- Refuse an unexpected existing identity rather than adopting its privileges.
create role project_local_reminder_runner login noinherit nosuperuser nocreatedb
 nocreaterole noreplication nobypassrls connection limit 2 password null;
grant project_local_reminder_worker to project_local_reminder_runner
 with inherit false, set true, admin false;
-- No direct business-table/function grants. PUBLIC catalogue visibility and
-- session-local temporary objects are explicit owner-approved PG exceptions.
create schema project_local_reminder_infrastructure authorization postgres;
revoke all on schema project_local_reminder_infrastructure from public,anon,authenticated,service_role,project_local_reminder_worker,project_local_reminder_runner;
-- FUTURE OWNER IGNITION ONLY. No application/system worker role can execute it.
-- Installation does not call it. Server time and the one-time state change are atomic.
create function project_local_reminder_infrastructure.activate_delivery(p_owner_confirmation text) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare baseline timestamptz:=statement_timestamp(); state public.assignment_reminder_activation%rowtype;
begin
 if current_user<>'postgres' or p_owner_confirmation is distinct from 'OWNER APPROVED AUTOMATIC REMINDER ACTIVATION' then
  raise exception 'Explicit owner activation required' using errcode='42501';
 end if;
 select * into strict state from public.assignment_reminder_activation where singleton for update;
 if state.delivery_enabled or state.baseline_at is not null
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events)
  or exists(select 1 from public.communication_operations where kind='reminder') then
  raise exception 'Activation baseline/history already exists; no reset or replay permitted';
 end if;
 update public.assignment_reminder_activation set baseline_at=baseline,delivery_enabled=true where singleton;
 return baseline;
end $$;
revoke all on all functions in schema project_local_reminder_infrastructure from public,anon,authenticated,service_role,project_local_reminder_worker,project_local_reminder_runner;
commit;
