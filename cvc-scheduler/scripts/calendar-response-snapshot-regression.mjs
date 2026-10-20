import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readCalendarAssignmentPickerWithClient} from "../lib/calendar/assignmentPicker.server.ts";

const workspaceId=randomUUID(), otherWorkspaceId=randomUUID(), itemId=randomUUID(), volunteerId=randomUUID();
const assignments=Array.from({length:3},()=>({id:randomUUID(),calendar_item_id:itemId,volunteer_profile_id:volunteerId,lifecycle:"active",workspace_id:workspaceId}));
const responses=assignments.map((row,index)=>({assignment_id:row.id,response_status:["confirmed","declined","needs_response"][index],updated_at:"2026-10-19T00:00:00Z",workspace_id:workspaceId}));
const snapshot=assignments.map((row,index)=>({assignmentId:row.id,workspaceId,calendarItemId:itemId,assignmentLifecycle:"active",currentResponseStatus:responses[index].response_status}));
const volunteer={id:volunteerId,workspace_id:workspaceId,full_name:"Synthetic volunteer",email:null,phone:null,congregation:null,lifecycle:"active",readiness_status:"ready",available_work_days:[]};

function client(latencyMs=0, assignmentRows=assignments) {
  const calls=[];
  return {calls, from(table) {
    let rows=table==="volunteer_profiles"?[volunteer]:table==="calendar_assignments"?assignmentRows:responses;
    const filters=[];
    const builder={
      select(){return builder;}, order(){return builder;},
      eq(key,value){filters.push(row=>row[key]===value);return builder;},
      in(key,values){filters.push(row=>values.includes(row[key]));return builder;},
      async then(resolve,reject){
        calls.push({table,ids:rows.filter(row=>filters.every(test=>test(row))).map(row=>row.assignment_id??row.id)});
        if(latencyMs) await new Promise(done=>setTimeout(done,latencyMs));
        return Promise.resolve({data:rows.filter(row=>filters.every(test=>test(row))),error:null}).then(resolve,reject);
      },
    };
    return builder;
  }};
}
async function read(responseSnapshot, options={}) {
  const query=client(options.latencyMs, options.assignments);
  const started=performance.now();
  const result=await readCalendarAssignmentPickerWithClient({client:query,workspaceId,calendarItemIds:[itemId],canViewVolunteers:true,responseSnapshot});
  return {result,calls:query.calls,elapsedMs:Math.round(performance.now()-started)};
}
const before=await read(undefined,{latencyMs:100});
const after=await read(snapshot,{latencyMs:100});
assert.deepEqual(after.result,before.result);
assert.equal(before.calls.length,3);
assert.equal(after.calls.length,2);
assert.equal(after.calls.some(call=>call.table==="assignment_responses"),false);
for(const invalid of [snapshot.map(row=>({...row,workspaceId:otherWorkspaceId})),snapshot.map(row=>({...row,calendarItemId:randomUUID()})),snapshot.map(row=>({...row,assignmentLifecycle:"removed"}))]) {
  const checked=await read(invalid);
  assert.deepEqual(checked.result,before.result);
  assert.equal(checked.calls.length,3,"Mismatched scope must use fresh authorized responses.");
}
const partial=await read(snapshot.slice(0,1));
assert.deepEqual(partial.result,before.result);
assert.deepEqual(partial.calls.find(call=>call.table==="assignment_responses").ids.sort(),assignments.slice(1).map(row=>row.id).sort());
const removed=await read(snapshot,{assignments:assignments.map((row,index)=>({...row,lifecycle:index===0?"removed":"active"}))});
assert.equal(removed.result.kind,"ready");
assert.equal(removed.result.assignments.some(row=>row.assignmentId===assignments[0].id),false);
const blockedClient=client();
assert.equal((await readCalendarAssignmentPickerWithClient({client:blockedClient,workspaceId,calendarItemIds:[itemId],canViewVolunteers:false,responseSnapshot:snapshot})).kind,"unavailable");
assert.equal(blockedClient.calls.length,0);
console.log(JSON.stringify({test:"same-request Calendar response reuse",before:{calls:before.calls.length,dependentStages:2,elapsedMs:before.elapsedMs},after:{calls:after.calls.length,dependentStages:1,elapsedMs:after.elapsedMs},syntheticReadLatencyMs:100,scopeAndMissingRows:"passed",productionLatencyClaimed:false}));
