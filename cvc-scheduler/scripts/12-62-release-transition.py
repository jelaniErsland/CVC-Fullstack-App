"""Offline old worker / atomic migration / DB58 logical restore compatibility proof."""
from pathlib import Path
import subprocess
import hashlib
import time
import json

ROOT = Path(__file__).resolve().parents[1]
NAME = "supabase_db_cvc-1262-transition"
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
    # Enabled old-contract worker with future-only occurrences; no provider exists here.
    sql("""insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,publication_state,published_at,published_by_project_contact_id,created_by_project_contact_id)
      select ('44444444-4444-4444-8444-'||lpad(n::text,12,'0'))::uuid,'11111111-1111-4111-8111-111111111111','Local transition work','general','timed',current_date+10+n,'08:00','11:00','America/Denver',1,'active','published',now(),'33333333-3333-4333-8333-333333333333','33333333-3333-4333-8333-333333333333' from generate_series(1,2)n;
      insert into public.calendar_assignments(workspace_id,calendar_item_id,volunteer_profile_id,lifecycle,created_at)
        select i.workspace_id,i.id,v.id,'active',now()-interval '1 day' from public.calendar_items i cross join public.volunteer_profiles v;
      insert into public.assignment_responses(workspace_id,assignment_id,response_status,responded_at)
        select workspace_id,id,case when calendar_item_id::text like '%000001' then 'confirmed' else 'needs_response' end,case when calendar_item_id::text like '%000001' then now()-interval '1 hour' else null end from public.calendar_assignments;
      update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=now();""")
    worker = "begin;set local role project_local_reminder_worker;select public.run_assignment_reminder_worker('status','{}');select public.run_assignment_reminder_worker('sync','{\"workspaceId\":\"11111111-1111-4111-8111-111111111111\",\"after\":null}');commit;"
    sql(worker)
    assert int(scalar('select count(*) from public.assignment_reminder_enrollments')) == 2
    assert int(scalar('select count(*) from public.assignment_reminder_occurrences')) > 0
    reminder_before = scalar("select md5(jsonb_build_array((select jsonb_agg(to_jsonb(e) order by assignment_id) from public.assignment_reminder_enrollments e),(select jsonb_agg(to_jsonb(o) order by id) from public.assignment_reminder_occurrences o))::text)")
    before = snapshot()
    data_before, security_before = stable_data(), stable_security()
    fail = sql("begin;" + body + ledger + "do $$begin raise exception 'forced migration58 rollback';end $$;commit;", ok=False)
    assert fail.returncode != 0 and b'forced migration58 rollback' in fail.stderr, fail.stderr.decode()
    assert snapshot() == before
    assert scalar("select count(*) from supabase_migrations.schema_migrations") == "57"
    print("PASS full ordered DB57 replay; forced late migration58 + ledger failure restores exact schema/security/public/Auth fixture state", flush=True)
    # A bounded old worker transaction holds its read locks while the atomic DDL waits.
    args=["docker","exec","-i",NAME,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"]
    prior=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    held=worker.replace('begin;',"begin;set local application_name='qa1262-old-worker';",1).replace('commit;',"select pg_sleep(3);commit;")
    prior.stdin.write(held.encode());prior.stdin.close();prior.stdin=None
    for _ in range(30):
        if scalar("select count(*) from pg_stat_activity a where a.application_name='qa1262-old-worker' and a.wait_event='PgSleep' and exists(select 1 from pg_locks l where l.pid=a.pid and l.relation='public.volunteer_profiles'::regclass and l.mode='AccessShareLock' and l.granted)") == '1':
            break
        time.sleep(.05)
    else:
        raise AssertionError('Old worker must demonstrably hold its DB57 profile read lock')
    migration_sql="begin;set local application_name='qa1262-migration';set local lock_timeout='8s';"+body+ledger+'commit;'
    command(['docker','exec','-i',NAME,'sh','-c','cat > /tmp/migration58.sql'],migration_sql.encode())
    applying=subprocess.Popen(['docker','exec',NAME,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-f','/tmp/migration58.sql'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    for _ in range(30):
        if scalar("select count(*) from pg_stat_activity m join pg_stat_activity w on w.pid=any(pg_blocking_pids(m.pid)) where m.application_name='qa1262-migration' and w.application_name='qa1262-old-worker'") == '1':
            break
        time.sleep(.05)
    else:
        raise AssertionError('Migration DDL must demonstrably wait for the old worker transaction')
    out,err=prior.communicate(timeout=15)
    assert prior.returncode == 0, err.decode()
    out,err=applying.communicate(timeout=15)
    assert applying.returncode == 0, err.decode()
    print('PASS observed old-worker AccessShareLock and migration blocking-pid chain; migration commits only after bounded old transaction completes',flush=True)
    sql(worker)
    assert scalar("select md5(jsonb_build_array((select jsonb_agg(to_jsonb(e) order by assignment_id) from public.assignment_reminder_enrollments e),(select jsonb_agg(to_jsonb(o) order by id) from public.assignment_reminder_occurrences o))::text)") == reminder_before
    assert scalar("select count(*) from (select assignment_id,occurrence_key from public.assignment_reminder_occurrences group by assignment_id,occurrence_key having count(*)>1)d") == '0'
    print('PASS enabled old worker command contract before/during/after atomic migration; future occurrences identical; no duplicates; no provider exists',flush=True)
    assert scalar("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations") == "58|20261028120000"
    assert stable_data() == data_before, "All existing public/Auth row values preserved"
    assert stable_security() == security_before, "Existing owners/ACLs/security/search_path/RLS/policies/defaults preserved"
    assert scalar("select count(*) from public.volunteer_profiles where email='local-replay@example.invalid' and deleted_at is null") == "1"
    assert scalar("select delivery_enabled is true and baseline_at is not null from public.assignment_reminder_activation") == "t"
    assert scalar("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='public' and a.grantee=0 and a.privilege_type='EXECUTE'") == "0"
    print("PASS clean migration58 atomic apply, exact ledger, profile data preserved, reminders untouched, PUBLIC execute zero", flush=True)
    # The existing package uses full logical schema/data dumps. Round-trip DB58,
    # including scrubbed tombstone provenance, into a separate offline database.
    sql("""insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from) values('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','main_contact',array['workspace.read','volunteers.view','volunteers.edit','calendar.view','calendar.edit','assignments.view','assignments.edit'],'active',now()-interval '1 day');
      begin;set local role authenticated;set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
      do $delete$ declare person uuid;r jsonb;begin
        select id into person from public.volunteer_profiles limit 1;
        r:=public.review_volunteer_deletion('11111111-1111-4111-8111-111111111111',person);
        perform public.delete_volunteer_profile('11111111-1111-4111-8111-111111111111',person,(r->>'version')::timestamptz,r->>'fingerprint');
      end $delete$;commit;""")
    restore_query = """select md5(jsonb_build_array(
      (select string_agg(schemaname||'.'||tablename||':'||(xpath('/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from %I.%I t',schemaname,tablename),false,true,'')))[1]::text,'|' order by schemaname,tablename) from pg_tables where schemaname in ('public','auth','supabase_migrations')),
      (select jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),pg_get_functiondef(p.oid),pg_get_userbyid(p.proowner),p.proacl,p.prosecdef,p.proconfig) order by p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p where p.pronamespace='public'::regnamespace),
      (select jsonb_agg(jsonb_build_array(c.relname,c.relkind,pg_get_userbyid(c.relowner),c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.relname) from pg_class c where c.relnamespace='public'::regnamespace),
      (select jsonb_agg(jsonb_build_array(c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where c.relnamespace='public'::regnamespace and a.attnum>0 and not a.attisdropped),
      (select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid,true)) order by conname,conrelid::regclass::text) from pg_constraint where connamespace='public'::regnamespace),
      (select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public'),
      (select jsonb_agg(jsonb_build_array(pg_get_userbyid(defaclrole),defaclnamespace::regnamespace::text,defaclobjtype,defaclacl) order by defaclrole,defaclnamespace,defaclobjtype) from pg_default_acl where defaclnamespace=0 or defaclnamespace='public'::regnamespace),
      (select jsonb_agg(pg_get_triggerdef(t.oid,true) order by c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relnamespace='public'::regnamespace and not t.tgisinternal),
      (select jsonb_agg(indexdef order by indexname) from pg_indexes where schemaname='public')
    )::text)"""
    restore_query=restore_query.replace('select md5(jsonb_build_array(', 'select jsonb_build_array(',1)
    restore_query=restore_query[:-len(')::text)')]+')'
    before_restore=json.loads(scalar(restore_query))
    excluded=scalar("select string_agg(nspname,',') from pg_namespace where nspname not in('public','auth','supabase_migrations','information_schema') and nspname not like 'pg_%'").split(',')
    dump=command(['docker','exec',NAME,'pg_dump','-U','postgres','-d','postgres','--format=custom']+['--exclude-schema='+n for n in excluded if n]).stdout
    command(['docker','exec',NAME,'createdb','-U','postgres','recovery58'])
    command(['docker','exec',NAME,'psql','-U','postgres','-d','recovery58','-c','create schema extensions;create extension pgcrypto with schema extensions;'])
    for namespace in excluded:
        if namespace:
            assert namespace.replace('_','').isalnum()
            command(['docker','exec',NAME,'psql','-U','postgres','-d','recovery58','-c','create schema if not exists \"'+namespace+'\";'])
    # The production package excludes platform event triggers whose extension
    # functions are supplied by the recovery platform, not application dumps.
    toc=command(['docker','exec','-i',NAME,'pg_restore','--list'],dump).stdout
    toc=b'\n'.join(line for line in toc.splitlines() if b'EVENT TRIGGER' not in line)+b'\n'
    command(['docker','exec','-i',NAME,'sh','-c','cat > /tmp/recovery58.list'],toc)
    command(['docker','exec','-i',NAME,'pg_restore','-U','supabase_admin','-d','recovery58','--exit-on-error','--use-list=/tmp/recovery58.list'],dump)
    # Preserve the explicit owner ACL used for FORCE-RLS reminder tables, as in
    # the established current-checkpoint recovery procedure. Owner-only grant.
    command(['docker','exec',NAME,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','recovery58','-c','grant all privileges on table public.assignment_reminder_activation,public.assignment_reminder_enrollments,public.assignment_reminder_occurrences,public.assignment_reminder_events to postgres;'])
    compare=restore_query
    restored=json.loads(command(['docker','exec',NAME,'psql','-X','-qAt','-U','postgres','-d','recovery58','-c',compare]).stdout.decode().strip())
    for i in range(1,len(before_restore)):
        if restored[i]!=before_restore[i]:
            print('Metadata category '+str(i)+' source-only '+str([r for r in (before_restore[i] or []) if r not in (restored[i] or [])][:5])+' restore-only '+str([r for r in (restored[i] or []) if r not in (before_restore[i] or [])][:5]),flush=True)
    assert restored == before_restore, 'Restore category mismatch indices: '+str([i for i,(a,b) in enumerate(zip(before_restore,restored)) if a!=b])
    print('PASS DB58 exact logical restore: all public/Auth/ledger rows, 110 functions/owners/ACLs, column contracts, RLS/policies/default grants, tombstone and withdrawal provenance; no schema downgrade',flush=True)

finally:
    if created:
        command(["docker", "rm", "--force", "--volumes", NAME])
        assert command(["docker", "inspect", NAME], ok=False).returncode != 0
        print("Disconnected disposable database removed", flush=True)
