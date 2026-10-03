import assert from 'node:assert/strict';
import { readAssignmentPickerContextWithClient } from '../lib/calendar/assignmentPickerContext.server.ts';
import { awayDates, outsideUsualWorkDays, pickerAvailability } from '../lib/calendar/assignmentPickerContext.ts';

const id=n=>`66666666-6666-4666-8666-${String(n).padStart(12,'0')}`;
const workspaceId=id(9000);
const candidateIds=Array.from({length:161},(_,index)=>id(index+1));
const assignments=[
  {id:id(501),calendar_item_id:id(601),volunteer_profile_id:id(1),workspace_id:workspaceId},
  {id:id(503),calendar_item_id:id(603),volunteer_profile_id:id(3),workspace_id:workspaceId},
];
const tables={
  calendar_assignments:assignments,
  assignment_responses:[
    {assignment_id:id(501),response_status:'confirmed',updated_at:'2026-10-01',workspace_id:workspaceId},
    {assignment_id:id(503),response_status:'declined',updated_at:'2026-10-02',workspace_id:workspaceId},
  ],
  calendar_items:[
    {id:id(601),title_snapshot:'Gate Attendant',start_date:'2026-10-06',end_date:null,start_time:'09:00',end_time:'11:00',workspace_id:workspaceId},
    {id:id(603),title_snapshot:'Declined work',start_date:'2026-10-06',end_date:null,start_time:'09:00',end_time:'11:00',workspace_id:workspaceId},
  ],
};
const rpcCalls=[];const awayCalls=[];const readCalls=[];
function query(table){
  const predicates=[];
  const builder={
    select(){return builder;},
    eq(column,value){predicates.push(row=>row[column]===value);return builder;},
    in(column,values){readCalls.push({table,count:values.length});predicates.push(row=>values.includes(row[column]));return builder;},
    order(){return builder;},
    then(resolve,reject){return Promise.resolve({data:tables[table].filter(row=>predicates.every(predicate=>predicate(row))),error:null}).then(resolve,reject);},
  };
  return builder;
}
const client={
  from:query,
  async rpc(name,args){
    if(name==='read_assignment_picker_away_periods'){
      awayCalls.push(args);
      assert.equal(args.p_workspace_id,workspaceId);
      assert.equal(args.p_from,'2026-10-05');
      assert.equal(args.p_through,'2026-10-06','overnight end day is included in away read');
      return {data:[{volunteer_profile_id:id(4),starts_on:'2026-10-06',ends_on:'2026-10-07'}],error:null};
    }
    assert.equal(name,'plan_calendar_assignments');
    assert.equal(args.p_workspace_id,workspaceId);
    assert.equal(args.p_expected_preview,null,'read-only preview path');
    const ids=args.p_plan.volunteers.map(row=>row.id);
    rpcCalls.push(ids);
    assert(ids.length<=25,'bounded preview batch');
    return {data:{saved:false,items:[{date:'2026-10-05',endDate:'2026-10-06'}],sameDayWork:[
      ...(ids.includes(id(1))?[{volunteerId:id(1),assignmentId:id(501)}]:[]),
      ...(ids.includes(id(3))?[{volunteerId:id(3),assignmentId:id(503)}]:[]),
    ]},error:null};
  },
};
const plan={itemIds:[id(701)],volunteers:[],note:null};
const result=await readAssignmentPickerContextWithClient({client,workspaceId,plan,candidateIds});
assert.equal(result.kind,'ready');
assert.equal(result.volunteers.length,161);
assert.equal(rpcCalls.length,7,'161 volunteers use seven batches, not one request per volunteer');
assert.equal(awayCalls.length,1,'one bounded away read for the entire project roster');
assert.deepEqual(rpcCalls.flat(),candidateIds);
assert.deepEqual(readCalls,[{table:'calendar_assignments',count:2},{table:'assignment_responses',count:2},{table:'calendar_items',count:1}]);
const byId=new Map(result.volunteers.map(row=>[row.volunteerId,row]));
assert.equal(byId.get(id(1)).conflicts[0].title,'Gate Attendant');
assert.equal(byId.get(id(3)).conflicts.length,0,'declined assignment does not appear as active conflict');
assert.equal(byId.get(id(2)).conflicts.length,0,'adjacent non-overlap is not reported by authoritative preview');
assert.equal(pickerAvailability(byId.get(id(1)),['2026-10-05','2026-10-06']).kind,'conflict');
assert.equal(pickerAvailability(byId.get(id(4)),['2026-10-05','2026-10-06','2026-10-07']).label,'Away 2 of 3 shifts');
assert.equal(pickerAvailability(byId.get(id(4)),['2026-10-05'],[],[{date:'2026-10-05',endDate:'2026-10-06',endTime:'05:00'}]).label,'Away during this shift');
assert.deepEqual(awayDates(byId.get(id(4)).awayPeriods,['2026-10-05','2026-10-06','2026-10-07']),['2026-10-06','2026-10-07']);
assert.equal(pickerAvailability(byId.get(id(5)),['2026-10-05','2026-10-06']).label,'Available all 2 days · No known conflicts');
assert.deepEqual(outsideUsualWorkDays(['Monday'],['2026-10-05','2026-10-06']),['2026-10-06']);
assert.equal(pickerAvailability(byId.get(id(5)),['2026-10-05','2026-10-06'],['Monday']).label,'Usual work days: 1 of 2 selected days');
const denied=await readAssignmentPickerContextWithClient({client:{...client,rpc:async()=>({data:null,error:{code:'42501'}})},workspaceId,plan,candidateIds:[id(9999)]});
assert.equal(denied.kind,'unavailable','RPC authorization failure is fail-closed');
console.log('PASS: bounded 161-volunteer context, declined semantics, away summary, conflict details, and fail-closed isolation');
