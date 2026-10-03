import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

const root = process.cwd();
const fixture = path.join(os.tmpdir(), 'project-local-12-48-fixture');
const output = path.resolve('..', 'previews', '12.51a-volunteer-filter');
fs.mkdirSync(output, { recursive: true });
execFileSync(process.execPath, ['scripts/12-48-preview.mjs'], { cwd: root, stdio: 'inherit' });
const fixturePath = path.join(fixture, 'fixture.ts');
fs.appendFileSync(fixturePath, `
export function volunteerFilterCalendar(params:any){
  const base=calendar(params,false);
  const id=(n:number)=>'33333333-3333-4333-8333-'+String(n).padStart(12,'0');
  const people=[
    {id:id(1),displayName:'Halli Johnson',congregation:'North'},
    {id:id(2),displayName:'Hallie Johnson',congregation:'South'},
    {id:id(3),displayName:'Halli Johnson',congregation:'East'},
    {id:id(4),displayName:'Avery Stone',congregation:null},
  ];
  const assigned=(itemId:string,person:number,status:string)=>({assignmentId:id(20+person),calendarItemId:itemId,volunteerProfileId:id(person),volunteerDisplayName:people[person-1].displayName,volunteerCongregation:people[person-1].congregation,responseStatus:status,volunteerLifecycle:'active',volunteerReadinessStatus:'ready',volunteerEmailAvailable:false,volunteerPhoneAvailable:false,volunteerPreferredContactMethod:null,volunteerProfileNotes:null});
  const item=(n:number,name:string,date:string,endDate:string,start:string,end:string,person:number,status:string)=>{
    const itemId=id(10+n),a=assigned(itemId,person,status);
    return {...base.items[2],id:itemId,displayName:name,date,endDate,startTimeValue:start,endTimeValue:end,startTime:start==='17:00'?'5:00 PM':'8:00 AM',endTime:end==='05:00'?'5:00 AM':'10:00 AM',meal:null,oneOffTask:{...base.items[2].oneOffTask,name},assignments:[a],assignedVolunteerIds:[a.volunteerProfileId],filledCount:status==='declined'?0:1,neededCount:1};
  };
  const work=[
    item(1,'Site preparation','2026-10-05','2026-10-05','08:00','10:00',1,'confirmed'),
    item(2,'Night Watch','2026-10-05','2026-10-06','17:00','05:00',1,'confirmed'),
    item(3,'Gate welcome','2026-10-06','2026-10-06','08:00','10:00',2,'confirmed'),
    item(4,'Cleanup crew','2026-10-06','2026-10-06','08:00','10:00',1,'declined'),
    item(5,'Equipment check','2026-10-05','2026-10-05','08:00','10:00',3,'confirmed'),
  ];
  return {...base,items:[...base.items.filter((entry:any)=>entry.meal),...work],assignmentPicker:params.date==='2026-10-08'?{kind:'error',reason:'query_unavailable'}:{kind:'ready',volunteers:people.map(p=>({id:p.id,displayName:p.displayName,congregation:p.congregation,lifecycle:'active',readinessStatus:'ready',emailAvailable:false,phoneAvailable:false,preferredContactMethod:null,profileNotes:null})),assignments:work.flatMap(w=>w.assignments)}};
}
`);
const routePath = path.join(fixture, 'app', 'admin', 'calendar', 'page.tsx');
let routeSource = fs.readFileSync(routePath, 'utf8');
routeSource = routeSource.replace("import {calendar,assignedCalendar,destinations}", "import {calendar,assignedCalendar,volunteerFilterCalendar,destinations}");
routeSource = routeSource.replace("const state=c.get('fixture-assignments')?.value==='1'?assignedCalendar", "const state=c.get('fixture-volunteer-filter')?.value==='1'?volunteerFilterCalendar(p):c.get('fixture-assignments')?.value==='1'?assignedCalendar");
fs.writeFileSync(routePath, routeSource);
const pickerRoute = path.join(fixture, 'app', 'admin', 'picker-preview', 'page.tsx');
fs.mkdirSync(path.dirname(pickerRoute), { recursive: true });
fs.writeFileSync(pickerRoute, `
import { AdminShell } from '@/components/AdminShell';
import { BulkAssignmentPlanner } from '@/components/BulkAssignmentPlanner';
import { destinations } from '@/fixture';
import { expandRepeatDates } from '@/lib/calendar/repeat';
const id=(n:number)=>'44444444-4444-4444-8444-'+String(n).padStart(12,'0');
const volunteers=[
  {id:id(1),displayName:'Halli Johnson',congregation:'North',lifecycle:'active',readinessStatus:'ready'},
  {id:id(2),displayName:'Hallie Johnson',congregation:'South',lifecycle:'active',readinessStatus:'ready'},
  {id:id(3),displayName:'Halli Johnson',congregation:'East',lifecycle:'active',readinessStatus:'ready'},
  {id:id(4),displayName:'Avery Stone',congregation:'West',lifecycle:'active',readinessStatus:'ready'},
  {id:id(5),displayName:'José Rivera',congregation:null,lifecycle:'active',readinessStatus:'ready'},
  {id:id(6),displayName:'Ineligible Person',congregation:'North',lifecycle:'active',readinessStatus:'pending'},
];
async function preview(form:FormData){
  'use server';
  const plan=JSON.parse(String(form.get('plan')||'{}'));
  const dates=plan.create?expandRepeatDates(plan.create.startDate,plan.create.endDate,plan.create.weekdays):['2026-10-05',...(plan.itemIds.length>1?['2026-10-06']:[])];
  return {kind:'preview' as const,preview:{saved:false as const,fingerprint:'fixture-only',items:dates.map((date:string,index:number)=>({id:plan.create?null:plan.itemIds[index]??plan.itemIds[0],date,title:'Night Watch',startTime:'17:00',endTime:'05:00',neededCount:6,assignedCount:0,publication:'published'})),volunteers:plan.volunteers.map((person:{id:string})=>({id:person.id,name:volunteers.find(v=>v.id===person.id)?.displayName||'Volunteer',version:'fixture'})),existingAssignments:[],sameDayWork:[]}};
}
export default async function Page({searchParams}:{searchParams:Promise<{mode?:string}>}){
  const {mode}=await searchParams;
  const create=mode==='existing'?undefined:{presetId:null,title:'Night Watch',taskType:'general',startDate:'2026-10-05',endDate:mode==='repeat'?'2026-10-06':'2026-10-05',weekdays:mode==='repeat'?[1,2]:[1],startTime:'17:00',endTime:'05:00',neededCount:6,notes:null,customValues:{},meal:null};
  return <AdminShell active="calendar" destinations={await destinations()} workspaceName="Community remodel · Fixture"><main className="mx-auto max-w-2xl px-3 py-5 sm:px-6"><h1 className="text-2xl font-bold">Calendar assignment preview</h1><p className="mt-1 text-sm text-slate-600">Local fixture. No assignments or email are saved.</p><BulkAssignmentPlanner action={preview} volunteers={volunteers} create={create} primaryItem={mode==='existing'?{id:id(10),date:'2026-10-05',title:'Night Watch',startTime:'17:00',endTime:'05:00'}:undefined} otherItems={mode==='existing'?[{id:id(11),date:'2026-10-06',title:'Night Watch',startTime:'17:00',endTime:'05:00'}]:[]}/></main></AdminShell>;
}
`);

