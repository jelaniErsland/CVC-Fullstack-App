// Production-mode LOCAL fixture only. Hosted traffic and provider calls denied.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import nextEnv from '@next/env';
import { chromium } from 'playwright';
import { fixture, sql, q, value } from './12-47-local-fixtures.mjs';
import { reminderFingerprint } from './reminder-database-local-fixture.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

nextEnv.loadEnvConfig(process.cwd());
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'127.0.0.1');
const output=path.resolve(process.env.VOLUNTEER_FILTER_EVIDENCE_DIR??'../previews/12-60-volunteers');fs.mkdirSync(output,{recursive:true});
const f=await fixture(true);let browser,server,log='';const results=[];const audits=[];
const update=(id,name,congregation,days,skills,lifecycle='active')=>sql(`update public.volunteer_profiles set full_name=${q(name)},congregation=${q(congregation)},available_work_days=${q('{'+days.join(',')+'}')},skills_help_snapshot=${q(JSON.stringify({skillsExperience:{categories:skills}}))}::jsonb,lifecycle=${q(lifecycle)},email='household@example.invalid' where id=${q(id)};`);
try {
 update(f.volunteers[0],'Alex Morgan','Belgrade',['Monday'],['Electrical assist','Framing']);
 update(f.volunteers[1],'Casey Jordan','Bozeman',['Wednesday'],['Electrical assist']);
 update(f.volunteers[2],'Riley Chen','Helena',['Friday'],['Framing'],'inactive');
 const jordan=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:'Jordan Smith',email:'household@example.invalid'}))})`));
 update(jordan,'Jordan Smith','Bozeman',['Wednesday'],['Electrical assist','Framing']);
 const duplicate=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:'Alex Morgan',email:'household@example.invalid'}))})`));
 update(duplicate,'Alex Morgan','Helena',['Saturday'],['General cleanup']);
 for(let i=0;i<10;i++){const id=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:['Avery Scott','Cameron Lee','Dana Brooks','Emery Green','Harper Davis','Jamie Taylor','Morgan Reed','Parker Bell','Quinn Hayes','Rowan Lane'][i],email:'household@example.invalid'}))})`));update(id,['Avery Scott','Cameron Lee','Dana Brooks','Emery Green','Harper Davis','Jamie Taylor','Morgan Reed','Parker Bell','Quinn Hayes','Rowan Lane'][i],['Belgrade','Bozeman','Helena'][i%3],['Thursday'],[['Painting'],['Food service'],['General cleanup'],['Plumbing assist']][i%4]);}
 server=spawn(process.execPath,['scripts/reminder-workspace-browser.mjs','--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});server.stdout.on('data',s=>log+=s);server.stderr.on('data',s=>log+=s);
 await new Promise((resolve,reject)=>{const until=setInterval(()=>{if(log.includes('REMINDER_UI_READY')){clearInterval(until);resolve();}else if(server.exitCode!==null){clearInterval(until);reject(Error(log.slice(-2000)));}},50);setTimeout(()=>{clearInterval(until);reject(Error('Local server startup deadline'));},30000).unref();});
 browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
 for(const width of [320,390,430,768,1280,1440,1920,2560]){
  const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});let external=0;const errors=[];
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():(external++,route.abort()));
  await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/admin/volunteers',{waitUntil:'networkidle'});
  await page.getByPlaceholder('Search volunteers or skills…').waitFor();
  const before=reminderFingerprint();let actions=0;page.on('request',r=>{if(r.method()==='POST'&&r.headers()['next-action'])actions++;});
  if(process.env.VOLUNTEER_AXE_PATH)await page.addScriptTag({path:process.env.VOLUNTEER_AXE_PATH});
  const audit=async name=>{if(!process.env.VOLUNTEER_AXE_PATH)return;const a=await page.evaluate(async()=>{const dialog=document.querySelector('[role="dialog"][aria-labelledby]');const r=await window.axe.run(dialog??document.querySelector('#main-content'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});audits.push({width,name,violations:a});assert.deepEqual(a,[],name+' accessibility');};
  const shot=async name=>{await page.screenshot({path:path.join(output,`${name}-${width}.png`),style:'nextjs-portal { visibility:hidden; }'});};
  const noOverflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width}px overflow`);
  const search=page.getByPlaceholder('Search volunteers or skills…');
  const open=async()=>{await page.getByRole('button',{name:/^Filters/}).click();await page.getByRole('dialog',{name:'Filter volunteers'}).waitFor();};
  const drawer=page.getByRole('dialog',{name:'Filter volunteers'});
  assert.equal(await page.locator('article').count(),15);await noOverflow();await audit('directory');await shot('directory');
  await search.fill('ELECTRICAL');assert.equal(await page.locator('article').count(),3);assert.equal(await page.locator('article').first().getByText('Electrical assist',{exact:true}).count(),1);if([390,1440].includes(width))await shot('skill-search');await search.fill('');
  await open();await noOverflow();await audit('filters');await shot('filters');
  assert.equal(await drawer.locator('select,input[type=checkbox]').count(),0);
  const dims=await drawer.evaluate(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,viewport:innerHeight}));assert(dims.width<=460);assert.equal(dims.height,dims.viewport);
  await drawer.getByRole('group',{name:'Status',exact:true}).getByRole('button',{name:'Active',exact:true}).click();
  await drawer.getByRole('group',{name:'Congregation',exact:true}).getByRole('button',{name:'Belgrade',exact:true}).click();await drawer.getByRole('group',{name:'Congregation',exact:true}).getByRole('button',{name:'Bozeman',exact:true}).click();
  if(width===1440)await shot('multiple-congregations');
  await drawer.getByRole('button',{name:'Monday',exact:true}).click();await drawer.getByRole('button',{name:'Wednesday',exact:true}).click();if([390,1440].includes(width))await shot('multiple-weekdays');
  await drawer.getByRole('group',{name:'Skills',exact:true}).getByRole('button',{name:'Electrical assist',exact:true}).click();await drawer.getByRole('group',{name:'Skills',exact:true}).getByRole('button',{name:'Framing',exact:true}).click();
  await drawer.getByRole('button',{name:'Show 2 volunteers',exact:true}).waitFor();await audit('selected-filters');if([390,1440].includes(width)){await drawer.getByRole('heading',{name:'Skills',exact:true}).scrollIntoViewIfNeeded();await drawer.getByRole('group',{name:'Skills',exact:true}).evaluate(e=>{e.scrollTop=0;});await shot('multiple-skills');}
  const footer=await drawer.locator('footer').boundingBox();assert(footer.y+footer.height<=960.5);
  const small=await drawer.locator('button,input').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width>0&&e.tabIndex>=0).filter(e=>e.getBoundingClientRect().height<43.9).map(e=>e.textContent));assert.deepEqual(small,[]);
  await drawer.getByRole('button',{name:'Show 2 volunteers',exact:true}).click();assert.equal(await page.locator('article').count(),2);await page.getByRole('button',{name:'Filters · 4',exact:true}).waitFor();if([390,1440].includes(width))await shot('selected-results');
  assert.equal(actions,0,'Search/filters/chips must perform no server actions');
  const first=page.locator('article').filter({has:page.getByRole('button',{name:'Alex Morgan',exact:true})});await first.getByRole('button',{name:'Alex Morgan',exact:true}).click();
  const profile=width<640?page.getByRole('dialog',{name:'volunteer profile'}):page.getByRole('complementary',{name:'Viewing volunteer Alex Morgan'});await profile.getByRole('heading',{name:'Skills',exact:true}).waitFor();await profile.getByText('Electrical assist',{exact:true}).waitFor();await profile.getByText('Loading schedule…').waitFor({state:'hidden'});if([390,1440].includes(width)){await profile.getByRole('heading',{name:'Skills',exact:true}).scrollIntoViewIfNeeded();await shot('profile-skills');}await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();await profile.waitFor({state:'hidden'});assert.equal(await page.locator('article').count(),2,'Opening/closing details preserves selections');
  await page.getByRole('button',{name:'Remove Electrical assist filter',exact:true}).click();await page.getByRole('button',{name:'Filters · 4',exact:true}).waitFor();
  await open();await drawer.getByRole('button',{name:'Clear skills',exact:true}).click();await drawer.getByRole('button',{name:/^Show 3 volunteers$/}).waitFor();await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent.startsWith('Filters'));
  await page.getByRole('button',{name:'Clear all',exact:true}).click();assert.equal(await page.locator('article').count(),15);
  await search.fill('no-recorded-skill-zz');await page.getByRole('heading',{name:'No volunteers match these filters'}).waitFor();if([390,1440].includes(width))await shot('zero-results');await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await search.fill('Alex Morgan');assert.equal(await page.locator('article').count(),2,'Same-name profiles remain separate');await search.fill('household@example.invalid');assert.equal(await page.locator('article').count(),15,'Shared household is never identity');await search.fill('');
  await page.getByRole('button',{name:'Filters',exact:true}).focus();await page.keyboard.press('f');await drawer.waitFor();
  const activeChoice=drawer.getByRole('group',{name:'Status',exact:true}).getByRole('button',{name:'Active',exact:true});await activeChoice.focus();await activeChoice.press('Space');assert.equal(await activeChoice.getAttribute('aria-pressed'),'true');await activeChoice.press('Enter');assert.equal(await activeChoice.getAttribute('aria-pressed'),'false');
  await drawer.getByLabel('Search congregations',{exact:true}).fill('bel');assert.equal(await drawer.getByRole('group',{name:'Congregation',exact:true}).getByRole('button').count(),1);await drawer.getByLabel('Search congregations',{exact:true}).fill('');
  await drawer.getByLabel('Search skills',{exact:true}).fill('elec');assert.equal(await drawer.getByRole('group',{name:'Skills',exact:true}).getByRole('button').count(),1);await drawer.getByLabel('Search skills',{exact:true}).fill('');
  await page.keyboard.press('Tab');assert(await drawer.evaluate(e=>e.contains(document.activeElement)));await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});
  assert.equal(reminderFingerprint(),before,'Filtering/detail reads preserve all public/Auth fixture data');await noOverflow();assert.deepEqual(errors,[]);assert.equal(external,0);results.push({width,drawer:dims,zeroFilterActions:true,readOnly:true,errors:[],externalRequests:0});await context.close();
 }
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({results,audits},null,2));console.log('PASS 12.60 eight-width real local Auth/RLS directory, OR/ALL semantics, chips, details, keyboard, 44px targets, read-only fingerprints and zero external/provider calls.');
} finally {await browser?.close();if(server){server.stdin.end('stop');await new Promise(resolve=>{const timer=setTimeout(()=>{server.kill();resolve();},5000);server.once('exit',()=>{clearTimeout(timer);resolve();});});}fs.writeFileSync(path.join(output,'fixture-server.log'),log);await f.cleanup();}
