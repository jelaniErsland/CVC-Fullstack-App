// Local Docker fixtures only. No production connection or email transport.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fixture,sql,value,q} from './12-47-local-fixtures.mjs';
import {reminderFingerprint} from './reminder-database-local-fixture.mjs';
import {matchVolunteerCsv} from '../lib/volunteers/csv.ts';
const read=query=>JSON.parse(value(query));
const review=(f,id)=>read(f.auth(`select public.review_volunteer_deletion(${q(f.ws)},${q(id)})`));
const deletion=(f,id,r=review(f,id))=>f.auth(`select public.delete_volunteer_profile(${q(f.ws)},${q(id)},${q(r.version)},${q(r.fingerprint)})`);
const denied=query=>assert.notEqual(sql(query,true).status,0);
const concurrent=query=>new Promise(resolve=>{const p=spawn('docker',['exec','-i','supabase_db_cvc-scheduler','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{windowsHide:true});let stdout='',stderr='';p.stdout.on('data',x=>stdout+=x);p.stderr.on('data',x=>stderr+=x);p.on('close',status=>resolve({status,stdout,stderr}));p.stdin.end(query);});
const f=await fixture(),other=await fixture();
const id=f.volunteers[0],sibling=f.volunteers[1],never=f.volunteers[2];
sql(`update public.volunteer_profiles set email='family@example.invalid',phone='+12025550999' where workspace_id=${q(other.ws)}`);
const extraSubmissions=[];
async function cleanup(f){
 sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};delete from public.assignment_response_link_reveal_events where workspace_id=${q(f.ws)};delete from public.assignment_response_tokens where workspace_id=${q(f.ws)}`);
 await f.cleanup();
}
try {
 sql(`update public.volunteer_profiles set email='family@example.invalid',phone='+12025550999' where workspace_id=${q(f.ws)};
 update public.calendar_items set start_date=(now() at time zone timezone)::date-2 where id=${q(f.items[0])};
 update public.calendar_items set start_date=(now() at time zone timezone)::date,end_date=(now() at time zone timezone)::date+1,start_time='00:00',end_time='05:00' where id=${q(f.items[1])};`);
 const assignments=read(`select jsonb_agg(a.id order by i.start_date) from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id where a.volunteer_profile_id=${q(id)}`);
 const past=assignments[0],current=assignments[1],future=assignments[2];
 sql(`update public.assignment_responses set response_status='confirmed',responded_at=now(),response_note='PRIVATE REASON' where assignment_id in(${q(past)},${q(current)});update public.calendar_assignments set assignment_note='PRIVATE ASSIGNMENT NOTE' where volunteer_profile_id=${q(id)}`);
 const sibToken=read(f.auth(`select row_to_json(t) from public.issue_volunteer_schedule_access(${q(sibling)},720) t`));
 const responseToken=randomUUID().replaceAll('-','')+'AbCdEfGhI12';
 assert.equal(responseToken.length,43);
 sql(`insert into public.assignment_response_tokens(workspace_id,assignment_id,volunteer_profile_id,token_verifier_hash,expires_at,internal_note) values(${q(f.ws)},${q(future)},${q(id)},extensions.digest(${q(responseToken)},'sha256'),now()+interval '30 days','PRIVATE TOKEN NOTE')`);
 const r=review(f,id);assert.equal(r.affectedCount,2);assert.equal(r.inProgressCount,1);assert.equal(r.upcomingCount,1);assert.equal(r.canDelete,true);
 const unchanged=reminderFingerprint();
 denied(other.auth(`select public.delete_volunteer_profile(${q(f.ws)},${q(id)},${q(r.version)},${q(r.fingerprint)})`));
 denied(`set role anon;select public.delete_volunteer_profile(${q(f.ws)},${q(id)},${q(r.version)},${q(r.fingerprint)})`);
 denied(f.auth(`update public.volunteer_profiles set deleted_at=now() where id=${q(id)}`));
 denied(f.auth(`select public.delete_volunteer_profile(${q(f.ws)},${q(id)},'2000-01-01',${q(r.fingerprint)})`));
 denied(f.auth(`select public.delete_volunteer_profile(${q(f.ws)},${q(id)},${q(r.version)},'stale')`));
 assert.equal(reminderFingerprint(),unchanged);
 sql(`update public.workspace_contact_grants set capabilities=array['workspace.read','volunteers.view','volunteers.edit'] where workspace_id=${q(f.ws)}`);
 assert.equal(review(f,id).canDelete,false);denied(deletion(f,id));
 assert.equal(review(f,never).canDelete,true);assert.equal(read(deletion(f,never)).kind,'deleted','Never-assigned deletion needs no assignment capability');
 sql(`update public.workspace_contact_grants set capabilities=array['workspace.read','volunteers.view'] where workspace_id=${q(f.ws)}`);denied(deletion(f,id,r));
 sql(`update public.workspace_contact_grants set capabilities=array['workspace.read','volunteers.view','volunteers.edit','calendar.view','calendar.edit','assignments.view','assignments.edit','questionnaires.review'] where workspace_id=${q(f.ws)}`);
 const sub=randomUUID();extraSubmissions.push(sub);
 sql(`insert into public.questionnaire_submissions(id,workspace_id,answers) values(${q(sub)},${q(f.ws)},'{"aboutYou":{"name":"Alex Morgan","email":"PRIVATE QUESTIONNAIRE"},"availability":{"notes":"PRIVATE AVAILABILITY"},"skillsExperience":{"details":"PRIVATE SKILLS"},"emergencyContact":{"name":"PRIVATE EMERGENCY"},"otherWaysToHelp":{}}');
 update public.volunteer_profiles set profile_source='questionnaire',source_submission_id=${q(sub)},manual_created_by_project_contact_id=null,manual_created_at=null,availability_snapshot='{"notes":"PRIVATE"}',skills_help_snapshot='{"details":"PRIVATE"}',skills_experience='PRIVATE EXPERIENCE',other_support='PRIVATE SUPPORT' where id=${q(id)};
 insert into public.volunteer_away_periods(id,workspace_id,volunteer_profile_id,starts_on,ends_on) values(gen_random_uuid(),${q(f.ws)},${q(id)},'2031-01-01','2031-01-03');`);
 // Existing sent/failed/unknown/sending outcomes survive with redacted destinations.
 const recipients=[];
 for(const state of ['ready','failed','sent','sending','unknown']){
  const operation=randomUUID(),recipient=randomUUID();sql(`insert into public.communication_operations(id,workspace_id,kind,mode,actor_id,plan) values(${q(operation)},${q(f.ws)},'welcome','new',${q(f.contact)},'{}')`);recipients.push({id:recipient,state});
  sql(`insert into public.communication_recipients(id,workspace_id,operation_id,volunteer_id,email,snapshot,state,attempt,claim_id,claimed_by,claimed_at,finalized_at,failure_code,provider_message_id) values(${q(recipient)},${q(f.ws)},${q(operation)},${q(id)},'family@example.invalid',${q(JSON.stringify({name:'Alex Morgan',email:'PRIVATE COPY',phone:'PRIVATE COPY',profileNotes:'PRIVATE COPY',assignments:[{assignmentId:future,title:'Site preparation',instructions:'PRIVATE INSTRUCTION'}]}))},${q(state)},1,${q(randomUUID())},${q(f.contact)},now(),${state==='ready'||state==='sending'?'null':'now()'},${state==='failed'?"'provider_rejected'":state==='unknown'?"'provider_outcome_unknown'":'null'},${state==='sent'?"'local-mocked-accepted'":'null'})`);
 }
 // Independent operation per volunteer is enforced in real creation; fixture
 // uniqueness may require each historical record to use its own operation.
 // Durable reminder state is historical truth, not erased on deletion.
 const reminderIds=[];
 sql(`insert into public.assignment_reminder_enrollments(assignment_id,workspace_id,volunteer_id,pending_anchor,response_status,response_baseline,start_at) values(${q(future)},${q(f.ws)},${q(id)},now(),'needs_response',now(),now()+interval '7 days')`);
 for(const [index,state] of ['ready','failed','sent','sending','unknown'].entries()){
  const operation=randomUUID(),recipient=randomUUID(),occurrence=randomUUID(),claim=randomUUID();reminderIds.push({occurrence,recipient,claim,state});
  sql(`insert into public.communication_operations(id,workspace_id,kind,mode,plan) values(${q(operation)},${q(f.ws)},'reminder','automatic','{}');
   insert into public.communication_recipients(id,workspace_id,operation_id,volunteer_id,email,snapshot,state,attempt,claim_id,claimed_by,claimed_at) values(${q(recipient)},${q(f.ws)},${q(operation)},${q(id)},'family@example.invalid','{"name":"Alex Morgan","email":"PRIVATE REMINDER","assignments":[]}',${q(state)},1,${q(claim)},null,now());
   insert into public.assignment_reminder_occurrences(id,workspace_id,assignment_id,volunteer_id,kind,occurrence_key,due_at,start_at,enrolled_at,recipient_id,next_attempt_at) values(${q(occurrence)},${q(f.ws)},${q(future)},${q(id)},'response',${q('pending:'+(index+1))},now()+interval '1 hour',now()+interval '7 days',now(),${q(recipient)},now()+interval '1 hour');
   insert into public.assignment_reminder_events(occurrence_id,workspace_id,recipient_id,event,happened_at,due_at,attempt) values(${q(occurrence)},${q(f.ws)},${q(recipient)},'claimed',now(),now()+interval '1 hour',1);`);
 }
 const bulkRequest=randomUUID(),bulkPlan={itemIds:[f.items[2]],volunteers:[{id:id.toUpperCase(),excludeDates:[]},{id:sibling,excludeDates:[]}],note:'PRIVATE BULK NOTE'};
 sql(`insert into public.calendar_bulk_assignment_operations(workspace_id,request_id,actor_id,plan,result) values(${q(f.ws)},${q(bulkRequest)},${q(f.contact)},${q(JSON.stringify(bulkPlan))},'{"saved":true}');update public.calendar_assignments set assignment_note='Other worker instructions remain' where volunteer_profile_id=${q(sibling)}`);
 const beforeRollback=reminderFingerprint();
 sql(`create function public.qa_1262_force_delete_failure() returns trigger language plpgsql as $$begin raise exception 'fixture deletion rollback';end $$;create trigger qa_1262_rollback before update of deleted_at on public.volunteer_profiles for each row when(new.deleted_at is not null) execute function public.qa_1262_force_delete_failure()`);
 const failed=sql(deletion(f,id),true);assert.notEqual(failed.status,0);assert(failed.stderr.includes('fixture deletion rollback'),failed.stderr);
 sql('drop trigger qa_1262_rollback on public.volunteer_profiles;drop function public.qa_1262_force_delete_failure()');
 assert.equal(reminderFingerprint(),beforeRollback,'A late failure rolls all scrub/withdrawal/revocation/redaction back');
 const result=read(deletion(f,id));assert.equal(result.affectedCount,2);
 assert.equal(read(deletion(f,id,r)).kind,'already_deleted','Lost acknowledgement retry is safe');
 const tomb=read(`select row_to_json(v) from public.volunteer_profiles v where id=${q(id)}`);
 assert.equal(tomb.full_name,'Alex Morgan');assert(tomb.deleted_at);assert.equal(tomb.deleted_by,f.contact);
 for(const key of ['email','phone','congregation','preferred_contact_method','date_of_birth','emergency_contact_name','emergency_contact_phone','emergency_contact_relationship','skills_experience','other_support'])assert.equal(tomb[key],null,key);
 assert.equal(value(`select plan->>'note' is null from public.calendar_bulk_assignment_operations where workspace_id=${q(f.ws)} and request_id=${q(bulkRequest)}`),'t');
 assert.equal(value(`select bool_and(assignment_note='Other worker instructions remain') from public.calendar_assignments where volunteer_profile_id=${q(sibling)}`),'t');
 denied(f.auth(`select public.plan_calendar_assignments(${q(f.ws)},${q(bulkRequest)},${q(JSON.stringify({...bulkPlan,note:null}))},null)`));
 assert.equal(tomb.profile_notes,'');assert.deepEqual(tomb.availability_snapshot,{});assert.deepEqual(tomb.skills_help_snapshot,{});assert.deepEqual(tomb.available_work_days,[]);
 assert.equal(value(`select lifecycle||'|'||coalesce(removal_reason,'') from public.calendar_assignments where id=${q(past)}`),'active|');
 for(const a of [current,future])assert.equal(value(`select lifecycle||'|'||removal_reason from public.calendar_assignments where id=${q(a)}`),'canceled|volunteer_deleted');
 assert.equal(value(`select response_status||'|'||(response_note is null) from public.assignment_responses where assignment_id=${q(past)}`),'confirmed|true');
 assert.equal(value(`select count(*) from public.calendar_assignments where volunteer_profile_id=${q(sibling)} and lifecycle='active'`),'3');
 assert.equal(value(`select count(*) from public.calendar_items where id=any(array[${f.items.map(q)}]::uuid[])`),'3');
 assert.equal(value(`select count(*) from public.volunteer_away_periods where volunteer_profile_id=${q(id)}`),'0');
 assert.equal(value(`select bool_and(revoked_at is not null and internal_note is null) from public.assignment_response_tokens where volunteer_profile_id=${q(id)}`),'t');
 assert.equal(value(`select bool_and(revoked_at is not null) from public.volunteer_schedule_access_tokens where volunteer_profile_id=${q(id)}`),'t');
 assert.equal(value(`select revoked_at is null from public.volunteer_schedule_access_tokens where id=${q(sibToken.token_id)}`),'t');
 assert.equal(value(`select answers::text like '%PRIVATE%' from public.questionnaire_submissions where id=${q(sub)}`),'f');
 for(const recipient of recipients){
  const row=read(`select row_to_json(r) from public.communication_recipients r where id=${q(recipient.id)}`);
  assert.equal(row.email,null);assert(row.recipient_redacted_at);assert(!JSON.stringify(row.snapshot).includes('PRIVATE'));assert.equal(row.state,recipient.state==='ready'?'excluded':recipient.state);
  assert.equal(value(f.auth(`select public.revalidate_volunteer_dispatch('communication',${q(row.id)},${q(row.claim_id)})`)),'f');
 }
 for(const reminder of reminderIds){
  assert.equal(value(`select state from public.communication_recipients where id=${q(reminder.recipient)}`),reminder.state==='ready'?'excluded':reminder.state);
  assert.equal(value(`select scheduling_state from public.assignment_reminder_occurrences where id=${q(reminder.occurrence)}`),reminder.state==='sent'?'active':'canceled');
  assert.equal(value(`select public.claim_assignment_reminder(${q(reminder.occurrence)},now()+interval '1 hour') is null`),'t');
  assert.equal(value(`select public.assignment_reminder_dispatch_context(${q(reminder.recipient)},${q(reminder.claim)},now()) is null`),'t');
 }
 assert.equal(value(`select count(*) from public.assignment_reminder_events where workspace_id=${q(f.ws)}`),'6','Five original claim events plus one honest pre-dispatch exclusion; no history removed');
 assert.deepEqual(read(`select jsonb_agg(to_jsonb(t)) from public.read_volunteer_schedule(${q(f.token)}) t`),read(`select jsonb_agg(to_jsonb(t)) from public.read_volunteer_schedule('invalid') t`),'Revoked access has the exact generic public no-access projection');
 assert(Number(value(`select count(*) from public.read_volunteer_schedule(${q(sibToken.bearer_token)})`))>0,'Household sibling token still works');
 assert.equal(value(`select count(*) from public.read_assignment_response_by_token(${q(responseToken)})`),'0');
 for(const contact of ['family@example.invalid','+12025550999']){
  const normalized=contact.includes('@')?contact:contact.replace(/\D/g,'');
  const lookup=read(`begin;update public.volunteer_lookup_attempts set attempts=0,window_started_at=now() where bucket='global';select jsonb_build_object('removed',encode(extensions.hmac(convert_to('volunteer:'||${q(f.ws)}||':'||${q(id)}||':'||${q(normalized)},'UTF8'),secret,'sha256'),'hex'),'sibling',encode(extensions.hmac(convert_to('volunteer:'||${q(f.ws)}||':'||${q(sibling)}||':'||${q(normalized)},'UTF8'),secret,'sha256'),'hex'),'result',public.resolve_volunteer_schedule_contact(${q(contact)})) from public.volunteer_lookup_attempts where bucket='global';rollback;`);
  assert.equal(lookup.result.status,'choose_volunteer');assert(!lookup.result.volunteers.some(person=>person.choice===lookup.removed));assert(lookup.result.volunteers.some(person=>person.choice===lookup.sibling));assert(!JSON.stringify(lookup.result).includes('Deleted volunteer'));
 }

 denied(`select public.confirm_all_volunteer_schedule_assignments(${q(f.token)})`);
 denied(`select public.submit_assignment_response_by_token(${q(responseToken)},'confirmed',null)`);
 const pastDetail=value(f.auth(`select row_to_json(t) from public.read_assignment_detail_context(${q(past)}) t`));assert(pastDetail.includes('Deleted volunteer'));assert(!pastDetail.includes('PRIVATE'));
 const inFlight=recipients.find(r=>r.state==='sending');const claimId=value(`select claim_id from public.communication_recipients where id=${q(inFlight.id)}`);
 value(f.auth(`select public.finalize_communication_recipient(${q(inFlight.id)},${q(claimId)},'sent','local-late-provider-acceptance',null)`));
 assert.equal(value(`select state||'|'||(email is null) from public.communication_recipients where id=${q(inFlight.id)}`),'sent|true');
 assert.equal(value(`select email is null and recipient_redacted_at is not null from public.volunteer_welcome_deliveries where recipient_id=${q(inFlight.id)}`),'t','Late acceptance remains truthful without restoring destination');
 assert.equal(value(`select email from public.volunteer_profiles where id=${q(other.volunteers[0])}`),'family@example.invalid');
 assert.equal(value(`select revoked_at is null from public.volunteer_schedule_access_tokens where id=${q(other.tokenId)}`),'t');
 const csvAdded=read(f.auth(`select public.import_volunteer_profiles(${q(f.ws)},${q(randomUUID())},${q(JSON.stringify([{previouslyDeletedId:never,patch:{fullName:'Riley Chen',email:'returned@example.invalid'}}]))})`));assert.equal(csvAdded.created,1);assert.notEqual(csvAdded.profileIds[0],never);
 denied(f.auth(`select public.import_volunteer_profiles(${q(f.ws)},${q(randomUUID())},${q(JSON.stringify([{profileId:never,patch:{fullName:'Do not revive',email:'returned@example.invalid'}}]))})`));
 denied(f.auth(`select public.issue_volunteer_schedule_access(${q(id)},720)`));
 denied(f.auth(`select public.create_calendar_assignments_batch(${q(f.items[2])},array[${q(id)}]::uuid[],null)`));
 denied(f.auth(`select public.update_volunteer_profile_manual_fields(${q(id)},'{"fullName":"Revive","email":"revive@example.invalid"}')`));
 denied(f.auth(`select public.delete_history_free_volunteer_profile(${q(id)})`));
 const csv=matchVolunteerCsv([[id,'Alex Morgan','family@example.invalid']],['id','fullName','email'],[],new Set([id]))[0];assert.equal(csv.kind,'previously_deleted');assert.equal(csv.profileId,undefined);
 assert.equal(matchVolunteerCsv([['Alex Morgan','family@example.invalid']],['fullName','email'],[],new Set([id]))[0].kind,'new','No tombstone name recognition');
 const newId=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},'{"fullName":"Alex Morgan","email":"family@example.invalid"}')`));assert.notEqual(newId,id);
 for(const table of ['calendar_assignments','volunteer_schedule_access_tokens','assignment_reminder_enrollments'])assert.equal(value(`select count(*) from public.${table} where ${table==='assignment_reminder_enrollments'?'volunteer_id':'volunteer_profile_id'}=${q(newId)}`),'0');
 value(f.auth(`select public.create_calendar_assignments_batch(${q(f.items[2])},array[${q(newId)}]::uuid[],null)`));
 for(const status of ['confirmed','declined']){
  const person=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:'Future '+status,email:status+'@example.invalid'}))})`));
  value(f.auth(`select public.create_calendar_assignments_batch(${q(f.items[2])},array[${q(person)}]::uuid[],null)`));
  sql(`update public.assignment_responses set response_status=${q(status)},responded_at=now() where assignment_id in(select id from public.calendar_assignments where volunteer_profile_id=${q(person)})`);
  assert.equal(read(deletion(f,person)).affectedCount,1);
 }
 const historyOnly=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},'{"fullName":"Past only","email":"past@example.invalid"}')`));
 value(f.auth(`select public.create_calendar_assignments_batch(${q(f.items[0])},array[${q(historyOnly)}]::uuid[],null)`));
 assert.equal(read(deletion(f,historyOnly)).affectedCount,0);assert.equal(value(`select lifecycle from public.calendar_assignments where volunteer_profile_id=${q(historyOnly)}`),'active');
 // Concurrent assignment creation must invalidate the displayed impact, even
 // when deletion began before the other transaction committed.
 const extraItem=value(`insert into public.calendar_items(workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,publication_state,published_at,published_by_project_contact_id,created_by_project_contact_id) values(${q(f.ws)},'Concurrent future work','general','timed',${q(f.dayAt(20))},'08:00','11:00','America/Denver',3,'active','published',now(),${q(f.contact)},${q(f.contact)}) returning id`);
 const staleImpact=review(f,sibling);
 const assignInFlight=concurrent(f.auth(`select public.create_calendar_assignment(${q(extraItem)},${q(sibling)},null);select pg_sleep(1)`));
 await new Promise(resolve=>setTimeout(resolve,200));
 const changedImpact=await concurrent(deletion(f,sibling,staleImpact));assert.equal((await assignInFlight).status,0);assert.notEqual(changedImpact.status,0);assert(changedImpact.stderr.includes('Assignments changed'),changedImpact.stderr);assert.equal(value(`select deleted_at is null from public.volunteer_profiles where id=${q(sibling)}`),'t');
 const staleEdit=review(f,newId);
 const editInFlight=concurrent(f.auth(`select public.update_volunteer_profile_manual_fields(${q(newId)},${q(JSON.stringify({fullName:'Alex Morgan',email:'family@example.invalid',profileNotes:'Concurrent local edit',expectedUpdatedAt:staleEdit.version}))});select pg_sleep(1)`));
 await new Promise(resolve=>setTimeout(resolve,200));
 const changedEdit=await concurrent(deletion(f,newId,staleEdit));assert.equal((await editInFlight).status,0);assert.notEqual(changedEdit.status,0);assert(changedEdit.stderr.includes('Profile changed'),changedEdit.stderr);
 // A held dispatch authorization blocks deletion; after deletion commits no
 // fresh authorization can be obtained. No provider is contacted by this test.
 const held=concurrent(`begin;select public.lock_live_volunteer_profile(${q(f.ws)},${q(sibling)});select pg_sleep(1);commit;`);
 await new Promise(resolve=>setTimeout(resolve,200));
 const start=performance.now(),removeSibling=await concurrent(deletion(f,sibling));
 assert.equal(removeSibling.status,0,removeSibling.stderr);assert(performance.now()-start>400,'Deletion waited for the earlier authorization');assert.equal((await held).status,0);
 assert.equal(value(`select public.lock_live_volunteer_profile(${q(f.ws)},${q(sibling)})`),'f');
 console.log('PASS local deletion: never/past/current/future/overnight, impact/version/capability/project checks, late-failure atomic rollback, scrubbed snapshots, truthful deliveries, tokens/household isolation, re-add, explicit-ID-only CSV, dispatch lock race');
} finally {
 // These are disposable fixture-owned rows only.

 await cleanup(other);
 // Questionnaire FK is retained until profile cleanup completes.
 await cleanup(f);
 for(const sub of extraSubmissions)sql(`delete from public.questionnaire_submissions where id=${q(sub)}`);
}
