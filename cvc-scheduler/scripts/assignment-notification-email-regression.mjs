import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  readInitialAssignmentNotificationSummariesWithClient,
  sendInitialAssignmentNotificationsForItemWithClient,
} from "../lib/calendar/assignmentNotifications.server.ts";
import {
  INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION,
  readInitialAssignmentEmailConfiguration,
} from "../lib/notifications/initialAssignmentEmail.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();
const fixture = {
  namespace: `qa-12-22-assignment-email-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  contacts: {
    scheduler: randomUUID(),
    viewOnly: randomUUID(),
    roleOnly: randomUUID(),
    other: randomUUID(),
  },
  grants: {
    scheduler: randomUUID(),
    viewOnly: randomUUID(),
    roleOnly: randomUUID(),
    other: randomUUID(),
  },
  volunteers: {
    readyWithEmail: randomUUID(),
    readyNoEmail: randomUUID(),
    other: randomUUID(),
  },
  items: {
    published: randomUUID(),
    missingFollowUp: randomUUID(),
    other: randomUUID(),
  },
  assignments: {
    sendable: randomUUID(),
    noEmail: randomUUID(),
    missingFollowUp: randomUUID(),
    other: randomUUID(),
  },
  responses: {
    sendable: randomUUID(),
    noEmail: randomUUID(),
    missingFollowUp: randomUUID(),
    other: randomUUID(),
  },
};

const authUserIds = [];
let cleanupCompleted = false;
let tempDir;

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function redact(value) {
  let message = value instanceof Error ? (value.stack ?? value.message) : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
      message = message.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/\/v\/access\/[A-Za-z0-9_-]{43}/g, "/v/access/[redacted]");
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function sqlArray(values) {
  return `array[${values.map(sqlText).join(", ")}]::text[]`;
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
    throw new Error(`Local assignment email fixture command failed: ${redact(result.stderr).slice(0, 900)}`);
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
    "Local Supabase is unavailable. Start local Supabase with output redirected/redacted before this validation.",
  );
  return containerName;
}

async function verifyPreflight() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Assignment email validation accepts only local Supabase.");
  secrets.add(anonKey);
  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");
}

async function verifyStaticContract() {
  const [page, client, serverHelper, provider, migration, envExample] = await Promise.all([
    readFile(path.join(root, "app", "admin", "calendar", "page.tsx"), "utf8"),
    readFile(path.join(root, "components", "CalendarClient.tsx"), "utf8"),
    readFile(path.join(root, "lib", "calendar", "assignmentNotifications.server.ts"), "utf8"),
    readFile(path.join(root, "lib", "notifications", "initialAssignmentEmail.server.ts"), "utf8"),
    readFile(path.join(root, "supabase", "migrations", "20260714122200_initial_assignment_notifications.sql"), "utf8"),
    readFile(path.join(root, ".env.example"), "utf8"),
  ]);

  assert(page.includes("sendInitialAssignmentNotificationsAction"), "Calendar route action is not wired.");
  assert(client.includes("Send initial assignment emails"), "Calendar inspector send control is missing.");
  assert(serverHelper.includes("claim_initial_assignment_notification_deliveries"), "Notification helper must claim through the reviewed RPC.");
  assert(serverHelper.includes("finalize_initial_assignment_notification_delivery"), "Notification helper must finalize through the reviewed RPC.");
  assert(serverHelper.includes("issue_volunteer_schedule_access"), "Notification helper must use schedule access issuance.");
  assert(provider.includes("ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT"), "Provider config opt-in is missing.");
  assert(provider.includes("/v/access/[redacted]"), "Recording provider must store only a redacted schedule path.");
  assert(migration.includes("assignment_notification_deliveries"), "Delivery ledger migration is missing.");
  assert(migration.includes("unique"), "Delivery duplicate-prevention constraint is missing.");
  assert(migration.includes("assignments.edit"), "Delivery RPCs must require assignments.edit.");
  assert(migration.includes("volunteer_facing_display_name"), "Follow-up Contact volunteer-facing fields are missing.");
  assert(envExample.includes("ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT="), "Email transport env example is missing.");

  const forbiddenClientPatterns = [
    /\.rpc\(/,
    /createClient\(/,
    /ASSIGNMENT_NOTIFICATION_[A-Z_]+/,
    /\/v\/access\/\$\{/,
  ];
  for (const pattern of forbiddenClientPatterns) {
    assert(!pattern.test(client), `Calendar client contains forbidden notification pattern ${pattern}.`);
  }
}

async function applyMigrationIfNeeded(containerName, migrationName, probeSql) {
  const present = queryJson(containerName, probeSql);
  if (present.length > 0) return;
  const migration = await readFile(
    path.join(root, "supabase", "migrations", migrationName),
    "utf8",
  );
  runPsql(containerName, migration);
}

async function applyAssignmentEmailMigrationIfNeeded(containerName) {
  await applyMigrationIfNeeded(
    containerName,
    "20260714122000_volunteer_schedule_access.sql",
    "select 1 as present from pg_proc where proname = 'issue_volunteer_schedule_access'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714122100_volunteer_schedule_responses.sql",
    "select 1 as present from pg_proc where proname = 'confirm_all_volunteer_schedule_assignments'",
  );
  await applyMigrationIfNeeded(
    containerName,
    "20260714122200_initial_assignment_notifications.sql",
    "select 1 as present from information_schema.tables where table_schema = 'public' and table_name = 'assignment_notification_deliveries'",
  );
  const summarySource = runPsql(
    containerName,
    "select prosrc from pg_proc where proname = 'read_initial_assignment_notification_summaries' limit 1;",
  );
  if (!summarySource.includes("delivery_state is distinct from")) {
    const migration = await readFile(
      path.join(root, "supabase", "migrations", "20260714122200_initial_assignment_notifications.sql"),
      "utf8",
    );
    const start = migration.indexOf("create function public.read_initial_assignment_notification_summaries");
    const end = migration.indexOf("create function public.claim_initial_assignment_notification_deliveries");
    assert(start >= 0 && end > start, "Could not locate summary RPC in 12.22 migration.");
    const summaryFunction = migration
      .slice(start, end)
      .replace(
        "create function public.read_initial_assignment_notification_summaries",
        "create or replace function public.read_initial_assignment_notification_summaries",
      );
    runPsql(containerName, summaryFunction);
  }
  const refreshedSummarySource = runPsql(
    containerName,
    "select prosrc from pg_proc where proname = 'read_initial_assignment_notification_summaries' limit 1;",
  );
  if (!refreshedSummarySource.includes("recipient_email !~*")) {
    const validationMigration = await readFile(
      path.join(root, "supabase", "migrations", "20260714122210_initial_assignment_notification_email_validation.sql"),
      "utf8",
    );
    runPsql(containerName, validationMigration);
  }
  const refreshedClaimSource = runPsql(
    containerName,
    "select prosrc from pg_proc where proname = 'claim_initial_assignment_notification_deliveries' limit 1;",
  );
  if (!refreshedClaimSource.includes("normalized_recipient_email := null")) {
    const snapshotMigration = await readFile(
      path.join(root, "supabase", "migrations", "20260714122220_initial_assignment_notification_recipient_snapshot.sql"),
      "utf8",
    );
    runPsql(containerName, snapshotMigration);
  }
  const refreshedFinalizeSource = runPsql(
    containerName,
    "select prosrc from pg_proc where proname = 'finalize_initial_assignment_notification_delivery' limit 1;",
  );
  if (!refreshedFinalizeSource.includes("A-Za-z0-9._:-")) {
    const finalizeMigration = await readFile(
      path.join(root, "supabase", "migrations", "20260714122230_initial_assignment_notification_finalize_bounds.sql"),
      "utf8",
    );
    runPsql(containerName, finalizeMigration);
  }
}

async function createAuthenticatedUser(label) {
  const email = `${fixture.namespace}-${label}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, `Disposable Auth user creation failed for ${label}.`);
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Disposable Auth sign-in failed for ${label}.`);
    session = signin.data.session;
  }
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  authUserIds.push(signup.data.user.id);
  return { client, userId: signup.data.user.id };
}

function grantRow(label, workspaceId, capabilities) {
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, 'main_contact', ${sqlArray(capabilities)}, 'active', clock_timestamp() - interval '1 day', null, null)`;
}

