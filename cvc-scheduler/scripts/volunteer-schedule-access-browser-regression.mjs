import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();
const authUserIds = [];
let cleanupCompleted = false;

const fixture = {
  namespace: `qa-12-20-browser-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  contactId: randomUUID(),
  grantId: randomUUID(),
  volunteers: {
    own: randomUUID(),
    empty: randomUUID(),
    other: randomUUID(),
  },
  items: {
    needs: randomUUID(),
    confirmed: randomUUID(),
    declined: randomUUID(),
    draft: randomUUID(),
    canceled: randomUUID(),
  },
  assignments: {
    needs: randomUUID(),
    confirmed: randomUUID(),
    declined: randomUUID(),
    draft: randomUUID(),
    canceled: randomUUID(),
    other: randomUUID(),
  },
  responses: {
    needs: randomUUID(),
    confirmed: randomUUID(),
    declined: randomUUID(),
    draft: randomUUID(),
    canceled: randomUUID(),
    other: randomUUID(),
  },
};

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function redact(value) {
  let message = value instanceof Error ? value.message : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
      message = message.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  return message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]");
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
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
    throw new Error(`Volunteer schedule browser SQL failed: ${redact(result.stderr).slice(0, 900)}`);
  }
  return result.stdout.trim();
}

function queryJson(containerName, sql) {
  const output = runPsql(
    containerName,
    `select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)::text from (${sql}) as rows;`,
  );
  return JSON.parse(output || "[]");
}

async function resolveLocalDatabaseContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define a local project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
  assert(
    result.status === 0 && result.stdout.trim() === "true",
    "Local Supabase is unavailable. Start local Supabase with output redirected/redacted before browser validation.",
  );
  return containerName;
}

async function applyMigrationIfNeeded(containerName, migrationName, probeSql) {
  if (queryJson(containerName, probeSql).length > 0) return;
  const migration = await readFile(
    path.join(root, "supabase", "migrations", migrationName),
    "utf8",
  );
  runPsql(containerName, migration);
}

async function applyRequiredMigrations(containerName) {
  await applyMigrationIfNeeded(
    containerName,
    "20260714121500_manual_volunteer_profiles.sql",
    "select 1 as present from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_profiles' and column_name = 'profile_source'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121600_calendar_item_management.sql",
    "select 1 as present from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'follow_up_project_contact_id'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121700_calendar_source_selection.sql",
    "select 1 as present from pg_proc where proname = 'update_calendar_item_preset_timed'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121800_calendar_assignment_management.sql",
    "select 1 as present from pg_proc where proname = 'create_calendar_assignments_batch'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714121900_calendar_publication_visibility.sql",
    "select 1 as present from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'publication_state'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714122000_volunteer_schedule_access.sql",
    "select 1 as present from information_schema.tables where table_schema = 'public' and table_name = 'volunteer_schedule_access_tokens'",
  );
}

async function createAuthenticatedUser() {
  const email = `${fixture.namespace}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, "Disposable Auth user creation failed.");
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, "Disposable Auth sign-in failed.");
    session = signin.data.session;
  }
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  authUserIds.push(signup.data.user.id);
  return { client, userId: signup.data.user.id };
}

function volunteerRow(id, fullName) {
  return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaceId)}, null, 'manual', ${sqlUuid(fixture.contactId)}, clock_timestamp(), 'active', 'ready', ${sqlText(fullName)}, ${sqlText(`${fullName.replaceAll(" ", ".").toLowerCase()}@example.invalid`)}, null, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, '')`;
}

function itemRow(id, title, date, lifecycle, publication, notes = null) {
  const publishedAt = publication === "published" ? "clock_timestamp()" : "null";
  const publisher = publication === "published" ? sqlUuid(fixture.contactId) : "null";
  return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaceId)}, null, ${sqlText(title)}, 'general', 'timed', ${sqlText(date)}::date, null, '09:00'::time, '11:00'::time, 'America/Denver', 1, ${sqlText(notes)}, '{}'::jsonb, ${sqlText(lifecycle)}, ${sqlUuid(fixture.contactId)}, ${sqlUuid(fixture.contactId)}, ${sqlText(publication)}, ${publishedAt}, ${publisher})`;
}

function assignmentRow(id, itemId, volunteerId, lifecycle = "active") {
  return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(itemId)}, ${sqlUuid(volunteerId)}, ${sqlText(lifecycle)}, null, null)`;
}

function responseRow(id, assignmentId, status) {
  const respondedAt = status === "needs_response" ? "null" : "clock_timestamp()";
  return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(assignmentId)}, ${sqlText(status)}, 'project_contact', null, ${respondedAt}, null)`;
}

