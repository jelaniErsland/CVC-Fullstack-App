// Run the unchanged LIVE application worker against local DB58, with an injected
// local restricted-runner connection and a provider that must never be called.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
import {fixture,sql,value,q} from './12-47-local-fixtures.mjs';
import {withLocalReminderRunner,localConfig} from './reminder-database-local-fixture.mjs';
const dir=process.env.REMINDER_FIXTURE_APP_DIR;assert(dir);
const {runReminderWorker}=await import(pathToFileURL(path.join(dir,'lib/notifications/reminderWorker.server.ts')).href);
const {createReminderWorkerRpc}=await import(pathToFileURL(path.join(dir,'lib/notifications/reminderDatabase.server.ts')).href);
assert.equal(value("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations"),'58|20261028120000');
let providerCalls=0;
await withLocalReminderRunner(async({password,environment})=>{
 const f=await fixture();const before=JSON.parse(value('select row_to_json(a) from public.assignment_reminder_activation a'));const pool=new pg.Pool(localConfig(password));
 try{
  const baseline=value('select statement_timestamp()::text');
  sql(`update public.calendar_assignments set created_at=${q(baseline)}::timestamptz-interval '1 day' where workspace_id=${q(f.ws)};update public.assignment_responses set response_status='confirmed',responded_at=${q(baseline)} where assignment_id in(select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])});update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=${q(baseline)}`);
  const once=()=>runReminderWorker({...environment,RESEND_API_KEY:'re_local_fixture_only'},async()=>{providerCalls++;throw Error('Provider forbidden');},e=>{const rpc=createReminderWorkerRpc(e,pool);return async(command,payload)=>{const result=await rpc(command,payload);return command==='status'?{...result,workspaces:result.workspaces.filter(id=>id===f.ws)}:result;};});
  const first=await once();assert(first.evaluated>=6);assert.equal(first.sent,0);assert.equal(first.eligible,0);assert.equal(providerCalls,0);
  const snapshot=()=>value(`select md5(jsonb_build_array((select jsonb_agg(to_jsonb(e) order by assignment_id) from public.assignment_reminder_enrollments e where workspace_id=${q(f.ws)}),(select jsonb_agg(to_jsonb(o) order by id) from public.assignment_reminder_occurrences o where workspace_id=${q(f.ws)}))::text)`);
  const hash=snapshot();await once();assert.equal(snapshot(),hash);await Promise.all([once(),once()]);assert.equal(snapshot(),hash);
  assert.equal(value(`select count(*) from (select assignment_id,occurrence_key from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)} group by assignment_id,occurrence_key having count(*)>1)d`),'0');
  const result={app:'19fe6a29d5b59941bb0612cf9e18fe85a080f474',db:58,first,repeatExact:true,concurrentExact:true,providerCalls};fs.writeFileSync('../previews/12-62-release-prep/mixed-version-worker.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{
  await pool.end();sql(`update public.assignment_reminder_activation set delivery_enabled=false;delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};`);await f.cleanup();
  sql(`update public.assignment_reminder_activation set delivery_enabled=${before.delivery_enabled},baseline_at=${q(before.baseline_at)},scan_cursors=${q(JSON.stringify(before.scan_cursors))}::jsonb`);
 }
});
assert.equal(providerCalls,0);console.log('PASS exact old application worker on DB58; future-only sync, repeated/concurrent idempotency; provider calls zero');
