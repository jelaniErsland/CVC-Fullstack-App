import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { measureAdminNavigation } from "./admin-navigation-browser-measurement.mjs";
import { measureRouteHandoff } from "./admin-route-handoff-browser-measurement.mjs";
import { verifyClientHandoff } from "./admin-route-handoff-browser-regression.mjs";

import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";
import { buildWorkspaceAccessProvisioningSql } from "../lib/workspaces/provisioning.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const writeScreenshots = process.env.WRITE_OVERVIEW_REVIEW_SCREENSHOTS === "1";
const screenshotDirectory = path.join(root, "docs", "previews", "12-53-admin-workspace");
const namespace = `qa-12-38-overview-${randomUUID()}`;
const cookieSets = new Map();
const userIds = new Map();
const secrets = new Set();
let cleanupCompleted = false;

const labels = ["populated", "review", "empty", "partial"];
const workspaceKeys = Object.fromEntries(labels.map((label) => [label, `${namespace}-${label}`]));
const workspaceNames = {
  populated: "Bozeman Local Project",
  review: "Bozeman Build Week",
  empty: "Gallatin Community Project",
  partial: "Belgrade Project",
};

function isLoopback(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function redact(value) {
  let message = value instanceof Error ? value.message : String(value);
  for (const secret of secrets) {
    message = message.replaceAll(secret, "[redacted]").replaceAll(encodeURIComponent(secret), "[redacted]");
  }
  return message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]");
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function command(name, args, options = {}) {
  return spawnSync(name, args, { cwd: root, encoding: "utf8", windowsHide: true, ...options });
}

function runPsql(containerName, sql) {
  const result = command("docker", ["exec", "-i", containerName, "psql", "--no-psqlrc", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: sql });
  if (result.status !== 0) throw new Error(redact(result.stderr || "Local Overview fixture command failed."));
  return result.stdout.trim();
}

async function localContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "Local Supabase project id is missing.");
  const name = `supabase_db_${projectId}`;
  const inspected = command("docker", ["inspect", "--format", "{{.State.Running}}", name]);
  assert.equal(inspected.stdout.trim(), "true", "Local Supabase must be running.");
  return name;
}

function workspaceToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function createUser(label) {
  const email = `${namespace}-${label}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const jar = new Map();
  secrets.add(email);
  secrets.add(password);
  const client = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
    cookies: {
      getAll: () => [...jar.values()].map(({ name, value }) => ({ name, value })),
      setAll: (cookies) => {
        for (const cookie of cookies) {
          if (cookie.value) jar.set(cookie.name, cookie);
          else jar.delete(cookie.name);
        }
      },
    },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, `Auth fixture failed for ${label}.`);
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Auth sign-in failed for ${label}.`);
    session = signin.data.session;
  }
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  cookieSets.set(label, jar);
  userIds.set(label, signup.data.user.id);
}

function provisionInput(label) {
  const full = [
    "workspace.read",
    "calendar.view",
    "calendar.edit",
    "assignments.view",
    "assignments.edit",
    "tasks.view",
    "tasks.edit",
    "volunteers.view",
    "volunteers.edit",
  ];
  return {
    workspace: {
      key: workspaceKeys[label],
      displayName: workspaceNames[label],
      lifecycle: "active",
      timezone: "America/Denver",
      startsOn: addDays(workspaceToday(), -14),
      endsOn: addDays(workspaceToday(), 60),
      publicIntakeEnabled: false,
    },
    contact: { authUserId: userIds.get(label), status: "active" },
    grant: {
      role: label === "partial" ? "main_contact" : "assistant_contact",
      capabilities: label === "partial" ? ["workspace.read", "calendar.view", "assignments.view"] : full,
      status: "active",
      validFrom: "2026-01-01T00:00:00Z",
      validUntil: null,
    },
  };
}

function workspaceIdSql(label) {
  return `(select id from public.workspaces where workspace_key = ${sqlText(workspaceKeys[label])})`;
}

function contactIdSql(label) {
  return `(select project_contact_id from public.workspace_contact_grants where workspace_id = ${workspaceIdSql(label)} limit 1)`;
}

