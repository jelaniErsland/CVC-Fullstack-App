import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { parseVolunteerCsv, normalizeCsvRow, matchVolunteerCsv, exportVolunteerCsv, spreadsheetSafeCsvCell } from '../lib/volunteers/csv.ts';
const q=v=>`'${String(v).replaceAll("'","''")}'`;
const args=['exec','-i','supabase_db_cvc-scheduler','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'];
function sql(s,fail=false){const r=spawnSync('docker',args,{input:s,encoding:'utf8',windowsHide:true});if(!fail)assert.equal(r.status,0,r.stderr);return r;}
const val=s=>sql(s).stdout.trim();
const ws=randomUUID(), user=randomUUID(), contact=randomUUID();
const auth=s=>`begin;set local role authenticated;set local request.jwt.claim.sub=${q(user)};${s};commit;`;
const importSql=(rows,id=randomUUID())=>auth(`select public.import_volunteer_profiles(${q(ws)},${q(id)},${q(JSON.stringify(rows))})`);
function concurrent(s){return new Promise(resolve=>{const p=spawn('docker',args,{windowsHide:true});let stdout='',stderr='';p.stdout.on('data',s=>stdout+=s);p.stderr.on('data',s=>stderr+=s);p.on('close',status=>resolve({status,stdout,stderr}));p.stdin.end(s);});}
const parsed=parseVolunteerCsv('\uFEFFName;Email;Weekdays;housingOption\r\n"Doe, Alex";ALEX@example.invalid;Mon|Friday;unknown\r\n');
const normalized=normalizeCsvRow(parsed.rows[0],parsed.mapping);
assert.deepEqual(normalized,{fullName:'Doe, Alex',email:'alex@example.invalid',availableWorkDays:['Monday','Friday'],housingOption:'unknown'});
assert.deepEqual(normalizeCsvRow(['','no',''],['email','housingOption','phone']),{housingOption:'no'});
assert.throws(()=>parseVolunteerCsv('Name,Email\n"unclosed'));
assert.throws(()=>normalizeCsvRow(['=WEBSERVICE("x")'],['fullName']));
assert.throws(()=>normalizeCsvRow(['2020-02-30'],['dateOfBirth']));
assert.equal(spreadsheetSafeCsvCell(' =cmd'), '"\' =cmd"');
const fixture={id:randomUUID(),fullName:'Doe, Alex',email:'alex@example.invalid',phone:'+12025550111',updatedAt:'2030-01-01',housingOption:'unknown',availableWorkDays:['Monday'],dateOfBirth:'1980-01-01',emergencyContactName:'PRIVATE'};
assert(!exportVolunteerCsv([fixture],false,false).includes('PRIVATE'));
assert.throws(()=>exportVolunteerCsv([fixture],true,false));
const round=parseVolunteerCsv(exportVolunteerCsv([fixture],true,true));
assert.equal(normalizeCsvRow(round.rows[0],round.mapping).dateOfBirth,'1980-01-01');
assert.equal(matchVolunteerCsv([['Doe, Alex','new@example.invalid']],['fullName','email'],[fixture])[0].kind,'ambiguous');
assert.equal(matchVolunteerCsv([['alex@example.invalid']],['email'],[fixture])[0].kind,'matched');
assert.equal(matchVolunteerCsv([['New','new@example.invalid'],['New','new@example.invalid']],['fullName','email'],[])[1].kind,'ambiguous');
try {
  sql(`insert into public.workspaces(id,workspace_key,display_name,lifecycle,timezone) values(${q(ws)},${q('qa-csv-'+ws)},'Local CSV','active','America/Denver');
    insert into auth.users(id,email) values(${q(user)},${q(user+'@example.invalid')});
    insert into public.project_contacts(id,auth_user_id,status) values(${q(contact)},${q(user)},'active');
    insert into public.workspace_contact_grants(workspace_id,project_contact_id,role,capabilities,status,valid_from)
    values(${q(ws)},${q(contact)},'main_contact',array['workspace.read','volunteers.view','volunteers.edit'],'active',now()-interval '1 day');`);
  const row={patch:{fullName:'CSV New',email:'csv-new@example.invalid',dateOfBirth:'1980-01-01',emergencyContactName:'PRIVATE',housingOption:'unknown'}};
  const request=randomUUID(); const created=JSON.parse(val(importSql([row],request)));
  assert.equal(created.created,1);assert.deepEqual(JSON.parse(val(importSql([row],request))),created,'Replay is idempotent');
  const id=created.profileIds[0];
  const version=()=>val(`select updated_at from public.volunteer_profiles where id=${q(id)}`);
  const original=version();
  const patch={profileId:id,expectedUpdatedAt:original,patch:{congregation:'Reviewed field'}};
  const updated=JSON.parse(val(importSql([patch])));assert.equal(updated.updated,1);
  assert.equal(val(`select email||'|'||date_of_birth||'|'||emergency_contact_name from public.volunteer_profiles where id=${q(id)}`),'csv-new@example.invalid|1980-01-01|PRIVATE','Unselected and blank fields preserved');
  assert.notEqual(sql(importSql([patch]),true).status,0,'Stale CSV update denied');
  const edit={fullName:'CSV New',email:'csv-new@example.invalid',expectedUpdatedAt:version()};
  val(auth(`select public.update_volunteer_profile_manual_fields(${q(id)},${q(JSON.stringify(edit))})`));
  assert.notEqual(sql(auth(`select public.update_volunteer_profile_manual_fields(${q(id)},${q(JSON.stringify(edit))})`),true).status,0,'Ordinary stale edit denied');
  const bad=[{patch:{fullName:'Must roll back',email:'rollback@example.invalid'}},{profileId:id,expectedUpdatedAt:original,patch:{phone:'+12025550222'}}];
  assert.notEqual(sql(importSql(bad),true).status,0);
  assert.equal(val(`select count(*) from public.volunteer_profiles where workspace_id=${q(ws)}`),'1','Later error rolls back earlier insert');
  const racing={patch:{fullName:'Concurrent import',email:'concurrent@example.invalid'}};
  const results=await Promise.all([concurrent(importSql([racing])),concurrent(importSql([racing]))]);
  assert.equal(results.filter(r=>r.status===0).length,1,'Concurrent imports do not duplicate');
  assert.equal(val(`select count(*) from public.volunteer_profiles where workspace_id=${q(ws)}`),'2');
  assert.equal(val(`select count(*) from public.communication_operations where workspace_id=${q(ws)}`),'0','No automatic email');
  assert.notEqual(sql(`set role anon; select public.import_volunteer_profiles(${q(ws)},${q(randomUUID())},'[]');`,true).status,0);
  sql(`update public.workspace_contact_grants set capabilities=array['workspace.read','volunteers.view'] where workspace_id=${q(ws)};`);
  assert.notEqual(sql(importSql([racing]),true).status,0,'Read-only cannot import');
  console.log('PASS: CSV formats/roundtrip/tri-state/private export/formula protection/reliable matching, idempotent import, reviewed sparse patches, stale edits, atomic rollback, two-admin duplication, ACL, no email.');
} finally {
  sql(`delete from public.volunteer_csv_import_operations where workspace_id=${q(ws)};delete from public.volunteer_profiles where workspace_id=${q(ws)};
    delete from public.task_presets where workspace_id=${q(ws)};delete from public.workspace_contact_grants where workspace_id=${q(ws)};
    delete from public.project_contacts where id=${q(contact)};delete from public.workspaces where id=${q(ws)};delete from auth.users where id=${q(user)};`);
}
