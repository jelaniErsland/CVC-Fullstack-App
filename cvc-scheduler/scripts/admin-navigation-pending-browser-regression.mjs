import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";

const root = process.cwd();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const writeReviewScreenshots =
  process.env.WRITE_ADMIN_NAVIGATION_FEEDBACK_REVIEW_SCREENSHOTS === "1";
const writeIterationReviewScreenshots =
  process.env.WRITE_ITERATION_12_44D1_CAPTURES === "1";
const screenshotDirectory = path.join(
  root,
  "docs",
  "previews",
  "iteration-12-42-admin-navigation-feedback",
);
const iterationScreenshotDirectory = path.resolve(
  root,
  "..",
  "previews",
  "beta-review",
  "iteration-12-44d1-mobile-overlays",
);

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(
      new URL(value).hostname,
    );
  } catch {
    return false;
  }
}

function routeUrl(route) {
  return createPreviewUrl(baseUrl, route);
}

async function delayRouteResponse(page, pathname) {
  let release;
  let intercepted = false;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const handler = async (route) => {
    const url = new URL(route.request().url());
    const requestHeaders = route.request().headers();
    const isNavigationPayload =
      url.pathname === pathname &&
      (url.searchParams.has("_rsc") || "rsc" in requestHeaders);
    if (!intercepted && isNavigationPayload) {
      intercepted = true;
      await held;
    }
    await route.continue();
  };
  await page.route("**/*", handler);
  return {
    async release() {
      assert(intercepted, `Expected an RSC navigation request for ${pathname}.`);
      release();
    },
    async dispose() {
      await page.unroute("**/*", handler);
    },
  };
}

async function capturePendingNavigation({
  page,
  linkName,
  pathname,
  screenshotPath,
}) {
  const delayed = await delayRouteResponse(page, pathname);
  await page.getByRole("link", { name: linkName, exact: true }).click({ noWaitAfter: true });
  const pending = page.locator('[data-navigation-pending="true"]');
  await pending.waitFor({ state: "visible", timeout: 5_000 });
  assert.equal(await page.locator("main").first().isVisible(), true);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  await delayed.release();
  await page.waitForURL(`**${pathname}`, { timeout: 10_000 });
  await delayed.dispose();
  await page.getByRole("link", { name: linkName, exact: true }).waitFor({ state: "visible" });
  assert.equal(
    await page.getByRole("link", { name: linkName, exact: true }).getAttribute("aria-current"),
    "page",
  );
  assert.equal(await page.locator('[data-navigation-pending="true"]').count(), 0);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
}

assert(isLoopbackUrl(baseUrl), "Pending-navigation browser regression requires a loopback preview.");
assert(browserExecutable, "A local Chrome or Edge executable is required for browser regression.");
if (writeReviewScreenshots) await mkdir(screenshotDirectory, { recursive: true });
if (writeIterationReviewScreenshots) {
  await mkdir(iterationScreenshotDirectory, { recursive: true });
}

const browser = await chromium.launch({ executablePath: browserExecutable });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await page.goto(routeUrl("/admin/dashboard"), { waitUntil: "networkidle" });
  if (writeIterationReviewScreenshots) {
    await page.screenshot({
      path: path.join(iterationScreenshotDirectory, "desktop-admin-shell.png"),
      fullPage: true,
    });
  }
  await capturePendingNavigation({
    page,
    linkName: "Tasks",
    pathname: "/admin/tasks",
    screenshotPath: writeReviewScreenshots
      ? path.join(screenshotDirectory, "desktop-pending-navigation.png")
      : undefined,
  });

  await page.getByRole("link", { name: "Calendar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL("**/admin/calendar", { timeout: 10_000 });
  assert.equal(
    await page.getByRole("link", { name: "Calendar", exact: true }).getAttribute("aria-current"),
    "page",
  );
  await page.getByRole("link", { name: "Needs Attention", exact: true }).click();
  await page.waitForURL("**/admin/needs-attention", { timeout: 10_000 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(routeUrl("/admin/dashboard"), { waitUntil: "networkidle" });
  assert.equal(
    await page.getByRole("button", { name: "Open navigation menu" }).count(),
    0,
    "The redundant mobile hamburger must not be exposed.",
  );
  if (writeIterationReviewScreenshots) {
    await page.screenshot({
      path: path.join(iterationScreenshotDirectory, "mobile-admin-more-closed.png"),
      fullPage: false,
    });
  }
  await capturePendingNavigation({
    page,
    linkName: "Open Calendar",
    pathname: "/admin/calendar",
    screenshotPath: writeReviewScreenshots
      ? path.join(screenshotDirectory, "mobile-pending-navigation.png")
      : undefined,
  });
  const moreTrigger = page.getByRole("button", { name: "Open more admin navigation" });
  await moreTrigger.click();
  const moreDialog = page.getByRole("dialog", { name: "More admin navigation" });
  await moreDialog.waitFor();
  assert.deepEqual(
    await page.evaluate(() => ({
      body: getComputedStyle(document.body).overflow,
      root: getComputedStyle(document.documentElement).overflow,
    })),
    { body: "hidden", root: "hidden" },
    "Mobile More must lock background scrolling.",
  );
  if (writeIterationReviewScreenshots) {
    await page.screenshot({
      path: path.join(iterationScreenshotDirectory, "mobile-admin-more-top.png"),
      fullPage: false,
    });
  }
  const moreScroll = page.locator('[data-overlay-scroll="mobile-more"]');
  assert.equal(
    await moreScroll.evaluate((element) => element.scrollHeight > element.clientHeight),
    true,
    "Mobile More fixture must exercise internal scrolling.",
  );
  await moreScroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  assert.equal(
    await moreDialog.getByRole("button", { name: "Close more admin navigation" }).evaluate(
      (element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      },
    ),
    true,
    "Mobile More close control must remain reachable after scrolling.",
  );
  if (writeIterationReviewScreenshots) {
    await page.screenshot({
      path: path.join(iterationScreenshotDirectory, "mobile-admin-more-bottom.png"),
      fullPage: false,
    });
  }
  await moreTrigger.click();
  await moreDialog.waitFor({ state: "hidden" });
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), "hidden");

  await moreTrigger.click();
  await moreDialog.waitFor();
  await page.getByRole("button", { name: "Close more navigation backdrop" }).click({ position: { x: 8, y: 8 } });
  await moreDialog.waitFor({ state: "hidden" });

  await moreTrigger.click();
  await page.getByRole("link", { name: "Volunteers", exact: true }).click();
  await page.waitForURL("**/admin/volunteers", { timeout: 10_000 });
  assert.equal(
    await page.getByRole("button", { name: "Open more admin navigation" }).getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(await page.locator('[data-navigation-pending="true"]').count(), 0);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page.goBack();
  await page.waitForURL("**/admin/calendar", { timeout: 10_000 });
  assert.equal(
    await page.getByRole("link", { name: "Open Calendar", exact: true }).getAttribute("aria-current"),
    "page",
  );
  await page.goForward();
  await page.waitForURL("**/admin/volunteers", { timeout: 10_000 });
  assert.equal(await page.locator('[data-navigation-pending="true"]').count(), 0);
  assert.deepEqual(consoleErrors, []);
} finally {
  await browser.close();
}

console.log("Admin navigation pending browser checks passed.");