function seedData(containerName) {
  for (const label of labels) {
    runPsql(containerName, buildWorkspaceAccessProvisioningSql(provisionInput(label)));
  }

  const today = workspaceToday();
  const taskRows = [];
  const volunteerRows = [];
  const itemRows = [];
  const assignmentRows = [];
  const responseRows = [];

  for (const label of ["populated", "review"]) {
    const workspaceId = workspaceIdSql(label);
    const contactId = contactIdSql(label);
    for (const [index, name] of ["Gate Attendant", "Drywall Crew", "Material Staging", "Lunch Support"].entries()) {
      taskRows.push(`('${randomUUID()}'::uuid, ${workspaceId}, ${sqlText(name)}, ${sqlText(`Reusable ${name.toLowerCase()} work.`)}, ${index === 3 ? "'food'" : "'general'"}, ${index + 1}, true, false, '[]'::jsonb, 'active')`);
    }
    for (const [index, name] of ["Alex Rivera", "Morgan Lee", "Jordan Kim", "Taylor Brooks"].entries()) {
      volunteerRows.push(`('${randomUUID()}'::uuid, ${workspaceId}, null, 'manual', ${contactId}, now(), 'active', 'ready', ${sqlText(name)}, ${sqlText(`${label}-${index}@example.invalid`)}, null, 'Bozeman Congregation', 'Email', '{}'::jsonb, '{}'::jsonb, '')`);
    }
  }

  const makeItem = (label, title, day, time, needed, type = "general") => {
    const id = randomUUID();
    itemRows.push(`('${id}'::uuid, ${workspaceIdSql(label)}, null, ${sqlText(title)}, ${sqlText(type)}, 'timed', '${addDays(today, day)}', null, '${time}:00', '${String(Number(time.slice(0, 2)) + 2).padStart(2, "0")}${time.slice(2)}:00', 'America/Denver', ${needed}, null, '{}'::jsonb, 'active', ${contactIdSql(label)}, ${contactIdSql(label)}, 'published', now(), ${contactIdSql(label)})`);
    return id;
  };
  const volunteerIdSql = (label, offset) => `(select id from public.volunteer_profiles where workspace_id = ${workspaceIdSql(label)} order by full_name offset ${offset} limit 1)`;
  const assign = (label, itemId, volunteerOffset, status) => {
    const assignmentId = randomUUID();
    assignmentRows.push(`('${assignmentId}'::uuid, ${workspaceIdSql(label)}, '${itemId}'::uuid, ${volunteerIdSql(label, volunteerOffset)}, 'active', null, '${userIds.get(label)}'::uuid)`);
    responseRows.push(`('${randomUUID()}'::uuid, ${workspaceIdSql(label)}, '${assignmentId}'::uuid, '${status}', 'project_contact', ${status === "needs_response" ? "null" : "now()"}, now(), now())`);
  };

  const populatedItems = [
    makeItem("populated", "Gate Attendant", 1, "08:00", 1),
    makeItem("populated", "Drywall Crew", 2, "09:00", 1),
    makeItem("populated", "Material Staging", 3, "07:30", 1),
    makeItem("populated", "Lunch Support", 4, "11:30", 1, "food"),
  ];
  populatedItems.forEach((id, index) => assign("populated", id, index, "confirmed"));
  const night = makeItem("populated", "Night Watch", 5, "19:00", 1, "security");
  assign("populated", night, 0, "needs_response");

  const covered = makeItem("review", "Morning Check-in", 1, "07:30", 1);
  const unfilled = makeItem("review", "Drywall Crew", 2, "09:00", 3);
  const waiting = makeItem("review", "Material Staging", 3, "08:00", 1);
  const denied = makeItem("review", "Site Cleanup", 4, "15:00", 1);
  const food = makeItem("review", "Kitchen Attendant", 5, "11:00", 2, "food");
  const security = makeItem("review", "Night Watch", 6, "19:00", 1, "security");
  assign("review", covered, 0, "confirmed");
  assign("review", unfilled, 1, "confirmed");
  assign("review", waiting, 2, "needs_response");
  assign("review", denied, 3, "declined");
  assign("review", denied, 0, "confirmed");
  assign("review", food, 0, "confirmed");
  assign("review", security, 1, "needs_response");

  const partialItem = makeItem("partial", "Volunteer Orientation", 1, "10:00", 1);
  // No assignment is intentional: it proves Calendar appears while optional modules stay hidden.

  runPsql(containerName, `begin;
insert into public.task_presets (id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible, is_system_preset, custom_field_definitions, lifecycle) values ${taskRows.join(",\n")};
insert into public.volunteer_profiles (id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes) values ${volunteerRows.join(",\n")};
insert into public.calendar_items (id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes, custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id, publication_state, published_at, published_by_project_contact_id) values ${itemRows.join(",\n")};
insert into public.calendar_assignments (id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id) values ${assignmentRows.join(",\n")};
insert into public.assignment_responses (id, workspace_id, assignment_id, response_status, response_source, responded_at, created_at, updated_at) values ${responseRows.join(",\n")};
commit;`);
  assert(partialItem);
}