function insertFixtures(containerName, userId) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-workspace`)}, 'QA 12.20 Browser Workspace', 'active', 'America/Denver', '2026-08-01', '2026-12-31', false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.20 Browser Other', 'active', 'America/Denver', '2026-08-01', '2026-12-31', false);
insert into public.project_contacts (id, auth_user_id, status)
values (${sqlUuid(fixture.contactId)}, ${sqlUuid(userId)}, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values (${sqlUuid(fixture.grantId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.contactId)}, 'main_contact', array['workspace.read','assignments.edit']::text[], 'active', clock_timestamp() - interval '1 day', null, null);
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at,
  lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method,
  availability_snapshot, skills_help_snapshot, profile_notes
)
values
  ${volunteerRow(fixture.volunteers.own, `${fixture.namespace} Browser Volunteer`)},
  ${volunteerRow(fixture.volunteers.empty, `${fixture.namespace} Empty Volunteer`)},
  ${volunteerRow(fixture.volunteers.other, `${fixture.namespace} Other Volunteer`)};
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
)
values
  ${itemRow(fixture.items.needs, `${fixture.namespace} Needs Reply`, "2026-08-10", "active", "published", "Safe schedule note.")},
  ${itemRow(fixture.items.confirmed, `${fixture.namespace} Confirmed`, "2026-08-11", "active", "published")},
  ${itemRow(fixture.items.declined, `${fixture.namespace} Declined`, "2026-08-12", "active", "published")},
  ${itemRow(fixture.items.draft, `${fixture.namespace} Draft Hidden`, "2026-08-13", "active", "draft")},
  ${itemRow(fixture.items.canceled, `${fixture.namespace} Canceled Hidden`, "2026-08-14", "canceled", "published")};
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
)
values
  ${assignmentRow(fixture.assignments.needs, fixture.items.needs, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.confirmed, fixture.items.confirmed, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.declined, fixture.items.declined, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.draft, fixture.items.draft, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.canceled, fixture.items.confirmed, fixture.volunteers.own, "canceled")},
  ${assignmentRow(fixture.assignments.other, fixture.items.needs, fixture.volunteers.other)};
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
)
values
  ${responseRow(fixture.responses.needs, fixture.assignments.needs, "needs_response")},
  ${responseRow(fixture.responses.confirmed, fixture.assignments.confirmed, "confirmed")},
  ${responseRow(fixture.responses.declined, fixture.assignments.declined, "declined")},
  ${responseRow(fixture.responses.draft, fixture.assignments.draft, "needs_response")},
  ${responseRow(fixture.responses.canceled, fixture.assignments.canceled, "confirmed")},
  ${responseRow(fixture.responses.other, fixture.assignments.other, "confirmed")};`,
  );
}

async function issueToken(client, volunteerProfileId) {
  const { data, error } = await client.rpc("issue_volunteer_schedule_access", {
    p_volunteer_profile_id: volunteerProfileId,
    p_ttl_hours: 720,
  });
  assert(!error && Array.isArray(data) && data.length === 1, "schedule token issuance failed");
  secrets.add(data[0].bearer_token);
  return data[0].bearer_token;
}

async function watchPage(page) {
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  return failures;
}

