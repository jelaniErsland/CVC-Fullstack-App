import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import {fixture,q,value} from './12-47-local-fixtures.mjs';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';
const f=await fixture(true);
const browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
try {
  for(let i=0;i<3;i++)value(f.auth(`select public.create_manual_volunteer_profile(${q(f.ws)},${q(JSON.stringify({fullName:'Batch fixture '+i,email:`batch-${i}-${f.ws}@example.invalid`}))})`));
  const context=await browser.newContext({viewport:{width:390,height:900}});
  await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:3000/admin/announcements',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Review recipients',exact:true}).click();
  await page.getByRole('checkbox',{name:'Send one individual email to each of these 6 recipients.'}).check();
  await page.getByRole('button',{name:'Confirm send to 6 recipients'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('article').length===6&&[...document.querySelectorAll('article')].every(e=>e.textContent.includes('sent ·'))&&!document.body.innerText.includes('Working…'),null,{timeout:60000});
  assert.equal(value(`select count(*) from public.communication_operations where workspace_id=${q(f.ws)}`),'1');
  assert.equal(value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)} and state='sent' and attempt=1`),'6');
  assert.equal(value(`select count(*) from public.communication_recipients where workspace_id=${q(f.ws)} and state<>'sent'`),'0');
  assert.deepEqual(errors,[]);
  console.log('PASS: one 390px UI confirmation delivered six local recorded welcome messages across the five-recipient server batch boundary; one operation, six unique sent recipients, no extra click or retry, no console errors. Real email 0.');
} finally {await browser.close();await f.cleanup();}
