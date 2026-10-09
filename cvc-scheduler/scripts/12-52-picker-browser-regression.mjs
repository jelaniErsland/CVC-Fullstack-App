import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

const root=process.cwd();
const fixture=path.join(os.tmpdir(),'project-local-12-48-fixture');
const output=path.resolve('docs','previews','12-53-admin-workspace');
fs.mkdirSync(output,{recursive:true});
execFileSync(process.execPath,['scripts/12-48-preview.mjs'],{cwd:root,stdio:'inherit'});
const route=path.join(fixture,'app','admin','picker-1252','page.tsx');
fs.mkdirSync(path.dirname(route),{recursive:true});
fs.writeFileSync(route,`
import { AdminShell } from '@/components/AdminShell';
import { BulkAssignmentPlanner } from '@/components/BulkAssignmentPlanner';
import { AdminViewScopeProvider } from '@/lib/adminViews/scopeContext';
import { destinations } from '@/fixture';
import { expandRepeatDates } from '@/lib/calendar/repeat';
const id=(n:number)=>'55555555-5555-4555-8555-'+String(n).padStart(12,'0');
const people=[
  {id:id(1),displayName:'Halli Johnson',congregation:'Belgrade',lifecycle:'active',readinessStatus:'ready'},
  {id:id(2),displayName:'Hallie Johnson',congregation:'Bozeman',lifecycle:'active',readinessStatus:'ready',availableWorkDays:['Monday']},
  {id:id(3),displayName:'Avery Stone',congregation:'Bozeman',lifecycle:'active',readinessStatus:'ready'},
  {id:id(4),displayName:'José Rivera',congregation:'Belgrade',lifecycle:'active',readinessStatus:'ready'},
  {id:id(5),displayName:'Ineligible Person',congregation:'Belgrade',lifecycle:'active',readinessStatus:'on_hold'},
  ...Array.from({length:156},(_,index)=>({id:id(100+index),displayName:'Volunteer '+String(index+1).padStart(3,'0'),congregation:index%2?'Belgrade':'Bozeman',lifecycle:'active',readinessStatus:'ready'})),
];
async function preview(form:FormData){
  'use server';
  const plan=JSON.parse(String(form.get('plan')||'{}'));
  const dates=plan.create?expandRepeatDates(plan.create.startDate,plan.create.endDate,plan.create.weekdays):['2026-10-05',...(plan.itemIds.length>1?['2026-10-06']:[])];
  return {kind:'preview' as const,preview:{saved:false as const,fingerprint:'fixture-only',items:dates.map((date:string,index:number)=>({id:plan.create?null:plan.itemIds[index]??plan.itemIds[0],date,title:'Night Watch',startTime:'17:00',endTime:'05:00',neededCount:6,assignedCount:0,publication:'published'})),volunteers:plan.volunteers.map((person:{id:string})=>({id:person.id,name:people.find(v=>v.id===person.id)?.displayName||'Volunteer',version:'fixture'})),existingAssignments:[],sameDayWork:[]}};
}
async function context(form:FormData){
  'use server';
  const ids:string[]=JSON.parse(String(form.get('volunteerIds')||'[]'));
  const plan=JSON.parse(String(form.get('plan')||'{}'));
  const dates=plan.create?expandRepeatDates(plan.create.startDate,plan.create.endDate,plan.create.weekdays):['2026-10-05',...(plan.itemIds.length>1?['2026-10-06']:[])];
  return {kind:'ready' as const,volunteers:ids.map(volunteerId=>({volunteerId,conflicts:volunteerId===id(1)&&dates.includes('2026-10-06')?[{assignmentId:id(301),date:'2026-10-06',endDate:null,title:'Gate Attendant',startTime:'18:00',endTime:'20:00'}]:volunteerId===id(3)?[{assignmentId:id(302),date:'2026-10-05',endDate:'2026-10-06',title:'Security',startTime:'18:00',endTime:'02:00'}]:[],awayPeriods:volunteerId===id(4)?[{start:'2026-10-06',end:'2026-10-07'}]:[]}))};
}
export default async function Page({searchParams}:{searchParams:Promise<{mode?:string}>}){
  const {mode}=await searchParams;
  const create=mode==='existing'?undefined:{presetId:null,title:'Night Watch',taskType:'general',startDate:'2026-10-05',endDate:mode==='repeat'?'2026-10-09':'2026-10-05',endDayOffset:1,weekdays:mode==='repeat'?[1,2,3,4,5]:[1],startTime:'17:00',endTime:'05:00',neededCount:6,notes:null,customValues:{},meal:null};
  return <AdminViewScopeProvider scope={{contactId:id(900),workspaceId:id(901)}}><AdminShell active="calendar" destinations={await destinations()} workspaceName="Community remodel · Fixture"><main className="mx-auto max-w-2xl px-3 py-5 sm:px-6"><h1 className="text-2xl font-bold">Assignment picker preview</h1><p className="mt-1 text-sm text-slate-600">Synthetic roster. Nothing is saved or sent.</p><BulkAssignmentPlanner action={preview} contextAction={context} volunteers={people} create={create} primaryItem={mode==='existing'?{id:id(10),date:'2026-10-05',title:'Night Watch',startTime:'17:00',endTime:'05:00'}:undefined} otherItems={mode==='existing'?[{id:id(11),date:'2026-10-06',title:'Night Watch',startTime:'17:00',endTime:'05:00'}]:[]}/></main></AdminShell></AdminViewScopeProvider>;
}
`);
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/(SUPABASE|RESEND|EMAIL|TRANSPORT|TOKEN|SECRET)/i.test(key)));
Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:1',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-only',ADMIN_AUTH_MODE:'enforced',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:''});
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3152'],{cwd:fixture,env,stdio:'ignore',windowsHide:true});
const base='http://127.0.0.1:3152';
async function waitForServer(){for(let n=0;n<90;n++){try{const r=await fetch(base+'/admin/picker-1252');if(r.ok)return;}catch{} await new Promise(resolve=>setTimeout(resolve,1000));}throw new Error('Fixture server did not start');}
const browser=await chromium.launch({headless:true,executablePath:resolvePreviewBrowserExecutable()});
try{
  await waitForServer();
  for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/admin/picker-1252',{waitUntil:'networkidle'});
    const picker=page.getByRole('region',{name:'Assign volunteers'});
    const search=picker.getByRole('searchbox',{name:'Search volunteers to assign'});
    const shot=async name=>page.screenshot({path:path.join(output,`12-53-picker-${label}-${name}.png`)});
    await picker.getByText('Available · No known conflicts').first().waitFor();
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),160,'ready roster only');
    await shot('normal');
    await search.fill('HALLI JOHN');
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),2,'partial search and similar names');
    await shot('search-results');
    await search.fill('');
    await picker.getByText(/^Filters/).click();
    await picker.getByRole('combobox',{name:'Availability filter'}).selectOption('available');
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),158,'available excludes conflict and away');
    await shot('available-filter');
    await picker.getByRole('combobox',{name:'Congregation filter'}).selectOption('Belgrade');
    assert(await picker.getByText('Filtered by: Available · Belgrade').isVisible());
    await shot('congregation-filter');
    await page.reload({waitUntil:'networkidle'});
    assert(await picker.getByText('Filtered by: Available · Belgrade').isVisible(),'safe filters survive reload');
    assert(await picker.getByText('0 selected').isVisible(),'volunteer selections never return on a new operation');
    await shot('restored-safe-filters-zero-selected');
    await picker.getByText(/^Filters/).click();
    await picker.getByRole('combobox',{name:'Availability filter'}).selectOption('conflict');
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),0,'combined filter has precise empty state');
    await picker.getByText('No volunteers match these filters.').waitFor();
    await picker.getByRole('combobox',{name:'Congregation filter'}).selectOption('');
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),1,'conflict filter');
    await picker.getByRole('combobox',{name:'Congregation filter'}).selectOption('Belgrade');
    await picker.getByRole('combobox',{name:'Availability filter'}).selectOption('away');
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),1,'Belgrade away filter');
    await picker.getByRole('button',{name:'Clear all filters'}).click();
    await search.fill('avery');
    await picker.getByText('Already scheduled 6:00 PM–2:00 AM').waitFor();
    await shot('conflict-row');
    await search.fill('jose');
    await picker.getByText('Away during this shift').waitFor();
    await shot('away-row');
    await search.fill('halli');
    await picker.getByRole('checkbox',{name:'Select Halli Johnson from Belgrade'}).check();
    await search.fill('avery');
    await picker.getByRole('checkbox',{name:'Select Avery Stone from Bozeman'}).check();
    await search.fill('volunteer 001');
    assert(await picker.getByText(/Selected \(2\).*hidden by current search or filters/).isVisible());
    await shot('selected-hidden');
    await picker.getByText(/Selected \(2\)/).click();
    await picker.getByRole('button',{name:'Remove Avery Stone from selection'}).click();
    assert(await picker.getByText(/Selected \(1\)/).isVisible());
    await search.fill('avery');
    await picker.getByRole('button',{name:'Preview Avery Stone from Bozeman'}).click();
    const dialog=page.getByRole('dialog',{name:'Scheduling preview for Avery Stone'});
    assert(await dialog.getByText('Security', {exact:false}).isVisible());
    assert.equal(await dialog.getByText(/@|Emergency|Phone|Email/).count(),0,'no private contact fields');
    await shot('quick-preview');
    await dialog.getByRole('button',{name:'Close volunteer preview'}).click();
    await search.fill('nobody-matches-this');
    await picker.getByText('No volunteers match this search.').waitFor();
    await shot('no-results');
    await picker.getByRole('button',{name:'Clear search'}).click();
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),160);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
    await page.goto(base+'/admin/picker-1252?mode=repeat',{waitUntil:'networkidle'});
    const repeat=page.getByRole('region',{name:'Assign volunteers'});
    await repeat.getByText('Available all 5 days · No known conflicts').first().waitFor();
    assert(await repeat.getByText('Away 3 of 5 shifts').isVisible());
    assert(await repeat.getByText('Usual work days: 1 of 5 selected days').isVisible());
    assert(await repeat.getByText('1 overlapping assignment across 5 days').count()>=1);
    await shot('multi-day-summary');
    await repeat.getByText('Filters',{exact:true}).click();
    await repeat.getByRole('combobox',{name:'Availability filter'}).selectOption('limited');
    assert.equal(await repeat.getByRole('checkbox',{name:/Select /}).count(),1,'usual-day filter');
    await repeat.getByRole('button',{name:'Clear all filters'}).click();
    await repeat.getByRole('searchbox',{name:'Search volunteers to assign'}).fill('halli');
    await repeat.getByRole('checkbox',{name:'Select Halli Johnson from Belgrade'}).check();
    await repeat.getByText('Adjust individual days (optional)').click();
    assert(await repeat.getByRole('checkbox',{name:/Skip Tue, Oct 6/}).isVisible(),'day exceptions preserved');
    await page.goto(base+'/admin/picker-1252?mode=existing',{waitUntil:'networkidle'});
    const existing=page.getByRole('region',{name:'Assign volunteers'});
    await existing.getByRole('checkbox',{name:'Also assign on other dates'}).check();
    await existing.getByRole('checkbox',{name:/Oct 6.*Night Watch/}).check();
    await existing.getByRole('searchbox',{name:'Search volunteers to assign'}).fill('hallie');
    await existing.getByRole('checkbox',{name:'Select Hallie Johnson from Bozeman'}).check();
    assert(await existing.getByText(/Selected \(1\)/).isVisible(),'existing and additional dates use shared picker');
    if(label==='mobile'){
      const nav=page.getByRole('navigation',{name:'Primary admin navigation'});
      await existing.getByRole('button',{name:'Preview Hallie Johnson from Bozeman'}).click();
      const sheet=page.getByRole('dialog',{name:'Scheduling preview for Hallie Johnson'});
      const box=await sheet.boundingBox();const navBox=await nav.boundingBox();
      assert(box&&navBox&&box.y+box.height<=height,'preview sheet fits mobile viewport');
      await sheet.getByRole('button',{name:'Close volunteer preview'}).click();
    }
    assert.deepEqual(errors,[],'no browser errors');
    await context.close();
    console.log(`PASS ${label}: search, filters, selection, preview, empty state, large roster and layout`);
  }
}finally{await browser.close();server.kill();}
