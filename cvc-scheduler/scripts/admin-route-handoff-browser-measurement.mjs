import assert from "node:assert/strict";

// Used unchanged on the frozen 12.55B build and the candidate build.
export async function measureRouteHandoff(page) {
  await page.evaluate(() => {
    window.__handoffMeasurements = [];
    document.addEventListener("click", event => {
      const link = event.target.closest?.('nav[aria-label="Workspace navigation"] a');
      if (!link) return;
      const target = new URL(link.href).pathname;
      const titles = { "/admin/dashboard":"Overview", "/admin/calendar":"Calendar", "/admin/volunteers":"Volunteers", "/admin/needs-attention":"Needs Attention", "/admin/announcements":"Communications", "/admin/tasks":"Tasks" };
      const visible = element => Boolean(element?.isConnected && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
      const previousHeading = [...document.querySelectorAll("main h1")].find(visible);
      const record = {target,started:performance.now(),navSelectionMs:null,previousPageGoneMs:null,frameMs:null,usefulMs:null};
      window.__handoffMeasurements.push(record);
      const observe = () => {
        if (window.__handoffMeasurements.at(-1) !== record) return;
        const elapsed = Math.round(performance.now() - record.started);
        const heading = [...document.querySelectorAll("main h1")].find(visible)?.textContent?.trim();
        const destination = heading === titles[target];
        const selected = [...document.querySelectorAll('nav[aria-label="Workspace navigation"] a[aria-current="page"]')].some(a => new URL(a.href).pathname === target);
        if (selected && record.navSelectionMs === null) record.navSelectionMs = elapsed;
        if (!visible(previousHeading) && record.previousPageGoneMs === null) record.previousPageGoneMs = elapsed;
        if (destination && record.frameMs === null) record.frameMs = elapsed;
        if (destination && location.pathname === target && ![...document.querySelectorAll('[data-admin-route-loading], [data-admin-client-handoff]')].some(visible) && record.usefulMs === null) record.usefulMs = elapsed;
        if (record.usefulMs === null && elapsed < 30000) requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    }, true);
  });
  const steps = [
    ["Overview → Calendar","/admin/calendar","Calendar"],
    ["Calendar → Volunteers","/admin/volunteers","Volunteers"],
    ["Volunteers → Calendar","/admin/calendar","Calendar"],
    ["Calendar → Attention","/admin/needs-attention","Needs Attention"],
    ["Attention → Communications","/admin/announcements","Communications"],
    ["Communications → Overview","/admin/dashboard","Overview"],
  ];
  const records = [];
  const pendingRequests=new Set();
  let lastActivity=performance.now();
  const started=request=>{
    const headers=request.headers();
    if(!headers['next-router-prefetch']&&!headers['next-router-segment-prefetch']&&(headers.rsc||headers['next-action']||new URL(request.url()).searchParams.has('_rsc'))){
      pendingRequests.add(request); lastActivity=performance.now();
    }
  };
  const finished=request=>{if(pendingRequests.delete(request))lastActivity=performance.now();};
  page.on('request',started); page.on('requestfinished',finished); page.on('requestfailed',finished);
  try {
  for (let sample=1; sample<=Number(process.env.NAVIGATION_SAMPLES ?? 3); sample++) {
    for (const [label,target,title] of steps) {
      const shell = await page.locator("aside").first().elementHandle();
      await page.locator(`nav[aria-label="Workspace navigation"] a[href^="${target}"]`).click();
      await page.waitForFunction(target => window.__handoffMeasurements.at(-1)?.target === target && window.__handoffMeasurements.at(-1)?.usefulMs !== null, target, {timeout:30000});
      await page.getByRole("heading",{name:title,exact:true}).waitFor();
      // SPA load-state can already be satisfied by the previous document.
      // Observe this navigation's actual RSC/action completions instead.
      const deadline=performance.now()+30000;
      while(pendingRequests.size || performance.now()-lastActivity<100){
        assert(performance.now()<deadline,'Route network activity did not settle within 30 seconds.');
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      const record = await page.evaluate(() => ({...window.__handoffMeasurements.at(-1),settledObservationMs:Math.round(performance.now()-window.__handoffMeasurements.at(-1).started)}));
      delete record.started;
      assert(await shell.evaluate(n=>n.isConnected),"Persistent shell remounted.");
      if (process.env.EXPECT_IMMEDIATE_HANDOFF === "1") {
        for (const key of ["navSelectionMs","previousPageGoneMs","frameMs"]) assert(record[key] !== null && record[key] < 100, `${label}: ${key}=${record[key]} exceeded the immediate handoff budget.`);
      }
      records.push({sample,label,...record});
    }
  }
  } finally {page.off('request',started);page.off('requestfinished',finished);page.off('requestfailed',finished);}
  return {schema:"project-local.route-handoff.v1",prefetch:process.env.NAVIGATION_DISABLE_PREFETCH === "1"?"blocked":"normal",settledDefinition:"all observed non-prefetch RSC/actions finished or failed, followed by 100 ms quiet; excludes unrelated image/analytics traffic",records};
}
