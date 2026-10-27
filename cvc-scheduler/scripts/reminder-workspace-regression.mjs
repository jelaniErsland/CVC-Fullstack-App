// Local Docker only. No provider, production environment or worker invocation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fixture, sql, value, q } from './12-47-local-fixtures.mjs';
import { assertEffectiveFunctionPolicy, effectiveFunctionQuery } from './function-privilege-policy.mjs';
const version='20261026120000', signature='public.read_assignment_reminder_workspace(uuid,text,text,jsonb,integer)';
const source=fs.readFileSync(new URL(`../supabase/migrations/${version}_assignment_reminder_workspace_read.sql`,import.meta.url),'utf8').replaceAll('\r\n','\n');
const rollback=fs.readFileSync(new URL(`../supabase/rollback/${version}_assignment_reminder_workspace_read.sql`,import.meta.url),'utf8').replaceAll('\r\n','\n');
const catalogue=()=>value(`select md5(string_agg(pg_get_functiondef(p.oid)||p.proowner::text||coalesce(p.proacl::text,''),'|' order by p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','project_local_reminder_infrastructure') and p.proname<>'read_assignment_reminder_workspace'`);
export const snapshot=()=>value(`select md5(string_agg(n||'.'||t||':'||h,'|' order by n,t)) from (
 select schemaname n,tablename t,(xpath('/row/hash/text()',query_to_xml(format('select count(*)::text||'':''||md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from %I.%I t',schemaname,tablename),false,true,'')))[1]::text h
 from pg_tables where schemaname='public' or schemaname='auth'
 union all select schemaname,sequencename,(xpath('/row/hash/text()',query_to_xml(format('select last_value::text||'':''||is_called hash from %I.%I',schemaname,sequencename),false,true,'')))[1]::text from pg_sequences where schemaname in ('public','auth')) s`);
const security=()=>value(`select md5(jsonb_build_array(
 (select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth')),
 (select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','auth')),
 (select jsonb_agg(to_jsonb(a) order by oid) from pg_default_acl a))::text)`);