async function applyCookies(context, label) {
  const jar = cookieSets.get(label);
  assert(jar?.size, `Missing cookies for ${label}.`);
  const target = new URL(baseUrl);
  await context.addCookies([...jar.values()].map((cookie) => ({
    domain: target.hostname,
    httpOnly: false,
    name: cookie.name,
    path: "/",
    sameSite: "Lax",
    secure: target.protocol === "https:",
    value: cookie.value,
  })));
}

async function openOverview(browser, label, viewport, beforeNavigate) {
  const context = await browser.newContext({ viewport });
  await applyCookies(context, label);
  const page = await context.newPage();
  if (process.env.NAVIGATION_DISABLE_PREFETCH === "1") await page.route("**/*", route => route.request().headers()["next-router-prefetch"] || route.request().headers()["next-router-segment-prefetch"] ? route.abort() : route.continue());
  if (beforeNavigate) await beforeNavigate(page);
  const failures = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes("/_next/webpack-hmr")) return;
    // This measurement deliberately aborts only prefetch requests above.
    if (process.env.NAVIGATION_DISABLE_PREFETCH === "1" && message.text() === "Failed to load resource: net::ERR_FAILED") return;
    failures.push(message.text());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  const response = await page.goto(createPreviewUrl(baseUrl, "/admin/dashboard"), { waitUntil: "networkidle", timeout: 30_000 });
  assert(response?.ok(), `Overview returned ${response?.status() ?? "no response"}.`);
  await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
  assert(await page.getByText(new RegExp(workspaceNames[label])).count() > 0, "The current project should remain identifiable.");
  return { context, page, failures };
}

async function capture(page, filename) {
  if (!writeScreenshots) return;
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ animations: "disabled", fullPage: false, path: path.join(screenshotDirectory, filename) });
}

async function verifyIntegratedAttention(page) {
  const summary = page.getByRole("region", { name: "Needs Attention summary" });
  await summary.waitFor();
  assert.equal(await page.getByRole("region", { name: "Support status" }).count(), 0, "The duplicate Support status panel should be absent.");
  for (const [label, support] of [["General", "general"], ["Food", "food"], ["Security", "security"]]) {
    const link = summary.getByRole("link", { name: new RegExp(`^${label} · \\d+ follow-ups?$`) });
    await link.waitFor();
    const target = new URL(await link.getAttribute("href"), baseUrl);
    assert.equal(target.pathname, "/admin/needs-attention");
    assert.equal(target.searchParams.get("support"), support);
    assert.equal(target.searchParams.get("horizon"), "7");
  }
  const inbox = summary.getByRole("link", { name: "Open inbox" });
  await inbox.waitFor();
  assert.equal(new URL(await inbox.getAttribute("href"), baseUrl).pathname, "/admin/needs-attention");
  return summary;
}

