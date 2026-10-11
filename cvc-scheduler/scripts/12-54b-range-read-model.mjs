import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createBrowserClient } from '@supabase/ssr';
import { fixture } from './12-47-local-fixtures.mjs';
import { readCalendarReadModelWithClient } from '../lib/calendar/readModelQuery.server.ts';
const status=spawnSync('powershell.exe',['-NoProfile','-Command','npx supabase status --output json'],{encoding:'utf8',windowsHide:true});
assert.equal(status.status,0);const local=JSON.parse(status.stdout.slice(status.stdout.indexOf('{')));
assert.equal(new URL(local.API_URL).hostname,'127.0.0.1');
const f=await fixture(true);
try {
 const client=createBrowserClient(local.API_URL,local.ANON_KEY,{isSingleton:false,cookies:{getAll:()=>[...f.admin.jar.values()],setAll:()=>{}}});
 const input={workspaceId:f.ws,actorContactId:f.contact,workspaceTimezone:'America/Denver',periodKind:'month',capabilities:['calendar.view','assignments.view']};
 let reads=0;
 // Emulate the previously permissive authorized RPC; the actual PostgREST
 // application filter must eliminate historical rows before expansion.
 const legacyClient={from:table=>{reads++;return client.from(table);},rpc:(name,args)=>{reads++;return client.rpc(name,{...args,...(name==='read_authorized_calendar_items'?{p_range_start:null}:{})});}};
 const future=await readCalendarReadModelWithClient({...input,client:legacyClient,rangeStart:f.dayAt(30),rangeEnd:f.dayAt(60)});
 assert(future.ok);assert.equal(future.items.length,0);assert.equal(reads,1,'Empty month makes no assignment, response or preset expansion reads');
 for(const readClient of [client,legacyClient]) {
   const result=await readCalendarReadModelWithClient({...input,client:readClient,rangeStart:f.day,rangeEnd:f.dayAt(1)});
   assert(result.ok);assert(result.items.every(i=>i.startDate>=f.day && i.startDate<=f.dayAt(1)));
   assert.equal(result.items.length,4,'Read-model retains the existing inclusive SQL end boundary');
 }
 console.log('PASS: real local PostgREST fallback excludes historical null-end rows before expansion; RPC/filter agree; inclusive SQL boundary preserved (exclusive route boundary covered by existing Calendar regressions)');
} finally {await f.cleanup();}
