import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

function holdNext(page, pathname) {
  let release;
  const gate = new Promise(resolve => { release=resolve; });
  let held=false;
  const handler=async route => {
    const request=route.request(), headers=request.headers();
    if (!held && new URL(request.url()).pathname===pathname && headers.rsc && !headers['next-router-prefetch'] && !headers['next-router-segment-prefetch']) {
      held=true;
      await gate;
      await route.continue().catch(()=>{}); // Superseded requests can be canceled by Next.
    } else await route.fallback();
  };
  return {install:()=>page.route('**/*',handler),release,dispose:async()=>{release();await page.unroute('**/*',handler);}};
}

async function loaded(page,title) {
  const routes={Overview:'/admin/dashboard',Calendar:'/admin/calendar',Volunteers:'/admin/volunteers','Needs Attention':'/admin/needs-attention',Communications:'/admin/announcements',Tasks:'/admin/tasks'};
  await page.waitForURL(url=>url.pathname===routes[title]);
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
  await page.waitForFunction(()=>![...document.querySelectorAll('[data-admin-client-handoff], [data-admin-route-loading]')].some(n=>n.getClientRects().length),null,{timeout:30000});
}

async function assertFrame(page,route,title,previousTitle) {
  const frame=page.locator(`[data-admin-client-handoff="${route}"]`);
  await frame.waitFor({timeout:1500});
  assert.equal(await frame.getByRole('heading',{name:title,exact:true}).isVisible(),true);
  assert.equal(await page.getByRole('heading',{name:previousTitle,exact:true}).count(),0,'Previous page must leave the accessibility tree immediately.');
  assert.equal(await page.locator('[data-admin-route-content]').getAttribute('hidden'),'');
  assert.equal(await page.locator('[data-admin-route-content]').getAttribute('inert'),'');
  assert(!/Alex Rivera|Gate Attendant|example.invalid|Night Watch/.test(await frame.innerText()),'Handoff frame exposed private fixture data.');
}