async function verifyDesktop(browser) {
  const populated = await openOverview(browser, "populated", { width: 1440, height: 1000 });
  await populated.page.getByText("Gate Attendant", { exact: true }).waitFor();
  const today = populated.page.getByRole("region", { name: "Today and next up" });
  await today.waitFor();
  await today.getByText("Gate Attendant", { exact: true }).waitFor();
  await today.getByRole("link", { name: "Calendar" }).waitFor();
  await verifyIntegratedAttention(populated.page);
  await populated.page.getByRole("link", { name: /Create Calendar item/ }).waitFor();
  await capture(populated.page, "12-53-overview-active-desktop.png");
  const targetDate = addDays(workspaceToday(), 1);
  const rowLink = populated.page.getByText("Gate Attendant", { exact: true }).locator("xpath=ancestor::a");
  const rowUrl = new URL(await rowLink.getAttribute("href"), baseUrl);
  assert.equal(rowUrl.searchParams.get("date"), targetDate);
  assert(rowUrl.searchParams.get("item"), "Single upcoming work should open its Calendar item.");
  const navigation = await populated.page.goto(rowUrl.toString(), { waitUntil: "networkidle", timeout: 30_000 });
  assert(navigation?.ok(), `Calendar row target returned ${navigation?.status() ?? "no response"}.`);
  await populated.page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
  await populated.page.getByRole("button", { name: "Open calendar filters" }).click();
  const filters = populated.page.getByRole("dialog", { name: "Calendar filters" }).filter({ visible: true });
  await filters.waitFor();
  await filters.getByRole("searchbox", { name: "Volunteer name" }).fill("alex");
  await filters.getByRole("button", { name: /Alex Rivera/ }).click();
  await populated.page.getByRole("button", { name: /Remove volunteer filter for Alex Rivera/ }).waitFor();
  await capture(populated.page, "12-53-calendar-remembered-filter-desktop.png");
  await populated.page.reload({ waitUntil: "networkidle" });
  await populated.page.getByRole("button", { name: /Remove volunteer filter for Alex Rivera/ }).waitFor();
  await populated.page.getByRole("button", { name: /Remove volunteer filter for Alex Rivera/ }).click();
  assert.equal(await populated.page.getByText(/Filtered by: Alex Rivera/).count(), 0);
  await populated.page.goto(createPreviewUrl(baseUrl, `/admin/calendar?view=week&date=${workspaceToday()}&create=1`), { waitUntil: "networkidle" });
  await populated.page.getByRole("dialog", { name: "Plan project work" }).waitFor();
  assert.deepEqual(populated.failures, []);
  await populated.context.close();

  const review = await openOverview(browser, "review", { width: 1440, height: 1000 });
  await review.page.getByText(/understaffed item/).first().waitFor();
  const reviewSummary = await verifyIntegratedAttention(review.page);
  const foodLink = reviewSummary.getByRole("link", { name: /^Food · \d+ follow-ups?$/ });
  assert.equal(new URL(await foodLink.getAttribute("href"), baseUrl).searchParams.get("support"), "food");
  await capture(review.page, "12-53-overview-attention-and-support.png");
  await foodLink.click();
  await review.page.waitForURL(/\/admin\/needs-attention\?support=food/);
  await review.page.getByText("Food", { exact: true }).first().waitFor();
  assert.deepEqual(review.failures, []);
  await review.context.close();

  const empty = await openOverview(browser, "empty", { width: 1440, height: 1000 });
  await empty.page.getByText("No work in the next 7 days", { exact: true }).waitFor();
  assert.equal(await empty.page.getByText(/0 (items|tasks|volunteers)/i).count(), 0);
  await capture(empty.page, "12-53-overview-quiet-desktop.png");
  assert.deepEqual(empty.failures, []);
  await empty.context.close();
}

