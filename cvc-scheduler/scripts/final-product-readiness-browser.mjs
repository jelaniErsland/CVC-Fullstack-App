import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export async function runFinalProductReview({ browser, fixture: f, applyAuthCookies, sql, baseUrl }) {
  const output = path.resolve('..', 'previews', 'final-product-readiness');
  const review1246C = path.resolve('..', 'previews', '12.46c-volunteer-polish');
  const requestedCaptures = new Set(
    (process.env.FINAL_PRODUCT_READINESS_CAPTURE_SCOPE ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
  const partialCaptureRun = requestedCaptures.size > 0;
  await mkdir(output, { recursive: true });
  await mkdir(review1246C, { recursive: true });
  const captures = [];
  const contexts = [];
  const errors = [];
  const secondProfile = randomUUID();
  const date = sql("select (current_date + 3)::text;");
  const dateEnd = sql("select (current_date + 10)::text;");
  const reset = () => sql("delete from public.volunteer_lookup_attempts where bucket <> 'global'; update public.volunteer_lookup_attempts set attempts=0,window_started_at=now() where bucket='global';");
  async function context(width, admin = false) {
    const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 1000 : 844 } });
    contexts.push(ctx);
    await ctx.route('**/*', (route) => {
      if (!['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)) {
        errors.push('Nonlocal browser request blocked');
        return route.abort();
      }
      return route.continue();
    });
    if(admin) await applyAuthCookies(ctx,'full');
    const page = await ctx.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(15000);
    return { ctx, page };
  }
  async function go(page, route) {
    await page.goto(new URL(route,baseUrl).href, { waitUntil: 'networkidle', timeout: 60000 });
  }
  async function capture(page, name, { fullPage = true } = {}) {
    if (partialCaptureRun && !requestedCaptures.has(name)) return;
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
    await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
    if (fullPage) await page.evaluate(() => window.scrollTo(0,0));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow: ${name}`);
    await page.screenshot({ path: path.join(output,name), fullPage, animations:'disabled' });
    captures.push(name);
  }
  async function lookup(page, lastName, contact) {
    await go(page,'/');
    await page.getByLabel('Email or phone number',{exact:true}).fill(contact);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByLabel('Last name',{exact:true}).fill(lastName);
    await page.getByRole('button',{name:'Find schedule',exact:true}).click();
  }
  try {
    // Disposable review data only. Align upcoming work with the local review date.
    sql(`update public.calendar_items set start_date=start_date+(current_date+3-date '2026-01-13'), end_date=end_date+(current_date+3-date '2026-01-13') where workspace_id='${f.workspaceId}';
      update public.workspaces set starts_on=current_date, ends_on=current_date+75 where id='${f.workspaceId}';
      update public.workspaces set display_name='Livingston Local Project' where id='${f.otherWorkspaceId}';
      update public.project_contacts set volunteer_facing_display_name='Jamie Parker',volunteer_facing_email='jamie@example.invalid',volunteer_facing_phone='+1 406 555 0190' where id='${f.fullContactId}';
      update public.task_presets set name='Lunch preparation' where id='${f.foodTaskPresetId}';
      update public.calendar_items set schedule_notes='Check in at the main entrance. Your contact will meet you there.' where id='${f.calendarItemIds.gate}';
      update public.volunteer_profiles set email='alex@example.invalid',phone='+1 (406) 555-0100' where id='${f.volunteerIds[0]}';
      insert into public.volunteer_profiles (id,workspace_id,profile_source,full_name,email,availability_snapshot,skills_help_snapshot,manual_created_at,manual_created_by_project_contact_id)
        values ('${secondProfile}','${f.otherWorkspaceId}','manual','Alex Rivera','alex@example.invalid','{}','{}',now(),'${f.fullContactId}');`);
    reset();
    const desktop = await context(1440);
    let lookupRequests = 0;
    desktop.page.on('request',r=>{if(r.url().endsWith('/v/lookup'))lookupRequests++;});
    await go(desktop.page,'/');
    await capture(desktop.page,'01-landing-desktop.png');
    await desktop.page.screenshot({path:path.join(review1246C,'01-lookup-step-1-desktop.png'),fullPage:true});
    for(const width of [390,360]) {
      await desktop.page.setViewportSize({width,height:844});
      await capture(desktop.page,`02-landing-mobile-${width}.png`);
      if(width===390) await desktop.page.screenshot({path:path.join(review1246C,'09-lookup-step-1-mobile-390.png'),fullPage:true});
    }
    await desktop.page.setViewportSize({width:1440,height:1000});
    await desktop.page.getByLabel('Email or phone number',{exact:true}).fill('alex@example.invalid');
    await desktop.page.getByRole('button',{name:'Continue',exact:true}).click();
    assert.equal(lookupRequests,0,'Contact step makes no request.');
    assert.equal(await desktop.page.getByLabel('Last name').evaluate(e=>e===document.activeElement),true);
    await desktop.page.screenshot({path:path.join(review1246C,'02-lookup-step-2-desktop.png'),fullPage:true});
    await desktop.page.setViewportSize({width:390,height:844});
    await desktop.page.screenshot({path:path.join(review1246C,'10-lookup-step-2-mobile-390.png'),fullPage:true});
    await capture(desktop.page,'03-contact-verification-mobile.png');
    await desktop.page.getByLabel('Last name').fill('Wrong');
    await desktop.page.getByRole('button',{name:'Find schedule',exact:true}).click();
    await desktop.page.getByRole('alert').waitFor();
    await capture(desktop.page,'04-verification-failure-mobile.png');
    assert(!(await desktop.ctx.cookies()).some(c=>c.name==='pl-volunteer-schedule'));
    const failKnown = await desktop.page.request.post(new URL('/v/lookup',baseUrl).href,{headers:{origin:new URL(baseUrl).origin},data:{lastName:'Rivera',contact:'wrong@example.invalid'}});
    const failUnknown = await desktop.page.request.post(new URL('/v/lookup',baseUrl).href,{headers:{origin:new URL(baseUrl).origin},data:{lastName:'Nobody',contact:'wrong@example.invalid'}});
    assert.equal(failKnown.status(),failUnknown.status()); assert.deepEqual(await failKnown.json(),await failUnknown.json());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const throttled = await desktop.page.request.post(new URL('/v/lookup',baseUrl).href,{headers:{origin:new URL(baseUrl).origin},data:{lastName:'Rivera',contact:'wrong@example.invalid'}});
      assert.deepEqual(await throttled.json(),{status:'unverified'});
    }
    await capture(desktop.page,'05-rate-limited-state-mobile.png');
    const malformedOrigin = await desktop.page.request.post(new URL('/v/lookup',baseUrl).href,{headers:{origin:'not-an-origin'},data:{lastName:'Rivera',contact:'alex@example.invalid'}});
    assert.deepEqual(await malformedOrigin.json(),{status:'unverified'});
    const crossSite = await desktop.page.request.post(new URL('/v/lookup',baseUrl).href,{headers:{origin:'https://example.invalid'},data:{lastName:'Rivera',contact:'alex@example.invalid'}});
    assert.deepEqual(await crossSite.json(),{status:'unverified'});
    reset();
    await desktop.page.getByRole('button',{name:'Start again',exact:true}).click();
    await desktop.page.getByLabel('Email or phone number').fill('alex@example.invalid');
    await desktop.page.getByRole('button',{name:'Continue',exact:true}).click();
    await desktop.page.getByLabel('Last name').fill('Rivera');
    await desktop.page.getByRole('button',{name:'Find schedule',exact:true}).click();
    await desktop.page.getByRole('heading',{name:'Choose a project',exact:true}).waitFor();
    assert(!(await desktop.ctx.cookies()).some(c=>c.name==='pl-volunteer-schedule'));
    await capture(desktop.page,'06-project-choice-mobile.png');
    await desktop.page.getByRole('button',{name:'Bozeman Local Project',exact:true}).click();
    await desktop.page.waitForURL('**/v/schedule');
    await desktop.page.getByRole('heading',{name:'Here’s your schedule'}).waitFor();
    const cookie = (await desktop.ctx.cookies()).find(c=>c.name==='pl-volunteer-schedule');
    assert(cookie?.httpOnly && cookie.sameSite==='Lax' && cookie.path==='/v');
    assert(!(await desktop.page.evaluate(()=>document.cookie)).includes('pl-volunteer-schedule'));
    await capture(desktop.page,'06-volunteer-schedule-mobile-360.png');
    await desktop.page.setViewportSize({width:390,height:844});
    await capture(desktop.page,'07-volunteer-schedule-mobile-390.png');
    await desktop.page.setViewportSize({width:1440,height:1000});
    await capture(desktop.page,'08-volunteer-schedule-desktop.png');
    const assignmentButton = desktop.page.getByRole('button',{name:/Gate attendant/}).first();
    await assignmentButton.click();
    await desktop.page.getByRole('dialog').waitFor();
    await capture(desktop.page,'09-volunteer-assignment-desktop.png');
    await desktop.page.setViewportSize({width:390,height:844});
    await capture(desktop.page,'10-volunteer-assignment-mobile.png');
    await desktop.page.keyboard.press('Escape');
    await desktop.page.getByRole('dialog').waitFor({state:'hidden'});
    // Existing personalized path exchanges the same scoped credential in a fresh browser.
    const linked = await context(390);
    await go(linked.page,`/v/access/${cookie.value}`);
    await linked.page.waitForURL('**/v/schedule');
    await linked.page.getByRole('heading',{name:'Here’s your schedule'}).waitFor();
    assert((await linked.ctx.cookies()).find(c=>c.name==='pl-volunteer-schedule')?.httpOnly);
    await linked.page.getByRole('button',{name:'Not you? Leave this schedule'}).click();
    await linked.page.getByRole('link',{name:'Find your schedule',exact:true}).waitFor();
    assert(!(await linked.ctx.cookies()).some(c=>c.name==='pl-volunteer-schedule'&&c.value));
    reset();
    const phone = await context(390);
    await lookup(phone.page,'Rivera','+1 406 555 0100');
    await phone.page.waitForURL('**/v/schedule');
    await phone.page.getByRole('heading',{name:'Here’s your schedule'}).waitFor();
    // Secure flag is required behind HTTPS termination even for a local request URL.
    const secure = await phone.page.request.post(new URL('/v/lookup',baseUrl).href,{headers:{origin:new URL(baseUrl).origin,'x-forwarded-proto':'https'},data:{lastName:'Rivera',contact:'+1 406 555 0100'}});
    assert(/; Secure/i.test(secure.headers()['set-cookie']));
    assert.deepEqual(await secure.json(),{status:'verified'},'Bearer never enters app JSON.');

    const admin = await context(1440,true);
    const route = `/admin/calendar?view=week&date=${date}`;
    const surfaces = [['11-overview-desktop.png','/admin/dashboard','Overview'],['12-calendar-desktop.png',route,'Calendar'],['14-tasks-desktop.png','/admin/tasks','Tasks'],['15-needs-attention-desktop.png','/admin/needs-attention','Needs Attention'],['16-volunteers-desktop.png','/admin/volunteers','Volunteers'],['18-quick-view-desktop.png',`/admin/quick-view?date=${date}`,'Project Quick View']];
    for (const [name,url,title] of surfaces) {
      await go(admin.page,url);
      await admin.page.getByRole('heading',{name:title,exact:true}).first().waitFor();
      await capture(admin.page,name,{fullPage: name !== '16-volunteers-desktop.png'});
      if(title==='Needs Attention') await admin.page.screenshot({path:path.join(review1246C,'04-needs-attention-unread-desktop.png'),fullPage:true});
      if(title==='Volunteers') await admin.page.screenshot({path:path.join(review1246C,'05-volunteer-directory-desktop.png')});
      if(title==='Calendar') await admin.page.screenshot({path:path.join(review1246C,'08-calendar-day-details-desktop.png'),fullPage:true});
    }
    await go(admin.page,'/admin/volunteers');
    const alex = admin.page.locator('article').filter({hasText:'Alex Rivera'}).first();
    await alex.scrollIntoViewIfNeeded();
    await alex.getByRole('button',{name:'Edit Alex Rivera',exact:true}).click();
    await capture(admin.page,'17-volunteer-edit-desktop.png',{fullPage:false});
    await admin.page.screenshot({path:path.join(review1246C,'06-volunteer-editor-main-desktop.png')});
    const desktopPrivate = admin.page.locator('aside[aria-label^="Editing volunteer"]').getByText('Private info',{exact:true});
    await desktopPrivate.scrollIntoViewIfNeeded();
    await desktopPrivate.click();
    await admin.page.screenshot({path:path.join(review1246C,'07-volunteer-editor-private-desktop.png')});
    await admin.page.setViewportSize({width:390,height:844});
    await go(admin.page,'/admin/volunteers');
    const mobileAlex = admin.page.locator('article').filter({hasText:'Alex Rivera'}).first();
    await mobileAlex.getByRole('button',{name:'Edit Alex Rivera',exact:true}).click();
    await admin.page.getByRole('dialog',{name:'volunteer editor',exact:true}).waitFor();
    await capture(admin.page,'19-volunteer-edit-mobile.png',{fullPage:false});
    await admin.page.screenshot({path:path.join(review1246C,'14-volunteer-editor-mobile-390.png')});
    const mobilePrivate = admin.page.getByRole('dialog',{name:'volunteer editor',exact:true}).getByText('Private info',{exact:true});
    await mobilePrivate.scrollIntoViewIfNeeded();
    await mobilePrivate.click();
    await admin.page.screenshot({path:path.join(review1246C,'15-private-info-mobile-390.png')});
    await admin.page.getByRole('button',{name:'Close volunteer editor',exact:true}).click();
    await admin.page.screenshot({path:path.join(review1246C,'13-volunteer-directory-mobile-390.png')});
    await admin.page.getByRole('button',{name:'Open more admin navigation',exact:true}).click();
    await admin.page.screenshot({path:path.join(review1246C,'16-mobile-more-typography-390.png')});
    await admin.page.getByRole('button',{name:'Close more admin navigation',exact:true}).click();
    await go(admin.page,route);
    await admin.page.setViewportSize({width:1440,height:1000});
    await admin.page.getByRole('button',{name:/Create item/,exact:true}).click();
    const planner=admin.page.getByRole('dialog',{name:'Plan project work',exact:true});
    await planner.getByRole('button',{name:'Repeat',exact:true}).click();
    await planner.getByLabel('End date',{exact:true}).fill(dateEnd);
    await planner.getByRole('button',{name:'Tue',exact:true}).click();
    await planner.getByRole('button',{name:'Thu',exact:true}).click();
    await planner.getByRole('button',{name:'Custom',exact:true}).click();
    await capture(admin.page,'13-calendar-repeat-desktop.png');
    for(const width of [390,360]) {
      await admin.page.setViewportSize({width,height:844});
      await capture(admin.page,`20-calendar-repeat-mobile-${width}.png`,{fullPage:false});
      const focusable=planner.getByRole('button',{name:'Close project work planner',exact:true});
      await focusable.focus(); await admin.page.keyboard.press('Shift+Tab');
      assert(await planner.evaluate(e=>e.contains(document.activeElement)),'Sheet contains keyboard focus.');
    }
    await planner.getByRole('button',{name:'Close project work planner',exact:true}).click();
    await admin.page.setViewportSize({width:390,height:844});
    sql(`delete from public.needs_attention_seen_states where workspace_id='${f.workspaceId}' and project_contact_id='${f.fullContactId}';`);
    for(const [name,url,title] of surfaces) {
      await go(admin.page,url);
      await admin.page.getByRole('heading',{name:title,exact:true}).first().waitFor();
      await capture(admin.page,name.replace('-desktop','-mobile'),{fullPage:false});
      if(title==='Needs Attention') await admin.page.screenshot({path:path.join(review1246C,'12-needs-attention-mobile-390.png'),fullPage:true});
      if(title==='Calendar') await admin.page.screenshot({path:path.join(review1246C,'17-calendar-day-details-mobile-390.png')});
    }
    await admin.page.setViewportSize({width:360,height:844});
    await go(admin.page,route);
    await admin.page.getByRole('heading',{name:'Calendar',exact:true}).first().waitFor();
    await capture(admin.page,'12-calendar-mobile-360.png',{fullPage:false});
    await admin.page.setViewportSize({width:390,height:844});
    await admin.page.screenshot({path:path.join(review1246C,'17-calendar-day-details-mobile-390.png')});
    await go(admin.page,`/admin/assignments/${f.assignmentIds.gate}`);
    await capture(admin.page,'21-assignment-detail-mobile.png',{fullPage:false});
    await go(admin.page,'/admin/settings');
    await capture(admin.page,'22-contained-settings-mobile.png',{fullPage:false});
    assert.equal(errors.length,0,errors.join('\n'));
    if (!partialCaptureRun) await writeFile(path.join(output,'capture-index.json'),JSON.stringify({captures, widths:[1440,390,360],productionAccess:0, browserErrors:errors},null,2)+'\n');
    console.log(`PASS final rendered review: ${captures.length} captures; name-only silence; generic HTTP failures; cookie flags; phone login; project choice; personalized link; leave schedule; mobile overflow/focus; no external requests.`);
  } finally {
    await Promise.all(contexts.map(c=>c.close()));
    sql(`delete from public.volunteer_schedule_access_tokens where workspace_id in ('${f.workspaceId}','${f.otherWorkspaceId}'); delete from public.volunteer_profiles where id='${secondProfile}';`);
    reset();
  }
}
