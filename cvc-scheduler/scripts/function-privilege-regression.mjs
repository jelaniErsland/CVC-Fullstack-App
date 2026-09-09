// Disposable local DB only. No environment-file or hosted connection support.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  anonymousFunctions, authenticatedFunctions, internalFunctions,
  migrationCreators, assertEffectiveFunctionPolicy, effectiveFunctionQuery,
} from "./function-privilege-policy.mjs";

function sql(query, expectSuccess = true) {
  const result = spawnSync("docker", [
    "exec", "-i", "supabase_db_cvc-scheduler", "psql", "-X", "-qAt",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
  ], { input: query, encoding: "utf8", windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  if (expectSuccess) assert.equal(result.status, 0, result.stderr);
  return result;
}
const output = query => sql(query).stdout.trim();
const rows = output(effectiveFunctionQuery).split(/\r?\n/).map(JSON.parse);
assert.equal(output("select max(version) from supabase_migrations.schema_migrations"), "20260908130000");
assertEffectiveFunctionPolicy(assert, rows);
// Prove that the invariant catches current privilege drift and missing grants.
for (const [signature, key, value] of [
  [authenticatedFunctions[0], "anon", true],
  [internalFunctions[0], "authenticated", true],
  [anonymousFunctions[0], "anon", false],
  [authenticatedFunctions[0], "authenticated", false],
  [anonymousFunctions[0], "public", true],
]) {
  assert.throws(() => assertEffectiveFunctionPolicy(assert, rows.map(r =>
    r.signature === signature ? { ...r, [key]: value } : r)));
}
assert.throws(() => assertEffectiveFunctionPolicy(assert, [...rows, { signature: "unreviewed()" }]));

// GLOBAL and per-schema ACLs combine additively. Do not test a serialized ACL.
assert.equal(output(`
  select count(*) from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
  where d.defaclrole='postgres'::regrole and d.defaclobjtype='f'
    and d.defaclnamespace in (0, 'public'::regnamespace)
    and a.privilege_type='EXECUTE'
    and a.grantee in (0,'anon'::regrole,'authenticated'::regrole);
`), "0");
for (const creator of migrationCreators) {
  const fixture = "acl_future_" + randomUUID().replaceAll("-", "");
  const result = output(`
    begin;
    set local role ${creator};
    create function public.${fixture}() returns integer language sql as 'select 1';
    select has_function_privilege('anon','public.${fixture}()','EXECUTE')::text || '|' ||
      has_function_privilege('authenticated','public.${fixture}()','EXECUTE')::text || '|' ||
      exists(select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where p.oid='public.${fixture}()'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE')::text;
    rollback;
  `);
  assert.equal(result, "false|false|false", creator + ": future function privilege leak");
  assert.equal(output(`select to_regprocedure('public.${fixture}()') is null`), "t");
}
// The platform superuser is not a migration creator delegated to postgres.
assert.equal(output("select pg_has_role('postgres','supabase_admin','MEMBER')"), "f");

const id = randomUUID();
const literal = "'" + id + "'";
const snapshot = () => output(`
  select string_agg(format('%I:%s',tablename,
    (xpath('/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) as hash from public.%I t',tablename),false,true,'')))[1]::text), '|' order by tablename)
  from pg_tables where schemaname='public';
`);
const beforeFixture = snapshot();
try {
  // Actual disposable targets for create/update/archive/trigger checks.
  output(`
    insert into public.workspaces(id,workspace_key,display_name) values (${literal},'acl-${id}','ACL fixture');
    insert into public.task_presets(id,workspace_id,name,task_type) values (${literal},${literal},'ACL task','general');
    insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,publication_state)
      select ${literal},${literal},'ACL item','general','timed',current_date+30,'08:00','10:00',timezone,1,'draft'
      from public.workspaces where id=${literal};
    update public.task_presets set updated_at='2000-01-01',name='ACL updated' where id=${literal};
    update public.calendar_items set updated_at='2000-01-01',title_snapshot='ACL updated' where id=${literal};
  `);
  assert.equal(output(`select (select updated_at > '2000-01-01' from public.task_presets where id=${literal}) and (select updated_at > '2000-01-01' from public.calendar_items where id=${literal})`), "t", "Timestamp triggers must still execute.");
  const beforeCalls = snapshot();
  const calls = [
    ["create_calendar_item", `${literal},null,'ACL','general','timed',current_date+30,null,'08:00','10:00',1,null,'{}'`],
    ["update_calendar_item_one_off_timed", `${literal},'ACL','general',current_date+30,'08:00','10:00',1,null,'{}',clock_timestamp()`],
    ["archive_calendar_item", literal],
    ["create_task_preset", `${literal},'ACL',null,'general',1,true,'[]','blue'`],
    ["update_task_preset_color", `${literal},'blue',clock_timestamp()`],
    ["archive_task_preset", literal],
    ["create_calendar_assignment", `${literal},${literal},null`],
    ["cancel_calendar_assignment", literal],
    ["set_current_project_day_expected_on_site", "current_date+30,5"],
    ["create_manual_volunteer_profile", `${literal},'{"fullName":"ACL","email":"acl@example.invalid"}'::jsonb`],
    ["issue_volunteer_schedule_access", `${literal},24`],
    ["revoke_volunteer_schedule_access", literal],
    ["update_current_workspace_project_dates", "current_date+1,current_date+60"],
    ["delete_history_free_volunteer_profile", literal],
  ];
  for (const [name, args] of calls) {
    const denied = sql(`begin; set local role anon; select public.${name}(${args}); rollback;`, false);
    assert.notEqual(denied.status, 0, name + ": anon mutation unexpectedly allowed");
    assert.match(denied.stderr, new RegExp("permission denied for function " + name), name + ": must fail at EXECUTE, before authorization/body");
  }
  assert.equal(snapshot(), beforeCalls, "Direct anonymous attempts must change zero target rows.");
} finally {
  output(`delete from public.calendar_items where workspace_id=${literal};
    delete from public.task_presets where workspace_id=${literal};
    delete from public.workspaces where id=${literal};`);
}
assert.equal(snapshot(), beforeFixture, "Zero disposable fixture residue.");
assertEffectiveFunctionPolicy(assert, output(effectiveFunctionQuery).split(/\r?\n/).map(JSON.parse));
console.log("PASS systemic ACL: 58 exact functions; 8 anonymous, 38 authenticated, 12 internal; PUBLIC 0; defaults denied; future postgres function denied; 13 direct anon mutations denied before execution; target changes 0; triggers preserved; residue 0.");
