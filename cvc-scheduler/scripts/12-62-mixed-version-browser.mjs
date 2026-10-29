// Exact old production application, local migrated DB58, synthetic identities only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import nextEnv from '@next/env';
import {fixture,value,q} from './12-47-local-fixtures.mjs';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';
nextEnv.loadEnvConfig(process.cwd());
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'127.0.0.1');
assert.equal(value("select count(*)||'|'||max(version) from supabase_migrations.schema_migrations"),'58|20261028120000');
const dir=process.env.REMINDER_FIXTURE_APP_DIR;assert(dir&&fs.existsSync(path.join(dir,'.next/BUILD_ID')),'Built exact-production Git export required');
const f=await fixture(true);let server,browser,log='';const passed=[];
const output=path.resolve('../previews/12-62-release-prep');fs.mkdirSync(output,{recursive:true});
try{
 server=spawn(process.execPath,['scripts/reminder-workspace-browser.mjs','--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
 server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
 await new Promise((resolve,reject)=>{const start=Date.now(),t=setInterval(()=>{if(log.includes('REMINDER_UI_READY')){clearInterval(t);resolve();}else if(server.exitCode!==null||Date.now()-start>30000){clearInterval(t);reject(Error(log.slice(-2000)));}},50);});
 browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});let external=0;const errors=[];
 await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():(external++,r.abort()));
 await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function route(url,heading){await page.goto('http://localhost:3000'+url,{waitUntil:'networkidle'});await page.getByRole('heading',{name:heading,exact:true}).first().waitFor();assert(!/Something went wrong|Application error/.test(await page.locator('body').innerText()));passed.push(url);}
 await route('/admin/dashboard','Overview');
 await route('/admin/volunteers','Volunteers');
 const search=page.getByPlaceholder('Search volunteers or skills…');await search.fill('Alex');assert.equal(await page.locator('article').count(),1);
 await page.getByRole('button',{name:/^Sort:/}).click();await page.getByRole('menuitemradio',{name:'Name Z–A',exact:true}).click();
 await page.getByRole('button',{name:/^Filters/}).click();const filters=page.getByRole('dialog',{name:'Filter volunteers',exact:true});await filters.getByRole('button',{name:'Show 1 volunteer',exact:true}).click();
 await page.getByRole('button',{name:'Alex Morgan',exact:true}).click();const profile=page.getByRole('dialog',{name:'Alex Morgan',exact:true});await profile.getByRole('button',{name:'Edit',exact:true}).click();await profile.getByRole('button',{name:'Save changes',exact:true}).waitFor();
 await profile.locator('textarea[name="profileNotes"]').fill('Mixed-version local compatibility');await profile.getByRole('button',{name:'Save changes',exact:true}).click();await profile.getByRole('button',{name:'Edit',exact:true}).waitFor();
 assert.equal(value(`select profile_notes from public.volunteer_profiles where id=${q(f.volunteers[0])}`),'Mixed-version local compatibility');
 await profile.getByRole('button',{name:'Close volunteer profile',exact:true}).click();assert.equal(await search.inputValue(),'Alex');
 await page.getByRole('button',{name:/Add volunteer/}).click();const add=page.getByRole('dialog',{name:'Add volunteer',exact:true});await add.getByLabel('Full name',{exact:true}).fill('Mixed Version Local');await add.getByLabel('Email',{exact:true}).fill('mixed-version@example.invalid');await add.getByRole('button',{name:'Save volunteer',exact:true}).click();await add.waitFor({state:'hidden'});
 assert.equal(value(`select count(*) from public.volunteer_profiles where workspace_id=${q(f.ws)} and full_name='Mixed Version Local' and deleted_at is null`),'1');passed.push('search/filter/sort/profile/edit-save/add-save');
 await search.fill('');await page.locator('summary[aria-label="More volunteer data actions"]').click();await page.getByRole('button',{name:'Export CSV',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();const csv=await (await download).path();assert((fs.readFileSync(csv,'utf8')).includes('Alex Morgan'));await page.getByRole('button',{name:'Close CSV',exact:true}).click();passed.push('CSV export');
 await page.getByRole('button',{name:'Import CSV',exact:true}).click();await page.getByLabel('CSV file').setInputFiles({name:'fixture.csv',mimeType:'text/csv',buffer:Buffer.from('Name,Email\nCSV Local,mixed-csv@example.invalid\n')});await page.getByRole('button',{name:'Review import',exact:true}).click();await page.getByRole('region',{name:'CSV match preview'}).waitFor();await page.getByRole('button',{name:/Save 1 reviewed rows/}).click();await page.getByText('1 added · 0 updated. No email sent.',{exact:true}).waitFor();await page.getByRole('button',{name:'Close CSV',exact:true}).click();passed.push('CSV preview/import');
 await route('/admin/calendar?view=day&date='+f.day,'Calendar');await page.getByText('Site preparation',{exact:true}).first().waitFor();
 await route('/admin/announcements','Communications');await page.getByRole('tab',{name:'Automatic reminders',exact:true}).click();await page.getByRole('region',{name:'Automatic reminders',exact:true}).waitFor();
 await route('/admin/quick-view?view=day&date='+f.day,'Project Quick View');
 await route('/admin/dashboard','Overview');await page.locator('[aria-label^="Current project:"]').first().waitFor();passed.push('authorized workspace context (legacy /admin/projects remains beta-contained)');
 const publicContext=await browser.newContext({viewport:{width:390,height:844}});await publicContext.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():(external++,r.abort()));
 const volunteer=await publicContext.newPage();await volunteer.goto('http://localhost:3000/',{waitUntil:'networkidle'});await volunteer.getByLabel('Email or phone number').fill(`fixture-${f.ws}-0@example.invalid`);await volunteer.getByRole('button',{name:'Open schedule',exact:true}).click();await volunteer.waitForURL('**/v/schedule');await volunteer.getByRole('region',{name:'Upcoming schedule'}).waitFor();await volunteer.getByText('Site preparation',{exact:true}).first().waitFor();passed.push('volunteer lookup/schedule');
 const anon=await browser.newContext();await anon.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());const anonymous=await anon.newPage();await anonymous.goto('http://localhost:3000/admin/volunteers',{waitUntil:'networkidle'});assert(anonymous.url().includes('/admin/login'));passed.push('anonymous login redirect');
 assert.equal(external,0);assert.deepEqual(errors,[]);
 const result={app:'19fe6a29d5b59941bb0612cf9e18fe85a080f474',db:58,passed,externalRequests:0,providerCalls:0,productionMutations:0};fs.writeFileSync(path.join(output,'mixed-version-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();if(server){server.stdin.end('stop');await new Promise(r=>server.once('exit',r));}await f.cleanup();}
