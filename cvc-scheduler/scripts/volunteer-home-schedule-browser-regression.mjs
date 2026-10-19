// Isolated real-component browser regression. No production routes, credentials or providers.
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,mkdirSync,symlinkSync,unlinkSync,rmSync,existsSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';

const before=process.argv.includes('--before');
const baseline='0efa0427e8cc0290ab87d70ecbafb759afdcbf7a';
const root=process.cwd(), temporary=mkdtempSync(path.join(os.tmpdir(),'project-local-home-polish-'));
assert(path.resolve(temporary).startsWith(path.resolve(os.tmpdir())+path.sep));
const gallery=path.join(root,'docs/previews/volunteer-home-schedule');
mkdirSync(gallery,{recursive:true});
const write=(name,text)=>{const target=path.join(temporary,name);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,text);};
let server,browser;
const errors=[],posted=[];
try {
  for(const name of ['components','lib','hooks'])cpSync(path.join(root,name),path.join(temporary,name),{recursive:true});
  for(const name of ['package.json','tsconfig.json','postcss.config.mjs'])cpSync(path.join(root,name),path.join(temporary,name));
  symlinkSync(path.join(root,'node_modules'),path.join(temporary,'node_modules'),'junction');
  if(before)for(const name of ['VolunteerHomeDashboard.tsx','VolunteerScheduleClient.tsx']){
    const source=spawnSync('git',['show',`${baseline}:cvc-scheduler/components/${name}`],{encoding:'utf8',windowsHide:true});
    assert.equal(source.status,0);write('components/'+name,source.stdout);
  }
  write('next.config.mjs','export default {devIndicators:false,experimental:{externalDir:true}};');
  write('app/globals.css',readFileSync('app/globals.css','utf8')+'\n@source "../components";\n@source "../app";\n');
  write('app/layout.tsx',readFileSync('app/layout.tsx','utf8'));
  write('app/v/schedule/actions.ts',`'use server'; export async function confirmAllVolunteerScheduleAction(){throw new Error('No response actions permitted in the isolated visual fixture.');} export async function submitVolunteerScheduleResponseAction(_form:FormData){throw new Error('No response actions permitted in the isolated visual fixture.');}`);
  write('app/v/schedule/home.actions.ts',`'use server'; export async function manageAwayAction(_form:FormData){throw new Error('No away writes permitted in the isolated visual fixture.');} export async function readMenuWeek(_date:string){return null;}`);
  write('app/page.tsx',`
import {VolunteerHomeDashboard} from '@/components/VolunteerHomeDashboard';
import {defaultPhoto} from '@/lib/projectPhoto/photo';
const item=(id:string,title:string,date:string,status:string)=>({assignmentReference:id,taskTitle:title,taskType:'general',scheduleKind:'timed',startDate:date,endDate:null,startTime:'07:30',endTime:'12:00',neededCount:2,scheduleNotes:'Instructions for '+id+'.\\n\\nBring your usual work clothing.',fellowWorkerNames:id==='assignment-one'?['Maria Garcia']:id==='assignment-two'?['John Smith','Maria Garcia']:[],currentResponseStatus:status,responseNote:null,canConfirm:status!=='confirmed',canDecline:true,responseLocked:false,responseLockReason:null,activeAssignedCount:2,confirmedCount:1,declinedCount:0,followUpContact:{displayName:null,email:null,phone:null}});
export default async function Page({searchParams}:{searchParams:Promise<{state?:string}>}){
const {state='one'}=await searchParams;
const one=item('assignment-one','Gate welcome','2026-10-06','confirmed');
const rest=[item('assignment-two','Material staging and equipment preparation for the west entrance','2026-10-07','needs_response'),item('assignment-three','Site cleanup','2026-10-08','needs_response'),item('assignment-four','Gate welcome','2026-10-09','declined'),item('assignment-five','Final equipment check','2026-10-10','confirmed')];
let upcoming=state==='none'||state==='past'?[]:state==='one'?[one]:[one,...rest];
if(state==='two') upcoming=[one,{...rest[0],currentResponseStatus:'confirmed'}];
if(state==='three') upcoming=[one,rest[0],rest[1]];
if(state==='many') upcoming=[{...one,currentResponseStatus:'needs_response',canConfirm:true},...rest,...Array.from({length:6},(_,i)=>item('assignment-extra-'+i,'Additional work '+(i+1),'2026-10-'+(11+i),'confirmed'))];
if(state==='dense') upcoming=[{...one,fellowWorkerNames:Array.from({length:30},(_,i)=>'Fellow Worker '+String(i+1).padStart(2,'0'))},...rest];
if(state==='multiple') upcoming=upcoming.map(a=>({...a,currentResponseStatus:a.assignmentReference==='assignment-one'?'needs_response':a.currentResponseStatus,canConfirm:a.assignmentReference==='assignment-one'||a.canConfirm}));
if(state==='same-day') upcoming=[{...one,currentResponseStatus:'needs_response',canConfirm:true},{...rest[0],taskTitle:one.taskTitle,startDate:one.startDate},...rest.slice(1)];
if(state==='long-additional')upcoming=[one,{...rest[0],taskTitle:'AccessibleVolunteerEntranceEquipmentPreparationAndSafetyCheckWithAnUnusuallyLongTaskName',currentResponseStatus:'confirmed'}];
if(state==='long')upcoming=[{...one,taskTitle:'AccessibleVolunteerEntranceEquipmentPreparationAndSafetyCheckWithAnUnusuallyLongTaskName'}];
if(state==='duplicate')upcoming=[one,{...one}];
const assignments=state==='past'?[item('assignment-past','Earlier completed work','2026-09-20','confirmed')]:state==='duplicate'?[one]:upcoming;
const home={week:'2026-10-05',photo:defaultPhoto,away:[],meals:[{kind:'lunch',date:'2026-10-06',startTime:'12:00',endTime:'13:00',menu:'Vegetable soup and fresh bread',provider:'Sample meal team'}]};
return <main className="mx-auto max-w-5xl px-5 py-5 sm:px-8 sm:py-8"><header className="mb-5 border-b border-slate-200 pb-3 text-sm font-semibold">Project Local</header><VolunteerHomeDashboard name="Alex Rivera" projectName="LDC Sample Remodel" assignments={assignments as any} upcoming={upcoming as any} initialHome={home as any} today="2026-10-05"/></main>;}
`);
  const port=await new Promise(resolve=>{const socket=net.createServer();socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});});
  const base=`http://127.0.0.1:${port}`;
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(SUPABASE|RESEND|EMAIL|TOKEN|SECRET|TRANSPORT|DATABASE|PGPASSWORD)/i.test(k)));
  Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:1',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fixture-only',ADMIN_AUTH_MODE:'enforced',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:''});
  server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:temporary,env,stdio:'pipe',windowsHide:true});
  let serverOutput='';server.stdout.on('data',x=>serverOutput+=x);server.stderr.on('data',x=>serverOutput+=x);
  let ready=false;for(let i=0;i<120&&!ready;i++){try{ready=(await fetch(base)).ok;}catch{}if(!ready)await wait(500);}
  assert(ready,'Isolated fixture failed to start: '+serverOutput.slice(-1500));
  browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
  const context=await browser.newContext();
  await context.route('**/*',route=>{const request=route.request();const url=new URL(request.url());if(request.method()!=='GET')posted.push(request.method()+' '+url.pathname);return url.origin===base?route.continue():route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const go=state=>page.goto(base+'/?state='+state,{waitUntil:'networkidle'});
  const schedule=()=>page.getByRole('region',{name:'Upcoming schedule',exact:true});
  const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Horizontal overflow');
  for(const width of [320,390,430,768,1440]){
    await page.setViewportSize({width,height:width<768?844:1000});
    for(const state of ['one','two','three','multiple','many','dense','none','past','long','long-additional','duplicate','priority','same-day']){
      await page.emulateMedia({reducedMotion:state==='two'?'reduce':'no-preference'});
      await go(state);await noOverflow();
      if(before){
        if(['one','multiple'].includes(state)&&[390,1440].includes(width))await page.screenshot({path:path.join(gallery,'before-'+state+'-'+width+'.png'),fullPage:true,animations:'disabled'});
        continue;
      }
      assert(await page.getByRole('navigation',{name:'Volunteer shortcuts'}).isVisible());
      assert(await page.getByRole('button',{name:'Lunch',exact:true}).isVisible());
      assert(await page.getByRole('button',{name:'Away',exact:true}).isVisible());
      assert(await page.getByRole('button',{name:/Map, coming soon/}).isDisabled());
      const cards=schedule().getByRole('button',{name:/View assignment details/});
      const expected=state==='none'||state==='past'?0:state==='one'||state==='long'||state==='duplicate'?1:state==='two'||state==='long-additional'?2:state==='three'?3:state==='many'?11:5;
      assert.equal(await cards.count(),expected,'All upcoming cards must be visible by default: '+state+' at '+width);
      const toggle=schedule().getByRole('button',{name:'Collapse schedule',exact:true});
      assert.equal(await toggle.count(),expected>3?1:0);
      if(expected===0)assert(await schedule().getByText('No upcoming assignments yet.',{exact:false}).isVisible());
      if(expected>0){
        assert(await cards.first().isVisible());
        if(state==='dense')assert((await cards.first().innerText()).includes('Fellow workers · Fellow Worker 01'));
        else assert(await cards.first().getByText('Fellow worker · Maria Garcia',{exact:true}).isVisible());
        await cards.first().focus();await page.keyboard.press('Enter');
        const dialog=page.getByRole('dialog');await dialog.waitFor();
        assert(await dialog.getByRole('region',{name:state==='dense'?'Fellow workers':'Fellow worker',exact:true}).isVisible());
        await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
        assert(await cards.first().evaluate(el=>el===document.activeElement));
      }
      if(expected>1)assert(await cards.nth(1).getByText('Fellow workers · John Smith, Maria Garcia',{exact:true}).isVisible());
      if(expected>3){
        assert.equal(await toggle.getAttribute('aria-expanded'),'true');
        await toggle.click();
        const show=schedule().getByRole('button',{name:'Show full schedule',exact:true});
        assert.equal(await show.getAttribute('aria-expanded'),'false');
        assert.equal(await schedule().locator('#volunteer-inline-schedule').getAttribute('aria-hidden'),'true');
        assert(await cards.nth(2).isVisible());
        assert.equal(await cards.nth(3).isVisible(),false);
        await show.click();assert(await cards.nth(3).isVisible());
      }
      if(['one','multiple','many'].includes(state)&&[390,430,1440].includes(width))await page.screenshot({path:path.join(gallery,'after-'+state+'-'+width+'.png'),fullPage:true,animations:'disabled'});
      await page.getByRole('button',{name:'Lunch',exact:true}).click();
      assert(await page.getByRole('dialog').getByRole('heading',{name:'Weekly menu'}).isVisible());
      await page.getByRole('button',{name:'Close weekly menu'}).click();
      await page.getByRole('button',{name:'Away',exact:true}).click();
      assert(await page.getByRole('dialog').getByRole('heading',{name:'Availability'}).isVisible());
      await page.getByRole('button',{name:'Close availability'}).click();
      await noOverflow();
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(posted,[],'Opening details/schedule must not submit any request');
  console.log(before?`Before screenshots captured from ${baseline} with synthetic data; no provider/mutation requests.`:'Volunteer home browser regression passed: 0/1/2/3/5/11 assignments, dense coworkers, 320/390/430/768/1440px, visible schedule, collapse, details, shortcuts, keyboard/focus, no overflow, and zero mutation/provider requests.');
}finally{
  await browser?.close();
  if(server?.pid){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else server.kill('SIGTERM');}
  // Remove only this script's verified unique temp tree; its dependency junction is unlinked first.
  if(existsSync(path.join(temporary,'node_modules')))unlinkSync(path.join(temporary,'node_modules'));
  rmSync(temporary,{recursive:true,force:true,maxRetries:8,retryDelay:500});
}
