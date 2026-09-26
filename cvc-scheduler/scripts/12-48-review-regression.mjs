import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {resolvePreviewBrowserExecutable} from './preview-config.mjs';

const output=path.resolve('..','previews','12.48-batch-1','after');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:resolvePreviewBrowserExecutable(),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const go=p=>page.goto('http://127.0.0.1:3148'+p,{waitUntil:'networkidle'});
const shot=name=>page.screenshot({path:path.join(output,name+'.png'),fullPage:false});
const cookie=(name,value)=>context.addCookies([{name,value,domain:'127.0.0.1',path:'/'}]);
try{
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});
    await go('/admin/dashboard');
    assert.equal(await page.getByRole('region',{name:'Project identity'}).count(),1);
    assert.equal(await page.getByRole('heading',{name:'LDC Community remodel · Fixture'}).count(),1);
    await shot('overview-no-photo-'+width);
    await cookie('fixture-photo','1');await cookie('fixture-photo-edit','1');await go('/admin/dashboard');
    const banner=page.getByRole('region',{name:'Project identity'});
    const height=(await banner.boundingBox()).height;assert(height>=(width===390?90:130)&&height<=(width===390?120:170));
    assert.equal(await banner.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    await shot('overview-photo-'+width);
    await page.getByRole('button',{name:'Project photo actions'}).click();
    assert.equal(await page.getByRole('menuitem',{name:'Change project photo'}).isVisible(),true);
    await shot('photo-actions-open-'+width);
    await page.getByRole('menuitem',{name:'Change project photo'}).click();
    assert.equal(await page.getByRole('dialog').isVisible(),true);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({state:'hidden'});
    await cookie('fixture-photo','0');await cookie('fixture-photo-edit','0');
  }
  await page.setViewportSize({width:390,height:844});await cookie('fixture-photo','1');await cookie('fixture-photo-edit','0');await go('/admin/dashboard');
  assert.equal(await page.getByRole('region',{name:'Project identity'}).locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  assert.equal(await page.getByRole('button',{name:'Project photo actions'}).count(),0);
  await shot('overview-photo-readonly-390');await cookie('fixture-photo','0');
  await page.setViewportSize({width:390,height:844});await cookie('fixture-review-varied','1');await go('/admin/dashboard');
  assert.equal(await page.getByRole('region',{name:'Review summary'}).locator('.divide-y > a:visible').count(),2);
  assert.equal(await page.getByRole('link',{name:'View all follow-ups'}).isVisible(),true);
  assert((await page.getByRole('region',{name:'Upcoming work'}).boundingBox()).y<(await page.getByRole('navigation',{name:'Primary admin navigation'}).boundingBox()).y);
  await shot('overview-review-varied-390');await cookie('fixture-review-varied','0');
  await go('/admin/dashboard');
  const groupedWork=page.getByRole('region',{name:'Upcoming work'}).getByRole('link',{name:/Site preparation · 2 items/});
  const groupedReview=page.getByRole('region',{name:'Review summary'}).getByRole('link',{name:/Site preparation.*2 matching items/});
  for(const [index,link] of [groupedWork,groupedReview].entries()){
    const target=new URL(await link.getAttribute('href'),'http://127.0.0.1:3148');
    assert.equal(target.searchParams.get('view'),'day');
    assert.equal(target.searchParams.get('date'),'2026-10-06');
    assert.equal(target.searchParams.has('item'),false);
    await link.click();
    await page.waitForURL('**/admin/calendar?view=day*');
    assert.equal(await page.getByRole('button',{name:/Site preparation/}).count(),2);
    if(index===0) await shot('grouped-calendar-day-390');
    await go('/admin/dashboard');
  }
  const singleMeal=page.getByRole('region',{name:'Upcoming work'}).getByRole('link',{name:/Breakfast/});
  assert.equal(new URL(await singleMeal.getAttribute('href'),'http://127.0.0.1:3148').searchParams.get('item'),'11111111-1111-4111-8111-000000000001');
  await singleMeal.click();
  await page.waitForURL('**/admin/calendar?view=day*');
  assert.equal(await page.getByRole('dialog',{name:'Calendar item inspector'}).isVisible(),true);
  await page.getByRole('button',{name:'Close calendar item inspector',exact:true}).filter({visible:true}).first().click();
  await page.setViewportSize({width:1440,height:1000});await go('/admin/dashboard');
  await page.getByRole('link',{name:'New task',exact:true}).click();await page.waitForURL('**/admin/tasks?create=1');
  await page.getByRole('dialog',{name:'New task'}).waitFor();
  await shot('direct-create-task-1440');
  await cookie('fixture-role','on-site');await go('/admin/dashboard');
  assert.equal(await page.getByRole('link',{name:'New task',exact:true}).count(),0);
  await go('/admin/tasks?create=1');
  assert.equal(await page.getByRole('dialog',{name:'New task'}).count(),0);
  await cookie('fixture-role','main');
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});await go('/foundation');
    assert.equal(await page.getByText('Use a clear name and choose the work days before assigning volunteers.').isVisible(),false);
    const disclosure=page.locator('details').filter({hasText:'Optional guidance · when to create a task'});
    assert.equal(await disclosure.locator('summary svg').count(),1);
    const closedRotation=await disclosure.locator('summary svg').evaluate(node=>getComputedStyle(node).rotate);
    await shot('foundation-closed-'+width);
    await page.getByRole('button',{name:'More example actions'}).click();
    await page.getByRole('menuitem',{name:'Reset example form'}).waitFor();
    await shot('foundation-action-open-'+width);
    await page.getByRole('menuitem',{name:'Reset example form'}).click();
    assert.equal(await page.getByText('Clear the example values?').isVisible(),true);
    await shot('foundation-action-confirm-'+width);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'),'More example actions');
    await page.getByText('Optional guidance · when to create a task').click();
    assert.equal(await page.getByText('Use a clear name and choose the work days before assigning volunteers.').isVisible(),true);
    assert.equal(await disclosure.evaluate(node=>node.open),true);
    await page.waitForTimeout(250);
    const openRotation=await disclosure.locator('summary svg').evaluate(node=>getComputedStyle(node).rotate);
    assert.notEqual(openRotation,closedRotation,'the disclosure chevron must rotate when expanded');
    await shot('foundation-disclosure-open-'+width);
    await disclosure.locator('summary').focus();
    await page.keyboard.press('Space');
    assert.equal(await disclosure.evaluate(node=>node.open),false);
    await page.keyboard.press('Enter');
    assert.equal(await disclosure.evaluate(node=>node.open),true);
  }
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});
    for(const route of ['/admin/quick-view?date=2026-10-05&project=fixture-project','/qv?date=2026-10-05']){
      await go(route);
      assert.equal(new URL(page.url()).searchParams.has('view'),false);
      assert.equal(await page.getByRole('button',{name:'Month',exact:true}).getAttribute('aria-pressed'),'true');
      for(const pattern of (width===1440?[/Breakfast.*Headcount not set/,/Lunch.*Headcount 0/,/Lunch.*Headcount 25/]:[])){
        const entry=page.getByRole('button',{name:pattern}).first();
        assert.equal(await entry.isVisible(),true);
      }
      const mealSummary=page.getByTestId('calendar-meal-summary').filter({visible:true});
      await mealSummary.waitFor();
      assert.equal(await mealSummary.locator('[data-meal-kind="breakfast"] [data-meal-headcount]').textContent(),'Not recorded');
      assert.equal(await mealSummary.locator('[data-meal-kind="lunch"] [data-meal-headcount]').textContent(),'0');
      if(width===1440)for(const label of ['Breakfast · —','Lunch · 0','Lunch · 25']){
        assert.equal(await page.getByText(label,{exact:true}).filter({visible:true}).count()>0,true);
      }
      assert.equal(await page.getByRole('dialog',{name:'Calendar item inspector'}).count(),0);
      await shot((route.startsWith('/qv?')?'bearer':'quick-view')+'-default-month-'+width);
    }
  }
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});
    await go('/admin/quick-view?view=list&date=2026-10-05&project=fixture-project');
    const mealRows=page.getByRole('button',{name:/^(Breakfast|Lunch),/});
    assert.equal(await mealRows.count(),3);
    assert.match(await mealRows.nth(0).getAttribute('aria-label'),/Headcount not set/);
    assert.match(await mealRows.nth(1).getAttribute('aria-label'),/Headcount 0/);
    assert.match(await mealRows.nth(2).getAttribute('aria-label'),/Headcount 25/);
    await shot('quick-view-meal-list-'+width);
    for(const [i,headcount,contact] of [[0,'Not recorded','Avery Stone'],[1,'0','Not assigned'],[2,'25','Jordan Hale']]){
      await mealRows.nth(i).click();
      const inspector=page.getByRole('dialog',{name:'Calendar item inspector'});
      await inspector.waitFor();
      assert.equal(await inspector.getByText(headcount,{exact:true}).count(),1);
      assert.equal(await inspector.getByText(contact,{exact:true}).count(),1);
      assert.equal(await inspector.getByText(/volunteer|helper|vacanc|staffing/i).count(),0);
      assert.equal(new URL(page.url()).pathname,'/admin/quick-view');
      await shot(`quick-view-meal-${i}-${width}`);
      await page.getByRole('button',{name:'Close calendar item inspector',exact:true}).filter({visible:true}).first().click();
    }
    await page.getByRole('button',{name:/Site preparation/}).first().click();
    const inspector=page.getByRole('dialog',{name:'Calendar item inspector'});
    await inspector.waitFor();
    assert((await inspector.locator('.order-0 > span').allTextContents()).every(label=>label.trim().length>0));
    await shot('quick-view-nonmeal-inspector-'+width);
  }
  await page.setViewportSize({width:390,height:844});await go('/admin/quick-view?view=month&date=2026-10-05&project=fixture-project');
  assert.equal(await page.getByTestId('calendar-meal-summary').filter({visible:true}).locator('[data-meal-kind="breakfast"] [data-meal-headcount]').textContent(),'Not recorded');
  await shot('quick-view-month-meals-390');
  assert.deepEqual(errors,[]);
  console.log('PASS: grouped links, no-photo/photo identity, menu/editor, direct create permission, disclosure, default Quick View meal counts and route on desktop/mobile. Synthetic fixture only.');
}finally{await browser.close();}