async function verifyMobile(browser) {
  for (const [label, filename] of [
    ["populated", "12-53-overview-mobile-active.png"],
    ["review", "12-53-overview-mobile-attention.png"],
  ]) {
    const result = await openOverview(browser, label, { width: 390, height: 844 });
    assert.equal(await result.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `390px ${label} Overview has horizontal overflow.`);
    await result.page.getByRole("region", { name: "Today and next up" }).waitFor();
    const summary = await verifyIntegratedAttention(result.page);
    if (label === "review") {
      await summary.scrollIntoViewIfNeeded();
    }
    await capture(result.page, filename);
    assert.deepEqual(result.failures, []);
    await result.context.close();
  }

  const partial = await openOverview(browser, "partial", { width: 390, height: 844 });
  await partial.page.getByText("Volunteer Orientation", { exact: true }).first().waitFor();
  assert.equal(await partial.page.getByText(/active reusable tasks|ready volunteers/i).count(), 0);
  assert.equal(await partial.page.getByRole("link", { name: /Add volunteer/ }).count(), 0);
  assert.equal(await partial.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(partial.failures, []);
  await partial.context.close();
}

async function benchmarkNavigation(browser) {
  const { context, page, failures } = await openOverview(browser, "populated", { width: 1440, height: 1000 });
  if (process.env.MEASURE_ADMIN_NAVIGATION === "3") {
    try { console.log(JSON.stringify(await measureRouteHandoff(page))); }
    finally { await context.close(); }
    assert.deepEqual(failures, []);
    return;
  }
  const routeSteps = [
    ["Overview → Calendar", "/admin/calendar", "Calendar"],
    ["Calendar → Needs Attention", "/admin/needs-attention", "Needs Attention"],
    ["Needs Attention → Communications", "/admin/announcements", "Communications"],
    ["Communications → Volunteers", "/admin/volunteers", "Volunteers"],
    ["Volunteers → Calendar", "/admin/calendar", "Calendar"],
    ["Calendar → Task library", "/admin/tasks", "Tasks"],
    ["Task library → Overview", "/admin/dashboard", "Overview"],
  ];
  const records = [];
  if (process.env.MEASURE_ADMIN_NAVIGATION === "2") {
    try { console.log(JSON.stringify(await measureAdminNavigation(page, routeSteps))); }
    catch(error) { console.error(JSON.stringify({failures,visibleMain:await page.locator("main").innerText()})); throw error; }
    assert.deepEqual(failures, []);
    await context.close();
    return;
  }
  for (const [label, path, heading] of routeSteps) {
    const shell = await page.locator("aside").first().elementHandle();
    const link = page.locator(`nav[aria-label="Workspace navigation"] a[href^="${path}"]`).first();
    const started = performance.now();
    await link.click({ noWaitAfter: true });
    const acknowledgedMs = Math.round(performance.now() - started);
    await page.waitForURL((url) => url.pathname === path, { timeout: 30_000 });
    const urlMs = Math.round(performance.now() - started);
    await page.locator("main h1").filter({ hasText: heading }).first().waitFor({ timeout: 30_000 });
    await page.locator('[data-admin-route-loading]:visible').waitFor({state:"hidden"});
    const usefulMs = Math.round(performance.now() - started);
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
    const settledMs = Math.round(performance.now() - started);
    records.push({ label, acknowledgedMs, urlMs, usefulMs, settledMs, shellRetained: await shell.evaluate((element) => element.isConnected) });
  }
  if (process.env.EXPECT_PERSISTENT_ADMIN_SHELL === "1") {
    assert(records.every((record) => record.shellRetained), "Primary admin navigation remounted its shell.");
    await page.goBack();
    await page.waitForURL((url) => url.pathname === "/admin/tasks");
    await page.goForward();
    await page.waitForURL((url) => url.pathname === "/admin/dashboard");
    await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Mobile admin shell overflowed.");
    const mobileShell = await page.locator("main#main-content").elementHandle();
    await page.getByRole("link", { name: "Open Calendar", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/admin/calendar");
    await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
    assert(await mobileShell.evaluate((element) => element.isConnected), "Mobile admin navigation remounted its shell.");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "Mobile Calendar overflowed.");
    await page.setViewportSize({ width: 1440, height: 1000 });
    const rapidShell = await page.locator("aside").first().elementHandle();
    await page.locator('nav[aria-label="Workspace navigation"] a[href^="/admin/tasks"]').first().click({ noWaitAfter: true });
    await page.locator('nav[aria-label="Workspace navigation"] a[href^="/admin/dashboard"]').first().click({ noWaitAfter: true });
    await page.waitForURL((url) => url.pathname === "/admin/dashboard");
    await page.getByRole("heading", { name: "Overview", exact: true }).waitFor();
    assert(await rapidShell.evaluate((element) => element.isConnected), "Rapid admin navigation remounted its shell.");
  }
  assert.deepEqual(failures, []);
  await context.close();
  console.log(JSON.stringify({ schema: "project-local.admin-navigation-browser.v1", records }));
}

async function verifyAuthenticatedPendingNavigation(browser) {
  const { context, page, failures } = await openOverview(browser, "populated", { width: 1440, height: 1000 });
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let intercepted = false;
  try {
    await page.route("**/admin/tasks**", async (route) => {
      const request = route.request();
      if (!intercepted && !request.headers()["next-router-prefetch"] && !request.headers()["next-router-segment-prefetch"] && (new URL(request.url()).searchParams.has("_rsc") || request.headers().rsc)) {
        intercepted = true;
        await held;
      }
      await route.continue();
    });
    const shell = await page.locator("aside").first().elementHandle();
    await page.locator('nav[aria-label="Workspace navigation"] a[href^="/admin/tasks"]').first().click({ noWaitAfter: true });
    await page.locator('[data-admin-route-loading="tasks"]').waitFor({ state: "visible", timeout: 5_000 });
    assert.equal(await page.getByRole("heading", { name: "Tasks", exact: true }).isVisible(), true, "The destination frame must identify the pending route.");
    assert.equal(await page.locator('[data-admin-route-loading="tasks"]').getAttribute("aria-busy"), "true");
    assert.equal(await page.getByRole("heading", { name: "Overview", exact: true }).isVisible(), false, "Previous private content must not appear as the new destination.");
    if(process.env.ADMIN_NAVIGATION_EVIDENCE_DIR){
      await mkdir(process.env.ADMIN_NAVIGATION_EVIDENCE_DIR,{recursive:true});
      await page.screenshot({path:path.join(process.env.ADMIN_NAVIGATION_EVIDENCE_DIR,"destination-frame-desktop.png")});
      await page.setViewportSize({width:390,height:844});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(process.env.ADMIN_NAVIGATION_EVIDENCE_DIR,"destination-frame-mobile.png")});
    }
    assert(await shell.evaluate((element) => element.isConnected), "The shell remounted during pending navigation.");
    assert(intercepted, "Expected an authenticated Task library RSC request.");
    release();
    await page.waitForURL((url) => url.pathname === "/admin/tasks");
    await page.getByRole("heading", { name: "Tasks", exact: true }).waitFor();
    await page.locator('[data-admin-route-loading="tasks"]').waitFor({ state: "hidden" });
    assert.equal(await page.locator('[data-navigation-pending="true"]').count(), 0);
    assert.deepEqual(failures, []);
  } finally {
    release?.();
    await context.close();
  }
}

