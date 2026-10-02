"""Disconnected migration replay and rollback proof. Never points at production."""
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
NAME = "supabase_db_cvc-1250-replay"
IMAGE = "public.ecr.aws/supabase/postgres:17.6.1.171"
files = sorted((ROOT / "supabase" / "migrations").glob("[0-9]" * 14 + "_*.sql"))
assert len(files) == 48 and files[-1].name == "20261001120000_admin_workflow_activation.sql"

def command(args, data=None, ok=True):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if ok and result.returncode:
        raise RuntimeError(f"{args[0]} failed: {result.stderr.decode(errors='replace')[:800]}")
    return result

def sql(source, ok=True):
    data = source if isinstance(source, bytes) else source.encode()
    return command(["docker", "exec", "-i", NAME, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], data, ok)

def scalar(query):
    return sql(query).stdout.decode().strip()

assert command(["docker", "inspect", NAME], ok=False).returncode != 0, "Disposable name already in use"
created = False
try:
    command(["docker", "run", "--detach", "--name", NAME, "--network", "none", "--env", "POSTGRES_PASSWORD=DisposableReplayOnly", IMAGE])
    created = True
    assert command(["docker", "inspect", NAME, "--format", "{{.HostConfig.NetworkMode}}|{{json .HostConfig.PortBindings}}"]).stdout.decode().strip() == "none|{}"
    ready = 0
    for _ in range(80):
        ready = ready + 1 if command(["docker", "exec", NAME, "pg_isready", "-U", "postgres", "-d", "postgres"], ok=False).returncode == 0 else 0
        if ready >= 3:
            break
        time.sleep(.5)
    else:
        raise RuntimeError("Disposable database not ready")
    sql("create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key, statements text[], name text)")
    for file in files[:-1]:
        sql(file.read_bytes())
        sql(f"insert into supabase_migrations.schema_migrations(version,name,statements) values ('{file.name[:14]}','{file.stem[15:]}',array[]::text[])")
    assert scalar("select count(*) || '|' || max(version) from supabase_migrations.schema_migrations") == "47|20260930130000"
    assert scalar("select count(*) from information_schema.columns where table_schema='public' and table_name='calendar_items' and column_name='explicit_draft'") == "0"
    ws, user, contact, volunteer, assigned, ambiguous = [str(uuid.uuid4()) for _ in range(6)]
    sql(f"""insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone,starts_on,ends_on)
      values('{ws}','qa-1250-replay-{ws}','Disposable','active','America/Denver','2030-01-01','2030-12-31');
      insert into auth.users(id,email) values('{user}','{user}@example.invalid');
      insert into public.project_contacts(id,auth_user_id,status) values('{contact}','{user}','active');
      insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from)
        values('{ws}','{contact}','main_contact',array['workspace.read','calendar.view','calendar.edit','assignments.view','assignments.edit'],'active',now()-interval '1 day');
      insert into public.volunteer_profiles(workspace_id,full_name,email,profile_source,manual_created_by_project_contact_id,manual_created_at,availability_snapshot,skills_help_snapshot)
        values('{ws}','Disposable volunteer','disposable@example.invalid','manual','{contact}',now(),'{{}}','{{}}');
      insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,created_by_project_contact_id,publication_state)
        values('{assigned}','{ws}','Assigned legacy draft','general','timed','2030-02-01','08:00','10:00','America/Denver',1,'active','{contact}','draft'),
          ('{ambiguous}','{ws}','Ambiguous legacy draft','general','timed','2030-02-02','08:00','10:00','America/Denver',1,'active','{contact}','draft');
      insert into public.calendar_assignments(workspace_id,calendar_item_id,volunteer_profile_id,lifecycle)
        select '{ws}','{assigned}',id,'active' from public.volunteer_profiles where workspace_id='{ws}';""")
    assert scalar(f"select publication_state from public.calendar_items where id='{assigned}'") == "draft"
    migration = files[-1].read_text(encoding="utf8")
    assert migration.startswith("begin;") and migration.rstrip().endswith("commit;")
    forced = migration[:migration.rfind("commit;")] + "do $$ begin raise exception 'forced rollback'; end $$;\ncommit;\n"
    assert sql(forced, ok=False).returncode != 0
    assert scalar("select count(*) from information_schema.columns where table_schema='public' and table_name='calendar_items' and column_name='explicit_draft'") == "0"
    assert scalar("select count(*) || '|' || max(version) from supabase_migrations.schema_migrations") == "47|20260930130000"
    assert scalar(f"select string_agg(publication_state,',' order by id) from public.calendar_items where id in ('{assigned}','{ambiguous}')") == "draft,draft"
    print("PASS: forced late migration failure rolls back schema and preserves ledger 47")
    sql(migration)
    sql("insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261001120000','admin_workflow_activation',array[]::text[])")
    assert scalar("select count(*) || '|' || max(version) from supabase_migrations.schema_migrations") == "48|20261001120000"
    assert scalar("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity") == "0"
    assert scalar("select count(*) from information_schema.columns where table_schema='public' and table_name='calendar_items' and column_name='explicit_draft'") == "1"
    assert scalar(f"select publication_state from public.calendar_items where id='{assigned}'") == "published"
    assert scalar(f"select publication_state from public.calendar_items where id='{ambiguous}'") == "draft"
    assert scalar(f"select count(*) from public.calendar_assignments where calendar_item_id='{assigned}' and lifecycle='active'") == "1"
    print("PASS: ordered 48-migration replay, assigned-draft transition, ambiguous-draft preservation, RLS, and final ledger")
finally:
    if created:
        command(["docker", "rm", "--force", "--volumes", NAME])
        assert command(["docker", "inspect", NAME], ok=False).returncode != 0
        print("Disposable database removed")
