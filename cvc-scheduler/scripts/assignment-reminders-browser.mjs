import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { fixture, sql, value, q } from './12-47-local-fixtures.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';
import { buildReminderMessage } from '../lib/notifications/assignmentReminders.ts';
const f=await fixture(true);let browser;
const output=path.resolve(process.env.REMINDER_EVIDENCE_DIR??'../previews/12-57-reminders');fs.mkdirSync(output,{recursive:true});
try {
 const id=value(`select id from public.calendar_assignments where calendar_item_id=${q(f.items[0])} and volunteer_profile_id=${q(f.volunteers[0])}`);
 sql(`update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null;
 update public.assignment_responses set response_status='declined',responded_at=now() where workspace_id=${q(f.ws)} and assignment_id in(select id from public.calendar_assignments where volunteer_profile_id=${q(f.volunteers[1])});`);
 const ctx=JSON.parse(value(`select public.assignment_reminder_context(${q(id)},now())`));
 browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
 for(const width of [1280,390]) {
  const context=await browser.newContext({viewport:{width,height:900}});let forbidden=0;
  await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():(forbidden++,route.abort()));
  await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const page=await context.newPage();let posts=0;page.on('request',r=>{if(r.method()==='POST')posts++;});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/admin/announcements',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'Communications',exact:true}).waitFor();
  const before=posts;assert.equal(await page.getByRole('heading',{name:'Preview if activated now'}).count(),0);
  const ledgerBefore=value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)}`);
  await page.locator('summary').filter({hasText:'Automatic reminders'}).click();
  await page.getByRole('heading',{name:'Preview if activated now'}).waitFor();
  assert.equal(posts,before+1);assert.equal(value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)}`),ledgerBefore);
  assert((await page.locator('body').innerText()).includes('Delivery disabled · Phase A'));
  const panel=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Automatic reminders'})});
  assert((await panel.innerText()).includes('Hypothetical planning'));
  assert((await panel.innerText()).includes('Would enroll'));
  assert((await panel.innerText()).includes('Starts '));
  assert((await panel.innerText()).includes('***@'));
  await panel.locator('summary').filter({hasText:'Excluded'}).click();
  assert((await panel.innerText()).includes('Volunteer declined'));
  assert.equal(value(`select delivery_enabled::text||'|'||(baseline_at is null)||'|'||(select count(*) from public.assignment_reminder_occurrences) from public.assignment_reminder_activation`),'false|true|0');
  const openedPosts=posts;
  await panel.locator('summary').filter({hasText:'Automatic reminders'}).click();
  await panel.locator('summary').filter({hasText:'Automatic reminders'}).click();
  await page.getByRole('heading',{name:'Preview if activated now'}).waitFor();assert.equal(posts,openedPosts);
  await page.getByRole('button',{name:'Refresh reminder preview',exact:true}).click();
  await page.getByRole('button',{name:'Refresh reminder preview',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Send reminder/i}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(output,`communications-${width}.png`),fullPage:true});
  assert.equal((await page.request.post('http://localhost:3000/internal/reminders')).status(),401);
  await page.route('**/admin/announcements',route=>route.request().method()==='POST'?route.abort():route.continue());
  await page.getByRole('button',{name:'Refresh reminder preview',exact:true}).click();
  await page.getByRole('alert').filter({hasText:/Reminder (history|preview)/}).waitFor();
  await page.unroute('**/admin/announcements');await page.getByRole('button',{name:'Retry preview',exact:true}).click();
  await page.getByRole('button',{name:'Refresh reminder preview',exact:true}).waitFor();
  assert.deepEqual(errors,[]);assert.equal(forbidden,0);
  // Recorded history stays distinct from hypothetical enrollment. Simulate an
  // unknown outcome using owner-only local clock helpers, never a provider.
  sql(`update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=now()-interval '1 day';
    update public.assignment_responses set response_status='confirmed',responded_at=now() where assignment_id=${q(id)};
    select public.sync_assignment_reminder(${q(id)},now());`);
  const occurrence=JSON.parse(value(`select jsonb_build_object('id',id,'due',due_at) from public.assignment_reminder_occurrences where assignment_id=${q(id)} and occurrence_key='shift:3'`));
  const claim=JSON.parse(value(`select public.claim_assignment_reminder(${q(occurrence.id)},${q(occurrence.due)})`));
  value(`select public.finalize_assignment_reminder(${q(claim.recipientId)},${q(claim.claimId)},'unknown',null,${q(occurrence.due)})`);
  sql('update public.assignment_reminder_activation set delivery_enabled=false');
  const recordedBefore=value(`select count(*)||'|'||(select count(*) from public.assignment_reminder_events where workspace_id=${q(f.ws)}) from public.communication_recipients where workspace_id=${q(f.ws)}`);
  await page.getByRole('button',{name:'Refresh reminder preview',exact:true}).click();
  await page.getByRole('button',{name:'Refresh reminder preview',exact:true}).waitFor();
  await panel.locator('summary').filter({hasText:'Existing occurrences'}).click();
  await panel.locator('summary').filter({hasText:'Recorded: unknown'}).click();
  assert((await panel.innerText()).includes('Automatic retry blocked; reconcile provider outcome.'));
  assert.equal(value(`select count(*)||'|'||(select count(*) from public.assignment_reminder_events where workspace_id=${q(f.ws)}) from public.communication_recipients where workspace_id=${q(f.ws)}`),recordedBefore);
  sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};delete from public.communication_recipients where workspace_id=${q(f.ws)};delete from public.communication_operations where workspace_id=${q(f.ws)};
    update public.assignment_responses set response_status='needs_response',responded_at=null where assignment_id=${q(id)};
    update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null;`);
  for(const key of ['pending:1','shift:30','shift:14','shift:7','shift:3','shift:1']) {
    const m=buildReminderMessage({...ctx,kind:key.startsWith('shift')?'shift':'response',occurrenceKey:key,insideCutoff:key==='pending:1'},'https://projectlocal.app');
    await page.setContent(m.html);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.getByRole('link',{name:'View assignment'}).getAttribute('href'),'https://projectlocal.app/');
    await page.screenshot({path:path.join(output,`email-${key.replace(':','-')}-${width}.png`),fullPage:true});
    if(width===390)fs.writeFileSync(path.join(output,`email-${key.replace(':','-')}.html`),m.html);
  }
  await context.close();console.log(`PASS ${width}px reminder history, read-only lazy preview, failure/retry, private endpoint and templates`);
 }
} finally {
 await browser?.close();sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null,scan_cursors='{}'`);await f.cleanup();
}
console.log('PASS browser; external network blocked; zero provider calls');
