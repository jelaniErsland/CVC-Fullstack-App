import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright";
import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();

const desktopViewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844 };
const projectWeekLabel = "Jan 12 to Jan 18, 2026";
const previousWeekLabel = "Jan 5 to Jan 11, 2026";
const nextWeekLabel = "Jan 19 to Jan 25, 2026";
// Accessible names are the deliberate interaction contract for the persisted 12.12 cutover fixtures.
const weekItemLabel =
  "Gate attendant, 1 of 1 volunteers, Tue Jan 13, 7:30 AM - 10:30 AM";
const listItemLabel =
  "Site support week, Project window · Mon Jan 12 through Sat Jan 17, 0 of 0 helpers, General Volunteers";
const monthItemLabel =
  "Room signage labels, 1 of 2 volunteers, Thu Jan 15, 10:00 AM - 12:00 PM";
const nextWeekItemLabel =
  "Follow-up supplies, 1 of 1 volunteers, Tue Jan 20, 9:00 AM - 10:00 AM";

const secrets = new Set();
const fixture = {
  namespace: `qa-12-12-calendar-${randomUUID()}`,
  workspaceId: randomUUID(),
  calendarOnlyWorkspaceId: randomUUID(),
  calendarOnlyContactId: randomUUID(),
  fullContactId: randomUUID(),
  calendarOnlyGrantId: randomUUID(),
  fullGrantId: randomUUID(),
  generalTaskPresetId: randomUUID(),
  foodTaskPresetId: randomUUID(),
  volunteerIds: Array.from({ length: 8 }, () => randomUUID()),
  questionnaireIds: Array.from({ length: 8 }, () => randomUUID()),
  calendarItemIds: {
    gate: randomUUID(),
    siteWindow: randomUUID(),
    signage: randomUUID(),
    lunch: randomUUID(),
    coffee: randomUUID(),
    doorCheck: randomUUID(),
    supplyRun: randomUUID(),
    nextWeekSupplies: randomUUID(),
  },
  assignmentIds: {
    gate: randomUUID(),
    signage: randomUUID(),
    lunch: randomUUID(),
    coffee: randomUUID(),
    doorCheck: randomUUID(),
    supplyRun: randomUUID(),
    nextWeekSupplies: randomUUID(),
  },
  otherWorkspaceId: randomUUID(),
  otherCalendarItemId: randomUUID(),
};
const authCookieSets = new Map();
const authUserIds = [];
let cleanupCompleted = false;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isLoopbackUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      ["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname)
    );
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
  return message;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
    throw new Error(
      `The local Calendar route fixture command failed: ${redact(result.stderr).slice(0, 800)}`,
    );
  }
  return result.stdout.trim();
}

async function resolveLocalDatabaseContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define a local project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
  assert(
    result.status === 0 && result.stdout.trim() === "true",
    "Local Supabase is not running. Start it with `npx supabase start` with output redirected/redacted.",
  );
  return containerName;
}

async function verifyLocalPreflight() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Calendar route QA accepts only local Supabase.");
  assert(isLoopbackUrl(baseUrl), "Calendar route QA accepts only a loopback production preview.");
  secrets.add(anonKey);

  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");
}

async function applyCalendarSourceSelectionMigrationIfNeeded(containerName) {
  const hasPresetUpdate = runPsql(
    containerName,
    "select count(*) from pg_proc where proname = 'update_calendar_item_preset_timed';",
  );
  if (hasPresetUpdate === "0") {
    const migration = await readFile(
      path.join(root, "supabase", "migrations", "20260714121700_calendar_source_selection.sql"),
      "utf8",
    );
    runPsql(containerName, migration);
  }
}

