// Disposable local Docker only. No production configuration or provider imports.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture,sql,value,q } from './12-47-local-fixtures.mjs';
const f=await fixture();
const clock='2031-01-01T15:00:00Z';
const assignment=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} and volunteer_profile_id=${q(f.volunteers[0])}`);
const snapshot=()=>value(`select md5(string_agg(n||'.'||t||':'||h,'|' order by n,t)) from (
 select schemaname n,tablename t,(xpath('/row/hash/text()',query_to_xml(format('select count(*)::text||'':''||md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from %I.%I t',schemaname,tablename),false,true,'')))[1]::text h
 from pg_tables where schemaname='public' or (schemaname='auth' and tablename in ('users','identities'))
 union all select schemaname,sequencename,(xpath('/row/hash/text()',query_to_xml(format('select last_value::text||'':''||is_called hash from %I.%I',schemaname,sequencename),false,true,'')))[1]::text from pg_sequences where schemaname in ('public','auth')) s`);
let reads=0;
function read(at=clock,after=null) {
 const before=snapshot();
 const report=JSON.parse(value(`begin read only;select public.assignment_reminder_report(${q(f.ws)},${q(at)},${q(after)});rollback;`));
 assert.equal(snapshot(),before,'SELECT preview preserves every public/Auth row and sequence state');reads++;
 assert(!JSON.stringify(report).includes('PRIVATE'));assert(!JSON.stringify(report).includes(f.token));
 assert(!JSON.stringify(report).includes(`fixture-${f.ws}-0@example.invalid`));
 return report;
}
const row=(report)=>report.prospective.rows.find(r=>r.assignment_id===assignment);
function configure(status='needs_response',day='2031-02-15') {
 sql(`update public.calendar_assignments set lifecycle='active' where workspace_id=${q(f.ws)};
 update public.calendar_items set schedule_kind='timed',needed_count=3,task_type_snapshot='general',meal_kind=null,meal_provider=null,meal_contact=null,meal_menu=null,meal_total=null,start_date=${q(day)},start_time='08:00',end_time='11:00',end_date=null,lifecycle='active',publication_state='published',published_at=now(),published_by_project_contact_id=${q(f.contact)} where id=any(array[${f.items.map(q)}]::uuid[]);
 update public.volunteer_profiles set lifecycle='active',readiness_status='ready' where workspace_id=${q(f.ws)};
 update public.assignment_responses set response_status='needs_response',responded_at=null where workspace_id=${q(f.ws)};
 update public.assignment_responses set response_status=${q(status)},responded_at=case when ${q(status)}='confirmed' then ${q(clock)}::timestamptz end where assignment_id=${q(assignment)};`);
}
const wipe=()=>sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};delete from public.communication_recipients where workspace_id=${q(f.ws)};delete from public.communication_operations where workspace_id=${q(f.ws)};`);
try {
 assert.equal(value('select delivery_enabled::text||\'|\'||(baseline_at is null) from public.assignment_reminder_activation'),'false|true');
 configure();let report=read();assert.equal(report.prospective.rows.length,6);assert.equal(report.rows.length,0);
 assert(report.prospective.rows.every(r=>r.classification==='would_enroll'));
 assert.equal(row(report).reminders[0].due_at,'2031-01-04T15:00:00+00:00');
 const authBefore=snapshot();const authorized=JSON.parse(value(f.auth(`select public.read_assignment_reminders(${q(f.ws)})`)));assert.equal(snapshot(),authBefore);assert.equal(authorized.prospective.rows.length,6);
 console.log('PASS original failure: six active assignments, disabled/NULL baseline/zero occurrences -> six prospective rows; all tables and sequences unchanged');
 for(const [day,reason] of [['2031-01-03','No future pending'],['2031-01-02','No future pending'],['2031-01-01','already started']]) {configure('needs_response',day);assert(row(read()).reason.includes(reason));}
 for(const [days,keys] of [[40,[30,14,7,3,1]],[20,[14,7,3,1]],[10,[7,3,1]],[5,[3,1]],[2,[1]],[1,[]],[0,[]],[7,[3,1]]]) {
  const day=new Date(Date.parse(clock)+days*86400000).toISOString().slice(0,10);configure('confirmed',day);
  assert.deepEqual(row(read()).reminders.map(r=>Number(r.occurrence_key.split(':')[1])),keys);
 }
 configure('confirmed','2031-01-02');sql(`update public.calendar_items set start_time='07:59',end_time='11:00' where id=${q(f.items[0])}`);assert.equal(row(read()).reminders.length,0);
 console.log('PASS pending +3, inside 48h/no future cadence, start, confirmed >30/20/10/5/2/<1 days and strict exact threshold');
 for(const [change,reason] of [
  [`update public.assignment_responses set response_status='declined',responded_at=${q(clock)} where assignment_id=${q(assignment)}`,'declined'],
  [`update public.calendar_assignments set lifecycle='canceled' where id=${q(assignment)}`,'canceled'],
  [`update public.calendar_items set lifecycle='archived' where id=${q(f.items[0])}`,'inactive'],
  [`update public.calendar_items set publication_state='draft',published_at=null,published_by_project_contact_id=null where id=${q(f.items[0])}`,'unpublished'],
  [`update public.volunteer_profiles set readiness_status='on_hold' where id=${q(f.volunteers[0])}`,'not ready'],
  [`update public.volunteer_profiles set lifecycle='inactive' where id=${q(f.volunteers[0])}`,'inactive'],
  [`update public.calendar_items set meal_kind='breakfast',task_type_snapshot='food' where id=${q(f.items[0])}`,'Meal'],
  [`update public.calendar_items set schedule_kind='milestone',needed_count=0,start_time=null,end_time=null where id=${q(f.items[0])}`,'information-only']]) {
   configure();sql(change);assert(row(read()).reason.includes(reason));
 }
 sql(`update public.calendar_items set schedule_kind='timed',needed_count=3,start_time='08:00',end_time='11:00' where id=${q(f.items[0])}`);
 configure();sql(`update public.volunteer_profiles set email='household@example.invalid' where id=any(array[${f.volunteers.slice(0,2).map(q)}]::uuid[])`);report=read();assert.equal(report.prospective.rows.filter(r=>r.assignment==='Site preparation').length,6);assert.equal(new Set(report.prospective.rows.map(r=>r.assignment_id)).size,6);
 for(const [at,expected] of [['2031-03-07T15:00:00Z','2031-03-10T14:00:00+00:00'],['2031-10-31T14:00:00Z','2031-11-03T15:00:00+00:00']]) {configure('needs_response','2031-12-01');assert.equal(row(read(at)).reminders[0].due_at,expected);}
 configure('confirmed','2031-11-08');sql(`update public.calendar_items set start_time='17:00',end_time='05:00',end_date='2031-11-09' where id=${q(f.items[0])}`);
 assert.equal(row(read('2031-11-01T14:00:00Z')).reminders.find(r=>r.occurrence_key==='shift:1').due_at,'2031-11-08T00:00:00+00:00');
 console.log('PASS exclusions, shared identities, authoritative timezone, spring/fall DST and overnight start');
 for(const role of ['anon','authenticated','service_role','project_local_reminder_worker'])assert.notEqual(sql(`set role ${role};select public.read_assignment_reminders(${q(f.ws)})`,true).status,0);
 assert.notEqual(sql(`set role project_local_reminder_worker;select public.run_assignment_reminder_worker('preview',jsonb_build_object('workspaceId',${q(f.ws)}))`,true).status,0);
 assert.notEqual(sql(`begin;update public.workspace_contact_grants set capabilities=array_remove(capabilities,'volunteers.edit') where workspace_id=${q(f.ws)};set local role authenticated;set local request.jwt.claim.sub=${q(f.user)};select public.read_assignment_reminders(${q(f.ws)});rollback;`,true).status,0,'Read-only admin without Communications capabilities is denied');
 assert.notEqual(sql(f.auth(`select public.read_assignment_reminders(${q(f.ws)},null,${q(clock)})`),true).status,0,'Client cannot inject activation time');
 sql(`update public.workspace_contact_grants set status='revoked',revoked_at=now() where workspace_id=${q(f.ws)}`);assert.notEqual(sql(f.auth(`select public.read_assignment_reminders(${q(f.ws)})`),true).status,0);sql(`update public.workspace_contact_grants set status='active',revoked_at=null where workspace_id=${q(f.ws)}`);
 const other=await fixture();try {assert.notEqual(sql(f.auth(`select public.read_assignment_reminders(${q(other.ws)})`),true).status,0);}finally{await other.cleanup();}
 console.log('PASS admin capability/project isolation, anonymous/token/worker denial and server-only activation clock');
 configure('confirmed');sql(`update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=${q(clock)};select public.sync_assignment_reminder(${q(assignment)},${q(clock)})`);
 const actual=JSON.parse(value(`select jsonb_agg(jsonb_build_object('id',id,'key',occurrence_key,'due',due_at)) from public.assignment_reminder_occurrences where assignment_id=${q(assignment)}`));
 for(const [key,outcome] of [['shift:30','sent'],['shift:14','failed'],['shift:7','unknown'],['shift:3',null]]) {
   const occurrence=actual.find(r=>r.key===key);const claim=JSON.parse(value(`select public.claim_assignment_reminder(${q(occurrence.id)},${q(occurrence.due)})`));
   if(outcome)value(`select public.finalize_assignment_reminder(${q(claim.recipientId)},${q(claim.claimId)},${q(outcome)},${outcome==='sent'?q('mock-provider'):'null'},${q(occurrence.due)})`);
 }
 report=read();const existing=row(report).reminders;assert.equal(existing.length,5);assert(existing.every(r=>r.source==='existing'));assert.deepEqual(new Set(existing.map(r=>r.state)),new Set(['sent','failed','unknown','sending','active']));assert(existing.find(r=>r.state==='sent').events.some(e=>e.event==='sent'));assert(!report.rows.some(r=>existing.some(e=>e.id===r.id)));
 sql(`update public.calendar_items set start_date='2031-01-02' where id=${q(f.items[0])};select public.sync_assignment_reminder(${q(assignment)},${q(clock)})`);report=read();assert(report.rows.some(r=>r.scheduling_state==='superseded'));assert.equal(new Set(report.rows.map(r=>r.id)).size,report.rows.length);
 console.log('PASS real enrolled/sent/failed/unknown/sending/superseded states; no second hypothetical logical identity');
 wipe();sql('update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null');configure();
 sql(`insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,publication_state,published_at,published_by_project_contact_id,created_by_project_contact_id)
 select gen_random_uuid(),${q(f.ws)},'Preview scale fixture','general','timed',case when n<=105 then '2031-02-15'::date else '1990-01-01'::date end,'08:00','10:00','America/Denver',1,'active','published',now(),${q(f.contact)},${q(f.contact)} from generate_series(1,10105) n;
 insert into public.calendar_assignments(workspace_id,calendar_item_id,volunteer_profile_id,lifecycle) select ${q(f.ws)},id,${q(f.volunteers[0])},'active' from public.calendar_items where workspace_id=${q(f.ws)} and title_snapshot='Preview scale fixture';analyze public.calendar_items;analyze public.calendar_assignments;`);
 const first=read();assert.equal(first.prospective.inspected,100);assert(first.prospective.nextAfter);const second=read(clock,first.prospective.nextAfter);assert.equal(second.prospective.rows.length,11);assert.equal(second.prospective.nextAfter,null);assert.equal(new Set([...first.prospective.rows,...second.prospective.rows].map(r=>r.assignment_id)).size,111);
 const plan=JSON.parse(value(`explain(analyze,format json) with future_items as materialized(select id from public.calendar_items where workspace_id=${q(f.ws)} and start_date>=('2031-01-01T15:00Z'::timestamptz at time zone 'America/Denver')::date) select ca.id from future_items fi cross join lateral(select id from public.calendar_assignments where workspace_id=${q(f.ws)} and calendar_item_id=fi.id order by id limit 101) ca order by ca.id limit 101`));assert(JSON.stringify(plan).includes('Index'));assert.equal(plan[0].Plan['Actual Rows'],101);
 sql(`insert into public.assignment_reminder_enrollments(assignment_id,workspace_id,volunteer_id,response_status,response_baseline,start_at) values(${q(assignment)},${q(f.ws)},${q(f.volunteers[0])},'needs_response',${q(clock)},'2031-02-15T15:00Z');
 insert into public.assignment_reminder_occurrences(workspace_id,assignment_id,volunteer_id,kind,occurrence_key,due_at,start_at,enrolled_at,scheduling_state) select ${q(f.ws)},${q(assignment)},${q(f.volunteers[0])},'response','pending:'||n,'1990-01-01T15:00Z','1990-02-01T15:00Z',${q(clock)},'expired' from generate_series(1,10000)n;analyze public.assignment_reminder_occurrences;`);
 const historyQuery=`select id from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)} order by due_at desc,id limit 200`;
 const historyPlans=sql(`begin;drop index public.assignment_reminder_history;select 'BEFORE';explain(analyze,format json) ${historyQuery};create index assignment_reminder_history on public.assignment_reminder_occurrences(workspace_id,due_at desc,id);select 'AFTER';explain(analyze,format json) ${historyQuery};rollback;`).stdout.split('BEFORE\n')[1].split('AFTER\n').map(JSON.parse);
 assert(JSON.stringify(historyPlans[1]).includes('assignment_reminder_history'));
 const full=JSON.parse(value(`explain(analyze,format json) select public.assignment_reminder_report(${q(f.ws)},${q(clock)})`));
 report=read();assert(report.rows.length<=200);assert(report.prospective.rows.length<=100);assert(report.prospective.rows.flatMap(r=>r.reminders).length<=500);
 fs.writeFileSync(new URL('../docs/audits/12-57-evidence/preview-explain.json',import.meta.url),JSON.stringify({historicalAssignments:10000,discovery:plan,historyBefore:historyPlans[0],historyAfter:historyPlans[1],fullPreview:full},null,2)+'\n');
 console.log(JSON.stringify({historicalAssignments:10000,discoveryMs:plan[0]['Execution Time'],historyBeforeMs:historyPlans[0][0]['Execution Time'],historyAfterMs:historyPlans[1][0]['Execution Time'],fullPreviewMs:full[0]['Execution Time'],pageSizes:[100,11],selectOnlyReads:reads}));
} finally {wipe();sql("update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null,scan_cursors='{}'");await f.cleanup();}
console.log('PASS hypothetical preview; no real provider calls; production untouched');
