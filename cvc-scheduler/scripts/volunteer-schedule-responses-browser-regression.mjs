import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
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

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const betaReviewDir = path.join(root, "docs", "previews", "beta-review");
const writeBetaReviewScreenshots = process.env.WRITE_BETA_REVIEW_SCREENSHOTS === "1";
const write1246CScreenshots = process.env.WRITE_12_46C_CAPTURES === "1";
const writeInstructionScreenshots = process.env.WRITE_ASSIGNMENT_INSTRUCTIONS_SCREENSHOTS === "1";
const review1246CDir = path.resolve(root, "..", "previews", "12.46c-volunteer-polish");
const writeIterationReviewScreenshots =
  process.env.WRITE_ITERATION_12_44B5_CAPTURES === "1";
const iterationReviewDir = path.resolve(
  root,
  "..",
  "previews",
  "beta-review",
  "iteration-12-44b5-volunteer-ux",
);
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
const reviewValues = writeBetaReviewScreenshots || writeIterationReviewScreenshots || writeInstructionScreenshots
  ? {
      workspaceName: writeInstructionScreenshots ? "LDC Sample Project" : "Bozeman Local Project",
      volunteerName: "Alex Rivera",
      volunteerEmail: "alex.rivera@example.invalid",
      congregation: "Bozeman Congregation",
      titles: {
        confirm: "Gate Attendant",
        decline: "Drywall Crew",
        allA: "Site Cleanup",
        allB: "Material Staging",
        inside48: "Lunch Support",
      },
    }
  : {
      workspaceName: "QA 12.21 Browser Workspace",
      volunteerName: `${fixture.namespace} Volunteer`,
      volunteerEmail: `${fixture.namespace}@example.invalid`,
      congregation: "Bozeman QA",
      titles: {
        confirm: `${fixture.namespace} Confirm Me`,
        decline: `${fixture.namespace} Decline Me`,
        allA: `${fixture.namespace} All A`,
        allB: `${fixture.namespace} All B`,
        inside48: `${fixture.namespace} Inside 48`,
      },
    };
function instructionAtLength(length) {
  const end = "\nEnd of assignment instructions.";
  const paragraphs = Array.from({ length: 80 }, (_, index) =>
    `Arrival detail ${index + 1}: use the marked volunteer entrance and check in with the project team.`).join("\n\n");
  return paragraphs.slice(0, length - end.length) + end;
}
const longScheduleNote = instructionAtLength(4000);
const presetLengthNote = instructionAtLength(2000);
assert.equal(longScheduleNote.length, 4000);
assert.equal(presetLengthNote.length, 2000);
const instructionsOnly = process.env.ASSIGNMENT_INSTRUCTIONS_ONLY === "1";
const instructionPreviewDirectory = path.join(root, "docs", "previews", "assignment-instructions");

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

function itemValues(id, title, dateSql, notes = longScheduleNote) {
  return `(${sqlUuid(id)}, ${sqlUuid(fixture.workspaceId)}, null, ${sqlText(title)}, 'general', 'timed', (${dateSql})::date, null, '09:00'::time, '11:00'::time, 'America/Denver', 1, ${sqlText(notes)}, '{}'::jsonb, 'active', ${sqlUuid(fixture.contactId)}, ${sqlUuid(fixture.contactId)}, 'published', clock_timestamp(), ${sqlUuid(fixture.contactId)})`;
}