async function createAuthenticatedContact(label) {
  const email = `qa-12-12-${label}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const cookieJar = new Map();
  secrets.add(email);
  secrets.add(password);

  const client = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
    cookies: {
      getAll() {
        return Array.from(cookieJar.values()).map(({ name, value }) => ({
          name,
          value,
        }));
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          if (cookie.value) cookieJar.set(cookie.name, cookie);
          else cookieJar.delete(cookie.name);
        }
      },
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });

  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, "Disposable local Auth user creation failed.");
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, "Disposable local Auth sign-in failed.");
    session = signin.data.session;
  }
  const currentUser = await client.auth.getUser();
  assert(
    currentUser.data.user?.id === signup.data.user.id,
    `Disposable Auth cookie jar resolved the wrong user for ${label}.`,
  );
  authUserIds.push(signup.data.user.id);
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  for (const cookie of cookieJar.values()) secrets.add(cookie.value);
  assert(cookieJar.size > 0, "Disposable Auth did not produce the SSR session cookie.");
  authCookieSets.set(label, cookieJar);
  return signup.data.user.id;
}

async function applyAuthCookies(context, label) {
  const cookieJar = authCookieSets.get(label);
  assert(cookieJar?.size > 0, `Missing auth cookies for ${label}.`);
  const target = new URL(baseUrl);
  await context.addCookies(
    Array.from(cookieJar.values()).map((cookie) => ({
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

function questionnaireRows() {
  return fixture.questionnaireIds
    .map((id, index) => {
      const answers = JSON.stringify({
        aboutYou: {
          name: `QA 12.12 Volunteer ${index + 1}`,
          email: `qa-12-12-volunteer-${index + 1}@example.invalid`,
          phone: "+1 555 120 1100",
          congregation: "QA Congregation",
        },
        availability: { weekdays: ["Tuesday"] },
        skillsExperience: { categories: ["General"] },
        emergencyContact: {
          name: "QA Private Emergency",
          phone: "+1 555 120 1199",
        },
        otherWaysToHelp: { notes: "QA private intake marker" },
      });
      return `('${id}'::uuid, '${fixture.workspaceId}'::uuid, 'submitted', 'admin_entry', 1, ${sqlText(answers)}::jsonb)`;
    })
    .join(",\n");
}

function volunteerRows() {
  return fixture.volunteerIds
    .map(
      (id, index) =>
        `('${id}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.questionnaireIds[index]}'::uuid, 'active', 'ready', 'QA 12.12 Volunteer ${index + 1}', 'qa-12-12-volunteer-${index + 1}@example.invalid', null, 'QA Congregation', 'Email', '{}'::jsonb, '{}'::jsonb, 'QA safe profile note')`,
    )
    .join(",\n");
}

function assignmentRows(fullUserId) {
  const rows = [
    [fixture.assignmentIds.gate, fixture.calendarItemIds.gate, fixture.volunteerIds[0], "active"],
    [fixture.assignmentIds.signage, fixture.calendarItemIds.signage, fixture.volunteerIds[1], "active"],
    [fixture.assignmentIds.lunch, fixture.calendarItemIds.lunch, fixture.volunteerIds[2], "active"],
    [fixture.assignmentIds.coffee, fixture.calendarItemIds.coffee, fixture.volunteerIds[3], "active"],
    [fixture.assignmentIds.doorCheck, fixture.calendarItemIds.doorCheck, fixture.volunteerIds[4], "active"],
    [fixture.assignmentIds.supplyRun, fixture.calendarItemIds.supplyRun, fixture.volunteerIds[5], "active"],
    [
      fixture.assignmentIds.nextWeekSupplies,
      fixture.calendarItemIds.nextWeekSupplies,
      fixture.volunteerIds[6],
      "active",
    ],
  ];
  return rows
    .map(
      ([assignmentId, itemId, volunteerId, lifecycle]) =>
        `('${assignmentId}'::uuid, '${fixture.workspaceId}'::uuid, '${itemId}'::uuid, '${volunteerId}'::uuid, '${lifecycle}', null, '${fullUserId}'::uuid)`,
    )
    .join(",\n");
}

function responseRows(fullUserId) {
  const rows = [
    [fixture.assignmentIds.gate, "confirmed"],
    [fixture.assignmentIds.signage, "confirmed"],
    [fixture.assignmentIds.lunch, "needs_response"],
    [fixture.assignmentIds.coffee, "confirmed"],
    [fixture.assignmentIds.doorCheck, "confirmed"],
    [fixture.assignmentIds.supplyRun, "confirmed"],
    [fixture.assignmentIds.nextWeekSupplies, "confirmed"],
  ];
  return rows
    .map(([assignmentId, status]) => {
      const respondedAt = status === "needs_response" ? "null" : "now()";
      return `('${randomUUID()}'::uuid, '${fixture.workspaceId}'::uuid, '${assignmentId}'::uuid, '${status}', 'project_contact', ${respondedAt}, '${fullUserId}'::uuid)`;
    })
    .join(",\n");
}

async function createFixtures(containerName) {
  const fullUserId = await createAuthenticatedContact("full");
  const calendarOnlyUserId = await createAuthenticatedContact("calendar-only");

  runPsql(containerName, `begin;
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  ('${fixture.workspaceId}'::uuid, ${sqlText(`${fixture.namespace}-target`)}, 'QA 12.12 Calendar Workspace', 'active', 'America/Denver', '2026-01-01', '2026-04-04', false),
  ('${fixture.calendarOnlyWorkspaceId}'::uuid, ${sqlText(`${fixture.namespace}-calendar-only`)}, 'QA 12.12 Calendar Only Workspace', 'active', 'America/Denver', '2026-01-01', '2026-04-04', false),
  ('${fixture.otherWorkspaceId}'::uuid, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.12 Other Workspace', 'active', 'America/Denver', '2026-01-01', '2026-04-04', false);
insert into public.project_contacts (id, auth_user_id, status)
values
  ('${fixture.fullContactId}'::uuid, '${fullUserId}'::uuid, 'active'),
  ('${fixture.calendarOnlyContactId}'::uuid, '${calendarOnlyUserId}'::uuid, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status)
values
  ('${fixture.fullGrantId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.fullContactId}'::uuid, 'main_contact', array['workspace.read', 'calendar.view', 'assignments.view', 'assignments.edit', 'volunteers.view', 'calendar.edit', 'tasks.view']::text[], 'active'),
  ('${fixture.calendarOnlyGrantId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.calendarOnlyContactId}'::uuid, 'main_contact', array['workspace.read', 'calendar.view']::text[], 'active');
insert into public.questionnaire_submissions (id, workspace_id, status, source, questionnaire_version, answers)
values ${questionnaireRows()};
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, lifecycle, readiness_status, full_name,
  email, phone, congregation, preferred_contact_method, availability_snapshot,
  skills_help_snapshot, profile_notes
) values ${volunteerRows()};
insert into public.task_presets (
  id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible,
  is_system_preset, custom_field_definitions, lifecycle
) values
  ('${fixture.generalTaskPresetId}'::uuid, '${fixture.workspaceId}'::uuid, 'QA 12.12 General', null, 'general', 1, true, false, '[]'::jsonb, 'active'),
  ('${fixture.foodTaskPresetId}'::uuid, '${fixture.workspaceId}'::uuid, 'QA 12.12 Food', null, 'food', 1, true, false, '[]'::jsonb, 'active');
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
  schedule_kind, start_date, end_date, start_time, end_time, timezone,
  needed_count, schedule_notes, custom_values, lifecycle
) values
  ('${fixture.calendarItemIds.gate}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Gate attendant', 'general', 'timed', '2026-01-13', null, '07:30:00', '10:30:00', 'America/Denver', 1, 'Safe gate note', '{}'::jsonb, 'active'),
  ('${fixture.calendarItemIds.siteWindow}'::uuid, '${fixture.workspaceId}'::uuid, null, 'Site support week', 'general', 'multi_day_window', '2026-01-12', '2026-01-17', null, null, 'America/Denver', 0, 'Safe project window note', '{}'::jsonb, 'active'),
  ('${fixture.calendarItemIds.signage}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Room signage labels', 'general', 'timed', '2026-01-15', null, '10:00:00', '12:00:00', 'America/Denver', 2, 'Safe signage note', '{}'::jsonb, 'active'),
  ('${fixture.calendarItemIds.lunch}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.foodTaskPresetId}'::uuid, 'Lunch handoff', 'food', 'timed', '2026-01-14', null, '11:00:00', '12:00:00', 'America/Denver', 1, 'Safe lunch note', '{}'::jsonb, 'active'),
  ('${fixture.calendarItemIds.coffee}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Coffee station', 'general', 'timed', '2026-01-14', null, '08:00:00', '09:00:00', 'America/Denver', 1, null, '{}'::jsonb, 'active'),
  ('${fixture.calendarItemIds.doorCheck}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Door check', 'general', 'timed', '2026-01-14', null, '09:00:00', '10:00:00', 'America/Denver', 1, null, '{}'::jsonb, 'active'),
  ('${fixture.calendarItemIds.supplyRun}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Supply run', 'general', 'timed', '2026-01-14', null, '13:00:00', '14:00:00', 'America/Denver', 1, null, '{}'::jsonb, 'active'),
  ('${fixture.calendarItemIds.nextWeekSupplies}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Follow-up supplies', 'general', 'timed', '2026-01-20', null, '09:00:00', '10:00:00', 'America/Denver', 1, 'Safe follow-up note', '{}'::jsonb, 'active'),
  ('${fixture.otherCalendarItemId}'::uuid, '${fixture.otherWorkspaceId}'::uuid, null, 'QA 12.12 Wrong Workspace Hidden', 'general', 'timed', '2026-01-13', null, '07:30:00', '10:30:00', 'America/Denver', 1, null, '{}'::jsonb, 'active');
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values ${assignmentRows(fullUserId)};
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, responded_at, updated_by_auth_user_id
) values ${responseRows(fullUserId)};
commit;`);
}

async function cleanupFixtures(containerName) {
  const authUserDeletes = authUserIds
    .map((id) => `delete from auth.users where id = '${id}'::uuid;`)
    .join("\n");
  const residue = runPsql(containerName, `begin;
