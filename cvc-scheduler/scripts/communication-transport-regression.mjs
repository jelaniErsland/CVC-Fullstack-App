import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sendSingleRecipientMessage, communicationIdempotencyKey } from '../lib/notifications/singleRecipientTransport.server.ts';

const configuration={ok:true,transport:'resend',origin:'https://fixture.example.invalid',from:'Project Local <fixture@example.invalid>',apiKey:'re_local_fixture_not_real'};
const message={operationId:randomUUID(),recipientId:randomUUID(),attempt:1,email:'recipient@example.invalid',subject:'Project Local fixture',text:'Private fixture body',html:'<p>Private fixture body</p>'};
let calls=0;
const accepted=await sendSingleRecipientMessage(configuration,message,{fetch:async(url,init)=>{
  calls++;
  assert.equal(url,'https://api.resend.com/emails');
  const body=JSON.parse(init.body);
  assert.deepEqual(body.to,[message.email]);
  assert.equal(body.cc,undefined);assert.equal(body.bcc,undefined);
  assert.equal(init.headers['Idempotency-Key'],communicationIdempotencyKey(message));
  return new Response(JSON.stringify({id:'fixture-accepted'}),{status:200});
}});
assert.deepEqual(accepted,{status:'accepted',providerMessageId:'fixture-accepted'});
for(const status of [400,401,403,404,422,429]) {
  assert.equal((await sendSingleRecipientMessage(configuration,message,{fetch:async()=>new Response('{}',{status})})).status,'rejected');
}
for(const status of [408,409,500,502,503]) {
  assert.equal((await sendSingleRecipientMessage(configuration,message,{fetch:async()=>new Response('{}',{status})})).status,'unknown');
}
for(const body of ['{}','not-json']) {
  assert.equal((await sendSingleRecipientMessage(configuration,message,{fetch:async()=>new Response(body,{status:200})})).status,'unknown');
}
assert.equal((await sendSingleRecipientMessage(configuration,message,{fetch:async()=>{throw new Error('network timeout after possible acceptance');}})).status,'unknown');
assert.equal((await sendSingleRecipientMessage({ok:false,reason:'transport_disabled'},message,{fetch:async()=>{throw new Error('must never call');}})).status,'rejected');
assert.equal(calls,1);
assert.notEqual(communicationIdempotencyKey(message),communicationIdempotencyKey({...message,attempt:2}));
console.log('PASS: single-recipient privacy, stable operation/recipient/attempt idempotency, definite rejection vs unknown, malformed acceptance, timeout, disabled transport. All provider calls stubbed; real email 0.');
