"""Disconnected 57 -> 58 schema/data/ACL rollback proof; no hosted connection."""
from pathlib import Path
import subprocess
import hashlib
import time

ROOT = Path(__file__).resolve().parents[1]
NAME = "supabase_db_cvc-1262-replay"
IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.171"
files = sorted((ROOT / "supabase" / "migrations").glob("[0-9]" * 14 + "_*.sql"))
assert len(files) == 58 and files[-1].name == "20261028120000_volunteer_deletion_lifecycle.sql"

def command(args, source=None, ok=True):
    r = subprocess.run(args, input=source, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if ok and r.returncode:
        raise RuntimeError(r.stderr.decode(errors="replace")[-2500:])
    return r

def sql(source, ok=True):
    return command(["docker", "exec", "-i", NAME, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], source.encode(), ok)

def scalar(source):
    return sql(source).stdout.decode().strip()

def snapshot():
    return scalar("""select md5(jsonb_build_array(
      (select jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),p.proacl) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
      (select jsonb_agg(jsonb_build_array(c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.relname) from pg_class c where c.relnamespace='public'::regnamespace),
      (select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) order by conname) from pg_constraint where connamespace='public'::regnamespace),
      (select jsonb_agg(to_jsonb(t) order by tablename,policyname) from pg_policies t where schemaname='public'),
      (select jsonb_agg(to_jsonb(v) order by id) from public.volunteer_profiles v),
      (select jsonb_agg(to_jsonb(v) order by id) from public.calendar_assignments v),
      (select jsonb_agg(to_jsonb(v) order by id) from auth.users v),
      (select jsonb_agg(to_jsonb(v) order by singleton) from public.assignment_reminder_activation v)
    )::text)""")

def stable_data():
    return scalar("""select md5(string_agg(schemaname||'.'||tablename||':'||(xpath('/row/hash/text()',query_to_xml(format(
      'select md5(coalesce(jsonb_agg(to_jsonb(t)-%L::text[] order by (to_jsonb(t)-%L::text[])::text)::text,''[]'')) hash from %I.%I t',
      case when schemaname='public' and tablename in('volunteer_profiles','calendar_assignments','communication_recipients','volunteer_welcome_deliveries','assignment_notification_deliveries','questionnaire_submissions') then '{deleted_at,deleted_by,removal_reason,recipient_redacted_at,personal_data_redacted_at}' else '{}' end,
      case when schemaname='public' and tablename in('volunteer_profiles','calendar_assignments','communication_recipients','volunteer_welcome_deliveries','assignment_notification_deliveries','questionnaire_submissions') then '{deleted_at,deleted_by,removal_reason,recipient_redacted_at,personal_data_redacted_at}' else '{}' end,
      schemaname,tablename),false,true,'')))[1]::text,'|' order by schemaname,tablename))
      from pg_tables where schemaname in('public','auth')""")


def stable_security():
    return scalar("""select md5(jsonb_build_array(
      (select jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),pg_get_userbyid(p.proowner),p.proacl,p.prosecdef,p.proconfig) order by p.proname,pg_get_function_identity_arguments(p.oid))
        from pg_proc p where p.pronamespace='public'::regnamespace and p.proname not in('lock_live_volunteer_profile','guard_live_volunteer_reference','volunteer_assignment_end_at','volunteer_deletion_impact','review_volunteer_deletion','delete_volunteer_profile','revalidate_volunteer_dispatch')),
      (select jsonb_agg(jsonb_build_array(c.relname,pg_get_userbyid(c.relowner),c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.relname) from pg_class c where c.relnamespace='public'::regnamespace),
      (select jsonb_agg(to_jsonb(t) order by tablename,policyname) from pg_policies t where schemaname='public'),
      (select jsonb_agg(to_jsonb(t) order by oid) from pg_default_acl t)
    )::text)""")


assert command(["docker", "inspect", NAME], ok=False).returncode != 0, "Disposable name already in use"
created = False
try:
    command(["docker", "run", "--detach", "--name", NAME, "--network", "none", "--env", "POSTGRES_PASSWORD=DisposableReplayOnly", IMAGE])
    created = True
    assert command(["docker", "inspect", NAME, "--format", "{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}"]).stdout.decode().strip() == "none|{}"
    for _ in range(80):
        if command(["docker", "exec", NAME, "pg_isready", "-U", "postgres"], ok=False).returncode == 0:
            time.sleep(1)
            break
        time.sleep(.5)
    sql("create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text)")
    for file in files[:-1]:
        sql(file.read_text(encoding="utf8"))
        sql(f"insert into supabase_migrations.schema_migrations(version,name,statements) values('{file.name[:14]}','{file.stem[15:]}','{{}}')")
    assert scalar("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations") == "57|20261026120000"
    sql("""insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone) values('11111111-1111-4111-8111-111111111111','qa-1262-replay','Local replay','active','America/Denver');
      insert into auth.users(id,email) values('22222222-2222-4222-8222-222222222222','local-replay@example.invalid');
      insert into public.project_contacts(id,auth_user_id,status) values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','active');
      insert into public.volunteer_profiles(workspace_id,full_name,email,profile_source,manual_created_by_project_contact_id,manual_created_at,availability_snapshot,skills_help_snapshot) values('11111111-1111-4111-8111-111111111111','Local replay identity','local-replay@example.invalid','manual','33333333-3333-4333-8333-333333333333',now(),'{}','{}');""")
    source = files[-1].read_text(encoding="utf8")
    print("Migration58 source SHA-256: " + hashlib.sha256(source.encode()).hexdigest(), flush=True)
    body = source[source.index("\nbegin;\n") + len("\nbegin;\n"):source.rindex("\ncommit;")]
    ledger = "insert into supabase_migrations.schema_migrations(version,name,statements) values('20261028120000','volunteer_deletion_lifecycle','{}');"
    before = snapshot()
    data_before, security_before = stable_data(), stable_security()
    fail = sql("begin;" + body + ledger + "do $$begin raise exception 'forced migration58 rollback';end $$;commit;", ok=False)
    assert fail.returncode != 0 and b'forced migration58 rollback' in fail.stderr, fail.stderr.decode()
    assert snapshot() == before
    assert scalar("select count(*) from supabase_migrations.schema_migrations") == "57"
    print("PASS full ordered DB57 replay; forced late migration58 + ledger failure restores exact schema/security/public/Auth fixture state", flush=True)
    sql("begin;" + body + ledger + "commit;")
    assert scalar("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations") == "58|20261028120000"
    assert stable_data() == data_before, "All existing public/Auth row values preserved"
    assert stable_security() == security_before, "Existing owners/ACLs/security/search_path/RLS/policies/defaults preserved"
    assert scalar("select count(*) from public.volunteer_profiles where email='local-replay@example.invalid' and deleted_at is null") == "1"
    assert scalar("select delivery_enabled is false and baseline_at is null from public.assignment_reminder_activation") == "t"
    assert scalar("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='public' and a.grantee=0 and a.privilege_type='EXECUTE'") == "0"
    print("PASS clean migration58 atomic apply, exact ledger, profile data preserved, reminders untouched, PUBLIC execute zero", flush=True)
finally:
    if created:
        command(["docker", "rm", "--force", "--volumes", NAME])
        assert command(["docker", "inspect", NAME], ok=False).returncode != 0
        print("Disconnected disposable database removed", flush=True)