delete from public.assignment_responses where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.calendar_assignments where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.calendar_items where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.volunteer_profiles where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.questionnaire_submissions where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.workspace_contact_grants where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.calendarOnlyWorkspaceId}'::uuid);
delete from public.project_contacts where id in ('${fixture.fullContactId}'::uuid, '${fixture.calendarOnlyContactId}'::uuid);
delete from public.workspaces where id in ('${fixture.workspaceId}'::uuid, '${fixture.calendarOnlyWorkspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
${authUserDeletes}
commit;
select
  (select count(*) from public.workspaces where workspace_key like '${fixture.namespace}%') +
  (select count(*) from public.calendar_items where title_snapshot like 'QA 12.12%') +
  (select count(*) from auth.users where email like 'qa-12-12-%@example.invalid');`);
  assert(residue === "0", `Calendar route fixture cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

function calendarUrl() {
  return createPreviewUrl(baseUrl, "/admin/calendar");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function collectPageDiagnostics(page) {
  if (page.isClosed()) {
    return "Page diagnostics: page already closed";
  }

  try {
    const state = await page.evaluate(() => {
      const activeElement = document.activeElement;
      const activeDescription = activeElement
        ? [
            activeElement.tagName.toLowerCase(),
            activeElement.getAttribute("role"),
            activeElement.getAttribute("aria-label"),
            activeElement.textContent?.trim().replace(/\s+/g, " ").slice(0, 80),
          ]
            .filter(Boolean)
            .join(" | ")
        : "none";
      const pressedView = Array.from(
        document.querySelectorAll('[aria-label="Calendar view"] button'),
      ).find((button) => button.getAttribute("aria-pressed") === "true");
      const activeDialogs = Array.from(
        document.querySelectorAll('[role="dialog"]'),
      )
        .filter((dialog) => !dialog.closest("[inert]"))
        .map(
          (dialog) =>
            dialog.getAttribute("aria-label") ||
            dialog.getAttribute("aria-labelledby") ||
            "unnamed dialog",
        );

      return {
        activeDescription,
        activeDialogs,
        listButtonLabels: Array.from(
          document.querySelectorAll('[data-testid="calendar-list-view"] button'),
        )
          .slice(0, 8)
          .map((button) => button.getAttribute("aria-label") || button.textContent?.trim() || "")
          .filter(Boolean),
        pressedView: pressedView?.textContent?.trim() || "none",
        taskSourceControls: Array.from(
          document.querySelectorAll('[aria-label="Task source"] button'),
        )
          .slice(0, 8)
          .map(
            (button) =>
              `${button.textContent?.trim() || "unnamed"} pressed=${button.getAttribute("aria-pressed")} disabled=${button.hasAttribute("disabled")}`,
          ),
        taskPresetSelectCount: document.querySelectorAll("select").length,
      };
    });
    const viewport = page.viewportSize();

    return [
      `URL: ${page.url()}`,
      `Viewport: ${viewport ? `${viewport.width}x${viewport.height}` : "unknown"}`,
      `Pressed view: ${state.pressedView}`,
      `Active element: ${state.activeDescription}`,
      `Active dialogs: ${state.activeDialogs.join(", ") || "none"}`,
      `List buttons: ${state.listButtonLabels.join(" | ") || "none"}`,
      `Task source controls: ${state.taskSourceControls.join(" | ") || "none"}`,
      `Select count: ${state.taskPresetSelectCount}`,
    ].join("\n");
  } catch (error) {
    return `Page diagnostics unavailable: ${errorMessage(error)}`;
  }
}

function createStepRunner(scope, page) {
  return async function step(label, action) {
    const startedAt = performance.now();

    try {
      await action();
      const elapsedMs = Math.round(performance.now() - startedAt);
      console.log(`[PASS] ${scope}: ${label} (${elapsedMs}ms)`);
    } catch (error) {
      const diagnostics = await collectPageDiagnostics(page);

      throw new Error(
        `[FAIL] ${scope}: ${label}\n${errorMessage(error)}\n${diagnostics}`,
        { cause: error },
      );
    }
  };
}

function watchPageErrors(page) {
  const failures = [];

  page.on("pageerror", (error) => {
    failures.push(`page error: ${error.message}`);
  });
  page.on("console", (message) => {
    const text = message.text();
    const isHydrationWarning =
      /hydration|hydrated|server rendered html didn't match/i.test(text);

    if (message.type() === "error" || isHydrationWarning) {
      failures.push(`console ${message.type()}: ${text}`);
    }
  });

  return failures;
}

async function loadCalendar(page, { expectControls = true } = {}) {
  const response = await page.goto(calendarUrl(), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  assert(response?.ok(), `Calendar returned ${response?.status() ?? "no response"}`);
  await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
  if (expectControls) {
    await page.getByRole("button", { name: "Week", exact: true }).waitFor();
  }
}

async function assertUnique(locator, label) {
  const count = await locator.count();
  assert(count === 1, `${label} expected one match, found ${count}`);
  return locator;
}

async function activateWithKeyboard(locator, label, key = "Enter") {
  await locator.focus();
  assert(
    await locator.evaluate((element) => element === document.activeElement),
    `${label} did not receive keyboard focus`,
  );
  await locator.press(key);
}

async function selectView(page, view) {
  const button = await assertUnique(
    page.getByRole("button", { name: view, exact: true }),
    `${view} view button`,
  );

  await activateWithKeyboard(button, `${view} view button`);
  await page.waitForFunction(
    (viewLabel) =>
      Array.from(
        document.querySelectorAll('[aria-label="Calendar view"] button'),
      ).some(
        (candidate) =>
          candidate.textContent?.trim() === viewLabel &&
          candidate.getAttribute("aria-pressed") === "true",
      ),
    view,
  );
  assert(
    (await button.getAttribute("aria-pressed")) === "true",
    `${view} did not expose aria-pressed=true`,
  );

  const viewStates = await page
    .locator('[aria-label="Calendar view"] button')
    .evaluateAll((buttons) =>
      buttons.map((candidate) => ({
        label: candidate.textContent?.trim(),
        pressed: candidate.getAttribute("aria-pressed"),
      })),
    );
  const pressedViews = viewStates
    .filter(({ pressed }) => pressed === "true")
    .map(({ label }) => label);

  assert(viewStates.length === 4, `Expected four Calendar views, found ${viewStates.length}`);
  assert(
    pressedViews.length === 1 && pressedViews[0] === view,
    `Expected only ${view} pressed; received ${JSON.stringify(viewStates)}`,
  );
}

async function assertPeriod(page, label) {
  await page.getByRole("heading", { name: label, exact: true }).waitFor();
}

async function waitForFocusLabel(page, label) {
  await page.waitForFunction(
    (expectedLabel) =>
      document.activeElement?.getAttribute("aria-label") === expectedLabel,
    label,
  );
}

async function expectButtonEnabled(page, locator, label) {
  await locator.waitFor({ state: "visible" });
  await page.waitForFunction(
    (buttonLabel) =>
      Array.from(document.querySelectorAll("button")).some(
        (button) =>
          button.textContent?.trim() === buttonLabel &&
          !button.disabled &&
          !button.closest("[inert]"),
      ),
    label,
  );
  assert(await locator.isEnabled(), `${label} should be enabled`);
}

async function pressAndWaitForFocus(page, key, label) {
  await page.keyboard.press(key);
  await waitForFocusLabel(page, label);
}

async function visibleCalendarSurfaceCount(page) {
  return page.evaluate(() => {
    const closeLabels = [
      "Close calendar filters",
      "Close project work planner",
      "Close calendar item inspector",
    ];
    const activePanels = closeLabels.filter((label) =>
      Array.from(document.querySelectorAll(`[aria-label="${label}"]`)).some(
        (control) => !control.closest("[inert]"),
      ),
    ).length;
    const moreOpen = document.querySelector(
      '[aria-label="More admin navigation"]',
    );

    return activePanels + (moreOpen ? 1 : 0);
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  assert(!hasOverflow, `${label} has document horizontal overflow`);
}

async function assertClosedSurfaceInert(page, closeLabel) {
  const state = await page.evaluate((label) => {
    const closeControl = Array.from(
      document.querySelectorAll(`[aria-label="${label}"]`),
    ).find((control) => control.closest('[aria-hidden="true"]'));
    const root = closeControl?.closest('[aria-hidden="true"]');

    return {
      activeInside: Boolean(root?.contains(document.activeElement)),
      inert: Boolean(root?.hasAttribute("inert")),
    };
  }, closeLabel);

  assert(state.inert, `${closeLabel} closed surface is not inert`);
  assert(!state.activeInside, `${closeLabel} retained focus while closed`);
}

const dialogFocusableSelector = [
  "a[href]",
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([type="hidden"]):not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

async function assertDialogFocusContainment(page, dialog, label) {
  assert(
    (await dialog.getAttribute("aria-modal")) === "true",
    `${label} should expose aria-modal=true`,
  );

  const descriptionId = await dialog.getAttribute("aria-describedby");
  assert(descriptionId, `${label} should reference an accessible description`);
  const description = dialog.locator(`[id="${descriptionId}"]`);
  assert(
    (await description.count()) === 1 && (await description.textContent())?.trim(),
    `${label} accessible description is missing or empty`,
  );

  const focusable = dialog.locator(`${dialogFocusableSelector}:visible`);
  const focusableCount = await focusable.count();
  assert(focusableCount > 0, `${label} has no focusable controls`);
  const firstFocusable = focusable.first();
  const lastFocusable = focusable.last();

  assert(
    await firstFocusable.evaluate((element) => element === document.activeElement),
    `${label} initial focus is not on its first control`,
  );

  await page.keyboard.press("Shift+Tab");
  assert(
    await lastFocusable.evaluate((element) => element === document.activeElement),
    `${label} Shift+Tab did not wrap to its last control`,
  );
  assert(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    `${label} allowed focus to leave after Shift+Tab`,
  );

  await page.keyboard.press("Tab");
  assert(
    await firstFocusable.evaluate((element) => element === document.activeElement),
    `${label} Tab did not wrap to its first control`,
  );
  assert(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    `${label} allowed focus to leave after Tab`,
  );

  return (await description.textContent())?.trim() ?? "";
}

async function closeWithEscape(page, dialogName, triggerLabel) {
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: dialogName, exact: true })
    .waitFor({ state: "hidden" });
  await waitForFocusLabel(page, triggerLabel);
  assert(
    (await visibleCalendarSurfaceCount(page)) === 0,
    `${dialogName} did not leave a clean Calendar surface`,
  );
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: desktopViewport });
  await applyAuthCookies(context, "full");
  const page = await context.newPage();
  const errors = watchPageErrors(page);
  const step = createStepRunner("desktop", page);
  page.setDefaultTimeout(7_500);

  try {
    await step("desktop Calendar loads", async () => {
      await loadCalendar(page);
      await assertPeriod(page, projectWeekLabel);
      await assertNoHorizontalOverflow(page, "Desktop Calendar");
    });

    await step("desktop Day/Week/Month/List switching", async () => {
      await selectView(page, "Day");
      await page
        .getByRole("button", {
          name: "Plan project work on Tue Jan 13 at 1 PM",
          exact: true,
        })
        .waitFor();

      await selectView(page, "Week");
      await page
        .getByRole("region", {
          name: "Project context and date-based work",
          exact: true,
        })
        .waitFor();

      await selectView(page, "Month");
      await page
        .getByRole("button", { name: "Plan project work on Wed Jan 14", exact: true })
        .waitFor();

      await selectView(page, "List");
      await page.getByTestId("calendar-list-view").waitFor();
    });

    await step("Week/List navigation and Project week reset", async () => {
      for (const view of ["List", "Week"]) {
        await selectView(page, view);
        const previous = await assertUnique(
          page.getByRole("button", { name: "Previous week", exact: true }),
          `${view} Previous week button`,
        );
        const next = await assertUnique(
          page.getByRole("button", { name: "Next week", exact: true }),
          `${view} Next week button`,
        );

        await activateWithKeyboard(previous, `${view} Previous week button`);
        await assertPeriod(page, previousWeekLabel);
        if (view === "Week") {
          await page
            .getByText("No scheduled items in this range", { exact: true })
            .waitFor();
          assert(
            (await page.getByRole("button", { name: weekItemLabel, exact: true }).count()) ===
              0,
            `${view} previous-week empty state must not keep the project-week persisted item`,
          );
        }
        await activateWithKeyboard(next, `${view} Next week button`);
        await assertPeriod(page, projectWeekLabel);
        await page
          .getByRole("button", {
            name: view === "List" ? listItemLabel : weekItemLabel,
            exact: true,
          })
          .waitFor();
        await activateWithKeyboard(next, `${view} Next week button`);
        await assertPeriod(page, nextWeekLabel);
        if (view === "List") {
          await page
            .getByRole("button", { name: /Follow-up supplies/ })
            .waitFor();
        } else {
          await page
            .getByRole("button", { name: nextWeekItemLabel, exact: true })
            .waitFor();
        }
        assert(
          (await page.getByText("No scheduled items in this range", { exact: true }).count()) === 0,
          `${view} next-week persisted item was hidden behind a false empty state`,
        );

        const reset = await assertUnique(
          page.getByRole("button", { name: "Project week", exact: true }),
          `${view} Project week button`,
        );
        assert(
          await reset.isEnabled(),
          `${view} Project week should be enabled after navigation`,
        );
        await activateWithKeyboard(reset, `${view} Project week button`);
        await assertPeriod(page, projectWeekLabel);
      }

      await selectView(page, "List");
    });

    await step("desktop Week safe horizontal arrows and sibling controls", async () => {
      await selectView(page, "Week");
      const timedTuesdayLabel =
        "Plan project work on Tue, Jan 13 in the Week time grid; keyboard default 9 AM";
      const timedTuesday = await assertUnique(
        page.getByRole("button", { name: timedTuesdayLabel, exact: true }),
        "Week Tuesday timed background",
      );
      const weekTargetAudit = await page.evaluate(() => {
        const timedTargets = Array.from(
          document.querySelectorAll('[data-calendar-arrow-target="week-timed-day"]'),
        );
        const contextTargets = Array.from(
          document.querySelectorAll('[data-calendar-arrow-target="week-context-day"]'),
        );
        const contextRegion = document.querySelector(
          '[aria-label="Project context and date-based work"]',
        );
        const contextButtons = Array.from(
          contextRegion?.querySelectorAll("button") ?? [],
        );

        return {
          contextCount: contextTargets.length,
          contextForegroundCount: contextButtons.filter(
            (button) => !button.hasAttribute("data-calendar-arrow-target"),
          ).length,
          contextNested: contextRegion?.querySelectorAll("button button, button a, a button").length ?? -1,
          contextTabbable: contextTargets.every(
            (target) => target instanceof HTMLElement && target.tabIndex >= 0,
          ),
          timedCount: timedTargets.length,
          timedNested:
            document.querySelector('[data-calendar-arrow-group="week-timed"]')?.querySelectorAll(
              "button button, button a, a button",
            ).length ?? -1,
          timedTabbable: timedTargets.every(
            (target) => target instanceof HTMLElement && target.tabIndex >= 0,
          ),
        };
      });
      assert(
        weekTargetAudit.timedCount === 7 && weekTargetAudit.timedTabbable,
        "Week should keep seven normally tabbable timed day backgrounds",
      );
      assert(
        weekTargetAudit.contextCount === 7 && weekTargetAudit.contextTabbable,
        "Project context should keep seven normally tabbable day backgrounds",
      );
      assert(
        weekTargetAudit.timedNested === 0 && weekTargetAudit.contextNested === 0,
        "Week timed or Project context controls became nested",
      );
      assert(
        weekTargetAudit.contextForegroundCount > 0,
        "Project context bars and overflow controls should remain foreground siblings",
      );

      await timedTuesday.focus();
      await pressAndWaitForFocus(
        page,
        "ArrowRight",
        "Plan project work on Wed, Jan 14 in the Week time grid; keyboard default 9 AM",
      );
      await pressAndWaitForFocus(page, "ArrowLeft", timedTuesdayLabel);
      await pressAndWaitForFocus(
        page,
        "Home",
        "Plan project work on Mon, Jan 12 in the Week time grid; keyboard default 9 AM",
      );
      await pressAndWaitForFocus(
        page,
        "End",
        "Plan project work on Sun, Jan 18 in the Week time grid; keyboard default 9 AM",
      );

      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await activateWithKeyboard(timedTuesday, "Week Tuesday timed background");
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      await assertDialogFocusContainment(page, planner, "Week timed creation");
      assert(
        (await planner.getByLabel("Date", { exact: true }).inputValue()) ===
          "2026-01-13" &&
          (await planner.getByLabel("Start", { exact: true }).inputValue()) ===
            "09:00" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) ===
            "10:00",
        "Week Enter creation should keep Tuesday's 09:00-10:00 keyboard default",
      );
      await closeWithEscape(page, "Plan project work", timedTuesdayLabel);

      await timedTuesday.focus();
      const timedWednesdayLabel =
        "Plan project work on Wed, Jan 14 in the Week time grid; keyboard default 9 AM";
      await pressAndWaitForFocus(page, "ArrowRight", timedWednesdayLabel);
      await page.keyboard.press("Space");
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      assert(
        (await planner.getByLabel("Date", { exact: true }).inputValue()) ===
          "2026-01-14" &&
          (await planner.getByLabel("Start", { exact: true }).inputValue()) ===
            "09:00" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) ===
            "10:00",
        "Week Space creation should keep Wednesday's 09:00-10:00 keyboard default",
      );
      await closeWithEscape(page, "Plan project work", timedWednesdayLabel);

      const contextTuesdayLabel =
        "Plan project work with no specific time on Tuesday, Jan 13";
      const contextTuesday = await assertUnique(
        page.getByRole("button", { name: contextTuesdayLabel, exact: true }),
        "Tuesday Project context background",
      );
      await contextTuesday.focus();
      await pressAndWaitForFocus(
        page,
        "ArrowRight",
        "Plan project work with no specific time on Wednesday, Jan 14",
      );
      await pressAndWaitForFocus(page, "ArrowLeft", contextTuesdayLabel);
      await pressAndWaitForFocus(
        page,
        "Home",
        "Plan project work with no specific time on Monday, Jan 12",
      );
      await pressAndWaitForFocus(
        page,
        "End",
        "Plan project work with no specific time on Sunday, Jan 18",
      );

      await activateWithKeyboard(contextTuesday, "Tuesday Project context background");
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      assert(
        (await planner.getByLabel("Date", { exact: true }).inputValue()) ===
          "2026-01-13" &&
          (await planner.getByLabel("No specific time", { exact: true }).isChecked()),
        "Project context Enter creation should keep Tuesday with no specific time",
      );
      await closeWithEscape(page, "Plan project work", contextTuesdayLabel);

      await contextTuesday.focus();
      const contextWednesdayLabel =
        "Plan project work with no specific time on Wednesday, Jan 14";
      await pressAndWaitForFocus(page, "ArrowRight", contextWednesdayLabel);
      await page.keyboard.press("Space");
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      await assertDialogFocusContainment(
        page,
        planner,
        "Week Project context creation",
      );
      assert(
        (await planner.getByLabel("Date", { exact: true }).inputValue()) ===
          "2026-01-14" &&
          (await planner.getByLabel("No specific time", { exact: true }).isChecked()),
        "Project context Space creation should keep Wednesday with no specific time",
      );
      await closeWithEscape(page, "Plan project work", contextWednesdayLabel);
    });

    await step("desktop filters focus, filter to Food, and close", async () => {
      await selectView(page, "List");
      const trigger = await assertUnique(
        page.getByRole("button", { name: "Open calendar filters", exact: true }),
        "Calendar filters trigger",
      );
      await activateWithKeyboard(trigger, "Calendar filters trigger");
      const dialog = page.getByRole("dialog", {
        name: "Calendar filters",
        exact: true,
      });
      await dialog.waitFor();
      await waitForFocusLabel(page, "Close calendar filters");
      const filterDescription = await assertDialogFocusContainment(
        page,
        dialog,
        "Desktop filters",
      );
      assert(
        filterDescription.includes("task name, coverage, or task type"),
        "Desktop filters description lacks filter context",
      );
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Filters should be the only active Calendar surface",
      );

      const foodFilter = await assertUnique(
        dialog.getByRole("button", { name: "Food", exact: true }),
        "Food filter toggle",
      );
      assert(
        (await foodFilter.getAttribute("aria-pressed")) === "false",
        "Food filter should initially expose aria-pressed=false",
      );
      await activateWithKeyboard(foodFilter, "Food filter toggle");
      assert(
        (await foodFilter.getAttribute("aria-pressed")) === "true",
        "Food filter should expose aria-pressed=true after activation",
      );
      const showResults = await assertUnique(
        dialog.getByRole("button", { name: "Show results (1)", exact: true }),
        "Show filtered results button",
      );
      await activateWithKeyboard(showResults, "Show filtered results button");
      await dialog.waitFor({ state: "hidden" });
      await waitForFocusLabel(page, "Open calendar filters");
      await assertClosedSurfaceInert(page, "Close calendar filters");
      await page.getByText("1 visible item - Food", { exact: true }).waitFor();
      assert(
        (await page
          .locator('[data-testid="calendar-list-view"] [role="listitem"] > button')
          .count()) === 1,
        "Food filter should leave one List row",
      );
      await activateWithKeyboard(
        await assertUnique(
          page.getByRole("button", { name: "Reset", exact: true }),
          "Reset filters button",
        ),
        "Reset filters button",
      );
    });

    await step("desktop item inspector focus and Escape restoration", async () => {
      await selectView(page, "Week");
      const trigger = await assertUnique(
        page.getByRole("button", { name: weekItemLabel, exact: true }),
        "Week event button",
      );
      await activateWithKeyboard(trigger, "Week event button");
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await waitForFocusLabel(page, "Close calendar item inspector");
      const inspector = page.getByRole("dialog", {
        name: "Calendar item inspector",
        exact: true,
      });
      const inspectorDescription = await assertDialogFocusContainment(
        page,
        inspector,
        "Desktop inspector",
      );
      assert(
        inspectorDescription.includes("Gate attendant") &&
          inspectorDescription.includes("1 of 1 volunteers") &&
          inspectorDescription.includes("Tue Jan 13"),
        "Inspector description lacks task, coverage, or date context",
      );
      await closeWithEscape(page, "Calendar item inspector", weekItemLabel);
    });

    await step("desktop Day arrows, creation, and focus restoration", async () => {
      await selectView(page, "Day");
      const triggerLabel = "Plan project work on Tue Jan 13 at 1 PM";
      const trigger = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Day creation target",
      );
      const dayTargetAudit = await page.evaluate(() => {
        const targets = Array.from(
          document.querySelectorAll('[data-calendar-arrow-target="day-hour"]'),
        );

        return {
          count: targets.length,
          tabbable: targets.every((target) => target instanceof HTMLElement && target.tabIndex >= 0),
        };
      });
      assert(
        dayTargetAudit.count === 24 && dayTargetAudit.tabbable,
        "Day should keep 24 normally tabbable hour targets",
      );

      await trigger.focus();
      await pressAndWaitForFocus(
        page,
        "ArrowDown",
        "Plan project work on Tue Jan 13 at 2 PM",
      );
      await pressAndWaitForFocus(page, "ArrowUp", triggerLabel);
      await pressAndWaitForFocus(
        page,
        "Home",
        "Plan project work on Tue Jan 13 at 12 AM",
      );
      await pressAndWaitForFocus(
        page,
        "End",
        "Plan project work on Tue Jan 13 at 11 PM",
      );

      await activateWithKeyboard(trigger, "Day creation target");
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      const creationDescription = await assertDialogFocusContainment(
        page,
        planner,
        "Desktop creation",
      );
      assert(
        creationDescription.includes("Create a persisted timed Calendar item"),
        "Creation description lacks persisted source-selection context",
      );
      await planner
        .getByText("Suggested Tuesday, Jan 13, 1 PM to 2 PM. Adjust below.", {
          exact: true,
        })
        .waitFor();
      assert(
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "13:00",
        "Day creation should default Start to 13:00",
      );
      assert(
        (await planner.getByLabel("End", { exact: true }).inputValue()) === "14:00",
        "Day creation should default End to 14:00",
      );

      const taskPresetMode = await assertUnique(
        planner.getByRole("button", { name: "Task preset", exact: true }),
        "Task preset mode",
      );
      const customMode = await assertUnique(
        planner.getByRole("button", { name: "Custom one-off", exact: true }),
        "Custom one-off mode",
      );
      assert(
        (await taskPresetMode.getAttribute("aria-pressed")) === "false" &&
          (await customMode.getAttribute("aria-pressed")) === "true" &&
          !(await taskPresetMode.isDisabled()),
        "Creation task-source buttons should expose their selected state",
      );
      await taskPresetMode.click();
      await planner.getByLabel("Task preset", { exact: true }).selectOption(fixture.generalTaskPresetId);
      await planner.getByRole("heading", { name: "QA 12.12 General", exact: true }).waitFor();
      await customMode.click();

      const endInput = planner.getByLabel("End", { exact: true });
      await endInput.fill("12:00");
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('input[type="time"]')).some(
            (input) =>
              input.value === "12:00" &&
              input.getAttribute("aria-invalid") === "true",
          ),
      );
      const errorDescriptionId = await endInput.getAttribute("aria-describedby");
      assert(errorDescriptionId, "Invalid End should reference an error description");
      await planner.locator(`[id="${errorDescriptionId}"]`).waitFor();
      await endInput.fill("14:00");

      const scheduleButton = await assertUnique(
        planner.getByRole("button", { name: "Schedule", exact: true }),
        "Schedule persisted action",
      );
      assert(await scheduleButton.isEnabled(), "Schedule should be enabled for valid timed creation");
      assert(
        Boolean(await scheduleButton.getAttribute("aria-describedby")),
        "Schedule should describe its persisted action state",
      );

      for (const action of ["Save draft", "Assign helpers"]) {
        const actionButton = await assertUnique(
          planner.getByRole("button", { name: action, exact: true }),
          `${action} preview action`,
        );
        assert(!(await actionButton.isEnabled()), `${action} should remain disabled`);
        assert(
          Boolean(await actionButton.getAttribute("aria-describedby")),
          `${action} should describe why it is unavailable`,
        );
      }
      await closeWithEscape(page, "Plan project work", triggerLabel);

      await trigger.focus();
      const arrowSpaceTriggerLabel = "Plan project work on Tue Jan 13 at 2 PM";
      await pressAndWaitForFocus(page, "ArrowDown", arrowSpaceTriggerLabel);
      await page.keyboard.press("Space");
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      await assertDialogFocusContainment(
        page,
        planner,
        "Arrow-focused Day creation",
      );
      assert(
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "14:00" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) === "15:00",
        "Day Space creation should preserve the arrow-focused 2 PM default",
      );
      await closeWithEscape(page, "Plan project work", arrowSpaceTriggerLabel);
    });

    await step("desktop Month arrows, sibling controls, and creation", async () => {
      await selectView(page, "Month");
      const event = await assertUnique(
        page.getByRole("button", { name: monthItemLabel, exact: true }),
        "Month event chip",
      );
      await activateWithKeyboard(event, "Month event chip");
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await closeWithEscape(page, "Calendar item inspector", monthItemLabel);

      const triggerLabel = "Plan project work on Thu Jan 15";
      const background = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Populated Month background",
      );
      const monthTargetAudit = await page.evaluate(() => {
        const targets = Array.from(
          document.querySelectorAll('[data-calendar-arrow-target="month-date"]'),
        );

        return {
          count: targets.length,
          tabbable: targets.every((target) => target instanceof HTMLElement && target.tabIndex >= 0),
        };
      });
      assert(
        monthTargetAudit.count === 35 && monthTargetAudit.tabbable,
        "January Month should keep 35 normally tabbable visible date targets",
      );
      await background.focus();
      await pressAndWaitForFocus(
        page,
        "ArrowRight",
        "Plan project work on Fri Jan 16",
      );
      await pressAndWaitForFocus(page, "ArrowLeft", triggerLabel);
      await pressAndWaitForFocus(
        page,
        "ArrowDown",
        "Plan project work on Thu Jan 22",
      );
      await pressAndWaitForFocus(page, "ArrowUp", triggerLabel);
      await pressAndWaitForFocus(
        page,
        "Home",
        "Plan project work on Sun Dec 28",
      );
      await pressAndWaitForFocus(
        page,
        "End",
        "Plan project work on Sat Jan 31",
      );

      const siblingState = await background.evaluate((backgroundControl, eventLabel) => {
        const cell = backgroundControl.parentElement;
        const eventControl = Array.from(cell?.querySelectorAll("button") ?? []).find(
          (control) => control.getAttribute("aria-label") === eventLabel,
        );

        return {
          eventFound: Boolean(eventControl),
          nested:
            Boolean(eventControl) &&
            (backgroundControl.contains(eventControl) ||
              eventControl.contains(backgroundControl)),
        };
      }, monthItemLabel);
      assert(siblingState.eventFound, "Month event chip was not found in its date cell");
      assert(!siblingState.nested, "Month background and event chip must be sibling controls");
      const nestedMonthControls = await page
        .locator(
          '[data-calendar-arrow-group="month-dates"] button button, [data-calendar-arrow-group="month-dates"] button a, [data-calendar-arrow-group="month-dates"] a button',
        )
        .count();
      assert(
        nestedMonthControls === 0,
        `Month contains ${nestedMonthControls} nested interactive controls`,
      );
      await activateWithKeyboard(background, "Populated Month background");
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      assert(
        (await planner.getByLabel("Date", { exact: true }).inputValue()) ===
          "2026-01-15",
        "Month creation should keep Jan 15",
      );
      assert(
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "09:00",
        "Month creation should default Start to 09:00",
      );
      assert(
        (await planner.getByLabel("End", { exact: true }).inputValue()) === "10:00",
        "Month creation should default End to 10:00",
      );
      await closeWithEscape(page, "Plan project work", triggerLabel);

      await background.focus();
      const arrowSpaceTriggerLabel = "Plan project work on Fri Jan 16";
      await pressAndWaitForFocus(page, "ArrowRight", arrowSpaceTriggerLabel);
      await page.keyboard.press("Space");
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      await assertDialogFocusContainment(
        page,
        planner,
        "Arrow-focused Month creation",
      );
      assert(
        (await planner.getByLabel("Date", { exact: true }).inputValue()) ===
          "2026-01-16" &&
          (await planner.getByLabel("Start", { exact: true }).inputValue()) ===
            "09:00" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) ===
            "10:00",
        "Month Space creation should preserve the arrow-focused Jan 16 default",
      );
      await closeWithEscape(page, "Plan project work", arrowSpaceTriggerLabel);
    });

    await step("desktop List rows reuse inspector without nested controls", async () => {
      await selectView(page, "List");
      const nestedControls = await page
        .locator(
          '[data-testid="calendar-list-view"] button button, [data-testid="calendar-list-view"] button a, [data-testid="calendar-list-view"] a button',
        )
        .count();
      assert(nestedControls === 0, `List contains ${nestedControls} nested controls`);

      const trigger = await assertUnique(
        page.getByRole("button", { name: listItemLabel, exact: true }),
        "List row",
      );
      await activateWithKeyboard(trigger, "List row", "Space");
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await closeWithEscape(page, "Calendar item inspector", listItemLabel);
    });

    await step("desktop persisted create/edit round trip", async () => {
      const createdTitle = `QA persisted browser item ${fixture.namespace.slice(-8)}`;
      const updatedTitle = `QA edited browser item ${fixture.namespace.slice(-8)}`;

      await selectView(page, "Day");
      const triggerLabel = "Plan project work on Tue Jan 13 at 3 PM";
      const trigger = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Day persisted creation target",
      );
      await activateWithKeyboard(trigger, "Day persisted creation target");
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      await planner.getByLabel("Custom task name", { exact: true }).fill(createdTitle);
      await planner.locator('input[type="number"]').first().fill("0");
      await planner
        .getByLabel("Schedule notes", { exact: true })
        .fill("Browser regression persisted create note.");
      await Promise.all([
        page.waitForURL(/notice=created/),
        planner.getByRole("button", { name: "Schedule", exact: true }).click(),
      ]);
      await page.getByText("Calendar item scheduled", { exact: true }).waitFor();
      await page.getByText(createdTitle, { exact: true }).waitFor();

      await page.reload();
      await page.getByText(createdTitle, { exact: true }).waitFor();
      const createdItem = page
        .getByRole("button", { name: new RegExp(createdTitle) })
        .first();
      await activateWithKeyboard(createdItem, "Created persisted Calendar item");
      const inspector = page.getByRole("dialog", {
        name: "Calendar item inspector",
        exact: true,
      });
      await inspector.waitFor();
      await inspector.getByLabel("Task name", { exact: true }).fill(updatedTitle);
      await inspector.getByLabel("Start", { exact: true }).fill("15:30");
      await inspector.getByLabel("End", { exact: true }).fill("16:30");
      await inspector.locator("textarea").first().fill("Browser regression persisted edit note.");
      await Promise.all([
        page.waitForURL(/notice=updated/),
        inspector.getByRole("button", { name: "Save item changes", exact: true }).click(),
      ]);
      await page.getByText("Calendar item updated", { exact: true }).waitFor();
      await page.getByText(updatedTitle, { exact: true }).waitFor();

      await page.reload();
      await page.getByText(updatedTitle, { exact: true }).waitFor();
      assert(
        (await page.getByText(createdTitle, { exact: true }).count()) === 0,
        "Reload after edit still displayed the stale created title",
      );

      const presetTriggerLabel = "Plan project work on Tue Jan 13 at 4 PM";
      const presetTrigger = await assertUnique(
        page.getByRole("button", { name: presetTriggerLabel, exact: true }),
        "Day persisted preset creation target",
      );
      await activateWithKeyboard(presetTrigger, "Day persisted preset creation target");
      await planner.waitFor();
      await planner.getByRole("button", { name: "Task preset", exact: true }).click();
      await planner.getByLabel("Task preset", { exact: true }).selectOption(fixture.generalTaskPresetId);
      await planner.locator('input[type="number"]').first().fill("2");
      await planner
        .getByLabel("Schedule notes", { exact: true })
        .fill("Browser regression persisted preset create note.");
      await Promise.all([
        page.waitForURL(/notice=created/),
        planner.getByRole("button", { name: "Schedule", exact: true }).click(),
      ]);
      await page.getByText("Calendar item scheduled", { exact: true }).waitFor();
      await page.getByText("QA 12.12 General", { exact: true }).waitFor();

      await page.reload();
      await page.getByText("QA 12.12 General", { exact: true }).waitFor();
      const presetCreatedItem = page
        .getByRole("button", { name: /QA 12\.12 General.*4:00 PM - 5:00 PM/ })
        .first();
      await activateWithKeyboard(presetCreatedItem, "Created persisted preset Calendar item");
      await inspector.waitFor();
      await inspector.getByLabel("Start", { exact: true }).fill("16:30");
      await inspector.getByLabel("End", { exact: true }).fill("17:30");
      await inspector.locator("textarea").first().fill("Browser regression persisted preset edit note.");
      await Promise.all([
        page.waitForURL(/notice=updated/),
        inspector.getByRole("button", { name: "Save item changes", exact: true }).click(),
      ]);
      await page.getByText("Calendar item updated", { exact: true }).waitFor();
      await page.reload();
      await page.getByRole("button", { name: /QA 12\.12 General.*4:30 PM - 5:30 PM/ }).first().waitFor();
    });

    await step("desktop persisted assignment create/cancel round trip", async () => {
      await selectView(page, "Day");
      const assignmentTarget = page
        .getByRole("button", { name: /Gate attendant.*7:30 AM - 10:30 AM/ })
        .first();
      await activateWithKeyboard(assignmentTarget, "Assignment target Calendar item");
      const inspector = page.getByRole("dialog", {
        name: "Calendar item inspector",
        exact: true,
      });
      await inspector.waitFor();
      await inspector
        .locator("label")
        .filter({ hasText: "QA 12.12 Volunteer 2" })
        .locator('input[type="checkbox"]')
        .click({ force: true });
      await inspector.locator('input[name="volunteerProfileIds"]').waitFor({
        state: "attached",
      });
      const assignSelectedButton = inspector.getByRole("button", {
        name: "Assign selected",
        exact: true,
      });
      await expectButtonEnabled(page, assignSelectedButton, "Assign selected");
      await Promise.all([
        page.waitForURL(/notice=(assigned|validation|error|unavailable)/),
        assignSelectedButton.evaluate((button) => {
          if (!(button instanceof HTMLButtonElement) || !button.form) {
            throw new Error("Assignment submit button was not associated with a form.");
          }
          button.form.requestSubmit(button);
        }),
      ]);
      assert(
        new URL(page.url()).searchParams.get("notice") === "assigned",
        `Assignment submit returned ${page.url()} instead of the persisted assigned notice.`,
      );
      await page.getByText("Volunteer assigned", { exact: true }).waitFor();

      await page.reload();
      const assignedItem = page
        .getByRole("button", { name: /Gate attendant.*7:30 AM - 10:30 AM/ })
        .first();
      await activateWithKeyboard(assignedItem, "Assigned persisted Calendar item");
      await inspector.waitFor();
      await inspector.getByText("QA 12.12 Volunteer 2", { exact: true }).waitFor();
      await inspector.getByText("Needs response", { exact: true }).waitFor();

      await Promise.all([
        page.waitForURL(/notice=assignment_canceled/),
        inspector
          .getByRole("button", { name: "Remove assignment", exact: true })
          .nth(1)
          .click(),
      ]);
      await page.getByText("Volunteer removed", { exact: true }).waitFor();
      await page.reload();
      const canceledItem = page
        .getByRole("button", { name: /Gate attendant.*7:30 AM - 10:30 AM/ })
        .first();
      await activateWithKeyboard(canceledItem, "Canceled-assignment Calendar item");
      await inspector.waitFor();
      assert(
        (await inspector.getByText("Needs response", { exact: true }).count()) === 0,
        "Canceled assignment response still appeared in the Calendar inspector after reload.",
      );
    });

    await step("desktop has no browser errors", async () => {
      assert(errors.length === 0, errors.join("\n"));
    });
  } finally {
    await context.close();
  }
}

