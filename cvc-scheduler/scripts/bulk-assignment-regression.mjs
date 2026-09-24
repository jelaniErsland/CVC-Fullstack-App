// Local PostgreSQL only. No environment files, remote database or email access.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { validateBulkAssignmentPlan, assignmentPreviewCounts } from '../lib/calendar/bulkAssignments.ts';

const ws = randomUUID(), otherWs = randomUUID();
const users = [randomUUID(), randomUUID()];
const contacts = [randomUUID(), randomUUID()];
const items = [randomUUID(), randomUUID()];
const q = v => `'${String(v).replaceAll("'", "''")}'`;
const args = ['exec','-i','supabase_db_cvc-scheduler','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'];
function sql(s, mayFail = false) {
  const r = spawnSync('docker', args, { input:s, encoding:'utf8', windowsHide:true, maxBuffer:5e6 });
  if (!mayFail) assert.equal(r.status, 0, r.stderr);
  return r;
}
function asUser(s, n=0) { return `begin; set local role authenticated; set local request.jwt.claim.sub=${q(users[n])}; ${s}; commit;`; }
function rpc(plan, id, fingerprint=null, n=0, workspace=ws) {
  return asUser(`select public.plan_calendar_assignments(${q(workspace)},${q(id)},${q(JSON.stringify(plan))}::jsonb,${fingerprint ? q(fingerprint) : 'null'})`,n);
}
function call(plan, id=randomUUID(), fingerprint=null, n=0, workspace=ws) {
  return JSON.parse(sql(rpc(plan,id,fingerprint,n,workspace)).stdout.trim());
}
function parallel(s) {
  return new Promise(resolve => {
    const p=spawn('docker',args,{windowsHide:true}); let stdout='',stderr='';
    p.stdout.on('data',v=>stdout+=v); p.stderr.on('data',v=>stderr+=v);
    p.on('close',status=>resolve({status,stdout,stderr})); p.stdin.end(s);
  });
}
function scalar(s) { return sql(s).stdout.trim(); }
const capabilities = "array['workspace.read','calendar.view','calendar.edit','assignments.view','assignments.edit','volunteers.view','volunteers.edit','tasks.view']";
let volunteers=[];
const browserHelper=process.env.BULK_CAPTURE==='1' ? await import('./bulk-assignment-browser.mjs') : null;
const browserAdmin=browserHelper ? await browserHelper.createBrowserAdmin() : null;
if(browserAdmin) users[0]=browserAdmin.id;
try {
  assert.equal(scalar("select count(*) from supabase_migrations.schema_migrations where version='20260922120000'"),'1');
  sql(`insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone,starts_on,ends_on)
    values(${q(ws)},${q('qa-12-47-'+ws)},'Local bulk fixture','active','America/Denver','2026-09-01','2026-12-31'),
    (${q(otherWs)},${q('qa-12-47-'+otherWs)},'Other local fixture','active','America/Denver','2026-09-01','2026-12-31');
    insert into auth.users(id,email) values ${users.map((id,i)=>`(${q(id)},${q(`bulk-${ws}-${i}@example.invalid`)})`).join(',')} on conflict(id) do nothing;
    insert into public.project_contacts(id,auth_user_id,status) values ${contacts.map((id,i)=>`(${q(id)},${q(users[i])},'active')`).join(',')};
    insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from)
    values ${contacts.map(id=>`(${q(ws)},${q(id)},'main_contact',${capabilities},'active',now()-interval '1 day')`).join(',')};
    insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,created_by_project_contact_id,publication_state,published_at,published_by_project_contact_id)
    values ${items.map((id,i)=>`(${q(id)},${q(ws)},'Local task ${i}','general','timed','2026-10-0${i+1}','08:00','10:00','America/Denver',2,'active',${q(contacts[0])},'published',now(),${q(contacts[0])})`).join(',')};`);
  for(let i=0;i<2;i++) volunteers.push(scalar(asUser(`select public.create_manual_volunteer_profile(${q(ws)},${q(JSON.stringify({fullName:`Local Volunteer ${i}`,email:`local-${ws}-${i}@example.invalid`}))}::jsonb)`)));
  if(browserHelper) await browserHelper.captureBulkAssignments(browserAdmin);
  const plan={itemIds:items,volunteers:volunteers.map(id=>({id,excludeDates:[]})),note:null};
  assert.deepEqual(validateBulkAssignmentPlan(plan,ws,randomUUID()),plan);
  assert.throws(()=>validateBulkAssignmentPlan({...plan,volunteers:[plan.volunteers[0],plan.volunteers[0]]},ws,randomUUID()));
  assert.throws(()=>validateBulkAssignmentPlan({...plan,itemIds:[...items,...items]},ws,randomUUID()));
  const key=randomUUID(), preview=call(plan,key);
  assert.equal(preview.saved,false);
  assert.deepEqual(assignmentPreviewCounts(preview,plan),{added:4,existing:0,exceptions:0});
  assert.equal(scalar(`select count(*) from public.calendar_assignments where workspace_id=${q(ws)}`),'0','Preview is read-only.');
  const competingPreview=call(plan,randomUUID(),null,1);
  const results=await Promise.all([parallel(rpc(plan,key,preview.fingerprint)),parallel(rpc(plan,randomUUID(),competingPreview.fingerprint,1))]);
  assert.equal(results.filter(r=>r.status===0).length,1,'Concurrent admins: exactly one save.');
  assert.equal(results.filter(r=>r.stderr.includes('Review the latest preview')).length,1,'Other admin receives stale preview.');
  assert.equal(scalar(`select count(*) from public.calendar_assignments where workspace_id=${q(ws)}`),'4');
  const latest=call(plan);
  assert.equal(latest.existingAssignments.length,4);
  const idempotentKey=randomUUID(), noChangePreview=call(plan,idempotentKey);
  const noop=call(plan,idempotentKey,noChangePreview.fingerprint);
  assert.equal(noop.createdAssignmentCount,0);
  assert.deepEqual(call(plan,idempotentKey,noChangePreview.fingerprint),noop);
  assert.notEqual(sql(rpc({...plan,note:'changed'},idempotentKey),true).status,0,'Changed payload cannot reuse operation key.');
  assert.notEqual(sql(rpc(plan,randomUUID(),null,0,otherWs),true).status,0,'Cross workspace denied.');
  assert.notEqual(sql(`set role anon; select public.plan_calendar_assignments(${q(ws)},${q(randomUUID())},'{}',null);`,true).status,0,'Anon denied.');
  const creation={itemIds:[],volunteers:[{id:volunteers[0],excludeDates:['2026-10-06']},{id:volunteers[1],excludeDates:[]}],note:null,
    create:{presetId:null,title:'Repeated local work',taskType:'general',startDate:'2026-10-05',endDate:'2026-10-07',weekdays:[1,2,3],startTime:'08:00',endTime:'10:00',neededCount:2,notes:null,customValues:{},meal:null}};
  validateBulkAssignmentPlan(creation,ws,randomUUID());
  const ck=randomUUID(), cp=call(creation,ck);
  assert.deepEqual(assignmentPreviewCounts(cp,creation),{added:5,existing:0,exceptions:1});
  const saved=call(creation,ck,cp.fingerprint);
  assert.equal(saved.createdItemIds.length,3);
  assert.equal(saved.createdAssignmentCount,5);
  assert.equal(scalar(`select count(*) from public.calendar_items where id=any(array[${saved.itemIds.map(q).join(',')}]::uuid[]) and publication_state='draft'`),'3');
  assert.equal(scalar(`select count(*) from public.assignment_responses where workspace_id=${q(ws)}`),'9','Independent response row per assignment.');
  const responseId=saved.assignmentIds[0];
  const responseItem=scalar(`select calendar_item_id from public.calendar_assignments where id=${q(responseId)}`);
  sql(asUser(`select public.publish_calendar_item(${q(responseItem)})`));
  sql(asUser(`select public.update_assignment_response(${q(responseId)},'confirmed',null)`));
  assert.equal(scalar(`select count(*) from public.assignment_responses where workspace_id=${q(ws)} and response_status='confirmed'`),'1');
  assert.equal(scalar(`select count(*) from public.assignment_notification_deliveries where workspace_id=${q(ws)}`),'0');
  const staleKey=randomUUID(), beforeEdit=call(plan,staleKey);
  sql(`update public.calendar_items set schedule_notes='Changed after preview' where id=${q(items[0])};`);
  assert.notEqual(sql(rpc(plan,staleKey,beforeEdit.fingerprint),true).status,0,'Edited item invalidates preview.');
  const archiveKey=randomUUID(), beforeArchive=call(plan,archiveKey);
  sql(asUser(`select public.archive_calendar_item(${q(items[0])})`));
  assert.notEqual(sql(rpc(plan,archiveKey,beforeArchive.fingerprint),true).status,0,'Archived item invalidates selection.');
  // Existing creation validation deliberately fails after the wrapper preview;
  // no Calendar items, assignments or durable operation may survive that error.
  const broken={...creation,create:{...creation.create,title:'',startDate:'2026-10-12',endDate:'2026-10-14'},volunteers:[{id:volunteers[0],excludeDates:[]}]};
  const bk=randomUUID(), bp=call(broken,bk);
  const before=scalar(`select count(*) from public.calendar_items where workspace_id=${q(ws)}`);
  assert.notEqual(sql(rpc(broken,bk,bp.fingerprint),true).status,0);
  assert.equal(scalar(`select count(*) from public.calendar_items where workspace_id=${q(ws)}`),before);
  assert.equal(scalar(`select count(*) from public.calendar_bulk_assignment_operations where request_id=${q(bk)}`),'0');
  // Force a failure after item creation, at the assignment insert. The fixture
  // trigger is transaction-local and rolls back with the failed operation.
  const middle={...creation,create:{...creation.create,title:'Rollback after item creation',startDate:'2026-10-19',endDate:'2026-10-21'},volunteers:[{id:volunteers[0],excludeDates:[]}]};
  const mk=randomUUID(),mp=call(middle,mk);
  const forced=rpc(middle,mk,mp.fingerprint).replace('begin;',()=>`begin;
    create function public.fixture_bulk_midwrite_failure() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'fixture_midwrite_failure'; end $$;
    create trigger fixture_bulk_midwrite_failure before insert on public.calendar_assignments for each row execute function public.fixture_bulk_midwrite_failure();`);
  const mid=sql(forced,true);assert.notEqual(mid.status,0);assert(mid.stderr.includes('fixture_midwrite_failure'),mid.stderr);
  assert.equal(scalar(`select count(*) from public.calendar_items where workspace_id=${q(ws)}`),before,'Items created before failed assignment must roll back.');
  assert.equal(scalar(`select count(*) from public.calendar_bulk_assignment_operations where request_id=${q(mk)}`),'0');
  assert.equal(scalar(`select to_regprocedure('public.fixture_bulk_midwrite_failure()') is null`),'t');
  console.log('PASS: bulk preview, 2-admin concurrency, duplicate skipping, replay, source validation, repeat/private publication, exceptions, independent responses, edit/archive drift, atomic failure, workspace/anon denial, no email.');
} finally {
  sql(`delete from public.calendar_bulk_assignment_operations where workspace_id=${q(ws)};
    delete from public.assignment_responses where workspace_id=${q(ws)};
    delete from public.calendar_assignments where workspace_id=${q(ws)};
    delete from public.calendar_repeat_creation_requests where workspace_id=${q(ws)};
    delete from public.calendar_items where workspace_id=${q(ws)};
    delete from public.volunteer_profiles where workspace_id=${q(ws)};
    delete from public.task_presets where workspace_id in (${q(ws)},${q(otherWs)});
    delete from public.workspace_contact_grants where workspace_id=${q(ws)};
    delete from public.project_contacts where id in (${contacts.map(q).join(',')});
    delete from public.workspaces where id in (${q(ws)},${q(otherWs)});
    delete from auth.users where id in (${users.map(q).join(',')});`);
}
