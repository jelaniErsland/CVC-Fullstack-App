import assert from 'node:assert/strict';
import { readAssignmentPickerContextWithClient } from '../lib/calendar/assignmentPickerContext.server.ts';
import { readCalendarReadModelWithClient } from '../lib/calendar/readModelQuery.server.ts';
import { readCalendarAssignmentPickerWithClient } from '../lib/calendar/assignmentPicker.server.ts';
import { readCalendarTaskPresetSelectorWithClient } from '../lib/calendar/taskPresetSelector.server.ts';
const id = n => `66666666-6666-4666-8666-${String(n).padStart(12,'0')}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const workspaceId = id(9000);
const output = { picker: [], calendar: null };
for (const count of [100,300,500,1000]) {
  let calls=0, active=0, peak=0;
  const client={async rpc(name,args){
    calls++; active++; peak=Math.max(peak,active); await delay(50); active--;
    assert.equal(args.p_workspace_id, workspaceId);
    if(name==='read_assignment_picker_away_periods') return {data:[],error:null};
    assert(args.p_plan.volunteers.length<=25);
    assert.equal(args.p_expected_preview,null);
    return {data:{saved:false,items:[{date:'2031-02-03',endDate:null}],sameDayWork:[]},error:null};
  }};
  const started=performance.now();
  const result=await readAssignmentPickerContextWithClient({client,workspaceId,plan:{itemIds:[id(1)],volunteers:[],note:null},candidateIds:Array.from({length:count},(_,n)=>id(n+1))});
  assert.equal(result.kind,'ready'); assert.equal(result.volunteers.length,count);
  if(process.argv.includes('--verify')) {assert.equal(peak,4);assert.equal(calls,Math.ceil(count/25)+1);}
  output.picker.push({count,calls,peak,elapsedMs:Math.round(performance.now()-started),latencyMs:50});
}
const tables={
  calendar_items:[{id:id(1),workspace_id:workspaceId,task_preset_id:id(2),title_snapshot:'Synthetic work',task_type_snapshot:'general',schedule_kind:'timed',start_date:'2031-02-03',end_date:null,start_time:'08:00',end_time:'10:00',timezone:'America/Denver',needed_count:2,lifecycle:'active',publication_state:'published'}],
  task_presets:[{id:id(2),workspace_id:workspaceId,name:'Synthetic preset',task_type:'general',description:null,color_key:'blue',default_needed_count:2,volunteer_visible:true,custom_fields:[],lifecycle:'active'}],
  calendar_assignments:[{id:id(3),workspace_id:workspaceId,calendar_item_id:id(1),volunteer_profile_id:id(4),lifecycle:'active'}],
  assignment_responses:[{assignment_id:id(3),workspace_id:workspaceId,response_status:'confirmed',updated_at:'2031-02-01'}],
  volunteer_profiles:[{id:id(4),full_name:'Synthetic Volunteer',workspace_id:workspaceId,lifecycle:'active',readiness_status:'ready'}],
};
let calls=0; const trace=[]; const started=performance.now();
function query(table){const predicates=[]; const b={select(){return b},eq(k,v){predicates.push(r=>r[k]===v);return b},in(k,v){predicates.push(r=>v.includes(r[k]));return b},lte(){return b},or(){return b},order(){return b},then(resolve,reject){calls++;trace.push({table,at:Math.round(performance.now()-started)});return delay(250).then(()=>({data:tables[table].filter(r=>predicates.every(p=>p(r))),error:null})).then(resolve,reject)}};return b;}
const client={from:query,rpc(name){return query(name==='read_authorized_calendar_items'?'calendar_items':'task_presets')}};
const [calendar]=await Promise.all([
  readCalendarReadModelWithClient({client,workspaceId,actorContactId:id(5),rangeStart:'2031-02-01',rangeEnd:'2031-03-01',workspaceTimezone:'America/Denver',periodKind:'month',capabilities:['calendar.view','assignments.view']}),
  readCalendarTaskPresetSelectorWithClient({client,workspaceId,canViewTaskPresets:true}),
]);
assert(calendar.ok && calendar.items.length===1);
const picker=await readCalendarAssignmentPickerWithClient({client,workspaceId,calendarItemIds:[id(1)],canViewVolunteers:true});
assert.equal(picker.kind,'ready'); assert.equal(picker.assignments.length,1);
if(process.argv.includes('--verify')) {
  assert.equal(calls,8);
  const labels=trace.filter(row=>row.table==='task_presets')[1];
  const assignments=trace.find(row=>row.table==='calendar_assignments');
  assert(Math.abs(labels.at-assignments.at)<125,'Independent labels/coverage must start in the same stage');
}
output.calendar={calls,elapsedMs:Math.round(performance.now()-started),latencyMs:250,trace,scope:'authorized data helpers; excludes auth and browser'};
console.log(JSON.stringify(output,null,2));
