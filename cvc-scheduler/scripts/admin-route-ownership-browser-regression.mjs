import assert from "node:assert/strict";

const paths={Overview:'/admin/dashboard',Calendar:'/admin/calendar',Volunteers:'/admin/volunteers',Attention:'/admin/needs-attention',Communications:'/admin/announcements',Tasks:'/admin/tasks'};
const titles={Attention:'Needs Attention',Tasks:'Tasks'};

export async function verifyRouteOwnership(page,{mobile=false}={}) {
  const pending=new Set(); let lastActivity=performance.now();
  const start=request=>{
    const h=request.headers();
    if(!h['next-router-prefetch']&&!h['next-router-segment-prefetch']&&(h.rsc||h['next-action'])){pending.add(request);lastActivity=performance.now();}
  };
  const finish=request=>{if(pending.delete(request))lastActivity=performance.now();};
  page.on('request',start);page.on('requestfinished',finish);page.on('requestfailed',finish);
  const shell=await page.locator('main#main-content').elementHandle();
  const nav=page.getByRole('navigation',{name:mobile?'Primary admin navigation':'Workspace navigation',exact:true});
  const activate=async(name,keyboard=false)=>{
    let link=mobile?nav.locator(`a[href^="${paths[name]}"]`):page.locator(`aside nav a[href^="${paths[name]}"]`);
    if(mobile&&await link.count()===0){
      await nav.getByRole('button',{name:'Open more admin navigation',exact:true}).click();
      link=page.locator(`#mobile-more-navigation a[href^="${paths[name]}"]`);
    }
    if(keyboard){await link.focus();await page.keyboard.press('Enter');}else await link.click();
  };
  const ready=async name=>{
    try { await page.waitForFunction(({path,title})=>location.pathname===path&&[...document.querySelectorAll('main h1')].some(n=>n.getClientRects().length&&n.textContent===title)&&![...document.querySelectorAll('[data-admin-client-handoff],[data-admin-route-loading]')].some(n=>n.getClientRects().length),{path:paths[name],title:titles[name]??name},{timeout:30000,polling:50}); }
    catch(error) {console.error(JSON.stringify({expected:name,targetPath:paths[name],targetTitle:titles[name]??name,...await page.evaluate(({path,title})=>({urlMatches:location.pathname===path,headingMatches:[...document.querySelectorAll('main h1')].some(n=>n.getClientRects().length&&n.textContent===title),path:location.pathname,headings:[...document.querySelectorAll('main h1')].filter(n=>n.getClientRects().length).map(n=>n.textContent),handoff:document.querySelector('[data-admin-client-handoff]')?.getAttribute('data-admin-client-handoff'),loading:[...document.querySelectorAll('[data-admin-client-handoff],[data-admin-route-loading]')].map(n=>({tag:n.tagName,route:n.getAttribute('data-admin-route-loading'),rects:n.getClientRects().length,visibility:getComputedStyle(n).visibility,display:getComputedStyle(n).display}))}),{path:paths[name],title:titles[name]??name})}));throw error;}
  };
  const settle=async name=>{
    const deadline=performance.now()+30000;
    do {
      await ready(name);
      if(!pending.size&&performance.now()-lastActivity>=200)return;
      assert(performance.now()<deadline,'Route requests/reconciliation did not settle.');
      await page.waitForTimeout(30);
    }while(true);
  };
  // Observe every paint: after the final click even a corrective loading frame
  // must retain the newest destination. Then observe URL/content/nav for 2.5 s
  // AFTER all real route/action requests and reconciliation have settled.
  const watch=async(name,strict)=>page.evaluate(({path,title,strict})=>{
    window.__ownershipWatch?.stop();
    const result={samples:0,failures:[],stop(){this.running=false;},running:true};
    window.__ownershipWatch=result;
    const tick=()=>{
      const heading=[...document.querySelectorAll('main h1')].find(n=>n.getClientRects().length)?.textContent;
      const selected=document.querySelector('aside nav a[aria-current="page"]');
      const active=selected?new URL(selected.href).pathname:null;
      if(heading!==title||active!==path||(strict&&location.pathname!==path))result.failures.push({path:location.pathname,heading,active});
      result.samples++;if(result.running)requestAnimationFrame(tick);
    };requestAnimationFrame(tick);
  },{path:paths[name],title:titles[name]??name,strict});
  const check=async()=>{
    const result=await page.evaluate(()=>{window.__ownershipWatch.stop();return {samples:window.__ownershipWatch.samples,failures:window.__ownershipWatch.failures};});
    assert(result.samples>0);assert.deepEqual(result.failures,[],'A superseded route became visible/active, or changed the settled URL.');
  };
  const patterns=[
    ['long sequence','Overview',['Calendar','Volunteers','Attention','Communications','Tasks','Overview']],
    ['A-B-C','Calendar',['Volunteers','Attention']],
    ['A-B-A','Calendar',['Volunteers','Calendar']],
    ['A-B-C-A','Calendar',['Volunteers','Attention','Calendar']],
    ['A-B-C-B','Calendar',['Volunteers','Attention','Volunteers']],
    ['A-B-A-B-A','Calendar',['Volunteers','Calendar','Volunteers','Calendar']],
  ];
  try {
    for(const [cycle,[label,origin,steps]] of patterns.entries()){
      await activate(origin);await settle(origin);
      for(const [index,name] of steps.entries()){
        await activate(name,cycle%2===1);
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert(await page.getByRole('heading',{name:titles[name]??name,exact:true}).isVisible(),`${label}: click did not immediately own destination identity.`);
        if(index<steps.length-1)await page.waitForTimeout(90);
      }
      const destination=steps.at(-1);
      await watch(destination,false);await settle(destination);await check();
      await watch(destination,true);await page.waitForTimeout(2500);await check();
      assert(await shell.evaluate(n=>n.isConnected),'Persistent shell remounted.');
      if(mobile) {
        const active=destination==='Tasks'||destination==='Communications'?nav.getByRole('button',{name:'Open more admin navigation',exact:true}):nav.locator(`a[href^="${paths[destination]}"]`);
        assert.equal(await active.getAttribute('aria-current'),'page');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
      console.log(JSON.stringify({schema:'project-local.route-ownership.v1',mobile,prefetch:process.env.NAVIGATION_DISABLE_PREFETCH==='1'?'blocked':'normal',label,destination:paths[destination],keyboard:cycle%2===1,observationMs:2500,passed:true}));
    }
    // An actual history traversal owns the destination even while another click
    // is pending; it must not be corrected back to the old click's target.
    await activate('Overview');await settle('Overview');
    await activate('Volunteers');await settle('Volunteers');
    let release;const gate=new Promise(resolve=>{release=resolve;});
    const hold=async route=>{
      const h=route.request().headers();
      if(h.rsc&&!h['next-router-prefetch']&&!h['next-router-segment-prefetch']){await gate;await route.continue().catch(()=>{});}else await route.fallback();
    };
    await page.route('**/admin/calendar**',hold);
    try {
      await activate('Calendar');
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      // Next may already commit a safe prefetched loading segment. Honor the
      // real history position, rather than assuming URL commit waits for data.
      const committed=new URL(page.url()).pathname===paths.Calendar;
      await page.goBack();release();await settle(committed?'Volunteers':'Overview');
      await page.goForward();await settle(committed?'Calendar':'Volunteers');
      await watch(committed?'Calendar':'Volunteers',true);await page.waitForTimeout(2500);await check();
    } finally {release();await page.unroute('**/admin/calendar**',hold);}
    console.log(`History during pending navigation passed (${mobile?'mobile':'desktop'}).`);
  } finally {page.off('request',start);page.off('requestfinished',finish);page.off('requestfailed',finish);await page.evaluate(()=>window.__ownershipWatch?.stop()).catch(()=>{});}
}
