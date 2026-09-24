import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture,q,sql,value } from './12-47-local-fixtures.mjs';
import { dispatchCommunicationRecipients } from '../lib/notifications/communicationDispatch.server.ts';
const f=await fixture();
let loseFinalization=false;const outbound=[];
const client={rpc:async(name,args)=>{
  if(loseFinalization&&name==='finalize_communication_recipient')return {data:null,error:{code:'fixture_lost_ack'}};
  const call=`public.${name}(${Object.entries(args).map(([key,v])=>`${key}=>${v==null?'null':typeof v==='boolean'?String(v):q(typeof v==='object'?JSON.stringify(v):v)}`).join(',')})`;
  const query=name==='issue_volunteer_schedule_access'?`select coalesce(jsonb_agg(to_jsonb(t)),'[]') from ${call} t`:`select to_jsonb(${call})`;
  const result=sql(f.auth(query),true);return result.status===0?{data:JSON.parse(result.stdout.trim()||'null'),error:null}:{data:null,error:{code:'fixture_rpc_failed'}};
}};
const configuration={ok:true,transport:'resend',origin:'http://127.0.0.1:3000',from:'Project Local <fixture@example.invalid>',apiKey:'fixture-not-a-real-provider-key'};
const runtime={fetch:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');outbound.push(JSON.parse(options.body));return new Response(JSON.stringify({id:'fixture-provider-'+outbound.length}),{status:200});}};
const queue=(ids,kind='schedule',mode='new')=>{
  const plan={kind,mode,volunteerIds:ids,...(kind==='schedule'?{startDate:f.day,endDate:f.dayAt(4)}:{})},op=randomUUID();
  const preview=JSON.parse(value(f.auth(`select public.review_communications(${q(f.ws)},${q(JSON.stringify(plan))})`)));
  value(f.auth(`select public.confirm_communication_operation(${q(f.ws)},${q(op)},${q(JSON.stringify(plan))},${q(preview.fingerprint)})`));
  return JSON.parse(value(f.auth(`select public.read_communication_history(${q(f.ws)})`))).filter(r=>r.operation_id===op).map(r=>r.recipient_id);
};
try {
  const ids=queue([f.volunteers[0],f.volunteers[1]]);
  const history=await dispatchCommunicationRecipients(client,f.ws,ids,false,configuration,runtime);
  assert.equal(outbound.length,2);assert(history.every(r=>r.state==='sent'));
  for(const message of outbound) {
    assert.equal(message.to.length,1);assert(!('cc' in message));assert(!('bcc' in message));assert(!JSON.stringify(message).includes('PRIVATE'));
    assert.equal((message.text.match(/Site preparation/g)||[]).length,3,'One email consolidates three assignments');
    const token=message.text.match(/\/v\/access\/([A-Za-z0-9_-]{43})/)[1];
    const rows=JSON.parse(value(`begin;set local role anon;select jsonb_agg(to_jsonb(r)) from public.read_volunteer_schedule(${q(token)}) r;commit;`));
    assert.equal(new Set(rows.map(r=>r.volunteer_display_name)).size,1);
    assert.equal(rows.length,3);assert(!JSON.stringify(rows).includes('PRIVATE'));assert(!JSON.stringify(rows).includes('1980-01-01'));
    assert(message.to[0].endsWith('@example.invalid'));
  }
  await dispatchCommunicationRecipients(client,f.ws,ids,true,configuration,runtime);assert.equal(outbound.length,2,'Successful recipients not retried');
  const resend=queue([f.volunteers[0]],'schedule','resend');loseFinalization=true;
  await dispatchCommunicationRecipients(client,f.ws,resend,false,configuration,runtime);assert.equal(outbound.length,3);
  const token=outbound[2].text.match(/\/v\/access\/([A-Za-z0-9_-]{43})/)[1];
  assert.equal(value(`select count(*) from public.volunteer_schedule_access_tokens where token_verifier_hash=extensions.digest(${q(token)},'sha256') and revoked_at is null`),'1','Accepted link remains valid after lost finalization');
  loseFinalization=false;await dispatchCommunicationRecipients(client,f.ws,resend,true,configuration,runtime);assert.equal(outbound.length,3,'Lost finalization is not retryable');
  const welcome=queue([f.volunteers[2]],'welcome');
  const rejected={fetch:async()=>new Response('{}',{status:422})};
  await dispatchCommunicationRecipients(client,f.ws,welcome,false,configuration,rejected);
  await dispatchCommunicationRecipients(client,f.ws,welcome,true,configuration,runtime);assert.equal(outbound.length,4);
  assert(outbound[3].text.includes('last name'));assert(!outbound[3].text.includes('/v/access/'));
  const before=outbound.length;await assert.rejects(()=>dispatchCommunicationRecipients(client,f.ws,[],false,{ok:false,reason:'transport_disabled'},runtime));assert.equal(outbound.length,before);
  console.log('PASS: real local ledger/credential dispatcher with stubbed provider, one message per recipient, consolidated work, scoped links/privacy, accepted deduplication, lost-finalization token preservation, explicit failed-only retry, welcome template, disabled transport. Real sends 0.');
} finally {await f.cleanup();}
