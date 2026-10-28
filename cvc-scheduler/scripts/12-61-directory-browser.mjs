// Production-mode local DB57 fixtures only. No hosted/provider traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import nextEnv from '@next/env';
import {chromium} from 'playwright';
import {fixture,sql,q,value} from './12-47-local-fixtures.mjs';
import {reminderFingerprint} from './reminder-database-local-fixture.mjs';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';
nextEnv.loadEnvConfig(process.cwd());assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'127.0.0.1');
assert.equal(value("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations"),'57|20261026120000');
const output=path.resolve('../previews/12-61-app-only');fs.mkdirSync(output,{recursive:true});
const f=await fixture(true),results=[],audits=[];let browser,server,currentPage,log='';
const original='I have helped with electrical work and framing on several projects.';
const negative="I don't have electrical experience, but I'd like to learn.";
const long='This is an unmodified volunteer experience response. '.repeat(15)+"I don't have electrical experience. I have used a+b measurements. "+'There is more context about helping on projects. '.repeat(20);
const history={skillsExperience:{categories:['Electrical assist'],details:original,physicalWorkNotes:'PRIVATE PHYSICAL'}};
const read=id=>JSON.parse(value(`select row_to_json(v) from public.volunteer_profiles v where id=${q(id)}`));
const update=(id,congregation,days,experience,snapshot={},lifecycle='active')=>sql(`update public.volunteer_profiles set congregation=${q(congregation)},available_work_days=${q('{'+days.join(',')+'}')},skills_experience=${q(experience)},skills_help_snapshot=${q(JSON.stringify(snapshot))},lifecycle=${q(lifecycle)},email='household@example.invalid',profile_notes=repeat('PRIVATE PROFILE ',100) where id=${q(id)}`);
try {
 update(f.volunteers[0],'Belgrade',['Monday'],original,history);update(f.volunteers[1],'Bozeman',['Wednesday'],negative);
 update(f.volunteers[2],'Helena',['Friday'],null,{skillsExperience:{categories:['Painting'],details:'I have helped with welding and roofing.'}},'inactive');
 const jordan=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:'Jordan Smith',email:'household@example.invalid'}))})`));update(jordan,'Bozeman',['Wednesday'],'Electrical work and framing.');
 const rowan=value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:'Rowan Lane',email:'household@example.invalid'}))})`));update(rowan,'Helena',['Friday'],long);
 sql(`update public.volunteer_profiles set after_hours_security_availability='yes',available_two_plus_days='yes',housing_option='no' where id=${q(f.volunteers[0])}`);
 server=spawn(process.execPath,['scripts/reminder-workspace-browser.mjs','--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
 await new Promise((resolve,reject)=>{const poll=setInterval(()=>{if(log.includes('REMINDER_UI_READY')){clearInterval(poll);resolve();}else if(server.exitCode!==null){clearInterval(poll);reject(Error(log.slice(-2000)));}},50);setTimeout(()=>{clearInterval(poll);reject(Error('Fixture server deadline'));},30000).unref();});
 browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
 for(const width of [320,390,430,768,1280,1440,1920,2560]){
  update(f.volunteers[0],'Belgrade',['Monday'],original,history);
  const context=await browser.newContext({viewport:{width,height:width<640?900:1000},reducedMotion:'reduce'});let external=0,actions=0;const errors=[];
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():(external++,route.abort()));
  await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const page=await context.newPage();currentPage=page;page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&r.headers()['next-action'])actions++;});
  await page.goto('http://localhost:3000/admin/volunteers',{waitUntil:'networkidle'});const search=page.getByPlaceholder('Search volunteers or skills…');await search.waitFor();
  await page.addScriptTag({path:path.resolve('node_modules/axe-core/axe.min.js')});
  const audit=async name=>{const v=await page.evaluate(async()=>{const target=[...document.querySelectorAll('dialog[open]')].at(-1)??document.querySelector('#main-content');const r=await window.axe.run(target,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>n.target)}));});audits.push({width,name,violations:v});assert.deepEqual(v,[],name+' accessibility');};
  const shot=async(name,all=false)=>{if(all||[390,1440].includes(width)){if(['match-context','negative-context','long-excerpt','full-response'].includes(name))await page.getByRole('region',{name:'Skills and experience match'}).first().scrollIntoViewIfNeeded();if(width<640&&['match-context','negative-context','long-excerpt','full-response'].includes(name))await page.evaluate(()=>scrollBy(0,90));await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:name==='full-response'});}};
  const count=async n=>assert.equal(await page.locator('article').count(),n);
  const filter=page.getByRole('dialog',{name:'Filter volunteers',exact:true});
  const open=async()=>{await page.getByRole('button',{name:/^Filters/}).click();await filter.waitFor();};
  const term=filter.getByRole('searchbox',{name:'Search skills or experience',exact:true});
  const add=async(text,button=false)=>{await term.fill(text);if(button)await filter.getByRole('button',{name:'Add experience term',exact:true}).click();else await term.press('Enter');};
  const show=async n=>{await filter.getByRole('button',{name:`Show ${n} ${n===1?'volunteer':'volunteers'}`,exact:true}).click();await count(n);};
  const backdrop=()=>page.mouse.click(2,width<640?2:150);
  const profile=page.getByRole('dialog',{name:'Alex Morgan',exact:true});
  const edit=async()=>{await profile.getByRole('button',{name:'Edit',exact:true}).click();await profile.getByRole('button',{name:'Save changes',exact:true}).waitFor();assert.equal(await page.getByRole('group',{name:'Structured skills',exact:true}).count(),0);assert(await profile.evaluate(e=>e.contains(document.activeElement)),'Profile/Edit mode change must keep focus in the sheet');};
  const dismiss=async method=>{if(method==='backdrop')await backdrop();else if(method==='Escape')await page.keyboard.press('Escape');else await profile.getByRole('button',{name:method==='X'?'Close volunteer editor':'Cancel',exact:true}).click();};
  const before=reminderFingerprint(),pureActions=actions;
  await count(5);assert.equal(await page.getByRole('region',{name:'Skills and experience match'}).count(),0);await audit('directory');
  const sorts=['Name A–Z','Name Z–A','Congregation A–Z','Recently added','Oldest added','Schedule-ready first','Active first'];
  for(const label of sorts){await page.getByRole('button',{name:/^Sort:/}).click();await page.getByRole('menuitemradio',{name:label,exact:true}).click();await count(5);}
  await page.getByRole('button',{name:/^Sort:/}).click();assert.deepEqual(await page.getByRole('menuitemradio').allTextContents(),sorts);await shot('sort');await audit('sort');await page.keyboard.press('Escape');
  await search.fill('ELECT');await count(4);assert.equal(await page.locator('article mark').count()>0,true);await audit('main-experience-search');
  await search.fill('Alex');await count(1);assert.equal(await page.getByRole('region',{name:'Skills and experience match'}).count(),0);
  await search.fill('welding');await count(1);await page.getByText('Questionnaire experience response',{exact:true}).waitFor();
  await search.fill('painting');await count(1);await page.getByText('Historical questionnaire categories',{exact:true}).waitFor();await search.fill('');
  await open();await audit('filters');await shot('filters');await add('electrical');await filter.getByRole('heading',{name:'Skills & experience',exact:true}).scrollIntoViewIfNeeded();await shot('one-term');await audit('one-term');
  await term.fill('ELECTRICAL');await term.press('Enter');assert.equal(await filter.getByRole('group',{name:'Experience search terms'}).getByRole('button').count(),1);await term.fill('');
  await add('framing',true);await shot('multiple-terms');await audit('multiple-terms');await show(2);
  await page.getByRole('button',{name:'Filters · 1',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'Skills and experience match'}).count(),2);await shot('match-context');await audit('match-context');
  await open();const congregationSearch=filter.getByRole('searchbox',{name:'Search congregations',exact:true});
  await congregationSearch.fill('bel');assert.equal(await filter.getByRole('group',{name:'Congregation',exact:true}).getByRole('button').count(),1);await filter.getByRole('group',{name:'Congregation',exact:true}).getByRole('button',{name:'Belgrade',exact:true}).press('Space');await shot('congregation-search');await audit('congregation-search');
  await congregationSearch.fill('boz');await filter.getByRole('group',{name:'Congregation',exact:true}).getByRole('button',{name:'Bozeman',exact:true}).press('Enter');await congregationSearch.fill('');
  await filter.getByRole('group',{name:'Status',exact:true}).getByRole('button',{name:'Active',exact:true}).click();await filter.getByRole('button',{name:'Monday',exact:true}).click();await filter.getByRole('button',{name:'Wednesday',exact:true}).click();await shot('combined-filters');await audit('combined-filters');await show(2);await page.getByRole('button',{name:'Filters · 4',exact:true}).waitFor();
  await page.getByRole('button',{name:/^Sort:/}).click();await page.getByRole('menuitemradio',{name:'Congregation A–Z',exact:true}).click();assert.deepEqual(await page.locator('article h2 button').allTextContents(),['Alex MorganBelgrade','Jordan SmithBozeman']);await shot('combined-results');
  await page.getByRole('button',{name:'Remove Belgrade filter',exact:true}).click();await count(1);await open();await filter.getByRole('button',{name:'Clear congregation',exact:true}).click();await show(2);
  await open();await filter.getByRole('button',{name:'Clear all',exact:true}).click();await show(5);
  await open();await add('electrical');await show(4);await search.fill('Casey');await count(1);assert((await page.locator('article').innerText()).includes(negative));assert.equal(await page.locator('article mark').first().textContent(),'electrical');await shot('negative-context');await audit('negative-context');
  await search.fill('Rowan');await count(1);const full=page.getByRole('button',{name:/^Show full response/});await full.waitFor();assert(!(await page.locator('article').innerText()).includes(long));await shot('long-excerpt');await audit('long-excerpt');
  await full.press('Enter');assert.equal(await page.locator('article p[id]').textContent(),long.trim());await shot('full-response');await page.getByRole('button',{name:/^Show less/}).click();
  await search.fill('');await open();await filter.getByRole('button',{name:'Remove experience term electrical',exact:true}).press('Enter');await add('a+b');await show(1);assert.equal(await page.locator('article mark').textContent(),'a+b');
  await open();await filter.getByRole('button',{name:'Clear skills & experience',exact:true}).click();await add('not-recorded-quantum');await show(0);await page.getByRole('heading',{name:'No volunteers match these filters',exact:true}).waitFor();await audit('no-match');await page.getByRole('button',{name:'Clear filters',exact:true}).click();await count(5);
  await open();await filter.getByRole('group',{name:'After-hours security',exact:true}).getByRole('button',{name:'Yes',exact:true}).click();await show(1);await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await open();await add('x'.repeat(120));assert(await filter.locator('[data-sheet-scroll]').evaluate(node=>node.scrollWidth<=node.clientWidth),'Long term cannot overflow filter body');await audit('long-term-chips');await show(0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Long active term cannot overflow page');await page.getByRole('button',{name:'Clear filters',exact:true}).click();await count(5);
  assert.equal(actions,pureActions,'Terms, search, sort, chips, excerpts and filters are local');assert.equal(reminderFingerprint(),before,'All public/Auth data and sequences unchanged by discovery');
  await search.fill('Alex');const row=page.getByRole('button',{name:'Alex Morgan',exact:true});await row.click();await profile.waitFor();await profile.getByText('Loading schedule…').waitFor({state:'hidden'});await shot('profile');await audit('profile');
  assert.equal(await profile.getByText('Alex Morgan',{exact:true}).count(),1);assert.equal(await profile.getByText('Belgrade',{exact:true}).count(),1);assert((await profile.innerText()).includes(original));
  for(const method of ['backdrop','Escape','X']){if(method==='backdrop')await backdrop();else if(method==='Escape')await page.keyboard.press('Escape');else await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();await profile.waitFor({state:'hidden'});assert.equal(await search.inputValue(),'Alex');assert.equal(await row.evaluate(e=>e===document.activeElement),true);await row.click();}
  await edit();await shot('edit');await audit('edit');await profile.getByRole('button',{name:'Close volunteer editor',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert(await profile.evaluate(e=>e.contains(document.activeElement)),JSON.stringify(await page.evaluate(()=>({active:document.activeElement?.tagName,activeRole:document.activeElement?.getAttribute('aria-label'),modals:[...document.querySelectorAll('dialog:modal')].map(e=>e.getAttribute('aria-label'))}))));
  for(const state of ['focus-only','restore-text','restore-weekday'])for(const method of ['backdrop','Escape','X','Cancel']){
   const name=profile.locator('[name="fullName"]');await name.focus();if(state==='restore-text'){const initial=await name.inputValue();await name.fill(initial+' changed');await name.fill(initial);}if(state==='restore-weekday'){const day=profile.getByRole('checkbox',{name:'Wednesday',exact:true});await day.check();await day.uncheck();}
   await dismiss(method);assert.equal(await page.getByRole('dialog',{name:'Discard unsaved changes?',exact:true}).count(),0);await profile.getByRole('button',{name:'Edit',exact:true}).waitFor();await edit();
  }
  const geometry=[];
  for(const kind of ['edit','add']){
   if(kind==='add'){await dismiss('Cancel');await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();await page.getByRole('button',{name:'+ Add volunteer',exact:true}).click();}
   const dialog=kind==='add'?page.getByRole('dialog',{name:'Add volunteer',exact:true}):profile;await dialog.locator('details').evaluateAll(nodes=>nodes.forEach(n=>n.open=true));
   const pane=dialog.locator('[data-sheet-scroll="volunteer editor"]'),save=dialog.getByRole('button',{name:kind==='add'?'Save volunteer':'Save changes',exact:true}),footer=save.locator(kind==='add'?'..':'../..');
   const extent=await pane.evaluate(n=>n.scrollHeight-n.clientHeight);for(const fraction of [0,.25,.5,.75,1]){await pane.evaluate((n,x)=>n.scrollTop=x,extent*fraction);const box=await pane.boundingBox(),foot=await footer.boundingBox();assert(box.y+box.height<=foot.y+.5);}
   for(const name of ['congregation','preferredContactMethod','emergencyContactRelationship','profileNotes']){const field=dialog.locator(`[name="${name}"]`);await field.scrollIntoViewIfNeeded();const box=await field.boundingBox(),foot=await footer.boundingBox();assert(box.y+box.height<foot.y);}
   await pane.evaluate(n=>n.scrollTop=n.scrollHeight);const field=await dialog.locator('[name="profileNotes"]').boundingBox(),foot=await footer.boundingBox();geometry.push({kind,gap:foot.y-field.y-field.height});await shot(`${kind}-bottom`,true);await audit(`${kind}-bottom`);
  }
  await page.getByRole('button',{name:'Close volunteer editor',exact:true}).click();await row.click();await edit();
  const name=profile.locator('[name="fullName"]');await name.fill('Alex Morgan changed');
  for(const method of ['backdrop','Escape','X','Cancel']){await dismiss(method);const guard=page.getByRole('dialog',{name:'Discard unsaved changes?',exact:true});await guard.waitFor();if(method==='backdrop'){await shot('discard');await audit('discard');await guard.getByRole('button',{name:'Keep editing',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert(await guard.evaluate(e=>e.contains(document.activeElement)));await page.keyboard.press('Tab');assert(await guard.evaluate(e=>e.contains(document.activeElement)));}await guard.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await name.inputValue(),'Alex Morgan changed');}
  await dismiss('Cancel');await page.getByRole('button',{name:'Discard changes',exact:true}).click();await profile.getByRole('button',{name:'Edit',exact:true}).waitFor();await edit();
  const experienceDetails=profile.locator('details').filter({has:page.getByText('Experience & other support',{exact:true})});if(!await experienceDetails.evaluate(node=>node.open))await experienceDetails.locator('summary').click();await profile.getByRole('textbox',{name:'Skills and experience',exact:true}).fill(original+' Local saved text.');await profile.getByRole('button',{name:'Save changes',exact:true}).click();await profile.getByRole('button',{name:'Edit',exact:true}).waitFor();await profile.getByText(original+' Local saved text.',{exact:true}).waitFor();assert.deepEqual(read(f.volunteers[0]).skills_help_snapshot,history);await audit('saved-profile');
  await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();assert.equal(await search.inputValue(),'Alex');await page.getByRole('button',{name:'Sort: Congregation A–Z',exact:true}).waitFor();
  if(width===390){
   await row.click();await edit();const note=profile.locator('[name="profileNotes"]');await note.fill('PRIVATE draft not saved');
   const failure=async route=>route.request().method()==='POST'?route.abort():route.fallback();await page.route('**/admin/volunteers',failure);
   await profile.getByRole('button',{name:'Save changes',exact:true}).click();await profile.getByRole('alert').filter({hasText:'confirm this change'}).waitFor();assert.equal(await note.inputValue(),'PRIVATE draft not saved');await audit('save-failure');await page.unroute('**/admin/volunteers',failure);
   await dismiss('Cancel');await page.getByRole('button',{name:'Discard changes',exact:true}).click();await edit();await profile.locator('[name="profileNotes"]').fill('PRIVATE pending confirmed local note');
   const delayed=async route=>{if(route.request().method()==='POST')await new Promise(resolve=>setTimeout(resolve,1500));await route.fallback();};await page.route('**/admin/volunteers',delayed);
   await profile.getByRole('button',{name:'Save changes',exact:true}).click();await profile.getByRole('button',{name:'Saving…',exact:true}).waitFor();
   for(const method of ['Escape','X','Cancel','backdrop']){await dismiss(method);assert.equal(await page.getByRole('dialog',{name:'Discard unsaved changes?',exact:true}).count(),0);assert(await profile.isVisible());}
   await profile.getByRole('button',{name:'Edit',exact:true}).waitFor();await page.unroute('**/admin/volunteers',delayed);await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();
  }
  await open();await add('Local saved text');await show(1);await row.click();await edit();await dismiss('Cancel');await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();await page.getByRole('button',{name:'Filters · 1',exact:true}).waitFor();await count(1);assert.equal(await search.inputValue(),'Alex');await page.getByRole('button',{name:'Sort: Congregation A–Z',exact:true}).waitFor();
  const layout=await page.evaluate(()=>{const identity=document.querySelector('article h2 button'),name=identity.children[0].getBoundingClientRect(),cong=identity.children[1].getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,gap:cong.top-name.bottom,target:identity.getBoundingClientRect().height};});assert(!layout.overflow);assert.equal(layout.gap,4);assert(layout.target>=44);assert.deepEqual(errors,[]);assert.equal(external,0);
  results.push({width,...layout,geometry,pristineCases:12,dirtyPaths:4,external,errors,discoveryServerActions:0,readOnlyDiscovery:true});await context.close();console.log('PASS width '+width);
 }
 sql(`insert into public.volunteer_profiles(workspace_id,full_name,email,profile_source,manual_created_by_project_contact_id,manual_created_at,availability_snapshot,skills_help_snapshot)
  select ${q(f.ws)},'Scroll Fixture '||lpad(n::text,3,'0'),'scroll-'||n||'@example.invalid','manual',${q(f.contact)},now(),'{}','{}' from generate_series(1,60)n`);
 const scrollContext=[];
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
  const page=await context.newPage();await page.goto('http://localhost:3000/admin/volunteers',{waitUntil:'networkidle'});const search=page.getByPlaceholder('Search volunteers or skills…');await search.fill('Scroll Fixture');await page.getByRole('button',{name:/^Sort:/}).click();await page.getByRole('menuitemradio',{name:'Name Z–A',exact:true}).click();
  const trigger=page.getByRole('button',{name:'Scroll Fixture 001',exact:true});await trigger.scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);assert(before>1000);await trigger.click();const profile=page.getByRole('dialog',{name:'Scroll Fixture 001',exact:true});await profile.getByRole('button',{name:'Edit',exact:true}).click();await profile.getByRole('button',{name:'Cancel',exact:true}).click();await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();await profile.waitFor({state:'hidden'});const after=await page.evaluate(()=>scrollY);assert(Math.abs(after-before)<2);assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);assert.equal(await search.inputValue(),'Scroll Fixture');await page.getByRole('button',{name:'Sort: Name Z–A',exact:true}).waitFor();scrollContext.push({width,before,after,focusReturned:true});await context.close();
 }
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({results,audits,scrollContext,db:'57 / 20261026120000',providerCalls:0,productionMutations:0},null,2));console.log(JSON.stringify({widths:results.length,audits:audits.length,violations:audits.flatMap(a=>a.violations).length,output}));
} catch(error){if(currentPage){await currentPage.screenshot({path:path.join(output,'failure.png')});fs.writeFileSync(path.join(output,'failure-form.json'),JSON.stringify(await currentPage.locator('dialog[open]').evaluateAll(nodes=>nodes.map(node=>({label:node.getAttribute('aria-label'),details:[...node.querySelectorAll('details')].map(d=>({summary:d.querySelector('summary')?.textContent,open:d.open})),fields:[...node.querySelectorAll('textarea')].map(t=>({name:t.name,visible:t.getClientRects().length>0}))}))),null,2));}fs.writeFileSync(path.join(output,'failure-server.log'),log);throw error;}
finally {await browser?.close();if(server){server.stdin.end('stop');await new Promise(resolve=>server.once('exit',resolve));}await f.cleanup();}
