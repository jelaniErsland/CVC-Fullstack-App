// Real local production-mode app; disposable fixtures, no external requests/providers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { fixture, sql, value, q } from './12-47-local-fixtures.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';
import { buildReminderMessage } from '../lib/notifications/assignmentReminders.ts';
const f=await fixture(true);let browser;
const output=path.resolve(process.env.REMINDER_EVIDENCE_DIR??'../previews/12-57b-reminders');fs.mkdirSync(output,{recursive:true});
const actionManifest=JSON.parse(fs.readFileSync('.next/server/server-reference-manifest.json','utf8'));
const previewActions=new Set(Object.entries({...actionManifest.node,...actionManifest.edge}).filter(([,entry])=>entry.exportedName==='readReminderPreview'||Object.values(entry.workers??{}).some(worker=>worker.exportedName==='readReminderPreview')).map(([id])=>id));assert(previewActions.size>0,'Production build must identify the existing preview action');
const id=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} and volunteer_profile_id=${q(f.volunteers[0])}`);
const reset=()=>sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};delete from public.communication_recipients where workspace_id=${q(f.ws)};delete from public.communication_operations where workspace_id=${q(f.ws)};update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null;`);
try {
 reset();sql(`update public.assignment_responses set response_status='declined',responded_at=now() where workspace_id=${q(f.ws)} and assignment_id in(select id from public.calendar_assignments where volunteer_profile_id=${q(f.volunteers[1])});update public.assignment_responses set response_status='confirmed',responded_at=now() where assignment_id=${q(id)};`);
 const ctx=JSON.parse(value(`select public.assignment_reminder_context(${q(id)},now())`));
 browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
 for(const width of [320,390,430,768,1280,1920]) {
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Pacific/Auckland'});let forbidden=0;
  await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():(forbidden++,route.abort()));
  await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const page=await context.newPage();let posts=0,previewReads=0;const errors=[];page.on('request',r=>{if(r.method()==='POST'){posts++;if(previewActions.has(r.headers()['next-action']))previewReads++;}});page.on('pageerror',e=>errors.push(e.message));
  const screenshot=async name=>{await page.locator('h1').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});await page.screenshot({path:path.join(output,`${name}-${width}-viewport.png`)});};
  await page.goto('http://localhost:3000/admin/announcements',{waitUntil:'networkidle'});
  const tabs=page.getByRole('tablist',{name:'Communications sections'}),reminderTab=tabs.getByRole('tab',{name:/Automatic reminders/});
  const labels=await tabs.getByRole('tab').allTextContents();assert.equal(labels.length,4);for(const [i,label]of ['Welcome emails','Schedule deliveries','Automatic reminders','Delivery history'].entries())assert(labels[i].startsWith(label));
  assert.equal(await page.getByRole('region',{name:'Automatic reminders',exact:true}).count(),0,'No separate reminder strip above tabs');
  const initialPosts=posts;assert.equal(previewReads,0,'Entering Communications never reads reminder preview');await screenshot('welcome-tab');
  await tabs.getByRole('tab',{name:'Schedule deliveries',exact:true}).click();await page.getByRole('heading',{name:'Send schedules',exact:true}).waitFor();await screenshot('schedule-tab');
  await tabs.getByRole('tab',{name:'Delivery history',exact:true}).click();await page.getByRole('heading',{name:'Delivery history',exact:true}).waitFor();await screenshot('delivery-history-tab');
  await tabs.getByRole('tab',{name:'Delivery history',exact:true}).focus();await page.keyboard.press('Home');assert.equal(await tabs.getByRole('tab',{name:/Welcome emails/}).getAttribute('aria-selected'),'true');await page.keyboard.press('End');await page.keyboard.press('ArrowLeft');
  assert.equal(await reminderTab.getAttribute('aria-selected'),'true');assert((await reminderTab.innerText()).includes('Off'));assert.equal(posts,initialPosts,'Tab selection never runs preview');
  for(const tab of await tabs.getByRole('tab').all())assert((await tab.boundingBox()).height>=44);
  await page.reload({waitUntil:'networkidle'});await reminderTab.locator('[class]').first().waitFor();await page.waitForFunction(()=>document.querySelector('[role=tab][aria-selected=true]')?.textContent.includes('Automatic reminders'));assert.equal(previewReads,0,'Remembered tab refresh never runs preview');
  await page.goto('http://localhost:3000/admin/announcements?kind=history',{waitUntil:'networkidle'});assert.equal(await tabs.getByRole('tab',{name:'Delivery history',exact:true}).getAttribute('aria-selected'),'true');
  await page.goto('http://localhost:3000/admin/announcements?kind=reminders',{waitUntil:'networkidle'});assert.equal(await reminderTab.getAttribute('aria-selected'),'true');await page.goBack({waitUntil:'networkidle'});assert.equal(await tabs.getByRole('tab',{name:'Delivery history',exact:true}).getAttribute('aria-selected'),'true');await page.goForward({waitUntil:'networkidle'});assert.equal(await reminderTab.getAttribute('aria-selected'),'true');assert.equal(previewReads,0,'Deep link/history uses no preview read');
  if(width===390||width===1280){
   await tabs.getByRole('tab',{name:'Delivery history',exact:true}).click();await page.route('**/admin/announcements?kind=reminders',route=>route.request().method()==='POST'?route.abort():route.continue());
   await page.getByRole('button',{name:'Refresh history',exact:true}).click();await page.getByRole('button',{name:'Retry delivery history',exact:true}).waitFor();await screenshot('history-error-tab');
   await reminderTab.click();assert.equal(await page.getByRole('button',{name:'Retry delivery history',exact:true}).count(),0);assert(await page.getByRole('button',{name:'Preview reminders',exact:true}).isVisible());
   await page.unroute('**/admin/announcements?kind=reminders');await tabs.getByRole('tab',{name:'Delivery history',exact:true}).click();await page.getByRole('button',{name:'Retry delivery history',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-communication-history-state="ready"]'));await reminderTab.click();
  }
  const panel=page.getByRole('region',{name:'Automatic reminders',exact:true});await panel.waitFor();
  assert.equal(await panel.getByRole('heading',{name:'Preview reminders',exact:true}).isVisible(),false);
  assert(await panel.getByText('Off',{exact:true}).isVisible());assert((await panel.innerText()).includes('not currently being sent'));
  const before=posts,ledgerBefore=value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)}`);
  await screenshot('off');
  await panel.getByRole('button',{name:'Preview reminders',exact:true}).focus();await page.keyboard.press('Enter');
  await panel.getByRole('heading',{name:'Preview reminders',exact:true}).waitFor();await panel.getByRole('button',{name:'Refresh preview',exact:true}).waitFor();assert.equal(posts,before+1);
  assert.equal(previewReads,1,'Only Preview reminders invokes the authorized reminder read');
  assert(await panel.getByRole('button',{name:'Close preview',exact:true}).evaluate(button=>button===document.activeElement),'Keyboard focus stays on the preview control after loading');
  assert((await panel.innerText()).includes('If reminders were turned on now'));
  assert((await panel.innerText()).includes('does not schedule or send anything'));
  assert((await panel.innerText()).includes('America/Denver'));assert((await panel.innerText()).includes('***@'));
  assert((await panel.getByRole('heading',{name:'Still need to respond',exact:true}).locator('..').innerText()).includes('2'));
  assert((await panel.getByRole('heading',{name:'Confirmed assignments',exact:true}).locator('..').innerText()).includes('1'));
  assert.equal(value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)}`),ledgerBefore);
  assert.equal(value("select delivery_enabled::text||'|'||(baseline_at is null)||'|'||(select count(*) from public.assignment_reminder_occurrences) from public.assignment_reminder_activation"),'false|true|0');
  await panel.locator('summary').filter({hasText:'Excluded'}).click();assert((await panel.innerText()).includes('Volunteer declined'));
  await panel.locator('summary').filter({hasText:'Reminder history'}).click();assert((await panel.innerText()).includes('No reminders have been sent yet.'));
  await panel.locator('summary').filter({hasText:'Reminder timing'}).click();assert((await panel.innerText()).includes('Every 3 days at 9:00 AM'));assert((await panel.innerText()).includes('5:00 PM the day before'));
  assert(!/Phase A|baseline|enroll|occurrence|policy version|worker disabled/i.test(await panel.innerText()));
  assert.equal(await panel.getByRole('button',{name:/^(Turn on|Activate|Send reminder|Enable reminder)/i}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const button of await panel.getByRole('button').all()){if(await button.isVisible())assert((await button.boundingBox()).height>=44);}
  await screenshot('preview');
  const openedPosts=posts;await panel.getByRole('button',{name:'Close preview',exact:true}).click();await panel.getByRole('button',{name:'Preview reminders',exact:true}).click();assert.equal(posts,openedPosts);
  await tabs.getByRole('tab',{name:/Welcome emails/}).click();assert.equal(await panel.count(),0);await reminderTab.click();await panel.getByRole('heading',{name:'Preview reminders',exact:true}).waitFor();assert.equal(posts,openedPosts,'Switching tabs retains preview in memory without reading again');
  await page.route('**/admin/announcements*',route=>route.request().method()==='POST'?route.abort():route.continue());
  await panel.getByRole('button',{name:'Refresh preview',exact:true}).click();await panel.getByRole('alert').waitFor();assert((await panel.innerText()).includes('previous preview is still shown'));
  await screenshot('error');
  await page.unroute('**/admin/announcements*');await panel.getByRole('button',{name:'Retry preview',exact:true}).click();await panel.getByRole('button',{name:'Refresh preview',exact:true}).waitFor();
  // Local-only future On presentation and recorded outcome; no provider adapter.
  sql(`update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=now();select public.sync_assignment_reminder(${q(id)},now());`);
  await panel.getByRole('button',{name:'Refresh preview',exact:true}).click();await panel.getByRole('heading',{name:'Reminder schedule and history',exact:true}).waitFor();assert(await panel.getByText('On',{exact:true}).isVisible());
  assert((await reminderTab.innerText()).includes('On'));await tabs.getByRole('tab',{name:'Delivery history',exact:true}).click();await reminderTab.click();assert((await reminderTab.innerText()).includes('On'));
  await screenshot('future-on');
  const occurrence=JSON.parse(value(`select jsonb_build_object('id',id,'due',due_at) from public.assignment_reminder_occurrences where assignment_id=${q(id)} and occurrence_key='shift:3'`));
  const claim=JSON.parse(value(`select public.claim_assignment_reminder(${q(occurrence.id)},${q(occurrence.due)})`));
  value(`select public.finalize_assignment_reminder(${q(claim.recipientId)},${q(claim.claimId)},'unknown',null,${q(occurrence.due)})`);sql('update public.assignment_reminder_activation set delivery_enabled=false');
  const recordedBefore=value(`select count(*)||'|'||(select count(*) from public.assignment_reminder_events where workspace_id=${q(f.ws)}) from public.communication_recipients where workspace_id=${q(f.ws)}`);
  await panel.getByRole('button',{name:'Refresh preview',exact:true}).click();await panel.getByRole('heading',{name:'Preview reminders',exact:true}).waitFor();
  assert((await reminderTab.innerText()).includes('Off'));
  const history=panel.locator('details').filter({has:page.locator('summary').filter({hasText:/^Reminder history/})}).first();
  if(await history.getAttribute('open')===null)await history.locator(':scope > summary').click();
  await history.locator('summary').filter({hasText:'Delivery status unknown'}).click();assert((await history.innerText()).includes('Automatic retry is paused until the outcome is known.'));
  assert.equal(value(`select count(*)||'|'||(select count(*) from public.assignment_reminder_events where workspace_id=${q(f.ws)}) from public.communication_recipients where workspace_id=${q(f.ws)}`),recordedBefore);
  assert.equal(await history.locator('summary').filter({hasText:'Delivery status unknown'}).count(),1);
  await screenshot('history');
  assert.deepEqual(errors,[]);assert.equal(forbidden,0);assert.equal((await page.request.post('http://localhost:3000/internal/reminders')).status(),401);
  reset();
  if(width===320||width===1920){
   const dates=JSON.parse(value(`select jsonb_object_agg(id,start_date) from public.calendar_items where workspace_id=${q(f.ws)}`));
   sql(`update public.calendar_items set start_date=start_date-36500,end_date=null where workspace_id=${q(f.ws)}`);await panel.getByRole('button',{name:'Refresh preview',exact:true}).click();await panel.getByText('No upcoming assignments to preview.',{exact:true}).waitFor();await screenshot('empty');
   for(const [item,day]of Object.entries(dates))sql(`update public.calendar_items set start_date=${q(day)} where id=${q(item)}`);
  }
  if(width===390||width===1280)for(const key of ['pending:1','shift:30','shift:14','shift:7','shift:3','shift:1']){
   const message=buildReminderMessage({...ctx,kind:key.startsWith('shift')?'shift':'response',occurrenceKey:key,insideCutoff:key==='pending:1'},'https://projectlocal.app');await page.setContent(message.html);assert.equal(await page.getByRole('link',{name:'View assignment'}).getAttribute('href'),'https://projectlocal.app/');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await context.close();console.log(`PASS ${width}px Off/preview counts, project clocks, keyboard/touch, no jargon/overflow, cached reopen, error/retry, recorded unknown history, future On fixture; no provider calls`);
 }
} finally {await browser?.close();reset();sql("update public.assignment_reminder_activation set scan_cursors='{}'");await f.cleanup();}
console.log('PASS 12.57B responsive browser; six widths; external requests blocked; zero real sends; disabled/NULL after fixtures');
