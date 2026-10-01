import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseLookupInput, parseLookupResult } from '../lib/volunteerScheduleAccess/lookup.ts';
const q=v=>`'${String(v).replaceAll("'","''")}'`;
const localContainer=process.env.LOCAL_FIXTURE_CONTAINER || 'supabase_db_cvc-scheduler';
assert(/^supabase_db_cvc-(?:scheduler|1249-replay)$/.test(localContainer),'Only a named local fixture database is supported.');
function sql(query){const r=spawnSync('docker',['exec','-i',localContainer,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const ws=[randomUUID(),randomUUID()],user=randomUUID(),contact=randomUUID(),ids=Array.from({length:5},()=>randomUUID()),prefix=`lookup-${randomUUID()}`;
const lookup=(address,choice=null)=>JSON.parse(sql(`begin;set local role anon;select public.resolve_volunteer_schedule_contact(${address==null?'null':q(address)},${choice==null?'null':q(choice)});commit;`).split(/\r?\n/)[0]);
const read=token=>sql(`begin;set local role anon;select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from public.read_volunteer_schedule(${q(token)}) r;commit;`).split(/\r?\n/)[0];
const reset=()=>sql("delete from public.volunteer_lookup_attempts where bucket<>'global';update public.volunteer_lookup_attempts set attempts=0,window_started_at=now() where bucket='global';");
try{
  sql(`insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone) values
    (${q(ws[0])},${q(prefix+'-a')},'North project','active','America/Denver'),
    (${q(ws[1])},${q(prefix+'-b')},'South project','active','America/Denver');
    insert into auth.users(id,email) values(${q(user)},${q(user+'@example.invalid')});
    insert into public.project_contacts(id,auth_user_id,status) values(${q(contact)},${q(user)},'active');`);
  const rows=[
    [ids[0],ws[0],'Halli Johnson','household@example.invalid','+1 (406) 555-0100','North'],
    [ids[1],ws[0],'Caleb Johnson','household@example.invalid','+1 (406) 555-0100','North'],
    [ids[2],ws[1],'Halli Johnson','household@example.invalid','+1 (406) 555-0100','South'],
    [ids[3],ws[0],'Unique Volunteer','unique@example.invalid','+1 (406) 555-0101','North'],
    [ids[4],ws[0],'Inactive Volunteer','inactive@example.invalid','+1 (406) 555-0102','North']];
  for(const [id,workspace,name,email,phone,congregation] of rows) sql(`insert into public.volunteer_profiles
    (id,workspace_id,profile_source,lifecycle,readiness_status,full_name,email,phone,congregation,availability_snapshot,skills_help_snapshot,manual_created_at,manual_created_by_project_contact_id)
    values(${q(id)},${q(workspace)},'manual',${q(id===ids[4]?'inactive':'active')},'ready',${q(name)},${q(email)},${q(phone)},${q(congregation)},'{}','{}',now(),${q(contact)});`);
  reset();
  const unique=lookup(' UNIQUE@EXAMPLE.INVALID ');
  assert.equal(unique.status,'verified');assert.equal(parseLookupResult(unique).status,'verified');
  assert.equal(sql(`select volunteer_profile_id from public.volunteer_schedule_access_tokens where token_verifier_hash=extensions.digest(${q(unique.bearer_token)},'sha256')`),ids[3]);
  assert(JSON.parse(read(unique.bearer_token)).every(r=>r.volunteer_display_name==='Unique Volunteer'));
  const shared=lookup('household@example.invalid');
  assert.equal(shared.status,'choose_volunteer');assert.equal(shared.volunteers.length,3);
  assert.deepEqual(shared.volunteers.map(v=>v.name).sort(),['Caleb Johnson','Halli Johnson','Halli Johnson']);
  assert(shared.volunteers.every(v=>Object.keys(v).sort().join(',')==='choice,congregation,name,project'));
  assert(!JSON.stringify(shared).includes(ws[0])&&!JSON.stringify(shared).includes(ws[1]));
  assert.equal(parseLookupResult(shared).status,'choose_volunteer');
  const selectedChoice=shared.volunteers.find(v=>v.name==='Halli Johnson'&&v.project==='South project').choice;
  const selected=lookup('household@example.invalid',selectedChoice);
  assert.equal(selected.status,'verified');
  assert.equal(sql(`select volunteer_profile_id from public.volunteer_schedule_access_tokens where token_verifier_hash=extensions.digest(${q(selected.bearer_token)},'sha256')`),ids[2]);
  assert(JSON.parse(read(selected.bearer_token)).every(r=>r.workspace_display_name==='South project'));
  assert.equal(lookup('+1 406.555.0100').status,'choose_volunteer');
  assert.equal(lookup('+1 (406) 555-0101').status,'verified');
  assert.deepEqual(lookup('household@example.invalid','0'.repeat(64)),{status:'unverified'});
  assert.deepEqual(lookup('inactive@example.invalid'),{status:'unverified'});
  assert.deepEqual(lookup('missing@example.invalid'),{status:'unverified'});
  assert.deepEqual(lookup('4065550101'),{status:'unverified'});
  assert.equal(parseLookupInput({contact:' unique@example.invalid '}).contact,'unique@example.invalid');
  assert.equal(parseLookupInput({contact:'x@y.invalid',lastName:'Volunteer'}),null);
  assert.equal(parseLookupInput({contact:'x@y.invalid',choice:'bad'}),null);
  assert.equal(parseLookupResult({status:'verified',bearer_token:'bad',expires_at:'tomorrow'}).status,'unverified');
  reset();const attempts=Array.from({length:7},()=>lookup('unique@example.invalid'));
  assert.equal(attempts.filter(r=>r.status==='verified').length,6);
  sql("update public.volunteer_lookup_attempts set window_started_at=now()-interval '16 minutes';");
  assert.equal(lookup('unique@example.invalid').status,'verified');
  assert.equal(sql("select has_function_privilege('anon','public.resolve_volunteer_schedule_contact(text,text)','EXECUTE')"),'t');
  assert.equal(sql("select has_function_privilege('anon','public.verify_volunteer_schedule_lookup(text,text,text)','EXECUTE')"),'f');
  console.log('PASS: contact-only unique/shared email and phone, chooser, project disambiguation, scoped schedule, ineligible contacts, rate limit, and revoked surname RPC.');
}finally{
  reset();
  sql(`delete from public.volunteer_schedule_access_tokens where workspace_id in (${ws.map(q)});
    delete from public.volunteer_profiles where workspace_id in (${ws.map(q)});
    delete from public.project_contacts where id=${q(contact)};
    delete from auth.users where id=${q(user)};
    delete from public.workspaces where id in (${ws.map(q)});`);
}