async function runMobile(browser) {
  const context = await browser.newContext({ viewport: mobileViewport });
  await applyAuthCookies(context, "full");
  const page = await context.newPage();
  const errors = watchPageErrors(page);
  const step = createStepRunner("mobile", page);
  page.setDefaultTimeout(7_500);

  try {
    await step("mobile Calendar and emphasized bottom navigation load", async () => {
      await loadCalendar(page);
      const navigation = page.getByRole("navigation", {
        name: "Primary admin navigation",
        exact: true,
      });
      await navigation.waitFor();
      const calendarTab = navigation.getByRole("link", {
        name: "Open Calendar",
        exact: true,
      });
      await calendarTab.waitFor();
      assert(
        (await calendarTab.getAttribute("aria-current")) === "page",
        "Mobile Calendar tab does not expose aria-current=page",
      );
      await calendarTab.focus();
      assert(
        await calendarTab.evaluate((element) => element === document.activeElement),
        "Mobile Calendar tab is not keyboard reachable",
      );
      await assertNoHorizontalOverflow(page, "Mobile Calendar");
    });

    await step("mobile view controls fit and switch", async () => {
      const controlAudit = await page.evaluate(() => {
        const group = document.querySelector('[aria-label="Calendar view"]');
        const buttons = group ? Array.from(group.querySelectorAll("button")) : [];
        const bounds = group?.getBoundingClientRect();

        return {
          buttonCount: buttons.length,
          fitsViewport: Boolean(
            bounds && bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth,
          ),
        };
      });
      assert(controlAudit.buttonCount === 4, "Mobile should expose four view controls");
      assert(controlAudit.fitsViewport, "Mobile view controls exceed the viewport");

      for (const view of ["Day", "Week", "Month", "List"]) {
        await selectView(page, view);
      }

      const mobileListAudit = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="calendar-list-view"]');

        return {
          nestedControls:
            list?.querySelectorAll("button button, button a, a button").length ?? -1,
          overflow: Boolean(list && list.scrollWidth > list.clientWidth),
          rows: list?.querySelectorAll('[role="listitem"] > button').length ?? 0,
        };
      });
      assert(
        mobileListAudit.rows >= 7,
        "Mobile List should retain the original persisted rows plus any browser-created item",
      );
      assert(
        mobileListAudit.nestedControls === 0,
        "Mobile List should not contain nested interactive controls",
      );
      assert(!mobileListAudit.overflow, "Mobile List has horizontal overflow");

      await selectView(page, "Month");
      const mobileMonthDate = await assertUnique(
        page.getByRole("button", {
          name: "Plan project work on Wed Jan 14",
          exact: true,
        }),
        "Mobile Month date target",
      );
      await mobileMonthDate.focus();
      await pressAndWaitForFocus(
        page,
        "ArrowRight",
        "Plan project work on Thu Jan 15",
      );
      const overflow = await assertUnique(
        page.getByRole("button", {
          name: /^Switch to Day view for Wed Jan 14 to show \d+ more calendar item/,
        }),
        "Mobile Month overflow button",
      );
      const overflowSiblingState = await overflow.evaluate((overflowControl) => {
        const cell = overflowControl.closest("[data-calendar-month-cell]");
        const background = cell?.querySelector("[data-calendar-arrow-target]");

        return {
          backgroundFound: Boolean(background),
          nested:
            Boolean(background) &&
            (background.contains(overflowControl) ||
              overflowControl.contains(background)),
        };
      });
      assert(
        overflowSiblingState.backgroundFound && !overflowSiblingState.nested,
        "Mobile Month overflow and date creation target must remain sibling controls",
      );
      await activateWithKeyboard(overflow, "Mobile Month overflow button");
      await page.waitForFunction(() =>
        Array.from(
          document.querySelectorAll('[aria-label="Calendar view"] button'),
        ).some(
          (candidate) =>
            candidate.textContent?.trim() === "Day" &&
            candidate.getAttribute("aria-pressed") === "true",
        ),
      );
      assert(
        (await page
          .getByRole("button", { name: "Day", exact: true })
          .getAttribute("aria-pressed")) === "true",
        "Mobile Month overflow should switch to Day view",
      );
      await selectView(page, "Week");
      await assertNoHorizontalOverflow(page, "Mobile view controls");
    });

    await step("mobile More keyboard focus, Escape, and exclusivity", async () => {
      const trigger = await assertUnique(
        page.getByRole("button", {
          name: "Open more admin navigation",
          exact: true,
        }),
        "Mobile More trigger",
      );
      assert(
        (await trigger.getAttribute("aria-expanded")) === "false",
        "Mobile More should initially expose aria-expanded=false",
      );
      await activateWithKeyboard(trigger, "Mobile More trigger");
      const more = page.getByRole("dialog", {
        name: "More admin navigation",
        exact: true,
      });
      await more.waitFor();
      await waitForFocusLabel(page, "Close more admin navigation");
      const moreDescription = await assertDialogFocusContainment(
        page,
        more,
        "Mobile More",
      );
      assert(
        moreDescription.includes("Additional admin destinations"),
        "Mobile More description lacks destination context",
      );
      assert(
        (await trigger.getAttribute("aria-expanded")) === "true",
        "Mobile More should expose aria-expanded=true while open",
      );
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile More should be the only active surface",
      );
      await page.keyboard.press("Escape");
      await more.waitFor({ state: "hidden" });
      await waitForFocusLabel(page, "Open more admin navigation");
      assert(
        (await trigger.getAttribute("aria-expanded")) === "false",
        "Mobile More should expose aria-expanded=false after Escape",
      );
      assert(
        (await visibleCalendarSurfaceCount(page)) === 0,
        "Mobile More Escape should leave a clean Calendar surface",
      );
    });

    await step("mobile filters open as the only sheet", async () => {
      const trigger = page.getByRole("button", {
        name: "Open calendar filters",
        exact: true,
      });
      await activateWithKeyboard(trigger, "Mobile filters trigger");
      const dialog = page.getByRole("dialog", {
        name: "Calendar filters",
        exact: true,
      });
      await dialog.waitFor();
      await waitForFocusLabel(page, "Close calendar filters");
      await assertDialogFocusContainment(page, dialog, "Mobile filters");
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile filters should not stack with More or another dialog",
      );
      await closeWithEscape(page, "Calendar filters", "Open calendar filters");
      await assertClosedSurfaceInert(page, "Close calendar filters");
    });

    await step("mobile item opens the inspector sheet alone", async () => {
      const trigger = page.getByRole("button", { name: weekItemLabel, exact: true });
      await activateWithKeyboard(trigger, "Mobile Week event button");
      await page
        .getByRole("dialog", { name: "Calendar item inspector", exact: true })
        .waitFor();
      await waitForFocusLabel(page, "Close calendar item inspector");
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile inspector should be the only active surface",
      );
      await closeWithEscape(page, "Calendar item inspector", weekItemLabel);
    });

    await step("mobile creation sheet opens alone and restores focus", async () => {
      const triggerLabel = "Plan project work on Mon Jan 12";
      const trigger = await assertUnique(
        page.getByRole("button", { name: triggerLabel, exact: true }),
        "Mobile Week creation target",
      );
      await activateWithKeyboard(trigger, "Mobile Week creation target");
      const planner = page.getByRole("dialog", {
        name: "Plan project work",
        exact: true,
      });
      await planner.waitFor();
      await waitForFocusLabel(page, "Close project work planner");
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile creation should be the only active surface",
      );
      await planner.getByText("Suggested from calendar day", { exact: true }).waitFor();
      await closeWithEscape(page, "Plan project work", triggerLabel);
    });

    await step("mobile has no overflow or browser errors", async () => {
      await assertNoHorizontalOverflow(page, "Mobile Calendar after interactions");
      assert(errors.length === 0, errors.join("\n"));
    });
  } finally {
    await context.close();
  }
}

