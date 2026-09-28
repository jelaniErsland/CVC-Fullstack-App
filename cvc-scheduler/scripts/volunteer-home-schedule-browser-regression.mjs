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
const item=(id:string,title:string,date:string,status:string)=>({assignmentReference:id,taskTitle:title,taskType:'general',scheduleKind:'timed',startDate:date,endDate:null,startTime:'07:30',endTime:'12:00',neededCount:2,scheduleNotes:'Instructions for '+id+'.\\n\\nBring your usual work clothing.',currentResponseStatus:status,responseNote:null,canConfirm:status!=='confirmed',canDecline:true,responseLocked:false,responseLockReason:null,activeAssignedCount:2,confirmedCount:1,declinedCount:0,followUpContact:{displayName:null,email:null,phone:null}});
export default async function Page({searchParams}:{searchParams:Promise<{state?:string}>}){
const {state='one'}=await searchParams;
const one=item('assignment-one','Gate welcome','2026-10-06','confirmed');
const rest=[item('assignment-two','Material staging and equipment preparation for the west entrance','2026-10-07','needs_response'),item('assignment-three','Site cleanup','2026-10-08','needs_response'),item('assignment-four','Gate welcome','2026-10-09','declined'),item('assignment-five','Final equipment check','2026-10-10','confirmed')];
let upcoming=state==='none'||state==='past'?[]:state==='one'?[one]:[one,...rest];
if(state==='two') upcoming=[one,{...rest[0],currentResponseStatus:'confirmed'}];
if(state==='many') upcoming=[{...one,currentResponseStatus:'needs_response',canConfirm:true},...rest,...Array.from({length:4},(_,i)=>item('assignment-extra-'+i,'Additional work '+(i+1),'2026-10-'+(11+i),'confirmed'))];
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
  const schedule=()=>page.getByRole('region',{name:'Additional upcoming assignments',exact:true});
  const next=()=>page.getByRole('region',{name:'Next assignment',exact:true});
  const agenda=()=>page.getByRole('region',{name:'Upcoming agenda',exact:true});
  const noOverflow=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Horizontal overflow');
  const closeSheet=async()=>{await page.getByRole('button',{name:'Close assignment details',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});};
  await page.addInitScript(() => {
    const original = window.scrollTo.bind(window);
    window.__scheduleScrolls = [];
    window.scrollTo = (...args) => { window.__scheduleScrolls.push(args[0]); original(...args); };
  });
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:width<768?844:1000});
    for(const state of ['one','two','multiple','many','none','past','long','long-additional','duplicate','priority','same-day']){
      await page.emulateMedia({reducedMotion:state==='two'?'reduce':'no-preference'});
      await go(state);await noOverflow();
      const lunch=page.getByRole('region',{name:'Lunch and weekly menu'});
      assert(await lunch.isVisible());assert(await page.getByRole('region',{name:'Availability and away periods'}).isVisible());
      if(['one','multiple'].includes(state)&&(!before||[390,1440].includes(width)))await page.screenshot({path:path.join(gallery,`${before?'before':'after'}-${state}-${width}.png`),fullPage:true,animations:'disabled'});
      if(!before&&state==='long'&&width===320)await page.screenshot({path:path.join(gallery,'after-long-320.png'),fullPage:true,animations:'disabled'});
      if(before)continue;
      assert.equal(await agenda().count(),0,'There must be no separate Coming up section');
      assert.equal(await page.getByText('Coming up',{exact:true}).count(),0);
      assert.equal(await next().locator('details').count(),0,'Old home schedule disclosure remains');
      assert.equal(await page.getByText('View full schedule (1)',{exact:true}).count(),0);
      const more=['two','multiple','many','priority','same-day','long-additional'].includes(state);
      const toggle=next().getByRole('button',{name:'View full schedule',exact:true});
      assert.equal(await toggle.count(),more?1:0);
      assert.equal(await page.getByRole('button',{name:'View full schedule',exact:true}).count(),more?1:0,'A second schedule destination remains');
      if(state==='none'||state==='past'){
        assert(await next().getByText('No upcoming assignments yet.',{exact:false}).isVisible());
        assert.equal(await schedule().count(),0);continue;
      }
      const details=next().getByRole('button',{name:/View assignment details/});
      const title=state==='long'?'AccessibleVolunteerEntranceEquipmentPreparationAndSafetyCheckWithAnUnusuallyLongTaskName':state==='priority'?'Material staging and equipment preparation for the west entrance':'Gate welcome';
      const titleBox=await details.getByText(title,{exact:true}).boundingBox(),actionBox=await details.getByText('View assignment details',{exact:true}).boundingBox();
      assert(Math.abs(titleBox.x-actionBox.x)<0.5,'Details label must align with the task title');
      assert((await details.boundingBox()).height>=44);
      await details.focus();await page.keyboard.press('Enter');
      const dialog=page.getByRole('dialog');await dialog.waitFor();
      assert.equal(await dialog.getByRole('heading',{level:2}).innerText(),title);
      const close=dialog.getByRole('button',{name:'Close assignment details',exact:true});
      const closeBox=await close.boundingBox();assert(closeBox.x>=0&&closeBox.x+closeBox.width<=width);
      await close.focus();for(let tab=0;tab<6;tab++){await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));}
      await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await details.evaluate(el=>el===document.activeElement));
      if(!more){
        const n=await next().boundingBox(),l=await lunch.boundingBox();assert(l.y>=n.y+n.height&&l.y-(n.y+n.height)<35,'Lunch should follow Next naturally');continue;
      }
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      assert.equal(await next().locator('#volunteer-inline-schedule button').count(),0,'Collapsed rows must be removed');
      const collapsedLunchY=await lunch.evaluate(el=>el.getBoundingClientRect().top+window.scrollY);
      assert((await toggle.boundingBox()).height>=44);
      await toggle.focus();await page.keyboard.press('Enter');
      const hide=next().getByRole('button',{name:'Hide full schedule',exact:true});
      await schedule().waitFor();assert.equal(await hide.getAttribute('aria-expanded'),'true');
      assert(await hide.evaluate(el=>el===document.activeElement),'Expansion should keep focus on its toggle');
      assert(await schedule().evaluate(el=>el.previousElementSibling?.getAttribute('aria-controls')===el.id),'Rows must follow the toggle directly');
      await page.waitForFunction(() => {
        const last=window.__scheduleScrolls.at(-1);if(!last)return false;
        const limit=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
        return Math.abs(window.scrollY-Math.min(last.top,limit))<2;
      });
      const scroll=await page.evaluate(()=>window.__scheduleScrolls.at(-1));
      assert.equal(scroll.behavior,state==='two'?'instant':'smooth');
      const hb=await hide.boundingBox(),sb=await schedule().boundingBox();
      assert(hb.y>=0&&hb.y<Math.max(210,(width<768?844:1000)*0.65),'Next context/toggle should remain in comfortable view');
      assert(Math.abs(sb.y-(hb.y+hb.height)-8)<2,'Inline rows must start immediately below the toggle: '+JSON.stringify({state,width,hb,sb}));
      const l=await lunch.boundingBox();assert(l.y>=sb.y+sb.height,'Lunch must follow expanded schedule');
      const expandedLunchY=await lunch.evaluate(el=>el.getBoundingClientRect().top+window.scrollY);
      assert(expandedLunchY>collapsedLunchY,'Expansion must push subsequent content down');
      await noOverflow();
      const ids=['two','long-additional'].includes(state)?['assignment-two']:state==='priority'?['assignment-one','assignment-three','assignment-four','assignment-five']:['assignment-two','assignment-three','assignment-four','assignment-five',...(state==='many'?Array.from({length:4},(_,i)=>'assignment-extra-'+i):[])];
      const cards=schedule().locator('button').filter({has:page.locator('svg.lucide-calendar-days')});
      assert.equal(await cards.count(),ids.length,'All remaining upcoming assignments must be shown');
      assert.equal(await schedule().getByText('Next assignment',{exact:true}).count(),0);
      if(['multiple','many','long-additional'].includes(state))await page.screenshot({path:path.join(gallery,`after-${state}-expanded-${width}.png`),fullPage:true,animations:'disabled'});
      for(let i=0;i<ids.length;i++){
        const card=cards.nth(i);assert((await card.boundingBox()).height>=44);
        assert(await card.evaluate(el=>getComputedStyle(el).borderRadius!=='0px'&&!!el.querySelector('svg')),'Compact assignments should be cards with the shared calendar icon');
        await card.click();await dialog.waitFor();
        await dialog.locator('summary').filter({hasText:'Assignment details'}).click();
        assert(await dialog.getByText('Instructions for '+ids[i]+'.',{exact:false}).isVisible(),'Incorrect assignment identity: '+ids[i]);
        await closeSheet();assert(await card.evaluate(el=>el===document.activeElement),'Compact card focus was not restored');
      }
      await hide.focus();await page.keyboard.press('Space');await toggle.waitFor();
      assert.equal(await toggle.getAttribute('aria-expanded'),'false');
      assert(await toggle.evaluate(el=>el===document.activeElement));
      assert.equal(await schedule().count(),0);assert.equal(await next().locator('#volunteer-inline-schedule button').count(),0);
      assert.equal(await page.evaluate(()=>window.__scheduleScrolls.length),1,'Collapse must not trigger a second scroll');
      await noOverflow();
    }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(posted,[],'Opening details/schedule must not submit any request');
  console.log(before?`Before screenshots captured from ${baseline} with synthetic data; no provider/mutation requests.`:'Volunteer home browser regression passed: one/two/many/empty/past/long/duplicate/priority/same-day at 320/390/768/1440; inline all-upcoming cards, exact sheets, smooth/reduced-motion scroll, page order, keyboard/focus and zero mutation/provider requests.');
}finally{
  await browser?.close();
  if(server?.pid){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else server.kill('SIGTERM');}
  // Remove only this script's verified unique temp tree; its dependency junction is unlinked first.
  if(existsSync(path.join(temporary,'node_modules')))unlinkSync(path.join(temporary,'node_modules'));
  rmSync(temporary,{recursive:true,force:true,maxRetries:8,retryDelay:500});
}
