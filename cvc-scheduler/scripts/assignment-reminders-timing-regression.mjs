// Local Docker fixtures only; no production connection or provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture, sql, value, q } from './12-47-local-fixtures.mjs';
import { effectiveFunctionQuery, assertEffectiveFunctionPolicy } from './function-privilege-policy.mjs';
const version='20261021130000';
const source=fs.readFileSync(new URL(`../supabase/migrations/${version}_assignment_reminder_local_delivery_times.sql`,import.meta.url),'utf8');
const rollback=fs.readFileSync(new URL(`../supabase/rollback/${version}_assignment_reminder_local_delivery_times.sql`,import.meta.url),'utf8');
const atomic=source.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','assignment_reminder_local_delivery_times','{}');commit;`);
const snapshot=()=>value(`select md5(string_agg(n||'.'||t||':'||h,'|' order by n,t)) from (
 select schemaname n,tablename t,(xpath('/row/hash/text()',query_to_xml(format('select count(*)::text||'':''||md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from %I.%I t',schemaname,tablename),false,true,'')))[1]::text h
 from pg_tables where schemaname='public' or (schemaname='auth' and tablename in ('users','identities'))
 union all select schemaname,sequencename,(xpath('/row/hash/text()',query_to_xml(format('select last_value::text||'':''||is_called hash from %I.%I',schemaname,sequencename),false,true,'')))[1]::text from pg_sequences where schemaname in ('public','auth')) s`);