async function runUnavailable(browser) {
  const context = await browser.newContext({ viewport: desktopViewport });
  await applyAuthCookies(context, "calendar-only");
  const page = await context.newPage();
  const errors = watchPageErrors(page);
  const step = createStepRunner("unavailable", page);
  page.setDefaultTimeout(7_500);

  try {
    await step("under-capability Calendar fails closed", async () => {
      await loadCalendar(page, { expectControls: false });
      await page
        .getByText("Calendar is unavailable right now", { exact: true })
        .waitFor();
      assert(
        (await page.getByRole("button", { name: weekItemLabel, exact: true }).count()) === 0,
        "Unavailable Calendar must not reveal persisted item controls",
      );
      assert(
        (await page.getByText("Gate attendant", { exact: true }).count()) === 0,
        "Unavailable Calendar must not reveal item labels",
      );
      const bodyText = await page.locator("body").innerText();
      for (const forbidden of [
        "Supabase",
        "SQL",
        "RPC",
        "policy",
        "workspace_contact_grants",
        "calendar_assignments",
        "assignment_responses",
        "access token",
        "refresh token",
        "service role",
      ]) {
        assert(!bodyText.includes(forbidden), `Unavailable state leaked ${forbidden}`);
      }
    });

    await step("unavailable has no browser errors", async () => {
      assert(errors.length === 0, errors.join("\n"));
    });
  } finally {
    await context.close();
  }
}

