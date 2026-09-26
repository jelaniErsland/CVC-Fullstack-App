// Isolated frontend preview. Copies current components; replaces data loaders only
// in a temporary app. No application env files, proxy, or real actions copied.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
const root=process.cwd(), target=path.join(os.tmpdir(),'project-local-12-48-fixture');
const write=(name,body)=>{const p=path.join(target,name);fs.mkdirSync(path.dirname(p),{recursive:true});if(!fs.existsSync(p)||fs.readFileSync(p,'utf8')!==body)fs.writeFileSync(p,body);};
fs.mkdirSync(target,{recursive:true});
const photoSvg=`<svg width="1600" height="600" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#789bab"/><stop offset="1" stop-color="#ead6ad"/></linearGradient></defs><rect width="1600" height="600" fill="url(#sky)"/><path d="M0 330 220 170 460 340 740 105 1020 355 1290 155 1600 350V600H0Z" fill="#506e72"/><path d="M0 420 260 320 550 445 800 290 1200 420 1600 315V600H0Z" fill="#70917d"/><path d="M0 530Q450 380 850 490T1600 445V600H0Z" fill="#6d815b"/><rect x="900" y="305" width="415" height="270" fill="#d6cbb6"/><path d="M850 330 1110 180 1370 330Z" fill="#694d3e"/><rect x="970" y="360" width="115" height="110" fill="#718d93"/><rect x="1140" y="365" width="105" height="95" fill="#718d93"/><rect x="480" y="300" width="250" height="270" fill="#bfac8d"/><path d="M430 320 605 205 780 320Z" fill="#5d5148"/><rect x="548" y="387" width="110" height="183" fill="#725c47"/><path d="M0 540Q500 510 950 550T1600 510V600H0Z" fill="#997957"/></svg>`;
await sharp(Buffer.from(photoSvg)).resize(1600,600).webp({quality:82}).toFile(path.join(target,'public','fixture-project-photo.webp'));
write('.gitignore','node_modules/\n.next/\n');
for(const name of ['components','lib','hooks','public']) fs.cpSync(path.join(root,name),path.join(target,name),{recursive:true});
if(!fs.existsSync(path.join(target,'node_modules'))) fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
for(const name of ['package.json','tsconfig.json','postcss.config.mjs']) fs.copyFileSync(name,path.join(target,name));
write('next.config.mjs',`export default { devIndicators: false, experimental: { externalDir: true } };`);
write('app/globals.css',fs.readFileSync('app/globals.css','utf8')+'\n@source "../components";\n@source "../app";\n@source "../lib";\n');
write('app/layout.tsx',fs.readFileSync('app/layout.tsx','utf8'));
write('app/admin/needs-attention/actions.ts',`"use server"; export async function getNeedsAttentionUnseenCountAction(){return 0;}`);
write('fixture.ts',`
import { cookies } from 'next/headers';
import { summarizeOverviewCalendar, buildOverviewQuickActions } from './lib/overview/routeRead.server';
import { defaultPhoto } from './lib/projectPhoto/photo';
import { adminDestinations } from './lib/adminNavigation';
const fullCapabilities=['workspace.read','calendar.view','assignments.view','calendar.edit','assignments.edit','tasks.view','tasks.edit','volunteers.view','volunteers.edit'];
export async function destinations(){const role=(await cookies()).get('fixture-role')?.value;return adminDestinations(role==='on-site'?fullCapabilities.filter(c=>!c.endsWith('.edit')):fullCapabilities);}
export const day='2026-10-05';
export const items=[0,1,2,3,4].map((i)=>({
  id:'11111111-1111-4111-8111-'+String(i+1).padStart(12,'0'), projectId:'fixture', displayName:i===0?'Breakfast':i===1||i===4?'Lunch':'Site preparation',
  date:i<2?day:i===4?'2026-10-07':'2026-10-06', startTime:i===1||i===4?'12:00 PM':'8:00 AM',endTime:i===1||i===4?'1:00 PM':'11:00 AM',
  startTimeValue:i===1||i===4?'12:00':'08:00',endTimeValue:i===1||i===4?'13:00':'11:00',category:i===0||i===1||i===4?'Food':'Construction',colorKey:i===0||i===1||i===4?'gold':'blue',
  assignedVolunteerIds:[],assignments:[],filledCount:0,neededCount:i===0||i===1||i===4?0:3,status:'Open',publicationState:'published',canPublish:false,
  oneOffTask:{name:i===0?'Breakfast':i===1||i===4?'Lunch':'Site preparation',category:i===0||i===1||i===4?'Food':'Construction',neededCount:i===0||i===1||i===4?0:3,customFields:[]},
  initialAssignmentNotification:{kind:'unavailable',emailConfigured:false},followUpContactSelfEdit:{kind:'not_current_contact'},
  meal:i===0?{kind:'breakfast',menu:null,provider:null,total:null,contact:'Avery Stone'}:i===1?{kind:'lunch',menu:'Garden sandwiches and fruit',provider:'Local meal team',total:0,contact:null}:i===4?{kind:'lunch',menu:'Garden sandwiches and fruit',provider:'Local meal team',total:25,contact:'Jordan Hale'}:null
}));
export async function overview(){const c=await cookies();const empty=c.get('fixture-empty')?.value==='1';const varied=c.get('fixture-review-varied')?.value==='1';const reviewItems=varied?[...items,{...items[2],id:'11111111-1111-4111-8111-000000000006',displayName:'Window framing',date:'2026-10-08',neededCount:2},{...items[2],id:'11111111-1111-4111-8111-000000000007',displayName:'Safety briefing',date:'2026-10-09',neededCount:1}]:items;return {
  kind:'ready',navigationDestinations:await destinations(),workspaceName:'Community remodel · Fixture',workspaceTimezone:'America/Denver',workspaceStartsOn:'2026-09-29',workspaceEndsOn:'2026-12-04',today:day,
  calendar:{kind:'ready',value:summarizeOverviewCalendar(empty?[]:reviewItems.map(i=>({
    calendarItemId:i.id,taskSourceLabel:i.displayName,startDate:i.date,endDate:null,startTime:i.startTimeValue,endTime:i.endTimeValue,timezone:'America/Denver',
    lifecycle:'active',publicationState:'published',assignedFractionLabel:i.meal?'0/0 assigned':'0/3 assigned',meal:i.meal,
    coverage:{deniedCount:0,unassignedCount:i.neededCount,waitingOnConfirmationCount:0}
  })) as any,day,'2026-10-12')},tasks:{kind:'ready',value:{activeCount:empty?0:1}},volunteers:{kind:'ready',value:{readyActiveCount:0}},
  actions:buildOverviewQuickActions(['calendar.view','assignments.view','calendar.edit','tasks.view','tasks.edit','volunteers.view','volunteers.edit'],day),createTask:c.get('fixture-role')?.value!=='on-site',isEmpty:empty
};}
export async function photo(){const c=await cookies();return {photo:c.get('fixture-photo')?.value==='1'?{asset_id:'22222222-2222-4222-8222-222222222222',version:1,desktop_x:55,desktop_y:55,mobile_x:65,mobile_y:52,uploads_enabled:true}:defaultPhoto,canEdit:c.get('fixture-photo-edit')?.value==='1'};}
export async function attention(){return {kind:'ready',workspaceName:'Community remodel · Fixture',summary:{totalSignalCount:(await cookies()).get('fixture-empty')?.value==='1'?0:3,truncated:false}};}
export function calendar(params:any,readOnly:boolean){return {kind:'ready_with_items',navigationDestinations:['overview','calendar','volunteers','needs-attention','tasks','announcements','quick-view'],workspaceName:'Community remodel · Fixture',projectStartsOn:'2026-09-29',projectEndsOn:'2026-12-04',
  view:params.view??'month',anchorDate:params.date??day,queriedRange:{rangeStart:'2026-09-01',rangeEnd:'2026-12-05',bounded:true,periodKind:params.view??'month',anchorDate:params.date??day,rangeSemantics:'server_derived_start_inclusive_end_exclusive'},
  items,canEdit:!readOnly,canEditAssignments:!readOnly,canViewVolunteers:true,canViewTaskPresets:!readOnly,taskPresetSelector:{kind:'ready_empty',presets:[]},assignmentPicker:{kind:'ready',volunteers:[],assignments:[]},
  projectDayDetails:params.day?{date:params.day,publishedScheduleCount:2}:null};}
export function assignedCalendar(params:any,readOnly:boolean,visibility:string){
  const base=items[2];
  const names=['Avery Stone','Jordan Hale','Casey Morgan','Riley Chen','Taylor Brooks','Sam Rivera'];
  const specs=[['Site preparation',0,'08:00',day],['Gate welcome',1,'09:00',day],['Food-service shift',3,'10:00',day],['Cleanup crew',6,'11:00',day],['Gate welcome',1,'09:00','2026-10-06']];
  const work=specs.map(([title,count,start,date],index)=>{
    const id='22222222-2222-4222-8222-'+String(index+1).padStart(12,'0');
    const assignments=names.slice(0,Number(count)).map((name,n)=>({assignmentId:id+'-'+n,calendarItemId:id,volunteerProfileId:'fixture-person-'+n,volunteerDisplayName:index===4?'Morgan Reed':name,responseStatus:n===2?'declined':n===1?'needs_response':'confirmed',volunteerCongregation:'PRIVATE congregation',volunteerEmailAvailable:false,volunteerPhoneAvailable:false,volunteerProfileNotes:'PRIVATE notes'}));
    return {...base,id,displayName:title,oneOffTask:{...base.oneOffTask,name:title},date,startTimeValue:start,endTimeValue:'12:00',startTime:Number(String(start).slice(0,2))+':00 AM',endTime:'12:00 PM',filledCount:assignments.filter(a=>a.responseStatus!=='declined').length,neededCount:6,assignments:visibility==='hidden'?[]:assignments,assignedVolunteerIds:assignments.map(a=>a.volunteerProfileId)};
  });
  return {...calendar(params,readOnly),items:[...items.filter(i=>i.meal),...work],canViewVolunteers:visibility!=='hidden',assignmentPicker:visibility==='unavailable'?{kind:'error',reason:'query_unavailable'}:{kind:'ready',volunteers:[],assignments:[]}};
}
`);
let dashboard=fs.readFileSync('app/admin/dashboard/page.tsx','utf8');
dashboard=dashboard.replace(/import \{ readAdminProjectPhoto \} from [^;]+;/,'import { photo as readAdminProjectPhoto } from "@/fixture";')
 .replace(/import \{ readNeedsAttentionRouteState \} from [^;]+;/,'import { attention as readNeedsAttentionRouteState } from "@/fixture";')
 .replace(/import \{ readOverviewRouteState \} from [^;]+;/,'import { overview as readOverviewRouteState } from "@/fixture";');
