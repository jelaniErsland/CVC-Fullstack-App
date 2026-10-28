// Synthetic local production-mode fixture. Hosted/provider requests blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import nextEnv from '@next/env';
import { chromium } from 'playwright';
import { fixture, sql, q, value } from './12-47-local-fixtures.mjs';
const protectedFingerprint=()=>value(`select md5(string_agg(schemaname||'.'||tablename||':'||(xpath('/row/hash/text()',query_to_xml(format('select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,''[]'')) hash from %I.%I t',schemaname,tablename),false,true,'')))[1]::text,'|' order by schemaname,tablename)) from pg_tables where schemaname='public' and tablename<>'volunteer_profiles'`);
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';
nextEnv.loadEnvConfig(process.cwd());
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'127.0.0.1');
const output=path.resolve('../previews/12-61-volunteer-skills');fs.mkdirSync(output,{recursive:true});
const f=await fixture(true);let browser,server,log='';const results=[],audits=[];
const read=id=>JSON.parse(value(`select row_to_json(v) from public.volunteer_profiles v where id=${q(id)}`));
try {
  sql(`update public.volunteer_profiles set email='household@example.invalid',skills_experience='Electrical prose stays separate.',profile_notes=repeat('LONGPROFILE',250),congregation='Belgrade' where id=${q(f.volunteers[0])};
    update public.volunteer_profiles set structured_skill_categories=array['Painting'],congregation='Bozeman' where id=${q(f.volunteers[1])};
    update public.volunteer_profiles set congregation=null where id=${q(f.volunteers[2])};`);
  server=spawn(process.execPath,['scripts/reminder-workspace-browser.mjs','--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
  server.stdout.on('data',data=>log+=data);server.stderr.on('data',data=>log+=data);
  await new Promise((resolve,reject)=>{const timer=setInterval(()=>{if(log.includes('REMINDER_UI_READY')){clearInterval(timer);resolve();}else if(server.exitCode!==null){clearInterval(timer);reject(Error(log.slice(-2500)));}},50);setTimeout(()=>{clearInterval(timer);reject(Error('Local fixture server deadline'));},30000).unref();});
  browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
  for(const width of [320,390,430,768,1280,1440,1920,2560]) {
    sql(`update public.volunteer_profiles set structured_skill_categories='{}' where id=${q(f.volunteers[0])}`);
    const context=await browser.newContext({viewport:{width,height:width<640?900:1000},reducedMotion:'reduce'});let external=0,actions=0;const errors=[];
    await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():(external++,route.abort()));
    await context.addCookies([...f.admin.jar.values()].map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax'})));
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.method()==='POST'&&request.headers()['next-action'])actions++;});
    await page.goto('http://localhost:3000/admin/volunteers',{waitUntil:'networkidle'});
    const search=page.getByPlaceholder('Search volunteers or skills…');await search.waitFor();
    const before=protectedFingerprint();
    await page.addScriptTag({path:path.resolve('node_modules/axe-core/axe.min.js')});
    const audit=async name=>{const violations=await page.evaluate(async()=>{const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);const result=await window.axe.run(dialog??document.querySelector('#main-content'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});audits.push({width,name,violations});assert.deepEqual(violations,[],name+' accessibility');};
    const shot=async name=>{if([390,1440].includes(width))await page.screenshot({path:path.join(output,`${name}-${width}.png`)});};
    const profile=()=>page.getByRole('dialog',{name:'Alex Morgan',exact:true});
    const edit=async()=>{await profile().getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('group',{name:'Structured skills',exact:true}).waitFor();};
    const backdrop=async()=>{await page.mouse.click(2,width<640?2:150);};
    assert.equal(await page.locator('article').count(),3);
    const pureStart=actions;
    // All options remain accessible; sort is presentation-only and never changes count.
    const sortLabels=['Name A–Z','Name Z–A','Congregation A–Z','Recently added','Oldest added','Schedule-ready first','Active first'];
    for(const label of sortLabels){await page.getByRole('button',{name:/^Sort:/}).click();await page.getByRole('menuitemradio',{name:label,exact:true}).click();assert.equal(await page.locator('article').count(),3);}
    assert.equal(actions,pureStart,'Sort must not request server data');
    await page.getByRole('button',{name:/^Sort:/}).click();await page.getByRole('menuitemradio',{name:'Name Z–A',exact:true}).press('Enter');
    await audit('directory');
    // Add uses the same editor, without creating anything until explicit Save.
    await page.getByRole('button',{name:'+ Add volunteer',exact:true}).click();await page.getByRole('group',{name:'Structured skills'}).waitFor();await page.getByRole('group',{name:'Structured skills'}).scrollIntoViewIfNeeded();await shot('add-skills');await audit('add');
    await page.getByRole('button',{name:'Close volunteer editor',exact:true}).click();
    await search.fill('Alex');await page.getByRole('button',{name:'Alex Morgan',exact:true}).click();await profile().waitFor();
    await profile().getByText('Loading schedule…').waitFor({state:'hidden'});
    await audit('profile-empty');
    if(width===430){await profile().getByText('Other profile details',{exact:true}).click();await audit('long-profile');assert(await profile().evaluate(e=>{const body=e.querySelector('[data-sheet-scroll]');return body.scrollWidth<=body.clientWidth;}));await profile().getByText('Other profile details',{exact:true}).click();}
    await profile().getByRole('heading',{name:'Skills',exact:true}).click();assert(await profile().isVisible(),'Interior clicks cannot dismiss');
    // Read-only dismissal, focus return, state retention.
    await backdrop();await profile().waitFor({state:'hidden'});assert.equal(await search.inputValue(),'Alex');
    assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.trim()),'Alex MorganBelgrade');
    await page.getByRole('button',{name:'Alex Morgan',exact:true}).click();await page.keyboard.press('Escape');await profile().waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Alex Morgan',exact:true}).click();await profile().getByRole('button',{name:'Close volunteer profile',exact:true}).click();await profile().waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Alex Morgan',exact:true}).click();await edit();await page.getByRole('group',{name:'Structured skills'}).scrollIntoViewIfNeeded();await shot('edit-no-skills');
    // Every pristine dismissal returns to profile, including backdrop.
    for(const method of ['backdrop','Escape','X','Cancel']) {
      if(method==='backdrop')await backdrop();else if(method==='Escape')await page.keyboard.press('Escape');else await page.getByRole('button',{name:method==='X'?'Close volunteer editor':'Cancel',exact:true}).click();
      await profile().getByRole('button',{name:'Edit',exact:true}).waitFor();await edit();
    }
    const choices=page.getByRole('group',{name:'Structured skills',exact:true});
    await choices.getByRole('button',{name:'Electrical assist',exact:true}).press('Space');await choices.getByRole('button',{name:'Framing',exact:true}).press('Enter');
    await shot('edit-selected-skills');await audit('edit-selected');
    // Each dirty close must ask, and Keep editing preserves all selections.
    for(const method of ['backdrop','Escape','X','Cancel']) {
      if(method==='backdrop')await backdrop();else if(method==='Escape')await page.keyboard.press('Escape');else await page.getByRole('button',{name:method==='X'?'Close volunteer editor':'Cancel',exact:true}).click();
      const discard=page.getByRole('dialog',{name:'Discard unsaved changes?',exact:true});await discard.waitFor();await audit('discard');
      await discard.getByRole('button',{name:'Keep editing',exact:true}).click();await discard.waitFor({state:'hidden'});
      assert.equal(await choices.getByRole('button',{name:'Electrical assist'}).getAttribute('aria-pressed'),'true');
    }
    const historyBefore=read(f.volunteers[0]).skills_help_snapshot;
    await page.getByRole('button',{name:'Save changes',exact:true}).click();await profile().getByRole('button',{name:'Edit',exact:true}).waitFor();
    await profile().getByText('Electrical assist',{exact:true}).waitFor();await profile().getByText('Framing',{exact:true}).waitFor();
    assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,['Electrical assist','Framing']);
    assert.equal(read(f.volunteers[0]).skills_experience,'Electrical prose stays separate.');assert.deepEqual(read(f.volunteers[0]).skills_help_snapshot,historyBefore);
    await shot('profile-saved-skills');await audit('profile-saved');
    await profile().getByRole('button',{name:'Close volunteer profile',exact:true}).click();
    assert.equal(await search.inputValue(),'Alex');await page.getByRole('button',{name:'Sort: Name Z–A',exact:true}).waitFor();
    await search.fill('electrical assist');assert.equal(await page.locator('article').count(),1);
    await search.fill('');await page.getByRole('button',{name:'Filters',exact:true}).click();
    const filters=page.getByRole('dialog',{name:'Filter volunteers',exact:true});
    for(const skill of ['Electrical assist','Framing'])await filters.getByRole('group',{name:'Skills',exact:true}).getByRole('button',{name:skill,exact:true}).click();
    await filters.getByRole('button',{name:'Show 1 volunteer',exact:true}).click();assert.equal(await page.locator('article').count(),1);await shot('filtered-saved-skills');await audit('filtered');
    await page.getByRole('button',{name:'Filters · 1',exact:true}).click();await filters.getByRole('group',{name:'Skills',exact:true}).getByRole('button',{name:'Painting',exact:true}).click();
    await filters.getByRole('button',{name:'Show 0 volunteers',exact:true}).click();assert.equal(await page.locator('article').count(),0);
    await page.getByRole('button',{name:'Clear filters',exact:true}).click();await search.fill('Alex');await page.getByRole('button',{name:'Alex Morgan',exact:true}).click();await edit();
    await choices.getByRole('button',{name:'Security',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
    await page.getByRole('dialog',{name:'Discard unsaved changes?'}).getByRole('button',{name:'Discard changes',exact:true}).click();await profile().getByRole('button',{name:'Edit',exact:true}).waitFor();
    assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,['Electrical assist','Framing']);
    await edit();await page.getByRole('button',{name:'Clear skills',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();await profile().getByText('No structured skills recorded.',{exact:true}).waitFor();
    assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,[]);
    // Native modal trap and unchanged directory position; long forms remain scrollable.
    await profile().getByRole('button',{name:'Close volunteer profile',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>!!document.activeElement?.closest('dialog[open]')));
    await profile().getByRole('button',{name:'Close volunteer profile',exact:true}).click();
    if(width===390) {
      await page.getByRole('button',{name:'Alex Morgan',exact:true}).click();await edit();
      await choices.getByRole('button',{name:'Framing',exact:true}).click();
      sql(`update public.volunteer_profiles set structured_skill_categories=array['Security'] where id=${q(f.volunteers[0])}`);
      await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('alert').filter({hasText:'This profile changed'}).waitFor();
      assert.equal(await choices.getByRole('button',{name:'Framing',exact:true}).getAttribute('aria-pressed'),'true');
      assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,['Security']);await audit('conflict-retains-draft');
      await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();await profile().getByText('Security',{exact:true}).waitFor();
      await edit();await choices.getByRole('button',{name:'Framing',exact:true}).click();
      const failOnce=async route=>route.request().method()==='POST'?route.abort():route.fallback();
      await page.route('**/admin/volunteers',failOnce);
      await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('alert').filter({hasText:'confirm this change'}).waitFor();
      assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,['Security']);await audit('failure-retains-draft');await page.unroute('**/admin/volunteers',failOnce);
      await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();await profile().getByRole('button',{name:'Edit',exact:true}).waitFor();
      await edit();await choices.getByRole('button',{name:'Framing',exact:true}).click();
      const delayed=async route=>{if(route.request().method()==='POST')await new Promise(resolve=>setTimeout(resolve,600));await route.fallback();};
      await page.route('**/admin/volunteers',delayed);await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('button',{name:'Saving…',exact:true}).waitFor();await page.keyboard.press('Escape');assert(await profile().isVisible());
      await profile().getByRole('button',{name:'Edit',exact:true}).waitFor();await page.unroute('**/admin/volunteers',delayed);assert.deepEqual(read(f.volunteers[0]).structured_skill_categories,['Framing','Security']);
      await profile().getByRole('button',{name:'Close volunteer profile',exact:true}).click();
    }
    const metrics=await page.evaluate(()=>{const row=document.querySelector('article');const identity=row.querySelector('h2 button');const name=identity.children[0].getBoundingClientRect(),congregation=identity.children[1].getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,target:identity.getBoundingClientRect().height,nameCongregationGap:congregation.top-name.bottom};});
    assert.equal(metrics.overflow,false);assert(metrics.target>=44);assert(metrics.nameCongregationGap>=3&&metrics.nameCongregationGap<=5);
    assert.equal(protectedFingerprint(),before,'All public data except intentionally edited profile fixtures stayed unchanged');assert.equal(external,0);assert.deepEqual(errors,[]);
    results.push({width,...metrics,errors,external,serverActions:actions});await context.close();
  }
  // A long directory must retain its underlying position after a deep-row profile visit.
  sql(`insert into public.volunteer_profiles(workspace_id,full_name,email,profile_source,manual_created_by_project_contact_id,manual_created_at,availability_snapshot,skills_help_snapshot)
    select ${q(f.ws)},'Scroll Fixture '||lpad(n::text,3,'0'),'scroll-'||n||'@example.invalid','manual',${q(f.contact)},now(),'{}','{}' from generate_series(1,60)n`);
  const deep=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await deep.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await deep.addCookies([...f.admin.jar.values()].map(cookie=>({name:cookie.name,value:cookie.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const deepPage=await deep.newPage();await deepPage.goto('http://localhost:3000/admin/volunteers',{waitUntil:'networkidle'});
  const deepTrigger=deepPage.getByRole('button',{name:'Scroll Fixture 060',exact:true});await deepTrigger.scrollIntoViewIfNeeded();const beforeScroll=await deepPage.evaluate(()=>scrollY);assert(beforeScroll>1000);
  await deepTrigger.click();const deepProfile=deepPage.getByRole('dialog',{name:'Scroll Fixture 060',exact:true});await deepProfile.waitFor();assert(Math.abs(await deepPage.evaluate(()=>scrollY)-beforeScroll)<2);
  await deepProfile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();await deepProfile.waitFor({state:'hidden'});const afterScroll=await deepPage.evaluate(()=>scrollY);assert(Math.abs(afterScroll-beforeScroll)<2);assert.equal(await deepPage.evaluate(()=>document.activeElement?.getAttribute('aria-label')),'Scroll Fixture 060');await deep.close();
  const scrollContext={beforeScroll,afterScroll,pass:true};
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({results,audits,scrollContext,providerCalls:0,productionMutations:0},null,2));
  console.log(JSON.stringify({widths:results.length,axeAudits:audits.length,axeViolations:audits.flatMap(x=>x.violations).length,sheets:'PASS',dirtyGuards:'PASS',saveSearchFilter:'PASS',output}));
} catch(error) {fs.writeFileSync(path.join(output,'failure-server.log'),log);throw error;}
finally {await browser?.close();if(server){server.stdin.write('stop');await new Promise(resolve=>server.once('exit',resolve));}await f.cleanup();}
