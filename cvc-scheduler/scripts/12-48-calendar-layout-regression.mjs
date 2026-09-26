import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { resolvePreviewBrowserExecutable } from "./preview-config.mjs";

const output = path.resolve("..", "previews", "12.48-batch-1", "after");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
const context = await browser.newContext();
await context.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const go = (route) => page.goto(`http://127.0.0.1:3148${route}`, { waitUntil: "networkidle" });
const cookie = (name, value) => context.addCookies([{ name, value, domain: "127.0.0.1", path: "/" }]);
const shot = (name) => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: false });

function visibleBoxes(selector) {
  return page.locator(selector).evaluateAll((elements) => elements
    .map((element) => {
      const box = element.getBoundingClientRect();
      return box.width && box.height ? { bottom: box.bottom, left: box.left, right: box.right, top: box.top } : null;
    })
    .filter(Boolean));
}

function equalWithin(values, tolerance, label) {
  assert(values.length > 1, `${label} needs at least two rendered values`);
  assert(Math.max(...values) - Math.min(...values) <= tolerance, label);
}

async function verifyDateNavigation(routeBase, view, dates) {
  const unit = view === "list" ? "week" : view;
  const positions = [];

  for (const date of dates) {
    await go(`${routeBase}?view=${view}&date=${date}${routeBase === "/admin/quick-view" ? "&project=fixture-project" : ""}`);
    const previous = page.getByRole("button", { name: `Previous ${unit}` });
    const next = page.getByRole("button", { name: `Next ${unit}` });
    const before = { previous: await previous.boundingBox(), next: await next.boundingBox() };
    await next.click();
    await page.waitForURL((url) => url.searchParams.get("date") !== date);
    const after = { previous: await previous.boundingBox(), next: await next.boundingBox() };
    assert.equal(after.previous.x, before.previous.x, `${routeBase} ${view}: previous arrow moved after next`);
    assert.equal(after.next.x, before.next.x, `${routeBase} ${view}: next arrow moved after next`);
    positions.push(before);
  }

  equalWithin(positions.map((position) => position.previous.x), 0.5, `${routeBase} ${view}: previous arrow x across labels`);
  equalWithin(positions.map((position) => position.next.x), 0.5, `${routeBase} ${view}: next arrow x across labels`);
}

try {
  await cookie("fixture-assignments", "1");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const routeBase of ["/admin/calendar", "/admin/quick-view"]) {
      for (const [view, dates] of [
        ["day", ["2026-09-30", "2026-10-05", "2026-11-01"]],
        ["week", ["2026-09-30", "2026-10-05", "2026-11-01"]],
        ["month", ["2026-09-30", "2026-10-05", "2026-11-01"]],
        ["list", ["2026-09-30", "2026-10-05", "2026-11-01"]],
      ]) await verifyDateNavigation(routeBase, view, dates);

      await go(`${routeBase}?view=list&date=2026-10-05${routeBase === "/admin/quick-view" ? "&project=fixture-project" : ""}`);
      const titleBoxes = await visibleBoxes("[data-calendar-list-title]");
      const timeBoxes = await visibleBoxes("[data-calendar-list-time]");
      const staffingBoxes = await visibleBoxes("[data-calendar-list-staffing]");
      assert.equal(titleBoxes.length, timeBoxes.length, "every list title has one visible time");
      assert.equal(timeBoxes.length, staffingBoxes.length, "every list time retains its staffing indicator");
      if (width >= 640) {
        equalWithin(timeBoxes.map((box) => box.left), 0.5, `${routeBase}: desktop times share one column`);
        equalWithin(staffingBoxes.map((box) => box.right), 0.5, `${routeBase}: desktop staffing stays right-aligned`);
        titleBoxes.forEach((title, index) => assert(Math.abs(title.top - timeBoxes[index].top) <= 2, `${routeBase}: time aligns with its title`));
      } else {
        titleBoxes.forEach((title, index) => assert.equal(title.left, timeBoxes[index].left, `${routeBase}: mobile time stacks with its title`));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `${routeBase}: list has no horizontal overflow`);
      await shot(`calendar-layout-${routeBase.endsWith("quick-view") ? "quick-view" : "calendar"}-list-${width}`);

      const more = page.getByText("+3 more volunteers", { exact: true });
      await more.click();
      const expandedTimes = await visibleBoxes("[data-calendar-list-time]");
      if (width >= 640) equalWithin(expandedTimes.map((box) => box.left), 0.5, `${routeBase}: expanded roster keeps desktop time column`);
      await shot(`calendar-layout-${routeBase.endsWith("quick-view") ? "quick-view" : "calendar"}-expanded-list-${width}`);
    }
  }
  assert.deepEqual(errors, []);
  console.log("PASS: stable Day/Week/Month/List arrows across labels, aligned List time/staffing columns, mobile stacking and expanded rosters.");
} finally {
  await browser.close();
}
