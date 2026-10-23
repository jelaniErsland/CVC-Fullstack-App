// Real workerd + handler + pg + real LOCAL Supavisor transaction pooler.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions} from '../workers/reminder-clock/node_modules/miniflare/dist/src/index.js';
import {handleReminderWorker} from '../lib/notifications/reminderWorker.server.ts';
import {createReminderWorkerRpc} from '../lib/notifications/reminderDatabase.server.ts';
import {withLocalReminderRunner} from './reminder-database-local-fixture.mjs';
import {withLocalSupavisor} from './reminder-supavisor-local-fixture.mjs';
await withLocalReminderRunner(async({password,environment})=>{
 await withLocalSupavisor(async({poolerConfig,Pool})=>{
  const pool=new Pool(poolerConfig(password));let outbound=0,transactions=0,statusReads=0,providerReads=0,providerCalls=0,mode='disabled';
  Object.defineProperty(environment,'RESEND_API_KEY',{get(){providerReads++;throw new Error('Off provider getter reached');}});
  pool.on('connect',client=>{const original=client.query.bind(client);client.query=(text,values)=>{if(text==='BEGIN')transactions++;if(text.startsWith('SELECT public.')){assert.equal(values[0],'status');statusReads++;}return original(text,values);};});
  const settings=convertV4MiniflareOptions({name:'local-reminder-clock',modules:true,scriptPath:fileURLToPath(new URL('../workers/reminder-clock/dist/index.js',import.meta.url)),compatibilityDate:'2026-10-22',bindings:{REMINDER_SCHEDULER_HMAC_SECRET:environment.REMINDER_SCHEDULER_HMAC_SECRET},cf:false,outboundService:async request=>{
   outbound++;assert.equal(request.url,'https://projectlocal.app/internal/reminders');
   if(typeof mode==='number')return new Response(null,{status:mode,headers:{location:'https://example.invalid/never-follow'}});
   const response=await handleReminderWorker(new Request(request.url,{method:request.method,headers:[...request.headers]}),environment,async()=>{providerCalls++;throw new Error('Provider forbidden');},env=>createReminderWorkerRpc(env,pool));
   assert.equal(response.status,200);const body=await response.json();assert.equal(body.phase,'disabled');assert.equal(body.sent,0);return Response.json(body);
  }});
  const runtime=new Miniflare({...settings,telemetry:{enabled:false}});
  try {
   const clock=await runtime.getWorker();await clock.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'});
   assert.deepEqual({outbound,transactions,statusReads,providerReads,providerCalls},{outbound:1,transactions:1,statusReads:1,providerReads:0,providerCalls:0});
   for(const redirect of [301,302,303,307,308]){mode=redirect;const n=outbound;await clock.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'});assert.equal(outbound,n+1);assert.equal(statusReads,1);}
   mode='disabled';await Promise.all([clock.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'}),clock.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'})]);
   assert.equal(statusReads,3);assert.equal(transactions,3);assert.equal(providerReads,0);assert.equal(providerCalls,0);
   console.log('PASS actual local workerd -> signed handler -> pg -> real Supavisor transaction-mode custom LOGIN -> worker -> Off. First event: one request / one transaction / one status read; provider getter/factory/network untouched. Redirect matrix and simultaneous disabled calls safe; exact public/Auth fingerprints.');
  }finally{await runtime.dispose();await pool.end();}
 });
});
