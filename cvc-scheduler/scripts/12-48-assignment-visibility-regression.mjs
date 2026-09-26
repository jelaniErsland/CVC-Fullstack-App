import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';

const output=path.resolve('..','previews','12.48-batch-2','implemented');
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
const context=await browser.newContext();
await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const cookie=(name,value)=>context.addCookies([{name,value,domain:'127.0.0.1',path:'/'}]);
const go=p=>page.goto('http://127.0.0.1:3148'+p,{waitUntil:'networkidle'});
const card=n=>page.locator(`[data-calendar-task-item="22222222-2222-4222-8222-${String(n).padStart(12,'0')}"]`);
const status=async(item,name,label)=>{assert.match(await item.innerText(),new RegExp(name));assert.equal(await item.getByRole('img',{name:label}).count(),1);};
const shot=name=>page.screenshot({path:path.join(output,name+'.png'),fullPage:false});
try {
  await cookie('fixture-assignments','1');
  for(const route of ['/admin/calendar','/admin/quick-view']) for(const view of ['day','list']) for(const width of [1440,390,320]){
    await page.setViewportSize({width,height:width===1440?1000:844});
    await go(`${route}?view=${view}&date=2026-10-05`);
    assert.match(await card(1).innerText(),/No volunteers assigned/);
    await status(card(2),'Avery Stone','Confirmed');
    await status(card(3),'Jordan Hale','Awaiting reply');
    await status(card(3),'Casey Morgan',"Can't make it");
    assert.match(await card(3).innerText(),/2\/6 assigned/);
    assert.equal(await card(4).getByText('Avery Stone',{exact:true}).isVisible(),true);
    assert.equal(await card(4).getByText('Sam Rivera',{exact:true}).isVisible(),false);
    assert.equal(await page.getByText(/PRIVATE (notes|congregation)/).count(),0);
    for(const meal of await page.locator('[data-calendar-task-item^="11111111-"]').all()){
      assert.equal(await meal.getByRole('list',{name:'Assigned volunteers'}).count(),0);
      assert.match(await meal.innerText(),/Headcount (not set|0|25)/);
      assert.doesNotMatch(await meal.innerText(),/\d\/\d|No volunteers assigned/);
    }
    if(width!==320) await shot(`assignments-${route.endsWith('quick-view')?'quick-view':'calendar'}-${view}-${width}`);
    await card(4).locator('summary').click();
    assert.equal(await card(4).getByText('Sam Rivera',{exact:true}).isVisible(),true);
    assert.equal(await page.getByRole('dialog',{name:'Calendar item inspector'}).count(),0);
    assert.equal(await card(4).evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
    await card(4).getByText('Sam Rivera',{exact:true}).evaluate(node=>node.scrollIntoView({block:'center'}));
    await page.waitForTimeout(200);
    if(width<1024){
      const last=await card(4).getByText('Sam Rivera',{exact:true}).boundingBox();
      const nav=await page.getByRole('navigation',{name:'Primary admin navigation'}).boundingBox();
      assert(last.y+last.height<nav.y,'last expanded name must be reachable above fixed navigation');
    }
    if(width!==320) await shot(`assignments-expanded-${route.endsWith('quick-view')?'quick-view':'calendar'}-${view}-${width}`);
    await card(4).getByRole('button',{name:/Cleanup crew/}).click();
    await page.getByRole('dialog',{name:'Calendar item inspector'}).waitFor();
    assert.equal(new URL(page.url()).pathname,route);
    assert.equal(new URL(page.url()).searchParams.get('item'),'22222222-2222-4222-8222-000000000004');
    assert.equal(new URL(page.url()).searchParams.get('date'),'2026-10-05');
    if(route.endsWith('quick-view')) assert.equal(await page.getByRole('dialog').getByRole('button',{name:/^(Assign|Remove|Publish|Send)/}).count(),0);
    console.log(`PASS: ${route} ${view} ${width}: zero/one/mixed/many, expansion, meals, selection and no overflow.`);
  }
  await go('/admin/calendar?view=day&date=2026-10-06');
  assert.equal(await card(2).count(),0);
  await status(card(5),'Morgan Reed','Confirmed');
  assert.doesNotMatch(await card(5).innerText(),/Avery Stone/);
  await go('/admin/calendar?view=list&date=2026-10-05');
  assert.match(await card(2).innerText(),/Avery Stone/);
  assert.match(await card(5).innerText(),/Morgan Reed/);
  await go('/qv?view=list&date=2026-10-05');
  assert.equal(await page.getByRole('list',{name:'Assigned volunteers'}).count(),0,'Bearer surface does not gain the authenticated roster UI');
  await cookie('fixture-role','on-site');
  await go('/admin/calendar?view=list&date=2026-10-05');
  await status(card(2),'Avery Stone','Confirmed');
  assert.equal(await page.getByRole('button',{name:/^Create( item)?$/}).count(),0);
  await cookie('fixture-role','main');
  for(const visibility of ['hidden','unavailable']){
    await cookie('fixture-assignment-visibility',visibility);
    await go('/admin/calendar?view=day&date=2026-10-05');
    assert.equal(await page.getByRole('list',{name:'Assigned volunteers'}).count(),0);
    assert.equal(await page.getByText('No volunteers assigned',{exact:true}).count(),0);
    if(visibility==='unavailable') assert.match(await card(1).innerText(),/Assignment details unavailable/);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: occurrence-specific names, hidden/unavailable projections and unchanged bearer roster surface. Synthetic presentation fixture; not authenticated authorization proof.');
} finally {await browser.close();}
