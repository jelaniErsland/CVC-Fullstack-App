import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const container = process.env.LOCAL_SCHEMA_CONTAINER || 'supabase_db_cvc-scheduler';
assert(/^supabase_db_cvc-(?:scheduler|1250-replay)$/.test(container));
function scalar(query) {
  const r=spawnSync('docker',['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,r.stderr);
  return r.stdout.trim();
}
const files=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(n=>/^\d{14}_[a-z0-9_]+\.sql$/.test(n)).sort();
assert.deepEqual(scalar('select version from supabase_migrations.schema_migrations order by version').split(/\r?\n/), files.map(n=>n.slice(0,14)));
assert.equal(scalar("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity"),'0');
for(const trigger of ['calendar_item_operational_insert','calendar_assignment_explicit_draft_guard']) assert.equal(scalar(`select count(*) from pg_trigger where tgname='${trigger}' and not tgisinternal`),'1');
for(const signature of ['public.activate_calendar_item(uuid)','public.create_calendar_item_draft(uuid,uuid,text,text,text,date,date,time without time zone,time without time zone,integer,text,jsonb)']) {
  assert.equal(scalar(`select has_function_privilege('authenticated','${signature}','EXECUTE')`),'t');
  assert.equal(scalar(`select has_function_privilege('anon','${signature}','EXECUTE')`),'f');
}
for(const signature of ['public.calendar_item_operational_insert()','public.guard_explicit_draft_assignment()']) {
  assert.equal(scalar(`select has_function_privilege('authenticated','${signature}','EXECUTE')`),'f');
  assert.equal(scalar(`select has_function_privilege('anon','${signature}','EXECUTE')`),'f');
}
assert.equal(scalar("select pg_get_functiondef('public.communication_preview(uuid,jsonb)'::regprocedure) like '%changedSinceLastSend%'"),'t');
assert.equal(scalar("select count(*) from public.calendar_items where publication_state='draft' and explicit_draft and exists(select 1 from public.calendar_assignments a where a.calendar_item_id=calendar_items.id and a.lifecycle='active')"),'0');
console.log('PASS: 12.50 ledger, RLS, triggers, RPC privileges, communication comparison and draft assignment invariant.');
