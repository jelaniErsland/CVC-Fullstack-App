import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
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
const writeAssignmentDetailReviewScreenshots =
  process.env.WRITE_ASSIGNMENT_DETAIL_REVIEW_SCREENSHOTS === "1";
const betaReviewDir = path.join(
  root,
  "docs",
  "previews",
  writeAssignmentDetailReviewScreenshots
    ? "iteration-12-40-assignment-detail-review"
    : "beta-review",
);
const writeBetaReviewScreenshots = process.env.WRITE_BETA_REVIEW_SCREENSHOTS === "1";
const writeIterationReviewScreenshots =
  process.env.WRITE_ITERATION_12_44D1_CAPTURES === "1";
const writeCalendarFlowReviewScreenshots =
  process.env.WRITE_ITERATION_12_44D2A_CAPTURES === "1" ||
  process.env.WRITE_ITERATION_12_44D2A_AFFECTED_CAPTURES === "1";
const writeAssignmentPickerReviewScreenshots =
  process.env.WRITE_ITERATION_12_44D2B_CAPTURES === "1";
const projectDayQuickViewOnly =
  process.env.PROJECT_DAY_QUICK_VIEW_ONLY === "1";
const archiveUiBrowserOnly =
  process.env.ARCHIVE_UI_BROWSER_ONLY === "1";
const archiveUiCaptureNames = new Set(
  (process.env.ARCHIVE_UI_CAPTURE_NAMES ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
);
const archiveUiReviewDir = path.resolve(
  root,
  "..",
  "previews",
  "beta-review",
  "iteration-12-44f2-beta-containment-lifecycle",
);
const writeProjectDayQuickViewCaptures =
  process.env.WRITE_ITERATION_12_44E2_CAPTURES === "1";
const writeAffectedCalendarFlowReviewScreenshots =
  process.env.WRITE_ITERATION_12_44D2A_AFFECTED_CAPTURES === "1";
const affectedCalendarFlowCaptureNames = new Set([
  "05-create-preset-first.png",
  "06-create-default-times.png",
  "07-create-save-and-continue.png",
  "08-after-save-inspector.png",
  "09-after-assignment-inspector.png",
  "10-after-publish-notification.png",
  "11-mobile-after-save-inspector.png",
  "12-mobile-post-assignment-inspector.png",
]);
const iterationReviewDir = path.resolve(
  root,
  "..",
  "previews",
  "beta-review",
  writeProjectDayQuickViewCaptures
    ? "iteration-12-44e2-project-day-quick-view"
    : writeAssignmentPickerReviewScreenshots
    ? "iteration-12-44d2b-assignment-picker"
    : writeCalendarFlowReviewScreenshots
    ? "iteration-12-44d2a-calendar-flow"
    : "iteration-12-44d1-mobile-overlays",
);
const writeNamedReviewScreenshots =
  writeBetaReviewScreenshots ||
  writeAssignmentDetailReviewScreenshots ||
  writeCalendarFlowReviewScreenshots ||
  writeAssignmentPickerReviewScreenshots ||
  writeProjectDayQuickViewCaptures;
const reviewWorkspaceName = writeNamedReviewScreenshots
  ? "Bozeman Local Project"
  : "QA 12.12 Calendar Workspace";
const fixtureVolunteerCount = 56;
const reviewFirstNames = ["Alex", "Maya", "Noah", "Elena", "Marcus", "Priya", "Jonah", "Avery", "Camila", "Darius", "Nina", "Owen", "Sofia", "Theo"];
const reviewLastNames = ["Rivera", "Chen", "Bennett", "Ruiz", "Lee", "Shah", "Price", "Morgan", "Patel", "Brooks", "Kim", "Foster", "Diaz", "Walker"];
const reviewVolunteerNames = writeNamedReviewScreenshots
  ? Array.from({ length: fixtureVolunteerCount }, (_, index) =>
      index < 7
        ? ["Alex Rivera", "Maya Chen", "Noah Bennett", "Elena Ruiz", "Marcus Lee", "Priya Shah", "Jonah Price"][index]
        : `${reviewFirstNames[index % reviewFirstNames.length]} ${reviewLastNames[(Math.floor(index / reviewFirstNames.length) + 7) % reviewLastNames.length]}`,
    )
  : Array.from({ length: fixtureVolunteerCount }, (_, index) => `QA 12.12 Volunteer ${String(index + 1).padStart(2, "0")}`);
const reviewCongregations = writeNamedReviewScreenshots
  ? ["Bozeman Congregation", "Belgrade Congregation", "Helena Congregation", "Livingston Congregation", "Manhattan Congregation"]
  : ["QA Bozeman", "QA Belgrade", "QA Helena", "QA Livingston", "QA Manhattan"];
const reviewGeneralPresetName = writeNamedReviewScreenshots
  ? "Drywall Crew"
  : "QA 12.12 General";

const desktopViewport = { width: 1440, height: 1000 };
const mobileViewport = { width: 390, height: 844 };
const projectWeekLabel = "Jan 12 to Jan 18, 2026";
const previousWeekLabel = "Jan 5 to Jan 11, 2026";
const nextWeekLabel = "Jan 19 to Jan 25, 2026";
// Accessible names are the deliberate interaction contract for the persisted 12.12 cutover fixtures.
const weekItemLabel =
  "Published, Gate attendant, 1 of 1 volunteers, Tue Jan 13, 7:30 AM - 10:30 AM";
const listItemLabel =
  "Site support week, Project window · Mon Jan 12 through Sat Jan 17, 0 of 0 helpers, General Volunteers";
const monthItemLabel =
  "Published, Room signage labels, 1 of 2 volunteers, Thu Jan 15, 10:00 AM - 12:00 PM";
const nextWeekItemLabel =
  "Published, Follow-up supplies, 1 of 1 volunteers, Tue Jan 20, 9:00 AM - 10:00 AM";

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
  volunteerIds: Array.from({ length: fixtureVolunteerCount }, () => randomUUID()),
  questionnaireIds: Array.from({ length: fixtureVolunteerCount }, () => randomUUID()),
  calendarItemIds: {
    gate: randomUUID(),
    siteWindow: randomUUID(),
    signage: randomUUID(),
    lunch: randomUUID(),
    coffee: randomUUID(),
    doorCheck: randomUUID(),
    supplyRun: randomUUID(),
    nextWeekSupplies: randomUUID(),
    quickViewSecurity: randomUUID(),
    quickViewDraft: randomUUID(),
    archiveDraft: randomUUID(),
    archiveAssigned: randomUUID(),
    archiveMobile: randomUUID(),
  },
  assignmentIds: {
    gate: randomUUID(),
    signage: randomUUID(),
    lunch: randomUUID(),
    coffee: randomUUID(),
    doorCheck: randomUUID(),
    supplyRun: randomUUID(),
    nextWeekSupplies: randomUUID(),
    archiveAssigned: randomUUID(),
    archiveMobile: randomUUID(),
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
          name: reviewVolunteerNames[index],
          email: `qa-12-12-volunteer-${index + 1}@example.invalid`,
          phone: "+1 555 120 1100",
          congregation: reviewCongregations[index % reviewCongregations.length],
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
    .map((id, index) => {
      const lifecycle = index === 53 ? "inactive" : index === 54 ? "archived" : index === 55 ? "inactive" : "active";
      const readiness = index === 52 || index === 55 ? "on_hold" : "ready";
      const email = index < 7 || index % 3 !== 0 ? `'qa-12-12-volunteer-${index + 1}@example.invalid'` : "null";
      const phone = index % 4 === 0 || index % 3 === 0 ? "'+1 555 120 1100'" : "null";
      const preferredContact = index % 3 === 0 ? "'Phone'" : "'Email'";
      return `('${id}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.questionnaireIds[index]}'::uuid, '${lifecycle}', '${readiness}', ${sqlText(reviewVolunteerNames[index])}, ${email}, ${phone}, ${sqlText(reviewCongregations[index % reviewCongregations.length])}, ${preferredContact}, '{}'::jsonb, '{}'::jsonb, ${sqlText(`Safe scheduling context ${index + 1}`)})`;
    })
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
    ...(archiveUiBrowserOnly
      ? [
          [fixture.assignmentIds.archiveAssigned, fixture.calendarItemIds.archiveAssigned, fixture.volunteerIds[0], "active"],
          [fixture.assignmentIds.archiveMobile, fixture.calendarItemIds.archiveMobile, fixture.volunteerIds[1], "active"],
        ]
      : []),
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
    ...(archiveUiBrowserOnly
      ? [
          [fixture.assignmentIds.archiveAssigned, "confirmed"],
          [fixture.assignmentIds.archiveMobile, "confirmed"],
        ]
      : []),
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
  ('${fixture.workspaceId}'::uuid, ${sqlText(`${fixture.namespace}-target`)}, ${sqlText(reviewWorkspaceName)}, 'active', 'America/Denver', '2026-01-01', '2026-04-04', false),
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
  ('${fixture.generalTaskPresetId}'::uuid, '${fixture.workspaceId}'::uuid, ${sqlText(reviewGeneralPresetName)}, null, 'general', 1, true, false, '[]'::jsonb, 'active'),
  ('${fixture.foodTaskPresetId}'::uuid, '${fixture.workspaceId}'::uuid, 'QA 12.12 Food', null, 'food', 1, true, false, '[]'::jsonb, 'active');
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
  schedule_kind, start_date, end_date, start_time, end_time, timezone,
  needed_count, schedule_notes, custom_values, lifecycle,
  follow_up_project_contact_id, created_by_project_contact_id, publication_state,
  published_at, published_by_project_contact_id
) values
  ('${fixture.calendarItemIds.gate}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Gate attendant', 'general', 'timed', '2026-01-13', null, '07:30:00', '10:30:00', 'America/Denver', 1, 'Safe gate note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.siteWindow}'::uuid, '${fixture.workspaceId}'::uuid, null, 'Site support week', 'general', 'multi_day_window', '2026-01-12', '2026-01-17', null, null, 'America/Denver', 0, 'Safe project window note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.signage}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Room signage labels', 'general', 'timed', '2026-01-15', null, '10:00:00', '12:00:00', 'America/Denver', 2, 'Safe signage note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.lunch}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.foodTaskPresetId}'::uuid, 'Lunch handoff', 'food', 'timed', '2026-01-14', null, '11:00:00', '12:00:00', 'America/Denver', 1, 'Safe lunch note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.coffee}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Coffee station', 'general', 'timed', '2026-01-14', null, '08:00:00', '09:00:00', 'America/Denver', 1, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.doorCheck}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Door check', 'general', 'timed', '2026-01-14', null, '09:00:00', '10:00:00', 'America/Denver', 1, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.supplyRun}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Supply run', 'general', 'timed', '2026-01-14', null, '13:00:00', '14:00:00', 'America/Denver', 1, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.nextWeekSupplies}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Follow-up supplies', 'general', 'timed', '2026-01-20', null, '09:00:00', '10:00:00', 'America/Denver', 1, 'Safe follow-up note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.otherCalendarItemId}'::uuid, '${fixture.otherWorkspaceId}'::uuid, null, 'QA 12.12 Wrong Workspace Hidden', 'general', 'timed', '2026-01-13', null, '07:30:00', '10:30:00', 'America/Denver', 1, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid)${archiveUiBrowserOnly ? `,
  ('${fixture.calendarItemIds.archiveDraft}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Archive review draft', 'general', 'timed', '2026-01-13', null, '14:30:00', '15:30:00', 'America/Denver', 1, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'draft', null, null),
  ('${fixture.calendarItemIds.archiveAssigned}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Archive review assigned', 'general', 'timed', '2026-01-13', null, '15:30:00', '16:30:00', 'America/Denver', 1, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.archiveMobile}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'Archive review mobile', 'general', 'timed', '2026-01-13', null, '16:30:00', '17:00:00', 'America/Denver', 1, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid)` : ""};
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values ${assignmentRows(fullUserId)};
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, responded_at, updated_by_auth_user_id
) values ${responseRows(fullUserId)};
${projectDayQuickViewOnly ? `
insert into public.project_days (
  workspace_id, project_date, expected_on_site_count,
  created_by_project_contact_id, updated_by_project_contact_id
)
values
  ('${fixture.workspaceId}'::uuid, '2026-01-13', 47, '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid),
  ('${fixture.workspaceId}'::uuid, '2026-01-20', 0, '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid);
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
  schedule_kind, start_date, end_date, start_time, end_time, timezone,
  needed_count, schedule_notes, custom_values, lifecycle,
  follow_up_project_contact_id, created_by_project_contact_id, publication_state,
  published_at, published_by_project_contact_id
) values
  ('${fixture.calendarItemIds.quickViewSecurity}'::uuid, '${fixture.workspaceId}'::uuid, null, 'Restricted security post alpha', 'security', 'timed', '2026-01-13', null, '11:00:00', '12:00:00', 'America/Denver', 2, 'Restricted security instructions', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.calendarItemIds.quickViewDraft}'::uuid, '${fixture.workspaceId}'::uuid, null, 'Private draft operations', 'general', 'timed', '2026-01-13', null, '12:00:00', '13:00:00', 'America/Denver', 9, 'Private draft note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'draft', null, null);` : ""}
commit;`);
}