const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(SUPABASE|RESEND|EMAIL|TRANSPORT|TOKEN|SECRET)/i.test(key)));
Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:1', NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-only', ADMIN_AUTH_MODE:'enforced', ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'' });
const server = spawn(process.execPath, [path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3151'], { cwd:fixture, env, stdio:'ignore', windowsHide:true });
const base='http://127.0.0.1:3151';
async function waitForServer(){ for(let n=0;n<90;n++){try{const r=await fetch(base+'/admin/calendar?view=month&date=2026-10-05');if(r.ok)return;}catch{} await new Promise(resolve=>setTimeout(resolve,1000));}throw new Error('Fixture server did not start'); }
const browser=await chromium.launch({headless:true,executablePath:resolvePreviewBrowserExecutable()});
try {
  await waitForServer();
  for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    await context.addCookies([{name:'fixture-volunteer-filter',value:'1',url:base}]);
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/admin/calendar?view=month&date=2026-10-05',{waitUntil:'networkidle'});
    const shot=async name=>page.screenshot({path:path.join(output,`${label}-${name}.png`)});
    await shot('unfiltered-month');
    assert(await page.getByText('Night Watch').count()>0);
    await page.getByRole('button',{name:'Open calendar filters'}).click();
    const dialog=page.getByRole('dialog',{name:'Calendar filters'}).filter({visible:true});
    await dialog.waitFor();await page.waitForTimeout(250);await shot('search-open');
    await dialog.getByRole('searchbox',{name:'Volunteer name'}).fill('halli john');
    assert.equal(await dialog.getByRole('button',{name:/Halli Johnson/}).count(),2);
    await page.waitForTimeout(250);await shot('search-results');
    await dialog.getByRole('button',{name:/Halli Johnson.*North/}).click();
    await page.getByRole('button',{name:'Remove volunteer filter for Halli Johnson · North'}).waitFor();
    assert(!(await page.getByTestId('calendar-workspace-header').innerText()).includes('Halli Johnson'),'header summary does not repeat the filter chip');
    await page.waitForTimeout(250);
    await shot('filtered-month');
    assert.equal(await page.getByText('Gate welcome').count(),0);
    assert.equal(await page.getByText('Equipment check').count(),0);
    for(const view of ['Week','List','Day','Month']){
      await page.getByRole('button',{name:view,exact:true}).filter({visible:true}).first().click();
      await page.waitForURL(url=>url.searchParams.get('view')===view.toLowerCase());
      await page.getByRole('button',{name:view,exact:true,pressed:true}).filter({visible:true}).first().waitFor();
      await page.getByRole('button',{name:'Remove volunteer filter for Halli Johnson · North'}).waitFor();
      if(view==='List') await page.getByTestId('calendar-list-view').filter({visible:true}).waitFor();
      if(view==='List'||view==='Day') { await page.waitForTimeout(250); await shot(`filtered-${view.toLowerCase()}`); }
    }
    await page.getByRole('button',{name:'Day',exact:true}).filter({visible:true}).first().click();
    await page.waitForURL(url=>url.searchParams.get('view')==='day');
    await page.getByRole('button',{name:'Day',exact:true,pressed:true}).filter({visible:true}).first().waitFor();
    const before=new URL(page.url()).searchParams.get('date');
    await page.getByRole('button',{name:'Next day'}).click();
    await page.waitForURL(url=>url.searchParams.get('date')!==before);
    await page.getByRole('button',{name:'Remove volunteer filter for Halli Johnson · North'}).waitFor();
    assert(await page.getByText('Night Watch').count()>0,'overnight item on next day');
    await page.getByRole('button',{name:'Next day'}).click();
    await page.getByText('No assignments for Halli Johnson in this day').waitFor();
    await shot('empty-day');
    await page.getByRole('button',{name:'Next day'}).click();
    await page.getByText('Volunteer assignments are unavailable for this range.').waitFor();
    await page.getByRole('button',{name:'Remove volunteer filter for Halli Johnson · North'}).click();
    assert.equal(await page.getByText('Filtered by: Halli Johnson').count(),0);
    await page.getByRole('button',{name:'Previous day'}).click();
    await page.waitForURL(url=>url.searchParams.get('date')==='2026-10-07');
    await page.getByRole('button',{name:'Open calendar filters'}).click();
    const emptyDialog=page.getByRole('dialog',{name:'Calendar filters'}).filter({visible:true});
    await emptyDialog.getByRole('searchbox',{name:'Volunteer name'}).fill('avery');
    assert.equal(await emptyDialog.getByRole('button',{name:/Avery Stone/}).count(),1,'unique partial match');
    await emptyDialog.getByRole('button',{name:/Avery Stone/}).click();
    await page.getByText('No assignments for Avery Stone in this day').waitFor();
    await page.getByRole('button',{name:'Remove volunteer filter for Avery Stone'}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
    assert.deepEqual(errors,[],'no browser errors');
    await context.close();
    console.log(`PASS: ${label} search, selection, all views, dates, overnight, empty state, clear, layout`);
  }
  for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/admin/picker-preview',{waitUntil:'networkidle'});
    const picker=page.getByRole('region',{name:'Assign volunteers'});
    const search=picker.getByRole('searchbox',{name:'Search volunteers to assign'});
    const shot=async name=>page.screenshot({path:path.join(output,`${label}-picker-${name}.png`)});
    await shot('before-search');
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),5,'only eligible candidates');
    await search.fill('HALLI JOHN');
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),3,'partial, case-insensitive and similar names');
    await shot('several-matches');
    await picker.getByRole('checkbox',{name:'Select Halli Johnson from North'}).check();
    await search.fill('avery');
    assert(await picker.getByText('Ready volunteers · 1 selected').isVisible());
    assert(await picker.getByText('Selected: Halli Johnson · North').isVisible());
    await shot('selected-different-search');
    await picker.getByRole('checkbox',{name:'Select Avery Stone from West'}).check();
    await search.fill('jose');
    assert(await picker.getByText('Ready volunteers · 2 selected').isVisible());
    await picker.getByRole('checkbox',{name:'Select José Rivera'}).check();
    await search.fill('no-such-name');
    await picker.getByText('No volunteers match this search.').waitFor();
    assert(await picker.getByText('Ready volunteers · 3 selected').isVisible());
    await shot('no-results');
    await picker.getByRole('button',{name:'Clear search'}).click();
    assert.equal(await picker.getByRole('checkbox',{name:/Select /}).count(),5);
    for(const name of ['Select Halli Johnson from North','Select Avery Stone from West','Select José Rivera']) assert(await picker.getByRole('checkbox',{name}).isChecked());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'picker horizontal overflow');
    if(label==='mobile'){
      await page.setViewportSize({width,height:520});
      await search.focus();
      const lastChoice=picker.getByRole('checkbox',{name:'Select José Rivera'});
      await lastChoice.scrollIntoViewIfNeeded();
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      const choiceBox=await lastChoice.boundingBox();
      const navigationBox=await page.getByRole('navigation',{name:'Primary admin navigation'}).boundingBox();
      assert(choiceBox&&navigationBox&&choiceBox.y+choiceBox.height<navigationBox.y,'focused search keeps candidate controls above bottom navigation in a reduced viewport');
      await page.setViewportSize({width,height});
    }
    await page.goto(base+'/admin/picker-preview?mode=repeat',{waitUntil:'networkidle'});
    const repeat=page.getByRole('region',{name:'Assign volunteers'});
    assert(await repeat.getByText(/^2 scheduled days:/).isVisible(),'repeat uses the same picker');
    await repeat.getByRole('searchbox',{name:'Search volunteers to assign'}).fill('halli');
    await repeat.getByRole('checkbox',{name:'Select Halli Johnson from East'}).check();
    assert(await repeat.getByText('Ready volunteers · 1 selected').isVisible());
    await page.goto(base+'/admin/picker-preview?mode=existing',{waitUntil:'networkidle'});
    const existing=page.getByRole('region',{name:'Assign volunteers'});
    await existing.getByRole('checkbox',{name:'Also assign on other dates'}).check();
    await existing.getByRole('checkbox',{name:/Oct 6.*Night Watch/}).check();
    await existing.getByRole('searchbox',{name:'Search volunteers to assign'}).fill('hallie');
    await existing.getByRole('checkbox',{name:'Select Hallie Johnson from South'}).check();
    assert(await existing.getByText('Ready volunteers · 1 selected').isVisible(),'existing and additional dates use the same picker');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'existing picker overflow');
    assert.deepEqual(errors,[],'no browser errors');
    await context.close();
    console.log(`PASS: ${label} assignment search, selection persistence, repeat, existing/additional dates, eligibility and layout`);
  }
} finally { await browser.close(); server.kill(); }
