// Local Docker only. No environment-derived production connection/provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fixture, sql, value, q } from './12-47-local-fixtures.mjs';
import { buildReminderMessage, sweepAssignmentReminders } from '../lib/notifications/assignmentReminders.ts';
import { effectiveFunctionQuery, assertEffectiveFunctionPolicy } from './function-privilege-policy.mjs';
const migration=fs.readFileSync(new URL('../supabase/migrations/20261021120000_assignment_reminders_phase_a.sql',import.meta.url),'utf8');
const version='20261021120000';
if(process.argv.includes('--replay')) sql(fs.readFileSync(new URL('../supabase/rollback/20261021120000_assignment_reminders_phase_a.sql',import.meta.url),'utf8'));
const catalogue=()=>value(`select md5(string_agg(pg_get_functiondef(p.oid)||p.proowner::text||coalesce(p.proacl::text,''),'|' order by p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`);
const dataFingerprint=()=>value(`select string_agg(tablename||':'||(xpath('/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from public.%I t',tablename),false,true,'')))[1]::text,'|' order by tablename) from pg_tables where schemaname='public' and tablename not like 'assignment_reminder_%'`);
const securityFingerprint=()=>value(`select md5(jsonb_build_array(
 (select jsonb_agg(jsonb_build_array(c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'),
 (select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public'),
 (select jsonb_agg(jsonb_build_array(conrelid::regclass::text,conname,pg_get_constraintdef(oid)) order by oid) from pg_constraint where connamespace='public'::regnamespace),
 (select jsonb_agg(to_jsonb(a) order by oid) from pg_default_acl a)
 )::text)`);
