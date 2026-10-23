// Injected database transport/provider only. No production connection or send.
import assert from 'node:assert/strict';
import {signSchedulerRequest,TIMESTAMP_HEADER,SIGNATURE_HEADER} from '../workers/reminder-clock/src/protocol.mjs';
import {handleReminderWorker,createReminderDelivery} from '../lib/notifications/reminderWorker.server.ts';
import {createReminderWorkerRpc,reminderDatabaseConfiguration} from '../lib/notifications/reminderDatabase.server.ts';
import {sweepAssignmentReminders} from '../lib/notifications/assignmentReminders.ts';
const workspace='11111111-1111-4111-8111-111111111111',secret='1'.repeat(64);
const timestamp=String(Math.floor(Date.now()/1000)),signature=await signSchedulerRequest(secret,timestamp);
const databaseUrl=new URL('postgresql://aws-1-us-west-2.pooler.supabase.com:6543/postgres');databaseUrl.username='project_local_reminder_runner.wdlaauzknfggoqldolmx';databaseUrl.password='synthetic-local-only';
const environment={REMINDER_SCHEDULER_HMAC_SECRET:secret,REMINDER_DATABASE_URL:databaseUrl.toString(),ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'resend',ASSIGNMENT_NOTIFICATION_FROM:'Local test <test@example.invalid>',ASSIGNMENT_NOTIFICATION_BASE_URL:'https://projectlocal.app'};
const request=auth=>new Request('https://projectlocal.app/internal/reminders',{method:'POST',headers:auth===signature?{[TIMESTAMP_HEADER]:timestamp,[SIGNATURE_HEADER]:signature}:{authorization:auth??'',cookie:'synthetic-session'}});
let providerCalls=0,configurationReads=0,factoryCalls=0,connections=0;
const commands=[],queries=[],releases=[];
let dbResult={enabled:false,workspaces:[workspace]},failQuery=false;
const pool={connect:async()=>{connections++;return {query:async(text,values)=>{queries.push(text);if(text.startsWith('SELECT public.')){commands.push(values[0]);if(failQuery)throw new Error('synthetic db failure');return {rows:[{result:dbResult}]};}return {rows:[]};},release:discard=>releases.push(discard)};}};
const factory=env=>{factoryCalls++;return createReminderWorkerRpc(env,pool);};
const noProvider=async()=>{providerCalls++;throw new Error('No provider network allowed');};
Object.defineProperty(environment,'RESEND_API_KEY',{configurable:true,get(){configurationReads++;throw new Error('Off must not read provider configuration');}});
for(const auth of [null,'Bearer invalid','Bearer authenticated','Bearer service_role'])assert.equal((await handleReminderWorker(request(auth),environment,noProvider,factory)).status,401);
assert.equal(factoryCalls,0);assert.equal(connections,0);
const disabled=await handleReminderWorker(request(signature),environment,noProvider,factory),result=await disabled.json();
assert.equal(disabled.status,200);assert.equal(result.phase,'disabled');assert.deepEqual(commands,['status']);assert.equal(connections,1);assert.equal(configurationReads,0);assert.equal(providerCalls,0);
assert.equal(queries[0],'BEGIN');assert.equal(queries[1],'SET LOCAL ROLE project_local_reminder_worker');assert.equal(queries.at(-1),'COMMIT');assert.deepEqual(releases,[false]);
const cfg=reminderDatabaseConfiguration(environment);assert.equal(cfg.max,1);assert.equal(cfg.ssl.rejectUnauthorized,true);assert.equal(cfg.connectionTimeoutMillis,5000);assert.equal(cfg.query_timeout,10000);assert(!cfg.connectionString);assert(!queries.some(q=>/PREPARE|SET ROLE/.test(q)));
for(const url of [undefined,environment.REMINDER_DATABASE_URL.replace('project_local_reminder_runner.','postgres.'),environment.REMINDER_DATABASE_URL.replace(':6543',':5432'),environment.REMINDER_DATABASE_URL+'?sslmode=disable',environment.REMINDER_DATABASE_URL.replace('aws-1-us-west-2.pooler.supabase.com','example.invalid')])assert.throws(()=>reminderDatabaseConfiguration({...environment,REMINDER_DATABASE_URL:url}));
failQuery=true;assert.equal((await handleReminderWorker(request(signature),environment,noProvider,factory)).status,503);assert.equal(queries.at(-1),'ROLLBACK');assert.equal(releases.at(-1),true);failQuery=false;
for(const invalid of [null,{unexpected:true},{enabled:false,workspaces:'invalid'}]){dbResult=invalid;assert.equal((await handleReminderWorker(request(signature),environment,noProvider,factory)).status,503);}
delete environment.RESEND_API_KEY;dbResult={enabled:true,workspaces:[workspace]};const start=commands.length;
assert.equal((await handleReminderWorker(request(signature),{...environment,ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled'},noProvider,factory)).status,503);assert.deepEqual(commands.slice(start),['status']);
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
console.log('PASS Phase B1: endpoint denial, narrow SQL configuration/transaction/release, disabled SELECT-only hard gate, lazy provider initialization denied while Off, failure/unknown mapping, idempotency, overlapping claims, changed eligibility; all network injected, zero real provider calls');