async function verifyStreamingNavigation(browser, containerName) {
  const prefetches = [];
  const loaded = await openOverview(browser, "populated", { width: 1440, height: 1000 }, page => {
    return page.route("**/admin/**", async route => {
      const request = route.request();
      if ((request.headers()["next-router-prefetch"] || request.headers()["next-router-segment-prefetch"]) && ["/admin/dashboard","/admin/calendar","/admin/needs-attention","/admin/announcements","/admin/volunteers","/admin/tasks"].includes(new URL(request.url()).pathname)) {
        // Complete the actual prefetched response through Playwright's network
        // API so Chromium's speculative cancellation cannot discard the proof.
        const response=await route.fetch();
        prefetches.push({path:new URL(request.url()).pathname,body:await response.text()});
        await route.fulfill({response});
      } else {
        await route.continue();
      }
    });
  });
  const {page, context, failures} = loaded;
  try {
    await page.locator('nav[aria-label="Workspace navigation"] a[href="/admin/volunteers"]').hover();
    // Give Next's idle/intent prefetch scheduler one bounded turn; this is a
    // privacy gate, separate from the click-timing measurements.
    await page.waitForTimeout(1000);
    // A prefetched frame is presentation only; it must not retain roster data
    // or bypass a changed grant when the destination is actually requested.
    const payloads = prefetches;
    assert(payloads.length > 0, `Expected primary-route frame prefetch (${prefetches.length} responses observed).`);
    for (const payload of payloads) assert(!["Alex Rivera","populated-0@example.invalid","Gate Attendant","Night Watch"].some(value=>payload.body.includes(value)), `Private route data appeared in a ${payload.path} prefetch.`);
    runPsql(containerName, `update public.workspace_contact_grants set status = 'revoked', revoked_at = now() where workspace_id = ${workspaceIdSql("populated")};`);
    try {
      await page.locator('nav[aria-label="Workspace navigation"] a[href="/admin/volunteers"]').click();
      await page.getByText("Volunteer profiles are unavailable", {exact:true}).waitFor();
      assert.equal(await page.getByText("Alex Rivera", {exact:true}).count(), 0, "Prefetched navigation bypassed revoked access.");
    } finally {
      runPsql(containerName, `update public.workspace_contact_grants set status = 'active', revoked_at = null where workspace_id = ${workspaceIdSql("populated")};`);
    }
    await page.reload({waitUntil:"networkidle"});
    await page.getByPlaceholder("Search volunteers", {exact:true}).waitFor();
    assert(await page.getByText("Alex Rivera", {exact:true}).count() > 0);
    const impatientShell=await page.locator("aside").elementHandle();
    for(const target of ["/admin/dashboard","/admin/calendar","/admin/volunteers","/admin/needs-attention","/admin/calendar","/admin/announcements","/admin/dashboard"]){
      await page.locator(`nav[aria-label="Workspace navigation"] a[href^="${target}"]`).first().click({noWaitAfter:true});
    }
    await page.getByRole("heading",{name:"Overview",exact:true}).waitFor();
    await page.locator('[data-admin-route-loading]:visible').waitFor({state:"hidden"});
    await page.waitForLoadState("networkidle");
    assert(await impatientShell.evaluate(element=>element.isConnected));
    assert.equal(new URL(page.url()).pathname,"/admin/dashboard");
    assert.equal(await page.locator("main h1:visible").count(),1,"Rapid navigation must have one clear route identity.");

    // A late response for an interrupted route must never replace a later one.
    let release;
    let heldRequest = false;
    const held = new Promise(resolve => {release = resolve;});
    await page.route("**/admin/tasks**", async route => {
      if (route.request().headers().rsc && !route.request().headers()["next-router-prefetch"] && !route.request().headers()["next-router-segment-prefetch"]) {
        heldRequest = true;
        await held;
      }
      await route.continue();
    });
    const shell = await page.locator("aside").elementHandle();
    try {
      const requested=page.waitForRequest(request=>new URL(request.url()).pathname==="/admin/tasks" && request.headers().rsc && !request.headers()["next-router-prefetch"]);
      await page.locator('nav[aria-label="Workspace navigation"] a[href="/admin/tasks"]').click();
      await requested;
      await page.locator('nav[aria-label="Workspace navigation"] a[href^="/admin/calendar"]').click();
      await page.locator('[data-admin-route-loading="calendar"]').waitFor({state:"hidden"});
      await page.getByRole("heading", {name:"Calendar", exact:true}).waitFor();
      release();
      await page.waitForLoadState("networkidle");
      assert(heldRequest, "Expected a held Task library data response.");
      assert.equal(new URL(page.url()).pathname, "/admin/calendar");
      assert.equal(await page.getByRole("heading", {name:"Tasks", exact:true}).isVisible(), false);
      assert(await shell.evaluate(element => element.isConnected));
    } finally {release();await page.unroute("**/admin/tasks**");}

    await page.goBack();
    await page.goForward();
    await page.getByRole("heading", {name:"Calendar", exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});
    const main = await page.locator("main#main-content").elementHandle();
    await page.getByRole("link", {name:"Open Volunteers", exact:true}).click();
    await page.getByPlaceholder("Search volunteers", {exact:true}).waitFor();
    await page.getByRole("link", {name:"Open Needs Attention", exact:true}).click();
    await page.getByText("Filters",{exact:true}).click();
    await page.getByRole("searchbox", {name:"Search attention issues"}).waitFor();
    assert(await main.evaluate(element => element.isConnected));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole("button", {name:"Open more admin navigation",exact:true}).click();
    await page.getByRole("link", {name:"Communications",exact:true}).last().click();
    await page.getByRole("tab", {name:/Schedule deliveries/}).waitFor();
    await page.getByRole("button", {name:"Review recipients",exact:true}).waitFor();
    await page.waitForFunction(() => document.querySelector('[data-communication-history-state="ready"]'));
    assert.equal(await page.getByRole("button", {name:"Review recipients",exact:true}).isEnabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    // Changing the authenticated context and refreshing must rebuild project UI.
    await applyCookies(context, "review");
    await page.goto(createPreviewUrl(baseUrl,"/admin/dashboard"),{waitUntil:"networkidle"});
    await page.getByText(new RegExp(workspaceNames.review)).first().waitFor();
    assert.equal(await page.getByText(new RegExp(workspaceNames.populated)).count(),0);
    assert.deepEqual(failures, []);
    console.log(`Streaming navigation passed: ${payloads.length} safe prefetched frames; revoked grant, fresh account/project, interruption, back/forward, and mobile isolation.`);
  } catch(error) {console.error(JSON.stringify({streamingFailures:failures,visibleMain:await page.locator("main").innerText()}));throw error;}
  finally {await context.close();}
}

async function verifyStreamingFailure(browser) {
  if(process.env.VERIFY_ADMIN_STREAMING_FAILURE === "photo"){
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    try{
      await applyCookies(context,"populated");
      const page=await context.newPage();
      const started=performance.now();
      await page.goto(createPreviewUrl(baseUrl,"/admin/dashboard"),{waitUntil:"commit"});
      await page.getByRole("region",{name:"Today and next up"}).waitFor();
      const usefulMs=Math.round(performance.now()-started);
      assert(usefulMs<1500,"Operational Overview must not await the deliberately stalled project photo.");
      assert.equal(await page.getByRole("region",{name:"Needs Attention summary"}).isVisible(),true);
      console.log(JSON.stringify({test:"stalled optional project photo",usefulOverviewMs:usefulMs,photoRead:"still pending",productionLatencyClaimed:false}));
    }finally{await context.close();}
    return;
  }
  const {page,context}=await openOverview(browser,"populated",{width:1440,height:1000});
  try {
    const shell=await page.locator("aside").elementHandle();
    const communications=process.env.VERIFY_ADMIN_STREAMING_FAILURE === "communications";
    const path=communications?"/admin/announcements":"/admin/volunteers";
    await page.locator(`nav[aria-label="Workspace navigation"] a[href="${path}"]`).click();
    if(communications){
      await page.getByRole("tab",{name:/Schedule deliveries/}).click();
      assert.equal(await page.getByRole("button",{name:"Review recipients",exact:true}).isDisabled(),true);
      await page.getByRole("button",{name:"Retry delivery history",exact:true}).waitFor({timeout:25000});
      assert.equal(await page.getByText("No deliveries yet.",{exact:true}).count(),0,"Failed history must not masquerade as empty history.");
      await page.getByRole("button",{name:"Retry delivery history",exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('[data-communication-history-state="ready"]'));
    }else{
      await page.getByRole("alert").getByText("This page could not be loaded.",{exact:true}).waitFor({timeout:25000});
      await page.getByRole("button",{name:"Try again",exact:true}).click();
      await page.getByPlaceholder("Search volunteers",{exact:true}).waitFor();
    }
    assert(await shell.evaluate(element=>element.isConnected),"Read failure/retry must retain the shell.");
    console.log(`Finite ${communications?"Communications history":"Volunteers route"} loading, honest failure, and successful fresh retry passed.`);
  }finally{await context.close();}
}

function cleanup(containerName) {
  const scope = labels.map((label) => workspaceIdSql(label)).join(", ");
  const authIds = [...userIds.values()].map((id) => `'${id}'::uuid`).join(", ");
  runPsql(containerName, `begin;
delete from public.assignment_responses where workspace_id in (${scope});
delete from public.calendar_assignments where workspace_id in (${scope});
delete from public.calendar_items where workspace_id in (${scope});
delete from public.task_presets where workspace_id in (${scope});
delete from public.volunteer_profiles where workspace_id in (${scope});
delete from public.workspace_contact_grants where workspace_id in (${scope});
delete from public.project_contacts where auth_user_id in (${authIds});
delete from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)};
delete from auth.users where id in (${authIds});
commit;`);
  const residue = runPsql(containerName, `select
    (select count(*) from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)}) +
    (select count(*) from auth.users where email like ${sqlText(`${namespace}%@example.invalid`)});`);
  assert.equal(residue, "0", `Overview browser fixture left ${residue} rows.`);
  cleanupCompleted = true;
}

let containerName;
try {
  assert(supabaseUrl && anonKey, "Local Supabase public values are required.");
  assert(isLoopback(supabaseUrl), "Overview browser QA accepts only local Supabase.");
  assert(isLoopback(baseUrl), "Overview browser QA accepts only a loopback app.");
  secrets.add(anonKey);
  const preview = await fetch(createPreviewUrl(baseUrl, "/admin/dashboard"), { redirect: "manual" });
  assert(preview.status < 500, `Overview preview is unavailable at ${baseUrl}.`);
  containerName = await localContainer();
  await Promise.all(labels.map(createUser));
  seedData(containerName);
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    if (process.env.VERIFY_ADMIN_CLIENT_HANDOFF === "1") {
      for (const mobile of [false,true]) {
        const result=await openOverview(browser,"populated",mobile?{width:390,height:844}:{width:1440,height:1000});
        try { await verifyClientHandoff(result.page,{mobile}); assert.deepEqual(result.failures,[]); }
        finally { await result.context.close(); }
      }
    }
    else if (process.env.VERIFY_ADMIN_STREAMING_FAILURE) await verifyStreamingFailure(browser);
    else if (process.env.VERIFY_ADMIN_STREAMING_NAVIGATION === "1") await verifyStreamingNavigation(browser, containerName);
    else if (process.env.VERIFY_ADMIN_PENDING_NAVIGATION === "1") await verifyAuthenticatedPendingNavigation(browser);
    else if (["1", "2", "3"].includes(process.env.MEASURE_ADMIN_NAVIGATION)) await benchmarkNavigation(browser);
    else {
      await verifyDesktop(browser);
      await verifyMobile(browser);
    }
  } finally {
    await browser.close();
  }
  if (process.env.VERIFY_ADMIN_PENDING_NAVIGATION === "1") {
    console.log("Authenticated admin pending-navigation browser validation passed.");
    console.log("Confirmed immediate destination frame, honest loading state, persistent shell, destination content, and zero fixture residue.");
  } else {
    console.log("Overview browser validation passed.");
    console.log("Confirmed real persisted desktop/mobile states, Calendar row navigation, capability-hidden sections, ready-empty behavior, and 390px width.");
  }
  if (writeScreenshots) console.log(`Overview review screenshots written to ${screenshotDirectory}.`);
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
} finally {
  if (containerName) {
    try {
      cleanup(containerName);
    } catch (error) {
      console.error(redact(error));
      process.exitCode = 1;
    }
  }
  if (!cleanupCompleted) process.exitCode = 1;
}
