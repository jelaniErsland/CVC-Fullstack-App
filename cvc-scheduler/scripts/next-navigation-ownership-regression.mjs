import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const patch=require('./next-navigation-ownership-loader.cjs');
const source=fs.readFileSync(require.resolve('next/dist/client/components/app-router-instance.js'),'utf8');
function queueFrom(text){
 const exports={};
 const types={ACTION_NAVIGATE:'navigate',ACTION_RESTORE:'restore',ACTION_REFRESH:'refresh',ACTION_SERVER_ACTION:'server-action'};
 vm.runInNewContext(text,{exports,module:{exports},process:{env:{}},require(name){
  if(name.endsWith('router-reducer-types'))return types;
  if(name==='react')return {startTransition:fn=>fn()};
  if(name.endsWith('is-thenable'))return {isThenable:value=>Boolean(value?.then)};
  return {};
 }});
 return exports.createMutableActionQueue({canonicalUrl:'/A'},null);
}
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function scenario(text,{reject=false,revalidate=false,history=false}={}){
 const q=queueFrom(text), work=new Map(), effects=[];
 q.action=(state,payload)=>{
  effects.push([payload.key??payload.type,state.canonicalUrl]);
  if(payload.type==='restore')return {canonicalUrl:payload.url};
  if(payload.type==='refresh')return state;
  return new Promise((resolve,reject)=>work.set(payload.key,{resolve,reject}));
 };
 const dispatch=(type,key)=>{q.dispatch({type,key,url:key},value=>{if(value?.then)value.catch(()=>{});});return q.pending;};
 const badge=dispatch('server-action','badge');
 const old=dispatch('navigate','/B');
 const latest=dispatch(history?'restore':'navigate','/C');
 if(revalidate&&!reject)badge.payload.didRevalidate=true;
 if(reject)work.get('badge').reject(Error('controlled superseded failure'));else work.get('badge').resolve({canonicalUrl:'/A'});
 await tick();
 assert.equal(q.pending,history?null:latest,'Discarded completion advanced a newer queue owner.');
 if(!history){
  const next={type:'server-action',key:'after'};
  q.dispatch(next,value=>{if(value?.then)value.catch(()=>{});});
  assert.equal(latest.next?.payload,next,'Queued server action attached to discarded tail.');
  if(reject)work.get('/B').reject(Error('controlled superseded navigation failure'));else work.get('/B').resolve({canonicalUrl:'/B'});
  await tick();
  assert.equal(q.pending,latest,'Old navigation completion consumed the current node.');
  work.get('/C').resolve({canonicalUrl:'/C'});await tick();
  assert.equal(effects.at(-1)[1],'/C','Later action ran against a superseded canonical URL.');
  work.get('after').resolve({canonicalUrl:'/C'});await tick();
 }else {work.get('/B').resolve({canonicalUrl:'/B'});await tick();}
 assert.equal(q.state.canonicalUrl,'/C');
 assert.equal(old.discarded,true);
 assert.equal(q.pending,null);
 assert.equal(effects.filter(([type])=>type==='refresh').length,revalidate&&!reject?1:0,'Discarded revalidation must refresh exactly once when idle.');
}
await assert.rejects(()=>scenario(source),/Discarded completion advanced/);
const corrected=patch(source);
for(const reject of [false,true])for(const revalidate of [false,true])for(const history of [false,true])await scenario(corrected,{reject,revalidate,history});
assert.throws(()=>patch(source+'\n// unexpected source'),/Unreviewed Next/);
assert.throws(()=>patch(corrected),/Unreviewed Next/);
const esm=fs.readFileSync(require.resolve('next/dist/esm/client/components/app-router-instance.js'),'utf8');
assert(patch(esm).includes('actionQueue.pending !== action'));
console.log('Exact installed Next queue: original reproduces ownership loss; corrected success/rejection, queued actions, history and deferred revalidation pass. Unknown/double-patched source rejected; CJS and ESM guarded.');