function insertFixtures(containerName, userId) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-workspace`)}, ${sqlText(reviewValues.workspaceName)}, 'active', 'America/Denver', current_date - 30, current_date + 120, false);
insert into public.project_contacts (id, auth_user_id, status)
values (${sqlUuid(fixture.contactId)}, ${sqlUuid(userId)}, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values (${sqlUuid(fixture.grantId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.contactId)}, 'main_contact', array['workspace.read','assignments.edit']::text[], 'active', clock_timestamp() - interval '1 day', null, null);
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id, manual_created_at,
  lifecycle, readiness_status, full_name, email, phone, congregation, preferred_contact_method,
  availability_snapshot, skills_help_snapshot, profile_notes
)
values (${sqlUuid(fixture.volunteerId)}, ${sqlUuid(fixture.workspaceId)}, null, 'manual', ${sqlUuid(fixture.contactId)}, clock_timestamp(), 'active', 'ready', ${sqlText(reviewValues.volunteerName)}, ${sqlText(reviewValues.volunteerEmail)}, null, ${sqlText(reviewValues.congregation)}, null, '{}'::jsonb, '{}'::jsonb, '');
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
)
values
  ${itemValues(fixture.items.confirm, reviewValues.titles.confirm, "current_date + 10")},
  ${itemValues(fixture.items.decline, reviewValues.titles.decline, "current_date + 11", presetLengthNote)},
  ${itemValues(fixture.items.allA, reviewValues.titles.allA, "current_date + 12")},
  ${itemValues(fixture.items.allB, reviewValues.titles.allB, "current_date + 13")},
  ${itemValues(fixture.items.inside48, reviewValues.titles.inside48, "current_date + 1")};
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

// The home schedule is now inline: Next plus all additional upcoming cards.
function fullSchedule(page) {
  return page.getByRole("region", { name: "Next assignment", exact: true });
}

async function openFullSchedule(page) {
  const schedule = fullSchedule(page);
  await schedule.waitFor();
  const toggle = schedule.getByRole("button", { name: "View full schedule", exact: true });
  if (await toggle.count()) await toggle.click();
  await page.waitForLoadState("networkidle");
  return schedule;
}

async function verifyMaximumInstructions(page) {
  for (const viewport of [
    { width: 1280, height: 900, label: "desktop" },
    { width: 390, height: 844, label: "mobile" },
    { width: 320, height: 640, label: "narrow" },
  ]) {
    await page.setViewportSize(viewport);
    for (const [title, length] of [[reviewValues.titles.confirm, 4000], [reviewValues.titles.decline, 2000]]) {
      const trigger = fullSchedule(page).getByRole("button", { name: title, exact: false });
      await trigger.click();
      const dialog = page.getByRole("dialog");
      const disclosure = dialog.locator("details").filter({ hasText: "Assignment details" });
      const summary = disclosure.locator("summary");
      assert.equal(await disclosure.evaluate((element) => element.open), false);
      if (writeInstructionScreenshots && length === 4000) {
        await mkdir(instructionPreviewDirectory, { recursive: true });
        await page.screenshot({ path: path.join(instructionPreviewDirectory, `volunteer-details-closed-${viewport.label}.png`), animations: "disabled" });
      }
      await summary.focus();
      await page.keyboard.press("Enter");
      assert.equal(await disclosure.evaluate((element) => element.open), true);
      assert.equal(await disclosure.locator("p").evaluate((element) => element.textContent.length), length);
      await disclosure.getByText("End of assignment instructions.", { exact: false }).waitFor();
      const scroll = dialog.getByTestId("volunteer-assignment-detail-scroll");
      assert(await scroll.evaluate((element) => element.scrollHeight > element.clientHeight), `${length}-character instructions must exercise ${viewport.label} scrolling.`);
      if (writeInstructionScreenshots && length === 4000) {
        await mkdir(instructionPreviewDirectory, { recursive: true });
        await page.screenshot({ path: path.join(instructionPreviewDirectory, `volunteer-max-details-${viewport.label}.png`), animations: "disabled" });
      }
      for (const name of ["Confirm", "Can’t make it"]) {
        const response = dialog.getByRole("button", { name, exact: true });
        await response.focus();
        assert(await response.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return document.activeElement === element && rect.top >= 0 && rect.bottom <= window.innerHeight;
        }), `${name} must remain keyboard-reachable with ${length}-character ${viewport.label} instructions.`);
      }
      const close = dialog.getByRole("button", { name: "Close assignment details", exact: true });
      assert(await close.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      }), "Instruction scrolling must not obscure the close button.");
      if (writeInstructionScreenshots && length === 4000) {
        await page.screenshot({ path: path.join(instructionPreviewDirectory, `volunteer-max-response-${viewport.label}.png`), animations: "disabled" });
      }
      await close.focus();
      await page.keyboard.press("Shift+Tab");
      assert(await dialog.getByTestId("volunteer-assignment-detail-panel").evaluate((element) => element.contains(document.activeElement)), "Keyboard focus escaped the dialog.");
      await page.keyboard.press("Tab");
      assert(await close.evaluate((element) => element === document.activeElement), "Keyboard focus did not wrap to Close.");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "detached" });
      assert(await trigger.evaluate((element) => element === document.activeElement), "Closing must restore assignment-row focus.");
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
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
    await openFullSchedule(page);
    if (instructionsOnly) {
      await page.getByText(reviewValues.titles.confirm).first().waitFor();
      await page.waitForLoadState("networkidle");
      await mkdir(instructionPreviewDirectory, { recursive: true });
      for (const viewport of [
        { width: 1280, height: 900, label: "desktop" },
        { width: 390, height: 844, label: "mobile" },
      ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await fullSchedule(page).getByRole("button", { name: reviewValues.titles.inside48, exact: false }).first().click();
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        const disclosure = dialog.locator("details").filter({ hasText: "Assignment details" });
        assert.equal(await disclosure.count(), 1);
        assert.equal(await disclosure.evaluate((node) => node.hasAttribute("open")), false);
        await disclosure.locator("summary").click();
        assert.equal(await disclosure.evaluate((node) => node.hasAttribute("open")), true);
        await disclosure.getByText("Arrival detail 22:", { exact: false }).waitFor();
        assert.equal(await dialog.getByRole("button", { name: "Confirm", exact: true }).count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        await page.screenshot({ path: path.join(instructionPreviewDirectory, `volunteer-disclosure-${viewport.label}.png`), animations: "disabled" });
        await dialog.getByRole("button", { name: "Close assignment details", exact: true }).click();
        await dialog.waitFor({ state: "detached" });
      }
      assert.deepEqual(failures, []);
      await context.close();
      return;
    }
    await fullSchedule(page).getByText(reviewValues.titles.confirm, { exact: true }).waitFor();
    await fullSchedule(page).getByText("5 assignments need your response.", { exact: true }).waitFor();
    assert.equal(
      await fullSchedule(page).getByRole("button").filter({ has: page.getByText("Needs reply", { exact: true }) }).count(),
      5,
      "Each pending assignment must expose its existing response status on a selectable card.",
    );
    await verifyMaximumInstructions(page);
    if (writeIterationReviewScreenshots) {
      await mkdir(iterationReviewDir, { recursive: true });
      await page.screenshot({
        path: path.join(iterationReviewDir, "schedule-home-desktop.png"),
        fullPage: true,
      });
      await fullSchedule(page).getByRole("button", { name: reviewValues.titles.confirm, exact: false }).click();
      const desktopDialog = page.getByRole("dialog");
      await desktopDialog.getByRole("heading", { name: reviewValues.titles.confirm }).waitFor();
      assert.equal(
        await desktopDialog.getByText("Coverage", { exact: true }).count(),
        0,
        "Volunteer assignment detail still exposes the Coverage heading.",
      );
      assert.equal(
        await desktopDialog.getByText(/assigned$/).count(),
        0,
        "Volunteer assignment detail still exposes aggregate assigned counts.",
      );
      await page.screenshot({
        path: path.join(iterationReviewDir, "assignment-detail-desktop.png"),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Close assignment details", exact: true }).click();

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(createPreviewUrl(baseUrl, "/v/schedule"), {
        waitUntil: "domcontentloaded",
      });
    await openFullSchedule(page);
      await page.screenshot({
        path: path.join(iterationReviewDir, "schedule-home-mobile.png"),
        fullPage: true,
      });
      await fullSchedule(page).getByRole("button", { name: reviewValues.titles.confirm, exact: false }).click();
      await page.getByRole("dialog").locator("summary").filter({ hasText: "Assignment details" }).click();
      await page.screenshot({
        path: path.join(iterationReviewDir, "assignment-detail-mobile.png"),
      });
      const reviewDetailScroll = page.getByTestId("volunteer-assignment-detail-scroll");
      assert(
        await reviewDetailScroll.evaluate(
          (element) => element.scrollHeight > element.clientHeight,
        ),
        "390px long assignment detail fixture must exercise internal scrolling.",
      );
      await reviewDetailScroll.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      const closeButton = page.getByRole("button", { name: "Close assignment details", exact: true });
      await closeButton.focus();
      await page.waitForTimeout(100);
      await page.screenshot({
        path: path.join(iterationReviewDir, "assignment-detail-mobile-scrolled.png"),
      });
      await page.keyboard.press("Shift+Tab");
      assert(
        await page.getByTestId("volunteer-assignment-detail-panel").evaluate(
          (panel) => panel.contains(document.activeElement),
        ),
        "Shift+Tab escaped the assignment detail focus boundary.",
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await closeButton.evaluate((element) => document.activeElement === element),
        true,
        "Tab did not wrap focus back to the assignment detail close control.",
      );
      await closeButton.click();
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.notEqual(
        await page.evaluate(() => getComputedStyle(document.body).overflow),
        "hidden",
        "Closing assignment detail did not restore page scrolling.",
      );

      await fullSchedule(page).getByRole("button", { name: reviewValues.titles.inside48, exact: false }).click();
      const lockedDialog = page.getByRole("dialog");
      await lockedDialog.getByText("A response is still needed.", { exact: false }).waitFor();
      assert.equal(
        await lockedDialog.getByRole("button", { name: "Can’t make it" }).count(),
        0,
        "Close-to-start assignment exposes a normal decline action.",
      );
      assert.equal(
        await lockedDialog.getByRole("button", { name: "Confirm" }).count(),
        1,
        "Close-to-start pending assignment does not preserve its allowed Confirm action.",
      );
      await lockedDialog.getByTestId("volunteer-assignment-detail-scroll").evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await page.getByRole("button", { name: "Close assignment details", exact: true }).focus();
      await page.waitForTimeout(100);
      await page.screenshot({
        path: path.join(iterationReviewDir, "assignment-detail-mobile-locked.png"),
      });
      await page.getByRole("button", { name: "Close assignment details", exact: true }).click();

      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(createPreviewUrl(baseUrl, "/v/schedule"), {
        waitUntil: "domcontentloaded",
      });
    await openFullSchedule(page);
    }

    await fullSchedule(page).getByRole("button", { name: reviewValues.titles.confirm, exact: false }).click();
    await page.getByRole("button", { name: /^Confirm$/ }).click();
    await page.getByText("Your response is now Confirmed.").waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await openFullSchedule(page);
    await page.waitForLoadState("networkidle");
    await fullSchedule(page).getByRole("button", { name: reviewValues.titles.confirm, exact: false }).click();
    await page.getByRole("dialog").getByText("Confirmed", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Close assignment details", exact: true }).click();

    await fullSchedule(page).getByRole("button", { name: reviewValues.titles.decline, exact: false }).click();
    await page.getByPlaceholder("Add a brief note if you can’t make it").fill("Browser note");
    await page.getByRole("button", { name: "Can’t make it" }).last().click();
    await page.getByText("Your response is now Can’t make it.").waitFor();
    if (write1246CScreenshots) {
      await mkdir(review1246CDir, { recursive: true });
      await page.screenshot({ path: path.join(review1246CDir, "03-declined-schedule-desktop.png"), fullPage: true });
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await openFullSchedule(page);
    await page.waitForLoadState("networkidle");
    await fullSchedule(page).getByRole("button", { name: reviewValues.titles.decline, exact: false }).click();
    await page.getByRole("dialog").getByText("Browser note", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Close assignment details", exact: true }).click();

    await fullSchedule(page).getByRole("button", { name: "Confirm all pending" }).click();
    await page.getByText(/Confirmed 3 assignments\./).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await openFullSchedule(page);
    await page.waitForLoadState("networkidle");
    await fullSchedule(page).getByRole("button", { name: reviewValues.titles.allA, exact: false }).click();
    await page.getByRole("dialog").getByText("Confirmed", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Close assignment details", exact: true }).click();

    await fullSchedule(page).getByRole("button", { name: reviewValues.titles.inside48, exact: false }).click();
    await page.getByText(/Changes are closed this close to the assignment/).waitFor();
    const finalLockedDialog = page.getByRole("dialog");
    assert.equal(await finalLockedDialog.getByPlaceholder("Add a brief note if you can’t make it").count(), 0);
    assert.equal(await finalLockedDialog.getByRole("button", { name: /^Confirm$/ }).count(), 0);
    assert.equal(await finalLockedDialog.getByRole("button", { name: "Can’t make it" }).count(), 0);

    const noTokenLeak = await page.evaluate(
      (secret) =>
        !document.documentElement.innerHTML.includes(secret) &&
        !localStorage.getItem("pl-volunteer-schedule") &&
        !sessionStorage.getItem("pl-volunteer-schedule") &&
        !document.cookie.includes(secret),
      token,
    );
    assert(noTokenLeak, "bearer leaked into HTML, storage, or readable cookies");
    if (writeBetaReviewScreenshots) {
      await page.getByRole("button", { name: "Close assignment details", exact: true }).click();
      await mkdir(betaReviewDir, { recursive: true });
      await page.screenshot({
        path: path.join(betaReviewDir, "volunteer-schedule-desktop.png"),
        fullPage: true,
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(createPreviewUrl(baseUrl, "/v/schedule"), {
      waitUntil: "domcontentloaded",
    });
    await openFullSchedule(page);
    await page.waitForLoadState("networkidle");
    if (write1246CScreenshots) {
      await page.screenshot({ path: path.join(review1246CDir, "11-declined-schedule-mobile-390.png"), fullPage: true });
    }
    await fullSchedule(page).getByRole("button", { name: reviewValues.titles.inside48, exact: false }).click();
    await page.getByRole("dialog").locator("summary").filter({ hasText: "Assignment details" }).click();
    const mobileDetailScroll = page.getByTestId("volunteer-assignment-detail-scroll");
    await mobileDetailScroll.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const mobileCloseReachable = await page
      .getByRole("button", { name: "Close assignment details", exact: true })
      .evaluate((element) => {
        const rectangle = element.getBoundingClientRect();
        return rectangle.top >= 0 && rectangle.bottom <= window.innerHeight;
      });
    assert.equal(
      mobileCloseReachable,
      true,
      "390px long assignment detail scrolls the close control out of reach",
    );
    const backgroundScrollLocked = await page.evaluate(
      () => getComputedStyle(document.body).overflow === "hidden",
    );
    assert.equal(
      backgroundScrollLocked,
      true,
      "390px assignment detail does not intentionally lock background scrolling",
    );
    assert(
      await mobileDetailScroll.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
      "390px long assignment detail did not exercise its internal scroll container",
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, "390px volunteer schedule response layout has horizontal overflow");
    assert.equal(failures.length, 0, `Browser errors occurred: ${failures.join(" | ")}`);
    if (writeBetaReviewScreenshots) {
      await page.screenshot({
        path: path.join(betaReviewDir, "volunteer-schedule-mobile.png"),
        fullPage: true,
      });
    }
    await page.getByRole("button", { name: "Close assignment details", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
      "hidden",
      "Closing volunteer assignment detail did not restore page scrolling",
    );
    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(createPreviewUrl(baseUrl, "/v/schedule"), { waitUntil: "domcontentloaded" });
    await anonymousPage.getByRole("heading", { name: "This schedule link is unavailable" }).waitFor();
    assert.equal(await anonymousPage.getByText(reviewValues.titles.confirm, { exact: false }).count(), 0);
    assert.equal(await anonymousPage.getByRole("button", { name: "Confirm", exact: true }).count(), 0);
    await anonymous.close();
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
    const records = () => queryJson(containerName, `select 'item' as kind, id,
      jsonb_build_object('date', start_date, 'notes', schedule_notes, 'updated_at', updated_at) as value
      from public.calendar_items where workspace_id = ${sqlUuid(fixture.workspaceId)}
      union all select 'assignment', id, jsonb_build_object('item', calendar_item_id, 'volunteer', volunteer_profile_id, 'lifecycle', lifecycle)
      from public.calendar_assignments where workspace_id = ${sqlUuid(fixture.workspaceId)} order by kind,id`);
    const beforeRecords = records();
    const before = instructionsOnly ? queryJson(containerName,
      `select id, response_status from public.assignment_responses where workspace_id = ${sqlUuid(fixture.workspaceId)} order by id`) : null;
    await runBrowserProof(token);
    assert.deepEqual(records(), beforeRecords, "Browser responses must not modify scheduled items or assignments.");
    assert.deepEqual(queryJson(containerName,
      `select id from public.assignment_notification_deliveries where workspace_id = ${sqlUuid(fixture.workspaceId)}`), [],
    "Browser reads and responses must not send assignment notifications.");
    if (instructionsOnly) {
      const after = queryJson(containerName,
        `select id, response_status from public.assignment_responses where workspace_id = ${sqlUuid(fixture.workspaceId)} order by id`);
      assert.deepEqual(after, before, "Opening assignment details must not change responses.");
      assert.deepEqual(queryJson(containerName,
        `select id from public.assignment_notification_deliveries where workspace_id = ${sqlUuid(fixture.workspaceId)}`), [],
      "Opening assignment details must not send a notification.");
    } else {
      const responses = queryJson(containerName, `select assignment_id, response_status, response_source, response_note
        from public.assignment_responses where workspace_id = ${sqlUuid(fixture.workspaceId)} order by assignment_id`);
      assert.equal(responses.length, 5);
      for (const [label, assignmentId] of Object.entries(fixture.assignments)) {
        const response = responses.find((row) => row.assignment_id === assignmentId);
        assert.equal(response.response_status, label === "decline" ? "declined" : "confirmed");
        assert.equal(response.response_source, "volunteer_schedule");
        if (label === "decline") assert.equal(response.response_note, "Browser note");
      }
    }
  } finally {
    try {
      cleanup(containerName);
      verifyNoResidue(containerName);
    } catch (error) {
      throw new Error(`Volunteer schedule response browser cleanup failed: ${redact(error)}`);
    }
  }
  console.log(instructionsOnly
    ? "Validated real local volunteer Assignment details disclosure at desktop/mobile sizes, unchanged responses/deliveries, and zero residue."
    : "Validated browser Confirm/Deny, denial notes, Confirm All, reload persistence, 390px layout, safe cookie handling, and zero disposable residue.");
}

main().catch((error) => {
  console.error(redact(error));
  process.exit(1);
});