async function cleanupFixtures(containerName) {
  const authUserDeletes = authUserIds
    .map((id) => `delete from auth.users where id = '${id}'::uuid;`)
    .join("\n");
  const residue = runPsql(containerName, `begin;
delete from public.assignment_responses where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.calendar_assignments where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.project_days where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
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
  return createPreviewUrl(baseUrl, "/admin/calendar?view=week&date=2026-01-13");
}

function bareCalendarUrl() {
  return createPreviewUrl(baseUrl, "/admin/calendar");
}

async function writeCalendarFlowCapture(page, filename, locator) {
  if (!writeCalendarFlowReviewScreenshots) return;
  if (
    writeAffectedCalendarFlowReviewScreenshots &&
    !affectedCalendarFlowCaptureNames.has(filename)
  ) {
    return;
  }
  await mkdir(iterationReviewDir, { recursive: true });
  const screenshotTarget = locator ?? page;
  await screenshotTarget.screenshot({
    path: path.join(iterationReviewDir, filename),
    ...(locator ? {} : { fullPage: false }),
  });
}

async function writeAssignmentPickerCapture(page, filename) {
  if (!writeAssignmentPickerReviewScreenshots) return;
  await mkdir(iterationReviewDir, { recursive: true });
  await page.screenshot({
    path: path.join(iterationReviewDir, filename),
    fullPage: false,
  });
}

async function writeProjectDayQuickViewCapture(page, filename) {
  if (!writeProjectDayQuickViewCaptures) return;
  await mkdir(iterationReviewDir, { recursive: true });
  await page.screenshot({
    path: path.join(iterationReviewDir, filename),
    fullPage: false,
  });
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

  if ((await button.getAttribute("aria-pressed")) === "true") {
    return;
  }

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
  await page.waitForTimeout(25);
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

async function assertMobileOverlayContract(
  page,
  dialog,
  scrollName,
  label,
  requireOverflow = true,
) {
  await page.waitForTimeout(250);
  const scrollLock = await page.evaluate(() => ({
      body: getComputedStyle(document.body).overflow,
      root: getComputedStyle(document.documentElement).overflow,
    }));
  assert(
    scrollLock.body === "hidden" && scrollLock.root === "hidden",
    `${label} does not lock background scrolling`,
  );
  const scroll = dialog.locator(`[data-overlay-scroll="${scrollName}"]`);
  assert((await scroll.count()) === 1, `${label} has no dedicated overlay scroll region`);
  if (requireOverflow) {
    assert(
      await scroll.evaluate((element) => element.scrollHeight > element.clientHeight),
      `${label} fixture does not exercise overflow content`,
    );
  }
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const closeAudit = await dialog.locator('button[aria-label^="Close "]:visible').first().evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        bottom: rect.bottom,
        innerHeight: window.innerHeight,
        reachable: rect.top >= 0 && rect.bottom <= window.innerHeight,
        top: rect.top,
      };
    });
  assert(
    closeAudit.reachable,
    `${label} close control is not reachable after internal scrolling (${JSON.stringify(closeAudit)})`,
  );
  await assertNoHorizontalOverflow(page, label);
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

async function assertDialogFocusContainment(page, dialog, label, expectedModal = true) {
  assert(
    (await dialog.getAttribute("aria-modal")) === String(expectedModal),
    `${label} should expose aria-modal=${expectedModal}`,
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
    await step("desktop bare Calendar defaults to current Month", async () => {
      const response = await page.goto(bareCalendarUrl(), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      assert(response?.ok(), `Bare Calendar returned ${response?.status() ?? "no response"}`);
      await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
      assert(
        (await page.getByRole("button", { name: "Month", exact: true }).getAttribute("aria-pressed")) === "true",
        "Bare Calendar did not default to Month view",
      );
      assert(
        !new URL(page.url()).searchParams.has("view") &&
          !new URL(page.url()).searchParams.has("date"),
        "Bare Calendar default unexpectedly rewrote explicit route context",
      );
      await writeCalendarFlowCapture(page, "01-desktop-month-current.png");
      await writeCalendarFlowCapture(
        page,
        "03-desktop-compact-navigation.png",
        page.getByTestId("calendar-workspace-header"),
      );
    });

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

    await step("Week/List navigation and compact Today/Project controls", async () => {
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
          page.getByRole("button", { name: "Go to project date", exact: true }),
          `${view} project-date button`,
        );
        assert(
          await reset.isEnabled(),
          `${view} project-date control should be enabled after navigation`,
        );
        await activateWithKeyboard(reset, `${view} project-date button`);
        await assertPeriod(page, projectWeekLabel);
      }

      const today = await assertUnique(
        page.getByRole("button", { name: "Go to today", exact: true }),
        "Today button",
      );
      await Promise.all([
        page.waitForURL((url) =>
          url.searchParams.get("view") === "week" &&
          url.searchParams.get("date") !== "2026-01-13",
        ),
        activateWithKeyboard(today, "Today button"),
      ]);
      assert(
        new URL(page.url()).searchParams.get("view") === "week" &&
          new URL(page.url()).searchParams.get("date") !== "2026-01-13",
        "Today did not preserve the active view while moving to the current local period",
      );
      await page.getByRole("button", { name: "Go to project date", exact: true }).click();
      await assertPeriod(page, projectWeekLabel);

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
      await writeCalendarFlowCapture(page, "05-create-preset-first.png");
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
      await page.getByText("1 item · Food", { exact: true }).waitFor();
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
      const inspector = page.locator('aside[aria-label="Calendar item inspector"]').first();
      const inspectorDescription = await assertDialogFocusContainment(
        page,
        inspector,
        "Desktop inspector",
        false,
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
        creationDescription.includes("Schedule a task preset or create a one-time item"),
        "Creation description lacks the source-selection context",
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
        (await taskPresetMode.getAttribute("aria-pressed")) === "true" &&
          (await customMode.getAttribute("aria-pressed")) === "false" &&
          !(await taskPresetMode.isDisabled()),
        "Creation task-source buttons should expose their selected state",
      );
      await planner.getByLabel("Task preset", { exact: true }).selectOption(fixture.generalTaskPresetId);
      await planner
        .getByRole("heading", { name: reviewGeneralPresetName, exact: true })
        .waitFor();
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
        planner.getByRole("button", { name: "Save & continue", exact: true }),
        "Save and continue persisted action",
      );
      assert(await scheduleButton.isEnabled(), "Save & continue should be enabled for valid timed creation");
      assert(
        Boolean(await scheduleButton.getAttribute("aria-describedby")),
        "Save & continue should describe its persisted action state",
      );
      await planner
        .getByText("This will save as a private draft.", { exact: true })
        .waitFor();
      assert(
        (await planner.getByRole("button", { name: /after save/i }).count()) === 0,
        "Creation still presents disabled post-save actions",
      );
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
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "07:30",
        "Month creation should default Start to 07:30",
      );
      assert(
        (await planner.getByLabel("End", { exact: true }).inputValue()) === "17:00",
        "Month creation should default End to 17:00",
      );
      await planner.getByLabel("Start", { exact: true }).scrollIntoViewIfNeeded();
      await writeCalendarFlowCapture(page, "06-create-default-times.png");
      await planner
        .getByRole("button", { name: "Save & continue", exact: true })
        .scrollIntoViewIfNeeded();
      await writeCalendarFlowCapture(page, "07-create-save-and-continue.png");
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
            "07:30" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) ===
            "17:00",
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
      const createdTitle = writeBetaReviewScreenshots
        ? "Material Staging Setup"
        : `QA persisted browser item ${fixture.namespace.slice(-8)}`;
      const updatedTitle = writeBetaReviewScreenshots
        ? "Material Staging"
        : `QA edited browser item ${fixture.namespace.slice(-8)}`;

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
      await planner.getByRole("button", { name: "Custom one-off", exact: true }).click();
      await planner.getByLabel("Custom task name", { exact: true }).fill(createdTitle);
      await planner.locator('input[type="number"]').first().fill("0");
      await planner
        .getByLabel("Schedule notes", { exact: true })
        .fill("Browser regression persisted create note.");
      await Promise.all([
        page.waitForURL(/notice=created/),
        planner.getByRole("button", { name: "Save & continue", exact: true }).click(),
      ]);
      await page.getByText("Calendar draft saved", { exact: true }).waitFor();
      const inspector = page.getByRole("dialog", {
        name: "Calendar item inspector",
        exact: true,
      });
      await inspector.waitFor();
      await inspector.getByText("Private draft", { exact: true }).waitFor();
      for (const stepLabel of [
        "STEP 1 · EVENT DETAILS",
        "STEP 2 · VOLUNTEERS",
        "STEP 3 · VISIBILITY",
        "STEP 4 · NOTIFICATION",
      ]) {
        await inspector.getByText(stepLabel, { exact: true }).waitFor();
      }
      assert(new URL(page.url()).searchParams.has("item"), "Created item was not retained in route context");
      await writeCalendarFlowCapture(page, "08-after-save-inspector.png");

      await page.reload();
      await inspector.waitFor();
      const oneOffEditForm = page
        .locator('form:visible')
        .filter({ hasText: "Edit scheduled item" })
        .first();
      assert(
        (await oneOffEditForm.getByLabel("Start", { exact: true }).inputValue()) === "15:00",
        "Persisted start time was not normalized for an unchanged edit submission",
      );
      assert(
        (await oneOffEditForm.getByLabel("End", { exact: true }).inputValue()) === "16:00",
        "Persisted end time was not normalized for an unchanged edit submission",
      );
      await oneOffEditForm.getByLabel("Task name", { exact: true }).fill(updatedTitle);
      await oneOffEditForm.locator("textarea").fill("Browser regression persisted edit note.");
      await Promise.all([
        page.waitForURL(/notice=updated/),
        oneOffEditForm.getByRole("button", { name: "Save item changes", exact: true }).click(),
      ]);
      await page.getByText("Calendar item updated", { exact: true }).waitFor();
      await inspector.waitFor();
      await inspector.getByRole("heading", { name: updatedTitle, exact: true }).first().waitFor();

      await page.reload();
      await page.getByRole("heading", { name: updatedTitle, exact: true }).first().waitFor();
      assert(
        (await page.getByText(createdTitle, { exact: true }).count()) === 0,
        "Reload after edit still displayed the stale created title",
      );
      await inspector.waitFor();
      await inspector.getByText("Private draft", { exact: true }).waitFor();
      await inspector.getByRole("button", { name: "Publish item", exact: true }).click();
      await inspector.getByText("Publish this Calendar item?", { exact: true }).waitFor();
      await Promise.all([
        page.waitForURL(/notice=published/),
        inspector.getByRole("button", { name: "Publish item", exact: true }).last().click(),
      ]);
      await page.getByText("Calendar item published", { exact: true }).waitFor();
      await inspector.waitFor();
      await inspector.getByText("Published", { exact: true }).waitFor();
      await writeCalendarFlowCapture(page, "10-after-publish-notification.png");
      await page.reload();
      await inspector.waitFor();
      await inspector.getByText("Published", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Close calendar item inspector", exact: true })
        .first()
        .click();
      assert(!new URL(page.url()).searchParams.has("item"), "Inspector X did not clear selection");

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
        planner.getByRole("button", { name: "Save & continue", exact: true }).click(),
      ]);
      await page.getByText("Calendar draft saved", { exact: true }).waitFor();
      await page.getByRole("heading", { name: reviewGeneralPresetName, exact: true }).first().waitFor();

      await page.reload();
      await page.getByRole("heading", { name: reviewGeneralPresetName, exact: true }).first().waitFor();
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
      await page.getByRole("button", { name: new RegExp(`${reviewGeneralPresetName}.*4:30 PM - 5:30 PM`) }).first().waitFor();
      await page
        .getByRole("button", { name: "Close calendar item inspector", exact: true })
        .first()
        .click();
      assert(
        !new URL(page.url()).searchParams.has("item"),
        "Explicit inspector close retained stale selected-item route context",
      );
    });

    await step("desktop assignment picker scales, preserves selection, and refreshes in place", async () => {
      await page.setViewportSize(desktopViewport);
      await page.goto(createPreviewUrl(baseUrl, "/admin/calendar?view=day&date=2026-01-13"), {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByRole("button", { name: /Gate attendant.*7:30 AM - 10:30 AM/ })
        .first()
        .click();
      const inspector = page.getByRole("dialog", {
        name: "Calendar item inspector",
        exact: true,
      });
      await inspector.waitFor();
      const candidateList = inspector.locator('[data-picker-scroll="volunteer-candidates"]');
      const candidateCheckboxes = candidateList.locator('input[type="checkbox"]');
      assert((await candidateCheckboxes.count()) === 51, "Picker should expose 51 ready, active, unassigned candidates.");
      assert((await inspector.getByLabel(`Select ${reviewVolunteerNames[0]}`, { exact: true }).count()) === 0, "Already-assigned volunteer appeared as a candidate.");
      for (const index of [52, 53, 54, 55]) {
        assert((await inspector.getByLabel(`Select ${reviewVolunteerNames[index]}`, { exact: true }).count()) === 0, "Ineligible volunteer appeared as assignable.");
      }
      const listDimensions = await candidateList.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }));
      assert(listDimensions.scrollHeight > listDimensions.clientHeight, "Large candidate list did not use intentional internal scrolling.");
      await inspector.getByLabel("Search ready volunteers", { exact: true }).focus();
      await writeAssignmentPickerCapture(page, "01-desktop-picker-default.png");

      const selectedIndexes = [20, 21, 22];
      for (const index of selectedIndexes) {
        await inspector.getByLabel(`Select ${reviewVolunteerNames[index]}`, { exact: true }).click();
      }
      await inspector.getByText("3 selected", { exact: true }).waitFor();
      await inspector.getByRole("button", { name: "Assign 3 volunteers", exact: true }).scrollIntoViewIfNeeded();
      await writeAssignmentPickerCapture(page, "02-desktop-picker-three-selected.png");

      const search = inspector.getByLabel("Search ready volunteers", { exact: true });
      await search.fill(reviewVolunteerNames[20]);
      assert((await candidateCheckboxes.count()) === 1, "Name search did not narrow to the intended volunteer.");
      assert((await inspector.getByLabel(`Select ${reviewVolunteerNames[20]}`, { exact: true }).count()) === 1, "Name search returned the wrong volunteer.");
      await search.fill(reviewCongregations[2]);
      assert((await candidateCheckboxes.count()) > 0, "Congregation search returned no candidates.");
      assert((await inspector.getByText("3 selected", { exact: true }).count()) === 1, "Search silently cleared hidden selections.");
      await writeAssignmentPickerCapture(page, "03-desktop-search-result.png");
      await search.fill("no volunteer can match this value");
      await inspector.getByText("No ready volunteers match the current search and filters.", { exact: true }).waitFor();
      await inspector.getByRole("button", { name: "Clear search and filters", exact: true }).click();

      await inspector.getByRole("button", { name: "Filters", exact: true }).click();
      await inspector.getByText("All congregations", { exact: true }).waitFor();
      await inspector.getByText("Congregation", { exact: true }).scrollIntoViewIfNeeded();
      await writeAssignmentPickerCapture(page, "04-desktop-filters-open.png");
      await inspector.getByRole("radio", { name: reviewCongregations[2], exact: true }).click();
      assert((await inspector.getByText("3 selected", { exact: true }).count()) === 1, "Filter silently cleared hidden selections.");
      await inspector.getByRole("button", { name: /Filters · 1/, exact: true }).click();
      await inspector.getByRole("button", { name: "Reset", exact: true }).click();

      await inspector.getByRole("button", { name: "Sort", exact: true }).click();
      await inspector.getByText("Name A–Z", { exact: true }).waitFor();
      await writeAssignmentPickerCapture(page, "05-desktop-sort-open.png");
      await inspector.getByRole("radio", { name: "Name Z–A", exact: true }).click();
      const expectedDescendingName = reviewVolunteerNames
        .slice(0, 52)
        .filter((_, index) => index !== 0)
        .sort((first, second) => second.localeCompare(first))[0];
      assert(
        (await candidateCheckboxes.first().getAttribute("aria-label")) === `Select ${expectedDescendingName}`,
        "Name Z–A did not produce deterministic descending order.",
      );
      await inspector.getByRole("radio", { name: "Congregation A–Z", exact: true }).click();
      assert((await inspector.getByText("3 selected", { exact: true }).count()) === 1, "Sort silently cleared selections.");
      await inspector.getByRole("button", { name: "Sort", exact: true }).click();

      await inspector
        .getByRole("button", { name: `View volunteer context for ${reviewVolunteerNames[20]}`, exact: true })
        .click();
      const context = inspector.locator("[data-volunteer-context]");
      await context.getByText(reviewVolunteerNames[20], { exact: true }).waitFor();
      assert((await context.getByText(reviewVolunteerNames[21], { exact: true }).count()) === 0, "Volunteer context showed the wrong person.");
      await writeAssignmentPickerCapture(page, "06-desktop-volunteer-context.png");
      await inspector.getByRole("button", { name: "Back to volunteers", exact: true }).click();
      assert(new URL(page.url()).searchParams.get("item") === fixture.calendarItemIds.gate, "Volunteer context lost the selected Calendar item.");

      await Promise.all([
        page.waitForURL(/notice=assigned/),
        inspector.getByRole("button", { name: "Assign 3 volunteers", exact: true }).click(),
      ]);
      await inspector.waitFor();
      await inspector.getByText("0 selected", { exact: true }).waitFor();
      for (const index of selectedIndexes) {
        await inspector.getByText(reviewVolunteerNames[index], { exact: true }).first().waitFor();
        assert((await inspector.getByLabel(`Select ${reviewVolunteerNames[index]}`, { exact: true }).count()) === 0, "New assignment remained in candidates.");
      }
      await inspector.getByText("4/1 filled", { exact: true }).waitFor();
      await writeAssignmentPickerCapture(page, "07-desktop-post-assignment.png");

      for (const index of selectedIndexes) {
        await Promise.all([
          page.waitForURL(/notice=assignment_canceled/),
          inspector.getByRole("button", { name: `Remove assignment for ${reviewVolunteerNames[index]}`, exact: true }).click(),
        ]);
        await inspector.waitFor();
        await inspector.getByLabel(`Select ${reviewVolunteerNames[index]}`, { exact: true }).waitFor();
        assert(new URL(page.url()).searchParams.get("item") === fixture.calendarItemIds.gate, "Removing an assignment closed the inspector.");
      }
      await inspector.getByRole("button", { name: "Close calendar item inspector", exact: true }).click();
      await page.waitForURL(/\/admin\/calendar\?view=day&date=2026-01-13$/);
    });

    await step("desktop persisted assignment create/cancel round trip", async () => {
      await selectView(page, "Day");
      await page.waitForURL(/\/admin\/calendar\?view=day&date=2026-01-13$/, {
        waitUntil: "load",
      });
      const assignmentTarget = page
        .getByRole("button", { name: /Gate attendant.*7:30 AM - 10:30 AM/ })
        .first();
      await assignmentTarget.click();
      await page.waitForURL((url) => url.searchParams.has("item"));
      const inspector = page.locator('aside[aria-label="Calendar item inspector"]').first();
      await inspector.waitFor();
      await inspector
        .getByLabel(`Select ${reviewVolunteerNames[1]}`, { exact: true })
        .click({ force: true });
      await inspector.locator('input[name="volunteerProfileIds"]').waitFor({
        state: "attached",
      });
      const submittedVolunteerIds = await inspector
        .locator('input[name="volunteerProfileIds"]')
        .evaluateAll((inputs) =>
          inputs.map((input) => input instanceof HTMLInputElement ? input.value : ""),
        );
      assert(
        submittedVolunteerIds.includes(fixture.volunteerIds[1]),
        "Selecting the volunteer did not update the assignment form submitted state.",
      );
      const assignSelectedButton = inspector.getByRole("button", {
        name: "Assign 1 volunteer",
        exact: true,
      });
      await expectButtonEnabled(page, assignSelectedButton, "Assign 1 volunteer");
      await Promise.all([
        page.waitForURL(/notice=(assigned|validation|error|unavailable)/),
        assignSelectedButton.click(),
      ]);
      assert(
        new URL(page.url()).searchParams.get("notice") === "assigned",
        `Assignment submit returned ${page.url()} instead of the persisted assigned notice.`,
      );
      await page.getByText("Volunteer assigned", { exact: true }).waitFor();
      await inspector.waitFor();
      await inspector.getByText(reviewVolunteerNames[1], { exact: true }).waitFor();
      await writeCalendarFlowCapture(page, "09-after-assignment-inspector.png");

      await page.reload();
      await inspector.waitFor();
      await inspector.getByText(reviewVolunteerNames[1], { exact: true }).waitFor();
      await inspector.getByText("Needs response", { exact: true }).waitFor();
      const assignmentDetailLink = inspector.getByRole("link", {
        name: `View assignment for ${reviewVolunteerNames[1]}`,
        exact: true,
      });
      await assignmentDetailLink.waitFor();
      if (writeAssignmentDetailReviewScreenshots) {
        await mkdir(betaReviewDir, { recursive: true });
        await page.screenshot({
          path: path.join(
            betaReviewDir,
            "calendar-assignment-drill-down-desktop-1440x1000.png",
          ),
          fullPage: false,
        });
      }
      await assignmentDetailLink.click();
      await page.waitForURL(/\/admin\/assignments\/[0-9a-f-]+$/);
      await page.getByRole("heading", { name: "Assignment", exact: true }).waitFor();
      await page.getByText(reviewVolunteerNames[1], { exact: true }).waitFor();
      await page.getByRole("link", { name: "Open scheduled day", exact: true }).click();
      await page.waitForURL(/\/admin\/calendar\?view=day&date=2026-01-13$/);
      const returnedAssignedItem = page
        .getByRole("button", { name: /Gate attendant.*7:30 AM - 10:30 AM/ })
        .first();
      await returnedAssignedItem.click();
      await page.waitForURL((url) => url.searchParams.has("item"));
      await inspector.waitFor();

      await Promise.all([
        page.waitForURL(/notice=assignment_canceled/),
        inspector
          .getByRole("button", { name: `Remove assignment for ${reviewVolunteerNames[1]}`, exact: true })
          .click(),
      ]);
      await page.getByText("Volunteer removed", { exact: true }).waitFor();
      await inspector.waitFor();
      await page.reload();
      await inspector.waitFor();
      assert(
        (await inspector.getByText("Needs response", { exact: true }).count()) === 0,
        "Canceled assignment response still appeared in the Calendar inspector after reload.",
      );
    });

    await step("desktop has no browser errors", async () => {
      assert(errors.length === 0, errors.join("\n"));
    });
    if (writeBetaReviewScreenshots) {
      await mkdir(betaReviewDir, { recursive: true });
      await selectView(page, "Week");
      const reviewItem = page.getByRole("button", { name: weekItemLabel, exact: true });
      await reviewItem.click();
      await page.getByRole("dialog", { name: "Calendar item inspector", exact: true }).waitFor();
      await page.screenshot({
        path: path.join(betaReviewDir, "calendar-desktop.png"),
        fullPage: true,
      });
    }
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
    await step("mobile bare Calendar defaults to current Month", async () => {
      const response = await page.goto(bareCalendarUrl(), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      assert(response?.ok(), `Bare mobile Calendar returned ${response?.status() ?? "no response"}`);
      await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
      assert(
        (await page.getByRole("button", { name: "Month", exact: true }).getAttribute("aria-pressed")) === "true",
        "Bare mobile Calendar did not default to Month view",
      );
      await writeCalendarFlowCapture(page, "02-mobile-month-current.png");
      await writeCalendarFlowCapture(
        page,
        "04-mobile-compact-navigation.png",
        page.getByTestId("calendar-workspace-header"),
      );
    });

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
      await assertMobileOverlayContract(page, more, "mobile-more", "Mobile More", false);
      const moreDescription = await assertDialogFocusContainment(
        page,
        more,
        "Mobile More",
      );
      assert(
        moreDescription.includes("Additional beta admin destinations"),
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
      assert(
        (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== "hidden",
        "Mobile More did not restore page scrolling",
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
      await assertMobileOverlayContract(
        page,
        dialog,
        "calendar-filters",
        "Mobile calendar filters",
        false,
      );
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile filters should not stack with More or another dialog",
      );
      await closeWithEscape(page, "Calendar filters", "Open calendar filters");
      await assertClosedSurfaceInert(page, "Close calendar filters");
      assert(
        (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== "hidden",
        "Mobile filters did not restore page scrolling",
      );
    });

    await step("mobile item opens the inspector sheet alone", async () => {
      const trigger = page.getByRole("button", { name: weekItemLabel, exact: true });
      await activateWithKeyboard(trigger, "Mobile Week event button");
      const inspector = page.getByRole("dialog", {
        name: "Calendar item inspector",
        exact: true,
      });
      await inspector.waitFor();
      await waitForFocusLabel(page, "Close calendar item inspector");
      await assertMobileOverlayContract(
        page,
        inspector,
        "calendar-inspector",
        "Mobile Calendar inspector",
      );
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
      if (writeIterationReviewScreenshots) {
        await mkdir(iterationReviewDir, { recursive: true });
        await page.screenshot({
          path: path.join(iterationReviewDir, "calendar-create-top.png"),
          fullPage: false,
        });
      }
      await assertMobileOverlayContract(
        page,
        planner,
        "calendar-create",
        "Mobile Calendar create",
      );
      if (writeIterationReviewScreenshots) {
        await page.screenshot({
          path: path.join(iterationReviewDir, "calendar-create-scrolled.png"),
          fullPage: false,
        });
      }
      assert(
        (await visibleCalendarSurfaceCount(page)) === 1,
        "Mobile creation should be the only active surface",
      );
      await planner.getByText("Suggested from calendar day", { exact: true }).waitFor();
      await closeWithEscape(page, "Plan project work", triggerLabel);
    });

    await step("mobile assignment picker remains usable at scale without overlay traps", async () => {
      await page.setViewportSize(mobileViewport);
      await page.goto(createPreviewUrl(baseUrl, "/admin/calendar?view=day&date=2026-01-13"), {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByRole("button", { name: /Gate attendant.*7:30 AM - 10:30 AM/ })
        .first()
        .click();
      const inspector = page.locator('[role="dialog"][aria-label="Calendar item inspector"]:visible');
      await inspector.waitFor();
      const volunteerSection = inspector.locator('[data-inspector-section="volunteers"]');
      await volunteerSection.scrollIntoViewIfNeeded();
      const candidateList = inspector.locator('[data-picker-scroll="volunteer-candidates"]');
      assert((await candidateList.locator('input[type="checkbox"]').count()) === 51, "Mobile picker candidate truth differed from desktop.");
      await assertNoHorizontalOverflow(page, "Mobile picker default");
      await writeAssignmentPickerCapture(page, "08-mobile-picker-default.png");

      await candidateList.evaluate((element) => {
        element.scrollTop = Math.floor(element.scrollHeight * 0.55);
      });
      assert((await candidateList.evaluate((element) => element.scrollTop)) > 0, "Mobile long list did not scroll internally.");
      await writeAssignmentPickerCapture(page, "09-mobile-long-list-scrolled.png");

      await inspector.getByRole("button", { name: "Filters", exact: true }).click();
      const filters = page.getByRole("dialog", { name: "Volunteer filters", exact: true });
      await filters.waitFor();
      await writeAssignmentPickerCapture(page, "10-mobile-filters.png");
      await filters.getByRole("radio", { name: reviewCongregations[2], exact: true }).click();
      await filters.getByRole("button", { name: "Close Volunteer filters", exact: true }).click();
      await inspector.getByRole("button", { name: /Filters · 1/, exact: true }).waitFor();

      await inspector
        .getByRole("button", { name: `View volunteer context for ${reviewVolunteerNames[2]}`, exact: true })
        .click();
      const profile = page.getByRole("dialog", {
        name: `Volunteer context for ${reviewVolunteerNames[2]}`,
        exact: true,
      });
      await profile.waitFor();
      await profile.getByText(reviewVolunteerNames[2], { exact: true }).waitFor();
      assert((await profile.getByText(reviewVolunteerNames[3], { exact: true }).count()) === 0, "Mobile context showed the wrong volunteer.");
      await writeAssignmentPickerCapture(page, "11-mobile-volunteer-context.png");
      await profile.getByRole("button", { name: `Close Volunteer context for ${reviewVolunteerNames[2]}`, exact: true }).click();
      assert(new URL(page.url()).searchParams.get("item") === fixture.calendarItemIds.gate, "Closing mobile context lost the Calendar item.");
      await inspector.getByRole("button", { name: "Reset", exact: true }).click();

      const selectedIndexes = [23, 24, 25];
      for (const index of selectedIndexes) {
        await inspector.getByLabel(`Select ${reviewVolunteerNames[index]}`, { exact: true }).click();
      }
      await inspector.getByText("3 selected", { exact: true }).waitFor();
      const assignButton = inspector.getByRole("button", { name: "Assign 3 volunteers", exact: true });
      await assignButton.scrollIntoViewIfNeeded();
      await assertNoHorizontalOverflow(page, "Mobile picker multi-select");
      await writeAssignmentPickerCapture(page, "12-mobile-multi-select.png");
      await Promise.all([page.waitForURL(/notice=assigned/), assignButton.click()]);
      await inspector.waitFor();
      await inspector.getByText("0 selected", { exact: true }).waitFor();
      await inspector.locator('[data-inspector-section="volunteers"]').scrollIntoViewIfNeeded();
      await inspector.getByText("4/1 filled", { exact: true }).waitFor();
      await writeAssignmentPickerCapture(page, "13-mobile-post-assignment.png");

      await page.setViewportSize({ width: 360, height: 800 });
      await assertNoHorizontalOverflow(page, "Narrow mobile picker");
      await inspector.getByRole("button", { name: "Sort", exact: true }).click();
      const sortSheet = page.getByRole("dialog", { name: "Volunteer sort", exact: true });
      await sortSheet.waitFor();
      await sortSheet.getByRole("radio", { name: "Name Z–A", exact: true }).click();
      await sortSheet.getByRole("button", { name: "Close Volunteer sort", exact: true }).click();
      assert(await inspector.isVisible(), "Closing the nested mobile sort sheet closed the Calendar inspector.");

      for (const index of selectedIndexes) {
        await Promise.all([
          page.waitForURL(/notice=assignment_canceled/),
          inspector.getByRole("button", { name: `Remove assignment for ${reviewVolunteerNames[index]}`, exact: true }).click(),
        ]);
        await inspector.waitFor();
        await inspector.getByLabel(`Select ${reviewVolunteerNames[index]}`, { exact: true }).waitFor();
      }
      await inspector.getByRole("button", { name: "Close calendar item inspector", exact: true }).click();
      assert((await page.evaluate(() => getComputedStyle(document.body).overflow)) !== "hidden", "Mobile picker close left the background locked.");
      await page.setViewportSize(mobileViewport);
    });

    await step("mobile assignment drill-down affordance is usable", async () => {
      await page.goto(createPreviewUrl(baseUrl, "/admin/calendar?view=day&date=2026-01-13"), {
        waitUntil: "domcontentloaded",
      });
      const assignedItem = page
        .getByRole("button", { name: /Gate attendant.*7:30 AM - 10:30 AM/ })
        .first();
      await assignedItem.click();
      const inspector = page.getByRole("dialog", {
        name: "Calendar item inspector",
        exact: true,
      });
      await inspector.waitFor();
      await inspector.getByRole("link", { name: /View assignment for/ }).first().waitFor();
      if (writeAssignmentDetailReviewScreenshots) {
        await mkdir(betaReviewDir, { recursive: true });
        await page.screenshot({
          path: path.join(
            betaReviewDir,
            "calendar-assignment-drill-down-mobile-390x844.png",
          ),
          fullPage: false,
        });
      }
    });

    await step("mobile save, assign, and publish preserve the inspector", async () => {
      await page.goto(createPreviewUrl(baseUrl, "/admin/calendar?view=day&date=2026-01-13"), {
        waitUntil: "domcontentloaded",
      });
      await page.getByRole("button", { name: "Create", exact: true }).click();
      const planner = page.getByRole("dialog", { name: "Plan project work", exact: true });
      await planner.waitFor();
      assert(
        (await planner.getByRole("button", { name: "Task preset", exact: true }).getAttribute("aria-pressed")) === "true",
        "Mobile creation did not start preset-first",
      );
      assert(
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "07:30" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) === "17:00",
        "Mobile toolbar creation did not use the 7:30 AM-5:00 PM default",
      );
      await planner.locator('input[type="number"]').first().fill("1");
      await Promise.all([
        page.waitForURL(/notice=created/),
        planner.getByRole("button", { name: "Save & continue", exact: true }).click(),
      ]);
      const inspector = page.locator('section[aria-label="Calendar item inspector"]');
      await inspector.waitFor();
      await inspector.getByText("Private draft", { exact: true }).waitFor();
      const mobileClose = inspector.getByRole("button", {
        name: "Close calendar item inspector",
        exact: true,
      });
      const afterSaveCloseBox = await mobileClose.boundingBox();
      assert(
        afterSaveCloseBox && afterSaveCloseBox.y >= 0 && afterSaveCloseBox.y < mobileViewport.height,
        "Mobile inspector close control was not reachable after save",
      );
      await assertNoHorizontalOverflow(page, "Mobile after-save inspector");
      await writeCalendarFlowCapture(page, "11-mobile-after-save-inspector.png");

      const volunteerChoice = inspector.locator('input[type="checkbox"]').first();
      await volunteerChoice.click();
      assert(await volunteerChoice.isChecked(), "Mobile volunteer choice did not stay selected");
      const assignButton = inspector.getByRole("button", { name: "Assign 1 volunteer", exact: true });
      await expectButtonEnabled(page, assignButton, "Mobile Assign 1 volunteer");
      await Promise.all([
        page.waitForURL(/notice=assigned/),
        assignButton.click(),
      ]);
      await inspector.waitFor();
      await inspector.getByText("Needs response", { exact: true }).waitFor();
      const afterAssignmentCloseBox = await mobileClose.boundingBox();
      assert(
        afterAssignmentCloseBox &&
          afterAssignmentCloseBox.y >= 0 &&
          afterAssignmentCloseBox.y < mobileViewport.height,
        `Mobile inspector close control was not reachable after assignment: ${JSON.stringify(afterAssignmentCloseBox)}`,
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await writeCalendarFlowCapture(page, "12-mobile-post-assignment-inspector.png");

      await inspector.getByRole("button", { name: "Publish item", exact: true }).click();
      await inspector.getByText("Publish this Calendar item?", { exact: true }).waitFor();
      await Promise.all([
        page.waitForURL(/notice=published/),
        inspector.getByRole("button", { name: "Publish item", exact: true }).last().click(),
      ]);
      await inspector.waitFor();
      await inspector.getByText("Published", { exact: true }).waitFor();
      await assertNoHorizontalOverflow(page, "Mobile post-publish inspector");
      await mobileClose.click();
      assert(
        !new URL(page.url()).searchParams.has("item"),
        "Mobile explicit inspector close retained selected-item context",
      );
      assert(
        (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== "hidden",
        "Mobile explicit inspector close left background scrolling locked",
      );
    });

    await step("narrow mobile keeps the primary scheduling path usable", async () => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(createPreviewUrl(baseUrl, "/admin/calendar"), {
        waitUntil: "domcontentloaded",
      });
      await page.getByRole("button", { name: "Month", exact: true }).waitFor();
      await assertNoHorizontalOverflow(page, "Narrow mobile Calendar");

      await page.getByRole("button", { name: "Create", exact: true }).click();
      const planner = page.getByRole("dialog", { name: "Plan project work", exact: true });
      await planner.waitFor();
      assert(
        (await planner.getByRole("button", { name: "Task preset", exact: true }).getAttribute("aria-pressed")) === "true",
        "Narrow mobile creation did not start preset-first",
      );
      assert(
        (await planner.getByLabel("Start", { exact: true }).inputValue()) === "07:30" &&
          (await planner.getByLabel("End", { exact: true }).inputValue()) === "17:00",
        "Narrow mobile creation did not retain the 7:30 AM-5:00 PM default",
      );
      await assertNoHorizontalOverflow(page, "Narrow mobile planner");
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => getComputedStyle(document.body).overflow !== "hidden",
      );
      assert(
        (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== "hidden",
        "Narrow mobile planner close left background scrolling locked",
      );
    });

    await step("mobile has no overflow or browser errors", async () => {
      await assertNoHorizontalOverflow(page, "Mobile Calendar after interactions");
      assert(errors.length === 0, errors.join("\n"));
    });
    if (writeBetaReviewScreenshots) {
      await mkdir(betaReviewDir, { recursive: true });
      await page.screenshot({
        path: path.join(betaReviewDir, "calendar-mobile.png"),
        fullPage: true,
      });
    }
  } finally {
    await context.close();
  }
}

function projectDayCalendarUrl(date) {
  return createPreviewUrl(
    baseUrl,
    `/admin/calendar?view=month&date=2026-01-13&day=${date}`,
  );
}

function quickViewUrl(date = "2026-01-13", project = `${fixture.namespace}-target`) {
  return createPreviewUrl(
    baseUrl,
    `/admin/quick-view?project=${encodeURIComponent(project)}&date=${date}`,
  );
}

async function waitForProjectDaySave(page) {
  await page.getByRole("button", { name: "Save expected count", exact: true }).waitFor();
  assert(
    !(await page.getByRole("button", { name: "Save expected count", exact: true }).isDisabled()),
    "Project Day save did not settle.",
  );
}

async function runProjectDayQuickViewDesktop(browser, containerName) {
  const context = await browser.newContext({ viewport: desktopViewport });
  await applyAuthCookies(context, "full");
  const page = await context.newPage();
  const errors = watchPageErrors(page);
  const step = createStepRunner("project-day-quick-view desktop", page);
  page.setDefaultTimeout(10_000);

  try {
    await step("Calendar date affordance opens unknown Project Day", async () => {
      await page.goto(calendarUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByRole("button", { name: "Month", exact: true }).click();
      await page.getByRole("button", { name: "Open day details for Fri Jan 16", exact: true }).click();
      await page.getByRole("complementary", { name: "Project day details", exact: true }).waitFor();
      await page.waitForURL((url) => url.searchParams.get("day") === "2026-01-16");
      assert(new URL(page.url()).searchParams.get("day") === "2026-01-16", "Calendar did not preserve the selected Project Day in route context.");
      assert((await page.getByLabel("Expected on site", { exact: true }).inputValue()) === "", "Unknown Project Day should render a blank input.");
      await writeProjectDayQuickViewCapture(page, "01-desktop-calendar-project-day-entry.png");
    });

    await step("Project Day set, update, zero, and clear persist without event changes", async () => {
      const input = page.getByLabel("Expected on site", { exact: true });
      const save = page.getByRole("button", { name: "Save expected count", exact: true });
      for (const [value, expectedSql] of [["31", "31"], ["52", "52"], ["0", "0"]]) {
        await input.fill(value);
        await save.click();
        await waitForProjectDaySave(page);
        assert(
          runPsql(containerName, `select coalesce(expected_on_site_count::text, 'null') from public.project_days where workspace_id = '${fixture.workspaceId}'::uuid and project_date = '2026-01-16';`) === expectedSql,
          `Project Day value ${value} did not persist.`,
        );
      }
      await input.fill("");
      await save.click();
      await waitForProjectDaySave(page);
      assert(
        runPsql(containerName, `select coalesce(expected_on_site_count::text, 'null') from public.project_days where workspace_id = '${fixture.workspaceId}'::uuid and project_date = '2026-01-16';`) === "null",
        "Clearing Project Day did not persist null.",
      );
      assert(
        runPsql(containerName, `select count(*) from public.calendar_items where workspace_id = '${fixture.workspaceId}'::uuid and id in ('${fixture.calendarItemIds.gate}'::uuid, '${fixture.calendarItemIds.siteWindow}'::uuid);`) === "2",
        "Project Day edits changed Calendar event truth.",
      );
      assert(new URL(page.url()).searchParams.get("day") === "2026-01-16", "Project Day save lost Calendar day context.");
    });

    await step("Project Day validation remains local and humane", async () => {
      const input = page.getByLabel("Expected on site", { exact: true });
      for (const value of ["-1", "1.5", "four"]) {
        await input.fill(value);
        await page.getByRole("button", { name: "Save expected count", exact: true }).click();
        await page.getByText("Enter a whole number of zero or more.", { exact: true }).waitFor();
      }
      assert(
        runPsql(containerName, `select coalesce(expected_on_site_count::text, 'null') from public.project_days where workspace_id = '${fixture.workspaceId}'::uuid and project_date = '2026-01-16';`) === "null",
        "Invalid Project Day input mutated persistence.",
      );
    });

    await step("existing Project Day count renders in Calendar", async () => {
      await page.goto(projectDayCalendarUrl("2026-01-13"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByRole("complementary", { name: "Project day details", exact: true }).waitFor();
      assert((await page.getByLabel("Expected on site", { exact: true }).inputValue()) === "47", "Existing Project Day value did not render.");
      await writeProjectDayQuickViewCapture(page, "03-desktop-calendar-existing-headcount.png");
    });

    await step("Quick View selected project uses only safe published projection", async () => {
      await page.goto(quickViewUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByRole("heading", { name: "Project Quick View", exact: true }).waitFor();
      const body = await page.locator("body").innerText();
      for (const forbidden of [
        "Restricted security post alpha",
        "Restricted security instructions",
        "Private draft operations",
        "Private draft note",
        "QA 12.12 Other Workspace",
        "qa-12-12-volunteer",
        fixture.workspaceId,
        fixture.calendarItemIds.gate,
      ]) assert(!body.includes(forbidden), `Quick View leaked ${forbidden}.`);
      assert(body.includes("47 people"), "Quick View did not show expected-on-site count.");
      assert(body.includes("Gate attendant"), "Quick View did not show safe published schedule.");
      assert(body.includes("Site support week"), "Quick View did not show safe published multi-day work.");
      await writeProjectDayQuickViewCapture(page, "05-desktop-quick-view-selected-project.png");
    });

    await step("Quick View project search exposes only authorized projects", async () => {
      const search = page.getByLabel("Find a project", { exact: true });
      await search.fill("QA 12.12 Other Workspace");
      await page.getByText("No authorized projects match.", { exact: true }).waitFor();
      assert((await page.getByRole("link", { name: "QA 12.12 Other Workspace", exact: true }).count()) === 0, "Unauthorized project appeared in search.");
      await writeProjectDayQuickViewCapture(page, "06-desktop-quick-view-project-search.png");
      await search.fill("");
    });

    await step("Quick View day navigation preserves zero and null distinctly", async () => {
      await page.goto(quickViewUrl("2026-01-20"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByText("0 people", { exact: true }).waitFor();
      await writeProjectDayQuickViewCapture(page, "07-desktop-quick-view-another-date.png");
      await page.goto(quickViewUrl("2026-01-16"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByText("Not set", { exact: true }).waitFor();
      await writeProjectDayQuickViewCapture(page, "08-desktop-quick-view-unknown-headcount.png");
      const previous = page.getByRole("link", { name: "Previous day", exact: true });
      const next = page.getByRole("link", { name: "Next day", exact: true });
      assert(new URL(await previous.getAttribute("href"), baseUrl).searchParams.get("date") === "2026-01-15", "Previous day target is wrong.");
      assert(new URL(await next.getAttribute("href"), baseUrl).searchParams.get("date") === "2026-01-17", "Next day target is wrong.");
      await page.getByLabel("Project date", { exact: true }).fill("2026-01-13");
      await page.getByRole("button", { name: "Go", exact: true }).click();
      await page.getByText("47 people", { exact: true }).waitFor();
    });

    await step("project key guessing and anonymous access fail closed", async () => {
      await page.goto(quickViewUrl("2026-01-13", `${fixture.namespace}-other`), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByText("Quick View unavailable", { exact: true }).waitFor();
      const anonymousContext = await browser.newContext({ viewport: desktopViewport });
      try {
        const anonymousPage = await anonymousContext.newPage();
        await anonymousPage.goto(quickViewUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
        await anonymousPage.getByText("Quick View unavailable", { exact: true }).waitFor();
      } finally {
        await anonymousContext.close();
      }
    });

    await step("desktop Quick View has no browser errors", async () => {
      assert(errors.length === 0, errors.join("\n"));
    });
  } finally {
    await context.close();
  }
}

async function runProjectDayQuickViewMobile(browser) {
  const context = await browser.newContext({ viewport: mobileViewport });
  await applyAuthCookies(context, "full");
  const page = await context.newPage();
  const errors = watchPageErrors(page);
  const step = createStepRunner("project-day-quick-view mobile", page);
  page.setDefaultTimeout(10_000);

  try {
    await step("mobile Calendar Project Day uses shared overlay", async () => {
      await page.goto(projectDayCalendarUrl("2026-01-16"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      const dialog = page.getByRole("dialog", { name: "project day details", exact: true });
      await dialog.waitFor();
      await assertNoHorizontalOverflow(page, "Mobile Project Day");
      await writeProjectDayQuickViewCapture(page, "02-mobile-calendar-project-day-entry.png");
      await page.getByRole("button", { name: "Close project day details", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });

      await page.goto(projectDayCalendarUrl("2026-01-13"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByRole("dialog", { name: "project day details", exact: true }).waitFor();
      assert((await page.getByLabel("Expected on site", { exact: true }).inputValue()) === "47", "Mobile existing Project Day count is wrong.");
      await writeProjectDayQuickViewCapture(page, "04-mobile-calendar-existing-headcount.png");
    });

    await step("mobile Quick View is compact and navigable", async () => {
      await page.goto(quickViewUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByRole("heading", { name: "Project Quick View", exact: true }).waitFor();
      await assertNoHorizontalOverflow(page, "Mobile Quick View");
      await writeProjectDayQuickViewCapture(page, "09-mobile-quick-view.png");
      const search = page.getByLabel("Find a project", { exact: true });
      await search.fill("Other Workspace");
      await page.getByText("No authorized projects match.", { exact: true }).waitFor();
      await search.blur();
      await page.evaluate(() => window.scrollTo(0, 0));
      await writeProjectDayQuickViewCapture(page, "10-mobile-quick-view-project-search.png");
    });

    await step("mobile another date and populated schedule remain readable", async () => {
      await page.goto(quickViewUrl("2026-01-20"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByText("0 people", { exact: true }).waitFor();
      await writeProjectDayQuickViewCapture(page, "11-mobile-quick-view-another-date.png");
      await page.goto(quickViewUrl("2026-01-13"), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByText("Gate attendant", { exact: true }).waitFor();
      await writeProjectDayQuickViewCapture(page, "12-mobile-quick-view-populated-schedule.png");
    });

    await step("mobile More includes Quick View without another nav paradigm", async () => {
      await page.getByRole("button", { name: "Open more admin navigation", exact: true }).click();
      const link = page.getByRole("link", { name: "Project Quick View", exact: true });
      await link.waitFor();
      assert((await link.getAttribute("aria-current")) === "page", "Mobile More does not mark Quick View active.");
      await page.getByRole("button", { name: "Close more admin navigation", exact: true }).click();
    });

    await step("360px Quick View has no overflow", async () => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(quickViewUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
      await assertNoHorizontalOverflow(page, "360px Quick View");
      await writeProjectDayQuickViewCapture(page, "13-narrow-360-quick-view.png");
    });

    await step("mobile Quick View has no browser errors", async () => {
      assert(errors.length === 0, errors.join("\n"));
    });
  } finally {
    await context.close();
  }
}

async function writeArchiveUiCapture(page, filename) {
  if (archiveUiCaptureNames.size > 0 && !archiveUiCaptureNames.has(filename)) {
    return;
  }
  await mkdir(archiveUiReviewDir, { recursive: true });
  await page.screenshot({
    path: path.join(archiveUiReviewDir, filename),
    fullPage: false,
  });
}

async function scrollArchiveLifecycleIntoView(page) {
  const lifecycle = page.locator('[data-inspector-section="lifecycle"]:visible');
  const scroller = page.locator('[data-overlay-scroll="calendar-inspector"]:visible');
  await lifecycle.waitFor();
  const offset = await lifecycle.evaluate((element) => element.offsetTop);
  await scroller.evaluate((element, targetOffset) => {
    element.scrollTop = Math.max(0, targetOffset - 40);
  }, offset);
  await lifecycle.waitFor();
}

async function selectArchiveFixture(page, title) {
  const item = page.getByRole("button", { name: new RegExp(title, "i") });
  await item.waitFor();
  await item.click();
  await page.getByRole("dialog", { name: "Calendar item inspector", exact: true }).waitFor();
}

async function openArchiveConfirmation(page) {
  await page.getByRole("button", { name: "Archive item", exact: true }).click();
  await page.getByText("Archive this calendar item?", { exact: true }).waitFor();
}

async function confirmArchive(page, title) {
  await page.getByRole("button", { name: "Archive item", exact: true }).last().click();
  await page.waitForURL((url) => url.searchParams.get("notice") === "archived");
  await page.getByText("Calendar item archived", { exact: true }).waitFor();
  assert(
    !new URL(page.url()).searchParams.has("item"),
    `${title} archive retained a stale selected item route parameter.`,
  );
  assert(
    (await page.getByRole("button", { name: new RegExp(title, "i") }).count()) === 0,
    `${title} remained in the active Calendar after archive.`,
  );
}

async function runArchiveUiBrowser(browser, containerName) {
  const desktopContext = await browser.newContext({ viewport: desktopViewport });
  const mobileContext = await browser.newContext({ viewport: mobileViewport });
  await applyAuthCookies(desktopContext, "full");
  await applyAuthCookies(mobileContext, "full");
  const desktop = await desktopContext.newPage();
  const mobile = await mobileContext.newPage();
  const errors = [...watchPageErrors(desktop), ...watchPageErrors(mobile)];
  desktop.setDefaultTimeout(10_000);
  mobile.setDefaultTimeout(10_000);

  try {
    await desktop.goto(calendarUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await desktop.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
    await writeArchiveUiCapture(desktop, "01-desktop-beta-sidebar.png");
    await writeArchiveUiCapture(desktop, "03-desktop-current-project-card.png");

    await desktop.goto(createPreviewUrl(baseUrl, "/admin/projects"), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await desktop.getByText("This area isn't available in the beta yet.", { exact: true }).waitFor();
    await writeArchiveUiCapture(desktop, "04-contained-prototype-route.png");

    await desktop.goto(calendarUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await selectView(desktop, "Week");
    await selectArchiveFixture(desktop, "Archive review draft");
    await scrollArchiveLifecycleIntoView(desktop);
    await writeArchiveUiCapture(desktop, "05-desktop-calendar-archive-action.png");
    await openArchiveConfirmation(desktop);
    await scrollArchiveLifecycleIntoView(desktop);
    await writeArchiveUiCapture(desktop, "06-desktop-archive-confirmation-draft.png");
    await desktop.getByRole("button", { name: "Keep item", exact: true }).click();
    await desktop.getByText("Archive this calendar item?", { exact: true }).waitFor({ state: "hidden" });
    assert((await desktop.getByRole("button", { name: /Archive review draft/i }).count()) === 1, "Draft Cancel did not preserve the active Calendar item.");
    await openArchiveConfirmation(desktop);
    await confirmArchive(desktop, "Archive review draft");
    await writeArchiveUiCapture(desktop, "08-desktop-calendar-after-archive.png");

    await selectArchiveFixture(desktop, "Archive review assigned");
    await openArchiveConfirmation(desktop);
    await desktop.getByText("This does not notify assigned volunteers.", { exact: true }).waitFor();
    await scrollArchiveLifecycleIntoView(desktop);
    await writeArchiveUiCapture(desktop, "07-desktop-archive-confirmation-assigned.png");
    await confirmArchive(desktop, "Archive review assigned");

    const archiveTruth = runPsql(containerName, `select
      (select lifecycle from public.calendar_items where id = '${fixture.calendarItemIds.archiveDraft}'::uuid),
      (select lifecycle from public.calendar_items where id = '${fixture.calendarItemIds.archiveAssigned}'::uuid),
      (select count(*) from public.calendar_assignments where id = '${fixture.assignmentIds.archiveAssigned}'::uuid),
      (select count(*) from public.assignment_responses where assignment_id = '${fixture.assignmentIds.archiveAssigned}'::uuid);`);
    assert(archiveTruth === "archived|archived|1|1", `Archive did not preserve lifecycle history: ${archiveTruth}`);

    await desktop.goto(quickViewUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    const quickViewText = await desktop.locator("body").innerText();
    assert(!quickViewText.includes("Archive review assigned"), "Archived assigned item appeared in admin Quick View.");
    assert(!quickViewText.includes("Archive review draft"), "Archived draft item appeared in admin Quick View.");

    await desktop.goto(createPreviewUrl(baseUrl, "/admin/volunteers"), { waitUntil: "domcontentloaded", timeout: 30_000 });
    const desktopInactiveVolunteer = desktop.getByText("QA 12.12 Volunteer 54", { exact: true });
    await desktopInactiveVolunteer.scrollIntoViewIfNeeded();
    await desktopInactiveVolunteer.waitFor();
    await writeArchiveUiCapture(desktop, "12-desktop-volunteer-inactive.png");

    await mobile.goto(calendarUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await mobile.getByRole("button", { name: "Open more admin navigation", exact: true }).click();
    await writeArchiveUiCapture(mobile, "02-mobile-more.png");
    await mobile.getByRole("button", { name: "Close more admin navigation", exact: true }).click();
    await selectView(mobile, "Week");
    await selectArchiveFixture(mobile, "Archive review mobile");
    await scrollArchiveLifecycleIntoView(mobile);
    await writeArchiveUiCapture(mobile, "09-mobile-archive-action.png");
    await openArchiveConfirmation(mobile);
    await mobile.getByText("This does not notify assigned volunteers.", { exact: true }).waitFor();
    await scrollArchiveLifecycleIntoView(mobile);
    await writeArchiveUiCapture(mobile, "10-mobile-archive-confirmation.png");
    await mobile.setViewportSize({ width: 360, height: 800 });
    await assertNoHorizontalOverflow(mobile, "360px Archive confirmation");
    await mobile.setViewportSize(mobileViewport);
    await confirmArchive(mobile, "Archive review mobile");
    await writeArchiveUiCapture(mobile, "11-mobile-calendar-after-archive.png");
    await assertNoHorizontalOverflow(mobile, "390px Archive Calendar");

    await mobile.setViewportSize({ width: 360, height: 800 });
    await mobile.goto(createPreviewUrl(baseUrl, "/admin/volunteers"), { waitUntil: "domcontentloaded", timeout: 30_000 });
    const mobileInactiveVolunteer = mobile.getByText("QA 12.12 Volunteer 54", { exact: true });
    await mobileInactiveVolunteer.scrollIntoViewIfNeeded();
    await mobileInactiveVolunteer.waitFor();
    await assertNoHorizontalOverflow(mobile, "360px inactive Volunteer view");
    await writeArchiveUiCapture(mobile, "13-mobile-volunteer-inactive.png");
    await mobile.goto(calendarUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await assertNoHorizontalOverflow(mobile, "360px Archive Calendar");

    assert(errors.length === 0, errors.join("\n"));
  } finally {
    await desktopContext.close();
    await mobileContext.close();
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
        .waitFor({ timeout: 15_000 });
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
    if (archiveUiBrowserOnly) {
      await runArchiveUiBrowser(browser, containerName);
    } else if (projectDayQuickViewOnly) {
      await runProjectDayQuickViewDesktop(browser, containerName);
      await runProjectDayQuickViewMobile(browser);
    } else {
      await runUnavailable(browser);
      await runDesktop(browser);
      await runMobile(browser);
    }
  } finally {
    await browser?.close();
    await cleanupFixtures(containerName);
  }
  assert(cleanupCompleted, "Calendar route browser fixture cleanup did not complete.");

  console.log(
    archiveUiBrowserOnly
      ? "Dedicated Calendar Archive UI browser regression passed."
      : projectDayQuickViewOnly
      ? "Project Day and Quick View browser regression passed."
      : "Calendar interaction regression passed.",
  );
}

main().catch((error) => {
  console.error(`\nCalendar interaction regression failed.\n${redact(errorMessage(error))}`);
  process.exitCode = 1;
});