async function runBrowserProof(token, emptyToken) {
  assert(isLoopbackUrl(baseUrl), "Volunteer schedule browser QA accepts only loopback preview.");
  const preview = await fetch(createPreviewUrl(baseUrl, "/v/schedule"), { redirect: "manual" });
  assert(preview.status < 500, `Preview is unavailable at ${baseUrl}. Start npm run preview with redirected logs.`);

  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const failures = await watchPage(page);
    await page.goto(createPreviewUrl(baseUrl, `/v/access/${token}`), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForURL(/\/v\/schedule$/, { timeout: 30_000 });
    assert.equal(new URL(page.url()).pathname, "/v/schedule");
    assert(!page.url().includes(token), "final URL contains bearer");
    const earlyCookies = await context.cookies(createPreviewUrl(baseUrl, "/v/schedule"));
    const earlyScheduleCookie = earlyCookies.find((cookie) => cookie.name === "pl-volunteer-schedule");
    assert.equal(earlyScheduleCookie?.value === token, true, "schedule cookie did not preserve bearer value");
    await page.getByRole("heading", { name: "Your volunteer schedule" }).waitFor();
    await page.getByText(`${fixture.namespace} Browser Volunteer`).waitFor();
    await page.getByText("QA 12.20 Browser Workspace", { exact: true }).waitFor();
    await page.getByText(`${fixture.namespace} Needs Reply`).waitFor();
    await page.getByText(`${fixture.namespace} Confirmed`).waitFor();
    await page.getByText(`${fixture.namespace} Declined`).waitFor();
    assert.equal(await page.getByText(`${fixture.namespace} Draft Hidden`).count(), 0);
    assert.equal(await page.getByText(`${fixture.namespace} Canceled Hidden`).count(), 0);
    assert.equal(await page.getByText(`${fixture.namespace} Other Volunteer`).count(), 0);
    await page.getByText("Needs reply").first().waitFor();
    await page.getByText("Confirmed").first().waitFor();
    await page.getByText("Can’t make it").first().waitFor();

    const cookies = await context.cookies(createPreviewUrl(baseUrl, "/v/schedule"));
    const scheduleCookie = cookies.find((cookie) => cookie.name === "pl-volunteer-schedule");
    assert(scheduleCookie, "schedule cookie was not set");
    assert.equal(scheduleCookie.httpOnly, true, "schedule cookie must be HttpOnly");
    assert.equal(scheduleCookie.sameSite, "Lax", "schedule cookie must be SameSite=Lax");
    assert.equal(scheduleCookie.expires, -1, "schedule cookie must be session-only");
    assert.equal(scheduleCookie.secure, new URL(baseUrl).protocol === "https:");

    const storageLeak = await page.evaluate(
      (secret) =>
        document.documentElement.innerHTML.includes(secret) ||
        localStorage.getItem("pl-volunteer-schedule") === secret ||
        sessionStorage.getItem("pl-volunteer-schedule") === secret ||
        document.cookie.includes(secret),
      token,
    );
    assert.equal(storageLeak, false, "bearer leaked to HTML, client storage, or readable cookies");

    const detailButton = page.getByRole("button", { name: /Needs Reply/ }).first();
    await detailButton.click();
    await page.getByRole("dialog", { name: /Needs Reply/ }).waitFor();
    await page.getByText("Safe schedule note.").waitFor();
    await page.getByText("The project team will include contact details in a later beta slice.").waitFor();
    assert.equal(await page.getByRole("button", { name: /^Confirm$/ }).count(), 0);
    assert.equal(await page.getByRole("button", { name: /^Deny$/ }).count(), 0);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(`${fixture.namespace} Needs Reply`).waitFor();

    await Promise.all([
      page.waitForURL(/\/v\/schedule$/),
      page.getByRole("button", { name: /Not you\? Leave this schedule/ }).first().click(),
    ]);
    await page.getByRole("heading", { name: "This schedule link is unavailable" }).waitFor();
    assert.equal(
      (await context.cookies(createPreviewUrl(baseUrl, "/v/schedule"))).some(
        (cookie) => cookie.name === "pl-volunteer-schedule" && cookie.value,
      ),
      false,
      "Not you did not clear the schedule cookie",
    );
    assert.deepEqual(failures, []);
    await context.close();

    const invalidContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const invalidPage = await invalidContext.newPage();
    await invalidPage.goto(
      createPreviewUrl(baseUrl, "/v/access/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      { waitUntil: "domcontentloaded" },
    );
    assert.equal(new URL(invalidPage.url()).pathname, "/v/schedule");
    await invalidPage.getByRole("heading", { name: "This schedule link is unavailable" }).waitFor();
    assert.equal((await invalidContext.cookies(createPreviewUrl(baseUrl, "/v/schedule"))).length, 0);
    await invalidContext.close();

    const emptyContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const emptyPage = await emptyContext.newPage();
    await emptyPage.goto(createPreviewUrl(baseUrl, `/v/access/${emptyToken}`), {
      waitUntil: "domcontentloaded",
    });
    await emptyPage.getByRole("heading", { name: "No published assignments yet" }).waitFor();
    const overflow = await emptyPage.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    assert.equal(overflow, false, "390px schedule route has horizontal overflow");
    await emptyContext.close();
  } finally {
    await browser.close();
  }
}

async function run() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Volunteer schedule browser QA accepts only local Supabase.");
  secrets.add(anonKey);
  const containerName = await resolveLocalDatabaseContainer();
  await applyRequiredMigrations(containerName);
  const user = await createAuthenticatedUser();
  insertFixtures(containerName, user.userId);
  const token = await issueToken(user.client, fixture.volunteers.own);
  const emptyToken = await issueToken(user.client, fixture.volunteers.empty);
  await runBrowserProof(token, emptyToken);
  console.log("Volunteer schedule access browser validation passed.");
  console.log("Confirmed clean bearer exchange, HttpOnly session cookie, persisted schedule display, detail sheet, mobile width, and no mock leakage.");
}

async function cleanup(containerName) {
  const authIdArray =
    authUserIds.length > 0
      ? authUserIds.map((id) => `${sqlUuid(id)}`).join(", ")
      : "'00000000-0000-4000-8000-000000000000'::uuid";
  const authDeletes = authUserIds
    .map((id) => `delete from auth.users where id = ${sqlUuid(id)};`)
    .join("\n");
  const residue = runPsql(
    containerName,
    `begin;
delete from public.volunteer_schedule_access_tokens where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.assignment_responses where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.calendar_assignments where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.calendar_items where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.volunteer_profiles where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.workspace_contact_grants
where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)})
or project_contact_id in (select id from public.project_contacts where auth_user_id = any(array[${authIdArray}]));
delete from public.project_contacts where auth_user_id = any(array[${authIdArray}]);
delete from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)};
${authDeletes}
commit;
select (
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${authIdArray}])) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}-%@example.invalid`)})
)::text;`,
  );
  assert.equal(residue, "0", `Volunteer schedule browser cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

let containerName;
try {
  containerName = await resolveLocalDatabaseContainer();
  await run();
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
} finally {
  if (containerName) {
    try {
      await cleanup(containerName);
    } catch (cleanupError) {
      console.error(redact(cleanupError));
      process.exitCode = 1;
    }
  }
  if (!cleanupCompleted) process.exitCode = 1;
}
