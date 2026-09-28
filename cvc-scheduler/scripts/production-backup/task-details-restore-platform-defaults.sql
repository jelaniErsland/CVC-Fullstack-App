-- DISPOSABLE RESTORE TARGET ONLY, before replaying the native schema dump.
-- A fresh Supabase platform has permissive creator defaults. pg_dump describes
-- the source object's ACL, but does not revoke extra target-default grants.
-- Clear those defaults before object creation; the source schema dump restores
-- its explicit object ACLs and final creator defaults. Never apply to production.
alter default privileges for role postgres revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres revoke all on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated, service_role;
