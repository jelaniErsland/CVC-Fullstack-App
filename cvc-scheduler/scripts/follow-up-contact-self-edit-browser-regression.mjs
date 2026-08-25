import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";
import {
  bozemanBetaCapabilitySets,
  buildWorkspaceAccessProvisioningSql,
} from "../lib/workspaces/provisioning.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const writeReviewScreenshots = process.env.WRITE_FOLLOW_UP_CONTACT_REVIEW_SCREENSHOTS === "1";
const reviewDir = path.join(
  root,
  "docs",
  "previews",
  "iteration-12-43-b-1-follow-up-contact-self-edit",
);
const secrets = new Set();
const fixture = {
  namespace: `qa-12-43-b-1-browser-${randomUUID()}`,
  workspaceId: randomUUID(),
  contactId: randomUUID(),
  itemId: randomUUID(),
  volunteerId: randomUUID(),
  assignmentId: randomUUID(),
  responseId: randomUUID(),
  userId: null,
  cookieJar: new Map(),
};
let cleanupCompleted = false;

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function redact(value) {
  let message = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret) {
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
    maxBuffer: 20 * 1024 * 1024,
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
  if (result.status !== 0) throw new Error(redact(result.stderr || "Browser fixture SQL failed."));
  return result.stdout.trim();
}

async function resolveLocalDatabaseContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
  assert(result.status === 0 && result.stdout.trim() === "true", "Local Supabase is unavailable.");
  return containerName;
}

async function createAuthenticatedContact() {
  const email = `${fixture.namespace}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const client = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
    cookies: {
      getAll() {
        return Array.from(fixture.cookieJar.values()).map(({ name, value }) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          if (cookie.value) fixture.cookieJar.set(cookie.name, cookie);
          else fixture.cookieJar.delete(cookie.name);
        }
      },
    },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, "Browser Auth fixture could not be created.");
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, "Browser Auth fixture could not sign in.");
    session = signin.data.session;
  }
  fixture.userId = signup.data.user.id;
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  for (const cookie of fixture.cookieJar.values()) secrets.add(cookie.value);
}

async function applyCookies(context) {
  const target = new URL(baseUrl);
  await context.addCookies(
    Array.from(fixture.cookieJar.values()).map((cookie) => ({
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

async function setupFixtures(containerName) {
  const rpcExists = runPsql(
    containerName,
    "select to_regprocedure('public.update_current_project_contact_volunteer_facing_details(uuid,text,text,text)') is not null;",
  );
  if (rpcExists !== "t") {
    const migration = await readFile(
      path.join(root, "supabase", "migrations", "20260824123500_follow_up_contact_self_edit.sql"),
      "utf8",
    );
    runPsql(containerName, migration);
  }
  const provisioning = buildWorkspaceAccessProvisioningSql({
    workspace: {
      key: `${fixture.namespace}-workspace`,
      displayName: "Bozeman Follow-up Review",
      lifecycle: "active",
      timezone: "America/Denver",
      startsOn: "2026-08-01",
      endsOn: "2099-12-31",
      publicIntakeEnabled: false,
    },
    contact: { authUserId: fixture.userId, status: "active" },
    grant: {
      role: "main_contact",
      capabilities: bozemanBetaCapabilitySets.mainScheduler,
      status: "active",
      validFrom: "2026-08-01T00:00:00Z",
      validUntil: null,
    },
  });
  const provisioned = JSON.parse(runPsql(containerName, provisioning));
  fixture.workspaceId = provisioned.workspaceId;
  fixture.contactId = provisioned.projectContactId;
  runPsql(
    containerName,
    `insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values (
  ${sqlUuid(fixture.volunteerId)}, ${sqlUuid(fixture.workspaceId)}, null, 'manual', ${sqlUuid(fixture.contactId)},
  clock_timestamp(), 'active', 'ready', 'Alex Rivera', 'alex.rivera@example.invalid', null, null,
  null, '{}'::jsonb, '{}'::jsonb, ''
);
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
) values (
  ${sqlUuid(fixture.itemId)}, ${sqlUuid(fixture.workspaceId)}, null, 'Beta scheduling proof', 'general',
  'timed', '2099-09-07', null, '09:00', '10:00', 'America/Denver', 1, null, '{}'::jsonb,
  'active', ${sqlUuid(fixture.contactId)}, ${sqlUuid(fixture.contactId)}, 'published', clock_timestamp(), ${sqlUuid(fixture.contactId)}
);
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values (
  ${sqlUuid(fixture.assignmentId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.itemId)},
  ${sqlUuid(fixture.volunteerId)}, 'active', null, ${sqlUuid(fixture.userId)}
);
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
) values (
  ${sqlUuid(fixture.responseId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignmentId)},
  'needs_response', 'project_contact', null, null, ${sqlUuid(fixture.userId)}
);`,
  );
}

async function openItem(page) {
  await page.goto(createPreviewUrl(baseUrl, "/admin/calendar?view=week&date=2099-09-07"), {
    waitUntil: "networkidle",
    timeout: 35_000,
  });
  await page.getByRole("button", { name: /Published, Beta scheduling proof/ }).click();
  const dialog = page.getByRole("dialog", { name: "Calendar item inspector", exact: true });
  await dialog.getByText("Initial email", { exact: true }).waitFor();
  return dialog;
}

function watchErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function verifyViewport(browser, containerName, viewport, prefix) {
  runPsql(
    containerName,
    `update public.project_contacts set volunteer_facing_display_name = null, volunteer_facing_email = null, volunteer_facing_phone = null where id = ${sqlUuid(fixture.contactId)};`,
  );
  const context = await browser.newContext({ viewport });
  await applyCookies(context);
  const page = await context.newPage();
  const errors = watchErrors(page);
  let dialog = await openItem(page);
  await dialog.getByText("Ready to send: 0", { exact: true }).waitFor();
  await dialog.getByText("Needs Follow-up Contact: 1", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Add contact details", exact: true }).click();
  const name = dialog.getByLabel("Name", { exact: true });
  await name.waitFor();
  assert.equal(await name.evaluate((element) => element === document.activeElement), true, `${prefix} form did not focus Name.`);
  const email = dialog.getByLabel("Email", { exact: true });
  await name.fill("Project Local Follow-up");
  await email.fill("invalid");
  await dialog.getByRole("button", { name: "Save contact details", exact: true }).click();
  assert.equal(await email.evaluate((element) => element.matches(":invalid")), true, `${prefix} email validation did not engage.`);
  await email.fill("follow-up@example.invalid");
  await dialog.getByLabel(/Phone/).fill("");
  if (writeReviewScreenshots) {
    await mkdir(reviewDir, { recursive: true });
    await dialog.getByText("Notify volunteers", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(reviewDir, `${prefix}-contact-details-form.png`),
    });
  }
  await Promise.all([
    page.waitForURL(/notice=follow_up_contact_updated/),
    dialog.getByRole("button", { name: "Save contact details", exact: true }).click(),
  ]);
  await page.getByText("Follow-up Contact updated", { exact: true }).waitFor();
  dialog = await openItem(page);
  await dialog.getByText("Ready to send: 1", { exact: true }).waitFor();
  await dialog.getByText("Already sent: 0", { exact: true }).waitFor();
  await dialog.getByText("Missing email: 0", { exact: true }).waitFor();
  await dialog.getByText("Needs Follow-up Contact: 0", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Edit contact details", exact: true }).waitFor();
  await dialog.getByText(/Email transport is not configured/).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1),
    false,
    `${prefix} Calendar overflowed horizontally.`,
  );
  if (writeReviewScreenshots) {
    await dialog.getByText("Notify volunteers", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(reviewDir, `${prefix}-ready-state.png`),
    });
  }
  assert.deepEqual(errors, [], `${prefix} browser errors: ${errors.join(" | ")}`);
  await context.close();
}

async function verifyNoSideEffects(containerName) {
  const counts = runPsql(
    containerName,
    `select concat_ws(':',
  (select count(*) from public.assignment_notification_deliveries where workspace_id = ${sqlUuid(fixture.workspaceId)}),
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)}),
  (select count(*) from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)}),
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id = ${sqlUuid(fixture.workspaceId)})
);`,
  );
  assert.equal(counts, "0:0:0:0", "Contact browser flow created delivery or token side effects.");
}

async function cleanup(containerName) {
  const workspaceId = sqlUuid(fixture.workspaceId);
  const userId = sqlUuid(fixture.userId ?? "00000000-0000-4000-8000-000000000000");
  const residue = runPsql(
    containerName,
    `begin;
