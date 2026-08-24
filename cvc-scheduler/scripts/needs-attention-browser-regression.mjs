import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

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
const writeAssignmentDetailReviewScreenshots =
  process.env.WRITE_ASSIGNMENT_DETAIL_REVIEW_SCREENSHOTS === "1";
const writeScreenshots =
  process.env.WRITE_NEEDS_ATTENTION_REVIEW_SCREENSHOTS === "1" ||
  writeAssignmentDetailReviewScreenshots;
const screenshotDirectory = path.join(
  root,
  "docs",
  "previews",
  writeAssignmentDetailReviewScreenshots
    ? "iteration-12-40-assignment-detail-review"
    : "iteration-12-39-needs-attention-review",
);
const namespace = `qa-12-39-needs-attention-${randomUUID()}`;
const labels = ["populated", "empty", "under-capability", "inactive-contact"];
const workspaceKeys = Object.fromEntries(labels.map((label) => [label, `${namespace}-${label}`]));
const workspaceNames = {
  populated: "Bozeman Community Build",
  empty: "Gallatin Service Project",
  "under-capability": "Belgrade Local Project",
  "inactive-contact": "Inactive Contact Project",
};
const cookieSets = new Map();
const userIds = new Map();
const secrets = new Set();
let cleanupCompleted = false;

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
  return spawnSync(name, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

function runPsql(containerName, sql) {
  const result = command(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "--no-psqlrc",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: sql },
  );
  if (result.status !== 0) {
    throw new Error(redact(result.stderr || "Local Needs Attention fixture command failed."));
  }
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
  const value = new Date(`${date}T00:00:00.000Z`);
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
  const capabilities =
    label === "under-capability"
      ? ["workspace.read", "calendar.view"]
      : [
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
      role: label === "under-capability" ? "main_contact" : "assistant_contact",
      capabilities,
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
  runPsql(
    containerName,
    `update public.project_contacts set status = 'inactive' where auth_user_id = '${userIds.get("inactive-contact")}'::uuid;`,
  );

  const label = "populated";
  const today = workspaceToday();
  const volunteerNames = [
    "Alex Rivera",
    "Morgan Lee",
    "Jordan Kim",
    "Taylor Brooks",
    "Casey Nguyen",
    "Riley Morgan",
  ];
  const volunteerRows = volunteerNames.map(
    (name, index) =>
      `('${randomUUID()}'::uuid, ${workspaceIdSql(label)}, null, 'manual', ${contactIdSql(label)}, now(), 'active', 'ready', ${sqlText(name)}, ${sqlText(`${namespace}-volunteer-${index}@example.invalid`)}, null, 'Bozeman Congregation', 'Email', '{}'::jsonb, '{}'::jsonb, '')`,
  );
  const itemRows = [];
  const assignmentRows = [];
  const responseRows = [];

  const makeItem = ({
    title,
    day,
    time,
    needed,
    publication = "published",
    lifecycle = "active",
  }) => {
    const id = randomUUID();
    const endHour = String((Number(time.slice(0, 2)) + 2) % 24).padStart(2, "0");
    itemRows.push(
      `('${id}'::uuid, ${workspaceIdSql(label)}, null, ${sqlText(title)}, 'general', 'timed', '${addDays(today, day)}', null, '${time}:00', '${endHour}${time.slice(2)}:00', 'America/Denver', ${needed}, null, '{}'::jsonb, '${lifecycle}', ${contactIdSql(label)}, ${contactIdSql(label)}, '${publication}', ${publication === "published" ? "now()" : "null"}, ${publication === "published" ? contactIdSql(label) : "null"})`,
    );
    return id;
  };
  const volunteerIdSql = (offset) =>
    `(select id from public.volunteer_profiles where workspace_id = ${workspaceIdSql(label)} order by full_name offset ${offset} limit 1)`;
  const assign = (itemId, volunteerOffset, status, lifecycle = "active") => {
    const assignmentId = randomUUID();
    assignmentRows.push(
      `('${assignmentId}'::uuid, ${workspaceIdSql(label)}, '${itemId}'::uuid, ${volunteerIdSql(volunteerOffset)}, '${lifecycle}', null, '${userIds.get(label)}'::uuid)`,
    );
    responseRows.push(
      `('${randomUUID()}'::uuid, ${workspaceIdSql(label)}, '${assignmentId}'::uuid, '${status}', 'project_contact', ${status === "needs_response" ? "null" : "now()"}, now(), now())`,
    );
  };

  const underfilled = makeItem({ title: "Drywall Crew", day: 1, time: "08:00", needed: 4 });
  assign(underfilled, 0, "confirmed");
  assign(underfilled, 1, "needs_response");
  assign(underfilled, 2, "declined");

  const fullyCoveredPending = makeItem({
    title: "Gate Attendant",
    day: 4,
    time: "09:00",
    needed: 2,
  });
  assign(fullyCoveredPending, 3, "needs_response");
  assign(fullyCoveredPending, 4, "needs_response");

  const deniedOnly = makeItem({ title: "Site Cleanup", day: 10, time: "15:00", needed: 1 });
  assign(deniedOnly, 5, "declined");
  assign(deniedOnly, 0, "confirmed");

  makeItem({ title: "Material Staging", day: 15, time: "07:30", needed: 3 });
  const outsideResponse = makeItem({
    title: "Future Welcome Crew",
    day: 22,
    time: "10:00",
    needed: 1,
  });
  assign(outsideResponse, 1, "needs_response");
  makeItem({
    title: "Draft Supply Check",
    day: 3,
    time: "13:00",
    needed: 3,
    publication: "draft",
  });
  makeItem({
    title: "Canceled Setup",
    day: 2,
    time: "12:00",
    needed: 3,
    lifecycle: "canceled",
  });
  makeItem({ title: "Project Welcome", day: 5, time: "11:00", needed: 0 });
  const confirmedOnly = makeItem({
    title: "Material Check-in",
    day: 6,
    time: "14:00",
    needed: 1,
  });
  assign(confirmedOnly, 2, "confirmed");

  runPsql(
    containerName,
    `begin;
insert into public.volunteer_profiles (id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes) values ${volunteerRows.join(",\n")};
insert into public.calendar_items (id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes, custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id, publication_state, published_at, published_by_project_contact_id) values ${itemRows.join(",\n")};
insert into public.calendar_assignments (id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id) values ${assignmentRows.join(",\n")};
insert into public.assignment_responses (id, workspace_id, assignment_id, response_status, response_source, responded_at, created_at, updated_at) values ${responseRows.join(",\n")};
commit;`,
  );
}

async function applyCookies(context, label) {
  const jar = cookieSets.get(label);
  assert(jar?.size, `Missing cookies for ${label}.`);
  const target = new URL(baseUrl);
  await context.addCookies(
    [...jar.values()].map((cookie) => ({
      domain: target.hostname,
      httpOnly: false,
      name: cookie.name,
      path: "/",
      sameSite: "Lax",
      secure: target.protocol === "https:",
      value: cookie.value,
    })),
  );
}

function watchPageErrors(page) {
  const failures = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes("/_next/webpack-hmr")) return;
    failures.push(message.text());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  return failures;
}

