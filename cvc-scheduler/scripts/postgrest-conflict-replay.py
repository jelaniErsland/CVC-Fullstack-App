"""Offline conflict-code migration proof using a disposable loopback PostgreSQL.

No hosted credentials, HTTP provider or application records are used.
"""
from pathlib import Path
import subprocess
import os
import json
import re

ROOT = Path(__file__).resolve().parents[1]
BIN = Path(os.environ.get('PROJECT_LOCAL_TEST_PG_BIN', 'C:/Program Files/PostgreSQL/18/bin'))
DATA = ROOT.parent.parent / 'pg-retry-hotfix'
PORT = '55439'

def command(args, source=None, check=True):
    result = subprocess.run([str(a) for a in args], input=source, text=True,
                            capture_output=True, encoding='utf8', timeout=60)
    if check and result.returncode:
        raise RuntimeError(result.stderr[-4000:] or result.stdout[-4000:])
    return result

def sql(source, database='conflict_test'):
    # Stand-alone mode avoids network access entirely and cannot reach production.
    source = re.sub(r'\n(?:[ \t]*\n)+', '\n', source)
    result = command([BIN/'postgres.exe', '--single', '-j', '-D', DATA,
                      database], source+'\n\n')
    if re.search(r'\b(ERROR|FATAL|PANIC):', result.stderr):
        first = re.search(r'\b(?:ERROR|FATAL|PANIC):', result.stderr).start()
        raise RuntimeError(result.stderr[first:first+1200])
    values = re.findall(r'\t 1: [^\n]+? = "(.*)"\t\(typeid', result.stdout)
    return values[-1] if values else ''

