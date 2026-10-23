// Compiled Next + actual workerd/pg/local Supavisor. All hosted traffic forbidden.
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

if(process.argv.includes('--fixture-server')) {
 globalThis.fetch=async()=>{console.log('LOCAL_FORBIDDEN_NETWORK');throw new Error('No child HTTP/provider traffic');};
 const connect=net.Socket.prototype.connect;
 net.Socket.prototype.connect=function(...args){const normalized=Array.isArray(args[0])?args[0]:args;const cfg=typeof normalized[0]==='object'?normalized[0]:{port:normalized[0],host:normalized[1]};assert.equal(cfg.host,'127.0.0.1','No hosted TCP traffic');assert.equal(Number(cfg.port),56543);return connect.apply(this,args);};
 // Fixture-only termination seam: assert production TLS/user settings, then
 // route the REAL driver to the isolated plaintext loopback transaction pooler.
 const pg=createRequire(import.meta.url)('pg'),RealPool=pg.Pool;
 pg.Pool=class extends RealPool {
  constructor(config){
   assert.equal(config.host,'aws-1-us-west-2.pooler.supabase.com');assert.equal(config.port,6543);assert.equal(config.user,'project_local_reminder_runner.wdlaauzknfggoqldolmx');assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.max,1);
   console.log('LOCAL_POOL_CONFIGURATION_VERIFIED');
   super({...config,host:'127.0.0.1',port:56543,user:'project_local_reminder_runner.local-reminder-fixture',ssl:false});
   this.on('connect',client=>{const query=client.query.bind(client);client.query=(text,values)=>{if(text==='BEGIN')console.log('LOCAL_DATABASE_TRANSACTION');if(text.startsWith('SELECT public.')){assert.equal(values[0],'status');console.log('LOCAL_STATUS_READ');}return query(text,values);};});
  }
 };
 const next=(await import('next')).default,app=next({dev:false,hostname:'projectlocal.app',port:443});await app.prepare();
 const server=http.createServer(app.getRequestHandler());await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));console.log('LOCAL_READY:'+server.address().port);
 process.stdin.once('data',()=>{server.closeAllConnections();server.close(async()=>{await app.close();process.exit(0);});});
}else{
 const {withLocalReminderRunner}=await import('./reminder-database-local-fixture.mjs');
 const {withLocalSupavisor}=await import('./reminder-supavisor-local-fixture.mjs');
 const {Miniflare,convertV4MiniflareOptions}=await import('../workers/reminder-clock/node_modules/miniflare/dist/src/index.js');
 await withLocalReminderRunner(async({environment})=>{
  await withLocalSupavisor(async()=>{
   const server=spawn(process.execPath,[fileURLToPath(import.meta.url),'--fixture-server'],{env:{...process.env,...environment,NODE_ENV:'production'},windowsHide:true,stdio:['pipe','pipe','pipe']});
   let output='',errors='',runtime;server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>errors+=data);
   try {
    const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Local compiled server timed out')),20000);server.stdout.on('data',()=>{const m=output.match(/LOCAL_READY:(\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}});server.once('exit',()=>{clearTimeout(timer);reject(new Error('Local compiled server stopped'));});});
    let outbound=0;
    const options=convertV4MiniflareOptions({name:'compiled-local-clock',modules:true,scriptPath:fileURLToPath(new URL('../workers/reminder-clock/dist/index.js',import.meta.url)),compatibilityDate:'2026-10-22',cf:false,bindings:{REMINDER_SCHEDULER_HMAC_SECRET:environment.REMINDER_SCHEDULER_HMAC_SECRET},outboundService:async request=>{
     outbound++;assert.equal(request.url,'https://projectlocal.app/internal/reminders');const headers=new Headers([...request.headers]);headers.set('host','projectlocal.app');headers.set('x-forwarded-proto','https');
     const response=await fetch(`http://127.0.0.1:${port}/internal/reminders`,{method:'POST',headers,redirect:'manual'});assert.equal(response.status,200,'Compiled endpoint must authenticate');const data=await response.json();assert.equal(data.phase,'disabled');assert.equal(data.sent,0);return Response.json(data);
    }});
    runtime=new Miniflare({...options,telemetry:{enabled:false}});await(await runtime.getWorker()).scheduled({scheduledTime:Date.now(),cron:'*/5 * * * *'});
    assert.equal(outbound,1);for(const receipt of ['LOCAL_POOL_CONFIGURATION_VERIFIED','LOCAL_DATABASE_TRANSACTION','LOCAL_STATUS_READ'])assert.equal((output.match(new RegExp(receipt,'g'))??[]).length,1,receipt+' / '+output+' / '+errors);
    const denied=await fetch(`http://127.0.0.1:${port}/internal/reminders`,{method:'POST',headers:{host:'projectlocal.app','x-forwarded-proto':'https',authorization:'Bearer synthetic-admin',cookie:'volunteer_token=synthetic'}});assert.equal(denied.status,401);assert.equal((output.match(/LOCAL_STATUS_READ/g)??[]).length,1);assert(!output.includes('LOCAL_FORBIDDEN_NETWORK'));assert(!errors.includes('Error'),errors);
    console.log('PASS workerd -> compiled Next canonical endpoint -> real pg -> LOCAL Supavisor -> narrow LOGIN / transaction-local worker: one request, one transaction, one Off status read, zero provider traffic. Invalid HMAC before DB; production TLS configuration asserted; loopback termination fixture, not a hosted Vercel connectivity claim.');
   }finally{
    if(runtime)await runtime.dispose();server.stdin.end('stop');await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill();resolve();},5000);server.once('exit',()=>{clearTimeout(timer);resolve();});});
   }
  });
 });
}
