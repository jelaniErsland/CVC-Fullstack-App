import assert from 'node:assert/strict';
import { fixture, q, sql, value } from './12-47-local-fixtures.mjs';
import { structuredSkillOptions } from '../lib/volunteers/skills.ts';
import { reminderFingerprint } from './reminder-database-local-fixture.mjs';
const definition=value("select pg_get_constraintdef(oid) from pg_constraint where conname='volunteer_profiles_structured_skills_valid'");
const allowed=definition.match(/structured_skill_categories <@ ARRAY\[([^\]]+)\]/)[1];
assert.deepEqual([...allowed.matchAll(/'([^']+)'::text/g)].map(x=>x[1]),[...structuredSkillOptions]);
for(const signature of ['create_manual_volunteer_profile(uuid,jsonb)','update_volunteer_profile_manual_fields(uuid,jsonb)','convert_questionnaire_submission_to_volunteer_profile(uuid)']) {
  const body=value(`select pg_get_functiondef(${q('public.'+signature)}::regprocedure)`);
  const contracts=[...body.matchAll(/array\['Painting',([^\]]+)\]::text\[\]/g)];assert(contracts.length>0);
  for(const contract of contracts)assert.deepEqual(['Painting',...[...contract[1].matchAll(/'([^']+)'/g)].map(x=>x[1])],[...structuredSkillOptions]);
}
assert.equal(value("select is_nullable||'|'||udt_name||'|'||column_default from information_schema.columns where table_schema='public' and table_name='volunteer_profiles' and column_name='structured_skill_categories'"),"NO|_text|'{}'::text[]");
const before=reminderFingerprint();const f=await fixture();
try {
  for(const skill of structuredSkillOptions) {
    const id=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:'Canonical '+skill,email:'household@example.invalid',structuredSkills:[skill]}))})`));
    assert.deepEqual(JSON.parse(value(`select to_json(structured_skill_categories) from public.volunteer_profiles where id=${q(id)}`)),[skill]);
  }
  for(const expression of ["array['Forklift']","array['Electrical']","array['Painting','Painting']","array[null]::text[]","array[['Painting','Framing']]::text[]"]) {
    assert.notEqual(sql(`update public.volunteer_profiles set structured_skill_categories=${expression} where id=${q(f.volunteers[0])}`,true).status,0,'Column constraint must reject invalid direct owner fixture writes');
  }
  const second=await fixture();
  try {
    assert.notEqual(sql(second.auth(`select public.update_volunteer_profile_manual_fields(${q(f.volunteers[0])},${q(JSON.stringify({fullName:'Foreign attempt',email:'foreign@example.invalid',structuredSkills:['Security'],expectedUpdatedAt:value(`select updated_at from public.volunteer_profiles where id=${q(f.volunteers[0])}`)}))})`),true).status,0,'Another project editor cannot change this profile');
  } finally {await second.cleanup();}
} finally {await f.cleanup();}
assert.equal(reminderFingerprint(),before,'All public and contracted Auth data restored exactly after disposable checks');
console.log('PASS live DB/application registry parity, all ten categories, strict column validation, cross-project denial, complete fixture cleanup, no provider/network calls.');
