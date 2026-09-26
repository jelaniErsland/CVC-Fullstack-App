import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { fixture, q, sql, value } from './12-47-local-fixtures.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'127.0.0.1');
assert.equal(process.env.ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT,'');
const base='http://127.0.0.1:3000';
const f=await fixture(true);
const foreign=await fixture(true);
const output=path.resolve('..','previews','12.48-batch-1','after');
const browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
const full=['workspace.read','volunteers.view','volunteers.edit','calendar.view','calendar.edit','tasks.view','tasks.edit','assignments.view','assignments.edit','questionnaires.review'];
const read=full.filter(c=>!c.endsWith('.edit'));
const setRole=(role,caps)=>sql(`update public.workspace_contact_grants set role=${q(role)},capabilities=array[${caps.map(q).join(',')}]::text[] where workspace_id=${q(f.ws)}`);
const snapshot=()=>value(`select md5(coalesce(jsonb_agg(to_jsonb(a) order by a.id)::text,'')) from public.calendar_assignments a where workspace_id=${q(f.ws)}`);
const deliveries=()=>Number(value(`select (select count(*) from public.assignment_notification_deliveries where workspace_id=${q(f.ws)})+(select count(*) from public.volunteer_welcome_deliveries where workspace_id=${q(f.ws)})`));
async function context(admin,width=1440){
  const c=await browser.newContext({viewport:{width,height:900}});
  await c.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  if(admin) await c.addCookies([...admin.jar.values()].map(x=>({name:x.name,value:x.value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})));
  return c;
}
try {
  for(const name of ['Taylor Brooks','Morgan Reed']) f.volunteers.push(value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:name,email:name.replaceAll(' ','').toLowerCase()+'@example.invalid'}))})`)));
  value(f.auth(`select public.create_calendar_assignments_batch(${q(f.items[0])},array[${f.volunteers.slice(2).map(q).join(',')}]::uuid[],null)`));
  sql(`update public.calendar_items set needed_count=6 where id=${q(f.items[0])};
    update public.assignment_responses r set response_status=case when a.volunteer_profile_id=${q(f.volunteers[0])} then 'confirmed' else 'declined' end,response_source='project_contact',responded_at=now(),updated_by_auth_user_id=${q(f.user)} from public.calendar_assignments a where r.assignment_id=a.id and a.calendar_item_id=${q(f.items[0])} and a.volunteer_profile_id in(${q(f.volunteers[0])},${q(f.volunteers[2])});
    delete from public.assignment_responses where assignment_id in(select id from public.calendar_assignments where (calendar_item_id=${q(f.items[1])} and volunteer_profile_id=${q(f.volunteers[0])}) or calendar_item_id=${q(f.items[2])});
    delete from public.calendar_assignments where calendar_item_id=${q(f.items[1])} and volunteer_profile_id=${q(f.volunteers[0])};
    delete from public.calendar_assignments where calendar_item_id=${q(f.items[2])};
    insert into public.workspace_project_photos(workspace_id,uploads_enabled) values(${q(f.ws)},true);`);
  const assignmentsBefore=snapshot();assert.equal(deliveries(),0);
  value(f.auth(`select public.save_calendar_meal(${q(f.ws)},null,'breakfast',${q(f.day)},'07:00','08:00','Fixture meal team','Alex Morgan','Breakfast',null,null,null)`));
  sql(`update public.calendar_items set meal_total=0,meal_contact=null where workspace_id=${q(f.ws)} and meal_kind='lunch' and start_date=${q(f.day)}`);
  const c=await context(f.admin),page=await c.newPage();
  const go=route=>page.goto(base+route,{waitUntil:'networkidle'});
  const card=id=>page.locator(`[data-calendar-task-item="${id}"]`);
  for(const [role,caps] of [['main_contact',full],['assistant_contact',full],['on_site_contact',read]]){
    setRole(role,caps);
    for(const route of ['/admin/calendar','/admin/quick-view']) for(const view of ['day','list']){
      await go(`${route}?view=${view}&date=${f.day}`);
      const item=card(f.items[0]);await item.waitFor();
      const text=await item.innerText();
      assert.match(text,/Alex Morgan\s+Confirmed/);assert.match(text,/Riley Chen\s+Declined/);assert.match(text,/Awaiting reply/);assert.match(text,/4\/6 assigned/);
      await item.locator('summary').click();
      for(const name of ['Alex Morgan','Casey Jordan','Riley Chen','Taylor Brooks','Morgan Reed']) assert((await item.innerText()).includes(name));
      assert.equal(await page.getByRole('dialog',{name:'Calendar item inspector'}).count(),0);
      if(role==='on_site_contact'||route.endsWith('quick-view')) assert.equal(await page.getByRole('button',{name:/^Create( item)?$/}).count(),0);
      if(route.endsWith('quick-view')) assert(!(await page.content()).includes('PRIVATE PROFILE'));
      await item.getByRole('button',{name:/Site preparation/}).click();
      const inspector=page.getByRole('dialog',{name:'Calendar item inspector'});await inspector.waitFor();
      assert.equal(new URL(page.url()).pathname,route);assert.equal(new URL(page.url()).searchParams.get('item'),f.items[0]);
      if(route.endsWith('quick-view')) assert.equal(await inspector.getByRole('button',{name:/^(Assign|Remove|Save|Publish|Send)/}).count(),0);
      await page.keyboard.press('Escape');await inspector.waitFor({state:'hidden'});
    }
    console.log(`PASS: actual Auth/RLS ${role}: Day/List rosters, response words, expansion, selection and read-only boundaries.`);
  }
  setRole('main_contact',full);
  await go(`/admin/calendar?view=day&date=${f.dayAt(1)}`);assert.match(await card(f.items[1]).innerText(),/Casey Jordan/);assert.doesNotMatch(await card(f.items[1]).innerText(),/Alex Morgan/);
  await go(`/admin/calendar?view=day&date=${f.dayAt(2)}`);assert.match(await card(f.items[2]).innerText(),/No volunteers assigned/);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});
    await go(`/admin/quick-view?date=${f.day}`);
    assert(!new URL(page.url()).searchParams.has('view'));
    assert.equal(await page.getByRole('dialog',{name:'Calendar item inspector'}).count(),0);
    const defaultText=await page.locator('body').innerText();
    for(const label of (width<640?['B—','L0','L25']:['Breakfast · —','Lunch · 0','Lunch · 25'])) assert(defaultText.includes(label),`Actual default Month exposes ${label}`);
    await page.screenshot({path:path.join(output,`authenticated-quick-view-default-${width}.png`),style:'nextjs-portal { visibility: hidden; }'});
    for(const view of ['day','list']){
      await go(`/admin/calendar?view=${view}&date=${f.day}`);
      await card(f.items[0]).scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(output,`authenticated-calendar-${view}-${width}.png`),style:'nextjs-portal { visibility: hidden; }'});
    }
  }
  // Actual route upload, replacement, protected display and stale-version guard.
  await go('/admin/dashboard');await page.getByRole('button',{name:'Add project photo',exact:true}).click();
  const bytes=await sharp({create:{width:1200,height:500,channels:3,background:'#56756b'}}).png().toBuffer();
  const upload=async()=>{
    await page.getByLabel('Choose photo').setInputFiles({name:'local-fixture.png',mimeType:'image/png',buffer:bytes});
    const response=page.waitForResponse(r=>r.url()===base+'/admin/project-photo'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Save shared photo',exact:true}).click();
    const saved=await response;assert.equal(saved.status(),200);return (await saved.json()).photo;
  };
  const first=await upload();
  await page.getByRole('button',{name:'Project photo actions',exact:true}).click();
  await page.getByRole('menuitem',{name:'Change project photo',exact:true}).click();
  const second=await upload();assert.notEqual(first.asset_id,second.asset_id);assert.equal(second.version,first.version+1);
  const assetUrl=`${base}/v/project-photo/${second.asset_id}/desktop`;
  assert.equal((await page.request.get(assetUrl)).status(),200);
  assert.equal((await page.request.get(`${base}/v/project-photo/${first.asset_id}/desktop`)).status(),404);
  assert.equal((await page.request.post(base+'/admin/project-photo',{headers:{origin:base},multipart:{command:'remove',version:String(first.version)}})).status(),409);
  for(const admin of [null,foreign.admin]){const other=await context(admin);assert.equal((await other.request.get(assetUrl)).status(),404);await other.close();}
  setRole('on_site_contact',read);await go('/admin/dashboard');
  assert.equal(await page.getByRole('button',{name:'Project photo actions',exact:true}).count(),0);
  assert.equal((await page.request.get(assetUrl)).status(),200);
  assert.equal((await page.request.post(base+'/admin/project-photo',{headers:{origin:base},multipart:{command:'remove',version:String(second.version)}})).status(),403);
  setRole('on_site_contact',read.filter(x=>x!=='volunteers.view'));
  await go(`/admin/calendar?view=day&date=${f.day}`);assert.equal(await page.getByRole('list',{name:'Assigned volunteers'}).count(),0);assert(!(await page.content()).includes('Casey Jordan'));
  await go(`/admin/quick-view?date=${f.day}`);await page.getByRole('heading',{name:'Quick View unavailable',exact:true}).waitFor();assert(!(await page.content()).includes('Casey Jordan'));
  setRole('main_contact',full);
  await go(`/admin/calendar?view=day&date=${foreign.day}&item=${foreign.items[0]}`);assert.equal(await page.getByRole('dialog',{name:'Calendar item inspector'}).count(),0);
  assert.equal(snapshot(),assignmentsBefore,'Read-only journeys must not modify assignments');assert.equal(deliveries(),0,'No notification or welcome deliveries');
  console.log('PASS: dates, actual default Quick View, desktop/mobile, photo upload/replacement/version/scoped display, missing capability and cross-workspace isolation; unchanged assignments and zero deliveries.');
  await c.close();
} finally {
  await browser.close();
  const assetRoot=path.resolve('.local','project-assets');const target=path.resolve(assetRoot,f.ws);
  assert(target.startsWith(assetRoot+path.sep)&&/^[0-9a-f-]{36}$/.test(f.ws));await fs.rm(target,{recursive:true,force:true});
  await foreign.cleanup();await f.cleanup();
  assert.equal(Number(value(`select count(*) from public.workspaces where id in(${q(f.ws)},${q(foreign.ws)})`)),0);
  console.log('PASS: disposable Auth/workspace and local photo assets cleaned up.');
}
