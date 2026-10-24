// Disposable LOCAL fixtures only; never accepts a database URL or provider key.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture, sql, value, q} from './12-47-local-fixtures.mjs';
import {withLocalReminderRunner} from './reminder-database-local-fixture.mjs';
import {withLocalSupavisor} from './reminder-supavisor-local-fixture.mjs';
import {createReminderWorkerRpc} from '../lib/notifications/reminderDatabase.server.ts';
import {runReminderWorker, handleReminderWorker} from '../lib/notifications/reminderWorker.server.ts';
import {ReminderStageFailure, reminderFailureMetadata} from '../lib/notifications/reminderDiagnostics.server.ts';
import {signSchedulerRequest, TIMESTAMP_HEADER, SIGNATURE_HEADER} from '../workers/reminder-clock/src/protocol.mjs';
import {effectiveFunctionQuery,assertEffectiveFunctionPolicy} from './function-privilege-policy.mjs';

const version='20261023120000';
const original=value("select pg_get_functiondef('public.run_assignment_reminder_worker(text,jsonb)'::regprocedure)");
const oldHash=value("select md5(prosrc) from pg_proc where oid='public.run_assignment_reminder_worker(text,jsonb)'::regprocedure");
assert.equal(value('select count(*)||\'|\'||max(version) from supabase_migrations.schema_migrations'),'55|20261022120000');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261023120000_assignment_reminder_worker_record.sql',import.meta.url),'utf8');
const apply=migration.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','assignment_reminder_worker_record','{}');commit;`);
const fail=sql(apply.replace(/commit;\s*$/,'select 1/0;commit;'),true);
assert.notEqual(fail.status,0);assert.match(fail.stderr,/division by zero/);
assert.equal(value("select md5(prosrc) from pg_proc where oid='public.run_assignment_reminder_worker(text,jsonb)'::regprocedure"),oldHash);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'55');
sql(apply);
assertEffectiveFunctionPolicy(assert,value(effectiveFunctionQuery).split('\n').map(JSON.parse));
const rollback=fs.readFileSync(new URL('../supabase/rollback/20261023120000_assignment_reminder_worker_record.sql',import.meta.url),'utf8');
sql(rollback);
assert.equal(value("select md5(prosrc) from pg_proc where oid='public.run_assignment_reminder_worker(text,jsonb)'::regprocedure"),oldHash);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'55');
sql(apply);
let realProviderCalls=0;
try {
 await withLocalReminderRunner(async({environment})=>{
  const fixtures=[];
  const restoreActivation=value('select to_jsonb(a)::text from public.assignment_reminder_activation a');
  try {
   fixtures.push(await fixture(),await fixture());
   const baseline=new Date().toISOString();
   for(const f of fixtures)sql(`update public.calendar_assignments set created_at=${q(baseline)}::timestamptz-interval '1 day' where workspace_id=${q(f.ws)};
    update public.assignment_responses set response_status='confirmed',responded_at=${q(baseline)} where assignment_id=(select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} order by id limit 1);
    update public.volunteer_profiles set email='shared@example.invalid' where id=any(array[${f.volunteers.slice(0,2).map(q)}]::uuid[]);`);
   sql(`update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=${q(baseline)};`);
   const env={...environment,RESEND_API_KEY:'re_LOCAL_FAKE_NEVER_SENT'};
   const forbidProvider=async()=>{realProviderCalls++;throw new Error('No fixture reminder is due; provider forbidden');};
   await withLocalSupavisor(async({poolerConfig,Pool})=>{
    const pools=[new Pool(poolerConfig(new URL(environment.REMINDER_DATABASE_URL).password)),new Pool(poolerConfig(new URL(environment.REMINDER_DATABASE_URL).password))];
    let active=0,maxActive=0,commits=0,forceTimeout=false;
    for(const pool of pools)pool.on('connect',client=>{
     const query=client.query.bind(client);client.query=async(...args)=>{
      if(args[0]==='BEGIN'){active++;maxActive=Math.max(maxActive,active);}
      try{
       if(forceTimeout && args[0].startsWith('SELECT public.') && args[1][0]==='sync')return await query('select pg_sleep(9)');
       return await query(...args);
      }finally{if(['COMMIT','ROLLBACK'].includes(args[0])){active--;if(args[0]==='COMMIT')commits++;}}
     };
    });
    try {
     const once=()=>runReminderWorker(env,forbidProvider,e=>createReminderWorkerRpc(e,pools[0]));
     const first=await once();assert.equal(first.eligible,0);assert.equal(first.sent,0);assert(first.evaluated>=12);
     const fingerprint=()=>value("select md5(jsonb_build_array((select jsonb_agg(to_jsonb(e) order by assignment_id) from public.assignment_reminder_enrollments e),(select jsonb_agg(to_jsonb(o) order by id) from public.assignment_reminder_occurrences o),(select jsonb_agg(to_jsonb(e) order by id) from public.assignment_reminder_events e))::text)");
     const firstHash=fingerprint();await once();assert.equal(fingerprint(),firstHash);
     const refused=sql(rollback,true);assert.notEqual(refused.status,0);assert.match(refused.stderr,/rollback refused/);
     assert.equal(fingerprint(),firstHash,'Rollback cannot erase history');
     await Promise.all(pools.map(pool=>runReminderWorker(env,forbidProvider,e=>createReminderWorkerRpc(e,pool))));
     assert.equal(fingerprint(),firstHash);assert(maxActive<=2);assert.equal(active,0);
     for(const pool of pools){const c=await pool.connect();try{assert.equal((await c.query('select current_user')).rows[0].current_user,'project_local_reminder_runner');}finally{c.release();}}
     assert.equal(value("select count(*) from(select assignment_id,occurrence_key from public.assignment_reminder_occurrences group by assignment_id,occurrence_key having count(*)>1)d"),'0');
     forceTimeout=true;const timeoutAt=Date.now();
     await assert.rejects(once(),e=>e.stage==='enrollment_sync_failed'&&e.errorCode==='57014');
     forceTimeout=false;assert(Date.now()-timeoutAt>=7900 && Date.now()-timeoutAt<12000);
     assert.equal((await createReminderWorkerRpc(env,pools[0])('status')).enabled,true,'Fresh connection recovers after timeout/discard');
     // A missed nominal threshold must never be enrolled as catch-up, even with
     // the original activation baseline retained. Controlled time is SQL-local.
     const f=fixtures[0],assignment=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} order by id limit 1`);
     sql(`update public.calendar_items set start_date='2031-10-24',start_time='06:30',end_time='10:00' where id=${q(f.items[0])};
      update public.assignment_responses set response_status='confirmed',responded_at='2031-10-01T00:00Z' where assignment_id=${q(assignment)};
      select public.sync_assignment_reminder(${q(assignment)},'2031-10-23T23:00:01Z');`);
     assert.equal(value(`select count(*) from public.assignment_reminder_occurrences where assignment_id=${q(assignment)} and occurrence_key='shift:1' and scheduling_state='active'`),'0');
     sql('update public.assignment_reminder_activation set delivery_enabled=false');
     let configReads=0;const off={...environment};Object.defineProperty(off,'RESEND_API_KEY',{get(){configReads++;throw new Error('Off getter forbidden');}});
     assert.equal((await runReminderWorker(off,forbidProvider,e=>createReminderWorkerRpc(e,pools[0]))).phase,'disabled');assert.equal(configReads,0);
     console.log(JSON.stringify({first,workspaces:fixtures.length,maxActiveTransactions:maxActive,commits,duplicateOccurrences:0,rerunExact:true,concurrentExact:true,roleReset:true,offProviderReads:configReads,realProviderCalls}));
    }finally{await Promise.all(pools.map(p=>p.end()));}
   });
  }finally{
   sql('update public.assignment_reminder_activation set delivery_enabled=false');
   for(const f of fixtures){sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};`);await f.cleanup();}
   const before=JSON.parse(restoreActivation);sql(`update public.assignment_reminder_activation set delivery_enabled=${before.delivery_enabled},baseline_at=${q(before.baseline_at)},scan_cursors=${q(JSON.stringify(before.scan_cursors))}::jsonb`);
  }
 });
 // Safe telemetry: stage and allowlisted SQLSTATE only; never message/stack.
 const secret='PRIVATE_DATABASE_URL_EMAIL_INSTRUCTIONS_PROVIDER_SECRET';
 const dbError=Object.assign(new Error(secret),{code:'55000'});
 const classified=new ReminderStageFailure('enrollment_sync_failed',new ReminderStageFailure('worker_command_failed',dbError));
 assert.deepEqual(reminderFailureMetadata(classified),{stage:'enrollment_sync_failed',errorCode:'55000',databaseStage:'worker_command_failed',errorClass:'database'});
 assert(!JSON.stringify(classified).includes(secret));
 for(const code of ['57014','55P03','28P01','ECONNRESET'])assert.equal(new ReminderStageFailure('connection_failed',Object.assign(new Error(secret),{code})).errorCode,code);
 assert.equal(new ReminderStageFailure('connection_failed',{code:secret}).errorCode,'unclassified');
 const key='6'.repeat(64),stamp=String(Math.floor(Date.now()/1000));
 const request=()=>new Request('https://projectlocal.app/internal/reminders',{method:'POST',headers:{[TIMESTAMP_HEADER]:stamp,[SIGNATURE_HEADER]:signature}});
 const signature=await signSchedulerRequest(key,stamp),logs=[],saved=console.error;console.error=x=>logs.push(JSON.parse(x));
 try {
  const response=await handleReminderWorker(request(),{REMINDER_SCHEDULER_HMAC_SECRET:key},async()=>{throw new Error('Provider forbidden');},()=>async()=>{throw classified;});
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Reminder sweep unavailable.'});
  assert.equal(logs[0].stage,'status_failed');assert.equal(logs[0].errorCode,'55000');assert(logs[0].runId);assert.equal(logs[0].httpStatus,503);
  assert(!JSON.stringify(logs).includes(secret));assert(!JSON.stringify(logs).includes(key));
 }finally{console.error=saved;}
 console.log('PASS enabled real LOCAL Supavisor max1 pools, two workspaces, prospective pending/confirmed, shared households, repeated/concurrent sync, role reset, no late catch-up, emergency Off and safe telemetry. Real provider calls ZERO.');
}finally{
 sql(original+`;delete from supabase_migrations.schema_migrations where version='${version}';`);
 assert.equal(value("select md5(prosrc) from pg_proc where oid='public.run_assignment_reminder_worker(text,jsonb)'::regprocedure"),oldHash);
}
