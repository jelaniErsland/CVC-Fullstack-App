// Local production Next build + actual workerd + local PostgREST. No hosted traffic.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { value } from './12-47-local-fixtures.mjs';

if(process.argv.includes('--fixture-server')) {
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  const target=new URL(typeof url==='string'||url instanceof URL?url:url.url);
  if(target.hostname!=='127.0.0.1'||target.port!=='54321'||target.pathname!=='/rest/v1/rpc/run_assignment_reminder_worker'||JSON.parse(options?.body??'{}').p_command!=='status') {
   console.log('LOCAL_FORBIDDEN_NETWORK');throw new Error('Local test network denied');
  }
  console.log('LOCAL_STATUS_READ');return originalFetch(url,options);
 };
 const next=(await import('next')).default;
 // Model TLS termination/canonical origin without binding a public hostname/port.
 const app=next({dev:false,hostname:'projectlocal.app',port:443});await app.prepare();
 const server=http.createServer(app.getRequestHandler());
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));console.log('LOCAL_READY:'+server.address().port);
 process.stdin.once('data',()=>{server.closeAllConnections();server.close(async()=>{await app.close();process.exit(0);});});
} else {
 const {Miniflare,convertV4MiniflareOptions}=await import('../workers/reminder-clock/node_modules/miniflare/dist/src/index.js');
 const status=spawnSync('C:\\Users\\mtfis\\scoop\\shims\\supabase.exe',['status','--output','json'],{encoding:'utf8',windowsHide:true});assert.equal(status.status,0);
 const local=JSON.parse(status.stdout.slice(status.stdout.indexOf('{')));assert.equal(new URL(local.API_URL).hostname,'127.0.0.1');assert(local.JWT_SECRET);
 const claims=[{alg:'HS256',typ:'JWT'},{role:'project_local_reminder_worker',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+604800}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
 const jwt=claims+'.'+createHmac('sha256',local.JWT_SECRET).update(claims).digest('base64url'),secret='5'.repeat(64);
 const env={...process.env,NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:local.API_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY:local.ANON_KEY,REMINDER_DATABASE_JWT:jwt,REMINDER_SCHEDULER_HMAC_SECRET:secret};
 const fingerprint=()=>value(`select md5(string_agg(schemaname||'.'||tablename||':'||(xpath('/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from %I.%I t',schemaname,tablename),false,true,'')))[1]::text,'|' order by schemaname,tablename)) from pg_tables where schemaname='public' or (schemaname='auth' and tablename in('users','identities','sessions','refresh_tokens'))`);
 assert.equal(value('select delivery_enabled from public.assignment_reminder_activation'),'f');const before=fingerprint();
 const server=spawn(process.execPath,[fileURLToPath(import.meta.url),'--fixture-server'],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let output='',errors='';server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>errors+=data);
 let runtime;
 try {
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Local fixture server readiness timed out')),20000);
   server.stdout.on('data',()=>{const match=output.match(/LOCAL_READY:(\d+)/);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
   server.once('exit',()=>{clearTimeout(timer);reject(new Error('Local fixture server stopped before ready'));});
  });
  let outbound=0;
  const options=convertV4MiniflareOptions({name:'compiled-local-clock',modules:true,scriptPath:fileURLToPath(new URL('../workers/reminder-clock/dist/index.js',import.meta.url)),compatibilityDate:'2026-10-22',cf:false,bindings:{REMINDER_SCHEDULER_HMAC_SECRET:secret},outboundService:async request=>{
   outbound++;assert.equal(request.url,'https://projectlocal.app/internal/reminders');
   const headers=new Headers([...request.headers]);headers.set('host','projectlocal.app');headers.set('x-forwarded-proto','https');
   const response=await fetch(`http://127.0.0.1:${port}/internal/reminders`,{method:'POST',headers,redirect:'manual'});
   assert.equal(response.status,200,'Compiled canonical endpoint must authenticate');const data=await response.json();assert.equal(data.phase,'disabled');assert.equal(data.sent,0);return Response.json(data);
  }});
  runtime=new Miniflare({...options,telemetry:{enabled:false}});const worker=await runtime.getWorker();await worker.scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'});
  assert.equal(outbound,1);assert.equal((output.match(/LOCAL_STATUS_READ/g)??[]).length,1);assert(!output.includes('LOCAL_FORBIDDEN_NETWORK'));
  const denied=await fetch(`http://127.0.0.1:${port}/internal/reminders`,{method:'POST',headers:{host:'projectlocal.app','x-forwarded-proto':'https',authorization:'Bearer synthetic-admin',cookie:'volunteer_token=synthetic'}});assert.equal(denied.status,401);
  assert.equal((output.match(/LOCAL_STATUS_READ/g)??[]).length,1);assert.equal(fingerprint(),before);assert(!errors.includes('Error'));
  console.log('PASS actual workerd -> loopback HTTP/TLS-termination fixture -> compiled production Next route -> real local restricted JWT status RPC: one request / one read / disabled; unsigned bearer+cookie denied before DB; zero forbidden/provider network and exact public/Auth fingerprints.');
 } finally {
  if(runtime)await runtime.dispose();server.stdin.end('stop');await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill();resolve();},5000);server.once('exit',()=>{clearTimeout(timer);resolve();});});
 }
}
