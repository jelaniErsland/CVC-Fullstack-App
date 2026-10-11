import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { fixture } from './12-47-local-fixtures.mjs';
import { resolvePreviewBrowserExecutable } from './preview-config.mjs';
const f=await fixture(true);
const browser=await chromium.launch({headless:true,executablePath:resolvePreviewBrowserExecutable()});
const report=[];
try {
  for(const port of [3101,3102]) {
    const base=`http://localhost:${port}`;
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
    await context.addCookies([...f.admin.jar.values()].map(c=>({name:c.name,value:c.value,domain:'localhost',path:'/',sameSite:'Lax'})));
    const page=await context.newPage(); const errors=[]; let posts=0;
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.method()==='POST') posts++;});
    // Compile routes and warm reads before collecting click samples.
    for(const route of ['/admin',`/admin/calendar?view=day&date=${f.day}`,'/admin/announcements']) await page.goto(base+route,{waitUntil:'networkidle'});
    const samples=[];
    for(let run=0;run<3;run++) {
      await page.goto(`${base}/admin/calendar?view=day&date=${f.day}`,{waitUntil:'networkidle'});
      let start=performance.now(); posts=0;
      await page.locator('aside a[href="/admin/announcements"]').click();
      await page.getByRole('button',{name:'Review recipients',exact:true}).waitFor();
      const communicationsMs=Math.round(performance.now()-start);
      await page.waitForLoadState('networkidle'); const communicationBadgePosts=posts;
      start=performance.now();
      await page.getByRole('button',{name:'Review recipients',exact:true}).click();
      await page.getByRole('region',{name:'Delivery preview'}).waitFor();
      const reviewMs=Math.round(performance.now()-start);
      start=performance.now(); posts=0;
      await page.locator('aside a[href="/admin/calendar"]').click();
      await page.getByTestId('calendar-workspace-header').waitFor();
      const calendarMs=Math.round(performance.now()-start);
      await page.waitForLoadState('networkidle');
      samples.push({communicationsMs,reviewMs,calendarMs,communicationBadgePosts,calendarBadgePosts:posts});
    }
    assert.deepEqual(errors,[]);
    report.push({variant:port===3101?'before':'after',samples});
    await context.close();
  }
  console.log(JSON.stringify(report,null,2));
} finally {await browser.close();await f.cleanup();}