const functions=()=>JSON.parse(value(`select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'definer',p.prosecdef) order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`));
if(value(`select exists(select 1 from supabase_migrations.schema_migrations where version='${version}')`)==='f') {
 assert.equal(value('select count(*)||\'|\'||max(version) from supabase_migrations.schema_migrations'),'53|20261021120000');
 const before=snapshot(),defs=functions();
 assert.notEqual(sql(atomic.replace(/commit;\s*$/,'select 1/0;commit;'),true).status,0);
 assert.equal(snapshot(),before);assert.deepEqual(functions(),defs);assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'53');
 sql(atomic);assert.equal(snapshot(),before);
 const after=functions();assert.equal(after.length,defs.length);let changed=0;
 for(let i=0;i<defs.length;i++){const {definition:a,...metaA}=defs[i],{definition:b,...metaB}=after[i];assert.deepEqual(metaA,metaB);if(a!==b){changed++;assert.equal(defs[i].signature,'assignment_reminder_local_offset(timestamp with time zone,text,integer)');}}
 assert.equal(changed,1);sql(rollback);assert.equal(snapshot(),before);assert.deepEqual(functions(),defs);sql(atomic);
 console.log('PASS atomic 53 -> 54; forced failure unchanged; one function body only; empty rollback/replay; all public/Auth rows and sequences preserved');
}
assertEffectiveFunctionPolicy(assert,value(effectiveFunctionQuery).split('\n').map(JSON.parse));
const local=(instant,days,zone='America/Denver')=>value(`select to_char(public.assignment_reminder_local_offset(${q(instant)},${q(zone)},${days}) at time zone ${q(zone)},'YYYY-MM-DD HH24:MI')`);
for(const time of ['00:00','08:00','21:48','23:59'])assert.equal(local(`2026-10-21 ${time} America/Denver`,3),'2026-10-24 09:00');
assert.equal(local('2026-10-22 00:01 America/Denver',3),'2026-10-25 09:00');
for(const days of [3,6,9])assert.equal(local('2026-10-21 21:48 America/Denver',days),`2026-10-${21+days} 09:00`);
for(const [days,date] of [[30,'2026-10-16'],[14,'2026-11-01'],[7,'2026-11-08'],[3,'2026-11-12'],[1,'2026-11-14']])assert.equal(local('2026-11-15 07:30 America/Denver',-days),date+(days===1?' 17:00':' 09:00'));
for(const zone of ['America/Denver','Pacific/Auckland','Asia/Kolkata'])for(const instant of ['2031-03-10 23:45','2031-11-03 01:30'])for(const days of [3,-3,-1])assert(local(`${instant} ${zone}`,days,zone).endsWith(days===-1?'17:00':'09:00'));
assert.equal(local('2031-03-08 22:00 America/Denver',3),'2031-03-11 09:00');
assert.equal(local('2031-10-31 22:00 America/Denver',3),'2031-11-03 09:00');
assert.equal(local('2031-03-10 02:30 America/Denver',-1),'2031-03-09 17:00');
assert.equal(local('2031-11-03 01:30 America/Denver',-1),'2031-11-02 17:00');
console.log('PASS morning/evening/midnight anchors, +3/+6/+9 at 9 AM; confirmed 9 AM and day-before 5 PM; spring/fall DST and other project zones');
const f=await fixture();const assignment=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} and volunteer_profile_id=${q(f.volunteers[0])}`);
const wipe=()=>sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};delete from public.communication_recipients where workspace_id=${q(f.ws)};delete from public.communication_operations where workspace_id=${q(f.ws)};`);
const configure=(status,clock,start='2031-11-15',time='07:30')=>{wipe();sql(`update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=${q(clock)};update public.calendar_assignments set created_at='2030-01-01' where id=${q(assignment)};update public.calendar_items set start_date=${q(start)},start_time=${q(time)},end_time='12:00',end_date=null where id=${q(f.items[0])};update public.assignment_responses set response_status=${q(status)},created_at=${q(clock)},responded_at=${status==='confirmed'?q(clock):'null'} where assignment_id=${q(assignment)};`);};
const sync=clock=>value(`select public.sync_assignment_reminder(${q(assignment)},${q(clock)})`);
const entries=()=>JSON.parse(value(`select coalesce(jsonb_agg(jsonb_build_object('id',id,'key',occurrence_key,'due',due_at,'state',scheduling_state,'recipient',recipient_id) order by due_at),'[]') from public.assignment_reminder_occurrences where assignment_id=${q(assignment)}`));
const preview=clock=>{const before=snapshot();const r=JSON.parse(value(`begin read only;select public.assignment_reminder_report(${q(f.ws)},${q(clock)});rollback;`));assert.equal(snapshot(),before);return r.prospective.rows.find(row=>row.assignment_id===assignment);};
try {
 for(const time of ['08:00','21:48','00:00','23:59']){
  const clock=`2031-10-21 ${time} America/Denver`;configure('needs_response',clock);sync(clock);
  assert.equal(entries()[0].due,'2031-10-24T15:00:00+00:00');assert.equal(preview(clock).reminders[0].due_at,entries()[0].due);
 }
 configure('needs_response','2031-10-21 21:48 America/Denver');sync('2031-10-24 09:01 America/Denver');assert(!entries().some(o=>o.key==='pending:1'));assert.equal(entries()[0].due,'2031-10-27T15:00:00+00:00');
 sync('2031-10-27 08:59 America/Denver');assert(entries().some(o=>o.key==='pending:3'&&o.due==='2031-10-30T15:00:00+00:00'));
 configure('needs_response','2031-10-21 21:48 America/Denver','2031-10-24','08:00');sync('2031-10-21 21:48 America/Denver');assert.equal(entries().length,0);assert.equal(preview('2031-10-21 21:48 America/Denver').classification,'excluded');
 for(const days of [30,14,7,3,1])for(const delta of [-60,0,60]){
  const due=value(`select public.assignment_reminder_local_offset('2031-11-15 07:30 America/Denver','America/Denver',${-days})`);
  const clock=new Date(Date.parse(due)+delta*1000).toISOString();configure('confirmed',clock);sync(clock);
  assert.equal(entries().some(o=>o.key==='shift:'+days),delta<0,`strict enrollment at ${days}-day threshold ${delta}`);
  assert.equal(preview(clock).reminders.some(o=>o.occurrence_key==='shift:'+days),delta<0,`strict preview at ${days}-day threshold ${delta}`);
 }
 configure('confirmed','2031-11-10 12:00 America/Denver');sync('2031-11-10 12:00 America/Denver');assert.deepEqual(entries().map(o=>o.key),['shift:3','shift:1']);
 configure('needs_response','2031-10-21 21:48 America/Denver','2031-10-26','08:00');sync('2031-10-21 21:48 America/Denver');const pending=entries()[0];const claim=JSON.parse(value(`select public.claim_assignment_reminder(${q(pending.id)},${q(pending.due)})`));assert(claim);assert.equal(JSON.parse(value(`select public.assignment_reminder_dispatch_context(${q(claim.recipientId)},${q(claim.claimId)},${q(pending.due)})`)).insideCutoff,true);assert.equal(value(`select public.assignment_reminder_dispatch_context(${q(claim.recipientId)},${q(claim.claimId)},'2031-10-26 08:00 America/Denver') is null`),'t');
 configure('confirmed','2031-10-01 08:00 America/Denver');sync('2031-10-01 08:00 America/Denver');const old=entries().find(o=>o.key==='shift:30');const c=JSON.parse(value(`select public.claim_assignment_reminder(${q(old.id)},${q(old.due)})`));value(`select public.finalize_assignment_reminder(${q(c.recipientId)},${q(c.claimId)},'sent','mock-only',${q(old.due)})`);
 sql(`update public.calendar_items set start_date='2031-11-20',start_time='17:00',end_date='2031-11-21',end_time='05:00' where id=${q(f.items[0])}`);sync('2031-10-20 08:00 America/Denver');
 const moved=entries();assert.equal(moved.find(o=>o.key==='shift:30').recipient,c.recipientId);
 for(const [key,due] of [['shift:7','2031-11-13T16:00:00+00:00'],['shift:3','2031-11-17T16:00:00+00:00'],['shift:1','2031-11-20T00:00:00+00:00']])assert.equal(moved.find(o=>o.key===key).due,due);
 assert(Number(value(`select count(*) from public.assignment_reminder_events where workspace_id=${q(f.ws)} and event='rescheduled'`))>0);
 const retained=snapshot();assert.notEqual(sql(rollback,true).status,0);assert.equal(snapshot(),retained);
 console.log('PASS strict 08:59/09:00/09:01 and 16:59/17:00/17:01; no late catch-up; pending cutoff/start; overnight reschedule and sent identity/history; history rollback refuses');
 for(let n=0;n<10;n++)preview('2031-10-21 21:48 America/Denver');
 console.log('PASS repeated preview preserves every public/Auth row and sequence; zero provider calls');
} finally {wipe();sql("update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null,scan_cursors='{}'");await f.cleanup();}
assert.equal(value('select delivery_enabled::text||\'|\'||(baseline_at is null)||\'|\'||(select count(*) from public.assignment_reminder_occurrences) from public.assignment_reminder_activation'),'false|true|0');
console.log('PASS 12.57B timing; no production connections, no providers, baseline NULL and delivery disabled after fixtures');