write('app/admin/dashboard/page.tsx',dashboard);
write('app/v/project-photo/[asset]/[size]/route.ts',`import {readFileSync} from 'node:fs';import {join} from 'node:path';
export async function GET(_request:Request,{params}: {params:Promise<{asset:string;size:string}>}){const p=await params;if(p.asset!=='22222222-2222-4222-8222-222222222222'||!['desktop','mobile'].includes(p.size))return new Response('Not found',{status:404});return new Response(readFileSync(join(process.cwd(),'public','fixture-project-photo.webp')),{headers:{'Content-Type':'image/webp','Cache-Control':'no-store'}});}`);
for(const route of ['/admin/calendar','/admin/quick-view','/qv']) write('app'+route+'/page.tsx',`
import CalendarClient from '@/components/CalendarClient';import {calendar,assignedCalendar,destinations} from '@/fixture';import {cookies} from 'next/headers';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:any){const p=await searchParams;const c=await cookies();const role=c.get('fixture-role')?.value;const readOnly=${route!='/admin/calendar'} || role==='on-site';const state=c.get('fixture-assignments')?.value==='1'?assignedCalendar(p,readOnly,c.get('fixture-assignment-visibility')?.value??'available'):calendar(p,readOnly);return <CalendarClient routeBase="${route}" readOnly={${route!='/admin/calendar'}} projectKey={${route==='/admin/quick-view'?'"fixture-project"':'undefined'}} state={{...state,navigationDestinations:await destinations()} as any}/>;}`);
for(const [route,title] of [['tasks','Task library'],['volunteers','Volunteers'],['needs-attention','Attention'],['announcements','Communications']]) write('app/admin/'+route+'/page.tsx',`import {AdminShell} from '@/components/AdminShell';import {destinations} from '@/fixture';export default async function Page(){return <AdminShell active="${route}" destinations={await destinations()} workspaceName="Community remodel · Fixture"><h1>${title}</h1><p>Navigation destination fixture. Workflow not simulated.</p></AdminShell>}`);
write('app/admin/tasks/page.tsx',`import {TaskPresetManagement} from '@/components/TaskPresetManagement';import {AdminShell} from '@/components/AdminShell';import {destinations} from '@/fixture';import {cookies} from 'next/headers';
async function fixtureAction(_data:FormData){'use server';}
export default async function Page({searchParams}: {searchParams:Promise<{create?:string}>}){const p=await searchParams;const canEdit=(await cookies()).get('fixture-role')?.value!=='on-site';return <AdminShell active="tasks" destinations={await destinations()} workspaceName="Community remodel · Fixture"><TaskPresetManagement presets={[]} workspaceName="Community remodel · Fixture" canEdit={canEdit} initialCreateOpen={canEdit&&p.create==='1'} notice={null} createAction={fixtureAction} archiveAction={fixtureAction} updateColorAction={fixtureAction}/></AdminShell>;}`);
write('app/guide/page.tsx',`export default function Page(){return <h1>Contact Guide destination fixture</h1>}`);
write('app/foundation/page.tsx',`"use client";
import {useState} from 'react';import {AdminShell} from '@/components/AdminShell';import {PageHeader} from '@/components/PageHeader';import {Panel,SectionHeader} from '@/components/Panel';import {Field,FieldGroup} from '@/components/Field';import {Button} from '@/components/Button';import {IconButton} from '@/components/IconButton';import {ActionMenu} from '@/components/ActionMenu';import {DisclosureSection} from '@/components/DisclosureSection';import {InlineNotice} from '@/components/InlineNotice';import {Skeleton} from '@/components/Skeleton';import {StatusBadge} from '@/components/StatusBadge';import {X} from 'lucide-react';
export default function Page(){const [submitted,setSubmitted]=useState(false),[value,setValue]=useState(''),[day,setDay]=useState(false),[pending,setPending]=useState(false);
const error=submitted&&!value?'Enter a task name.':undefined;return <AdminShell active="tasks" destinations={['overview','calendar','volunteers','needs-attention','tasks','announcements','quick-view']} workspaceName="Component fixtures only"><div className="mx-auto max-w-2xl space-y-6"><PageHeader title="Shared controls" description="Isolated form fixture. Nothing is saved or sent." secondaryActions={<ActionMenu label="More example actions" items={[{label:'Reset example form',confirm:'Clear the example values?',onSelect:()=>{setSubmitted(false);setValue('');setDay(false);}}]}/>}/><DisclosureSection summary="Optional guidance · when to create a task">Use a clear name and choose the work days before assigning volunteers.</DisclosureSection><Panel><SectionHeader title="Task details" action={<IconButton label="Clear form" onClick={()=>{setSubmitted(false);setValue('');setDay(false);}}><X aria-hidden className="size-5"/></IconButton>}/><form noValidate className="space-y-6 p-4 sm:p-6" onSubmit={e=>{e.preventDefault();setSubmitted(true);if(!value){document.getElementById('task-name')?.focus();return;}if(!day)return;setPending(true);setTimeout(()=>setPending(false),500);}}><Field id="task-name" label="Task name" required hint="Use a name the team will recognize." value={value} onChange={e=>setValue(e.target.value)} error={error}/><Field id="category" label="Category" options={['General volunteers','Food','Security']}/><FieldGroup id="days" legend="Work days" error={submitted&&!day?'Choose at least one day.':undefined}><label className="flex min-h-11 items-center gap-3 text-base"><input type="checkbox" checked={day} onChange={e=>setDay(e.target.checked)} className="size-5"/>Monday</label></FieldGroup><div className="flex flex-wrap gap-3"><Button pending={pending} pendingLabel="Checking…">Check form</Button><Button type="button" variant="secondary" onClick={()=>setSubmitted(false)}>Cancel</Button><Button type="button" variant="destructive" disabled>Remove task</Button></div></form></Panel><InlineNotice title="Example validation" tone="info">Errors appear after Check form. Required fields keep their labels.</InlineNotice><div className="flex flex-wrap gap-2">{(['needs_response','confirmed','declined','draft','published'] as const).map(status=><StatusBadge key={status} status={status}/>)}</div><Skeleton label="Loading example" rows={1}/></div></AdminShell>}
`);
console.log('Prepared isolated frontend fixture app. No production credentials or mutation routes.');
if(process.argv.includes('--serve')) {
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(SUPABASE|RESEND|EMAIL|TRANSPORT|TOKEN|SECRET)/i.test(k)));
  Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:1',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-only',ADMIN_AUTH_MODE:'enforced',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:''});
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3148'],{cwd:target,env,stdio:'inherit',windowsHide:true});
  child.on('exit',code=>process.exitCode=code);
}
