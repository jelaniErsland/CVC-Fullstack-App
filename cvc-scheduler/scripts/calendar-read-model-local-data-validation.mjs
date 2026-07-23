import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  buildCalendarReadModelQueryShape,
  calendarReadModelExplicitlyBlocked,
  calendarReadModelForbiddenOutputFields,
  describeCalendarReadModelHelper,
  filterAndSortCalendarReadModelItems,
  mapCalendarReadModelItem,
} from "../lib/calendar/readModel.server.ts";
import { describeCalendarPersistedReadModelContract } from "../lib/calendar/readModelContract.server.ts";
import {
  describeCalendarReadModelQueryHelper,
  readCalendarReadModelWithClient,
} from "../lib/calendar/readModelQuery.server.ts";
import {
  describeCalendarRouteCutoverDryRun,
  runCalendarRouteCutoverDryRun,
} from "../lib/calendar/routeCutoverDryRun.server.ts";
import { describeMvpRealDataCutoverPlan } from "../lib/readiness/mvpRealDataCutoverPlan.server.ts";
import { describeResponseLinkProductActionActivationCheckpoint } from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();

const targetVolunteerIds = Array.from({ length: 7 }, () => randomUUID());
const targetQuestionnaireIds = Array.from({ length: 7 }, () => randomUUID());

