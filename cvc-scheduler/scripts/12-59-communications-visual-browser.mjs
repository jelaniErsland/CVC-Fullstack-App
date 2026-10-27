// LOCAL production-mode visual proof. The fixture server rejects hosted HTTP/TCP.
// All history is synthetic; no provider/worker/scheduler is invoked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { fixture, q, sql, value } from './12-47-local-fixtures.mjs';
import { reminderFingerprint } from './reminder-database-local-fixture.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

const baseline=process.argv.includes('--baseline');
const largeReview=process.argv.includes('--large-review');
const output=path.resolve(process.env.COMMUNICATIONS_VISUAL_EVIDENCE_DIR??`../previews/12-59-communications/${baseline?'before':'after'}`);
fs.mkdirSync(output,{recursive:true});
const f=await fixture(true);let browser,server,stdout='',stderr='';
const results=[];
const reset=()=>sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null;`);
try{
 reset();
 f.items.forEach((id,i)=>sql(`update public.calendar_items set start_date=current_date+50+${i} where id=${q(id)};`));
 sql(`update public.assignment_responses set response_status='confirmed',responded_at=now() where workspace_id=${q(f.ws)};
 update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=now()-interval '10 days';
 insert into public.assignment_reminder_enrollments(assignment_id,workspace_id,volunteer_id,response_status,response_baseline,start_at)
 select a.id,a.workspace_id,a.volunteer_profile_id,'confirmed',now(),public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,'America/Denver') from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id where a.workspace_id=${q(f.ws)};
 insert into public.assignment_reminder_occurrences(workspace_id,assignment_id,volunteer_id,kind,occurrence_key,due_at,start_at,enrolled_at)
 select e.workspace_id,e.assignment_id,e.volunteer_id,'shift','shift:'||d,public.assignment_reminder_local_offset(e.start_at,'America/Denver',-d),e.start_at,now() from public.assignment_reminder_enrollments e cross join unnest(array[30,14,7,3,1])d where e.workspace_id=${q(f.ws)};
 with chosen as(select id,row_number()over(order by id)n from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)} order by id limit 5)
 insert into public.assignment_reminder_events(occurrence_id,workspace_id,event,happened_at,due_at,attempt)
 select o.id,o.workspace_id,case c.n when 1 then 'sent' when 2 then 'failed' when 3 then 'unknown' when 4 then 'claimed' else 'excluded' end,now()-interval '2 hours',o.due_at,1 from chosen c join public.assignment_reminder_occurrences o on o.id=c.id;`);
 // Create ordinary Communications history through the existing local ledger,
 // finalizing simulated results without calling any transport.
 const plan={kind:'welcome',mode:'new',volunteerIds:[]},op=randomUUID();
 const review=JSON.parse(value(f.auth(`select public.review_communications(${q(f.ws)},${q(JSON.stringify(plan))})`)));
 value(f.auth(`select public.confirm_communication_operation(${q(f.ws)},${q(op)},${q(JSON.stringify(plan))},${q(review.fingerprint)})`));
 const recipients=JSON.parse(value(f.auth(`select public.read_communication_history(${q(f.ws)})`)));
 for(const [i,r]of recipients.entries()){
  const claim=JSON.parse(value(f.auth(`select public.claim_communication_recipient(${q(r.recipient_id)},false)`)));
  value(f.auth(`select public.finalize_communication_recipient(${q(claim.recipientId)},${q(claim.claimId)},${q(i===2?'failed':'sent')},${i===2?'null':q('simulated-local-result')},${i===2?q('provider_rejected'):'null'})`));
 }
 // UTC date differs from Denver; grouping and row formatting must agree.
 sql(`update public.communication_operations set created_at=(current_date::text||'T00:30:00Z')::timestamptz where id=${q(op)};`);
 server=spawn(process.execPath,['scripts/reminder-workspace-browser.mjs','--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
 server.stdout.on('data',x=>stdout+=x);server.stderr.on('data',x=>stderr+=x);
 await new Promise((resolve,reject)=>{const timer=setInterval(()=>{if(stdout.includes('REMINDER_UI_READY')){clearInterval(timer);resolve();}else if(server.exitCode!==null){clearInterval(timer);reject(new Error(stderr.slice(-2000)));}},50);setTimeout(()=>{clearInterval(timer);reject(new Error('Local fixture server timeout'));},30000).unref();});
 browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
 for(const width of largeReview?[1440,1920,2560]:[320,390,430,768,1280,1440,1920,2560]){
  const context=await browser.newContext({viewport:{width,height:960},timezoneId:'Pacific/Auckland',reducedMotion:'reduce'});
  let external=0;const errors=[];
  await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():(external++,route.abort()));
  await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/admin/announcements',{waitUntil:'networkidle'});
  const before=reminderFingerprint(),geometry=[],accessibility=[];
  if(process.env.COMMUNICATIONS_AXE_PATH)await page.addScriptTag({path:process.env.COMMUNICATIONS_AXE_PATH});
  const audit=async name=>{
   if(!baseline&&process.env.COMMUNICATIONS_AXE_PATH){
    const result=await page.evaluate(async()=>{const r=await window.axe.run({include:['[role="tablist"]','[role="tabpanel"]:not([hidden])']},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return{violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),passes:r.passes.length};});
    accessibility.push({name,...result});assert.deepEqual(result.violations,[],`${width}px ${name} accessibility`);
   }
  };
  const capture=async name=>{if(largeReview?name==='reminders-summary':[390,1280].includes(width))await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});};
  const measure=async name=>{
   const g=await page.evaluate(()=>{const rect=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height};};return{heading:rect(document.querySelector('h1')),tabs:rect(document.querySelector('[role="tablist"]')),tabCells:[...document.querySelectorAll('[role="tab"]')].map(rect),panel:rect([...document.querySelectorAll('[role="tabpanel"]')].find(e=>!e.hidden)),overflow:document.documentElement.scrollWidth>innerWidth};});
   assert(!g.overflow,`${width} ${name} overflow`);geometry.push({name,...g});
  };
  for(const [label,name]of [['Welcome emails','welcome'],['Schedule deliveries','schedule'],['Automatic reminders','reminders-summary'],['Delivery history','delivery-history']]){
   await page.getByRole('tab',{name:new RegExp('^'+label)}).click();await measure(name);await capture(name);
   if(!baseline){
    assert(await page.getByRole('tab',{selected:true}).evaluate(e=>{const panel=document.getElementById(e.getAttribute('aria-controls'));return !!panel&&!panel.hidden;}),'Selected tab controls a visible panel');
    await audit(name);
   }
  }
  await page.getByRole('tab',{name:/^Automatic reminders/}).click();
  const reminder=page.getByRole('region',{name:'Automatic reminders',exact:true});
  await reminder.getByRole('button',{name:'View reminders',exact:true}).click();await reminder.locator('li').first().waitFor();
  await capture('reminders-upcoming');await audit('reminders-upcoming');assert.equal(await reminder.locator('li').count(),25);
  await reminder.getByRole('button',{name:'History',exact:true}).click();await reminder.getByText('Unknown — needs review',{exact:true}).waitFor();await capture('reminders-history');await audit('reminders-history');
  assert.equal(await reminder.locator('li').count(),5);
  assert.equal(await reminder.getByRole('button',{name:/send now|resend|turn on|pause|retry failed/i}).count(),0);
  assert.equal(reminderFingerprint(),before,'Visual browsing must not mutate local public/Auth data');
  assert.equal(external,0);assert.deepEqual(errors,[]);
  if(!baseline){
   assert.equal((await page.getByRole('tab',{name:'Automatic reminders',exact:true}).innerText()).trim(),'Automatic reminders','No redundant status pill in navigation');
   for(const g of geometry){
    for(const key of ['heading','tabs','panel'])assert(Math.abs(g[key].x-geometry[0][key].x)<0.5,`${width} ${key} x shifted`);
    for(const key of ['tabs','panel'])assert(Math.abs(g[key].w-geometry[0][key].w)<0.5,`${width} ${key} width shifted`);
    assert(Math.abs(g.tabs.y-geometry[0].tabs.y)<0.5);assert(Math.abs(g.tabs.h-geometry[0].tabs.h)<0.5);
   }
   for(const el of await page.locator('[role="tab"],section[aria-label="Automatic reminders"] button,section[aria-label="Automatic reminders"] summary,section[aria-label="Automatic reminders"] input').all())if(await el.isVisible())assert((await el.boundingBox()).height>=43.9,'44px touch target');
   await page.getByRole('tab',{name:/^Automatic reminders/}).focus();await page.keyboard.press('ArrowRight');await page.getByRole('heading',{name:'Delivery history',exact:true}).waitFor();
   assert(await page.getByRole('tab',{name:'Delivery history',exact:true}).evaluate(e=>e===document.activeElement));
   await page.keyboard.press('Home');assert(await page.getByRole('tab',{name:'Welcome emails',exact:true}).evaluate(e=>e===document.activeElement));
   await page.keyboard.press('End');assert(await page.getByRole('tab',{name:'Delivery history',exact:true}).evaluate(e=>e===document.activeElement));
   // Presentation-only timezone contract. Fixture/browser clock is Auckland.
   const group=page.locator('[data-communication-operation-date]').first();await group.waitFor();
   const rowDate=page.locator('[data-communication-delivery-time]').first();
   assert.equal(await group.getAttribute('data-communication-operation-date'),await rowDate.getAttribute('data-project-date'));
  }
  results.push({width,geometry,accessibility,noWrites:true,noProviderCalls:true,externalRequests:external,errors});
  await context.close();console.log(`PASS ${width}px ${baseline?'baseline recorded':'stable frame, keyboard, timezone, 44px targets'} / read-only local fixture`);
 }
 fs.writeFileSync(path.join(output,largeReview?'large-review-proof.json':'tab-switch-proof.json'),JSON.stringify(results,null,2)+'\n');
}finally{
 await browser?.close();if(server){server.stdin.end('stop');await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill();resolve();},5000);server.once('exit',()=>{clearTimeout(timer);resolve();});});}
 reset();await f.cleanup();
}
