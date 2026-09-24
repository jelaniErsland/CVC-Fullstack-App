import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
const ws=randomUUID(), user=randomUUID(), contact=randomUUID(), item=randomUUID(), item2=randomUUID();
const q=v=>`'${String(v).replaceAll("'","''")}'`;
const args=['exec','-i','supabase_db_cvc-scheduler','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'];
function sql(s,fail=false){const r=spawnSync('docker',args,{input:s,encoding:'utf8',windowsHide:true});if(!fail)assert.equal(r.status,0,r.stderr);return r;}
const val=s=>sql(s).stdout.trim();
const auth=s=>`begin; set local role authenticated; set local request.jwt.claim.sub=${q(user)}; ${s}; commit;`;
const query=s=>JSON.parse(val(auth(s)));
const preview=plan=>query(`select public.review_communications(${q(ws)},${q(JSON.stringify(plan))})`);
const confirmSql=(id,plan,p)=>auth(`select public.confirm_communication_operation(${q(ws)},${q(id)},${q(JSON.stringify(plan))},${q(p.fingerprint)})`);
const claim=(id,retry=false)=>query(`select coalesce(public.claim_communication_recipient(${q(id)},${retry}),'null'::jsonb)`);
const finalize=(c,state,reason=null)=>val(auth(`select public.finalize_communication_recipient(${q(c.recipientId)},${q(c.claimId)},${q(state)},${state==='sent'?q('fixture-accepted'): 'null'},${reason?q(reason):'null'})`));
const history=()=>query(`select public.read_communication_history(${q(ws)})`);
function concurrent(s){return new Promise(resolve=>{const p=spawn('docker',args,{windowsHide:true});let stdout='',stderr='';p.stdout.on('data',s=>stdout+=s);p.stderr.on('data',s=>stderr+=s);p.on('close',status=>resolve({status,stdout,stderr}));p.stdin.end(s);});}
const volunteers=[];
try {
  sql(`insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone,starts_on,ends_on) values(${q(ws)},${q('qa-communication-'+ws)},'Local communications','active','America/Denver','2035-01-01','2035-12-31');
    insert into auth.users(id,email) values(${q(user)},${q(user+'@example.invalid')});
    insert into public.project_contacts(id,auth_user_id,status) values(${q(contact)},${q(user)},'active');
    insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from)
    values(${q(ws)},${q(contact)},'main_contact',array['workspace.read','volunteers.view','volunteers.edit','calendar.view','calendar.edit','assignments.view','assignments.edit'],'active',now()-interval '1 day');`);
  for(let i=0;i<3;i++) volunteers.push(val(auth(`select public.create_manual_volunteer_profile(${q(ws)},${q(JSON.stringify({fullName:`Communication volunteer ${i}`,email:i<2?`${ws}-${i}@example.invalid`:null,phone:'+12025550123',dateOfBirth:'1980-01-01',emergencyContactName:'PRIVATE EXCLUDED',profileNotes:'PRIVATE NOTES'}))})`)));
  sql(`insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,created_by_project_contact_id,publication_state,published_at,published_by_project_contact_id)
    values ${[item,item2].map((id,i)=>`(${q(id)},${q(ws)},'Local work ${i}','general','timed','2035-10-0${i+1}','08:00','10:00','America/Denver',2,'active',${q(contact)},'published',now(),${q(contact)})`).join(',')};`);
  for(const id of [item,item2]) sql(auth(`select public.create_calendar_assignments_batch(${q(id)},array[${volunteers.map(q).join(',')}]::uuid[],null)`));
  const plan={kind:'schedule',mode:'new',startDate:'2035-10-01',endDate:'2035-10-02',volunteerIds:[]};
  const p=preview(plan);
  assert.equal(p.recipients.length,2); assert.equal(p.exclusions.length,1);
  assert.equal(p.recipients[0].assignments.length,2);assert.equal(p.recipients[0].newAssignments,2);
  assert(!JSON.stringify(p).includes('PRIVATE'));assert(!JSON.stringify(p).includes('1980-01-01'));
  const ops=[randomUUID(),randomUUID()];
  const confirmed=await Promise.all(ops.map(id=>concurrent(confirmSql(id,plan,p))));
  assert.equal(confirmed.filter(r=>r.status===0).length,1,'Only one concurrent initial operation can reserve recipients.');
  assert.equal(confirmed.filter(r=>r.stderr.includes('Recipients changed')).length,1);
  const rows=history();assert.equal(rows.length,2);
  assert.equal(val(`select count(*) from public.communication_assignment_coverage where workspace_id=${q(ws)}`),'4');
  const r=rows[0];
  const claims=await Promise.all([concurrent(auth(`select public.claim_communication_recipient(${q(r.recipient_id)},false)`)),concurrent(auth(`select public.claim_communication_recipient(${q(r.recipient_id)},false)`))]);
  assert(claims.every(r=>r.status===0));
  const nonnull=claims.filter(r=>r.stdout.trim());assert.equal(nonnull.length,1,'Only one dispatcher can claim a recipient.');
  const c=JSON.parse(nonnull[0].stdout.trim());assert.equal(c.assignments.length,2);
  assert.equal(finalize(c,'sent'),'sent');assert.equal(claim(r.recipient_id,true),null,'Accepted recipient cannot be resent by retry.');
  const other=claim(rows[1].recipient_id);assert(other);
  assert.equal(finalize(other,'failed','provider_rejected'),'failed');
  assert.equal(claim(rows[1].recipient_id),null,'Failed recipient needs explicit retry.');
  const retry=claim(rows[1].recipient_id,true);assert.equal(retry.attempt,2);
  assert.equal(finalize(retry,'unknown','provider_outcome_unknown'),'unknown');
  assert.equal(claim(rows[1].recipient_id,true),null,'Unknown is not retryable, even explicitly.');
  const after=preview(plan);assert.equal(after.recipients.length,0);
  assert(after.exclusions.some(e=>e.reason==='pending_or_unknown_delivery'));
  assert.equal(val(`select count(*) from public.assignment_notification_deliveries where workspace_id=${q(ws)} and delivery_state='sent'`),'2');
  assert.equal(val(`select count(*) from public.assignment_notification_deliveries where workspace_id=${q(ws)} and sending_expires_at='infinity'::timestamptz`),'2');
  const resend={...plan,mode:'resend',volunteerIds:[r.volunteer_id]};
  const rp=preview(resend);assert.equal(rp.recipients.length,1);assert.equal(rp.recipients[0].previousAssignments,2);
  const resendOp=randomUUID();sql(confirmSql(resendOp,resend,rp));
  const resendRow=history().find(x=>x.operation_id===resendOp);const rc=claim(resendRow.recipient_id);finalize(rc,'sent');
  assert.equal(val(`select count(*) from public.calendar_assignments where workspace_id=${q(ws)}`),'6','Resend preserves assignments.');
  assert.equal(val(`select count(*) from public.assignment_responses where workspace_id=${q(ws)}`),'6','Resend preserves responses.');
  const welcome={kind:'welcome',mode:'new',volunteerIds:[]};
  const wp=preview(welcome);assert.equal(wp.recipients.length,2);
  assert.equal(val(`select count(*) from public.volunteer_welcome_deliveries where workspace_id=${q(ws)}`),'0','Creation and preview do not send welcome.');
  const wo=randomUUID();sql(confirmSql(wo,welcome,wp));
  for(const row of history().filter(r=>r.operation_id===wo)){const wc=claim(row.recipient_id);finalize(wc,'sent');}
  assert.equal(preview(welcome).recipients.length,0);
  sql(`update public.volunteer_profiles set email=${q('changed-'+ws+'@example.invalid')} where id=${q(r.volunteer_id)};`);
  assert(preview(welcome).exclusions.some(e=>e.reason==='email_changed_requires_resend_review'));
  const added=val(auth(`select public.create_manual_volunteer_profile(${q(ws)},${q(JSON.stringify({fullName:'New pending volunteer',email:`new-${ws}@example.invalid`}))})`));
  volunteers.push(added);
  assert.equal(preview(welcome).recipients.length,1,'New volunteer automatically eligible, never automatically sent.');
  assert.equal(val(`select count(*) from public.volunteer_welcome_deliveries where workspace_id=${q(ws)}`),'2');
  // A never-dispatched claim whose item changed is excluded, not failed or
  // silently retried. Fresh review can transfer its known-unsent reservation.
  sql(auth(`select public.create_calendar_assignments_batch(${q(item)},array[${q(added)}]::uuid[],null)`));
  const freshPlan={...plan,volunteerIds:[added]},freshOp=randomUUID();
  sql(confirmSql(freshOp,freshPlan,preview(freshPlan)));
  const excludedRow=history().find(r=>r.operation_id===freshOp);
  sql(`update public.calendar_items set schedule_notes='Updated before dispatch' where id=${q(item)}`);
  assert.equal(claim(excludedRow.recipient_id),null);
  assert.equal(history().find(r=>r.recipient_id===excludedRow.recipient_id).state,'excluded');
  const replacementOp=randomUUID(),freshPreview=preview(freshPlan);assert.equal(freshPreview.recipients.length,1);
  sql(confirmSql(replacementOp,freshPlan,freshPreview));
  const replacementRow=history().find(r=>r.operation_id===replacementOp);
  assert.equal(val(`select count(*) from public.assignment_notification_deliveries where communication_recipient_id=${q(replacementRow.recipient_id)}`),'1');
  finalize(claim(replacementRow.recipient_id),'sent');
  assert.equal(history().find(r=>r.recipient_id===excludedRow.recipient_id).state,'excluded','Original audit retained');
  sql(`update public.workspace_contact_grants set capabilities=array['workspace.read','volunteers.view'] where workspace_id=${q(ws)};`);
  assert.notEqual(sql(auth(`select public.review_communications(${q(ws)},${q(JSON.stringify(welcome))})`),true).status,0,'Read-only volunteer viewer cannot review/send communications.');
  assert.notEqual(sql(`set role anon; select public.read_communication_history(${q(ws)});`,true).status,0);
  console.log('PASS: consolidated grouping, missing-email/privacy, concurrent operations/claims, immutable accepted/unknown results, explicit failed retry/resend, per-assignment history, welcome pending/idempotency/email-change review, permissions, no email.');
} finally {
  sql(`delete from public.assignment_notification_deliveries where workspace_id=${q(ws)};
    delete from public.volunteer_welcome_deliveries where workspace_id=${q(ws)};
    delete from public.communication_assignment_coverage where workspace_id=${q(ws)};
    delete from public.communication_recipients where workspace_id=${q(ws)};
    delete from public.communication_operations where workspace_id=${q(ws)};
    delete from public.assignment_responses where workspace_id=${q(ws)};
    delete from public.calendar_assignments where workspace_id=${q(ws)};
    delete from public.calendar_items where workspace_id=${q(ws)};
    delete from public.volunteer_profiles where workspace_id=${q(ws)};
    delete from public.task_presets where workspace_id=${q(ws)};
    delete from public.workspace_contact_grants where workspace_id=${q(ws)};
    delete from public.project_contacts where id=${q(contact)};
    delete from public.workspaces where id=${q(ws)};
    delete from auth.users where id=${q(user)};`);
}