if(value(`select max(version) from supabase_migrations.schema_migrations`)==='20261022120000') {
 const previous=fs.readFileSync(new URL('../supabase/migrations/20261023120000_assignment_reminder_worker_record.sql',import.meta.url),'utf8');
 sql(previous.replace(/commit;\s*$/,"insert into supabase_migrations.schema_migrations(version,name,statements) values('20261023120000','assignment_reminder_worker_record','{}');commit;"));
}
const apply=source.replace(/commit;\s*$/,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','assignment_reminder_workspace_read','{}');commit;`);
if(value(`select max(version) from supabase_migrations.schema_migrations`)===version)sql(rollback);
assert.equal(value('select count(*)||\'|\'||max(version) from supabase_migrations.schema_migrations'),'56|20261023120000');
const before={catalogue:catalogue(),security:security(),data:snapshot()};
const failed=sql(apply.replace(/commit;\s*$/,'select 1/0;commit;'),true);assert.notEqual(failed.status,0);
assert.equal(value(`select to_regprocedure(${q(signature)}) is null`),'t');
assert.equal(catalogue(),before.catalogue);assert.equal(security(),before.security);assert.equal(snapshot(),before.data);
assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'56');
sql(apply);assert.equal(catalogue(),before.catalogue);assert.equal(security(),before.security);assert.equal(snapshot(),before.data);
sql(rollback);assert.equal(snapshot(),before.data);assert.equal(catalogue(),before.catalogue);sql(apply);
assert.equal(value('select count(*)||\'|\'||max(version) from supabase_migrations.schema_migrations'),'57|'+version);
const policy=value(effectiveFunctionQuery).split(/\r?\n/).map(JSON.parse);assert.equal(policy.length,103);assertEffectiveFunctionPolicy(assert,policy);
assert.equal(value(`select has_function_privilege('project_local_reminder_runner',${q(signature)},'execute')`),'f');
const f=await fixture();let other;
const call=(view='summary',search=null,cursor=null,limit=25)=>`select public.read_assignment_reminder_workspace(${q(f.ws)},${q(view)},${q(search)},${q(cursor===null?null:JSON.stringify(cursor))}::jsonb,${limit})`;
const read=(...args)=>JSON.parse(value(f.auth(call(...args))));
const wipe=()=>sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};delete from public.communication_recipients where workspace_id=${q(f.ws)};delete from public.communication_operations where workspace_id=${q(f.ws)};`);
try {
 assert.equal(read().lastActivity,null);assert.equal(read().nextBatch,null);
 // 106 assigned identities, well beyond the legacy first 100, sharing contact info.
 sql(`update public.volunteer_profiles set email='household@example.invalid' where workspace_id=${q(f.ws)};
 update public.calendar_items set start_date=current_date+90 where workspace_id=${q(f.ws)} and meal_kind is null;
 insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,publication_state,published_at,published_by_project_contact_id,created_by_project_contact_id)
 select ('f0000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,${q(f.ws)},'Dense reminder task '||n,'general','timed',current_date+90,'08:00','10:00','America/Denver',1,'active','published',now(),${q(f.contact)},${q(f.contact)} from generate_series(1,105)n;
 insert into public.calendar_assignments(id,workspace_id,calendar_item_id,volunteer_profile_id,lifecycle)
 select ('f1000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,${q(f.ws)},('f0000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,${q(f.volunteers[0])},'active' from generate_series(1,105)n;
 insert into public.assignment_responses(workspace_id,assignment_id,response_status)
 select a.workspace_id,a.id,'needs_response' from public.calendar_assignments a where a.workspace_id=${q(f.ws)} on conflict(assignment_id) do nothing;
 insert into public.assignment_reminder_enrollments(assignment_id,workspace_id,volunteer_id,response_status,response_baseline,start_at)
 select a.id,a.workspace_id,a.volunteer_profile_id,'needs_response',now(),public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,'America/Denver') from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id where a.workspace_id=${q(f.ws)};
 insert into public.assignment_reminder_occurrences(workspace_id,assignment_id,volunteer_id,kind,occurrence_key,due_at,start_at,enrolled_at)
 select e.workspace_id,e.assignment_id,e.volunteer_id,'response','pending:'||n,
 case when e.assignment_id='f1000000-0000-0000-0000-000000000105' then date_trunc('day',now())+interval '1 day 16 hours' else date_trunc('day',now())+interval '2 days 16 hours' end,
 e.start_at,now() from public.assignment_reminder_enrollments e cross join generate_series(1,100)n where e.workspace_id=${q(f.ws)};
 analyze public.assignment_reminder_occurrences; analyze public.assignment_reminder_events;`);
 const legacy=JSON.parse(value(f.auth(`select public.read_assignment_reminders(${q(f.ws)})`)));
 assert(!legacy.prospective.rows.some(r=>r.assignment_id==='f1000000-0000-0000-0000-000000000105'));
 const summary=read();assert.equal(summary.nextBatch.count,100);
 let cursor=null,ids=new Set(),pages=0;
 do {const page=read('upcoming',null,cursor,50);for(const row of page.rows){assert(!ids.has(row.id));ids.add(row.id);}cursor=page.nextCursor;pages++;}while(cursor);
 assert.equal(ids.size,11100);assert.equal(pages,222);assert.equal(read('upcoming').rows[0].due_at,summary.nextBatch.dueAt);
 assert.equal(read('summary','no matches').nextBatch.count,100,'Summary ignores list search');
 assert.equal(read('upcoming','household@example.invalid').rows.length,0,'Email is not searchable');
 assert.equal(read('upcoming','%').rows.length,0,'Search is literal, not wildcard syntax');
 // Old assignments with actual outcomes, surrounded by >200 future schedules.
 const oldAssignment=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} and volunteer_profile_id=${q(f.volunteers[1])}`);
 sql(`update public.calendar_items set start_date=current_date-60 where id=${q(f.items[0])};
 with selected as (select id,row_number() over(order by id) n from public.assignment_reminder_occurrences where assignment_id=${q(oldAssignment)} order by id limit 5)
 insert into public.assignment_reminder_events(occurrence_id,workspace_id,event,happened_at,due_at,attempt)
 select o.id,o.workspace_id,case s.n when 1 then 'sent' when 2 then 'failed' when 3 then 'unknown' when 4 then 'claimed' else 'excluded' end,date_trunc('day',now())-interval '60 days',o.due_at,1 from selected s join public.assignment_reminder_occurrences o on o.id=s.id;
 update public.assignment_reminder_occurrences set scheduling_state='canceled' where assignment_id=${q(oldAssignment)};
 analyze public.assignment_reminder_events;`);
 const hist=read('history');assert.equal(hist.rows.length,5);assert.deepEqual(new Set(hist.rows.map(r=>r.state)),new Set(['sent','failed','unknown','sending','excluded']));
 cursor=null;ids=new Set();do{const p=read('history',null,cursor,2);for(const row of p.rows){assert(!ids.has(row.id));ids.add(row.id);}cursor=p.nextCursor;}while(cursor);assert.equal(ids.size,5,'Same timestamp ties page without loss');
 assert.equal(read().failedCount,1);assert.equal(read().unknownCount,1);assert(read().lastActivity);
 assert.equal(read('history','Casey').rows.length,5);assert.equal(read('history','Alex').rows.length,0);
 assert(new Set(read('why_not','Site preparation').rows.map(r=>r.volunteer_id)).size===2,'Shared contact keeps identity separate');
 assert(read('why_not','Site preparation').rows.some(r=>r.reason==='Assignment has started'));
 const frozen=snapshot();for(const v of ['summary','upcoming','history','why_not'])for(let n=0;n<2;n++){
   const r=JSON.parse(value(`begin read only;set local role authenticated;set local request.jwt.claim.sub=${q(f.user)};${call(v)};rollback;`));
   assert(!JSON.stringify(r).includes('PRIVATE'));assert(!JSON.stringify(r).includes(f.token));assert(!JSON.stringify(r).includes('household@example.invalid'));
 }assert.equal(snapshot(),frozen,'Every public/Auth row and sequence remains exact after repeated paginated reads');
 for(const args of [[null],['unknown'],['upcoming',null,null,0],['history',null,null,51],['upcoming','a'.repeat(101)],['upcoming',null,{}],['history',null,{at:'infinity',id:f.ws}],['upcoming',null,{id:f.ws,at:'bad'}],['why_not',null,{id:f.ws,extra:1}],['upcoming',null,{id:f.ws,at:new Date().toISOString(),extra:1}]])assert.notEqual(sql(f.auth(call(...args)),true).status,0,'Malformed input denied');
 for(const role of ['anon','authenticated','service_role','project_local_reminder_worker','project_local_reminder_runner'])assert.notEqual(sql(`set role ${role};${call()}`,true).status,0,'No actor / restricted role denial: '+role);
 for(const update of [
  `update public.project_contacts set status='inactive' where id=${q(f.contact)}`,
  `update public.workspace_contact_grants set revoked_at=now() where workspace_id=${q(f.ws)}`,
  `update public.workspace_contact_grants set valid_until=now()-interval '1 second' where workspace_id=${q(f.ws)}`,
  `update public.workspace_contact_grants set capabilities=array_remove(capabilities,'assignments.edit') where workspace_id=${q(f.ws)}`
 ])assert.notEqual(sql(`begin;${update};set local role authenticated;set local request.jwt.claim.sub=${q(f.user)};${call()};rollback;`,true).status,0);
 other=await fixture();assert.notEqual(sql(f.auth(`select public.read_assignment_reminder_workspace(${q(other.ws)})`),true).status,0);
 assert.equal(JSON.parse(value(`begin;set local role service_role;set local request.jwt.claim.sub=${q(f.user)};${call()};rollback;`)).view,'summary');
 const plans={};for(const v of ['summary','upcoming','history','why_not']){
  const plan=JSON.parse(value(f.auth(`explain(analyze, buffers,format json) ${call(v)}`)));plans[v]={executionMs:plan[0]['Execution Time'],plan};
 }
 const deepCursor=read('upcoming',null,null,50).nextCursor;
 plans.deepUpcoming=JSON.parse(value(f.auth(`explain(analyze,buffers,format json) ${call('upcoming',null,deepCursor,50)}`)));
 plans.search=JSON.parse(value(f.auth(`explain(analyze,buffers,format json) ${call('history','Casey')}`)));
 // EXPLAIN the exact static Upcoming SQL as well as the function. PostgreSQL's
 // non-superuser owner cannot load auto_explain; do not weaken that role.
 let query=source.slice(source.indexOf('    with page as materialized ('),source.indexOf("  elsif p_view='history'"));
 query=query.replace('into rows_value,next_value;',';');
 for(const [key,replacement] of Object.entries({p_workspace_id:q(f.ws)+'::uuid',p_limit:'25',search_value:'null::text',cursor_id:'null::uuid',cursor_at:'null::timestamptz',zone:"'America/Denver'",observed:'statement_timestamp()'}))query=query.replaceAll(new RegExp('\\b'+key+'\\b','g'),replacement);
 plans.upcomingSQL=JSON.parse(value('explain(analyze,buffers,format json) '+query));
 const evidence=new URL('../docs/audits/12-58-evidence/',import.meta.url);fs.mkdirSync(evidence,{recursive:true});
 fs.writeFileSync(new URL('read-model-results.json',evidence),JSON.stringify({migrationHash:createHash('sha256').update(source).digest('hex'),rollbackHash:createHash('sha256').update(rollback).digest('hex'),occurrences:11100,pages,historyOutcomes:hist.rows.map(r=>r.state),policyCount:policy.length,plans},null,2)+'\n');
 console.log('PASS migration57 clean apply / forced atomic failure / rollback / replay; 103 exact functions; old catalogue/security/data exact.');
 console.log('PASS >200 future schedules do not hide five old actual outcomes; global next batch beyond assignment100; same-time keysets; 222 pages /11100 distinct reminders; literal bounded search; household identities.');
 console.log('PASS authorized admin/service-role actor; inactive/revoked/expired/insufficient/wrong workspace/anonymous/worker/runner denials; repeated READ ONLY calls preserve all public/Auth rows and sequences; no provider import/call.');
 console.log(JSON.stringify(Object.fromEntries(Object.entries(plans).filter(([,p])=>p.executionMs!==undefined).map(([k,v])=>[k,v.executionMs]))));
}finally{wipe();if(other)await other.cleanup();await f.cleanup();}