async function openInbox(browser, label, viewport) {
  const context = await browser.newContext({ viewport });
  await applyCookies(context, label);
  const page = await context.newPage();
  const failures = watchPageErrors(page);
  const response = await page.goto(createPreviewUrl(baseUrl, "/admin/needs-attention"), {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  assert(response?.ok(), `Needs Attention returned ${response?.status() ?? "no response"}.`);
  await page.getByRole("heading", { name: "Needs Attention", exact: true }).waitFor();
  return { context, page, failures };
}

async function capture(page, filename) {
  if (!writeScreenshots) return;
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    fullPage: false,
    path: path.join(screenshotDirectory, filename),
  });
}

async function verifyPopulatedDesktop(browser) {
  const result = await openInbox(browser, "populated", { width: 1440, height: 1000 });
  const { page } = result;
  await page
    .getByText(workspaceNames.populated, { exact: true })
    .filter({ visible: true })
    .first()
    .waitFor();
  await page.getByRole("heading", { name: "Staffing", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Responses", exact: true }).waitFor();
  await page.getByText("2 volunteers still needed", { exact: true }).waitFor();
  await page.getByText("2 responses pending", { exact: true }).waitFor();
  assert.equal(await page.locator("[data-signal-row]").count(), 5);
  assert.equal(await page.getByText(/Draft Supply Check|Material Staging|Future Welcome Crew|Canceled Setup/).count(), 0);
  const desktopNav = page.getByRole("navigation").filter({ hasText: "Overview" }).first();
  const needsLink = desktopNav.getByRole("link", { name: "Needs Attention", exact: true });
  assert.equal(await needsLink.getAttribute("aria-current"), "page");
  await capture(page, "needs-attention-desktop-mixed-1440x1000.png");

  const coverageRow = page.locator('details[data-signal-kind="coverage"]').filter({ hasText: "Drywall Crew" });
  await coverageRow.locator("summary").click();
  assert.equal(await coverageRow.getAttribute("open"), "");
  await coverageRow.getByText("2/4 assigned", { exact: true }).waitFor();
  const calendarLink = coverageRow.getByRole("link", { name: "Open in Calendar", exact: true });
  const expectedDate = addDays(workspaceToday(), 1);
  assert.equal(await calendarLink.getAttribute("href"), `/admin/calendar?view=day&date=${expectedDate}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, "needs-attention-desktop-expanded-1440x1000.png");

  const pendingRow = page
    .locator('details[data-signal-kind="pending"]')
    .filter({ hasText: "Gate Attendant" });
  await pendingRow.locator("summary").click();
  const pendingLinks = pendingRow.getByRole("link", { name: /View affected assignment/ });
  assert.equal(await pendingLinks.count(), 2);
  await capture(page, "needs-attention-pending-drill-down-desktop-1440x1000.png");
  await pendingLinks.first().click();
  await page.waitForURL(/\/admin\/assignments\/[0-9a-f-]+$/);
  await page.getByRole("heading", { name: "Assignment", exact: true }).waitFor();
  await page.getByText("Gate Attendant", { exact: true }).waitFor();
  await page.goto(createPreviewUrl(baseUrl, "/admin/needs-attention"), {
    waitUntil: "domcontentloaded",
  });

  const deniedRow = page
    .locator('details[data-signal-kind="denied"]')
    .filter({ hasText: "Site Cleanup" });
  await deniedRow.locator("summary").click();
  const deniedLink = deniedRow.getByRole("link", {
    name: "View assignment for Site Cleanup",
    exact: true,
  });
  assert.equal(await deniedLink.count(), 1);
  await deniedLink.click();
  await page.waitForURL(/\/admin\/assignments\/[0-9a-f-]+$/);
  await page.getByText("Site Cleanup", { exact: true }).waitFor();
  await page.getByText("Can’t make it", { exact: true }).first().waitFor();
  await page.goto(createPreviewUrl(baseUrl, "/admin/needs-attention"), {
    waitUntil: "domcontentloaded",
  });

  const calendarResponse = await page.goto(
    createPreviewUrl(baseUrl, `/admin/calendar?view=day&date=${expectedDate}`),
    { waitUntil: "domcontentloaded", timeout: 30_000 },
  );
  assert(calendarResponse?.ok(), "Contextual Calendar destination did not load.");
  await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
  assert.deepEqual(result.failures, []);
  await result.context.close();
}

async function verifyEmptyAndUnavailable(browser) {
  const empty = await openInbox(browser, "empty", { width: 1440, height: 1000 });
  await empty.page
    .getByText(workspaceNames.empty, { exact: true })
    .filter({ visible: true })
    .first()
    .waitFor();
  await empty.page.getByRole("heading", { name: "You're all caught up", exact: true }).waitFor();
  assert.equal(await empty.page.locator("[data-signal-row]").count(), 0);
  await capture(empty.page, "needs-attention-desktop-all-caught-up-1440x1000.png");
  assert.deepEqual(empty.failures, []);
  await empty.context.close();

  const unavailable = await openInbox(browser, "under-capability", { width: 1440, height: 1000 });
  await unavailable.page.getByText("Needs Attention is unavailable", { exact: true }).waitFor();
  assert.equal(await unavailable.page.getByText(workspaceNames.populated, { exact: true }).count(), 0);
  assert.equal(await unavailable.page.locator("[data-signal-row]").count(), 0);
  assert.deepEqual(unavailable.failures, []);
  await unavailable.context.close();

  const inactive = await openInbox(browser, "inactive-contact", { width: 1440, height: 1000 });
  await inactive.page.getByText("Needs Attention is unavailable", { exact: true }).waitFor();
  assert.equal(await inactive.page.locator("[data-signal-row]").count(), 0);
  assert.deepEqual(inactive.failures, []);
  await inactive.context.close();
}

async function verifyMobile(browser) {
  const populated = await openInbox(browser, "populated", { width: 390, height: 844 });
  const { page } = populated;
  const primary = page.getByRole("navigation", {
    name: "Primary admin navigation",
    exact: true,
  });
  const attentionTab = primary.getByRole("link", {
    name: "Open Needs Attention",
    exact: true,
  });
  await attentionTab.waitFor();
  assert.equal(await attentionTab.getAttribute("aria-current"), "page");
  assert.equal(await primary.getByRole("link", { name: "Open Volunteers", exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await capture(page, "needs-attention-mobile-populated-390x844.png");

  const pendingRow = page.locator('details[data-signal-kind="pending"]').filter({ hasText: "Gate Attendant" });
  await pendingRow.locator("summary").click();
  await pendingRow.scrollIntoViewIfNeeded();
  const mobileAssignmentLink = pendingRow.getByRole("link", {
    name: /View affected assignment 1/,
  });
  await mobileAssignmentLink.waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await capture(page, "needs-attention-assignment-drill-down-mobile-390x844.png");
  await mobileAssignmentLink.click();
  await page.waitForURL(/\/admin\/assignments\/[0-9a-f-]+$/);
  await page.getByRole("heading", { name: "Assignment", exact: true }).waitFor();
  await page.goto(createPreviewUrl(baseUrl, "/admin/needs-attention"), {
    waitUntil: "domcontentloaded",
  });

  await page.getByRole("button", { name: "Open more admin navigation", exact: true }).click();
  const more = page.getByRole("dialog", { name: "More admin navigation", exact: true });
  await more.waitFor();
  await more.getByRole("link", { name: "Volunteers", exact: true }).waitFor();
  await more.getByRole("link", { name: "Communications", exact: true }).waitFor();
  await more.getByRole("link", { name: "Settings", exact: true }).waitFor();
  assert.equal(await primary.getByRole("link", { name: "Open Overview", exact: true }).getAttribute("href"), "/admin/dashboard");
  assert.equal(await primary.getByRole("link", { name: "Open Tasks", exact: true }).getAttribute("href"), "/admin/tasks");
  assert.equal(await primary.getByRole("link", { name: "Open Calendar", exact: true }).getAttribute("href"), "/admin/calendar");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await capture(page, "needs-attention-mobile-more-volunteers-390x844.png");
  assert.deepEqual(populated.failures, []);
  await populated.context.close();
}

function cleanup(containerName) {
  const scope = labels.map((label) => workspaceIdSql(label)).join(", ");
  const authIds = [...userIds.values()].map((id) => `'${id}'::uuid`).join(", ");
  runPsql(
    containerName,
    `begin;
delete from public.assignment_responses where workspace_id in (${scope});
delete from public.calendar_assignments where workspace_id in (${scope});
delete from public.calendar_items where workspace_id in (${scope});
delete from public.volunteer_profiles where workspace_id in (${scope});
delete from public.workspace_contact_grants where workspace_id in (${scope});
delete from public.project_contacts where auth_user_id in (${authIds});
delete from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)};
delete from auth.users where id in (${authIds});
commit;`,
  );
  const residue = runPsql(
    containerName,
    `select
      (select count(*) from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)}) +
      (select count(*) from auth.users where email like ${sqlText(`${namespace}%@example.invalid`)});`,
  );
  assert.equal(residue, "0", `Needs Attention browser fixture left ${residue} rows.`);
  cleanupCompleted = true;
}

let containerName;
try {
  assert(supabaseUrl && anonKey, "Local Supabase public values are required.");
  assert(isLoopback(supabaseUrl), "Needs Attention browser QA accepts only local Supabase.");
  assert(isLoopback(baseUrl), "Needs Attention browser QA accepts only a loopback app.");
  secrets.add(anonKey);
  const preview = await fetch(createPreviewUrl(baseUrl, "/admin/needs-attention"), {
    redirect: "manual",
  });
  assert(preview.status < 500, `Needs Attention preview is unavailable at ${baseUrl}.`);
  containerName = await localContainer();
  await Promise.all(labels.map(createUser));
  seedData(containerName);
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await verifyPopulatedDesktop(browser);
    await verifyEmptyAndUnavailable(browser);
    await verifyMobile(browser);
  } finally {
    await browser.close();
  }
  console.log("Needs Attention browser validation passed.");
  console.log("Confirmed persisted desktop/mobile inboxes, expansion, Calendar context, all-caught-up/unavailable states, canonical mobile navigation, 390px width, and zero residue.");
  if (writeScreenshots) {
    console.log(`Needs Attention review screenshots written to ${screenshotDirectory}.`);
  }
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
