import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { withReadTimeout } from '../lib/readTimeout.ts';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const report=[];
for(const variant of ['before','after']) {
 const source=variant==='before'?execFileSync('git',['show','43229f5:cvc-scheduler/app/admin/announcements/page.tsx'],{encoding:'utf8'}):fs.readFileSync('app/admin/announcements/page.tsx','utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 let reviews=0,history=0;
 const context={workspace:{id:'fixture',displayName:'Synthetic',timezone:'America/Denver'},projectContactId:'fixture',supabase:{async rpc(name){assert.equal(name,'review_communications');reviews++;await delay(543);return {data:{recipients:[]},error:null};}}};
 const modules={
  'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
  '@/lib/adminNavigation':{adminDestinations:()=>[]},
  '@/lib/volunteers/routeRead.server':{selectVolunteerManagementWorkspaceContext:()=>({ok:false})},
  '@/lib/notifications/communications.server':{readCommunicationsContext:async()=>context,communicationHistory:async()=>{history++;await delay(30);return[];}},
  '@/lib/notifications/communications.actions':{communicationsAction:()=>{throw new Error('No sending allowed');}},
  '@/lib/notifications/initialAssignmentEmail.server':{readInitialAssignmentEmailConfiguration:()=>({ok:false})},
  '@/lib/readTimeout':{withReadTimeout},
 };
 const exports={};
 vm.runInNewContext(compiled,{exports,require:name=>modules[name]??{},Intl,Date,Promise});
 const samples=[];
 for(let n=0;n<3;n++){const start=performance.now();await exports.default({searchParams:Promise.resolve({})});samples.push(Math.round(performance.now()-start));}
 assert.equal(history,3);assert.equal(reviews,variant==='before'?3:0);
 const reviewStart=performance.now();await context.supabase.rpc('review_communications');
 report.push({variant,initialRenderMs:samples,initialReviews:reviews-1,historyReads:history,onDemandReviewMs:Math.round(performance.now()-reviewStart),simulatedReviewMs:543,simulatedHistoryMs:30});
}
console.log(JSON.stringify(report,null,2));
