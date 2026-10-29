// Real production-mode sheets, disposable local DB58 fixtures, no hosted/provider traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import nextEnv from '@next/env';
import {chromium} from 'playwright';
import ts from 'typescript';
import {fixture,value} from './12-47-local-fixtures.mjs';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';

nextEnv.loadEnvConfig(process.cwd());
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'127.0.0.1');
assert.equal(value('select count(*)||\'|\'||max(version) from supabase_migrations.schema_migrations'),'58|20261028120000');
const baseline=process.argv.includes('--baseline');
const output=path.resolve('../previews/12-61-1-focus');fs.mkdirSync(output,{recursive:true});
const f=await fixture(true),results=[],audits=[];let server,browser,log='';

// Independent oracle for the actual sheet DOM; assertions below also require each named summary.
async function sequence(dialog){
 return dialog.locator('a[href],button,input:not([type="hidden"]),select,textarea,details > summary:first-of-type,[tabindex]').evaluateAll(nodes=>nodes.filter(n=>
  !n.matches(':disabled,[aria-disabled="true"]')&&!n.closest('[hidden],[inert]')&&
  (!n.hasAttribute('tabindex')||n.tabIndex>=0)&&n.checkVisibility({checkVisibilityCSS:true})
 ).map(n=>({tag:n.tagName,label:n.getAttribute('aria-label')||n.getAttribute('name')||n.textContent.trim().replace(/\s+/g,' '),href:n.getAttribute('href')})));
}
const active=page=>page.evaluate(()=>{const n=document.activeElement;return {tag:n.tagName,label:n.getAttribute('aria-label')||n.getAttribute('name')||n.textContent.trim().replace(/\s+/g,' '),href:n.getAttribute('href')};});
async function walk(page,dialog,name){
 const expected=await sequence(dialog);assert(expected.length>1);
 const first=dialog.locator('button').first();await first.focus();assert.deepEqual(await active(page),expected[0]);
 const move=async(key,previous,next,message)=>{
  await page.keyboard.press(key);
  // Chromium's native date input has month/day/year and picker keyboard stops
  // sharing one activeElement. Allow those three internal steps only, never a
  // skipped/repeated summary, BODY, or arbitrary repeated control.
  for(let segment=0;segment<3;segment++){
   const current=await active(page);
   if(JSON.stringify(current)!==JSON.stringify(previous)||!await page.evaluate(()=>document.activeElement.matches('input[type="date"]')))break;
   await page.keyboard.press(key);
  }
  assert.deepEqual(await active(page),next,message);
 };
 for(let i=1;i<=expected.length;i++)await move('Tab',expected[i-1],expected[i%expected.length],`${name} forward step ${i}`);
 for(let i=1;i<=expected.length;i++)await move('Shift+Tab',expected[(expected.length-i+1)%expected.length],expected[(expected.length-i)%expected.length],`${name} reverse step ${i}`);
 return expected;
}
try {
 server=spawn(process.execPath,['scripts/reminder-workspace-browser.mjs','--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
 server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
 await new Promise((resolve,reject)=>{const start=Date.now(),poll=setInterval(()=>{if(log.includes('REMINDER_UI_READY')){clearInterval(poll);resolve();}else if(server.exitCode!==null||Date.now()-start>30000){clearInterval(poll);reject(Error(log.slice(-2000)));}},50);});
 browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:1000}});const errors=[];let external=0;
  await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():(external++,route.abort()));
  await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/admin/volunteers',{waitUntil:'networkidle'});
  const search=page.getByPlaceholder('Search volunteers or skills…');await search.fill('Alex');
  const row=page.getByRole('button',{name:'Alex Morgan',exact:true});await row.click();
  const profile=page.getByRole('dialog',{name:'Alex Morgan',exact:true});await profile.waitFor();
  await profile.getByRole('button',{name:'Edit',exact:true}).waitFor();
  await profile.getByText('Loading schedule…').waitFor({state:'hidden'});
  const assignments=profile.locator('a[href*="/admin/calendar?"]');assert.equal(await assignments.count(),3);
  const support=profile.locator('summary').filter({hasText:'Other support'}),details=profile.locator('summary').filter({hasText:'Other profile details'});
  assert.equal(await support.count(),1);assert.equal(await details.count(),1);
  await assignments.last().focus();const forward=[await active(page)];
  for(let i=0;i<4;i++){await page.keyboard.press('Tab');forward.push(await active(page));}
  await profile.getByRole('button',{name:'Edit',exact:true}).focus();const reverse=[await active(page)];
  for(let i=0;i<4;i++){await page.keyboard.press('Shift+Tab');reverse.push(await active(page));}
  if(baseline){
   assert.equal(forward[1].label,'Edit','Exact live defect must reproduce before fixing');
   assert(!forward.slice(1).some(n=>n.tag==='SUMMARY'));
   results.push({width,forward,reverse});await context.close();continue;
  }
  assert.deepEqual(forward.slice(1).map(n=>n.label),['Other support','Other profile details','Edit','Close volunteer profile']);
  assert.deepEqual(reverse.slice(1,3).map(n=>n.label),['Other profile details','Other support']);
  const profileOrder=await walk(page,profile,'Profile');assert.equal(profileOrder.filter(n=>n.tag==='SUMMARY').length,2);
  await page.addScriptTag({path:path.resolve('node_modules/axe-core/axe.min.js')});
  const audit=async(name,dialog)=>{const violations=await dialog.evaluate(async node=>(await window.axe.run(node,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>v.id));assert.deepEqual(violations,[],name);audits.push({width,name,violations});};
  await support.focus();assert(await support.evaluate(n=>n.matches(':focus-visible')));assert.notEqual(await support.evaluate(n=>getComputedStyle(n).outlineStyle),'none');
  await page.keyboard.press('Enter');assert(await support.evaluate(n=>n.parentElement.open));
  await page.keyboard.press('Space');assert(!await support.evaluate(n=>n.parentElement.open));
  await details.focus();await page.keyboard.press('Enter');await walk(page,profile,'Expanded Profile');await audit('Profile',profile);
  await page.screenshot({path:path.join(output,`profile-${width}.png`)});
  for(const method of ['Escape','X','backdrop']){
   if(method==='Escape')await page.keyboard.press('Escape');else if(method==='X')await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();else await page.mouse.click(2,width<640?2:150);
   await profile.waitFor({state:'hidden'});assert(await row.evaluate(n=>n===document.activeElement));assert.equal(await search.inputValue(),'Alex');await row.click();
  }
  await profile.getByRole('button',{name:'Edit',exact:true}).click();await profile.getByRole('button',{name:'Save changes',exact:true}).waitFor();
  const editOrder=await walk(page,profile,'Edit closed disclosures');assert.equal(editOrder.filter(n=>n.tag==='SUMMARY').length,3);
  for(const summary of await profile.locator('summary').all()){
   await summary.focus();const wasOpen=await summary.evaluate(n=>n.parentElement.open);
   await page.keyboard.press('Enter');assert.equal(await summary.evaluate(n=>n.parentElement.open),!wasOpen);
   if(wasOpen){await page.keyboard.press('Space');assert(await summary.evaluate(n=>n.parentElement.open));}
  }
  const expandedEditOrder=await walk(page,profile,'Edit expanded disclosures');assert(expandedEditOrder.some(n=>n.tag==='TEXTAREA'));assert(expandedEditOrder.some(n=>n.tag==='SELECT'));
  await audit('Expanded Edit',profile);await page.screenshot({path:path.join(output,`edit-${width}.png`)});
  const name=profile.locator('[name="fullName"]');await name.fill('Alex Morgan unsaved');await profile.getByRole('button',{name:'Cancel',exact:true}).click();
  const guard=page.getByRole('dialog',{name:'Discard unsaved changes?',exact:true});await guard.waitFor();
  assert.deepEqual((await walk(page,guard,'Discard')).map(n=>n.label),['Keep editing','Discard changes']);await audit('Discard',guard);
  await page.keyboard.press('Escape');await guard.waitFor({state:'hidden'});assert(await profile.evaluate(n=>n.contains(document.activeElement)));assert.equal(await name.inputValue(),'Alex Morgan unsaved');
  await profile.getByRole('button',{name:'Close volunteer editor',exact:true}).click();await guard.getByRole('button',{name:'Keep editing',exact:true}).click();assert(await profile.evaluate(n=>n.contains(document.activeElement)));assert.equal(await name.inputValue(),'Alex Morgan unsaved');
  await profile.getByRole('button',{name:'Cancel',exact:true}).click();await guard.getByRole('button',{name:'Discard changes',exact:true}).click();await profile.getByRole('button',{name:'Edit',exact:true}).waitFor();
  await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();
  await page.getByRole('button',{name:/^Filters/}).click();const filters=page.getByRole('dialog',{name:'Filter volunteers',exact:true});await filters.waitFor();
  const filterOrder=await walk(page,filters,'Filters');
  await filters.getByRole('searchbox',{name:'Search congregations',exact:true}).fill('test');
  await filters.getByRole('searchbox',{name:'Search skills or experience',exact:true}).fill('local term');await page.keyboard.press('Enter');
  await walk(page,filters,'Filters with selected term');await audit('Filters',filters);await page.screenshot({path:path.join(output,`filters-${width}.png`)});
  await page.keyboard.press('Escape');await filters.waitFor({state:'hidden'});assert(await page.getByRole('button',{name:/^Filters/}).evaluate(n=>n===document.activeElement));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.equal(external,0);
  results.push({width,forward,reverse,profileOrder,editOrder,expandedEditOrder,filterOrder,errors,external});await context.close();console.log('PASS complete focus traversal '+width);
 }
 if(!baseline){
  // Exercise the real helper source against boundary cases not present in every profile.
  const context=await browser.newContext(),page=await context.newPage();
  await page.setContent(`<button>Background</button><dialog aria-label="Boundary fixture">
   <button>First</button><details><summary>Disclosure</summary><a href="#revealed">Revealed link</a>
    <details><summary>Nested disclosure</summary><input aria-label="Nested input"></details></details>
   <span role="button" tabindex="0">Custom control</span><button>Last</button>
   <button disabled>Disabled</button><fieldset disabled><input aria-label="Disabled fieldset"></fieldset>
   <button hidden>Hidden</button><div hidden><button>Hidden ancestor</button></div>
   <div inert><button>Inert</button></div><button style="visibility:hidden">Invisible</button>
   <input type="hidden"><button tabindex="-1">Programmatic only</button><button tabindex="-2">Negative tab index</button>
   <div tabindex="-1" aria-disabled="true">Disabled custom control</div><span>Noninteractive</span>
  </dialog>`);
  const helper=ts.transpileModule(fs.readFileSync('lib/volunteers/sheetFocus.ts','utf8').replace(/^import type .*;\r?$/m,'').replace('export function ','function '),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
  await page.addScriptTag({content:helper+'\nconst sheet=document.querySelector("dialog");sheet.addEventListener("keydown",containVolunteerSheetFocus);sheet.showModal();'});
  const dialog=page.getByRole('dialog');assert.deepEqual((await walk(page,dialog,'Excluded controls')).map(n=>n.label),['First','Disclosure','Custom control','Last']);
  const summary=page.locator('summary').first();await summary.focus();await page.keyboard.press('Enter');
  assert.deepEqual((await walk(page,dialog,'Revealed controls')).map(n=>n.label),['First','Disclosure','Revealed link','Nested disclosure','Custom control','Last']);
  const nested=page.locator('summary').last();await nested.focus();await page.keyboard.press('Space');
  assert((await walk(page,dialog,'Nested revealed control')).some(n=>n.label==='Nested input'));
  await summary.focus();await page.keyboard.press('Enter');assert.deepEqual((await walk(page,dialog,'Reclosed outer disclosure')).map(n=>n.label),['First','Disclosure','Custom control','Last']);
  await context.close();
 }
 fs.writeFileSync(path.join(output,baseline?'before.json':'after.json'),JSON.stringify({baseline,results,audits,boundaryFixtures:!baseline,db:'58 / 20261028120000',providerCalls:0,productionMutations:0},null,2));
 console.log(JSON.stringify({baseline,widths:results.length,audits:audits.length,output}));
} catch(error){fs.writeFileSync(path.join(output,'failure-server.log'),log);throw error;}
finally {await browser?.close();if(server){const exited=new Promise(resolve=>server.once('exit',resolve));server.stdin.end('stop');await exited;}await f.cleanup();}