const fixture = {
  namespace: `qa-12-5-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  fullContactId: randomUUID(),
  calendarOnlyContactId: randomUUID(),
  assignmentsOnlyContactId: randomUUID(),
  roleOnlyContactId: randomUUID(),
  fullGrantId: randomUUID(),
  calendarOnlyGrantId: randomUUID(),
  assignmentsOnlyGrantId: randomUUID(),
  roleOnlyGrantId: randomUUID(),
  generalTaskPresetId: randomUUID(),
  foodTaskPresetId: randomUUID(),
  timedCalendarItemId: randomUUID(),
  dateBasedCalendarItemId: randomUUID(),
  multiDayCalendarItemId: randomUUID(),
  milestoneCalendarItemId: randomUUID(),
  oneOffCalendarItemId: randomUUID(),
  otherWorkspaceCalendarItemId: randomUUID(),
  targetVolunteerIds,
  targetQuestionnaireIds,
  otherQuestionnaireId: randomUUID(),
  otherVolunteerId: randomUUID(),
  assignments: {
    needsResponse: randomUUID(),
    confirmedOne: randomUUID(),
    confirmedTwo: randomUUID(),
    confirmedThree: randomUUID(),
    declined: randomUUID(),
    canceled: randomUUID(),
    wrongItem: randomUUID(),
    dateConfirmedOne: randomUUID(),
    dateConfirmedTwo: randomUUID(),
    otherWorkspace: randomUUID(),
  },
};

const authUserIds = [];
const clients = [];
let cleanupCompleted = false;

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
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]");
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
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
    throw new Error("The local Calendar read-model fixture command failed.");
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

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

async function resolveLocalDatabaseContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define a local project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
  assert(
    result.status === 0 && result.stdout.trim() === "true",
    "Local Supabase is unavailable. Start Docker Desktop and local Supabase before running this local-only validation.",
  );
  return containerName;
}

async function verifyStaticBoundaries() {
  const helperSource = await readFile(path.join(root, "lib", "calendar", "readModel.server.ts"), "utf8");
  const queryHelperSource = await readFile(
    path.join(root, "lib", "calendar", "readModelQuery.server.ts"),
    "utf8",
  );
  const dryRunSource = await readFile(
    path.join(root, "lib", "calendar", "routeCutoverDryRun.server.ts"),
    "utf8",
  );
  const calendarRouteSource = await readFile(
    path.join(root, "app", "admin", "calendar", "page.tsx"),
    "utf8",
  );
  const packageSource = await readFile(path.join(root, "package.json"), "utf8");
  const currentStateSource = await readFile(path.join(root, "docs", "CURRENT_STATE.md"), "utf8");
  const roadmapSource = await readFile(path.join(root, "docs", "ROADMAP.md"), "utf8");
  const calendarReadinessSource = await readFile(
    path.join(root, "docs", "CALENDAR_DATA_MODEL_READINESS.md"),
    "utf8",
  );
  const authReadinessSource = await readFile(
    path.join(root, "docs", "SUPABASE_AUTH_PERSISTENCE_READINESS.md"),
    "utf8",
  );
  const localSetupSource = await readFile(
    path.join(root, "docs", "SUPABASE_LOCAL_SETUP.md"),
    "utf8",
  );
  const projectHistorySource = await readFile(
    path.join(root, "docs", "PROJECT_HISTORY.md"),
    "utf8",
  );

  assert.match(helperSource, /^import "server-only";/);
  assert(
    !/createServerSupabaseClient|createBrowserSupabaseClient|\.from\(|\.rpc\(|createServiceRole|SUPABASE_SERVICE_ROLE_KEY|responseTokens|productAction|readAssignmentDetail|assignments\/detailContext|mockData/i.test(
      helperSource,
    ),
    "Calendar read model helper imported or executed a forbidden live/query/action path.",
  );
  assert.match(queryHelperSource, /^import "server-only";/);
  assert.doesNotMatch(
    queryHelperSource,
    /createClient|createServerSupabaseClient|createBrowserSupabaseClient|lib\/supabase\/server|cookies\(|from\s+["']app\/|createServiceRole|SUPABASE_SERVICE_ROLE_KEY|serviceRoleClient|serviceRolePath/i,
  );
  assert.doesNotMatch(queryHelperSource, /\.select\(\s*["']\*["']\s*\)/);
  assert.match(dryRunSource, /^import "server-only";/);
  assert.doesNotMatch(
    dryRunSource,
    /createClient|createServerSupabaseClient|createBrowserSupabaseClient|lib\/supabase\/server|cookies\(|from\s+["']app\/|createServiceRole|SUPABASE_SERVICE_ROLE_KEY|serviceRoleClient|serviceRolePath|\.from\(|\.rpc\(/i,
  );

  const appAndComponentFiles = [];
  for (const directory of ["app", "components"]) {
    appAndComponentFiles.push(
      ...(await collectFiles(path.join(root, directory))).filter((file) =>
        /\.(?:ts|tsx)$/.test(file),
      ),
    );
  }

  const helperImporters = [];
  const validationImporters = [];
  const persistedCalendarRouteImporters = [];
  const assignmentDetailLinks = [];
  for (const file of appAndComponentFiles) {
    const relative = path.relative(root, file).replaceAll("\\", "/");
    const source = await readFile(file, "utf8");
    if (
      source.includes("readModel.server") ||
      source.includes("readModelQuery.server") ||
      source.includes("routeCutoverDryRun.server") ||
      source.includes("buildCalendarReadModelQueryShape") ||
      source.includes("readCalendarReadModelWithClient") ||
      source.includes("runCalendarRouteCutoverDryRun") ||
      source.includes("mapCalendarReadModelItem") ||
      source.includes("filterAndSortCalendarReadModelItems")
    ) {
      helperImporters.push(relative);
    }
    if (source.includes("calendar-read-model-local-data-validation")) {
      validationImporters.push(relative);
    }
    if (
      /@\/lib\/calendar\/server|@\/lib\/calendar\/readModel|routeCutoverDryRun|readCurrentContactCalendarItems|readCalendarItemsWithClient|readCalendarReadModelWithClient|runCalendarRouteCutoverDryRun|calendar_items|calendar_assignments|assignment_responses/i.test(
        source,
      )
    ) {
      persistedCalendarRouteImporters.push(relative);
    }
    if (
      relative !== "app/admin/assignments/[assignmentId]/page.tsx" &&
      source.includes("/admin/assignments/")
    ) {
      assignmentDetailLinks.push(relative);
    }
  }

  assert.deepEqual(helperImporters, []);
  assert.deepEqual(validationImporters, []);
  assert.deepEqual(
    persistedCalendarRouteImporters,
    ["app/admin/calendar/page.tsx"],
    "Only the reviewed Calendar route may import the narrow Calendar mutation boundary",
  );
  assert.deepEqual(assignmentDetailLinks, []);
  assert.match(calendarRouteSource, /@\/lib\/calendar\/routeRead\.server/);
  assert.doesNotMatch(
    calendarRouteSource,
    /@\/lib\/calendar\/readModel|readCurrentContactCalendarItems|readCalendarItemsWithClient|readCalendarReadModelWithClient|calendar_items|calendar_assignments|assignment_responses|getCalendarItemsByWeek/i,
  );

  const helperReadiness = describeCalendarReadModelHelper();
  assert.equal(helperReadiness.routeCutoverAvailable, false);
  assert.equal(helperReadiness.mockToRealMixingAllowed, false);
  assert.equal(helperReadiness.persistedWriteAvailable, false);
  assert.equal(helperReadiness.assignmentPickerCutoverAvailable, false);
  assert.equal(helperReadiness.assignmentDetailLinkingAvailable, false);
  assert.equal(helperReadiness.responseLinkActivationReopened, false);
  assert.equal(helperReadiness.serviceRoleReadAvailable, false);
  assert.equal(helperReadiness.seedDataAvailable, false);

  const queryHelperReadiness = describeCalendarReadModelQueryHelper();
  assert.equal(queryHelperReadiness.queryHelperAvailable, true);
  assert.equal(queryHelperReadiness.routeUnused, true);
  assert.equal(queryHelperReadiness.dependencyInjected, true);
  assert.equal(queryHelperReadiness.serviceRoleAvailable, false);
  assert.equal(queryHelperReadiness.routeCutoverAvailable, false);
  assert.equal(queryHelperReadiness.mockToRealMixingAllowed, false);
  assert.equal(queryHelperReadiness.persistedWriteAvailable, false);
  assert.equal(queryHelperReadiness.assignmentPickerCutoverAvailable, false);
  assert.equal(queryHelperReadiness.assignmentDetailLinkingAvailable, false);
  assert.equal(queryHelperReadiness.responseLinkActivationReopened, false);
  assert.equal(queryHelperReadiness.seedDataAvailable, false);
  assert.equal(queryHelperReadiness.hostedQueryValidationAvailable, false);

  const dryRunReadiness = describeCalendarRouteCutoverDryRun();
  assert.equal(dryRunReadiness.dryRunAvailable, true);
  assert.equal(dryRunReadiness.routePersistedReadCutoverImplemented, false);
  assert.equal(dryRunReadiness.routeImportsReadModelQueryHelper, false);
  assert.equal(dryRunReadiness.routeUsesDryRunHarness, false);
  assert.equal(dryRunReadiness.mockToRealMixingAllowed, false);
  assert.equal(dryRunReadiness.persistedWriteAvailable, false);
  assert.equal(dryRunReadiness.assignmentPickerCutoverAvailable, false);
  assert.equal(dryRunReadiness.assignmentDetailLinkingAvailable, false);
  assert.equal(dryRunReadiness.responseLinkActivationReopened, false);
  assert.equal(dryRunReadiness.serviceRoleReadAvailable, false);
  assert.equal(dryRunReadiness.seedDataAvailable, false);
  assert.equal(dryRunReadiness.hostedCutoverValidationAvailable, false);

  const contract = describeCalendarPersistedReadModelContract();
  assert.equal(contract.routeCutoverAvailable, false);
  assert.deepEqual(contract.contract.capabilityContract.assignmentDerivedCoverageCountsRequire, [
    "calendar.view",
    "assignments.view",
  ]);

  const cutoverPlan = describeMvpRealDataCutoverPlan();
  assert.equal(cutoverPlan.planAvailable, true);
  assert.equal(cutoverPlan.calendarRoutePersistedReadCutoverAvailable, false);
  assert.equal(cutoverPlan.responseLinkActivationReopened, false);

  const activation = describeResponseLinkProductActionActivationCheckpoint();
  assert.equal(activation.checkpointAvailable, true);
  assert.equal(activation.activeRevealAvailable, false);
  assert.equal(activation.activeCopyAvailable, false);

  assert.match(
    packageSource,
    /"test:calendar-read-model:local": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/calendar-read-model-local-data-validation\.mjs"/,
  );
  assert.match(packageSource, /"test:calendar-read-model-query-helper"/);
  assert.match(packageSource, /"test:calendar-route-cutover-dry-run"/);
  assert.match(currentStateSource, /Iteration 12\.8/);
  assert.match(roadmapSource, /12\.9 Calendar Route Cutover Final Preflight/);
  assert.match(calendarReadinessSource, /12\.5 Route-Unused Calendar Read Model Disposable Local Data Validation/);
  assert.match(calendarReadinessSource, /12\.6 Route-Unused Calendar Read Model Query-Helper Readiness/);
  assert.match(calendarReadinessSource, /12\.8 Calendar Route Cutover Dry-Run Harness/);
  assert.match(authReadinessSource, /12\.8 Calendar route cutover dry-run harness/i);
  assert.match(localSetupSource, /test:calendar-read-model:local/);
  assert.match(localSetupSource, /test:calendar-read-model-query-helper/);
  assert.match(localSetupSource, /test:calendar-route-cutover-dry-run/);
  assert.match(projectHistorySource, /Iteration 12\.8 - Calendar Route Cutover Dry-Run Harness/);
  assert.match(localSetupSource, /Do not print raw Supabase CLI\/status\/start output/);
  assert.match(localSetupSource, /Redirect Supabase start\/status output to a temporary file/);
  assert.match(localSetupSource, /Redact key-like values before displaying diagnostics/);
}

async function verifyLocalPreflight() {
  assert(
    supabaseUrl && anonKey,
    "Local public Supabase environment values are missing. Configure loopback NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then start local Supabase.",
  );
  assert(
    isLoopbackUrl(supabaseUrl),
    "Calendar read-model local validation accepts only loopback local Supabase URLs.",
  );
  secrets.add(anonKey);
  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");
}

async function createAuthenticatedClient(label) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const email = `${fixture.namespace}-${label}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, `Disposable ${label} Auth creation failed.`);
  authUserIds.push(signup.data.user.id);
  if (!signup.data.session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Disposable ${label} sign-in failed.`);
    secrets.add(signin.data.session.access_token);
    secrets.add(signin.data.session.refresh_token);
  } else {
    secrets.add(signup.data.session.access_token);
    secrets.add(signup.data.session.refresh_token);
  }
  clients.push(client);
  return client;
}

function questionnaireAnswers(index) {
  return {
    aboutYou: {
      name: `QA 12.5 Volunteer ${index}`,
      email: `${fixture.namespace}-volunteer-${index}@example.invalid`,
      phone: `+1 555 012 50${index}`,
      congregation: "QA 12.5 Congregation",
    },
    availability: { weekdays: ["Monday"] },
    skillsExperience: { categories: ["General"] },
    emergencyContact: { name: "QA 12.5 Private Contact", phone: "+1 555 012 5999" },
    otherWaysToHelp: {},
  };
}

function questionnaireRows() {
  const targetRows = fixture.targetQuestionnaireIds.map(
    (questionnaireId, index) =>
      `('${questionnaireId}'::uuid, '${fixture.workspaceId}'::uuid, 'submitted', 'admin_entry', 1, ${sqlJson(questionnaireAnswers(index + 1))})`,
  );
  const otherRows = [
    `('${fixture.otherQuestionnaireId}'::uuid, '${fixture.otherWorkspaceId}'::uuid, 'submitted', 'admin_entry', 1, ${sqlJson(questionnaireAnswers(99))})`,
  ];
  return [...targetRows, ...otherRows].join(",\n");
}

function volunteerRows() {
  const targetRows = fixture.targetVolunteerIds.map((volunteerId, index) => {
    const answers = questionnaireAnswers(index + 1);
    return `(
      '${volunteerId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.targetQuestionnaireIds[index]}'::uuid,
      'active', 'ready', ${sqlText(answers.aboutYou.name)}, ${sqlText(answers.aboutYou.email)},
      ${sqlText(answers.aboutYou.phone)}, ${sqlText(answers.aboutYou.congregation)}, 'Email',
      ${sqlJson(answers.availability)}, ${sqlJson({ skillsExperience: answers.skillsExperience })}, ''
    )`;
  });
  const otherAnswers = questionnaireAnswers(99);
  const otherRow = `(
    '${fixture.otherVolunteerId}'::uuid, '${fixture.otherWorkspaceId}'::uuid, '${fixture.otherQuestionnaireId}'::uuid,
    'active', 'ready', ${sqlText(otherAnswers.aboutYou.name)}, ${sqlText(otherAnswers.aboutYou.email)},
    ${sqlText(otherAnswers.aboutYou.phone)}, ${sqlText(otherAnswers.aboutYou.congregation)}, 'Email',
    ${sqlJson(otherAnswers.availability)}, ${sqlJson({ skillsExperience: otherAnswers.skillsExperience })}, ''
  )`;
  return [...targetRows, otherRow].join(",\n");
}

function responseValues(rows) {
  return rows
    .map(([assignmentId, status]) => {
      const responseId = randomUUID();
      const respondedAt = status === "needs_response" ? "null" : "now()";
      return `('${responseId}'::uuid, '${fixture.workspaceId}'::uuid, '${assignmentId}'::uuid, '${status}', 'project_contact', ${respondedAt}, '${authUserIds[0]}'::uuid)`;
    })
    .join(",\n");
}

async function createFixtures(containerName) {
  const fullClient = await createAuthenticatedClient("full-contact");
  const calendarOnlyClient = await createAuthenticatedClient("calendar-only");
  const assignmentsOnlyClient = await createAuthenticatedClient("assignments-only");
  const roleOnlyClient = await createAuthenticatedClient("role-only");

  runPsql(containerName, `begin;
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  ('${fixture.workspaceId}'::uuid, ${sqlText(`${fixture.namespace}-target`)}, 'QA 12.5 Calendar Workspace', 'active', 'America/Denver', '2031-02-01', '2031-02-28', false),
  ('${fixture.otherWorkspaceId}'::uuid, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.5 Other Workspace', 'active', 'America/Denver', '2031-02-01', '2031-02-28', false);
insert into public.project_contacts (id, auth_user_id, status)
values
  ('${fixture.fullContactId}'::uuid, '${authUserIds[0]}'::uuid, 'active'),
  ('${fixture.calendarOnlyContactId}'::uuid, '${authUserIds[1]}'::uuid, 'active'),
  ('${fixture.assignmentsOnlyContactId}'::uuid, '${authUserIds[2]}'::uuid, 'active'),
  ('${fixture.roleOnlyContactId}'::uuid, '${authUserIds[3]}'::uuid, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status)
values
  ('${fixture.fullGrantId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.fullContactId}'::uuid, 'main_contact', array['workspace.read', 'calendar.view', 'assignments.view']::text[], 'active'),
  ('${fixture.calendarOnlyGrantId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.calendarOnlyContactId}'::uuid, 'main_contact', array['workspace.read', 'calendar.view']::text[], 'active'),
  ('${fixture.assignmentsOnlyGrantId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.assignmentsOnlyContactId}'::uuid, 'main_contact', array['workspace.read', 'assignments.view']::text[], 'active'),
  ('${fixture.roleOnlyGrantId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.roleOnlyContactId}'::uuid, 'main_contact', array['workspace.read']::text[], 'active');
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
  ('${fixture.generalTaskPresetId}'::uuid, '${fixture.workspaceId}'::uuid, 'QA 12.5 Gate Crew', null, 'general', 6, true, false, '[]'::jsonb, 'active'),
  ('${fixture.foodTaskPresetId}'::uuid, '${fixture.workspaceId}'::uuid, 'QA 12.5 Breakfast Service', null, 'food', 2, true, false, '[]'::jsonb, 'active');
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
  schedule_kind, start_date, end_date, start_time, end_time, timezone,
  needed_count, schedule_notes, custom_values, lifecycle, follow_up_project_contact_id,
  created_by_project_contact_id, publication_state, published_at, published_by_project_contact_id
) values
  ('${fixture.timedCalendarItemId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.generalTaskPresetId}'::uuid, 'QA 12.5 Gate Crew', 'general', 'timed', '2031-02-03', null, '07:30:00', '10:30:00', 'America/Denver', 6, 'Safe schedule note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.dateBasedCalendarItemId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.foodTaskPresetId}'::uuid, 'QA 12.5 Breakfast Service', 'food', 'date_based', '2031-02-04', null, null, null, 'America/Denver', 2, 'Safe food note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.multiDayCalendarItemId}'::uuid, '${fixture.workspaceId}'::uuid, null, 'QA 12.5 Site Window', 'general', 'multi_day_window', '2031-02-05', '2031-02-08', null, null, 'America/Denver', 0, 'Safe project window note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.milestoneCalendarItemId}'::uuid, '${fixture.workspaceId}'::uuid, null, 'QA 12.5 Inspection Milestone', 'custom', 'milestone', '2031-02-09', null, null, null, 'America/Denver', 0, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.oneOffCalendarItemId}'::uuid, '${fixture.workspaceId}'::uuid, null, 'QA 12.5 One-Off Labels', 'security', 'timed', '2031-02-10', null, '11:00:00', '12:00:00', 'America/Denver', 1, 'Safe one-off note', '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid),
  ('${fixture.otherWorkspaceCalendarItemId}'::uuid, '${fixture.otherWorkspaceId}'::uuid, null, 'QA 12.5 Other Workspace Item', 'general', 'timed', '2031-02-03', null, '07:30:00', '10:30:00', 'America/Denver', 1, null, '{}'::jsonb, 'active', '${fixture.fullContactId}'::uuid, '${fixture.fullContactId}'::uuid, 'published', now(), '${fixture.fullContactId}'::uuid);
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values
  ('${fixture.assignments.needsResponse}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.timedCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[0]}'::uuid, 'active', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.confirmedOne}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.timedCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[1]}'::uuid, 'active', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.confirmedTwo}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.timedCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[2]}'::uuid, 'active', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.confirmedThree}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.timedCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[3]}'::uuid, 'active', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.declined}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.timedCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[4]}'::uuid, 'active', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.canceled}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.timedCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[5]}'::uuid, 'canceled', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.wrongItem}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.oneOffCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[6]}'::uuid, 'active', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.dateConfirmedOne}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.dateBasedCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[0]}'::uuid, 'active', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.dateConfirmedTwo}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.dateBasedCalendarItemId}'::uuid, '${fixture.targetVolunteerIds[1]}'::uuid, 'active', null, '${authUserIds[0]}'::uuid),
  ('${fixture.assignments.otherWorkspace}'::uuid, '${fixture.otherWorkspaceId}'::uuid, '${fixture.otherWorkspaceCalendarItemId}'::uuid, '${fixture.otherVolunteerId}'::uuid, 'active', null, '${authUserIds[0]}'::uuid);
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, responded_at, updated_by_auth_user_id
) values
${responseValues([
  [fixture.assignments.needsResponse, "needs_response"],
  [fixture.assignments.confirmedOne, "confirmed"],
  [fixture.assignments.confirmedTwo, "confirmed"],
  [fixture.assignments.confirmedThree, "confirmed"],
  [fixture.assignments.declined, "declined"],
  [fixture.assignments.canceled, "confirmed"],
  [fixture.assignments.wrongItem, "confirmed"],
  [fixture.assignments.dateConfirmedOne, "confirmed"],
  [fixture.assignments.dateConfirmedTwo, "confirmed"],
])},
  ('${randomUUID()}'::uuid, '${fixture.otherWorkspaceId}'::uuid, '${fixture.assignments.otherWorkspace}'::uuid, 'confirmed', 'project_contact', now(), '${authUserIds[0]}'::uuid);
