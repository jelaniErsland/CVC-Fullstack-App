import assert from "node:assert/strict";

export async function measureAdminNavigation(page, steps) {
  await page.evaluate(() => {
    window.__navigationMeasurements = [];
    window.__navigationLongTasks = [];
    new PerformanceObserver(list => window.__navigationLongTasks.push(...list.getEntries().map(entry => ({ startTime: entry.startTime, duration: entry.duration })))).observe({ type: "longtask" });
    document.addEventListener("click", event => {
      const link = event.target.closest?.('nav[aria-label="Workspace navigation"] a');
      if (!link) return;
      const target = new URL(link.href).pathname;
      const titles = { "/admin/dashboard": "Overview", "/admin/calendar": "Calendar", "/admin/needs-attention": "Needs Attention", "/admin/announcements": "Communications", "/admin/volunteers": "Volunteers", "/admin/tasks": "Tasks" };
      const started = performance.now();
      const record = { target, started, acknowledgementMs: null, urlMs: null, frameMs: null, usefulMs: null };
      window.__navigationMeasurements.push(record);
      const observe = () => {
        const elapsed = Math.round(performance.now() - started);
        const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
        const heading = [...document.querySelectorAll("main h1")].find(visible)?.textContent?.trim();
        const destination = heading === titles[target];
        if (record.acknowledgementMs === null && (document.querySelector('[data-navigation-pending="true"]') || destination)) record.acknowledgementMs = elapsed;
        if (record.urlMs === null && location.pathname === target) record.urlMs = elapsed;
        if (record.frameMs === null && destination) record.frameMs = elapsed;
        if (record.usefulMs === null && destination && ![...document.querySelectorAll('[data-admin-route-loading]')].some(visible)) record.usefulMs = elapsed;
        if (record.usefulMs === null && elapsed < 30000) requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    }, true);
  });
  const requests = [];
  const actions = [];
  const onRequest = request => {
    const url = new URL(request.url());
    const headers = request.headers();
    if (headers["next-action"]) actions.push({path:url.pathname});
    if (headers.rsc || url.searchParams.has("_rsc")) requests.push({ path: url.pathname, prefetch: Boolean(headers["next-router-prefetch"] || headers["next-router-segment-prefetch"]), at: performance.now() });
  };
  page.on("request", onRequest);
  const records = [];
  try {
    for (let sample = 1; sample <= Number(process.env.NAVIGATION_SAMPLES ?? 3); sample++) {
      for (const [label, target, heading] of steps) {
        const shell = await page.locator("aside").first().elementHandle();
        const before = requests.length;
        const actionsBefore = actions.length;
        await page.locator(`nav[aria-label="Workspace navigation"] a[href^="${target}"]`).first().click({ noWaitAfter: true });
        await page.waitForFunction(path => window.__navigationMeasurements.at(-1)?.target === path && window.__navigationMeasurements.at(-1)?.usefulMs !== null, target);
        await page.getByRole("heading", { name: heading, exact: true }).waitFor();
        assert.equal(await page.locator(`nav[aria-label="Workspace navigation"] a[href^="${target}"]`).first().getAttribute("aria-current"),"page","Selected navigation must follow the committed destination.");
        const record = await page.evaluate(() => window.__navigationMeasurements.at(-1));
        const browserWork = await page.evaluate(started => ({ longTasks: window.__navigationLongTasks.filter(entry => entry.startTime >= started), scripts: performance.getEntriesByType("resource").filter(entry => entry.startTime >= started && new URL(entry.name).pathname.endsWith(".js")).map(entry => ({ path: new URL(entry.name).pathname, bytes:entry.encodedBodySize, durationMs:Math.round(entry.duration) })) }), record.started);
        delete record.started;
        records.push({ sample, label, ...record, ...browserWork, rscRequestsDuringTransition: requests.length - before, serverActionsDuringTransition: actions.length - actionsBefore, shellRetained: await shell.evaluate(element => element.isConnected) });
      }
    }
    assert(records.every(record => record.shellRetained), "Admin shell must survive navigation.");
    return { schema: "project-local.admin-navigation-browser.v2", records, rscRequests: requests.map(({path, prefetch}) => ({path, prefetch})) };
  } finally {
    page.off("request", onRequest);
  }
}