if(value(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}')`)==='f') {
  assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'52');
  const old=catalogue(),oldData=dataFingerprint(),oldSecurity=securityFingerprint();
  const failed=sql(migration.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version) values('${version}'); select 1/0; commit;`),true);
  assert.notEqual(failed.status,0);assert.equal(catalogue(),old);
  assert.equal(dataFingerprint(),oldData);assert.equal(securityFingerprint(),oldSecurity);
  assert.equal(value(`select to_regclass('public.assignment_reminder_activation') is null`),'t');
  assert.equal(value(`select count(*) from supabase_migrations.schema_migrations`),'52');
  sql(migration.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','assignment_reminders_phase_a','{}');commit;`));
  assert.equal(dataFingerprint(),oldData,'Clean migration preserves all existing public data');
  assert.equal(value(`select count(*)||'|'||max(version) from supabase_migrations.schema_migrations`),'53|'+version);
  console.log('PASS atomic migration and forced-failure rollback');
}
assert.equal(value('select delivery_enabled from public.assignment_reminder_activation'),'f');
assert.equal(value('select count(*) from public.assignment_reminder_occurrences'),'0');
assertEffectiveFunctionPolicy(assert,value(effectiveFunctionQuery).split('\n').map(JSON.parse));
for(const role of ['anon','authenticated','service_role']) assert.notEqual(sql(`set role ${role}; select public.run_assignment_reminder_worker('status','{}')`,true).status,0);
assert.notEqual(sql(`set role project_local_reminder_worker; select * from public.calendar_assignments`,true).status,0);
assert.notEqual(sql(`set role project_local_reminder_worker; select public.read_communication_history(null)`,true).status,0);
assert.equal(value(`select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'assignment_reminder_%' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)`),'0');
const f=await fixture();const assignment=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} and volunteer_profile_id=${q(f.volunteers[0])}`);
const baseline='2031-01-01T15:00:00Z';
const sync=(clock=baseline)=>value(`select public.sync_assignment_reminder(${q(assignment)},${q(clock)})`);
const occurrences=()=>JSON.parse(value(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'key',occurrence_key,'due',due_at,'state',scheduling_state,'recipient',recipient_id) order by due_at),'[]') from public.assignment_reminder_occurrences where assignment_id=${q(assignment)}`));
const claim=(id,clock)=>JSON.parse(value(`select coalesce(public.claim_assignment_reminder(${q(id)},${q(clock)}),'null')`));
const revalidate=(c,clock)=>JSON.parse(value(`select coalesce(public.assignment_reminder_dispatch_context(${q(c.recipientId)},${q(c.claimId)},${q(clock)}),'null')`));
const finalize=(c,outcome,clock)=>value(`select public.finalize_assignment_reminder(${q(c.recipientId)},${q(c.claimId)},${q(outcome)},${outcome==='sent'?q('mock-provider'): 'null'},${q(clock)})`);
const wipe=()=>sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};delete from public.communication_recipients where workspace_id=${q(f.ws)};delete from public.communication_operations where workspace_id=${q(f.ws)};`);
const configure=(status='needs_response',date='2031-02-15',activation=baseline)=>{wipe();sql(`update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=${q(activation)};update public.calendar_assignments set created_at='2030-12-01T15:00:00Z' where id=${q(assignment)};update public.calendar_items set start_date=${q(date)},start_time='08:00',end_time='11:00',end_date=null where id=${q(f.items[0])};update public.assignment_responses set response_status=${q(status)},responded_at=${status==='needs_response'?'null':q(activation)} where assignment_id=${q(assignment)};`);};
try {
 configure();sync();let pending=occurrences();assert.equal(pending[0].due,'2031-01-04T15:00:00+00:00');
 const enrolledCatalogue=catalogue(),enrolledData=dataFingerprint();
 const refusedRollback=sql(fs.readFileSync(new URL('../supabase/rollback/20261021120000_assignment_reminders_phase_a.sql',import.meta.url),'utf8'),true);
 assert.notEqual(refusedRollback.status,0);assert.match(refusedRollback.stderr,/destructive rollback refused/);
 assert.equal(catalogue(),enrolledCatalogue);assert.equal(dataFingerprint(),enrolledData);assert.deepEqual(occurrences(),pending);
 assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'53');
 console.log('PASS history-bearing rollback refuses destruction and preserves ledger/data/functions');
 assert.equal(claim(pending[0].id,'2031-01-04T14:59:59Z'),null);
 sql('update public.assignment_reminder_activation set delivery_enabled=false');assert.equal(claim(pending[0].id,'2031-01-04T15:00:00Z'),null);sql('update public.assignment_reminder_activation set delivery_enabled=true');
 let c=claim(pending[0].id,'2031-01-04T15:00:00Z');assert(c);assert(revalidate(c,'2031-01-04T15:00:01Z'));finalize(c,'sent','2031-01-04T15:00:02Z');assert.equal(claim(pending[0].id,'2031-01-04T15:01:00Z'),null);
 sync('2031-01-07T14:59:59Z');assert(occurrences().some(o=>o.key==='pending:2'));const p2=occurrences().find(o=>o.key==='pending:2');assert(claim(p2.id,'2031-01-07T15:00:00Z'));
 console.log('PASS pending anchor, <3d, exact 3d, later ordinal, disabled gate and rerun');
 configure('needs_response','2031-01-06');sync();c=claim(occurrences()[0].id,'2031-01-04T15:00:00Z');assert.equal(revalidate(c,'2031-01-04T15:00:01Z').insideCutoff,true);
 assert.equal(revalidate(c,'2031-01-06T15:00:00Z'),null);
 configure('needs_response','2031-01-06');sync();assert.equal(claim(occurrences()[0].id,'2031-01-06T15:00:00Z'),null);
 console.log('PASS inside/exact 48h and no sending at/after actual start');
 for(const days of [30,14,7,3,1]) {
   configure('confirmed');sync();const o=occurrences().find(o=>o.key==='shift:'+days);assert(o);
   const before=new Date(Date.parse(o.due)-1000).toISOString(),due=new Date(o.due).toISOString();assert.equal(claim(o.id,before),null);c=claim(o.id,due);assert(c);finalize(c,'sent',due);assert.equal(claim(o.id,due),null);
 }
 configure('confirmed','2031-01-06');sync();assert.deepEqual(occurrences().map(o=>o.key),['shift:3','shift:1']);
 console.log('PASS all confirmed exact thresholds, ±1 second, late confirmation and no backfill');
 configure();sync();let o=occurrences()[0];
 const parallel=(query)=>new Promise((resolve,reject)=>{const child=spawn('docker',['exec','-i','supabase_db_cvc-scheduler','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{windowsHide:true});let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('close',code=>code?reject(new Error(err)):resolve(out.trim()));child.stdin.end(query);});
 const concurrent=await Promise.all([parallel(`begin;select coalesce(public.claim_assignment_reminder(${q(o.id)},'2031-01-04T15:00:00Z'),'null');select pg_sleep(.2);commit;`),parallel(`select coalesce(public.claim_assignment_reminder(${q(o.id)},'2031-01-04T15:00:00Z'),'null')`)]);
 assert.equal(concurrent.filter(x=>x.startsWith('{')).length,1);assert.equal(value(`select count(*) from public.assignment_reminder_events where event='claimed' and workspace_id=${q(f.ws)}`),'1');
 console.log('PASS simultaneous database workers: one claim / one logical provider opportunity');
 for(const outcome of ['unknown','sent']) {configure();sync();o=occurrences()[0];c=claim(o.id,'2031-01-04T15:00:00Z');finalize(c,outcome,'2031-01-04T15:00:01Z');assert.equal(claim(o.id,'2031-01-04T15:10:00Z'),null);}
 configure();sync();o=occurrences()[0];c=claim(o.id,'2031-01-04T15:00:00Z');assert.equal(claim(o.id,'2031-01-04T15:10:00Z'),null); // lost finalize / worker interruption
 configure();sync();o=occurrences()[0];c=claim(o.id,'2031-01-04T15:00:00Z');finalize(c,'failed','2031-01-04T15:00:00Z');assert.equal(claim(o.id,'2031-01-04T15:04:59Z'),null);c=claim(o.id,'2031-01-04T15:05:00Z');assert(c);finalize(c,'failed','2031-01-04T15:05:00Z');c=claim(o.id,'2031-01-04T15:15:00Z');assert(c);finalize(c,'failed','2031-01-04T15:15:00Z');assert.equal(claim(o.id,'2031-01-04T15:15:00Z'),null);
 console.log('PASS unknown/accepted/interrupted never reclaim; rejection backoff and 3-attempt cap');
 for(const change of [`update public.assignment_responses set response_status='confirmed',responded_at='2031-01-04T15:00:00Z' where assignment_id=${q(assignment)}`,`update public.assignment_responses set response_status='declined',responded_at='2031-01-04T15:00:00Z' where assignment_id=${q(assignment)}`,`update public.calendar_assignments set lifecycle='canceled' where id=${q(assignment)}`,`update public.calendar_items set start_date='2031-02-16' where id=${q(f.items[0])}`]) {
   sql(`update public.calendar_assignments set lifecycle='active' where id=${q(assignment)}`);configure();sync();c=claim(occurrences()[0].id,'2031-01-04T15:00:00Z');sql(change);assert.equal(revalidate(c,'2031-01-04T15:00:01Z'),null);
 }
 sql(`update public.calendar_assignments set lifecycle='active' where id=${q(assignment)}`);
 configure('confirmed');sync();o=occurrences().find(o=>o.key==='shift:30');c=claim(o.id,o.due);finalize(c,'sent',o.due);sql(`update public.calendar_items set start_date='2031-03-01' where id=${q(f.items[0])}`);sync('2031-01-20T15:00:00Z');assert.equal(occurrences().find(x=>x.key==='shift:30').recipient,c.recipientId);
 console.log('PASS response/cancel/edit during processing; reschedule preserves sent identity');
 assert.equal(value(`select public.assignment_reminder_local_offset('2031-03-10 08:00 America/Denver','America/Denver',-3)`),'2031-03-07 15:00:00+00');
 assert.equal(value(`select public.assignment_reminder_local_offset('2031-11-02 17:00 America/Denver','America/Denver',-1)`),'2031-11-01 23:00:00+00');
 assert.equal(value(`select public.assignment_reminder_local_offset('2031-03-12 02:30 America/Denver','America/Denver',-3)`),'2031-03-09 09:30:00+00');
 assert.equal(value(`select public.assignment_reminder_local_offset('2031-11-03 01:30 America/Denver','America/Denver',-1)`),'2031-11-02 08:30:00+00');
 console.log('PASS project-local spring/fall DST arithmetic (not UTC-day subtraction)');
 configure();sync();const beforePreview=value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)}`);
 const preview=JSON.parse(value(f.auth(`select public.read_assignment_reminders(${q(f.ws)})`)));assert.equal(preview.rows[0].destination.includes('***@'),true);assert.equal(value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)}`),beforePreview);
 assert.notEqual(sql(`set role authenticated;select public.read_assignment_reminders(${q(f.ws)})`,true).status,0);
 sql(`update public.volunteer_profiles set email='household@example.invalid' where id=any(array[${f.volunteers.slice(0,2).map(q)}]::uuid[])`);
 const other=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} and volunteer_profile_id=${q(f.volunteers[1])}`);value(`select public.sync_assignment_reminder(${q(other)},${q(baseline)})`);
 const household=JSON.parse(value(`select jsonb_agg(id) from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)} and due_at='2031-01-04T15:00:00Z'`));assert.equal(household.length,2);
 const claims=household.map(id=>claim(id,'2031-01-04T15:00:00Z'));assert.equal(claims[0].email,claims[1].email);assert.notEqual(claims[0].volunteerId,claims[1].volunteerId);assert(claims.every(c=>!JSON.stringify(c).includes('PRIVATE')));
 for(const [key,inside] of [['pending:1',false],['pending:1',true],...['30','14','7','3','1'].map(n=>['shift:'+n,false])]) {
   const ctx={...claims[0],kind:key.startsWith('shift')?'shift':'response',occurrenceKey:key,insideCutoff:inside};const m=buildReminderMessage(ctx,'https://projectlocal.app');assert(m.text.includes('8:00 AM'));assert(!/08:00|:00:00|\/v\/access\/|PRIVATE|Fellow worker/.test(m.text));if(ctx.kind==='shift')assert(!m.text.includes("choose Confirm"));
 }
 console.log('PASS names-only-safe minimal payload, lookup-only links, templates, shared identities and read-only preview authorization');
 const events=fs.readFileSync(new URL('../supabase/scheduler/assignment-reminders.sql.example',import.meta.url),'utf8');assert(events.includes("'*/5 * * * *'"));assert(events.includes('vault.decrypted_secrets'));assert(!migration.includes('cron.schedule('));
 // Engine tests inject only local RPC/provider fakes. No real fetch available to simulator.
 let sends=0;const base={...claims[0],insideCutoff:false};let claimed=false;
 const fakeRpc=async(command)=>command==='status'?{enabled:true,workspaces:[f.ws]}:command==='sync'?{evaluated:1,after:null}:command==='due'?['occurrence']:command==='claim'?(claimed?null:(claimed=true,base)):command==='revalidate'?base:'sent';
 const disabled=await sweepAssignmentReminders(fakeRpc,'https://projectlocal.app');assert.equal(disabled.sent,0);assert.equal(claimed,false);
 const simulated=await sweepAssignmentReminders(fakeRpc,'https://projectlocal.app',{kind:'simulated',send:async()=>{sends++;return{status:'accepted',providerMessageId:'mock-provider'};}});assert.equal(sends,1);assert.equal(simulated.sent,1);
 console.log('PASS Phase A default refuses delivery, explicit simulator only, Cron template contract');
 configure();sync();o=occurrences()[0];
 // Read-only preview uses exactly the claim's live response/start/destination gates.
 sql(`update public.assignment_responses set response_status='confirmed',responded_at='2031-01-02T15:00:00Z' where assignment_id=${q(assignment)}`);
 assert.equal(JSON.parse(value(`select public.assignment_reminder_report(${q(f.ws)},'2031-01-04T15:00:00Z')`)).rows.filter(r=>r.eligible).length,0);
 for(const change of [`update public.volunteer_profiles set lifecycle='inactive' where id=${q(f.volunteers[0])}`,`update public.calendar_items set lifecycle='archived' where id=${q(f.items[0])}`]) {
   sql(`update public.volunteer_profiles set lifecycle='active' where id=${q(f.volunteers[0])};update public.calendar_items set lifecycle='active' where id=${q(f.items[0])}`);
   configure();sync();sql(change);assert.equal(claim(occurrences()[0].id,'2031-01-04T15:00:00Z'),null);
 }
 sql(`update public.volunteer_profiles set lifecycle='active' where id=${q(f.volunteers[0])};update public.calendar_items set lifecycle='active' where id=${q(f.items[0])}`);
 configure('confirmed','2031-11-02','2031-09-01T14:00:00Z');
 sql(`update public.calendar_items set start_time='17:00',end_time='05:00',end_date='2031-11-03' where id=${q(f.items[0])}`);
 sync('2031-09-01T14:00:00Z');assert.equal(occurrences().find(x=>x.key==='shift:1').due,'2031-11-01T23:00:00+00:00');
 console.log('PASS preview live gates, inactive profiles/items and actual overnight start across DST');
 configure();sync();o=occurrences()[0];assert.equal(claim(o.id,'2031-01-04T15:15:01Z'),null);assert.equal(occurrences()[0].state,'expired');
 configure();sql(`update public.calendar_assignments set created_at='2031-01-01T16:00:00Z' where id=${q(assignment)}`);sync('2031-01-01T17:00:00Z');assert.equal(occurrences().length,0);
 sql(`insert into public.assignment_notification_deliveries(workspace_id,calendar_item_id,calendar_assignment_id,volunteer_profile_id,delivery_state,recipient_email_snapshot,provider_message_id,idempotency_key,sent_at) values(${q(f.ws)},${q(f.items[0])},${q(assignment)},${q(f.volunteers[0])},'sent','fixture@example.invalid','mock-initial','local-reminder-anchor','2031-01-02T15:00:00Z')`);
 sync('2031-01-02T15:00:01Z');assert.equal(occurrences()[0].due,'2031-01-05T15:00:00+00:00');
 sql(`update public.assignment_notification_deliveries set sent_at='2031-01-03T15:00:00Z' where calendar_assignment_id=${q(assignment)}`);sync('2031-01-03T15:00:01Z');assert.equal(occurrences()[0].due,'2031-01-05T15:00:00+00:00');
 console.log('PASS 15-minute expiry, initial successful delivery anchor and resend does not reset it');
 sql(`delete from public.assignment_notification_deliveries where workspace_id=${q(f.ws)};update public.calendar_assignments set created_at='2030-12-01T15:00:00Z' where id=${q(assignment)}`);
 configure();sync();
 // Historical-heavy discovery: actual active historical assignments, not just empty items.
 sql(`insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,publication_state,published_at,published_by_project_contact_id,created_by_project_contact_id)
   select gen_random_uuid(),${q(f.ws)},'Historical reminder fixture','general','timed','1990-01-01','08:00','10:00','America/Denver',1,'active','published',now(),${q(f.contact)},${q(f.contact)} from generate_series(1,10000);
   insert into public.calendar_assignments(workspace_id,calendar_item_id,volunteer_profile_id,lifecycle)
   select ${q(f.ws)},id,${q(f.volunteers[0])},'active' from public.calendar_items where workspace_id=${q(f.ws)} and title_snapshot='Historical reminder fixture';
   analyze public.calendar_items;analyze public.calendar_assignments;`);
 sql(`insert into public.assignment_reminder_enrollments(assignment_id,workspace_id,volunteer_id,response_status,response_baseline,start_at) select a.id,a.workspace_id,a.volunteer_profile_id,'needs_response','1989-12-01T15:00Z','1990-01-01T15:00Z' from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id where a.workspace_id=${q(f.ws)} and i.title_snapshot='Historical reminder fixture';
 insert into public.assignment_reminder_occurrences(workspace_id,assignment_id,volunteer_id,kind,occurrence_key,due_at,start_at,enrolled_at,scheduling_state) select workspace_id,assignment_id,volunteer_id,'response','pending:1','1989-12-04T15:00Z',start_at,response_baseline,'expired' from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)} and start_at='1990-01-01T15:00Z';analyze public.assignment_reminder_occurrences;`);
 const plan=JSON.parse(value(`explain(analyze,format json) with future_items as materialized(select id from public.calendar_items where workspace_id=${q(f.ws)} and lifecycle='active' and publication_state='published' and start_date>=('2031-01-01T15:00Z'::timestamptz at time zone (select timezone from public.workspaces where id=${q(f.ws)}))::date) select a.id from future_items i cross join lateral(select id from public.calendar_assignments where workspace_id=${q(f.ws)} and calendar_item_id=i.id and lifecycle='active' order by id limit 200) a order by a.id limit 200`));
 fs.mkdirSync(new URL('../docs/audits/12-57-evidence/',import.meta.url),{recursive:true});
 fs.writeFileSync(new URL('../docs/audits/12-57-evidence/discovery-explain.json',import.meta.url),JSON.stringify(plan,null,2)+'\n');
 const duePlan=JSON.parse(value(`explain(analyze,format json) select id from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)} and scheduling_state='active' and due_at between '2031-01-04T14:45Z' and '2031-01-04T15:00Z' order by due_at,id limit 20`));
 fs.writeFileSync(new URL('../docs/audits/12-57-evidence/due-explain.json',import.meta.url),JSON.stringify(duePlan,null,2)+'\n');
 const claimPlan=JSON.parse(value(`explain(analyze,format json) select public.claim_assignment_reminder(${q(occurrences()[0].id)},'2031-01-04T15:00Z')`));
 fs.writeFileSync(new URL('../docs/audits/12-57-evidence/claim-explain.json',import.meta.url),JSON.stringify(claimPlan,null,2)+'\n');
 assert.equal(value(`select count(*) from public.assignment_reminder_events where workspace_id=${q(f.ws)} and event='claimed'`),'1');
 assert(plan[0].Plan['Actual Rows']<=200);assert(JSON.stringify(plan).includes('Index'));
 console.log(JSON.stringify({historicalAssignments:10000,discoveryMs:plan[0]['Execution Time'],dueMs:duePlan[0]['Execution Time'],claimMs:claimPlan[0]['Execution Time'],actualRows:plan[0].Plan['Actual Rows']}));
} finally {
 wipe();sql(`update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null`);await f.cleanup();
}
assert.equal(value('select count(*) from public.assignment_reminder_occurrences'),'0');
console.log('PASS reminders regression; real provider calls ZERO; production connections NONE');
