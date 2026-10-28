// Local Docker database only. Never reads hosted credentials or invokes providers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { fixture, sql, q, value } from './12-47-local-fixtures.mjs';
import { structuredSkillOptions, validateStructuredSkills } from '../lib/volunteers/skills.ts';
import { normalizeManualVolunteerProfileInput } from '../lib/volunteers/server.ts';
import { effectiveFunctionQuery, assertEffectiveFunctionPolicy } from './function-privilege-policy.mjs';

const name='20261027120000_volunteer_structured_skills.sql';
const migration=fs.readFileSync('supabase/migrations/'+name,'utf8');
const version='20261027120000';
const f=await fixture(); let submission, converted;
const functions=()=>JSON.parse(value(`select json_object_agg(p.oid::regprocedure::text,json_build_object('body',pg_get_functiondef(p.oid),'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,'definer',p.prosecdef)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`));
const data=()=>value(`select md5(string_agg((to_jsonb(v)-'structured_skill_categories'-'updated_at')::text,'' order by v.id)) from public.volunteer_profiles v`);
const security=()=>value(`select md5(string_agg(c.oid::text||c.relrowsecurity||c.relforcerowsecurity||coalesce(c.relacl::text,''),'' order by c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'`);
const fail=query=>{const r=sql('\\set VERBOSITY verbose\n'+query,true);assert.notEqual(r.status,0,'Invalid or unauthorized write must fail');return r.stderr;};
const read=id=>JSON.parse(value(`select row_to_json(v) from public.volunteer_profiles v where id=${q(id)}`));
const base=id=>{const v=read(id);return {fullName:v.full_name,email:v.email,phone:v.phone,skillsExperience:v.skills_experience,expectedUpdatedAt:v.updated_at};};
const edit=(id,skills,extra={})=>value(f.auth(`select public.update_volunteer_profile_manual_fields(${q(id)},${q(JSON.stringify({...base(id),...extra,...(skills===undefined?{}:{structuredSkills:skills})}))})`));
try {
  assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'57','Run migration proof from the local migration57 baseline');
  sql(`update public.volunteer_profiles set skills_help_snapshot='{"skillsExperience":{"categories":["Framing","Electrical assist"]},"otherWaysToHelp":{"notes":"HISTORY"}}' where id=${q(f.volunteers[0])};
    update public.volunteer_profiles set skills_help_snapshot='{"skillsExperience":{"categories":["Framing","Framing"]}}' where id=${q(f.volunteers[1])};
    update public.volunteer_profiles set skills_help_snapshot='{"skillsExperience":{"categories":["Forklift","Painting"]}}' where id=${q(f.volunteers[2])};`);
  const beforeFunctions=functions(),beforeData=data(),beforeSecurity=security();
  const ledger=`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','volunteer_structured_skills',array[${q(migration)}]);`;
  assert.match(fail('begin;\n'+migration+'\n'+ledger+'\nselect 1/0;commit;'),/division by zero/);
  assert.equal(value('select count(*) from supabase_migrations.schema_migrations'),'57');
  assert.equal(value("select count(*) from information_schema.columns where table_schema='public' and table_name='volunteer_profiles' and column_name='structured_skill_categories'"),'0');
  assert.deepEqual(functions(),beforeFunctions);assert.equal(data(),beforeData);assert.equal(security(),beforeSecurity);
  const applied=sql('begin;\n'+migration+'\n'+ledger+'\ncommit;');
  assert.match(applied.stderr,/2 invalid \(not salvaged\)/);
  assert.equal(value('select count(*)||\'|\'||max(version) from supabase_migrations.schema_migrations'),'58|'+version);
  assert.equal(data(),beforeData);assert.equal(security(),beforeSecurity);
  const afterFunctions=functions();
  const changed=Object.keys(beforeFunctions).filter(key=>beforeFunctions[key].body!==afterFunctions[key].body).sort();
  assert.deepEqual(changed,['convert_questionnaire_submission_to_volunteer_profile(uuid)','create_manual_volunteer_profile(uuid,jsonb)','update_volunteer_profile_manual_fields(uuid,jsonb)']);
  for(const key of Object.keys(beforeFunctions))for(const field of ['owner','acl','config','definer'])assert.deepEqual(afterFunctions[key][field],beforeFunctions[key][field],key+' '+field);
  assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,['Electrical assist','Framing']);
  assert.deepEqual(read(f.volunteers[1]).structured_skill_categories,[]);assert.deepEqual(read(f.volunteers[2]).structured_skill_categories,[]);
  // The exact SQL allowed-value contract must agree with questionnaire and app registries.
  const allowed=migration.match(/structured_skill_categories <@ array\[([^\]]+)\]/)[1];
  assert.deepEqual([...allowed.matchAll(/'([^']+)'/g)].map(x=>x[1]),[...structuredSkillOptions]);
  const questionnaire=fs.readFileSync('lib/questionnaires/payload.ts','utf8').match(/const skillOptions = \[([\s\S]*?)\] as const;/)[1];
  assert.deepEqual([...questionnaire.matchAll(/"([^"]+)"/g)].map(x=>x[1]),[...structuredSkillOptions]);
  const notes='Electrical prose does not assert a category.';
  edit(f.volunteers[0],['Painting'],{skillsExperience:notes});
  edit(f.volunteers[0],undefined);assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,['Painting']);
  for(const skills of [[],['Electrical assist'],['Electrical assist','Framing'],['Framing'],[]]){edit(f.volunteers[0],skills);assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,skills);assert.equal(read(f.volunteers[0]).skills_experience,notes);}
  const validInput={fullName:'Skills Fixture',email:'shared@example.invalid'};
  for(const bad of [null,'Painting',{},[null],[3],[['Painting']],['Forklift'],['Painting','Painting'],Array(11).fill('Painting')]) {
    assert.throws(()=>validateStructuredSkills(bad));assert.throws(()=>normalizeManualVolunteerProfileInput({...validInput,structuredSkills:bad}));
    assert.match(fail(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({...validInput,structuredSkills:bad}))})`)),/22023/);
    assert.match(fail(f.auth(`select public.update_volunteer_profile_manual_fields(${q(f.volunteers[0])},${q(JSON.stringify({...base(f.volunteers[0]),structuredSkills:bad}))})`)),/22023/);
  }
  const created=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({...validInput,structuredSkills:['Framing','Electrical assist']}))})`));
  assert.deepEqual(read(created).structured_skill_categories,['Electrical assist','Framing']);
  const old=base(created);edit(created,['Painting']);
  assert.match(fail(f.auth(`select public.update_volunteer_profile_manual_fields(${q(created)},${q(JSON.stringify({...old,structuredSkills:['Security']}))})`)),/40001/);
  assert.deepEqual(read(created).structured_skill_categories,['Painting']);
  assert.match(fail(`begin;set local role authenticated;set local request.jwt.claim.sub=${q(randomUUID())};select public.update_volunteer_profile_manual_fields(${q(created)},${q(JSON.stringify(base(created)))});commit;`),/42501/);
  sql(`update public.workspace_contact_grants set capabilities=array['workspace.read','volunteers.view'] where workspace_id=${q(f.ws)}`);
  assert.match(fail(f.auth(`select public.update_volunteer_profile_manual_fields(${q(created)},${q(JSON.stringify({...base(created),structuredSkills:['Security']}))})`)),/42501/);
  assert.match(fail(f.auth(`update public.volunteer_profiles set structured_skill_categories=array['Security'] where id=${q(created)}`)),/42501/);
  sql(`update public.workspace_contact_grants set capabilities=array['workspace.read','volunteers.view','volunteers.edit','questionnaires.review'] where workspace_id=${q(f.ws)}`);
  submission=randomUUID();const answers={aboutYou:{name:'Questionnaire Skill Fixture',email:'questionnaire@example.invalid'},availability:{weekdays:[]},skillsExperience:{categories:['Framing','Electrical assist'],details:'Original prose'},emergencyContact:{},otherWaysToHelp:{}};
  sql(`insert into public.questionnaire_submissions(id,workspace_id,answers) values(${q(submission)},${q(f.ws)},${q(JSON.stringify(answers))})`);
  converted=value(f.auth(`select public.convert_questionnaire_submission_to_volunteer_profile(${q(submission)})`));
  const historical=read(converted).skills_help_snapshot;assert.deepEqual(read(converted).structured_skill_categories,['Electrical assist','Framing']);
  edit(converted,['Painting']);assert.deepEqual(read(converted).skills_help_snapshot,historical);
  assert.deepEqual(JSON.parse(value(`select answers from public.questionnaire_submissions where id=${q(submission)}`)),answers);
  assertEffectiveFunctionPolicy(assert,value(effectiveFunctionQuery).split(/\r?\n/).map(JSON.parse));
  console.log(JSON.stringify({migration:name,sha256:createHash('sha256').update(migration).digest('hex'),forcedRollback:'PASS',cleanApply:'58',invalidLegacySnapshots:2,exactFunctionBodies:changed,registryParity:'PASS',validation:'PASS',history:'PASS',concurrency:'PASS',permissions:'PASS',providerCalls:0,productionMutations:0},null,2));
} finally {
  if(converted)sql(`delete from public.volunteer_profiles where id=${q(converted)}`);
  if(submission)sql(`delete from public.questionnaire_submissions where id=${q(submission)}`);
  await f.cleanup();
}