delete from public.assignment_notification_deliveries where workspace_id = ${workspaceId};
delete from public.volunteer_schedule_access_tokens where workspace_id = ${workspaceId};
delete from public.assignment_response_tokens where workspace_id = ${workspaceId};
delete from public.assignment_response_link_reveal_events where workspace_id = ${workspaceId};
delete from public.assignment_responses where workspace_id = ${workspaceId};
delete from public.calendar_assignments where workspace_id = ${workspaceId};
delete from public.calendar_items where workspace_id = ${workspaceId};
delete from public.volunteer_profiles where workspace_id = ${workspaceId};
delete from public.workspace_contact_grants where workspace_id = ${workspaceId};
delete from public.project_contacts where auth_user_id = ${userId};
delete from public.workspaces where id = ${workspaceId};
delete from auth.identities where user_id = ${userId};
delete from auth.users where id = ${userId};
commit;
select (
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from auth.users where id = ${userId})
)::text;`,
  );
  assert.equal(residue, "0", `Browser fixture cleanup residue was ${residue}.`);
  cleanupCompleted = true;
}

async function main() {
  assert(supabaseUrl && anonKey, "Local Supabase public environment values are required.");
  assert(isLoopbackUrl(supabaseUrl), "Browser regression accepts only local Supabase.");
  assert(isLoopbackUrl(baseUrl), "Browser regression accepts only a loopback preview.");
  secrets.add(anonKey);
  const preview = await fetch(createPreviewUrl(baseUrl, "/admin/calendar"), { redirect: "manual" });
  assert(preview.status < 500, "Local production preview is unavailable.");
  const containerName = await resolveLocalDatabaseContainer();
  let browser;
  try {
    await createAuthenticatedContact();
    await setupFixtures(containerName);
    browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    await verifyViewport(browser, containerName, { width: 1440, height: 1000 }, "desktop");
    await verifyViewport(browser, containerName, { width: 390, height: 844 }, "mobile");
    await verifyNoSideEffects(containerName);
  } finally {
    if (browser) await browser.close();
    await cleanup(containerName);
  }
  assert(cleanupCompleted, "Browser fixture cleanup did not complete.");
  console.log("Follow-up Contact self-edit browser validation passed.");
  console.log("Validated desktop/mobile missing state, form focus and validation, persisted ready-state refresh, no overflow, zero browser errors, and zero delivery/token side effects.");
}

try {
  await main();
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
}
