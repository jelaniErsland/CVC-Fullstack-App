// Synthetic fixtures and loopback receivers only. Never sends to the canonical URL.
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import worker, { runScheduled } from '../workers/reminder-clock/src/index.mjs';
import { REMINDER_ENDPOINT, TIMESTAMP_HEADER, SIGNATURE_HEADER, signatureInput, signSchedulerRequest, verifySchedulerRequest } from '../workers/reminder-clock/src/protocol.mjs';
const secret = '2'.repeat(64), fixed = Date.parse('2031-01-01T12:00:00Z');
const timestamp = String(fixed / 1000), signature = await signSchedulerRequest(secret, timestamp);
const headers = { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature };
const req = (url = REMINDER_ENDPOINT, method = 'POST', h = headers) => new Request(url, { method, headers: h });
assert.equal(signature, 'v1=' + createHmac('sha256', Buffer.from(secret, 'hex')).update(signatureInput(timestamp)).digest('hex'));
assert(await verifySchedulerRequest(req(), secret, fixed));
for (const offset of [-120000, 120000]) assert(await verifySchedulerRequest(req(), secret, fixed + offset));
for (const offset of [-120001, 120001]) assert.equal(await verifySchedulerRequest(req(), secret, fixed + offset), false);
for (const r of [req('https://projectlocal.app/wrong'),req('https://example.invalid/internal/reminders'),req(REMINDER_ENDPOINT,'GET'),req(REMINDER_ENDPOINT+'?command=claim'),req('http://projectlocal.app/internal/reminders'),req(REMINDER_ENDPOINT,'POST',{}),req(REMINDER_ENDPOINT,'POST',{...headers,[SIGNATURE_HEADER]:'v1='+'0'.repeat(64)}),req(REMINDER_ENDPOINT,'POST',{...headers,[TIMESTAMP_HEADER]:'01'+timestamp}),req(REMINDER_ENDPOINT,'POST',{authorization:'Bearer ordinary-admin',cookie:'volunteer_token=synthetic'})]) assert.equal(await verifySchedulerRequest(r, secret, fixed),false);
for(const input of [signatureInput(timestamp,'GET'),signatureInput(timestamp,'POST','example.invalid'),signatureInput(timestamp,'POST','projectlocal.app','/wrong')]) {
 const wrong='v1='+createHmac('sha256',Buffer.from(secret,'hex')).update(input).digest('hex');
 assert.equal(await verifySchedulerRequest(req(REMINDER_ENDPOINT,'POST',{...headers,[SIGNATURE_HEADER]:wrong}),secret,fixed),false);
}
assert.equal(await verifySchedulerRequest(req(), '3'.repeat(64), fixed),false);
assert.equal(await verifySchedulerRequest(req(), undefined, fixed),false);
const logs=[];let requests=0;
const options={now:()=>fixed,log:entry=>logs.push(entry),request:async(url,init)=>{
 requests++;assert.equal(url,REMINDER_ENDPOINT);assert.equal(init.method,'POST');assert.equal(init.redirect,'manual');assert.equal(init.body,undefined);
 assert(!Object.values(init.headers).includes(secret));assert(await verifySchedulerRequest(new Request(url,init),secret,fixed));
 return Response.json({phase:'disabled'});
}};
assert.equal((await runScheduled({scheduledTime:fixed},{REMINDER_SCHEDULER_HMAC_SECRET:secret},options)).outcome,'disabled');
assert.equal(requests,1);
assert.equal((await worker.fetch()).status,404);
for(const status of [401,403,404,429,500]) {
 let calls=0;const result=await runScheduled({scheduledTime:fixed},{REMINDER_SCHEDULER_HMAC_SECRET:secret},{...options,request:async()=>{calls++;return new Response('not logged',{status});}});
 assert.equal(calls,1);assert.equal(result.outcome,'http_failure');
}
for(const request of [async()=>{throw new Error('synthetic DNS failure');},async()=>{throw new Error('synthetic connection failure');},async()=>new Response('malformed',{headers:{'content-type':'application/json'}}),async()=>Response.json(null),async()=>Response.json({phase:'unexpected'}),async()=>new Response('x'.repeat(4097),{headers:{'content-type':'application/json'}})]) {
 let calls=0;const result=await runScheduled({scheduledTime:fixed},{REMINDER_SCHEDULER_HMAC_SECRET:secret},{...options,request:async(...args)=>{calls++;return request(...args);}});
 assert.equal(calls,1);assert.notEqual(result.outcome,'disabled');assert.notEqual(result.outcome,'accepted');
}
let targetCalls=0, sourceCalls=0, redirect=301, mode='redirect';
const target=http.createServer((_req,res)=>{targetCalls++;res.end('must never receive authentication');});
await new Promise(r=>target.listen(0,'127.0.0.1',r));
const source=http.createServer((incoming,res)=>{
 sourceCalls++;
 if(mode==='timeout'){res.writeHead(200,{'content-type':'application/json'});res.write('{');return;}
 assert.equal(incoming.headers[TIMESTAMP_HEADER],timestamp);assert.equal(incoming.headers[SIGNATURE_HEADER],signature);
 res.writeHead(redirect,{location:`http://127.0.0.1:${target.address().port}/untrusted`});res.end();
});
await new Promise(r=>source.listen(0,'127.0.0.1',r));
const localRequest=(_url,init)=>fetch(`http://127.0.0.1:${source.address().port}/fixture`,init);
try {
 for(const code of [301,302,303,307,308]){
  redirect=code;const before=sourceCalls;
  const result=await runScheduled({scheduledTime:fixed},{REMINDER_SCHEDULER_HMAC_SECRET:secret},{...options,request:localRequest});
  assert.equal(result.outcome,'redirect_rejected');assert.equal(sourceCalls-before,1);assert.equal(targetCalls,0);
 }
 mode='timeout';const start=Date.now(), before=sourceCalls;
 const result=await runScheduled({scheduledTime:fixed},{REMINDER_SCHEDULER_HMAC_SECRET:secret},{...options,now:Date.now,request:localRequest});
 const elapsed=Date.now()-start;assert.equal(result.outcome,'timeout_unknown');assert.equal(sourceCalls-before,1);assert(elapsed>=9900 && elapsed<12000,`Bounded timeout ${elapsed}`);
 console.log(`PASS real loopback redirect matrix (301/302/303/307/308): one request each, zero second-origin requests; stalled response terminated in ${elapsed}ms, no retry`);
} finally {source.closeAllConnections();target.closeAllConnections();await Promise.all([new Promise(r=>source.close(r)),new Promise(r=>target.close(r))]);}
const config=JSON.parse(fs.readFileSync(new URL('../workers/reminder-clock/wrangler.jsonc',import.meta.url),'utf8'));
assert.deepEqual(config.triggers.crons,[]);assert.deepEqual(config.env.production.triggers.crons,['*/5 * * * *']);assert.equal(config.workers_dev,false);
const disabledConfig=JSON.parse(fs.readFileSync(new URL('../workers/reminder-clock/wrangler.disabled.jsonc',import.meta.url),'utf8'));
assert.deepEqual(disabledConfig.triggers.crons,[]);assert.deepEqual(disabledConfig.env.production.triggers.crons,[]);assert.equal(disabledConfig.env.production.name,config.env.production.name);
assert(!JSON.stringify(logs).includes(secret));assert(!JSON.stringify(logs).includes(signature));
assert(logs.every(entry=>Object.keys(entry).sort().join(',')==='durationMs,event,outcome,scheduledAt,statusClass'));
console.log('PASS standard HMAC/independent Node vector, exact method/host/path, ±120s window, expired/future/invalid signature denial, zero secret transmission, safe logs, all HTTP failures, default Cron disarmed, no public trigger, zero real provider calls');
