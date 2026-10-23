// Local injected transport only. Never reads a production secret or calls a provider.
import assert from 'node:assert/strict';
import { signSchedulerRequest, TIMESTAMP_HEADER, SIGNATURE_HEADER } from '../workers/reminder-clock/src/protocol.mjs';
import { handleReminderWorker, createReminderDelivery } from '../lib/notifications/reminderWorker.server.ts';
import { sweepAssignmentReminders } from '../lib/notifications/assignmentReminders.ts';
const workspace='11111111-1111-4111-8111-111111111111';
const secret='1'.repeat(64);
const timestamp=String(Math.floor(Date.now()/1000));
const signature=await signSchedulerRequest(secret,timestamp);
const credential=(role='project_local_reminder_worker',exp=4102444800)=>'e30.'+Buffer.from(JSON.stringify({role,exp})).toString('base64url')+'.local-mocked-signature';
const environment={NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-placeholder',REMINDER_SCHEDULER_HMAC_SECRET:secret,REMINDER_DATABASE_JWT:credential(),ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'resend',ASSIGNMENT_NOTIFICATION_FROM:'Local test <test@example.invalid>',ASSIGNMENT_NOTIFICATION_BASE_URL:'https://projectlocal.app',RESEND_API_KEY:'re_local_fixture_only'};
const request=(authorization, cookie)=>new Request('https://projectlocal.app/internal/reminders',{method:'POST',headers:{...(authorization===signature?{[TIMESTAMP_HEADER]:timestamp,[SIGNATURE_HEADER]:signature}:authorization?{authorization}:{}),...(cookie?{cookie}:{})}});
let providerCalls=0;const commands=[];
const disabledFetch=async(url,options)=>{
 assert.ok(String(url).startsWith('http://127.0.0.1:54321/rest/v1/rpc/'),'No real network permitted');
 const body=JSON.parse(options.body);commands.push(body.p_command);
 assert.equal(body.p_command,'status','Disabled execution must never sync, claim or materialize');
 return Response.json({enabled:false,workspaces:[workspace]});
};
for(const auth of [null,'Bearer invalid',`Bearer ${credential('authenticated')}`,`Bearer ${credential('anon')}`,`Bearer ${credential('service_role')}`]){
 const response=await handleReminderWorker(request(auth,'admin_session=local; volunteer_token=local; quick_view_token=local'),environment,disabledFetch);
 assert.equal(response.status,401);
}
assert.equal(commands.length,0);
let configurationReads=0;
Object.defineProperty(environment,'RESEND_API_KEY',{configurable:true,get(){configurationReads++;throw new Error('Off must not initialize provider');}});
const disabled=await handleReminderWorker(request(signature),environment,disabledFetch);
assert.equal(disabled.status,200);const result=await disabled.json();
assert.equal(result.phase,'disabled');
assert.equal(configurationReads,0);
delete environment.RESEND_API_KEY;
const onWithoutProvider=[];
assert.equal((await handleReminderWorker(request(signature),{...environment,ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled'},async(_url,options)=>{
 const command=JSON.parse(options.body).p_command;onWithoutProvider.push(command);assert.equal(command,'status');return Response.json({enabled:true,workspaces:[workspace]});
})).status,503);
assert.deepEqual(onWithoutProvider,['status'],'Enabled but misconfigured delivery fails before writes');
assert.equal(result.sent,0);assert.equal(result.claimed,0);assert.deepEqual(commands,['status']);
for(const token of [credential('service_role'),credential('authenticated'),credential('project_local_reminder_worker',1)]){
 const n=commands.length;assert.equal((await handleReminderWorker(request(signature),{...environment,REMINDER_DATABASE_JWT:token},disabledFetch)).status,503);assert.equal(commands.length,n);
}
for(const failure of [async()=>{throw new Error('mock unreachable');},async()=>new Response('',{status:401}),async()=>new Response('',{status:500}),async()=>new Response('invalid-json'),async()=>Response.json({unexpected:true})]){
 assert.equal((await handleReminderWorker(request(signature),environment,failure)).status,503);
}
// Production-shaped adapter exists, but database false makes even an eligible
// fixture unreachable before any write or provider operation.
const config={ok:true,transport:'resend',origin:'https://projectlocal.app',from:'Local test <test@example.invalid>',apiKey:'re_local_fixture_only'};
const adapter=createReminderDelivery(config,async()=>{providerCalls++;throw new Error('provider must not be reached');});
const emptyEnabled=await sweepAssignmentReminders(async command=>{assert.equal(command,'status');return {enabled:true,workspaces:[]};},'https://projectlocal.app',adapter);
assert.equal(emptyEnabled.phase,'delivery');assert.equal(emptyEnabled.sent,0);
const disabledCommands=[];let initialized=0;
await sweepAssignmentReminders(async command=>{disabledCommands.push(command);return {enabled:false,workspaces:[workspace]};},'https://projectlocal.app',()=>{initialized++;return adapter;});
assert.equal(initialized,0);
assert.deepEqual(disabledCommands,['status']);assert.equal(providerCalls,0);
const context={name:'Local fixture',email:'fixture@example.invalid',project:'Local project',title:'Gate',date:'2031-01-05',endDate:null,startTime:'07:30',endTime:'12:00',timezone:'America/Denver',kind:'response',occurrenceKey:'pending:1',insideCutoff:false,followUp:null,recipientId:'22222222-2222-4222-8222-222222222222',operationId:'33333333-3333-4333-8333-333333333333',claimId:'44444444-4444-4444-8444-444444444444',occurrenceId:'55555555-5555-4555-8555-555555555555',attempt:1};
for(const [response,status]of [[()=>Response.json({id:'mock-accepted'}),'sent'],[()=>new Response('',{status:429}),'failed'],[()=>new Response('',{status:500}),'unknown'],[()=>Response.json({}),'unknown'],[()=>{throw new Error('mock timeout');},'unknown']]){
 let finalized;let key;
 const transport=createReminderDelivery(config,async(_url,options)=>{providerCalls++;key=options.headers['Idempotency-Key'];return response();});
 const rpc=async(command,payload)=>command==='status'?{enabled:true,workspaces:[workspace]}:command==='sync'?{evaluated:1,after:null}:command==='due'?[context.occurrenceId]:command==='claim'||command==='revalidate'?context:(finalized=payload,'ok');
 await sweepAssignmentReminders(rpc,'https://projectlocal.app',transport);
 assert.equal(finalized.outcome,status);assert.equal(key,`project-local/communication/${context.operationId}/${context.recipientId}/1`);
}
let claimed=false;let concurrentSends=0;
const concurrentRpc=async(command)=>command==='status'?{enabled:true,workspaces:[workspace]}:command==='sync'?{evaluated:1,after:null}:command==='due'?[context.occurrenceId]:command==='claim'?(claimed?null:(claimed=true,context)):command==='revalidate'?context:'ok';
const concurrentAdapter=createReminderDelivery(config,async()=>{concurrentSends++;return Response.json({id:'mock-once'});});
await Promise.all([sweepAssignmentReminders(concurrentRpc,'https://projectlocal.app',concurrentAdapter),sweepAssignmentReminders(concurrentRpc,'https://projectlocal.app',concurrentAdapter)]);
assert.equal(concurrentSends,1);
const changedRpc=async command=>command==='status'?{enabled:true,workspaces:[workspace]}:command==='sync'?{evaluated:1,after:null}:command==='due'?[context.occurrenceId]:command==='claim'?context:null;
await sweepAssignmentReminders(changedRpc,'https://projectlocal.app',createReminderDelivery(config,async()=>{throw new Error('Changed eligibility must not send');}));
console.log('PASS Phase B1: endpoint denial, finite worker credentials, disabled SELECT-only hard gate, lazy provider initialization denied while Off, failure/unknown mapping, idempotency, overlapping claims, changed eligibility; all network injected, zero real provider calls');
