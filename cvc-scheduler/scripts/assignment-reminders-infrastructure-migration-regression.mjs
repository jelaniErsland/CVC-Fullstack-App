// Named local Docker fixture only. No production connection or provider.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sql,value} from './12-47-local-fixtures.mjs';
import {effectiveFunctionQuery,assertEffectiveFunctionPolicy} from './function-privilege-policy.mjs';
const version='20261022120000';
const migration=fs.readFileSync(new URL(`../supabase/migrations/${version}_assignment_reminder_infrastructure.sql`,import.meta.url),'utf8');
const rollback=fs.readFileSync(new URL(`../supabase/rollback/${version}_assignment_reminder_infrastructure.sql`,import.meta.url),'utf8');
const apply=migration.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','assignment_reminder_infrastructure','{}');commit;`);
const state=()=>value(`select row_to_json(a) from public.assignment_reminder_activation a`);
const catalog=()=>value(`select md5(string_agg(pg_get_functiondef(p.oid)||p.proowner||coalesce(p.proacl::text,''),'|' order by p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`);
const rows=()=>value(`select string_agg(tablename||':'||(xpath('/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from public.%I t',tablename),false,true,'')))[1]::text,'|' order by tablename) from pg_tables where schemaname='public'`);
const security=()=>value(`select md5(jsonb_build_array((select jsonb_agg(jsonb_build_array(c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public'),(select jsonb_agg(to_jsonb(a) order by oid) from pg_default_acl a))::text)`);
const authRows=()=>value(`select md5(jsonb_build_array((select jsonb_agg(to_jsonb(u) order by id) from auth.users u),(select jsonb_agg(to_jsonb(i) order by id) from auth.identities i))::text)`);
const snapshot=()=>({state:state(),catalog:catalog(),rows:rows(),security:security(),auth:authRows()});
if(value('select count(*) from supabase_migrations.schema_migrations')==='55')sql(rollback);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'54');
assert.equal(value("select count(*) from pg_roles where rolname='project_local_reminder_runner'"),'0');
const before=snapshot();
assert.notEqual(sql(apply.replace(/commit;\s*$/,'select 1/0;commit;'),true).status,0);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'54');
assert.equal(value("select count(*) from pg_extension where extname in('pg_cron','pg_net','http')"),'0');
assert.deepEqual(snapshot(),before);
assert.equal(value("select count(*) from pg_roles where rolname='project_local_reminder_runner'"),'0','Failed migration must not leave a login');
const unsafe=sql(apply.replace('begin;',"begin;update public.assignment_reminder_activation set baseline_at=statement_timestamp();"),true);
assert.notEqual(unsafe.status,0);assert.match(unsafe.stderr,/disabled, unactivated reminders with no history/);assert.deepEqual(snapshot(),before);
const installation=sql(apply,true);
assert.equal(installation.status,0,installation.stderr);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'55');
assert.deepEqual(snapshot(),before);
assert.deepEqual(JSON.parse(value("select json_build_object('login',rolcanlogin,'inherit',rolinherit,'super',rolsuper,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication,'bypass',rolbypassrls,'limit',rolconnlimit) from pg_roles where rolname='project_local_reminder_runner'")),{login:true,inherit:false,super:false,createdb:false,createrole:false,replication:false,bypass:false,limit:2});
assert.equal(value("select rolpassword is null from pg_authid where rolname='project_local_reminder_runner'"),'t','Migration installs no usable password/verifier');
assert.equal(value("select count(*) from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles member on member.oid=m.member where member.rolname='project_local_reminder_runner' and r.rolname='project_local_reminder_worker' and not m.inherit_option and m.set_option and not m.admin_option"),'1');
assert.equal(value("select count(*) from pg_auth_members m join pg_roles member on member.oid=m.member where member.rolname='project_local_reminder_runner'"),'1');
assert.equal(value("select count(*) from information_schema.table_privileges where grantee='project_local_reminder_runner'"),'0');
assert.equal(value("select count(*) from pg_extension where extname in('pg_cron','pg_net','http')"),'0');
assert.equal(value("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='project_local_reminder_infrastructure'"),'1');
assertEffectiveFunctionPolicy(assert,value(effectiveFunctionQuery).split('\n').filter(Boolean).map(line=>JSON.parse(line)));
assert.equal(value("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='project_local_reminder_infrastructure' and a.grantee=0 and a.privilege_type='EXECUTE'"),'0');
assert.deepEqual(JSON.parse(value("select json_build_object('owner',pg_get_userbyid(proowner),'definer',prosecdef,'config',proconfig) from pg_proc where oid='project_local_reminder_infrastructure.activate_delivery(text)'::regprocedure")),{owner:'postgres',definer:false,config:['search_path=""']});
for(const role of ['anon','authenticated','service_role','project_local_reminder_worker','project_local_reminder_runner']){
 assert.equal(value(`select has_schema_privilege('${role}','project_local_reminder_infrastructure','USAGE')`),'f');
 for(const signature of ['activate_delivery(text)'])assert.equal(value(`select has_function_privilege('${role}','project_local_reminder_infrastructure.${signature}','EXECUTE')`),'f');
 assert.notEqual(sql(`begin;set local role ${role};select project_local_reminder_infrastructure.activate_delivery('OWNER APPROVED AUTOMATIC REMINDER ACTIVATION');rollback;`,true).status,0);
}
// Owner ignition is not invoked in this batch. Its unchanged reviewed body has
// the exact confirmation, singleton lock and one atomic baseline/enabled UPDATE.
const ignition=value("select prosrc from pg_proc where oid='project_local_reminder_infrastructure.activate_delivery(text)'::regprocedure");
assert.match(ignition,/statement_timestamp\(\)/);assert.match(ignition,/for update/);
assert.match(ignition,/OWNER APPROVED AUTOMATIC REMINDER ACTIVATION/);
assert.match(ignition,/set baseline_at=baseline,delivery_enabled=true/);
sql(rollback);assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'54');
assert.equal(value("select count(*) from pg_roles where rolname='project_local_reminder_runner'"),'0');
assert.deepEqual(snapshot(),before);
sql(apply);assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'55');
const unsafeRollback=sql(rollback.replace('begin;',"begin;update public.assignment_reminder_activation set baseline_at=statement_timestamp();"),true);
assert.notEqual(unsafeRollback.status,0);assert.match(unsafeRollback.stderr,/forward recovery/);assert.deepEqual(snapshot(),before);
console.log('PASS local migration55 atomic failure/apply/empty rollback/replay; exact narrow login membership; public data/102-function policy unchanged; activation denied to ordinary/worker/runner roles; owner ignition not invoked; no Cron/provider');
