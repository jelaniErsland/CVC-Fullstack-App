// Local PostgreSQL only. Tests the additive, read-only 12.52 away projection.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { fixture, q, sql, value } from './12-47-local-fixtures.mjs';

const source=fs.readFileSync('supabase/migrations/20261003120000_assignment_picker_away_context.sql','utf8');
assert(!/\b(?:alter|create|drop)\s+table\b|\b(?:insert|update|delete)\s+(?:into|from)?\s*public\./i.test(source),'migration changes no tables or data');
const signature='public.read_assignment_picker_away_periods(uuid,uuid[],date,date)';
assert.equal(value(`select count(*) from supabase_migrations.schema_migrations where version='20261003120000'`),'1');
assert.equal(value(`select prosecdef from pg_proc where oid=${q(signature)}::regprocedure`),'t','security-definer read');
assert.equal(value(`select has_function_privilege('anon',${q(signature)},'EXECUTE')`),'f');
assert.equal(value(`select has_function_privilege('authenticated',${q(signature)},'EXECUTE')`),'t');
const f=await fixture();
try{
  const start=f.dayAt(5),next=f.dayAt(6),awayId=randomUUID();
  sql(`insert into public.volunteer_away_periods(id,workspace_id,volunteer_profile_id,starts_on,ends_on) values(${q(awayId)},${q(f.ws)},${q(f.volunteers[0])},${q(next)},${q(next)})`);
  const call=(volunteer=f.volunteers[0])=>`select coalesce(json_agg(row_to_json(a)),'[]'::json) from public.read_assignment_picker_away_periods(${q(f.ws)},array[${q(volunteer)}]::uuid[],${q(start)},${q(next)}) a`;
  const rows=JSON.parse(value(f.auth(call())));
  assert.deepEqual(rows,[{volunteer_profile_id:f.volunteers[0],starts_on:next,ends_on:next}],'next-day away period is available for an overnight shift');
  assert.equal(sql(`begin;set local role anon;${call()};commit;`,true).status===0,false,'anon denied');
  assert.equal(sql(f.auth(call(randomUUID())),true).status===0,false,'cross-project or unknown volunteer denied');
  sql(`update public.workspace_contact_grants set capabilities=array_remove(capabilities,'assignments.edit') where workspace_id=${q(f.ws)} and project_contact_id=${q(f.contact)}`);
  assert.equal(sql(f.auth(call()),true).status===0,false,'admin without assignment-edit grant denied');
  console.log('PASS: local migration, next-day overnight away, exact grants, anon/project/capability denial, no table or data change');
}finally{await f.cleanup();}
