import assert from 'node:assert/strict';
import { readVolunteerProfilesWithClient } from '../lib/volunteers/server.ts';
const workspace='11111111-1111-4111-8111-111111111111';
const row=n=>({id:`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`,workspace_id:workspace,source_submission_id:null,profile_source:'manual',manual_created_by_project_contact_id:null,manual_created_at:null,lifecycle:'active',readiness_status:'ready',full_name:n===1000?'Aaron Last Page':`Volunteer ${n}`,email:null,phone:null,congregation:null,preferred_contact_method:null,availability_snapshot:{},skills_help_snapshot:{},profile_notes:'',date_of_birth:null,emergency_contact_name:null,emergency_contact_phone:null,emergency_contact_relationship:null,housing_option:'unknown',after_hours_security_availability:'unknown',builder_assistant_communication:'unknown',available_work_days:[],available_two_plus_days:'unknown',skills_experience:null,other_support:null,created_at:'2026-10-27T00:00:00Z',updated_at:'2026-10-27T00:00:00Z'});
function client(size,{failAt=-1}={}) {
 const calls=[];
 const builder={
  select(columns){assert(!columns.includes('*'));return this;},
  eq(field,id){assert.equal(field,'workspace_id');assert.equal(id,workspace);return this;},
  order(field){assert.equal(field,'id');return this;},
  async range(start,end){calls.push([start,end]);assert.equal(end-start,499);return start===failAt?{data:null,error:{message:'simulated read interruption'}}:{data:Array.from({length:Math.max(0,Math.min(500,size-start))},(_,i)=>row(start+i)),error:null};}
 };
 return {calls,from(table){assert.equal(table,'volunteer_profiles');return builder;}};
}

for(const [size,requests] of [[0,1],[309,1],[1001,3],[5000,11]]){const c=client(size);const rows=await readVolunteerProfilesWithClient(c,workspace);assert.equal(rows.length,size);assert.equal(c.calls.length,requests);assert.equal(new Set(rows.map(v=>v.id)).size,size);if(size>1000)assert.equal(rows[0].fullName,'Aaron Last Page');}
await assert.rejects(readVolunteerProfilesWithClient(client(1001,{failAt:500}),workspace),/unavailable/,'No partial roster after a failed page');
await assert.rejects(readVolunteerProfilesWithClient(client(5001),workspace),/supported.*limit/,'Oversized roster fails honestly instead of truncating counts');
console.log('PASS bounded workspace-scoped complete reads at 0/309/1001/5000, post-cap matches, unique identity, stable alphabetical order, partial failure and explicit maximum.');