async function assertPreviewAvailable() {
  const target = calendarUrl();

  try {
    const response = await fetch(target, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    await response.body?.cancel();
  } catch (error) {
    throw new Error(
      [
        `Calendar preview is unavailable at ${target}.`,
        "Start a production preview with `npm run build` then `npm run preview`,",
        "or set PREVIEW_BASE_URL to an already-running preview.",
        `Connection detail: ${errorMessage(error)}`,
      ].join("\n"),
      { cause: error },
    );
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch(
      browserExecutable ? { executablePath: browserExecutable } : {},
    );
  } catch (error) {
    throw new Error(
      [
        "Unable to launch a Chromium browser for Calendar regression.",
        browserExecutable
          ? `Configured browser: ${browserExecutable}`
          : "Install Playwright Chromium or set PREVIEW_BROWSER_EXECUTABLE to Chrome/Edge.",
        `Launch detail: ${errorMessage(error)}`,
      ].join("\n"),
      { cause: error },
    );
  }
}

async function main() {
  console.log(`Calendar regression target: ${calendarUrl()}`);
  await verifyLocalPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  let browser;

  try {
    await applyCalendarSourceSelectionMigrationIfNeeded(containerName);
    await createFixtures(containerName);
    await assertPreviewAvailable();
    browser = await launchBrowser();
    await runUnavailable(browser);
    await runDesktop(browser);
    await runMobile(browser);
  } finally {
    await browser?.close();
    await cleanupFixtures(containerName);
  }
  assert(cleanupCompleted, "Calendar route browser fixture cleanup did not complete.");

  console.log("Calendar interaction regression passed.");
}

main().catch((error) => {
  console.error(`\nCalendar interaction regression failed.\n${redact(errorMessage(error))}`);
  process.exitCode = 1;
});