function insertFixtures(containerName, users) {
  runPsql(
    containerName,
    `insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-target`)}, 'QA 12.22 Email Target', 'active', 'America/Denver', '2026-08-01'::date, '2099-12-31'::date, false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, 'QA 12.22 Email Other', 'active', 'America/Denver', '2026-08-01'::date, '2099-12-31'::date, false);

insert into public.project_contacts (
  id, auth_user_id, status, volunteer_facing_display_name, volunteer_facing_email, volunteer_facing_phone
) values
  (${sqlUuid(fixture.contacts.scheduler)}, ${sqlUuid(users.scheduler.userId)}, 'active', 'QA Follow-up Contact', 'follow-up@example.invalid', '406-555-0100'),
  (${sqlUuid(fixture.contacts.viewOnly)}, ${sqlUuid(users.viewOnly.userId)}, 'active', 'QA View Only', 'view-only@example.invalid', null),
  (${sqlUuid(fixture.contacts.roleOnly)}, ${sqlUuid(users.roleOnly.userId)}, 'active', null, null, null),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(users.other.userId)}, 'active', 'QA Other Contact', 'other-contact@example.invalid', null);

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  ${grantRow("scheduler", fixture.workspaceId, ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"])},
  ${grantRow("viewOnly", fixture.workspaceId, ["workspace.read", "calendar.view", "assignments.view", "volunteers.view"])},
  ${grantRow("roleOnly", fixture.workspaceId, ["workspace.read"])},
  ${grantRow("other", fixture.otherWorkspaceId, ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view"])};

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values
  (${sqlUuid(fixture.volunteers.readyWithEmail)}, ${sqlUuid(fixture.workspaceId)}, null, 'manual', ${sqlUuid(fixture.contacts.scheduler)}, clock_timestamp(), 'active', 'ready', ${sqlText(`${fixture.namespace} Ready Email`)}, ${sqlText(`${fixture.namespace}-ready@example.invalid`)}, null, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, ''),
  (${sqlUuid(fixture.volunteers.readyNoEmail)}, ${sqlUuid(fixture.workspaceId)}, null, 'manual', ${sqlUuid(fixture.contacts.scheduler)}, clock_timestamp(), 'active', 'ready', ${sqlText(`${fixture.namespace} Ready No Email`)}, null, '406-555-0199', 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, ''),
  (${sqlUuid(fixture.volunteers.other)}, ${sqlUuid(fixture.otherWorkspaceId)}, null, 'manual', ${sqlUuid(fixture.contacts.other)}, clock_timestamp(), 'active', 'ready', ${sqlText(`${fixture.namespace} Other`)}, ${sqlText(`${fixture.namespace}-other@example.invalid`)}, null, 'Other QA', null, '{}'::jsonb, '{}'::jsonb, '');

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
) values
  (${sqlUuid(fixture.items.published)}, ${sqlUuid(fixture.workspaceId)}, null, ${sqlText(`${fixture.namespace} Email Shift`)}, 'general', 'timed', '2099-08-20'::date, null, '09:00'::time, '11:00'::time, 'America/Denver', 2, 'Email QA notes.', '{}'::jsonb, 'active', ${sqlUuid(fixture.contacts.scheduler)}, ${sqlUuid(fixture.contacts.scheduler)}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts.scheduler)}),
  (${sqlUuid(fixture.items.missingFollowUp)}, ${sqlUuid(fixture.workspaceId)}, null, ${sqlText(`${fixture.namespace} Missing Follow-up`)}, 'general', 'timed', '2099-08-21'::date, null, '09:00'::time, '11:00'::time, 'America/Denver', 1, null, '{}'::jsonb, 'active', ${sqlUuid(fixture.contacts.roleOnly)}, ${sqlUuid(fixture.contacts.scheduler)}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts.scheduler)}),
  (${sqlUuid(fixture.items.other)}, ${sqlUuid(fixture.otherWorkspaceId)}, null, ${sqlText(`${fixture.namespace} Other`)}, 'general', 'timed', '2099-08-20'::date, null, '09:00'::time, '11:00'::time, 'America/Denver', 1, null, '{}'::jsonb, 'active', ${sqlUuid(fixture.contacts.other)}, ${sqlUuid(fixture.contacts.other)}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts.other)});

insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values
  (${sqlUuid(fixture.assignments.sendable)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.published)}, ${sqlUuid(fixture.volunteers.readyWithEmail)}, 'active', null, ${sqlUuid(users.scheduler.userId)}),
  (${sqlUuid(fixture.assignments.noEmail)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.published)}, ${sqlUuid(fixture.volunteers.readyNoEmail)}, 'active', null, ${sqlUuid(users.scheduler.userId)}),
  (${sqlUuid(fixture.assignments.missingFollowUp)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.missingFollowUp)}, ${sqlUuid(fixture.volunteers.readyWithEmail)}, 'active', null, ${sqlUuid(users.scheduler.userId)}),
  (${sqlUuid(fixture.assignments.other)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.items.other)}, ${sqlUuid(fixture.volunteers.other)}, 'active', null, ${sqlUuid(users.other.userId)});

insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
) values
  (${sqlUuid(fixture.responses.sendable)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignments.sendable)}, 'needs_response', 'project_contact', null, null, ${sqlUuid(users.scheduler.userId)}),
  (${sqlUuid(fixture.responses.noEmail)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignments.noEmail)}, 'needs_response', 'project_contact', null, null, ${sqlUuid(users.scheduler.userId)}),
  (${sqlUuid(fixture.responses.missingFollowUp)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.assignments.missingFollowUp)}, 'needs_response', 'project_contact', null, null, ${sqlUuid(users.scheduler.userId)}),
  (${sqlUuid(fixture.responses.other)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.assignments.other)}, 'needs_response', 'project_contact', null, null, ${sqlUuid(users.other.userId)});`,
  );
}

async function expectFailure(label, operation) {
  try {
    await operation();
  } catch {
    return;
  }
  assert.fail(`${label} should have failed closed.`);
}

async function verifyNotifications(containerName, users) {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pl-12-22-email-"));
  const recordingPath = path.join(tempDir, "messages.jsonl");
  const config = readInitialAssignmentEmailConfiguration({
    ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "recording",
    ASSIGNMENT_NOTIFICATION_BASE_URL: "http://127.0.0.1:3000",
    ASSIGNMENT_NOTIFICATION_FROM: "scheduler@example.invalid",
    ASSIGNMENT_NOTIFICATION_RECORDING_PATH: recordingPath,
  });
  assert(config.ok, "Recording email configuration should be available for local QA.");

  const disabledConfig = readInitialAssignmentEmailConfiguration({});
  assert(!disabledConfig.ok, "Assignment notification transport should be disabled by default.");

  const visibleItem = await users.scheduler.client
    .from("calendar_items")
    .select("id")
    .eq("id", fixture.items.published);
  assert(!visibleItem.error, "Scheduler should be able to read the published Calendar item.");
  assert.equal(visibleItem.data?.length, 1, "Scheduler direct Calendar visibility fixture is missing.");
  const visibleAssignments = await users.scheduler.client
    .from("calendar_assignments")
    .select("id")
    .eq("calendar_item_id", fixture.items.published);
  assert(!visibleAssignments.error, "Scheduler should be able to read Calendar assignments.");
  assert.equal(visibleAssignments.data?.length, 2, "Scheduler direct assignment visibility fixture is missing.");

  const initialSummary = await readInitialAssignmentNotificationSummariesWithClient({
    supabase: users.scheduler.client,
    calendarItemIds: [fixture.items.published],
    canSendInitialAssignmentNotifications: true,
  });
  const rawSummary = await users.scheduler.client.rpc(
    "read_initial_assignment_notification_summaries",
    { p_calendar_item_ids: [fixture.items.published] },
  );
  assert(!rawSummary.error, "Raw summary RPC should not fail.");
  assert.equal(initialSummary.kind, "ready");
  assert.equal(
    initialSummary.summaries[0]?.eligibleToSendCount,
    1,
    `Unexpected initial summary: ${JSON.stringify({ parsed: initialSummary, raw: rawSummary.data })}`,
  );
  assert.equal(initialSummary.summaries[0]?.missingEmailCount, 1);

  const readOnlySummary = await readInitialAssignmentNotificationSummariesWithClient({
    supabase: users.viewOnly.client,
    calendarItemIds: [fixture.items.published],
    canSendInitialAssignmentNotifications: true,
  });
  assert.equal(readOnlySummary.kind, "ready");
  assert.equal(readOnlySummary.summaries.length, 0, "Read-only contact should not receive send summaries.");

  await expectFailure("disabled email send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      users.scheduler.client,
      { calendarItemId: fixture.items.published },
      disabledConfig,
    ),
  );

  const result = await sendInitialAssignmentNotificationsForItemWithClient(
    users.scheduler.client,
    { calendarItemId: fixture.items.published },
    config,
  );
  assert.equal(result.sentCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.failedCount, 0);
  assert.equal(result.providerFailureCount, 0);
  assert.equal(result.finalizationFailureCount, 0);
  assert.equal(result.scheduleAccessFailureCount, 0);

  const lines = (await readFile(recordingPath, "utf8")).trim().split(/\r?\n/);
  assert.equal(lines.length, 1, "Exactly one email provider call should be recorded.");
  const recorded = JSON.parse(lines[0]);
  assert.equal(recorded.kind, "initial_assignment");
  assert.equal(recorded.templateVersion, INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION);
  assert.equal(recorded.scheduleAccessPath, "/v/access/[redacted]");
  assert(!JSON.stringify(recorded).includes("/v/access/") || JSON.stringify(recorded).includes("/v/access/[redacted]"));
  assert(!JSON.stringify(recorded).includes(`${fixture.namespace}-ready@example.invalid`), "Recording output must not store raw recipient email.");

  const deliveryRows = queryJson(
    containerName,
    `select calendar_assignment_id::text, delivery_state, attempt_count, safe_failure_code,
            provider_message_id is not null as has_provider_id,
            recipient_email_snapshot is not null as has_recipient
     from public.assignment_notification_deliveries
     where workspace_id = ${sqlUuid(fixture.workspaceId)}
     order by calendar_assignment_id::text`,
  );
  assert.equal(deliveryRows.length, 2);
  assert(deliveryRows.some((row) => row.delivery_state === "sent" && row.has_provider_id && row.has_recipient));
  assert(deliveryRows.some((row) => row.delivery_state === "failed" && row.safe_failure_code === "missing_recipient_email"));

  const tokenRows = queryJson(
    containerName,
    `select token.id, token.revoked_at, token.token_verifier_hash is not null as has_hash
     from public.volunteer_schedule_access_tokens as token
     where token.workspace_id = ${sqlUuid(fixture.workspaceId)}`,
  );
  assert.equal(tokenRows.length, 1, "Successful email should create one schedule access credential.");
  assert(tokenRows[0].has_hash, "Schedule access credential must store only a verifier hash.");
  assert(!JSON.stringify(deliveryRows).includes("/v/access/"), "Delivery ledger must not store full schedule URLs.");

  const duplicate = await sendInitialAssignmentNotificationsForItemWithClient(
    users.scheduler.client,
    { calendarItemId: fixture.items.published },
    config,
  );
  assert.equal(duplicate.sentCount, 0);
  assert.equal(duplicate.alreadySentCount, 1);
  const duplicateLines = (await readFile(recordingPath, "utf8")).trim().split(/\r?\n/);
  assert.equal(duplicateLines.length, 1, "Duplicate send must not call the provider again.");

  runPsql(
    containerName,
    `update public.volunteer_profiles
     set email = ${sqlText(`${fixture.namespace}-retry@example.invalid`)}
     where id = ${sqlUuid(fixture.volunteers.readyNoEmail)};`,
  );
  const failingRecordingConfig = readInitialAssignmentEmailConfiguration({
    ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "recording",
    ASSIGNMENT_NOTIFICATION_BASE_URL: "http://127.0.0.1:3000",
    ASSIGNMENT_NOTIFICATION_FROM: "scheduler@example.invalid",
    ASSIGNMENT_NOTIFICATION_RECORDING_PATH: path.join(
      tempDir,
      "missing-directory",
      "messages.jsonl",
    ),
  });
  assert(failingRecordingConfig.ok);
  const providerFailure = await sendInitialAssignmentNotificationsForItemWithClient(
    users.scheduler.client,
    { calendarItemId: fixture.items.published },
    failingRecordingConfig,
  );
  assert.equal(providerFailure.failedCount, 1);
  assert.equal(providerFailure.providerFailureCount, 1);
  assert.equal(providerFailure.finalizationFailureCount, 0);
  assert.equal(providerFailure.tokenRevokedAfterFailureCount, 1);

  const retry = await sendInitialAssignmentNotificationsForItemWithClient(
    users.scheduler.client,
    { calendarItemId: fixture.items.published },
    config,
  );
  assert.equal(retry.sentCount, 1, "A safely finalized provider failure must remain retryable.");
  assert.equal(retry.providerFailureCount, 0);
  const retriedDelivery = queryJson(
    containerName,
    `select delivery_state, attempt_count, provider_message_id is not null as has_provider_id
     from public.assignment_notification_deliveries
     where calendar_assignment_id = ${sqlUuid(fixture.assignments.noEmail)}`,
  );
  assert.equal(retriedDelivery[0]?.delivery_state, "sent");
  assert.equal(retriedDelivery[0]?.attempt_count, 3);
  assert.equal(retriedDelivery[0]?.has_provider_id, true);

  await expectFailure("view-only contact send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      users.viewOnly.client,
      { calendarItemId: fixture.items.published },
      config,
    ),
  );
  await expectFailure("role-only contact send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      users.roleOnly.client,
      { calendarItemId: fixture.items.published },
      config,
    ),
  );
  await expectFailure("cross-workspace contact send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      users.other.client,
      { calendarItemId: fixture.items.published },
      config,
    ),
  );
  await expectFailure("malformed calendar item id", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      users.scheduler.client,
      { calendarItemId: "not-a-uuid" },
      config,
    ),
  );

  const missingFollowUp = await sendInitialAssignmentNotificationsForItemWithClient(
    users.scheduler.client,
    { calendarItemId: fixture.items.missingFollowUp },
    config,
  );
  assert.equal(missingFollowUp.sentCount, 0);
  assert.equal(missingFollowUp.skippedCount, 1);

  const directInsert = await users.scheduler.client
    .from("assignment_notification_deliveries")
    .insert({
      workspace_id: fixture.workspaceId,
      calendar_item_id: fixture.items.published,
      calendar_assignment_id: fixture.assignments.sendable,
      volunteer_profile_id: fixture.volunteers.readyWithEmail,
      delivery_state: "sent",
      idempotency_key: "forged",
    });
  assert(directInsert.error, "Direct authenticated delivery insert should remain denied.");
  const directUpdate = await users.scheduler.client
    .from("assignment_notification_deliveries")
    .update({ delivery_state: "failed" })
    .eq("calendar_assignment_id", fixture.assignments.sendable);
  assert(directUpdate.error, "Direct authenticated delivery update should remain denied.");
  const directDelete = await users.scheduler.client
    .from("assignment_notification_deliveries")
    .delete()
    .eq("calendar_assignment_id", fixture.assignments.sendable);
  assert(directDelete.error, "Direct authenticated delivery delete should remain denied.");

  const scheduleToken = tokenRows[0].id;
  const bearerAbsent = queryJson(
    containerName,
    `select count(*)::integer as count
     from public.volunteer_schedule_access_tokens
     where id = ${sqlUuid(scheduleToken)}
       and token_verifier_hash is not null
       and length(encode(token_verifier_hash, 'hex')) = 64`,
  );
  assert.equal(bearerAbsent[0]?.count, 1, "Volunteer schedule token must remain hash-only.");
}

function cleanup(containerName) {
  const userIds = authUserIds.map(sqlUuid).join(", ");
  runPsql(
    containerName,
    `begin;