export async function verifyClientHandoff(page,{mobile=false}={}) {
  const nav=page.getByRole('navigation',{name:mobile?'Primary admin navigation':'Workspace navigation',exact:true});
  const click=async name=>nav.getByRole('link',{name:mobile?`Open ${name}`:name,exact:true}).click();
  const first=holdNext(page,mobile?'/admin/calendar':'/admin/volunteers');
  await first.install();
  const source=await page.getByRole('heading',{name:'Overview',exact:true}).elementHandle();
  const historyBefore=await page.evaluate(()=>history.length);
  try {
    await click(mobile?'Calendar':'Volunteers');
    await assertFrame(page,mobile?'calendar':'volunteers',mobile?'Calendar':'Volunteers','Overview');
    assert(await source.evaluate(n=>n.isConnected),'Handoff should hide old content without remounting it.');
    assert.equal(await page.evaluate(()=>history.length),historyBefore,'Presentation handoff added a fake history entry before the held route committed.');
    assert.equal(await nav.getByRole('link',{name:mobile?'Open Calendar':'Volunteers',exact:true}).getAttribute('aria-current'),'page');
    assert(await page.evaluate(()=>Boolean(document.activeElement?.closest('nav'))),'Do not force focus into a skeleton.');
    if(process.env.ADMIN_HANDOFF_EVIDENCE_DIR){
      await mkdir(process.env.ADMIN_HANDOFF_EVIDENCE_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.ADMIN_HANDOFF_EVIDENCE_DIR,mobile?'handoff-mobile.png':'handoff-desktop.png')});
    }
  } finally {await first.dispose();}
  await loaded(page,mobile?'Calendar':'Volunteers');
  if(mobile){
    await click('Needs Attention'); await loaded(page,'Needs Attention');
    await click('Overview'); await loaded(page,'Overview');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.emulateMedia({reducedMotion:'reduce'});
    await click('Calendar'); await loaded(page,'Calendar');
    console.log('Mobile cold handoff, immediate active state, hidden/inert old content, accessible frame, reduced motion and no overflow passed.');
    return;
  }

  // Neither older held response may publish its route after Attention wins.
  const calendar=holdNext(page,'/admin/calendar');
  const volunteers=holdNext(page,'/admin/volunteers');
  await calendar.install(); await volunteers.install();
  try {
    await click('Calendar'); await assertFrame(page,'calendar','Calendar','Volunteers');
    await click('Volunteers'); // Return to current route cancels the older intent.
    await click('Calendar');
    await nav.getByRole('link',{name:/^Attention/}).click();
    await page.getByRole('heading',{name:'Needs Attention',exact:true}).waitFor();
    await page.evaluate(()=>{
      window.__handoffVisibleTitles=[]; window.__watchHandoff=true;
      const sample=()=>{
        const heading=[...document.querySelectorAll('main h1')].find(n=>n.getClientRects().length)?.textContent;
        window.__handoffVisibleTitles.push(heading);
        if(window.__watchHandoff) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    calendar.release(); volunteers.release();
    await loaded(page,'Needs Attention'); await page.waitForLoadState('networkidle');
    const titles=await page.evaluate(()=>{window.__watchHandoff=false;return window.__handoffVisibleTitles;});
    assert(titles.length && titles.every(title=>title==='Needs Attention'),'A superseded destination flashed after the latest intent.');
  } finally {await calendar.dispose();await volunteers.dispose();}

  const tasks=holdNext(page,'/admin/tasks');
  await tasks.install();
  try {
    const link=nav.getByRole('link',{name:'Task library',exact:true});
    await link.focus(); await page.keyboard.press('Enter');
    await assertFrame(page,'tasks','Tasks','Needs Attention');
    assert(await link.evaluate(n=>document.activeElement===n),'Keyboard navigation moved focus into a placeholder.');
  } finally {await tasks.dispose();}
  await loaded(page,'Tasks');
  await click('Overview'); await loaded(page,'Overview');
  await page.goBack(); await loaded(page,'Tasks');
  await page.goForward(); await loaded(page,'Overview');
  await page.reload(); await loaded(page,'Overview');

  // Run the realistic rapid sequence before installing the isolated fake clock.
  for(const [name,title] of [['Calendar','Calendar'],['Volunteers','Volunteers'],['Calendar','Calendar'],[/^Attention/,'Needs Attention'],['Communications','Communications'],['Task library','Tasks'],['Overview','Overview']]) {
    await nav.getByRole('link',{name,exact:typeof name==='string'}).click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const actual=await page.evaluate(()=>({headings:[...document.querySelectorAll('main h1')].filter(n=>n.getClientRects().length).map(n=>n.textContent),frame:document.querySelector('[data-admin-client-handoff]')?.getAttribute('data-admin-client-handoff'),path:location.pathname}));
    assert.equal(await page.getByRole('heading',{name:title,exact:true}).isVisible(),true,`Rapid navigation to ${title} did not acknowledge the newest destination: ${JSON.stringify(actual)}`);
    await page.waitForTimeout(90); // Deliberately model fast human clicks, not server readiness.
  }
  await loaded(page,'Overview'); await page.waitForLoadState('networkidle');
  assert.equal(new URL(page.url()).pathname,'/admin/dashboard');

  // A navigation that never receives an RSC response must not spin forever.
  const stalled=holdNext(page,'/admin/volunteers');
  await stalled.install(); await page.clock.install();
  try {
    await click('Volunteers'); await assertFrame(page,'volunteers','Volunteers','Overview');
    await page.clock.fastForward(30_001);
    await page.getByRole('button',{name:'Retry navigation',exact:true}).waitFor();
    assert.equal(await page.getByRole('alert').getByRole('heading',{name:'Volunteers',exact:true}).isVisible(),true);
    assert.equal(await nav.getByRole('link',{name:'Overview',exact:true}).getAttribute('aria-current'),'page','Failure must reconcile nav selection with actual history.');
    await page.getByRole('button',{name:'Retry navigation',exact:true}).click();
    stalled.release(); await page.clock.resume(); await loaded(page,'Volunteers');
  } finally {await stalled.dispose();await page.clock.resume();}
  await click('Overview'); await loaded(page,'Overview');
  // A native Ctrl-click can create a background tab without a window.opener;
  // observe the context's new page rather than requiring a JS popup event.
  const popupPromise=page.context().waitForEvent('page');
  await nav.getByRole('link',{name:'Task library',exact:true}).click({modifiers:['Control']});
  const popup=await popupPromise; await popup.close();
  assert.equal(await page.locator('[data-admin-client-handoff]').count(),0,'Modified click must not hand off the original tab.');
  assert.equal(new URL(page.url()).pathname,'/admin/dashboard');
  console.log('Cold handoff, newest-intent isolation, return-to-current cancellation, keyboard, native modified click, history/refresh, finite timeout and successful retry passed.');
}
