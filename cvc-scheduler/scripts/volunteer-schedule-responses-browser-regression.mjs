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

const fixture = {
  namespace: `qa-12-21-browser-${randomUUID()}`,
  workspaceId: randomUUID(),
  contactId: randomUUID(),
  grantId: randomUUID(),
  volunteerId: randomUUID(),
  items: {
    confirm: randomUUID(),
    decline: randomUUID(),
    allA: randomUUID(),
    allB: randomUUID(),
    inside48: randomUUID(),
  },
  assignments: {
    confirm: randomUUID(),
    decline: randomUUID(),
    allA: randomUUID(),
    allB: randomUUID(),
    inside48: randomUUID(),
  },
  responses: {
    confirm: randomUUID(),
    decline: randomUUID(),
    allA: randomUUID(),
    allB: randomUUID(),
    inside48: randomUUID(),
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
    throw new Error(`Volunteer schedule response browser SQL failed: ${redact(result.stderr).slice(0, 900)}`);
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
  for (const [migrationName, probeSql] of [
    ["20260714121500_manual_volunteer_profiles.sql", "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'volunteer_profiles' and column_name = 'profile_source'"],
    ["20260714121600_calendar_item_management.sql", "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'follow_up_project_contact_id'"],
    ["20260714121700_calendar_source_selection.sql", "select 1 from pg_proc where proname = 'update_calendar_item_preset_timed'"],
    ["20260714121800_calendar_assignment_management.sql", "select 1 from pg_proc where proname = 'create_calendar_assignments_batch'"],
    ["20260714121900_calendar_publication_visibility.sql", "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'calendar_items' and column_name = 'publication_state'"],
    ["20260714122000_volunteer_schedule_access.sql", "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'volunteer_schedule_access_tokens'"],
    ["20260714122100_volunteer_schedule_responses.sql", "select 1 from pg_constraint, pg_proc where conname = 'assignment_responses_source_known' and pg_get_constraintdef(pg_constraint.oid) like '%volunteer_schedule%' and proname = 'submit_volunteer_schedule_assignment_response' and prosrc like '%response_source = ''volunteer_schedule''%'"],
  ]) {
    await applyMigrationIfNeeded(containerName, migrationName, probeSql);
  }
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

function itemValues(id, title, dateSql) {
  return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaceId)}, null, ${sqlText(title)}, 'general', 'timed', (${dateSql})::date, null, '09:00'::time, '11:00'::time, 'America/Denver', 1, ${sqlText("QA response browser note.")}, '{}'::jsonb, 'active', ${sqlUuid(fixture.contactId)}, ${sqlUuid(fixture.contactId)}, 'published', clock_timestamp(), ${sqlUuid(fixture.contactId)})`;
}

function insertFixtures(containerName, userId) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-workspace`)}, 'QA 12.21 Browser Workspace', 'active', 'America/Denver', current_date - 30, current_date + 120, false);
insert into public.project_contacts (id, auth_user_id, status)
values (${sqlUuid(fixture.contactId)}, ${sqlUuid(userId)}, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values (${sqlUuid(fixture.grantId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.contactId)}, 'main_contact', array['workspace.read','assignments.edit']::text[], 'active', clock_timestamp() - interval '1 day', null, null);
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at,
  lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method,
  availability_snapshot, skills_help_snapshot, profile_notes
)
values (${sqlUuid(fixture.volunteerId)}, ${sqlUuid(fixture.workspaceId)}, null, 'manual', ${sqlUuid(fixture.contactId)}, clock_timestamp(), 'active', 'ready', ${sqlText(`${fixture.namespace} Volunteer`)}, ${sqlText(`${fixture.namespace}@example.invalid`)}, null, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, '');
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
)
values
  ${itemValues(fixture.items.confirm, `${fixture.namespace} Confirm Me`, "current_date + 10")},
  ${itemValues(fixture.items.decline, `${fixture.namespace} Decline Me`, "current_date + 11")},
  ${itemValues(fixture.items.allA, `${fixture.namespace} All A`, "current_date + 12")},
  ${itemValues(fixture.items.allB, `${fixture.namespace} All B`, "current_date + 13")},
  ${itemValues(fixture.items.inside48, `${fixture.namespace} Inside 48`, "current_date + 1")};
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
)
values
  (${sqlUuid(fixture.assignments.confirm)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.confirm)}, ${sqlUuid(fixture.volunteerId)}, 'active', null, null),
  (${sqlUuid(fixture.assignments.decline)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.decline)}, ${sqlUuid(fixture.volunteerId)}, 'active', null, null),
  (${sqlUuid(fixture.assignments.allA)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.allA)}, ${sqlUuid(fixture.volunteerId)}, 'active', null, null),
  (${sqlUuid(fixture.assignments.allB)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.allB)}, ${sqlUuid(fixture.volunteerId)}, 'active', null, null),
  (${sqlUuid(fixture.assignments.inside48)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.inside48)}, ${sqlUuid(fixture.volunteerId)}, 'active', null, null);
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
)
values
  (${sqlUuid(fixture.responses.confirm)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignments.confirm)}, 'needs_response', 'project_contact', null, null, null),
  (${sqlUuid(fixture.responses.decline)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignments.decline)}, 'needs_response', 'project_contact', null, null, null),
  (${sqlUuid(fixture.responses.allA)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignments.allA)}, 'needs_response', 'project_contact', null, null, null),
  (${sqlUuid(fixture.responses.allB)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignments.allB)}, 'needs_response', 'project_contact', null, null, null),
  (${sqlUuid(fixture.responses.inside48)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignments.inside48)}, 'needs_response', 'project_contact', null, null, null);`,
  );
}

async function issueToken(client) {
  const { data, error } = await client.rpc("issue_volunteer_schedule_access", {
    p_volunteer_profile_id: fixture.volunteerId,
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

async function runBrowserProof(token) {
  assert(isLoopbackUrl(baseUrl), "Volunteer schedule response browser QA accepts only loopback preview.");
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
    assert(!page.url().includes(token), "final schedule URL leaked bearer");
    await page.getByRole("heading", { name: "Your volunteer schedule" }).waitFor();
    await page.getByText(`${fixture.namespace} Confirm Me`).waitFor();
    await page.getByRole("button", { name: /Confirm Me/ }).click();
    await page.getByRole("button", { name: /^Confirm$/ }).click();
    await page.getByText("Your response is now Confirmed.").waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Confirm Me/ }).click();
    await page.getByText("Confirmed").first().waitFor();
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: /Decline Me/ }).click();
    await page.getByPlaceholder("Add a brief note if you can’t make it").fill("Browser note");
    await page.getByRole("button", { name: "Can’t make it" }).last().click();
    await page.getByText("Your response is now Can’t make it.").waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Decline Me/ }).click();
    await page.getByText("Browser note", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: "Confirm all pending" }).click();
    await page.getByText(/Confirmed 3 assignments\./).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /All A/ }).click();
    await page.getByText("Confirmed").first().waitFor();
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: /Inside 48/ }).click();
    await page.getByText(/starts within 48 hours/).waitFor();
    assert.equal(await page.getByPlaceholder("Add a brief note if you can’t make it").count(), 0);

    const noTokenLeak = await page.evaluate(
      (secret) =>
        !document.documentElement.innerHTML.includes(secret) &&
        !localStorage.getItem("pl-volunteer-schedule") &&
        !sessionStorage.getItem("pl-volunteer-schedule") &&
        !document.cookie.includes(secret),
      token,
    );
    assert(noTokenLeak, "bearer leaked into HTML, storage, or readable cookies");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(createPreviewUrl(baseUrl, "/v/schedule"), {
      waitUntil: "domcontentloaded",
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, "390px volunteer schedule response layout has horizontal overflow");
    assert.equal(failures.length, 0, `Browser errors occurred: ${failures.join(" | ")}`);
  } finally {
    await browser.close();
  }
}

function cleanup(containerName) {
  runPsql(
    containerName,
    `delete from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.volunteer_schedule_access_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.assignment_responses where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.calendar_assignments where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.calendar_items where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.volunteer_profiles where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.workspace_contact_grants where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.project_contacts where id = ${sqlUuid(fixture.contactId)};
