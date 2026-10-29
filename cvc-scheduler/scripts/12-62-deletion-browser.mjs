// Production-mode local fixtures. Every external browser request is blocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import nextEnv from '@next/env';
import {fixture,sql,value,q} from './12-47-local-fixtures.mjs';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';
nextEnv.loadEnvConfig(process.cwd());assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'127.0.0.1');
const output=path.resolve('../previews/12-62-deletion');fs.mkdirSync(output,{recursive:true});
const f=await fixture(true);let browser,server,log='';const results=[];
const historicDay=value("select ((now() at time zone 'America/Denver')::date-2)::text"),historicItem=value(f.auth(`select public.create_calendar_item(${q(f.ws)},${q(f.preset)},null,null,'timed',${q(historicDay)},null,'08:00','11:00',3,'Past work instructions','{}')`));
value(f.auth(`select public.publish_calendar_item(${q(historicItem)})`));value(f.auth(`select public.create_calendar_assignments_batch(${q(historicItem)},array[${q(f.volunteers[0])},${q(f.volunteers[1])}]::uuid[],null)`));sql(`update public.workspaces set starts_on=${q(historicDay)}::date-1 where id=${q(f.ws)}`);
try {
 server=spawn(process.execPath,['scripts/reminder-workspace-browser.mjs','--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
 server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
 await new Promise((resolve,reject)=>{const poll=setInterval(()=>{if(log.includes('REMINDER_UI_READY')){clearInterval(poll);resolve();}else if(server.exitCode!==null){clearInterval(poll);reject(Error(log.slice(-2000)));}},50);setTimeout(()=>{clearInterval(poll);reject(Error('Fixture server deadline'));},30000).unref();});
 browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
 for(const width of process.argv.includes('--history-only')?[1920]:[320,390,430,768,1440,1920]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});let external=0;const errors=[];
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():(external++,route.abort()));
  await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/admin/volunteers',{waitUntil:'networkidle'});
  const search=page.getByPlaceholder('Search volunteers or skills…');await search.fill('Alex');
  await page.getByRole('button',{name:/^Sort:/}).click();await page.getByRole('menuitemradio',{name:'Name Z–A',exact:true}).click();
  await page.getByRole('button',{name:'Alex Morgan',exact:true}).click();
  const profile=page.getByRole('dialog',{name:'Alex Morgan',exact:true});
  await profile.getByRole('button',{name:'Edit',exact:true}).click();
  const edit=page.getByRole('dialog',{name:'Alex Morgan',exact:true});await edit.getByRole('button',{name:'Save changes',exact:true}).waitFor();
  // Unsaved edits must be explicitly discarded before a deletion review.
  const notes=edit.locator('textarea[name="profileNotes"]');await notes.fill('Unsaved local edit must not be saved by deletion');
  await edit.getByRole('button',{name:'Delete volunteer',exact:true}).click();
  const discard=page.getByRole('dialog',{name:'Discard unsaved changes?',exact:true});await discard.waitFor();
  await discard.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await notes.inputValue(),'Unsaved local edit must not be saved by deletion');
  await edit.getByRole('button',{name:'Delete volunteer',exact:true}).click();await discard.getByRole('button',{name:'Discard changes',exact:true}).click();
  const confirmation=page.getByRole('dialog',{name:'Delete Alex Morgan?',exact:true});await confirmation.waitFor();
  await confirmation.getByText('3 current/upcoming assignments will be removed.',{exact:true}).waitFor();
  assert(await confirmation.getByRole('button',{name:'Cancel',exact:true}).evaluate(node=>node===document.activeElement),'Safe initial focus');
  await confirmation.getByRole('button',{name:'Delete volunteer',exact:true}).focus();await page.keyboard.press('Tab');assert(await confirmation.evaluate(node=>node.contains(document.activeElement)));
  await page.keyboard.press('Shift+Tab');assert(await confirmation.evaluate(node=>node.contains(document.activeElement)));
  await page.addScriptTag({path:path.resolve('node_modules/axe-core/axe.min.js')});
  const violations=await confirmation.evaluate(async node=>(await window.axe.run(node,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)})));
  assert.deepEqual(violations,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const button of await confirmation.getByRole('button').all())assert((await button.boundingBox()).height>=44);
  await page.screenshot({path:path.join(output,`confirmation-${width}.png`)});
  await page.keyboard.press('Escape');await confirmation.waitFor({state:'hidden'});await profile.waitFor();
  assert.equal(await search.inputValue(),'Alex');assert.equal(await page.getByRole('button',{name:'Sort: Name Z–A',exact:true}).count(),1);
  await profile.getByRole('button',{name:'Edit',exact:true}).click();await profile.getByRole('button',{name:'Delete volunteer',exact:true}).click();await confirmation.getByText('3 current/upcoming assignments will be removed.',{exact:true}).waitFor();
  // Review failure is finite, retry works, and cannot silently delete.
  await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();
  await profile.getByRole('button',{name:'Edit',exact:true}).click();
  await page.route('**/admin/volunteers*',route=>route.request().method()==='POST'?route.abort():route.continue());
  await profile.getByRole('button',{name:'Delete volunteer',exact:true}).click();await confirmation.getByRole('button',{name:'Review again',exact:true}).waitFor();assert.equal(await confirmation.getByRole('button',{name:'Delete volunteer',exact:true}).count(),0);
  await page.unroute('**/admin/volunteers*');await confirmation.getByRole('button',{name:'Review again',exact:true}).click();await confirmation.getByRole('button',{name:'Delete volunteer',exact:true}).waitFor();
  if(width===390){sql(`update public.calendar_items set needed_count=needed_count+1 where id=${q(f.items[0])}`);await confirmation.getByRole('button',{name:'Delete volunteer',exact:true}).click();await confirmation.getByText('The profile or assignments changed. Review the latest impact before deleting.',{exact:true}).waitFor();assert.equal(value(`select deleted_at is null from public.volunteer_profiles where id=${q(f.volunteers[0])}`),'t');await confirmation.getByRole('button',{name:'Review again',exact:true}).click();await confirmation.getByRole('button',{name:'Delete volunteer',exact:true}).waitFor();}
  if(width===1920){
   let release;const gate=new Promise(resolve=>release=resolve);
   await page.route('**/admin/volunteers*',async route=>{if(route.request().method()==='POST'){await gate;await route.continue();}else await route.continue();});
   await confirmation.getByRole('button',{name:'Delete volunteer',exact:true}).click();await confirmation.getByRole('button',{name:'Deleting…',exact:true}).waitFor();
   await page.keyboard.press('Escape');assert(await confirmation.isVisible());assert(await confirmation.getByRole('button',{name:'Cancel',exact:true}).isDisabled());
   assert.equal(value(`select deleted_at is null from public.volunteer_profiles where id=${q(f.volunteers[0])}`),'t','No optimistic row removal');
   release();await page.getByText('Volunteer deleted. Past project history is retained.',{exact:true}).waitFor();await page.waitForLoadState('networkidle');
   assert.equal(await page.getByRole('button',{name:'Alex Morgan',exact:true}).count(),0);assert.equal(await search.inputValue(),'Alex');
   assert.equal(value(`select deleted_at is not null from public.volunteer_profiles where id=${q(f.volunteers[0])}`),'t');
   assert.equal(value(`select count(*) from public.calendar_assignments where volunteer_profile_id=${q(f.volunteers[0])} and lifecycle='active' and calendar_item_id=any(array[${f.items.map(q)}]::uuid[])`),'0');
   await page.screenshot({path:path.join(output,'deleted-directory-1920.png')});
   await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByRole('button',{name:'Alex Morgan',exact:true}).count(),0);
   await page.goto(`http://localhost:3000/admin/calendar?view=day&date=${historicDay}`,{waitUntil:'networkidle'});
   await page.getByText('Alex Morgan · Deleted volunteer',{exact:true}).first().waitFor();assert.equal(await page.getByRole('button',{name:'Contact Alex Morgan',exact:true}).count(),0);
   await page.screenshot({path:path.join(output,'historical-calendar-1920.png')});
   await page.goto(`http://localhost:3000/admin/calendar?view=day&date=${f.day}`,{waitUntil:'networkidle'});assert(!(await page.locator('body').innerText()).includes('Alex Morgan'));
   await context.addCookies([{name:'pl-volunteer-schedule',value:f.token,domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);await page.goto('http://localhost:3000/v/schedule',{waitUntil:'networkidle'});assert.equal(await page.getByText('Welcome, Alex',{exact:true}).count(),0);assert(!(await page.locator('body').innerText()).includes('Deleted volunteer'),'Public no-access never reveals deletion');
  }else await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(external,0);assert.deepEqual(errors.filter(message=>!message.includes('Failed to fetch')),[]);results.push({width,axeViolations:violations.length,overflow:false,externalRequests:external,dirtyProtection:true,reviewRetry:true});
  await context.close();console.log(`PASS ${width}px deletion impact, keyboard/focus, dirty protection, preserved search/sort, review retry, no overflow`);
 }
 fs.writeFileSync(path.join(output,process.argv.includes('--history-only')?'history-results.json':'results.json'),JSON.stringify(results,null,2)+'\n');
}finally{
 await browser?.close();if(server){server.stdin.end('stop');await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill();resolve();},5000);server.once('exit',()=>{clearTimeout(timer);resolve();});});}
 await f.cleanup();
}
