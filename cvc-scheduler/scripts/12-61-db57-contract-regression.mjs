import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fixture,sql,q,value} from './12-47-local-fixtures.mjs';
import {normalizeManualVolunteerProfileInput} from '../lib/volunteers/server.ts';
const files=fs.readdirSync('supabase/migrations').filter(name=>/^\d{14}_.+\.sql$/.test(name)).sort();assert.equal(files.length,57);assert(files.at(-1).startsWith('20261026120000_'));
const diff=spawnSync('git',['diff','87df898725e6ce909810c263d67ac732909bafd6','--','supabase'],{encoding:'utf8',windowsHide:true});assert.equal(diff.status,0);assert.equal(diff.stdout,'','All deployed SQL remains exact; no pending migration');
assert.equal(value("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations"),'57|20261026120000');
assert.equal(value("select count(*) from information_schema.columns where table_schema='public' and column_name='structured_skill_categories'"),'0');
for(const signature of ['create_manual_volunteer_profile(uuid,jsonb)','update_volunteer_profile_manual_fields(uuid,jsonb)','convert_questionnaire_submission_to_volunteer_profile(uuid)'])assert.doesNotMatch(value(`select pg_get_functiondef(${q('public.'+signature)}::regprocedure)`),/structured_skill_categories|structuredSkills/);
assert.throws(()=>normalizeManualVolunteerProfileInput({fullName:'Fixture',email:'fixture@example.invalid',structuredSkills:['Electrical assist']}),'Abandoned write field is not accepted');
const f=await fixture(),other=await fixture();
try {
 const id=f.volunteers[0],snapshot={skillsExperience:{categories:['Painting'],details:'Historical response'}};
 sql(`update public.volunteer_profiles set skills_help_snapshot=${q(JSON.stringify(snapshot))} where id=${q(id)}`);
 const version=value(`select updated_at from public.volunteer_profiles where id=${q(id)}`);
 value(f.auth(`select public.update_volunteer_profile_manual_fields(${q(id)},${q(JSON.stringify({fullName:'Edited local volunteer',email:'household@example.invalid',skillsExperience:'Electrical and framing prose.',expectedUpdatedAt:version}))})`));
 assert.equal(value(`select skills_experience from public.volunteer_profiles where id=${q(id)}`),'Electrical and framing prose.');assert.deepEqual(JSON.parse(value(`select skills_help_snapshot from public.volunteer_profiles where id=${q(id)}`)),snapshot);
 assert.notEqual(sql(other.auth(`select public.update_volunteer_profile_manual_fields(${q(id)},${q(JSON.stringify({fullName:'Foreign attempt',email:'no@example.invalid'}))})`),true).status,0,'Cross-project write denied');
 sql(`update public.workspace_contact_grants set capabilities=array['workspace.read','volunteers.view'] where workspace_id=${q(f.ws)}`);
 assert.notEqual(sql(f.auth(`select public.update_volunteer_profile_manual_fields(${q(id)},${q(JSON.stringify({fullName:'View attempt',email:'no@example.invalid'}))})`),true).status,0,'View-only write denied');
} finally {await other.cleanup();await f.cleanup();}
console.log('PASS exact DB57, 57 unchanged migrations, no abandoned column/write contract, existing Add/Edit, historical snapshot preservation, project/view-only denials');
