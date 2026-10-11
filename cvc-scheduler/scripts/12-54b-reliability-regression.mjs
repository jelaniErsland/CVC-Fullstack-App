import assert from 'node:assert/strict';
import { readAssignmentPickerContextWithClient } from '../lib/calendar/assignmentPickerContext.server.ts';
import { withReadTimeout } from '../lib/readTimeout.ts';
const id=n=>`54545454-5454-4454-8454-${String(n).padStart(12,'0')}`;
const ids=Array.from({length:300},(_,i)=>id(i+1));
const input={workspaceId:id(9999),plan:{itemIds:[id(8000)],volunteers:[],note:null},candidateIds:ids};
let active=0,peak=0,calls=0;
const client={async rpc(name,args){
  assert.equal(args.p_workspace_id,input.workspaceId);
  calls++; active++; peak=Math.max(peak,active);
  await new Promise(r=>setTimeout(r, name==='read_assignment_picker_away_periods'?1:26-Number(args.p_plan.volunteers[0].id.slice(-12))%25));
  active--;
  return name==='read_assignment_picker_away_periods'?{data:[],error:null}:{data:{saved:false,items:[{date:'2031-02-03',endDate:null}],sameDayWork:[]},error:null};
}};
const ready=await readAssignmentPickerContextWithClient({...input,client});
assert.equal(ready.kind,'ready'); assert.deepEqual(ready.volunteers.map(v=>v.volunteerId),ids,'Out-of-order requests merge in roster order');
assert.equal(peak,4); assert.equal(calls,13);
calls=0;
const failed=await readAssignmentPickerContextWithClient({...input,client:{async rpc(){calls++;return calls===2?{data:null,error:{code:'42501'}}:{data:{saved:false,items:[{date:'2031-02-03'}],sameDayWork:[]},error:null};}}});
assert.deepEqual(failed,{kind:'unavailable'}); assert.equal(calls,4,'Partial failure starts no next wave and no away query');
await assert.rejects(withReadTimeout(new Promise(()=>{}),5),/timed out/);
assert.equal(await withReadTimeout(Promise.resolve('ready'),5),'ready');
await assert.rejects(withReadTimeout(Promise.reject(new Error('read failed')),5),/read failed/);
// Advance the shared server budget while its first four reads stall. This
// exercises the real deadline/fail-closed path without a 15-second test delay.
const now=Date.now; let ticks=0; let aborted=0;
Date.now=()=>now()+(ticks++>0?15001:0);
try {
  const stalled=await readAssignmentPickerContextWithClient({...input,client:{rpc(){
    const request=new Promise(()=>{});
    request.abortSignal=signal=>{signal.addEventListener('abort',()=>aborted++);return request;};
    return request;
  }}});
  assert.equal(stalled.kind,'unavailable'); assert.equal(aborted,4,'All in-flight requests receive cancellation');
} finally {Date.now=now;}
console.log('PASS: four-request cap, deterministic merge, partial-failure stop, finite read deadline and in-flight cancellation');
