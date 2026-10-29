// Exact local catalogue/source and reviewed privilege boundary. No hosted read.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {value,q} from './12-47-local-fixtures.mjs';
import {assertEffectiveFunctionPolicy,effectiveFunctionQuery} from './function-privilege-policy.mjs';
const files=fs.readdirSync('supabase/migrations').filter(n=>/^\d{14}_.+\.sql$/.test(n)).sort();
assert.equal(files.length,58);assert.equal(files.at(-1),'20261028120000_volunteer_deletion_lifecycle.sql');
const old=spawnSync('git',['diff','--exit-code','19fe6a29d5b59941bb0612cf9e18fe85a080f474','--',...files.slice(0,-1).map(n=>'supabase/migrations/'+n)],{encoding:'utf8',windowsHide:true});assert.equal(old.status,0,'All 57 deployed migrations remain unchanged');
const source=fs.readFileSync('supabase/migrations/'+files.at(-1),'utf8');
assert.equal(value("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations"),'58|20261028120000');
assert.equal(value("select md5(statements[1]) from supabase_migrations.schema_migrations where version='20261028120000'"),createHash('md5').update(source).digest('hex'),'Local ledger retains exact reviewed SQL');
const actual=JSON.parse(value("select jsonb_agg(jsonb_build_object('name',proname,'body',prosrc)) from pg_proc where pronamespace='public'::regnamespace"));
let checked=0;
for(const match of source.matchAll(/^create(?: or replace)? function public\.([a-z_]+)\(/gim)){
 const rest=source.slice(match.index),tag=rest.match(/\bas\s+(\$[^$]*\$)/i);assert(tag);
 const start=tag.index+tag[0].length,end=rest.indexOf(tag[1]+';',start);assert(end>start);
 const rows=actual.filter(row=>row.name===match[1]);assert.equal(rows.length,1,match[1]);assert.equal(rows[0].body,rest.slice(start,end),match[1]+' exact deployed local function body');checked++;
}
assert.equal(checked,46,'39 amended boundaries plus 7 narrowly classified functions');
assertEffectiveFunctionPolicy(assert,value(effectiveFunctionQuery).split(/\r?\n/).map(JSON.parse));
assert.doesNotMatch(source,/create\s+policy|alter\s+policy|disable\s+row\s+level|create\s+role|volunteers\.delete/i);
for(const signature of ['review_volunteer_deletion(uuid,uuid)','delete_volunteer_profile(uuid,uuid,timestamp with time zone,text)','revalidate_volunteer_dispatch(text,uuid,uuid)'])for(const role of ['anon','project_local_reminder_worker','project_local_reminder_runner'])assert.equal(value(`select has_function_privilege(${q(role)},${q('public.'+signature)},'execute')`),'f');
console.log(JSON.stringify({pass:true,migrations:58,terminal:'20261028120000',exactFunctionBodies:checked,functionPolicy:110,publicExecute:0,migrationSha256:createHash('sha256').update(source).digest('hex')}));