delete from public.workspaces where id = ${sqlUuid(fixture.workspaceId)};
delete from auth.users where id in (${authUserIds.map(sqlUuid).join(",") || "null::uuid"});`,
  );
}

function verifyNoResidue(containerName) {
  const residue = queryJson(
    containerName,
    `select (
      (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
      (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
      (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${fixture.namespace}%`)}) +
      (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}%`)})
    )::int as residue`,
  )[0]?.residue;
  assert.equal(residue, 0, "Disposable browser response residue remains.");
}

async function main() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Volunteer schedule response browser QA accepts only local Supabase.");
  secrets.add(anonKey);
  const containerName = await resolveLocalDatabaseContainer();
  let token;
  try {
    await applyRequiredMigrations(containerName);
    const user = await createAuthenticatedUser();
    insertFixtures(containerName, user.userId);
    token = await issueToken(user.client);
    await runBrowserProof(token);
  } finally {
    try {
      cleanup(containerName);
      verifyNoResidue(containerName);
    } catch (error) {
      throw new Error(`Volunteer schedule response browser cleanup failed: ${redact(error)}`);
    }
  }
  console.log("Validated browser Confirm/Deny, denial notes, Confirm All, reload persistence, 390px layout, safe cookie handling, and zero disposable residue.");
}

main().catch((error) => {
  console.error(redact(error));
  process.exit(1);
});
