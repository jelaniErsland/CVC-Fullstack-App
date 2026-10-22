-- 12.57C Phase B1. Install clock/invocation support; NEVER activate or send.
begin;
do $$ begin
 if not exists(select 1 from public.assignment_reminder_activation where singleton and not delivery_enabled and baseline_at is null)
  or exists(select 1 from public.assignment_reminder_enrollments)
  or exists(select 1 from public.assignment_reminder_occurrences)
  or exists(select 1 from public.assignment_reminder_events)
  or exists(select 1 from public.communication_operations where kind='reminder') then
  raise exception 'Reminder infrastructure requires disabled, unactivated reminders with no history';
 end if;
 if exists(select 1 from pg_extension where extname in('pg_cron','pg_net')) then
  raise exception 'Unexpected existing Cron/network extension: review installation before migration';
 end if;
end $$;
create extension pg_cron;
create extension pg_net with schema extensions;
-- Newly installed extension APIs and transport queues are not application APIs.
revoke all on schema cron,net from public,anon,authenticated,service_role,project_local_reminder_worker;
revoke all on all functions in schema cron,net from public,anon,authenticated,service_role,project_local_reminder_worker;
revoke all on all tables in schema cron,net from public,anon,authenticated,service_role,project_local_reminder_worker;
revoke all on all sequences in schema cron,net from public,anon,authenticated,service_role,project_local_reminder_worker;
-- Managed extension objects can be owned by supabase_admin. A REVOKE by
-- postgres may only warn and leave owner-issued grants in place. Never commit
-- an installation whose effective privileges violate the secret boundary.
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated','service_role','project_local_reminder_worker'] loop
  if has_schema_privilege(role_name,'net','USAGE') or has_schema_privilege(role_name,'cron','USAGE')
   or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname in('cron','net') and c.relkind in('r','p')
     and (has_table_privilege(role_name,c.oid,'SELECT') or has_table_privilege(role_name,c.oid,'INSERT') or has_table_privilege(role_name,c.oid,'UPDATE') or has_table_privilege(role_name,c.oid,'DELETE'))) then
   raise exception 'STOP: managed Cron/pg_net grants require privileged security review before reminder infrastructure installation' using errcode='42501';
  end if;
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
   lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   where n.nspname in('cron','net') and a.grantee=0 and a.privilege_type='EXECUTE') then
  raise exception 'STOP: managed extension PUBLIC EXECUTE remains; privileged security review required' using errcode='42501';
 end if;
end $$;

create schema project_local_reminder_infrastructure authorization postgres;
revoke all on schema project_local_reminder_infrastructure from public,anon,authenticated,service_role,project_local_reminder_worker;
create table project_local_reminder_infrastructure.invocations(
 request_id bigint primary key,
 requested_at timestamptz not null default statement_timestamp()
);
alter table project_local_reminder_infrastructure.invocations enable row level security;
alter table project_local_reminder_infrastructure.invocations force row level security;
revoke all on project_local_reminder_infrastructure.invocations from public,anon,authenticated,service_role,project_local_reminder_worker;

-- Clock only: no volunteer data, eligibility, activation or provider logic.
create function project_local_reminder_infrastructure.invoke_worker() returns bigint
language plpgsql security invoker set search_path='' as $$
declare request_secret text; request_id bigint;
begin
 if current_user<>'postgres' then raise exception 'Owner-only infrastructure operation' using errcode='42501';end if;
 select decrypted_secret into strict request_secret from vault.decrypted_secrets where name='project_local_reminder_worker_secret';
 if octet_length(request_secret)<>64 or request_secret!~'^[0-9a-f]{64}$' then raise exception 'Reminder request credential unavailable';end if;
 select net.http_post(url:='https://projectlocal.app/internal/reminders',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||request_secret),
  body:='{}'::jsonb,timeout_milliseconds:=10000) into request_id;
 insert into project_local_reminder_infrastructure.invocations(request_id) values(request_id);
 -- Bound technical diagnostics; no reminder audit history is removed.
 delete from project_local_reminder_infrastructure.invocations where invocations.request_id in
  (select i.request_id from project_local_reminder_infrastructure.invocations i where requested_at<statement_timestamp()-interval '7 days' order by requested_at limit 1000);
 return request_id;
end $$;

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
revoke all on all functions in schema project_local_reminder_infrastructure from public,anon,authenticated,service_role,project_local_reminder_worker;
-- No Cron job or secret is created here. Reviewed setup installs the clock only
-- after the deployed private worker has passed an authenticated disabled run.
commit;
