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

async function openOverview(browser, label, viewport) {
  const context = await browser.newContext({ viewport });
  await applyCookies(context, label);
  const page = await context.newPage();
  const failures = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes("/_next/webpack-hmr")) return;
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

async function verifyDesktop(browser) {
  const populated = await openOverview(browser, "populated", { width: 1440, height: 1000 });
  await populated.page.getByText("Gate Attendant", { exact: true }).waitFor();
  await populated.page.getByRole("region", { name: "Today and next up" }).waitFor();
  await populated.page.getByRole("region", { name: "Needs Attention summary" }).waitFor();
  await populated.page.getByRole("region", { name: "Support status" }).waitFor();
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
  await review.page.getByRole("region", { name: "Support status" }).getByRole("link", { name: /Food/ }).waitFor();
  const foodLink = review.page.getByRole("region", { name: "Support status" }).getByRole("link", { name: /Food/ });
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
    if (label === "review") {
      await result.page.getByRole("region", { name: "Needs Attention summary" }).scrollIntoViewIfNeeded();
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
    await verifyDesktop(browser);
    await verifyMobile(browser);
  } finally {
    await browser.close();
  }
  console.log("Overview browser validation passed.");
  console.log("Confirmed real persisted desktop/mobile states, Calendar row navigation, capability-hidden sections, ready-empty behavior, and 390px width.");
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
