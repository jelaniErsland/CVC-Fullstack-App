import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';
const root=process.cwd(),target=process.env.SNAPPINESS_FIXTURE_DIR??fs.mkdtempSync(path.join(os.tmpdir(),'1254b-surfaces-'));
const write=(p,s)=>{const name=path.join(target,p);fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,s);};
for(const name of ['components','lib','hooks'])fs.cpSync(name,path.join(target,name),{recursive:true});
for(const name of ['package.json','tsconfig.json','postcss.config.mjs'])fs.copyFileSync(name,path.join(target,name));
if(!fs.existsSync(path.join(target,'node_modules')))fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
const before=name=>execFileSync('git',['show',`43229f5:cvc-scheduler/${name}`],{encoding:'utf8'});
write('components/BeforeBadge.tsx',before('components/NeedsAttentionUnseenBadge.tsx'));
write('components/BeforePicker.tsx',before('components/PickerVolunteerList.tsx'));
write('lib/calendar/assignmentPickerContext.before.server.ts',before('lib/calendar/assignmentPickerContext.server.ts'));
write('next.config.mjs','export default {devIndicators:false};');
write('app/layout.tsx','export default function Layout({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}');
const fixtureBadgeAction=`'use server';export async function getNeedsAttentionUnseenCountAction(){const g=globalThis as any;g.badgeCalls=(g.badgeCalls??0)+1;await new Promise(r=>setTimeout(r,50));return 3;}`;
write('app/admin/needs-attention/actions.ts',fixtureBadgeAction);
write('app/admin/(workspace)/needs-attention/actions.ts',fixtureBadgeAction);
write('app/api/count/route.ts',`export async function GET(){return Response.json({calls:(globalThis as any).badgeCalls??0})} export async function POST(){(globalThis as any).badgeCalls=0;return Response.json({ok:true})}`);
write('app/badge/page.tsx',`import {NeedsAttentionUnseenBadge as Before} from '@/components/BeforeBadge';import {NeedsAttentionUnseenBadge as After,NeedsAttentionBadgeProvider} from '@/components/NeedsAttentionUnseenBadge';export default async function Page({searchParams}:any){const p=await searchParams;return p.variant==='before'?<><Before/><Before/></>:<NeedsAttentionBadgeProvider enabled><After/><After/></NeedsAttentionBadgeProvider>}`);
write('components/PickerFixture.tsx',`'use client';import {useState} from 'react';import {PickerVolunteerList as Before} from './BeforePicker';import {PickerVolunteerList as After} from './PickerVolunteerList';export default function Fixture({variant,volunteers,action}:any){const[open,setOpen]=useState(false);const Component=variant==='before'?Before:After;return <><button onClick={()=>setOpen(true)}>Open picker</button>{open?<Component volunteers={volunteers} selected={[]} dates={['2031-02-03']} occurrences={[{date:'2031-02-03'}]} plan={{itemIds:['54545454-5454-4454-8454-000000008000'],volunteers:[],note:null}} contextAction={action} onToggle={()=>{}}/>:null}</>}`);
write('app/picker/page.tsx',`import Fixture from '@/components/PickerFixture';import {readAssignmentPickerContextWithClient as before} from '@/lib/calendar/assignmentPickerContext.before.server';import {readAssignmentPickerContextWithClient as after} from '@/lib/calendar/assignmentPickerContext.server';const id=(n:number)=>'54545454-5454-4454-8454-'+String(n).padStart(12,'0');export default async function Page({searchParams}:any){const p=await searchParams;const variant=p.variant;const count=Number(p.count);async function action(form:FormData){'use server';const client:any={async rpc(name:string){await new Promise(r=>setTimeout(r,50));return name==='read_assignment_picker_away_periods'?{data:[],error:null}:{data:{saved:false,items:[{date:'2031-02-03',endDate:null}],sameDayWork:[]},error:null};}};return (variant==='before'?before:after)({client,workspaceId:id(9999),plan:JSON.parse(String(form.get('plan'))),candidateIds:JSON.parse(String(form.get('volunteerIds')))});}return <Fixture variant={variant} action={action} volunteers={Array.from({length:count},(_,n)=>({id:id(n+1),displayName:'Synthetic '+n,lifecycle:'active',readinessStatus:'ready'}))}/>}`);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/(SUPABASE|RESEND|EMAIL|TRANSPORT|TOKEN|SECRET)/i.test(key)));
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3154'],{cwd:target,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const base='http://127.0.0.1:3154';let browser;
try {
 for(let i=0;;i++){try{if((await fetch(base+'/api/count')).ok)break;}catch{}if(i>60)throw new Error(log);await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,executablePath:resolvePreviewBrowserExecutable()});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const report={badge:[],picker:[]};
 for(const variant of ['before','after']){
  await fetch(base+'/api/count',{method:'POST'});
  await page.goto(base+`/badge?variant=${variant}`,{waitUntil:'networkidle'});
  await page.locator('[aria-label="3 new attention items"]').nth(1).waitFor();
  const {calls}=await(await fetch(base+'/api/count')).json();report.badge.push({variant,calls});assert.equal(calls,variant==='before'?2:1);
  for(const count of [100,300,500,1000]){
   await page.goto(base+`/picker?variant=${variant}&count=${count}`,{waitUntil:'networkidle'});
   const start=performance.now();await page.getByRole('button',{name:'Open picker'}).click();
   await page.getByRole('searchbox',{name:'Search volunteers to assign'}).waitFor();const firstUsefulMs=Math.round(performance.now()-start);
   await page.waitForFunction(()=>{const select=document.querySelector('select[aria-label="Availability filter"]');return select&&!select.disabled;});
   report.picker.push({variant,count,firstUsefulMs,availabilityReadyMs:Math.round(performance.now()-start),latencyMs:50});
  }
 }
 // A failed context read offers a manual retry; it never labels people as
 // available based on a partial response or permanently hides the roster.
 await page.goto(base+'/picker?variant=after&count=100',{waitUntil:'networkidle'});
 const failedAction=async route=>route.request().method()==='POST'?route.abort():route.continue();
 await page.route('**/picker?*',failedAction);
 await page.getByRole('button',{name:'Open picker'}).click();
 await page.getByRole('button',{name:'Retry availability'}).waitFor();
 assert.equal(await page.getByRole('checkbox').count(),100);
 await page.unroute('**/picker?*',failedAction);
 await page.getByRole('button',{name:'Retry availability'}).click();
 await page.waitForFunction(()=>!document.querySelector('select[aria-label="Availability filter"]').disabled);
 // Hold the secondary badge response until after the inbox is marked seen.
 let release;const held=new Promise(resolve=>{release=resolve;});let started;
 const badgeStarted=new Promise(resolve=>{started=resolve;});
 await page.route('**/badge?variant=after',async route=>{if(route.request().method()==='POST'){started();await held;}await route.continue();});
 await page.goto(base+'/badge?variant=after',{waitUntil:'domcontentloaded'});
 await badgeStarted;
 await page.evaluate(()=>window.dispatchEvent(new Event('project-local:needs-attention-seen')));
 release();await page.waitForLoadState('networkidle');
 assert.equal(await page.locator('[aria-label="3 new attention items"]').count(),0,'Late badge result cannot resurrect reviewed count');
 report.recovery='PASS picker request failure/retry and badge late-result protection';
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
} finally {if(browser)await browser.close();server.kill();}
