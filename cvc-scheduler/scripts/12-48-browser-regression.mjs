import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';
const phase=process.argv.includes('--before')?'before':'after';
const output=path.resolve('..','previews','12.48-batch-1',phase);fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
const context=await browser.newContext();
await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const go=route=>page.goto('http://127.0.0.1:3148'+route,{waitUntil:'networkidle'});
const shot=name=>page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
const capturedRoutes=[];
try {
  for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:width<500?844:1000});await go('/admin/dashboard');
    await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();await shot('overview-'+width);
    if(phase==='after') assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Overview reflow '+width);
  }
  console.log('PASS: Overview captures at five viewports ('+phase+').');
  if(phase==='before') process.exitCode=0;
  for(const route of ['/admin/quick-view','/qv','/admin/calendar']){
    for(const width of [1440,1024,768,390,320]){
      await page.setViewportSize({width,height:1000});
      await go(route+'?view=list&date=2026-10-05'+(route==='/admin/quick-view'?'&project=fixture-project':''));
      const item=()=>page.getByRole('button',{name:/Site preparation/}).first();
      await item().click();
      const dialog=page.getByRole('dialog',{name:'Calendar item inspector'});
      await dialog.waitFor();assert.equal(new URL(page.url()).pathname,route);
      assert(new URL(page.url()).searchParams.has('item'));
      if(route!=='/admin/calendar'){
        assert.equal(await dialog.getByRole('button',{name:/^(Save|Publish|Send|Archive|Remove|Duplicate|Edit)/}).count(),0);
        await shot((route==='/qv'?'bearer-component':'admin-quick-view')+'-selected-'+width);
        await dialog.waitFor(); // Capturing/resizing must not dismiss an unrelated inspector.
        const observed=new URL(page.url());capturedRoutes.push({route,width,url:observed.pathname+observed.search,context:'synthetic component fixture; no authenticated session or bearer'});
      }
      await page.reload({waitUntil:'networkidle'});await dialog.waitFor();
      await page.getByRole('button',{name:'Close calendar item inspector',exact:true}).filter({visible:true}).first().click();
      await dialog.waitFor({state:'hidden'});assert.equal(new URL(page.url()).pathname,route);assert(!new URL(page.url()).searchParams.has('item'));
      await item().click();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
      assert.equal(new URL(page.url()).pathname,route);assert(!new URL(page.url()).searchParams.has('item'));
      await page.reload({waitUntil:'networkidle'});assert.equal(await dialog.count(),0);
      await item().click();
      if(width<1024) await page.keyboard.press('Escape'); // Mobile inspector is modal.
      await page.getByRole('button',{name:'Month',exact:true}).filter({visible:true}).first().click();
      await page.waitForURL(u=>u.searchParams.get('view')==='month');assert.equal(new URL(page.url()).pathname,route);
      await page.goBack({waitUntil:'networkidle'});if(width>=1024) await dialog.waitFor();assert.equal(new URL(page.url()).pathname,route);
      await page.goForward({waitUntil:'networkidle'});await dialog.waitFor({state:'hidden'});
      await go(route+'?view=list&date=2026-10-05&day=2026-10-05');
      await page.getByRole(width < 640 ? 'dialog' : 'complementary',{name:/^Project day details$/i}).waitFor();
      if(width>=1024){ // Switching directly from day details to an item must not clear the new selection.
        await item().click();await dialog.waitFor();assert(new URL(page.url()).searchParams.has('item'));assert(!new URL(page.url()).searchParams.has('day'));
        await page.keyboard.press('Escape');
      }else{
        await page.getByRole('button',{name:'Close project day details',exact:true}).filter({visible:true}).click();
      }
      await page.getByRole('button',{name:'Open day details for the selected date',exact:true}).click();
      await page.keyboard.press('Escape');assert.equal(new URL(page.url()).pathname,route);assert(!new URL(page.url()).searchParams.has('day'));
      for(const view of ['Day','Week','Month','List']){
        await page.getByRole('button',{name:view,exact:true}).filter({visible:true}).first().click();
        await page.waitForURL(u=>u.searchParams.get('view')===view.toLowerCase());assert.equal(new URL(page.url()).pathname,route);
      }
      const dateBefore=new URL(page.url()).searchParams.get('date');
      await page.getByRole('button',{name:/^Next (day|week|month)$/}).click();await page.waitForURL(u=>u.searchParams.get('date')!==dateBefore);
      await page.getByRole('button',{name:/^Previous (day|week|month)$/}).click();await page.waitForURL(u=>u.searchParams.get('date')===dateBefore);
      // Filters are local state by existing contract; opening them clears the selected URL.
      if(width>=1024){await item().click();await page.getByRole('button',{name:'Open calendar filters',exact:true}).filter({visible:true}).click();assert(!new URL(page.url()).searchParams.has('item'));await page.getByLabel('Task name', {exact:true}).filter({visible:true}).fill('Lunch');await page.keyboard.press('Escape');}
      await go(route+'?view=list&date=2026-10-05&item=11111111-1111-4111-8111-000000000001&section=volunteers&token=ignored-fixture-value');
      await dialog.waitFor();await page.keyboard.press('Escape');await page.waitForURL(u=>!u.searchParams.has('token'));assert(!page.url().includes('ignored-fixture-value'));
      await go(route+'?view=list&date=2026-10-05&day=not-a-date');
      assert.equal(await page.getByRole('complementary',{name:'Project day details'}).count(),0);
      assert.equal(await page.getByRole('dialog',{name:/project day details/i}).count(),0);
      console.log('PASS: '+route+' '+width+' selection, close, Escape, reload/deep link, all views, date previous/next, history, project-day return and query isolation (component fixture).');
    }
  }
  assert.deepEqual(errors,[],'Browser runtime errors');
  fs.writeFileSync(path.join(output,'route-evidence.json'),JSON.stringify(capturedRoutes,null,2));
}finally{await browser.close();}
