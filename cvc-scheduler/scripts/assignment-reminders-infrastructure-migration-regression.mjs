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
if(value('select count(*) from supabase_migrations.schema_migrations')==='55')sql(rollback);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'54');
const before={state:state(),catalog:catalog(),rows:rows()};
assert.notEqual(sql(apply.replace(/commit;\s*$/,'select 1/0;commit;'),true).status,0);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'54');
assert.equal(value("select count(*) from pg_extension where extname in('pg_cron','pg_net')"),'0');
assert.deepEqual({state:state(),catalog:catalog(),rows:rows()},before);
const installation=sql(apply,true);
if(process.argv.includes('--expect-managed-grant-block')){
 assert.notEqual(installation.status,0);assert.match(installation.stderr,/managed Cron\/pg_net grants require privileged security review/);
 assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'54');
 assert.equal(value("select count(*) from pg_extension where extname in('pg_cron','pg_net')"),'0');
 assert.equal(value("select count(*) from pg_namespace where nspname='project_local_reminder_infrastructure'"),'0');
 assert.deepEqual({state:state(),catalog:catalog(),rows:rows()},before);
 console.log('PASS migration fails closed atomically on managed extension grants; ledger54/public data/functions/reminder state unchanged; production installation BLOCKED pending privileged security review');
 process.exit(0);
}
assert.equal(installation.status,0,installation.stderr);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'55');
assert.deepEqual({state:state(),catalog:catalog(),rows:rows()},before);
assert.equal(value('select count(*) from cron.job'),'0');
assert.equal(value('select count(*) from project_local_reminder_infrastructure.invocations'),'0');
assertEffectiveFunctionPolicy(assert,value(effectiveFunctionQuery).split('\n').filter(Boolean).map(line=>JSON.parse(line)));
for(const role of ['anon','authenticated','service_role','project_local_reminder_worker']){
 assert.equal(value(`select has_schema_privilege('${role}','project_local_reminder_infrastructure','USAGE')`),'f');
 for(const signature of ['invoke_worker()','activate_delivery(text)'])assert.equal(value(`select has_function_privilege('${role}','project_local_reminder_infrastructure.${signature}','EXECUTE')`),'f');
 assert.notEqual(sql(`begin;set local role ${role};select project_local_reminder_infrastructure.activate_delivery('OWNER APPROVED AUTOMATIC REMINDER ACTIVATION');rollback;`,true).status,0);
 assert.equal(value(`select has_table_privilege('${role}','project_local_reminder_infrastructure.invocations','SELECT')`),'f');
 assert.equal(value(`select has_schema_privilege('${role}','net','USAGE')`),'f');
 assert.equal(value(`select has_schema_privilege('${role}','cron','USAGE')`),'f');
}
assert.notEqual(sql("select project_local_reminder_infrastructure.activate_delivery('wrong confirmation');",true).status,0);
assert.equal(state(),before.state);
// Failure after activation rolls baseline and enabled state back together.
assert.notEqual(sql("begin;select project_local_reminder_infrastructure.activate_delivery('OWNER APPROVED AUTOMATIC REMINDER ACTIVATION');select 1/0;commit;",true).status,0);
assert.equal(state(),before.state);
// Local transaction only; activation must never be called by the production runner.
sql("begin;select project_local_reminder_infrastructure.activate_delivery('OWNER APPROVED AUTOMATIC REMINDER ACTIVATION');do $$ begin if not exists(select 1 from public.assignment_reminder_activation where delivery_enabled and baseline_at>=transaction_timestamp() and baseline_at<=statement_timestamp()) then raise exception 'Non-atomic activation';end if;end $$;rollback;");
assert.equal(state(),before.state);
// Each psql session is isolated; explicit history refusal is tested transactionally.
assert.notEqual(sql("begin;update public.assignment_reminder_activation set baseline_at=statement_timestamp();select project_local_reminder_infrastructure.activate_delivery('OWNER APPROVED AUTOMATIC REMINDER ACTIVATION');commit;",true).status,0);
assert.equal(state(),before.state);
sql(rollback);assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'54');
assert.deepEqual({state:state(),catalog:catalog(),rows:rows()},before);
sql(apply);assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'55');
console.log('PASS local migration55 atomic failure/apply/empty rollback/replay; public data/102-function policy unchanged; new infrastructure owner-only; activation refusal/atomic rollback; no Cron invocation or provider call');