commit;`);

  return { fullClient, calendarOnlyClient, assignmentsOnlyClient, roleOnlyClient };
}

async function readCapabilities(client, expectedGrantId) {
  const result = await client
    .from("workspace_contact_grants")
    .select("id, role, capabilities")
    .eq("id", expectedGrantId)
    .maybeSingle();
  assert(!result.error && result.data, "Authenticated grant capability read failed.");
  return result.data;
}

function toReadModelItemRow(row, taskPresetById) {
  const preset = row.task_preset_id ? taskPresetById.get(row.task_preset_id) : null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    titleSnapshot: row.title_snapshot,
    taskTypeSnapshot: row.task_type_snapshot,
    scheduleKind: row.schedule_kind,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    neededCount: row.needed_count,
    lifecycle: row.lifecycle,
    publicationState: row.publication_state,
    createdByProjectContactId: row.created_by_project_contact_id,
    publishedAt: row.published_at,
    scheduleNotes: row.schedule_notes,
    taskPresetId: row.task_preset_id,
    oneOffTaskLabel: row.task_preset_id ? null : row.title_snapshot,
    oneOffTaskType: row.task_preset_id ? null : row.task_type_snapshot,
    taskPresetLabel: preset?.name ?? null,
    taskPresetType: preset?.task_type ?? null,
  };
}

function toCoverageRows(assignments, responses) {
  const responseByAssignment = new Map(
    responses.map((response) => [response.assignment_id, response.response_status]),
  );
  return assignments.map((assignment) => ({
    assignmentId: assignment.id,
    workspaceId: assignment.workspace_id,
    calendarItemId: assignment.calendar_item_id,
    assignmentLifecycle: assignment.lifecycle,
    currentResponseStatus: responseByAssignment.get(assignment.id) ?? "needs_response",
  }));
}

function assertCredentialFree(value, label, namespace) {
  const text = JSON.stringify(value);
  for (const forbidden of [
    `${namespace}-volunteer`,
    "emergency",
    "questionnaire",
    "responseUrl",
    "redactedResponseUrl",
    "bearer",
    "verifier",
    "token",
    "audit",
    "access_token",
    "refresh_token",
    "password",
    "api_key",
    "service_role",
    "capabilities",
    "SQLSTATE",
    "stack",
    "exception",
    "provider",
  ]) {
    assert.equal(text.includes(forbidden), false, `${label} exposed unsafe marker ${forbidden}`);
  }
}

async function verifyLiveRows(containerName, clientsForFixture) {
  const { fullClient, calendarOnlyClient, assignmentsOnlyClient, roleOnlyClient } =
    clientsForFixture;

  const fullGrant = await readCapabilities(fullClient, fixture.fullGrantId);
  assert.deepEqual(fullGrant.capabilities.sort(), [
    "assignments.view",
    "calendar.view",
    "workspace.read",
  ]);
  const fullShape = buildCalendarReadModelQueryShape({
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.fullContactId,
    rangeStart: "2031-02-01",
    rangeEnd: "2031-02-28",
    workspaceTimezone: "America/Denver",
    periodKind: "month",
    capabilities: fullGrant.capabilities,
  });
  assert.equal(fullShape.ok, true, "Full capability contact should pass query-shape validation.");

  const calendarOnlyGrant = await readCapabilities(calendarOnlyClient, fixture.calendarOnlyGrantId);
  assert.deepEqual(
    buildCalendarReadModelQueryShape({
      workspaceId: fixture.workspaceId,
      actorContactId: fixture.calendarOnlyContactId,
      rangeStart: "2031-02-01",
      rangeEnd: "2031-02-28",
      workspaceTimezone: "America/Denver",
      periodKind: "month",
      capabilities: calendarOnlyGrant.capabilities,
    }),
    { ok: false, reason: "missing_assignments_view_for_coverage" },
  );

  const assignmentsOnlyGrant = await readCapabilities(
    assignmentsOnlyClient,
    fixture.assignmentsOnlyGrantId,
  );
  assert.deepEqual(
    buildCalendarReadModelQueryShape({
      workspaceId: fixture.workspaceId,
      actorContactId: fixture.assignmentsOnlyContactId,
      rangeStart: "2031-02-01",
      rangeEnd: "2031-02-28",
      workspaceTimezone: "America/Denver",
      periodKind: "month",
      capabilities: assignmentsOnlyGrant.capabilities,
    }),
    { ok: false, reason: "missing_calendar_view" },
  );

  const roleOnlyGrant = await readCapabilities(roleOnlyClient, fixture.roleOnlyGrantId);
  assert.equal(roleOnlyGrant.role, "main_contact");
  assert.deepEqual(
    buildCalendarReadModelQueryShape({
      workspaceId: fixture.workspaceId,
      actorContactId: fixture.roleOnlyContactId,
      rangeStart: "2031-02-01",
      rangeEnd: "2031-02-28",
      workspaceTimezone: "America/Denver",
      periodKind: "month",
      capabilities: [],
      role: roleOnlyGrant.role,
    }),
    { ok: false, reason: "missing_calendar_view" },
  );

  const itemRead = await fullClient
    .from("calendar_items")
    .select("*")
    .eq("workspace_id", fixture.workspaceId)
    .order("start_date", { ascending: true });
  assert(!itemRead.error && itemRead.data.length === 5, "Full contact could not read Calendar item rows.");
  const assignmentRead = await fullClient
    .from("calendar_assignments")
    .select("*")
    .eq("workspace_id", fixture.workspaceId);
  assert(
    !assignmentRead.error && assignmentRead.data.length === 9,
    "Full contact could not read assignment rows.",
  );
  const responseRead = await fullClient
    .from("assignment_responses")
    .select("*")
    .eq("workspace_id", fixture.workspaceId);
  assert(
    !responseRead.error && responseRead.data.length === 9,
    "Full contact could not read current response rows.",
  );

  const calendarOnlyAssignments = await calendarOnlyClient
    .from("calendar_assignments")
    .select("id")
    .eq("workspace_id", fixture.workspaceId);
  assert(
    !calendarOnlyAssignments.error && calendarOnlyAssignments.data.length === 0,
    "calendar.view-only contact saw assignment rows.",
  );
  const assignmentsOnlyItems = await assignmentsOnlyClient
    .from("calendar_items")
    .select("id")
    .eq("workspace_id", fixture.workspaceId);
  assert(
    !assignmentsOnlyItems.error && assignmentsOnlyItems.data.length === 0,
    "assignments.view-only contact saw Calendar item shells.",
  );

  const taskPresetRows = queryJson(
    containerName,
    `select id, workspace_id, name, task_type from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid order by name`,
  );
  assert.equal(taskPresetRows.length, 2, "Persisted task preset rows were unavailable.");
  const taskPresetById = new Map(taskPresetRows.map((preset) => [preset.id, preset]));

  const allAssignmentRows = queryJson(
    containerName,
    `select * from public.calendar_assignments where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid) order by created_at, id`,
  );
  const allResponseRows = queryJson(
    containerName,
    `select * from public.assignment_responses where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid) order by created_at, id`,
  );
  const coverageRows = toCoverageRows(allAssignmentRows, allResponseRows);

  const mappedItems = itemRead.data.map((row) =>
    mapCalendarReadModelItem(toReadModelItemRow(row, taskPresetById), coverageRows),
  );
  const timedItem = mappedItems.find((item) => item.calendarItemId === fixture.timedCalendarItemId);
  assert(timedItem, "Timed Calendar read-model item was not projected.");
  assert.equal(timedItem.taskSourceLabel, "QA 12.5 Gate Crew");
  assert.equal(timedItem.displayType, "general");
  assert.equal(timedItem.scheduleKind, "timed");
  assert.equal(timedItem.startDate, "2031-02-03");
  assert.equal(timedItem.startTime, "07:30:00");
  assert.equal(timedItem.endTime, "10:30:00");
  assert.equal(timedItem.timezone, "America/Denver");
  assert.equal(timedItem.neededCount, 6);
  assert.equal(timedItem.lifecycle, "active");
  assert.equal(timedItem.scheduleNotes, "Safe schedule note");
  assert.equal(timedItem.coverage.assignedCount, 4);
  assert.equal(timedItem.coverage.confirmedCount, 3);
  assert.equal(timedItem.coverage.waitingOnConfirmationCount, 1);
  assert.equal(timedItem.coverage.deniedCount, 1);
  assert.equal(timedItem.coverage.unassignedCount, 2);
  assert.equal(timedItem.coverage.hasDenied, true);
  assert.equal(timedItem.coverage.allAssignedHelpersDenied, false);
  assert.equal(timedItem.coverage.coverageState, "some_denied");
  assert.equal(timedItem.assignedFractionLabel, "4/6 assigned");

  const dateItem = mappedItems.find(
    (item) => item.calendarItemId === fixture.dateBasedCalendarItemId,
  );
  assert(dateItem, "Date-based Calendar read-model item was not projected.");
  assert.equal(dateItem.taskSourceLabel, "QA 12.5 Breakfast Service");
  assert.equal(dateItem.displayType, "food");
  assert.equal(dateItem.coverage.assignedCount, 2);
  assert.equal(dateItem.coverage.confirmedCount, 2);
  assert.equal(dateItem.assignedFractionLabel, "2/2 assigned");

  for (const informationalId of [
    fixture.multiDayCalendarItemId,
    fixture.milestoneCalendarItemId,
  ]) {
    const item = mappedItems.find((candidate) => candidate.calendarItemId === informationalId);
    assert(item, "Informational Calendar item was not projected.");
    assert.equal(item.neededCount, 0);
    assert.equal(item.coverage.assignedCount, 0);
    assert.equal(item.coverage.coverageState, "not_assignable");
    assert.equal(item.assignedFractionLabel, "0/0 assigned");
    assert.equal(item.coverage.aggregateVolunteerCountOnMultiDayWindowAllowed, false);
  }

  const oneOffItem = mappedItems.find((item) => item.calendarItemId === fixture.oneOffCalendarItemId);
  assert(oneOffItem, "One-off Calendar item was not projected.");
  assert.equal(oneOffItem.oneOffTaskLabel, "QA 12.5 One-Off Labels");
  assert.equal(oneOffItem.oneOffTaskType, "security");
  assert.equal(oneOffItem.taskPresetLabel, null);
  assert.equal(oneOffItem.assignedFractionLabel, "1/1 assigned");

  const sortedGateItems = filterAndSortCalendarReadModelItems(mappedItems, {
    taskNameSearch: "gate",
    coverage: "someDenied",
  });
  assert.deepEqual(
    sortedGateItems.map((item) => item.calendarItemId),
    [fixture.timedCalendarItemId],
  );
  assert.deepEqual(
    filterAndSortCalendarReadModelItems(mappedItems, { type: "food" }).map(
      (item) => item.calendarItemId,
    ),
    [fixture.dateBasedCalendarItemId],
  );

  for (const item of mappedItems) {
    assert.deepEqual(Object.keys(item).sort(), [
      "assignedFractionLabel",
      "calendarItemId",
      "coverage",
      "displayType",
      "endDate",
      "endTime",
      "isOwnDraft",
      "lifecycle",
      "neededCount",
      "oneOffTaskLabel",
      "oneOffTaskType",
      "publicationState",
      "publishedAt",
      "scheduleKind",
      "scheduleNotes",
      "stableDisplayReference",
      "startDate",
      "startTime",
      "taskPresetId",
      "taskPresetLabel",
      "taskPresetType",
      "taskSourceLabel",
      "timezone",
    ]);
    assertCredentialFree(item, "Calendar read-model projection", fixture.namespace);
  }

  const queryHelperResult = await readCalendarReadModelWithClient({
    client: fullClient,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.fullContactId,
    rangeStart: "2031-02-01",
    rangeEnd: "2031-02-28",
    workspaceTimezone: "America/Denver",
    periodKind: "month",
    capabilities: fullGrant.capabilities,
  });
  assert.equal(queryHelperResult.ok, true, "Query helper could not read disposable local rows.");
  if (queryHelperResult.ok) {
    assert.equal(queryHelperResult.query.routeUnused, true);
    assert.equal(queryHelperResult.query.dependencyInjected, true);
    assert.deepEqual(queryHelperResult.query.tables, [
      "calendar_items",
      "task_presets",
      "calendar_assignments",
      "assignment_responses",
    ]);
    assert.equal(queryHelperResult.items.length, 5);
    const queryTimedItem = queryHelperResult.items.find(
      (item) => item.calendarItemId === fixture.timedCalendarItemId,
    );
    assert(queryTimedItem, "Query helper did not project the timed Calendar item.");
    assert.equal(queryTimedItem.taskSourceLabel, "QA 12.5 Gate Crew");
    assert.equal(queryTimedItem.coverage.assignedCount, 4);
    assert.equal(queryTimedItem.coverage.confirmedCount, 3);
    assert.equal(queryTimedItem.coverage.waitingOnConfirmationCount, 1);
    assert.equal(queryTimedItem.coverage.deniedCount, 1);
    assert.equal(queryTimedItem.coverage.unassignedCount, 2);
    assert.equal(queryTimedItem.assignedFractionLabel, "4/6 assigned");
    const queryDateItem = queryHelperResult.items.find(
      (item) => item.calendarItemId === fixture.dateBasedCalendarItemId,
    );
    assert(queryDateItem, "Query helper did not project the date-based Calendar item.");
    assert.equal(queryDateItem.coverage.assignedCount, 2);
    assert.equal(queryDateItem.assignedFractionLabel, "2/2 assigned");
    const queryInformationalItem = queryHelperResult.items.find(
      (item) => item.calendarItemId === fixture.multiDayCalendarItemId,
    );
    assert(queryInformationalItem, "Query helper did not project the informational Calendar item.");
    assert.equal(queryInformationalItem.neededCount, 0);
    assert.equal(queryInformationalItem.assignedFractionLabel, "0/0 assigned");
    assert.equal(
      queryHelperResult.items.some(
        (item) => item.calendarItemId === fixture.otherWorkspaceCalendarItemId,
      ),
      false,
      "Query helper allowed wrong-workspace Calendar rows to bleed into output.",
    );
    for (const item of queryHelperResult.items) {
      assertCredentialFree(item, "Calendar query-helper projection", fixture.namespace);
    }
  }

  const queryHelperCalendarOnly = await readCalendarReadModelWithClient({
    client: calendarOnlyClient,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.calendarOnlyContactId,
    rangeStart: "2031-02-01",
    rangeEnd: "2031-02-28",
    workspaceTimezone: "America/Denver",
    periodKind: "month",
    capabilities: calendarOnlyGrant.capabilities,
  });
  assert.deepEqual(queryHelperCalendarOnly, {
    ok: false,
    reason: "missing_assignments_view_for_coverage",
  });

  const dryRunResult = await runCalendarRouteCutoverDryRun({
    executionMode: "dryRun",
    client: fullClient,
    trustedContext: {
      authSessionPresent: true,
      workspaceId: fixture.workspaceId,
      actorContactId: fixture.fullContactId,
      workspaceTimezone: "America/Denver",
      workspaceAvailable: true,
      grantActive: true,
      capabilities: fullGrant.capabilities,
      roleTitle: fullGrant.role,
    },
    periodKind: "month",
    anchorDate: "2031-02-03",
  });
  assert.equal(dryRunResult.available, true, "Dry-run did not project local persisted rows.");
  assert.equal(dryRunResult.state, "ready");
  assert.equal(dryRunResult.dryRunOnly, true);
  assert.equal(dryRunResult.routeUnused, true);
  assert.equal(dryRunResult.items.length, 5);
  const dryRunTimedItem = dryRunResult.items.find(
    (item) => item.calendarItemId === fixture.timedCalendarItemId,
  );
  assert(dryRunTimedItem, "Dry-run did not project the timed Calendar item.");
  assert.equal(dryRunTimedItem.coverage.assignedCount, 4);
  assert.equal(dryRunTimedItem.coverage.confirmedCount, 3);
  assert.equal(dryRunTimedItem.coverage.waitingOnConfirmationCount, 1);
  assert.equal(dryRunTimedItem.coverage.deniedCount, 1);
  assert.equal(dryRunTimedItem.coverage.unassignedCount, 2);
  assert.equal(dryRunTimedItem.assignedFractionLabel, "4/6 assigned");
  assert.equal(dryRunResult.summary.itemCount, 5);
  assert.equal(dryRunResult.summary.assignedCount >= 7, true);
  assert.equal(
    dryRunResult.items.some((item) => item.calendarItemId === fixture.otherWorkspaceCalendarItemId),
    false,
    "Dry-run allowed wrong-workspace Calendar rows to bleed into output.",
  );
  assertCredentialFree(dryRunResult, "Calendar route cutover dry-run projection", fixture.namespace);

  const dryRunCalendarOnly = await runCalendarRouteCutoverDryRun({
    executionMode: "dryRun",
    client: calendarOnlyClient,
    trustedContext: {
      authSessionPresent: true,
      workspaceId: fixture.workspaceId,
      actorContactId: fixture.calendarOnlyContactId,
      workspaceTimezone: "America/Denver",
      workspaceAvailable: true,
      grantActive: true,
      capabilities: calendarOnlyGrant.capabilities,
      roleTitle: calendarOnlyGrant.role,
    },
    periodKind: "month",
    anchorDate: "2031-02-03",
  });
  assert.equal(dryRunCalendarOnly.available, false);
  assert.equal(dryRunCalendarOnly.state, "missing-assignments-view");

  const dryRunUnauthenticated = await runCalendarRouteCutoverDryRun({
    executionMode: "dryRun",
    client: fullClient,
    trustedContext: {
      authSessionPresent: false,
      workspaceId: fixture.workspaceId,
      actorContactId: fixture.fullContactId,
      workspaceTimezone: "America/Denver",
      workspaceAvailable: true,
      grantActive: true,
      capabilities: fullGrant.capabilities,
      roleTitle: fullGrant.role,
    },
    periodKind: "month",
    anchorDate: "2031-02-03",
  });
  assert.deepEqual(dryRunUnauthenticated, {
    available: false,
    state: "unauthenticated",
    dryRunOnly: true,
    routeUnused: true,
  });

  for (const forbiddenField of [
    "volunteer_contact_values",
    "emergency_contact_details",
    "questionnaire_answers",
    "public_response_url",
    "redacted_response_url",
    "bearer",
    "verifier",
    "token_id",
    "audit_id",
    "access_token",
    "refresh_token",
    "password",
    "api_key",
    "service_role_key",
    "sql_internal_rpc_detail",
    "raw_grants_capability_arrays",
    "unrelated_row_data",
    "provider_error_dump",
    "stack_trace",
    "raw_exception_message",
  ]) {
    assert.ok(calendarReadModelForbiddenOutputFields.includes(forbiddenField));
  }
  for (const blocked of [
    "admin_calendar_route_cutover",
    "calendar_ui_changes",
    "calendar_create_edit_archive_cancel_ui",
    "calendar_write_commands",
    "assignment_picker",
    "assignment_create_cancel",
    "assignment_response_mutation_from_calendar_ui",
    "public_volunteer_lookup",
    "email_reminder_delivery",
    "communications_persistence_cutover",
    "needs_attention_persistence_cutover",
    "response_link_activation",
    "assignment_detail_entry_links",
    "service_role_usage",
    "seed_data",
  ]) {
    assert.ok(calendarReadModelExplicitlyBlocked.includes(blocked));
  }
}

async function cleanupFixtures(containerName) {
  for (const client of clients) {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  runPsql(containerName, `begin;
