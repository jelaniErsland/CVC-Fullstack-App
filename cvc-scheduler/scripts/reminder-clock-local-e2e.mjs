// Real local workerd scheduled event -> real handler -> local PostgREST worker role.
// Outbound service intercepts ALL clock traffic; no hosted request is possible.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Miniflare, convertV4MiniflareOptions } from '../workers/reminder-clock/node_modules/miniflare/dist/src/index.js';
import { handleReminderWorker } from '../lib/notifications/reminderWorker.server.ts';
import { REMINDER_ENDPOINT, TIMESTAMP_HEADER, SIGNATURE_HEADER, signSchedulerRequest } from '../workers/reminder-clock/src/protocol.mjs';
import { value } from './12-47-local-fixtures.mjs';
const info=spawnSync('C:\\Users\\mtfis\\scoop\\shims\\supabase.exe',['status','--output','json'],{encoding:'utf8',windowsHide:true});
assert.equal(info.status,0,'Local Supabase status unavailable');
const local=JSON.parse(info.stdout.slice(info.stdout.indexOf('{')));
assert.equal(new URL(local.API_URL).hostname,'127.0.0.1');
assert(local.JWT_SECRET && local.ANON_KEY,'Local fixture signing configuration required');
const jwtParts=[{alg:'HS256',typ:'JWT'},{role:'project_local_reminder_worker',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+604800}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url'));
const localJwt=jwtParts.join('.')+'.'+createHmac('sha256',local.JWT_SECRET).update(jwtParts.join('.')).digest('base64url');
const secret='4'.repeat(64);
const env={REMINDER_SCHEDULER_HMAC_SECRET:secret,REMINDER_DATABASE_JWT:localJwt,NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:local.ANON_KEY,ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'resend',ASSIGNMENT_NOTIFICATION_FROM:'Local fixture <fixture@example.invalid>',ASSIGNMENT_NOTIFICATION_BASE_URL:'https://projectlocal.app'};
let providerInitializations=0,statusReads=0,outbound=0,mode='disabled';
Object.defineProperty(env,'RESEND_API_KEY',{get(){providerInitializations++;throw new Error('Off must not initialize a provider');}});
const fingerprint=()=>value(`select md5(string_agg(schemaname||'.'||tablename||':'||(xpath('/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from %I.%I t',schemaname,tablename),false,true,'')))[1]::text,'|' order by schemaname,tablename)) from pg_tables where schemaname='public' or (schemaname='auth' and tablename in('users','identities','sessions','refresh_tokens'))`);
const sequenceFingerprint=()=>value(`select md5(coalesce(string_agg(to_jsonb(s)::text,'|' order by schemaname,sequencename),'')) from pg_sequences s where schemaname='public'`);
assert.equal(value('select delivery_enabled from public.assignment_reminder_activation'),'f');
const before={rows:fingerprint(),sequences:sequenceFingerprint()};
const transport=async(url,init)=>{
 assert.equal(String(url),local.API_URL+'/rest/v1/rpc/run_assignment_reminder_worker');
 assert.equal(JSON.parse(init.body).p_command,'status','Off forbids every write command');statusReads++;
 return fetch(url,init);
};
const settings=convertV4MiniflareOptions({name:'local-reminder-clock',modules:true,scriptPath:fileURLToPath(new URL('../workers/reminder-clock/dist/index.js',import.meta.url)),compatibilityDate:'2026-10-22',bindings:{REMINDER_SCHEDULER_HMAC_SECRET:secret},cf:false,outboundService:async request=>{
 outbound++;assert.equal(request.url,REMINDER_ENDPOINT,'Clock must never follow a redirect to another origin');
 if(typeof mode==='number')return new Response(null,{status:mode,headers:{location:'https://example.invalid/untrusted'}});
 const response=await handleReminderWorker(new Request(request.url,{method:request.method,headers:[...request.headers]}),env,transport);
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.phase,'disabled');assert.equal(body.claimed,0);assert.equal(body.sent,0);
 return Response.json(body);
}});
const runtime=new Miniflare({...settings,telemetry:{enabled:false}});
try {
 const clock=await runtime.getWorker();
 const result=await clock.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'});
 assert.equal(result.outcome,'ok');assert.equal(outbound,1);assert.equal(statusReads,1);assert.equal(providerInitializations,0);
 assert.deepEqual({rows:fingerprint(),sequences:sequenceFingerprint()},before);
 for(const redirect of [301,302,303,307,308]){
  mode=redirect;const previous=outbound;await clock.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'});assert.equal(outbound-previous,1);assert.equal(statusReads,1);
 }
 mode='disabled';await Promise.all([clock.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'}),clock.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'})]);
 assert.equal(statusReads,3);assert.equal(providerInitializations,0);assert.deepEqual({rows:fingerprint(),sequences:sequenceFingerprint()},before);
 const parts=localJwt.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);env.REMINDER_DATABASE_JWT=parts.join('.');
 const timestamp=String(Math.floor(Date.now()/1000));
 const rejected=await handleReminderWorker(new Request(REMINDER_ENDPOINT,{method:'POST',headers:{[TIMESTAMP_HEADER]:timestamp,[SIGNATURE_HEADER]:await signSchedulerRequest(secret,timestamp)}}),env,transport);
 assert.equal(rejected.status,503,'Real PostgREST must reject a forged worker JWT');assert.equal(providerInitializations,0);assert.deepEqual({rows:fingerprint(),sequences:sequenceFingerprint()},before);
 console.log('PASS actual local workerd scheduled handler: first event one outbound HTTPS-shaped request / one real restricted-role PostgREST status read; disabled, zero provider initialization or writes. Workerd redirect matrix one request each; overlapping duplicate disabled invocations safe; public/Auth/sequence fingerprints exact; zero hosted/provider requests.');
} finally {await runtime.dispose();}
