import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
registerHooks({resolve(specifier,context,next){
  if(specifier.startsWith('@/'))specifier=pathToFileURL(resolve(specifier.slice(2))).href;
  if((specifier.startsWith('file:')||specifier.startsWith('.'))&&!/\.[a-z]+$/i.test(specifier)){
    const base=specifier.startsWith('file:')?fileURLToPath(specifier):resolve(dirname(fileURLToPath(context.parentURL)),specifier);
    if(existsSync(base+'.ts'))return next(pathToFileURL(base+'.ts').href,context);
  }
  return next(specifier,context);
}});
const {isConflictCode}=await import('../lib/conflict.ts');
const {classifyPublicAssignmentResponseSubmissionError:classify}=await import('../lib/responseTokens/publicRouteState.ts');
const {updateTaskPresetColorWithClient,TaskPresetEditConflictError}=await import('../lib/tasks/server.ts');
const presetId='44444444-4444-4444-8444-444444444444';
for(const code of ['40001','PT409']){
  assert(isConflictCode(code));
  assert.equal(classify({code}),'changed');
  assert.equal(classify(new Error('wrapped',{cause:{code}})),'changed');
  let rpcCalls=0;
  const client={auth:{getUser:async()=>({data:{user:{id:'local-test'}},error:null})},rpc:async()=>{rpcCalls++;return {data:null,error:{code,details:'task_preset_edit_conflict'}};}};
  await assert.rejects(updateTaskPresetColorWithClient(client,{presetId,colorKey:'blue',expectedUpdatedAt:'2026-01-01T00:00:00Z'}),TaskPresetEditConflictError);
  assert.equal(rpcCalls,1,'A business conflict must not be retried by the application');
  client.rpc=async()=>({data:null,error:{code,details:'unrelated'}});
  await assert.rejects(updateTaskPresetColorWithClient(client,{presetId,colorKey:'blue',expectedUpdatedAt:'2026-01-01T00:00:00Z'}),error=>!(error instanceof TaskPresetEditConflictError));
}
for(const code of [undefined,null,409,'409','42501','23505','P0001',{},'PT500'])assert(!isConflictCode(code));
assert.equal(classify({code:'42501'}),'unavailable');
assert.equal(classify({code:'PT500'}),'error');
const cycle={};cycle.cause=cycle;assert.equal(classify(cycle),'error');
console.log('PASS nonretryable conflict handling, rolling-code compatibility, exact detail guards, one RPC attempt, and public response classification');