delete from public.assignment_responses where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.calendar_assignments where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.calendar_items where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.volunteer_profiles where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.questionnaire_submissions where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.workspace_contact_grants where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.project_contacts where id in (
  '${fixture.fullContactId}'::uuid,
  '${fixture.calendarOnlyContactId}'::uuid,
  '${fixture.assignmentsOnlyContactId}'::uuid,
  '${fixture.roleOnlyContactId}'::uuid
);
delete from public.workspaces where id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
${authUserIds.map((id) => `delete from auth.users where id = '${id}'::uuid;`).join("\n")}
commit;`);
  const residue = runPsql(containerName, `select (
  (select count(*) from public.workspaces where workspace_key like 'qa-12-5-%') +
  (select count(*) from public.task_presets where name like 'QA 12.5%') +
  (select count(*) from public.calendar_items where title_snapshot like 'QA 12.5%') +
  (select count(*) from public.volunteer_profiles where full_name like 'QA 12.5%') +
  (select count(*) from auth.users where email like 'qa-12-5-%@example.invalid')
)::text;`);
  assert(residue === "0", "Calendar read-model local validation left fixture residue.");
  cleanupCompleted = true;
}

async function main() {
  await verifyStaticBoundaries();
  await verifyLocalPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  try {
    const clientsForFixture = await createFixtures(containerName);
    await verifyLiveRows(containerName, clientsForFixture);
  } finally {
    await cleanupFixtures(containerName);
  }
  assert(cleanupCompleted, "Calendar read-model fixture cleanup did not complete.");
  console.log("Calendar read-model local data validation passed.");
  console.log("Verified route-unused helper, query-helper, and dry-run compatibility with disposable local persisted row shapes and zero residue.");
  console.log("No response URL, bearer, verifier, token id, password, access token, refresh token, API key, service-role key, or database URL was logged.");
}

main().catch((error) => {
  console.error(`Calendar read-model local data validation failed: ${redact(error)}`);
  process.exitCode = 1;
});
