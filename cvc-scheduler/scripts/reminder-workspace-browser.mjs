// Production-mode LOCAL app and fixtures only. Every hosted HTTP/TCP request
// is denied. No worker, provider, scheduler or delivery helper is invoked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--fixture-server')) {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=(input,options)=>{
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
    assert(['localhost','127.0.0.1'].includes(url.hostname),'No hosted HTTP/provider traffic');
    return originalFetch(input,options);
  };
  const connect=net.Socket.prototype.connect;
  net.Socket.prototype.connect=function(...args){
    const normalized=Array.isArray(args[0])?args[0]:args;
    const cfg=typeof normalized[0]==='object'?normalized[0]:{host:normalized[1]};
    assert(['localhost','127.0.0.1','::1'].includes(cfg.host),'No hosted TCP/provider traffic');
    return connect.apply(this,args);
  };
  const next=(await import('next')).default;
  const port=Number(process.env.REMINDER_LOCAL_PORT??3000);
  const app=next({dev:false,hostname:'localhost',port});await app.prepare();
  assert(['localhost','127.0.0.1'].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname));
  const server=http.createServer(app.getRequestHandler());await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  console.log('REMINDER_UI_READY');
  process.stdin.once('data',()=>{server.closeAllConnections();server.close(async()=>{await app.close();process.exit(0);});});
} else {
  const { chromium }=await import('playwright');
  const { fixture,sql,value,q }=await import('./12-47-local-fixtures.mjs');
  const { reminderFingerprint }=await import('./reminder-database-local-fixture.mjs');
  const { resolvePreviewBrowserExecutable }=await import('./preview-config.mjs');
  const f=await fixture(true);let browser,server;
  const output=path.resolve(process.env.REMINDER_EVIDENCE_DIR??'../previews/12-58-reminders');fs.mkdirSync(output,{recursive:true});
  const reset=()=>sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};delete from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)};delete from public.assignment_reminder_enrollments where workspace_id=${q(f.ws)};delete from public.communication_recipients where workspace_id=${q(f.ws)};delete from public.communication_operations where workspace_id=${q(f.ws)};update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null;`);
  const localState=()=>reminderFingerprint()+'|'+value('select last_value::text||is_called::text from public.assignment_reminder_events_id_seq');
  let stderr='',stdout='';const results=[];
  try {
    reset();
    sql(`update public.assignment_responses set response_status='declined',responded_at=now() where workspace_id=${q(f.ws)};
      update public.volunteer_profiles set email='household@example.invalid' where workspace_id=${q(f.ws)};
      insert into public.calendar_items(id,workspace_id,title_snapshot,task_type_snapshot,schedule_kind,start_date,start_time,end_time,timezone,needed_count,lifecycle,publication_state,published_at,published_by_project_contact_id,created_by_project_contact_id)
      select ('e0000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,${q(f.ws)},case when n%2=0 then 'Gate Attendant' else 'Food Service' end,'general','timed',current_date+50+(n%3),'07:30','12:00','America/Denver',1,'active','published',now(),${q(f.contact)},${q(f.contact)} from generate_series(1,100)n;
      insert into public.calendar_assignments(id,workspace_id,calendar_item_id,volunteer_profile_id,lifecycle)
      select ('e1000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,${q(f.ws)},('e0000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,case when n%2=0 then ${q(f.volunteers[0])} else ${q(f.volunteers[1])} end::uuid,'active' from generate_series(1,100)n;
      insert into public.assignment_responses(workspace_id,assignment_id,response_status,responded_at)
      select a.workspace_id,a.id,case when right(a.id::text,12)::integer<=74 then 'confirmed' else 'declined' end,now() from public.calendar_assignments a where a.workspace_id=${q(f.ws)} and a.id::text like 'e1000000-%';
      insert into public.assignment_reminder_enrollments(assignment_id,workspace_id,volunteer_id,response_status,response_baseline,start_at)
      select a.id,a.workspace_id,a.volunteer_profile_id,'confirmed',now(),public.calendar_assignment_response_start_at(i.schedule_kind,i.start_date,i.start_time,'America/Denver') from public.calendar_assignments a join public.calendar_items i on i.id=a.calendar_item_id where a.workspace_id=${q(f.ws)} and a.id::text like 'e1000000-%' and right(a.id::text,12)::integer<=74;
      insert into public.assignment_reminder_occurrences(workspace_id,assignment_id,volunteer_id,kind,occurrence_key,due_at,start_at,enrolled_at)
      select e.workspace_id,e.assignment_id,e.volunteer_id,'shift','shift:'||d,public.assignment_reminder_local_offset(e.start_at,'America/Denver',-d),e.start_at,now() from public.assignment_reminder_enrollments e cross join unnest(array[30,14,7,3,1])d where e.workspace_id=${q(f.ws)} and not (e.assignment_id='e1000000-0000-0000-0000-000000000074' and d in (30,14));`);
    assert.equal(value(`select count(*) from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)}`),'368');
    server=spawn(process.execPath,[fileURLToPath(import.meta.url),'--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
    server.stdout.on('data',x=>stdout+=x);server.stderr.on('data',x=>stderr+=x);
    await new Promise((resolve,reject)=>{const timer=setInterval(()=>{if(stdout.includes('REMINDER_UI_READY')){clearInterval(timer);resolve();}else if(server.exitCode!==null){clearInterval(timer);reject(new Error(stderr.slice(-2000)));}},50);setTimeout(()=>{clearInterval(timer);reject(new Error('Local UI server timeout '+stderr.slice(-1000)));},30000).unref();});
    browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
    const baselineOnly=process.argv.includes('--baseline-only');
    for(const width of baselineOnly||process.argv.includes('--reliability-only')?[390]:[320,390,430,768,1280,1920]) {
      const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Pacific/Auckland',reducedMotion:'reduce'});
      let forbidden=0,reads=0;const errors=[];
      await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():(forbidden++,route.abort()));
      await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')reads++;});
      const tab=page.getByRole('tab',{name:/Automatic reminders/}),panel=page.getByRole('region',{name:'Automatic reminders',exact:true});
      const screenshot=state=>page.screenshot({path:path.join(output,`${state}-${width}.png`),fullPage:true});
      const before=localState();
      if(baselineOnly){
        sql('update public.assignment_reminder_activation set delivery_enabled=true,baseline_at=now()');
        await page.goto('http://localhost:3000/admin/announcements?kind=reminders',{waitUntil:'networkidle'});
        await panel.getByRole('button',{name:/^View reminder/}).click();
        const group=panel.locator('summary').filter({hasText:/^Assignments with reminder history/});await group.waitFor();await group.click();
        await panel.locator('summary').filter({hasText:/^Reminder history/}).click();
        const height=await page.evaluate(()=>document.documentElement.scrollHeight);
        assert((await panel.innerText()).includes('Reminder history · 368'));
        const frozen=localState();await screenshot('baseline-expanded');assert.equal(localState(),frozen);
        results.push({width,baselineExpandedPageHeight:height,totalScheduled:368});await context.close();continue;
      }
      for(const enabled of [false,true]) {
        sql(`update public.assignment_reminder_activation set delivery_enabled=${enabled},baseline_at=${enabled?'now()':'null'}`);
        await page.goto('http://localhost:3000/admin/announcements?kind=reminders',{waitUntil:'networkidle'});
        assert((await tab.innerText()).endsWith(enabled?'On':'Off'));
        await panel.getByRole('heading',{name:/Next reminder batch/}).waitFor();
        assert((await panel.innerText()).includes('reminders scheduled'));assert((await panel.innerText()).includes('No reminder processing or delivery activity'));
        assert(!/Preview|Phase A|baseline|enrollment|worker|scheduler|occurrence/i.test(await panel.innerText()));
        await panel.getByText('How reminders work',{exact:true}).click();assert((await panel.innerText()).includes('Every 3 days at 9:00 AM'));assert((await panel.innerText()).includes('5:00 PM the day before'));
        await panel.getByText('How reminders work',{exact:true}).click();
        if(enabled)await screenshot('on-summary');else await screenshot('off-summary');
      }
      await panel.getByRole('button',{name:'View reminders',exact:true}).click();
      await panel.locator('li').first().waitFor();await panel.getByRole('button',{name:'Refresh list',exact:true}).waitFor();
      assert.equal(await panel.locator('li').count(),25);assert(await panel.getByRole('button',{name:'Next page',exact:true}).isVisible());
      const upcomingHeight=await page.evaluate(()=>document.documentElement.scrollHeight);
      await screenshot('upcoming');const first=(await panel.locator('li').allTextContents()).join('|');
      await panel.getByRole('button',{name:'Next page',exact:true}).click();await panel.getByRole('button',{name:'First page',exact:true}).waitFor();
      assert.notEqual((await panel.locator('li').allTextContents()).join('|'),first);assert.equal(await panel.locator('li').count(),25);
      await panel.getByRole('button',{name:'First page',exact:true}).click();await page.waitForLoadState('networkidle');
      await panel.getByRole('button',{name:'History',exact:true}).click();await panel.getByText('No reminder processing or delivery activity has been recorded yet.',{exact:true}).last().waitFor();
      const historical=()=>sql(`with chosen as (select id,row_number() over(order by id)n from public.assignment_reminder_occurrences where workspace_id=${q(f.ws)} order by id limit 5)
        insert into public.assignment_reminder_events(occurrence_id,workspace_id,event,happened_at,due_at,attempt)
        select o.id,o.workspace_id,case c.n when 1 then 'sent' when 2 then 'failed' when 3 then 'unknown' when 4 then 'claimed' else 'excluded' end,now()-interval '60 days',o.due_at,1 from chosen c join public.assignment_reminder_occurrences o on o.id=c.id;`);
      historical();await panel.getByRole('button',{name:'Refresh summary',exact:true}).click();await panel.getByRole('button',{name:'Review reminder history',exact:true}).waitFor();await panel.getByRole('button',{name:'Review reminder history',exact:true}).click();
      await panel.getByText('Unknown — needs review',{exact:true}).waitFor();assert.equal(await panel.locator('li').count(),5);
      assert(!(await panel.innerText()).includes('No reminder processing or delivery activity'));
      for(const detail of await panel.locator('li summary').all())await detail.click();
      assert((await panel.innerText()).includes('does not confirm inbox receipt'));assert((await panel.innerText()).includes('Do not send it again'));assert((await panel.innerText()).includes('Processing is in progress'));
      const sending=panel.locator('li').filter({has:page.getByText('Sending',{exact:true})});assert(!(await sending.innerText()).includes('needs review'));
      assert.equal(await panel.getByRole('button',{name:/resend|send now|retry failed|turn on|pause reminders/i}).count(),0);
      await screenshot('history');
      await panel.getByRole('button',{name:'Find an assignment',exact:true}).click();
      await panel.getByRole('searchbox',{name:'Volunteer or assignment'}).fill('Alex');await panel.getByRole('button',{name:'Search',exact:true}).click();
      await page.waitForLoadState('networkidle');assert((await panel.locator('li').allTextContents()).every(t=>t.includes('Alex Morgan')));
      await panel.getByRole('searchbox',{name:'Volunteer or assignment'}).fill('no such volunteer');await panel.getByRole('button',{name:'Search',exact:true}).click();await panel.getByText('No matching reminders or assigned work in this project.',{exact:true}).waitFor();
      // A read failure keeps an honest error, finite state and retry with the
      // same submitted search intent. It never becomes a false empty result.
      await page.route('**/admin/announcements*',route=>route.request().method()==='POST'?route.abort():route.continue());
      await panel.getByRole('button',{name:'Refresh list',exact:true}).click();await panel.getByRole('button',{name:'Retry reminders',exact:true}).waitFor();await screenshot('error');
      await page.unroute('**/admin/announcements*');await panel.getByRole('button',{name:'Retry reminders',exact:true}).click();await panel.getByRole('button',{name:'Refresh list',exact:true}).waitFor();
      if(process.argv.includes('--reliability-only')){
        let held;
        await page.route('**/admin/announcements*',route=>{if(route.request().method()==='POST')held=route;else return route.continue();});
        await panel.getByRole('button',{name:'Refresh list',exact:true}).click();
        await panel.getByRole('button',{name:'Retry reminders',exact:true}).waitFor({timeout:18000});
        assert.equal(await panel.getByRole('button',{name:'Loading…',exact:true}).count(),0,'Hung read ends in a finite error');
        assert(held);await held.abort();await page.unroute('**/admin/announcements*');
        await panel.getByRole('button',{name:'Retry reminders',exact:true}).click();await panel.getByRole('button',{name:'Refresh list',exact:true}).waitFor();
      }
      await page.route('**/admin/announcements*',route=>route.request().method()==='POST'?route.abort():route.continue());
      await panel.getByRole('button',{name:'Refresh summary',exact:true}).click();await panel.getByRole('button',{name:'Retry reminder status',exact:true}).waitFor();assert((await tab.innerText()).includes('Unavailable'));
      await page.unroute('**/admin/announcements*');await panel.getByRole('button',{name:'Retry reminder status',exact:true}).click();await panel.getByRole('button',{name:'Refresh summary',exact:true}).waitFor();assert((await tab.innerText()).endsWith('On'));
      await panel.getByRole('searchbox',{name:'Volunteer or assignment'}).fill('');await panel.getByRole('button',{name:'Search',exact:true}).click();
      await panel.getByRole('button',{name:'Upcoming',exact:true}).click();await panel.getByRole('button',{name:'History',exact:true}).click();await panel.getByText('Unknown — needs review',{exact:true}).waitFor();
      await page.waitForTimeout(500);assert(await panel.getByRole('heading',{name:'Reminder history',exact:true}).isVisible());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      for(const control of await panel.locator('button,input,summary').all())if(await control.isVisible())assert((await control.boundingBox()).height>=44);
      for(const control of await page.getByRole('tab').all())assert((await control.boundingBox()).height>=44);
      await panel.getByRole('searchbox',{name:'Volunteer or assignment'}).focus();assert(await panel.getByRole('searchbox',{name:'Volunteer or assignment'}).evaluate(el=>el===document.activeElement));await page.keyboard.press('Tab');assert(await panel.getByRole('button',{name:'Search',exact:true}).evaluate(el=>el===document.activeElement));
      assert.deepEqual(errors,[]);assert.equal(forbidden,0);
      // Remove fixture activity only, then prove navigation/reads preserve the
      // original operational/Auth state, including event sequence non-use.
      sql(`delete from public.assignment_reminder_events where workspace_id=${q(f.ws)};update public.assignment_reminder_activation set delivery_enabled=false,baseline_at=null;`);
      const frozen=localState();await page.reload({waitUntil:'networkidle'});await panel.getByRole('button',{name:'View reminders',exact:true}).click();await panel.locator('li').first().waitFor();
      await panel.getByRole('button',{name:'Next page',exact:true}).click();await panel.getByRole('button',{name:'First page',exact:true}).waitFor();await panel.getByRole('button',{name:'History',exact:true}).click();await panel.getByText('No reminder processing or delivery activity has been recorded yet.',{exact:true}).last().waitFor();assert.equal(localState(),frozen);
      assert.notEqual(before,localState(),'Fixture history intentionally advances only the local test event sequence');
      results.push({width,upcomingPageHeight:upcomingHeight,rowsPerPage:25,totalScheduled:368,actionReads:reads});await context.close();console.log(`PASS ${width}px summary On/Off, independent help, Upcoming/History/search/context, real outcome semantics, read-only, error/retry, stale request protection, no overflow, 44px targets and keyboard focus`);
    }
    // Insufficient access: fresh route and action/RPC both fail closed.
    if(!baselineOnly){
    sql(`update public.workspace_contact_grants set capabilities=array_remove(capabilities,'assignments.edit') where workspace_id=${q(f.ws)}`);
    const denied=await browser.newContext();await denied.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));const page=await denied.newPage();await page.goto('http://localhost:3000/admin/announcements?kind=reminders',{waitUntil:'networkidle'});assert.equal(await page.getByRole('region',{name:'Automatic reminders',exact:true}).count(),0);await denied.close();
    }
    fs.writeFileSync(path.join(output,baselineOnly?'baseline-height.json':process.argv.includes('--reliability-only')?'reliability-results.json':'responsive-results.json'),JSON.stringify(results,null,2)+'\n');console.log('PASS no system/worker/provider credential configured, no external traffic; all browser writes are fixture-only');
  } finally {
    await browser?.close();if(server){server.stdin.end('stop');await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill();resolve();},5000);server.once('exit',()=>{clearTimeout(timer);resolve();});});}
    reset();await f.cleanup();
  }
}