delete from public.assignment_notification_deliveries where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.volunteer_schedule_access_tokens where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.assignment_response_tokens where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.assignment_responses where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_assignments where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.volunteer_profiles where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.project_contacts where auth_user_id in (${userIds || "null::uuid"});
delete from public.workspaces where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from auth.users where id in (${userIds || "null::uuid"});
commit;`,
  );
  cleanupCompleted = true;
}

function verifyZeroResidue(containerName) {
  const residue = queryJson(
    containerName,
    `select (
      (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
      (select count(*) from public.project_contacts where auth_user_id = any(array[${authUserIds.map(sqlUuid).join(", ")}])) +
      (select count(*) from public.assignment_notification_deliveries where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
      (select count(*) from public.volunteer_schedule_access_tokens where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
      (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}%`)})
    )::integer as residue_count`,
  );
  assert.equal(residue[0]?.residue_count, 0, "Assignment email disposable residue remains.");
}

async function main() {
  let containerName;
  try {
    await verifyStaticContract();
    await verifyPreflight();
    containerName = await resolveLocalDatabaseContainer();
    await applyAssignmentEmailMigrationIfNeeded(containerName);
    const users = {
      scheduler: await createAuthenticatedUser("scheduler"),
      viewOnly: await createAuthenticatedUser("view-only"),
      roleOnly: await createAuthenticatedUser("role-only"),
      other: await createAuthenticatedUser("other"),
    };
    insertFixtures(containerName, users);
    await verifyNotifications(containerName, users);
  } catch (error) {
    console.error(redact(error));
    process.exitCode = 1;
  } finally {
    if (containerName) {
      try {
        cleanup(containerName);
        verifyZeroResidue(containerName);
      } catch (cleanupError) {
        console.error(redact(cleanupError));
        process.exitCode = 1;
      }
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  assert(cleanupCompleted, "Cleanup did not complete.");
  if (process.exitCode) return;
  console.log(
    "Validated initial assignment email claim/finalize delivery ledger, explicit send boundary, schedule access issuance, duplicate prevention, provider failure retry, Follow-up Contact eligibility, safe stage counters, direct table denial, recording transport, and zero disposable residue.",
  );
}

await main();