started = False
try:
    sql('drop database if exists conflict_test;', 'postgres')
    sql('drop role if exists project_local_reminder_runner;drop role if exists project_local_reminder_worker;', 'postgres')
    sql('create database conflict_test;', 'postgres')
    sql("""do $$begin create role anon;exception when duplicate_object then null;end$$;
      do $$begin create role authenticated;exception when duplicate_object then null;end$$;
      do $$begin create role service_role bypassrls;exception when duplicate_object then null;end$$;
      do $$begin create role authenticator login noinherit;exception when duplicate_object then null;end$$;
      grant anon,authenticated,service_role to authenticator;
      create schema auth;create schema extensions;
      create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
        nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
      grant usage on schema auth,extensions to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create schema supabase_migrations;
      create table supabase_migrations.schema_migrations(version text primary key,statements text[],name text);""")
    files = sorted((ROOT/'supabase/migrations').glob('[0-9]'*14+'_*.sql'))
    baseline = [p for p in files if p.name[:14] <= '20261028120000']
    assert len(baseline) == 58
    for p in baseline:
        try:
            sql(p.read_text(encoding='utf8'))
            sql("insert into supabase_migrations.schema_migrations values('"+p.name[:14]+"','{}','"+p.stem[15:]+"')")
        except Exception as e:
            raise RuntimeError(p.name+': '+str(e)) from e
    affected = json.loads(sql("select json_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) from pg_proc p where p.pronamespace='public'::regnamespace and p.prosrc like '%40001%'"))
    print(json.dumps({'baselineMigrations':len(baseline),'affected':affected}), flush=True)
    (ROOT/'scripts/postgrest-conflict-signatures.json').write_text(json.dumps(affected,indent=2)+'\n')
    catalogue_query = "select json_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'metadata',to_jsonb(p)-'prosrc') order by p.oid) from pg_proc p where p.pronamespace='public'::regnamespace"
    before = json.loads(sql(catalogue_query))
    repair = (ROOT/'supabase/migrations/20261110000000_nonretryable_business_conflicts.sql').read_text()
    # Rehearse the complete DDL and prove rollback restores every definition/ACL.
    sql(repair.replace('commit;', 'rollback;'))
    assert json.loads(sql(catalogue_query)) == before, 'Rollback must restore the exact catalogue'
    sql(repair)
    after = json.loads(sql(catalogue_query))
    assert len(before) == len(after) == 110
    changed = 0
    for old,new in zip(before,after):
        assert old['metadata'] == new['metadata'], old['signature']+' metadata'
        assert new['definition'] == old['definition'].replace("'40001'", "'PT409'"), old['signature']+' definition'
        changed += old['definition'] != new['definition']
    assert changed == 18
    sql(repair)
    assert json.loads(sql(catalogue_query)) == after, 'Re-applying must be a no-op'
    sql("""insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone)
      values('11111111-1111-4111-8111-111111111111','retry-test','Offline retry test','active','America/Denver');
      insert into auth.users(id,email) values('22222222-2222-4222-8222-222222222222','test@example.invalid');
      insert into public.project_contacts(id,auth_user_id,status) values('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','active');
      insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from)
      values('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','main_contact',array['workspace.read','calendar.view','calendar.edit','tasks.view','tasks.edit','assignments.view','assignments.edit','volunteers.view','volunteers.edit'],'active',now()-interval '1 day');
      insert into public.task_presets(id,workspace_id,name,task_type,default_needed_count,volunteer_visible,color_key)
      values('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','Test work','general',1,true,'blue');
      insert into public.calendar_items(id,workspace_id,task_preset_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,created_by_project_contact_id)
      values('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','Test work','general','timed',current_date+1,'08:00','09:00','America/Denver',1,'active','33333333-3333-4333-8333-333333333333');""")
    data_query = "select md5(jsonb_build_array((select jsonb_agg(to_jsonb(t)) from public.calendar_items t),(select jsonb_agg(to_jsonb(t)) from public.task_presets t))::text)"
    fingerprint = sql(data_query)
    sql("""begin;set local role authenticated;set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
      do $test$ declare detail text;begin
        begin
          perform public.update_calendar_item_preset_timed('55555555-5555-4555-8555-555555555555',current_date+1,null::date,'08:00'::time,'09:00'::time,1,null,'{}','2000-01-01'::timestamptz);
          raise exception 'Stale calendar edit unexpectedly succeeded';
        exception when sqlstate 'PT409' then
          get stacked diagnostics detail=pg_exception_detail;
          if detail<>'calendar_item_edit_conflict' then raise exception 'Conflict detail changed';end if;
        end;
        begin
          perform public.update_task_preset_color('44444444-4444-4444-8444-444444444444','blue','2000-01-01'::timestamptz);
          raise exception 'Stale preset edit unexpectedly succeeded';
        exception when sqlstate 'PT409' then
          get stacked diagnostics detail=pg_exception_detail;
          if detail<>'task_preset_edit_conflict' then raise exception 'Preset conflict detail changed';end if;
        end;
      end $test$;rollback;""")
    assert sql(data_query) == fingerprint, 'Conflicts must leave rows unchanged'
    # Reproduce the owner's reported trigger: save a different Needed count,
    # then submit another edit from the now-stale page version.
    sql("""begin;set local role authenticated;set local request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
      do $needed_count_test$ declare original_version timestamptz;detail text;begin
        select updated_at into original_version from public.calendar_items
          where id='55555555-5555-4555-8555-555555555555';
        perform public.update_calendar_item_preset_timed(
          '55555555-5555-4555-8555-555555555555',current_date+1,null::date,
          '08:00'::time,'09:00'::time,4,null,'{}',original_version);
        if (select needed_count from public.calendar_items
          where id='55555555-5555-4555-8555-555555555555')<>4 then
          raise exception 'Fresh Needed-count edit did not save';
        end if;
        begin
          perform public.update_calendar_item_preset_timed(
            '55555555-5555-4555-8555-555555555555',current_date+1,null::date,
            '08:00'::time,'09:00'::time,7,null,'{}',original_version);
          raise exception 'Stale Needed-count edit unexpectedly succeeded';
        exception when sqlstate 'PT409' then
          get stacked diagnostics detail=pg_exception_detail;
          if detail<>'calendar_item_edit_conflict' then
            raise exception 'Needed-count conflict detail changed';
          end if;
        end;
        if (select needed_count from public.calendar_items
          where id='55555555-5555-4555-8555-555555555555')<>4 then
          raise exception 'Stale edit changed the saved Needed count';
        end if;
      end $needed_count_test$;rollback;""")
    assert sql(data_query) == fingerprint, 'Needed-count replay must roll back cleanly'
    print(json.dumps({'pass':True,'baselineMigrations':58,'functions':110,'changedFunctions':18,
                      'exactDefinitions':True,'metadataAndPrivilegesUnchanged':True,
                      'rollback':True,'idempotent':True,'realStaleEditRejections':3,
                      'freshNeededCountSave':True,'staleNeededCountRejected':True,
                      'dataUnchanged':True}),flush=True)
finally:
    if started:
        command([BIN/'pg_ctl.exe','-D',DATA,'-m','fast','-w','stop'],check=False)
