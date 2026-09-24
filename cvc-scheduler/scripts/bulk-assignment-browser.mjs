import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createBrowserClient } from '@supabase/ssr';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';

export async function createBrowserAdmin() {
  const status=spawnSync('powershell.exe',['-NoProfile','-Command','npx supabase status --output json'],{encoding:'utf8',windowsHide:true});
  assert.equal(status.status,0);
  const local=JSON.parse(status.stdout.slice(status.stdout.indexOf('{')));
  assert.equal(new URL(local.API_URL).hostname,'127.0.0.1');
  const jar=new Map();
  const client=createBrowserClient(local.API_URL,local.ANON_KEY,{isSingleton:false,cookies:{getAll:()=>[...jar.values()],setAll: cookies=>cookies.forEach(c=>jar.set(c.name,c))}});
  const password=randomBytes(20).toString('base64url')+'Aa1!';
  const {data,error}=await client.auth.signUp({email:`bulk-ui-${randomBytes(10).toString('hex')}@example.invalid`,password});
  assert(!error && data.user && data.session,'Local fixture sign-in');
  return {id:data.user.id,jar};
}

export async function captureBulkAssignments(admin) {
  const output=path.resolve('..','previews','12.47-local-review');
  await mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
  try {
    for(const width of [1440,390]) {
      const context=await browser.newContext({viewport:{width,height:1000}});
      await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
      await context.addCookies([...admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})));
      const page=await context.newPage(); const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.goto('http://127.0.0.1:3000/admin/calendar?view=week&date=2026-10-01',{waitUntil:'networkidle'});
      assert((await page.locator('body').innerText()).includes('Assign across Calendar items'), (await page.locator('body').innerText()).slice(0,1800));
      await page.getByText('Assign across Calendar items',{exact:true}).click();
      const planner=page.locator('details').filter({has:page.getByText('Assign across Calendar items',{exact:true})});
      await planner.getByLabel('2026-10-01 · Local task 0',{exact:true}).check();
      await planner.getByLabel('2026-10-02 · Local task 1',{exact:true}).check();
      await planner.getByLabel('Local Volunteer 0',{exact:true}).check();
      await planner.getByLabel('Local Volunteer 1',{exact:true}).check();
      await planner.getByRole('button',{name:'Review assignments',exact:true}).click();
      await planner.getByRole('button',{name:'Confirm 4 assignments'}).waitFor();
      await planner.getByRole('heading',{name:'Review assignments'}).scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
      await page.screenshot({path:path.join(output,`multi-day-assignment-preview-${width}.png`),fullPage:true});
      assert.deepEqual(errors,[]);
      await context.close();
    }
  } finally {await browser.close();}
}
