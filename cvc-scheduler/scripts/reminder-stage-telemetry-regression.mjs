import assert from 'node:assert/strict';
import {createReminderWorkerRpc} from '../lib/notifications/reminderDatabase.server.ts';
import {runReminderWorker,handleReminderWorker} from '../lib/notifications/reminderWorker.server.ts';
import {ReminderStageFailure,reminderFailureMetadata} from '../lib/notifications/reminderDiagnostics.server.ts';
import {fixtureEnvironment} from './reminder-database-local-fixture.mjs';
import {signSchedulerRequest,TIMESTAMP_HEADER,SIGNATURE_HEADER} from '../workers/reminder-clock/src/protocol.mjs';

const secret='PRIVATE_email@example.invalid_DB_URL_HMAC_INSTRUCTION_PROVIDER_KEY';
const raw=code=>Object.assign(new Error(secret),{code});
const env={...fixtureEnvironment('local-fake-not-a-hosted-credential'),RESEND_API_KEY:'re_LOCAL_FAKE_PROVIDER'};
const ws='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const context={name:secret,email:'fixture@example.invalid',project:'Local',title:'Fixture',date:'2031-01-20',endDate:null,
 startTime:'08:00',endTime:'10:00',timezone:'America/Denver',kind:'shift',occurrenceKey:'shift:1',insideCutoff:false,
 followUp:null,recipientId:id,operationId:ws,claimId:id,occurrenceId:id,attempt:1};
const source={status:{enabled:true,workspaces:[ws]},sync:{evaluated:1,after:null},due:[id],claim:context,revalidate:context,finalize:'sent'};
for(const [query,stage] of [['BEGIN','transaction_begin_failed'],['SET LOCAL ROLE','role_assumption_failed'],['SET LOCAL statement_timeout','transaction_settings_failed'],['SELECT public.','worker_command_failed'],['COMMIT','transaction_commit_failed']]){
 let released=0,rolledBack=0,commands=0;
 const client={query:async text=>{commands++;if(text==='ROLLBACK'){rolledBack++;return{rows:[]};}if(text.startsWith(query))throw raw('55000');return{rows:[{result:{enabled:false,workspaces:[]}}]};},release:discard=>{released++;assert.equal(discard,true);}};
 const rpc=createReminderWorkerRpc(env,{connect:async()=>client});
 await assert.rejects(rpc('status'),e=>e.stage===stage&&e.errorCode==='55000'&&!e.message.includes(secret));
 assert.equal(released,1);assert.equal(rolledBack,1);assert(commands<10);
}
await assert.rejects(createReminderWorkerRpc(env,{connect:async()=>{throw raw('28P01');}})('status'),e=>e.stage==='connection_failed'&&e.errorCode==='28P01');
assert.throws(()=>createReminderWorkerRpc({}),e=>e.stage==='database_config_failed');
for(const [command,stage] of Object.entries({status:'status_failed',sync:'enrollment_sync_failed',due:'due_query_failed',claim:'claim_failed',revalidate:'revalidation_failed',finalize:'finalization_failed'})){
 let provider=0;
 const rpc=async c=>{if(c===command)throw new ReminderStageFailure('worker_command_failed',raw('57014'));return source[c];};
 await assert.rejects(runReminderWorker(env,async()=>{provider++;return Response.json({id:'local-mock'});},()=>rpc),e=>e.stage===stage&&e.errorCode==='57014');
 assert.equal(provider,command==='finalize'?1:0);
}
for(const [command,invalid,stage] of [['status',null,'status_failed'],['sync',null,'enrollment_sync_failed'],['due',null,'due_query_failed']]){
 await assert.rejects(runReminderWorker(env,async()=>{throw new Error('No provider');},()=>async c=>c===command?invalid:source[c]),e=>e.stage===stage);
}
await assert.rejects(runReminderWorker({...env,RESEND_API_KEY:undefined},async()=>{throw new Error('No provider');},()=>async c=>source[c]),e=>e.stage==='provider_config_failed');
for(const [mode,outcome] of [['reject','failed'],['timeout','unknown'],['accept','sent']]){
 let inUse=false,claimCommitted=false,calls=0,finalized,lastCommand;
 const client={query:async(text,values)=>{
  if(text==='BEGIN')return{rows:[]};
  if(text==='COMMIT'){if(lastCommand==='claim')claimCommitted=true;return{rows:[]};}
  if(text.startsWith('SELECT public.')){
   const [command,json]=values,payload=JSON.parse(json);
   lastCommand=command;
   if(command==='finalize')finalized=payload.outcome;
   return{rows:[{result:source[command]}]};
  }return{rows:[]};
 },release:()=>{inUse=false;}};
 const pool={connect:async()=>{assert.equal(inUse,false,'No nested max1 acquisition');inUse=true;return client;}};
 const result=await runReminderWorker(env,async()=>{
  assert.equal(inUse,false,'Claim/revalidation released before send');assert.equal(claimCommitted,true,'Claim commits before provider');calls++;
  if(mode==='timeout')throw new Error(secret);
  return mode==='reject'?new Response('',{status:422}):Response.json({id:'local-mock'});
 },e=>createReminderWorkerRpc(e,pool));
 assert.equal(finalized,outcome);assert.equal(calls,1);assert.equal(result.sent,mode==='accept'?1:0);assert.equal(inUse,false);
}
const timestamp=String(Math.floor(Date.now()/1000));
const signature=await signSchedulerRequest(env.REMINDER_SCHEDULER_HMAC_SECRET,timestamp);
const request=()=>new Request('https://projectlocal.app/internal/reminders',{method:'POST',headers:{[TIMESTAMP_HEADER]:timestamp,[SIGNATURE_HEADER]:signature}});
const logs=[],old=console.error;console.error=x=>logs.push(JSON.parse(x));
try{
 const response=await handleReminderWorker(request(),env,async()=>{throw new Error('No provider');},()=>async c=>{
  if(c==='sync')throw new ReminderStageFailure('worker_command_failed',raw('55000'));
  return source[c];
 });
 assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Reminder sweep unavailable.'});
 assert.equal(logs[0].stage,'enrollment_sync_failed');assert.equal(logs[0].databaseStage,'worker_command_failed');assert.equal(logs[0].errorCode,'55000');
 assert.equal(logs[0].httpStatus,503);assert.match(logs[0].runId,/^[0-9a-f-]{36}$/);assert(logs[0].elapsedMs>=0);
 assert(!JSON.stringify(logs).includes(secret));assert(!JSON.stringify(logs).includes(signature));assert(!JSON.stringify(logs).includes(env.REMINDER_SCHEDULER_HMAC_SECRET));
 assert.equal(reminderFailureMetadata(raw(secret)).stage,'unexpected_worker_failure');
}finally{console.error=old;}
console.log('PASS safe stage/SQLSTATE/run-ID telemetry, connect/role/query/commit failure discard+rollback without retry, malformed results, missing config, committed claim before send, max1 release, provider reject/unknown, lost-finalization classification. Mock provider only; real calls ZERO.');
