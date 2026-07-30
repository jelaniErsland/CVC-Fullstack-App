import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  readInitialAssignmentNotificationSummariesWithClient,
  sendInitialAssignmentNotificationsForItemWithClient,
} from "../lib/calendar/assignmentNotifications.server.ts";
import {
  readInitialAssignmentEmailConfiguration,
} from "../lib/notifications/initialAssignmentEmail.server.ts";
import {
  createPreviewUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedOriginalMigration = "20260714122200";
const expectedEmailValidationMigration = "20260714122210";
const expectedRecipientSnapshotMigration = "20260714122220";
const expectedBeforeMigration = "20260714122100";
const expectedAfterMigration = "20260714122230";
const expectedMigrationFile = `${expectedAfterMigration}_initial_assignment_notification_finalize_bounds.sql`;
const optInName = "RUN_HOSTED_ASSIGNMENT_NOTIFICATION_EMAIL_VALIDATION";
const hostedUrl = `https://${expectedRef}.supabase.co`;
const previewBaseUrl = "http://127.0.0.1:3000";
const browserExecutable = resolvePreviewBrowserExecutable();
const secrets = new Set();

function dateDaysFromToday(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const fixtureDates = {
  future: dateDaysFromToday(18),
  future2: dateDaysFromToday(19),
  future3: dateDaysFromToday(20),
  past: dateDaysFromToday(-1),
};

const fixture = {
  namespace: `qa-12-22-1-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  inactiveWorkspaceId: randomUUID(),
  contacts: Object.fromEntries(
    [
      "scheduler",
      "viewOnly",
      "roleOnly",
      "other",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  grants: Object.fromEntries(
    [
      "scheduler",
      "viewOnly",
      "roleOnly",
      "other",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  volunteers: Object.fromEntries(
    [
      "sendable",
      "missingEmail",
      "malformedEmail",
      "inactive",
      "onHold",
      "browserSuccess",
      "browserFailure",
      "concurrent",
      "failureRetry",
      "stale",
      "freshSending",
      "other",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  items: Object.fromEntries(
    [
      "summary",
      "missingFollowUp",
      "draft",
      "archived",
      "past",
      "canceledAssignment",
      "browserSuccess",
      "browserFailure",
      "concurrent",
      "failureRetry",
      "stale",
      "freshSending",
      "other",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  assignments: Object.fromEntries(
    [
      "summarySendable",
      "summaryMissingEmail",
      "summaryMalformedEmail",
      "summaryInactive",
      "summaryOnHold",
      "missingFollowUp",
      "draft",
      "archived",
      "past",
      "canceled",
      "browserSuccess",
      "browserFailure",
      "concurrent",
      "failureRetry",
      "stale",
      "freshSending",
      "other",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  responses: Object.fromEntries(
    [
      "summarySendable",
      "summaryMissingEmail",
      "summaryMalformedEmail",
      "summaryInactive",
      "summaryOnHold",
      "missingFollowUp",
      "draft",
      "archived",
      "past",
      "canceled",
      "browserSuccess",
      "browserFailure",
      "concurrent",
      "failureRetry",
      "stale",
      "freshSending",
      "other",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  deliveries: {
    stale: randomUUID(),
    freshSending: randomUUID(),
  },
  users: Object.fromEntries(
    [
      "scheduler",
      "viewOnly",
      "roleOnly",
      "other",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "inactiveWorkspace",
    ].map((label) => [
      label,
      {
        label,
        userId: randomUUID(),
        identityId: randomUUID(),
        email: "",
        password: "",
        client: null,
      },
    ]),
  ),
};

let projectStatus = "unknown";
let migrationBefore = "unknown";
let migrationAfter = "unknown";
let exactResidueCount = null;
let namespaceResidueCount = null;
let previewProcess = null;
let tempDir = null;
let cleanupCompleted = false;
let hostedFixturesCreated = false;
let hostedAnonKey = "";
let schedulerCookieJar = null;

function redact(value) {
  let message = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length > 0) {
      message = message.replaceAll(secret, "[redacted]");
      message = message.replaceAll(encodeURIComponent(secret), "[redacted]");
    }
  }
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/\/v\/access\/[A-Za-z0-9_-]{43}/g, "/v/access/[redacted]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/(?:password|apikey|api_key|access_token|refresh_token|bearer|cookie)=\S+/gi, "$1=[redacted]")
    .slice(0, 1800);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function sqlCapabilities(values) {
  return `array[${values.map(sqlText).join(", ")}]::text[]`;
}

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 120 * 1024 * 1024,
    ...options,
  });
}

function npmInvocation(args) {
  if (process.platform !== "win32") return { commandName: "npm", args };
  return {
    commandName: process.execPath,
    args: [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), ...args],
  };
}

function runSupabaseCli(args, options = {}) {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? process.execPath : "npx";
  const executableArgs = isWindows
    ? [
        path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
        "--yes",
        "supabase",
        ...args,
      ]
    : ["--yes", "supabase", ...args];
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 120 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    const stage = options.stage ? `${options.stage}: ` : "";
    throw new Error(`Hosted Supabase CLI command failed: ${stage}${redact(detail || "No diagnostic was returned.")}`);
  }
  return (options.includeStderr ? [result.stdout, result.stderr].filter(Boolean).join("\n") : result.stdout).trim();
}

function parseCliJson(output, stage) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${stage} returned unreadable JSON.`);
  }
}

function runHostedSql(sql, stage = "Hosted database query") {
  const file = path.join(tmpdir(), `project-local-hosted-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  let output;
  try {
    output = runSupabaseCli(["db", "query", "--linked", "--file", file, "--output", "json"], {
      sensitiveOutput: true,
      stage,
    });
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // best effort
    }
  }
  const result = parseCliJson(output, stage);
  assert(Array.isArray(result.rows), `${stage} omitted rows.`);
  return result.rows;
}

function latestHostedMigration() {
  return runHostedSql(
    "select version from supabase_migrations.schema_migrations order by version desc limit 1;",
    "Hosted migration-level check",
  )[0]?.version;
}

async function localMigrationVersionsAfter(version) {
  const files = await readdir(path.join(root, "supabase", "migrations"));
  return files
    .map((file) => file.match(/^(\d{14})_/))
    .filter(Boolean)
    .map((match) => match[1])
    .filter((candidate) => candidate > version)
    .sort();
}

function normalizeGeneratedTypes(source) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(
      /\n\s*\/\/ Allows to automatically instantiate createClient with right options\s*\n\s*\/\/ instead of createClient<Database, \{ PostgrestVersion: 'XX' \}>\(URL, KEY\)\s*(?=\n\s*__InternalSupabase:)/m,
      "",
    )
    .replace(
      /\n\s*__InternalSupabase:\s*{\s*\n\s*PostgrestVersion:\s*"[^"]+"\s*\n\s*}\s*(?=\n\s*public:)/m,
      "",
    )
    .trim();
}

async function verifyGeneratedTypes() {
  const localTypes = await readFile(path.join(root, "lib", "supabase", "database.types.ts"), "utf8");
  const hostedTypes = runSupabaseCli(["gen", "types", "typescript", "--linked", "--schema", "public"], {
    sensitiveOutput: true,
    stage: "Hosted generated-type comparison",
  });
  assert(
    normalizeGeneratedTypes(hostedTypes) === normalizeGeneratedTypes(localTypes),
    "Hosted generated public-schema types differ from the committed generated types.",
  );
}

async function verifyTargetAndReadAnonKey() {
  assert(
    process.env[optInName] === expectedConfirmation,
    `Refusing hosted validation without ${optInName}=${expectedConfirmation}.`,
  );
  const linkedRef = (await readFile(path.join(root, "supabase", ".temp", "project-ref"), "utf8")).trim();
  assert(linkedRef === expectedRef, "The linked project is not the approved staging ref.");
  const projectsResult = parseCliJson(
    runSupabaseCli(["projects", "list", "--output", "json"]),
    "Hosted project discovery",
  );
  const projects = Array.isArray(projectsResult) ? projectsResult : projectsResult.projects;
  const project = projects?.find((entry) => entry.ref === expectedRef);
  assert(
    project?.name === expectedName && project?.status === "ACTIVE_HEALTHY",
    "Approved staging is not ACTIVE_HEALTHY and linked.",
  );
  projectStatus = project.status;

  const dbSession = latestHostedMigration();
  assert(typeof dbSession === "string" && dbSession.length === 14, "Hosted database session is unavailable.");

  const apiKeys = parseCliJson(
    runSupabaseCli(["projects", "api-keys", "--project-ref", expectedRef, "--output", "json"], {
      sensitiveOutput: true,
      stage: "Hosted API-key discovery",
    }),
    "Hosted API-key discovery",
  );
  for (const entry of apiKeys) if (typeof entry.api_key === "string") secrets.add(entry.api_key);
  const anonKey = apiKeys.find((entry) => entry.name === "anon")?.api_key;
  assert(typeof anonKey === "string" && anonKey.length > 100, "Hosted anon key is unavailable.");
  hostedAnonKey = anonKey;
  return anonKey;
}

async function ensureExpectedMigrationApplied() {
  const before = latestHostedMigration();
  migrationBefore = before ?? "unknown";
  assert(
    before === expectedBeforeMigration ||
      before === expectedOriginalMigration ||
      before === expectedEmailValidationMigration ||
      before === expectedRecipientSnapshotMigration ||
      before === expectedAfterMigration,
    `Hosted staging latest migration is ${before ?? "unavailable"}, not ${expectedBeforeMigration}, ${expectedOriginalMigration}, ${expectedEmailValidationMigration}, ${expectedRecipientSnapshotMigration}, or ${expectedAfterMigration}.`,
  );

  if (before !== expectedAfterMigration) {
    const localPending = await localMigrationVersionsAfter(before);
    const expectedPending = before === expectedBeforeMigration
      ? [expectedOriginalMigration, expectedEmailValidationMigration, expectedRecipientSnapshotMigration, expectedAfterMigration]
      : before === expectedOriginalMigration
        ? [expectedEmailValidationMigration, expectedRecipientSnapshotMigration, expectedAfterMigration]
        : before === expectedEmailValidationMigration
          ? [expectedRecipientSnapshotMigration, expectedAfterMigration]
          : [expectedAfterMigration];
    assert(
      JSON.stringify(localPending) === JSON.stringify(expectedPending),
      `Unexpected local pending migrations for hosted staging: ${localPending.join(", ") || "none"}.`,
    );
    const dryRun = runSupabaseCli(["db", "push", "--linked", "--dry-run", "--yes"], {
      includeStderr: true,
    });
    assert(
      dryRun.includes(expectedMigrationFile) || dryRun.includes(expectedAfterMigration),
      "Hosted migration dry-run did not identify the reviewed 12.22 migration.",
    );
    for (const match of dryRun.matchAll(/\b20\d{12}\b/g)) {
      assert(
        match[0] <= before || expectedPending.includes(match[0]),
        `Hosted migration dry-run included unexpected migration ${match[0]}.`,
      );
    }
    runSupabaseCli(["db", "push", "--linked", "--yes"], {
      sensitiveOutput: true,
      stage: "Hosted reviewed 12.22 migration application",
    });
  }

  const after = latestHostedMigration();
  migrationAfter = after ?? "unknown";
  assert(after === expectedAfterMigration, `Hosted staging did not reach ${expectedAfterMigration}.`);
  return { before, after };
}

async function verifyStaticBoundaries() {
  const [migration, validationMigration, snapshotMigration, finalizeMigration, page, client, helper, provider, types, packageJson] = await Promise.all([
    readFile(path.join(root, "supabase", "migrations", `${expectedOriginalMigration}_initial_assignment_notifications.sql`), "utf8"),
    readFile(path.join(root, "supabase", "migrations", `${expectedEmailValidationMigration}_initial_assignment_notification_email_validation.sql`), "utf8"),
    readFile(path.join(root, "supabase", "migrations", `${expectedRecipientSnapshotMigration}_initial_assignment_notification_recipient_snapshot.sql`), "utf8"),
    readFile(path.join(root, "supabase", "migrations", expectedMigrationFile), "utf8"),
    readFile(path.join(root, "app", "admin", "calendar", "page.tsx"), "utf8"),
    readFile(path.join(root, "components", "CalendarClient.tsx"), "utf8"),
    readFile(path.join(root, "lib", "calendar", "assignmentNotifications.server.ts"), "utf8"),
    readFile(path.join(root, "lib", "notifications", "initialAssignmentEmail.server.ts"), "utf8"),
    readFile(path.join(root, "lib", "supabase", "database.types.ts"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);
  assert(migration.includes("volunteer_facing_display_name"), "Follow-up Contact display field is missing.");
  assert(migration.includes("volunteer_facing_email"), "Follow-up Contact email field is missing.");
  assert(migration.includes("assignment_notification_deliveries"), "Delivery ledger is missing.");
  assert(migration.includes("unique"), "Duplicate-prevention unique constraint is missing.");
  assert(migration.includes("read_initial_assignment_notification_summaries"), "Summary RPC is missing.");
  assert(migration.includes("claim_initial_assignment_notification_deliveries"), "Claim RPC is missing.");
  assert(migration.includes("finalize_initial_assignment_notification_delivery"), "Finalize RPC is missing.");
  assert(migration.includes("assignments.edit"), "Notification RPCs do not require assignments.edit.");
  assert(migration.includes("grant execute on function public.read_initial_assignment_notification_summaries"), "Summary execute grant is missing.");
  assert(migration.includes("grant execute on function public.claim_initial_assignment_notification_deliveries"), "Claim execute grant is missing.");
  assert(!/grant (?:select|insert|update|delete|all).*assignment_notification_deliveries.*to (?:anon|authenticated)/i.test(migration), "Delivery table exposes direct broad grants.");
  assert(validationMigration.includes("recipient_email !~*"), "Hosted email-validation forward migration is missing malformed recipient handling.");
  assert(validationMigration.includes("volunteer_facing_email ~*"), "Hosted email-validation forward migration is missing Follow-up Contact email validation.");
  assert(snapshotMigration.includes("normalized_recipient_email := null"), "Hosted recipient snapshot forward migration is missing invalid snapshot nulling.");
  assert(finalizeMigration.includes("p_provider_message_id") && finalizeMigration.includes("^[A-Za-z0-9._:-]{1,200}$"), "Hosted finalization-bounds forward migration is missing provider id bounds.");
  assert(page.includes("sendInitialAssignmentNotificationsAction"), "Calendar page send action is missing.");
  assert(client.includes("Initial email") && client.includes("Send initial assignment emails"), "Calendar Initial email UI is missing.");
  assert(helper.includes("issue_volunteer_schedule_access"), "Notification helper must issue dedicated schedule access.");
  assert(helper.includes("revoke_volunteer_schedule_access"), "Notification helper must revoke schedule access after send failure where safe.");
  assert(!helper.includes("reveal_assignment_response_link"), "Notification helper must not use response-link reveal.");
  assert(provider.includes('transport: "recording"'), "Recording transport boundary is missing.");
  assert(provider.includes("/v/access/[redacted]"), "Recording output must redact schedule access path.");
  assert(!provider.includes("Resend") && !provider.includes("SendGrid") && !provider.includes("SMTP"), "External provider code is out of scope.");
  assert(types.includes("assignment_notification_deliveries"), "Generated types lack delivery table.");
  assert(types.includes("claim_initial_assignment_notification_deliveries"), "Generated types lack claim RPC.");
  assert(packageJson.includes("test:assignment-notification-email"), "Local 12.22 package script is missing.");
}

function hostedAppClient() {
  return createClient(hostedUrl, hostedAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function authUserSql(user) {
  return `insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid, ${sqlUuid(user.userId)},
  'authenticated', 'authenticated', ${sqlText(user.email)}, extensions.crypt(${sqlText(user.password)}, extensions.gen_salt('bf')), clock_timestamp(),
  '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, clock_timestamp(), clock_timestamp()
);
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
) values (
  ${sqlText(user.userId)}, ${sqlUuid(user.userId)},
  jsonb_build_object('sub', ${sqlText(user.userId)}, 'email', ${sqlText(user.email)}),
  'email', clock_timestamp(), clock_timestamp(), clock_timestamp(), ${sqlUuid(user.identityId)}
);`;
}

async function createHostedAuthFixtures() {
  for (const user of Object.values(fixture.users)) {
    user.email = `${fixture.namespace}-${user.label}@example.invalid`;
    user.password = `${randomBytes(24).toString("base64url")}aA1!`;
    secrets.add(user.email);
    secrets.add(user.password);
  }
  runHostedSql(`${Object.values(fixture.users).map(authUserSql).join("\n")}
select 'auth-created' as fixture_state;`, "Hosted notification Auth fixture creation");
  hostedFixturesCreated = true;
}

function grantRow(label, workspaceId, capabilities, overrides = {}) {
  const status = overrides.status ?? "active";
  const validFrom = overrides.validFrom ?? "clock_timestamp() - interval '1 day'";
  const validUntil = overrides.validUntil ?? "null";
  const revokedAt = overrides.revokedAt ?? "null";
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, 'main_contact', ${sqlCapabilities(capabilities)}, ${sqlText(status)}, ${validFrom}, ${validUntil}, ${revokedAt})`;
}

function volunteerRow(label, workspaceId, overrides = {}) {
  const lifecycle = overrides.lifecycle ?? "active";
  const readiness = overrides.readiness ?? "ready";
  const email = Object.hasOwn(overrides, "email")
    ? overrides.email
    : `${fixture.namespace}-${label}@example.invalid`;
  const phone = Object.hasOwn(overrides, "phone") ? overrides.phone : null;
  return `(${sqlUuid(fixture.volunteers[label])}, ${sqlUuid(workspaceId)}, null, 'manual', ${sqlUuid(fixture.contacts.scheduler)}, clock_timestamp(), ${sqlText(lifecycle)}, ${sqlText(readiness)}, ${sqlText(`${fixture.namespace} ${label}`)}, ${sqlText(email)}, ${sqlText(phone)}, 'Bozeman QA', null, '{}'::jsonb, '{}'::jsonb, '')`;
}

function itemRow(label, workspaceId, title, overrides = {}) {
  const lifecycle = overrides.lifecycle ?? "active";
  const publication = overrides.publication ?? "published";
  const date = overrides.date ?? fixtureDates.future;
  const follow = Object.hasOwn(overrides, "follow")
    ? overrides.follow
    : fixture.contacts.scheduler;
  const createdBy = overrides.createdBy ?? fixture.contacts.scheduler;
  const publishedAt = publication === "published" ? "clock_timestamp()" : "null";
  const publishedBy = publication === "published" ? sqlUuid(createdBy) : "null";
  return `(${sqlUuid(fixture.items[label])}, ${sqlUuid(workspaceId)}, null, ${sqlText(title)}, 'general', 'timed', ${sqlText(date)}::date, null, '09:00'::time, '11:00'::time, 'America/Denver', 1, ${sqlText(`${label} notes`)}, '{}'::jsonb, ${sqlText(lifecycle)}, ${follow ? sqlUuid(follow) : "null"}, ${sqlUuid(createdBy)}, ${sqlText(publication)}, ${publishedAt}, ${publishedBy})`;
}

function assignmentRow(label, itemLabel, volunteerLabel, workspaceId = fixture.workspaceId, lifecycle = "active") {
  return `(${sqlUuid(fixture.assignments[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.items[itemLabel])}, ${sqlUuid(fixture.volunteers[volunteerLabel])}, ${sqlText(lifecycle)}, null, ${sqlUuid(fixture.users.scheduler.userId)})`;
}

function responseRow(label, workspaceId = fixture.workspaceId) {
  return `(${sqlUuid(fixture.responses[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.assignments[label])}, 'needs_response', 'project_contact', null, null, ${sqlUuid(fixture.users.scheduler.userId)})`;
}

async function createProductFixtures() {
  const browserSuccessTitle = `${fixture.namespace} Browser email success`;
  const browserFailureTitle = `${fixture.namespace} Browser email retry`;
  runHostedSql(`
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-target`)}, ${sqlText(`${fixture.namespace} Target`)}, 'active', 'America/Denver', ${sqlText(fixtureDates.future)}::date, ${sqlText(fixtureDates.future3)}::date, false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, ${sqlText(`${fixture.namespace} Other`)}, 'active', 'America/Denver', ${sqlText(fixtureDates.future)}::date, ${sqlText(fixtureDates.future3)}::date, false),
  (${sqlUuid(fixture.inactiveWorkspaceId)}, ${sqlText(`${fixture.namespace}-inactive`)}, ${sqlText(`${fixture.namespace} Inactive`)}, 'archived', 'America/Denver', ${sqlText(fixtureDates.future)}::date, ${sqlText(fixtureDates.future3)}::date, false);

insert into public.project_contacts (
  id, auth_user_id, status, volunteer_facing_display_name, volunteer_facing_email, volunteer_facing_phone
) values
  (${sqlUuid(fixture.contacts.scheduler)}, ${sqlUuid(fixture.users.scheduler.userId)}, 'active', 'QA Follow-up Contact', ${sqlText(`${fixture.namespace}-follow-up@example.invalid`)}, '406-555-0100'),
  (${sqlUuid(fixture.contacts.viewOnly)}, ${sqlUuid(fixture.users.viewOnly.userId)}, 'active', 'QA View Only', ${sqlText(`${fixture.namespace}-view@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.roleOnly)}, ${sqlUuid(fixture.users.roleOnly.userId)}, 'active', 'QA Role Only', ${sqlText(`${fixture.namespace}-role@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(fixture.users.other.userId)}, 'active', 'QA Other Contact', ${sqlText(`${fixture.namespace}-other-contact@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.revoked)}, ${sqlUuid(fixture.users.revoked.userId)}, 'active', 'QA Revoked Contact', ${sqlText(`${fixture.namespace}-revoked@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.expired)}, ${sqlUuid(fixture.users.expired.userId)}, 'active', 'QA Expired Contact', ${sqlText(`${fixture.namespace}-expired@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.inactiveGrant)}, ${sqlUuid(fixture.users.inactiveGrant.userId)}, 'active', 'QA Inactive Grant Contact', ${sqlText(`${fixture.namespace}-inactive-grant@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.inactiveContact)}, ${sqlUuid(fixture.users.inactiveContact.userId)}, 'inactive', 'QA Inactive Contact', ${sqlText(`${fixture.namespace}-inactive-contact@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.inactiveWorkspace)}, ${sqlUuid(fixture.users.inactiveWorkspace.userId)}, 'active', 'QA Inactive Workspace Contact', ${sqlText(`${fixture.namespace}-inactive-workspace@example.invalid`)}, null);

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  ${grantRow("scheduler", fixture.workspaceId, ["workspace.read", "calendar.view", "calendar.edit", "assignments.view", "assignments.edit", "volunteers.view"])},
  ${grantRow("viewOnly", fixture.workspaceId, ["workspace.read", "calendar.view", "assignments.view", "volunteers.view"])},
  ${grantRow("roleOnly", fixture.workspaceId, ["workspace.read"])},
  ${grantRow("other", fixture.otherWorkspaceId, ["workspace.read", "calendar.view", "calendar.edit", "assignments.view", "assignments.edit", "volunteers.view"])},
  ${grantRow("revoked", fixture.workspaceId, ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"], { status: "revoked", revokedAt: "clock_timestamp() - interval '1 hour'" })},
  ${grantRow("expired", fixture.workspaceId, ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"], { validUntil: "clock_timestamp() - interval '1 hour'" })},
  ${grantRow("inactiveGrant", fixture.workspaceId, ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"], { status: "inactive" })},
  ${grantRow("inactiveContact", fixture.workspaceId, ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"])},
  ${grantRow("inactiveWorkspace", fixture.inactiveWorkspaceId, ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"])};

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values
  ${volunteerRow("sendable", fixture.workspaceId)},
  ${volunteerRow("missingEmail", fixture.workspaceId, { email: null, phone: "406-555-0111" })},
  ${volunteerRow("malformedEmail", fixture.workspaceId, { email: "not-an-email" })},
  ${volunteerRow("inactive", fixture.workspaceId, { lifecycle: "inactive" })},
  ${volunteerRow("onHold", fixture.workspaceId, { readiness: "on_hold" })},
  ${volunteerRow("browserSuccess", fixture.workspaceId)},
  ${volunteerRow("browserFailure", fixture.workspaceId)},
  ${volunteerRow("concurrent", fixture.workspaceId)},
  ${volunteerRow("failureRetry", fixture.workspaceId)},
  ${volunteerRow("stale", fixture.workspaceId)},
  ${volunteerRow("freshSending", fixture.workspaceId)},
  ${volunteerRow("other", fixture.otherWorkspaceId)},
  ${volunteerRow("inactiveWorkspace", fixture.inactiveWorkspaceId)};

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
) values
  ${itemRow("summary", fixture.workspaceId, `${fixture.namespace} Summary email`)},
  ${itemRow("missingFollowUp", fixture.workspaceId, `${fixture.namespace} Missing follow`, { follow: null })},
  ${itemRow("draft", fixture.workspaceId, `${fixture.namespace} Draft email`, { publication: "draft" })},
  ${itemRow("archived", fixture.workspaceId, `${fixture.namespace} Archived email`, { lifecycle: "archived" })},
  ${itemRow("past", fixture.workspaceId, `${fixture.namespace} Past email`, { date: fixtureDates.past })},
  ${itemRow("canceledAssignment", fixture.workspaceId, `${fixture.namespace} Canceled assignment`)},
  ${itemRow("browserSuccess", fixture.workspaceId, browserSuccessTitle)},
  ${itemRow("browserFailure", fixture.workspaceId, browserFailureTitle)},
  ${itemRow("concurrent", fixture.workspaceId, `${fixture.namespace} Concurrent email`)},
  ${itemRow("failureRetry", fixture.workspaceId, `${fixture.namespace} Failure retry email`)},
  ${itemRow("stale", fixture.workspaceId, `${fixture.namespace} Stale email`)},
  ${itemRow("freshSending", fixture.workspaceId, `${fixture.namespace} Fresh sending email`)},
  ${itemRow("other", fixture.otherWorkspaceId, `${fixture.namespace} Other email`, { createdBy: fixture.contacts.other, follow: fixture.contacts.other })},
  ${itemRow("inactiveWorkspace", fixture.inactiveWorkspaceId, `${fixture.namespace} Inactive workspace email`, { createdBy: fixture.contacts.inactiveWorkspace, follow: fixture.contacts.inactiveWorkspace })};

insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values
  ${assignmentRow("summarySendable", "summary", "sendable")},
  ${assignmentRow("summaryMissingEmail", "summary", "missingEmail")},
  ${assignmentRow("summaryMalformedEmail", "summary", "malformedEmail")},
  ${assignmentRow("summaryInactive", "summary", "inactive")},
  ${assignmentRow("summaryOnHold", "summary", "onHold")},
  ${assignmentRow("missingFollowUp", "missingFollowUp", "sendable")},
  ${assignmentRow("draft", "draft", "sendable")},
  ${assignmentRow("archived", "archived", "sendable")},
  ${assignmentRow("past", "past", "sendable")},
  ${assignmentRow("canceled", "canceledAssignment", "sendable", fixture.workspaceId, "canceled")},
  ${assignmentRow("browserSuccess", "browserSuccess", "browserSuccess")},
  ${assignmentRow("browserFailure", "browserFailure", "browserFailure")},
  ${assignmentRow("concurrent", "concurrent", "concurrent")},
  ${assignmentRow("failureRetry", "failureRetry", "failureRetry")},
  ${assignmentRow("stale", "stale", "stale")},
  ${assignmentRow("freshSending", "freshSending", "freshSending")},
  ${assignmentRow("other", "other", "other", fixture.otherWorkspaceId)},
  ${assignmentRow("inactiveWorkspace", "inactiveWorkspace", "inactiveWorkspace", fixture.inactiveWorkspaceId)};

insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
) values
  ${responseRow("summarySendable")},
  ${responseRow("summaryMissingEmail")},
  ${responseRow("summaryMalformedEmail")},
  ${responseRow("summaryInactive")},
  ${responseRow("summaryOnHold")},
  ${responseRow("missingFollowUp")},
  ${responseRow("draft")},
  ${responseRow("archived")},
  ${responseRow("past")},
  ${responseRow("canceled")},
  ${responseRow("browserSuccess")},
  ${responseRow("browserFailure")},
  ${responseRow("concurrent")},
  ${responseRow("failureRetry")},
  ${responseRow("stale")},
  ${responseRow("freshSending")},
  ${responseRow("other", fixture.otherWorkspaceId)},
  ${responseRow("inactiveWorkspace", fixture.inactiveWorkspaceId)};

insert into public.assignment_notification_deliveries (
  id, workspace_id, calendar_item_id, calendar_assignment_id, volunteer_profile_id,
  notification_kind, template_version, delivery_state, attempt_count,
  recipient_email_snapshot, idempotency_key, initiated_by_project_contact_id,
  sending_started_at, sending_expires_at
) values
  (${sqlUuid(fixture.deliveries.stale)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.stale)}, ${sqlUuid(fixture.assignments.stale)}, ${sqlUuid(fixture.volunteers.stale)}, 'initial_assignment', 'initial-assignment.v1', 'sending', 1, ${sqlText(`${fixture.namespace}-stale@example.invalid`)}, ${sqlText(`initial_assignment:initial-assignment.v1:${fixture.assignments.stale}`)}, ${sqlUuid(fixture.contacts.scheduler)}, clock_timestamp() - interval '30 minutes', clock_timestamp() - interval '15 minutes'),
  (${sqlUuid(fixture.deliveries.freshSending)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.items.freshSending)}, ${sqlUuid(fixture.assignments.freshSending)}, ${sqlUuid(fixture.volunteers.freshSending)}, 'initial_assignment', 'initial-assignment.v1', 'sending', 1, ${sqlText(`${fixture.namespace}-fresh@example.invalid`)}, ${sqlText(`initial_assignment:initial-assignment.v1:${fixture.assignments.freshSending}`)}, ${sqlUuid(fixture.contacts.scheduler)}, clock_timestamp(), clock_timestamp() + interval '15 minutes');

select 'fixtures-created' as fixture_state;`, "Hosted notification product fixture creation");
}

async function signInHostedUsers() {
  for (const user of Object.values(fixture.users)) {
    user.client = hostedAppClient();
    const signIn = await user.client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    assert(!signIn.error && signIn.data.session, `Hosted sign-in failed for ${user.label}.`);
    secrets.add(signIn.data.session.access_token);
    secrets.add(signIn.data.session.refresh_token);
  }
}

async function createSchedulerBrowserCookies() {
  const cookieJar = new Map();
  const client = createBrowserClient(hostedUrl, hostedAnonKey, {
    cookies: {
      getAll() {
        return Array.from(cookieJar.values()).map(({ name, value }) => ({ name, value }));
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
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  const signIn = await client.auth.signInWithPassword({
    email: fixture.users.scheduler.email,
    password: fixture.users.scheduler.password,
  });
  assert(!signIn.error && signIn.data.session, "Hosted browser sign-in failed.");
  secrets.add(signIn.data.session.access_token);
  secrets.add(signIn.data.session.refresh_token);
  for (const cookie of cookieJar.values()) secrets.add(cookie.value);
  assert(cookieJar.size > 0, "Hosted browser sign-in did not create SSR cookies.");
  schedulerCookieJar = cookieJar;
}

async function addSchedulerCookies(context) {
  assert(schedulerCookieJar?.size > 0, "Missing hosted scheduler browser cookies.");
  await context.addCookies(
    Array.from(schedulerCookieJar.values()).map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: "127.0.0.1",
      path: cookie.options?.path ?? "/",
      httpOnly: Boolean(cookie.options?.httpOnly),
      secure: false,
      sameSite: "Lax",
    })),
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

async function verifyRpcBehavior(recordingPath) {
  const scheduler = fixture.users.scheduler.client;
  const summary = await readInitialAssignmentNotificationSummariesWithClient({
    supabase: scheduler,
    calendarItemIds: [fixture.items.summary, fixture.items.missingFollowUp, fixture.items.draft],
    canSendInitialAssignmentNotifications: true,
  });
  assert.equal(summary.kind, "ready", "Hosted summary helper should be ready for scheduler.");
  const summaryRow = summary.summaries.find((row) => row.calendarItemId === fixture.items.summary);
  assert(summaryRow, "Hosted summary row is missing.");
  assert.equal(summaryRow.eligibleToSendCount, 1, "Hosted ready-to-send summary count drifted.");
  assert.equal(summaryRow.missingEmailCount, 2, "Hosted missing-email/malformed-email count drifted.");
  assert(summaryRow.ineligibleCount >= 2, "Hosted ineligible summary count did not include inactive/on-hold volunteers.");
  const missingFollowRow = summary.summaries.find((row) => row.calendarItemId === fixture.items.missingFollowUp);
  assert.equal(missingFollowRow?.missingFollowUpContactCount, 1, "Hosted missing Follow-up Contact count drifted.");

  const readOnlySummary = await readInitialAssignmentNotificationSummariesWithClient({
    supabase: fixture.users.viewOnly.client,
    calendarItemIds: [fixture.items.summary],
    canSendInitialAssignmentNotifications: true,
  });
  assert.equal(readOnlySummary.kind, "ready");
  assert.equal(readOnlySummary.summaries.length, 0, "Read-only contact received hosted notification summaries.");

  const disabled = readInitialAssignmentEmailConfiguration({});
  await expectFailure("hosted disabled transport", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      scheduler,
      { calendarItemId: fixture.items.summary },
      disabled,
    ),
  );

  const config = readInitialAssignmentEmailConfiguration({
    ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "recording",
    ASSIGNMENT_NOTIFICATION_BASE_URL: previewBaseUrl,
    ASSIGNMENT_NOTIFICATION_FROM: `${fixture.namespace}-sender@example.invalid`,
    ASSIGNMENT_NOTIFICATION_RECORDING_PATH: recordingPath,
  });
  assert(config.ok, "Hosted recording config should be valid.");

  const first = await sendInitialAssignmentNotificationsForItemWithClient(
    scheduler,
    { calendarItemId: fixture.items.summary },
    config,
  );
  assert.equal(first.sentCount, 1, "Hosted first send did not send exactly one eligible assignment.");
  assert.equal(first.skippedCount, 4, "Hosted first send did not skip missing/ineligible assignments safely.");

  const lines = readRecordingLines(recordingPath);
  assert.equal(lines.length, 1, "Hosted first send should record one provider call.");
  assertSafeRecording(lines);

  const duplicate = await sendInitialAssignmentNotificationsForItemWithClient(
    scheduler,
    { calendarItemId: fixture.items.summary },
    config,
  );
  assert.equal(duplicate.sentCount, 0, "Hosted duplicate should not send.");
  assert(duplicate.alreadySentCount >= 1, "Hosted duplicate did not report already sent.");
  assert.equal(readRecordingLines(recordingPath).length, 1, "Hosted duplicate created another provider recording.");

  const concurrentBefore = readRecordingLines(recordingPath).length;
  const [a, b] = await Promise.allSettled([
    sendInitialAssignmentNotificationsForItemWithClient(scheduler, { calendarItemId: fixture.items.concurrent }, config),
    sendInitialAssignmentNotificationsForItemWithClient(scheduler, { calendarItemId: fixture.items.concurrent }, config),
  ]);
  assert(a.status === "fulfilled" && b.status === "fulfilled", "Hosted concurrent sends should resolve safely.");
  const concurrentAfter = readRecordingLines(recordingPath).length;
  assert.equal(concurrentAfter - concurrentBefore, 1, "Hosted concurrent sends recorded more than one provider call.");

  const badPath = path.join(tempDir, "missing-parent", "failure.jsonl");
  const failingConfig = readInitialAssignmentEmailConfiguration({
    ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "recording",
    ASSIGNMENT_NOTIFICATION_BASE_URL: previewBaseUrl,
    ASSIGNMENT_NOTIFICATION_FROM: `${fixture.namespace}-sender@example.invalid`,
    ASSIGNMENT_NOTIFICATION_RECORDING_PATH: badPath,
  });
  assert(failingConfig.ok, "Hosted deterministic failure config should parse.");
  const failed = await sendInitialAssignmentNotificationsForItemWithClient(
    scheduler,
    { calendarItemId: fixture.items.failureRetry },
    failingConfig,
  );
  assert.equal(failed.failedCount, 1, "Hosted provider failure did not finalize one failed delivery.");
  assert(failed.tokenRevokedAfterFailureCount >= 1, "Hosted provider failure did not revoke issued schedule token.");
  const retryBefore = readRecordingLines(recordingPath).length;
  const retry = await sendInitialAssignmentNotificationsForItemWithClient(
    scheduler,
    { calendarItemId: fixture.items.failureRetry },
    config,
  );
  assert.equal(retry.sentCount, 1, "Hosted retry after failure did not succeed.");
  assert.equal(readRecordingLines(recordingPath).length - retryBefore, 1, "Hosted retry did not record exactly one provider call.");

  const staleBefore = readRecordingLines(recordingPath).length;
  const stale = await sendInitialAssignmentNotificationsForItemWithClient(
    scheduler,
    { calendarItemId: fixture.items.stale },
    config,
  );
  assert.equal(stale.sentCount, 1, "Hosted stale sending row was not recoverable.");
  assert.equal(readRecordingLines(recordingPath).length - staleBefore, 1, "Hosted stale recovery did not send once.");

  const fresh = await scheduler.rpc("claim_initial_assignment_notification_deliveries", {
    p_calendar_item_id: fixture.items.freshSending,
  });
  assert(!fresh.error, "Hosted non-stale sending claim check failed.");
  assert.equal(fresh.data?.[0]?.send_status, "already_sending", "Hosted non-stale sending row was stolen.");

  await expectFailure("hosted view-only send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      fixture.users.viewOnly.client,
      { calendarItemId: fixture.items.browserSuccess },
      config,
    ),
  );
  await expectFailure("hosted role-only send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      fixture.users.roleOnly.client,
      { calendarItemId: fixture.items.browserSuccess },
      config,
    ),
  );
  await expectFailure("hosted wrong-workspace send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      fixture.users.other.client,
      { calendarItemId: fixture.items.browserSuccess },
      config,
    ),
  );
  for (const label of ["revoked", "expired", "inactiveGrant", "inactiveContact"]) {
    await expectFailure(`hosted ${label} send`, () =>
      sendInitialAssignmentNotificationsForItemWithClient(
        fixture.users[label].client,
        { calendarItemId: fixture.items.browserSuccess },
        config,
      ),
    );
  }
  await expectFailure("hosted inactive workspace send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(
      fixture.users.inactiveWorkspace.client,
      { calendarItemId: fixture.items.inactiveWorkspace },
      config,
    ),
  );
  await expectFailure("hosted draft send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(scheduler, { calendarItemId: fixture.items.draft }, config),
  );
  await expectFailure("hosted archived send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(scheduler, { calendarItemId: fixture.items.archived }, config),
  );
  await expectFailure("hosted past send", () =>
    sendInitialAssignmentNotificationsForItemWithClient(scheduler, { calendarItemId: fixture.items.past }, config),
  );

  const anon = hostedAppClient();
  const directChecks = await Promise.all([
    scheduler.from("assignment_notification_deliveries").insert({
      workspace_id: fixture.workspaceId,
      calendar_item_id: fixture.items.summary,
      calendar_assignment_id: fixture.assignments.summarySendable,
      volunteer_profile_id: fixture.volunteers.sendable,
      delivery_state: "sent",
      idempotency_key: "forged",
    }),
    scheduler.from("assignment_notification_deliveries").update({ delivery_state: "failed" }).eq("workspace_id", fixture.workspaceId),
    scheduler.from("assignment_notification_deliveries").delete().eq("workspace_id", fixture.workspaceId),
    anon.from("assignment_notification_deliveries").insert({
      workspace_id: fixture.workspaceId,
      calendar_item_id: fixture.items.summary,
      calendar_assignment_id: fixture.assignments.summarySendable,
      volunteer_profile_id: fixture.volunteers.sendable,
      delivery_state: "sent",
      idempotency_key: "anon-forged",
    }),
  ]);
  assert(directChecks.every((result) => result.error), "Hosted direct delivery table writes were not denied.");

  const finalEdge = await scheduler.rpc("finalize_initial_assignment_notification_delivery", {
    p_delivery_id: fixture.deliveries.freshSending,
    p_delivery_state: "sent",
    p_provider_message_id: "raw stack trace\nsecret",
    p_safe_failure_code: null,
  });
  assert(finalEdge.error, "Hosted malformed finalization provider id was accepted.");
}

function readRecordingLines(recordingPath) {
  if (!existsSync(recordingPath)) return [];
  const content = readFileSync(recordingPath, "utf8").trim();
  return content ? content.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

function assertSafeRecording(lines) {
  const serialized = JSON.stringify(lines);
  assert(serialized.includes("/v/access/[redacted]"), "Recording output did not include redacted schedule path.");
  assert(!/\/v\/access\/[A-Za-z0-9_-]{43}/.test(serialized), "Recording output leaked a full schedule access URL.");
  assert(!serialized.includes(`${fixture.namespace}-sendable@example.invalid`), "Recording output leaked raw recipient email.");
  assert(!serialized.includes(hostedAnonKey), "Recording output leaked hosted anon key.");
  assert(!/eyJ[A-Za-z0-9_-]+\./.test(serialized), "Recording output leaked a JWT-like token.");
}

async function verifyDatabaseStateAfterRpc() {
  const row = runHostedSql(`select
  (select count(*) from public.assignment_notification_deliveries where workspace_id = ${sqlUuid(fixture.workspaceId)} and delivery_state = 'sent')::int as sent_count,
  (select count(*) from public.assignment_notification_deliveries where workspace_id = ${sqlUuid(fixture.workspaceId)} and safe_failure_code = 'missing_recipient_email')::int as missing_email_count,
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)} and token_verifier_hash is not null)::int as schedule_token_count,
  (select count(*) from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as response_token_count,
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as reveal_event_count;`, "Hosted notification post-RPC state")[0];
  assert(row.sent_count >= 4, "Hosted sent delivery state count is lower than expected.");
  assert(row.missing_email_count >= 2, "Hosted missing recipient failures were not persisted safely.");
  assert(row.schedule_token_count >= 4, "Hosted schedule access credentials were not issued.");
  assert.equal(row.response_token_count, 0, "Hosted notification flow created assignment response tokens.");
  assert.equal(row.reveal_event_count, 0, "Hosted notification flow created response-link reveal events.");
}

function safeLogTail(file) {
  try {
    return readFileSync(file, "utf8").split(/\r?\n/).slice(-40).join("\n");
  } catch {
    return "";
  }
}

function hostedPreviewEnv(anonKey, recordingPath) {
  const passthrough = [
    "PATH",
    "Path",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "COMSPEC",
    "PATHEXT",
    "HOME",
  ];
  const env = {};
  for (const key of passthrough) {
    if (typeof process.env[key] === "string") env[key] = process.env[key];
  }
  return {
    ...env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: hostedUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
    ADMIN_AUTH_MODE: "enforced",
    ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "recording",
    ASSIGNMENT_NOTIFICATION_BASE_URL: previewBaseUrl,
    ASSIGNMENT_NOTIFICATION_FROM: `${fixture.namespace}-sender@example.invalid`,
    ASSIGNMENT_NOTIFICATION_RECORDING_PATH: recordingPath,
    SUPABASE_SERVICE_ROLE_KEY: "",
  };
}

async function startHostedPreview(recordingPath) {
  const out = path.join(tempDir, `preview-${randomUUID()}.out.log`);
  const err = path.join(tempDir, `preview-${randomUUID()}.err.log`);
  const env = hostedPreviewEnv(hostedAnonKey, recordingPath);

  const buildCommand = npmInvocation(["run", "build"]);
  const build = command(buildCommand.commandName, buildCommand.args, { env });
  if (build.status !== 0) {
    throw new Error(`Hosted notification preview build failed: ${redact([build.error?.message, build.stderr, build.stdout].filter(Boolean).join("\n") || "No diagnostic was returned.")}`);
  }

  writeFileSync(out, "", "utf8");
  writeFileSync(err, "", "utf8");
  const outFd = openSync(out, "a");
  const errFd = openSync(err, "a");
  const previewCommand = npmInvocation(["run", "preview", "--", "-H", "127.0.0.1", "-p", "3000"]);
  previewProcess = spawn(previewCommand.commandName, previewCommand.args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ["ignore", outFd, errFd],
  });
  closeSync(outFd);
  closeSync(errFd);

  const deadline = Date.now() + 35_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(createPreviewUrl(previewBaseUrl, "/admin/calendar"), { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Hosted-backed notification preview did not become available. ${redact(safeLogTail(err) || safeLogTail(out) || "Preview logs were empty.")}`);
}

async function stopHostedPreview() {
  if (previewProcess?.pid) {
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(previewProcess.pid), "/t", "/f"], {
          windowsHide: true,
          encoding: "utf8",
        });
      } else {
        previewProcess.kill("SIGTERM");
      }
    } catch {
      // best effort
    }
  }
  previewProcess = null;
  try {
    await fetch(createPreviewUrl(previewBaseUrl, "/admin/calendar"), { signal: AbortSignal.timeout(1500) });
    throw new Error("Hosted notification preview is still serving after shutdown.");
  } catch (error) {
    if (String(error?.message ?? "").includes("still serving")) throw error;
  }
}

async function openCalendarItem(page, title, date = fixtureDates.future) {
  await page.goto(createPreviewUrl(previewBaseUrl, `/admin/calendar?view=week&date=${date}`), {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: new RegExp(escapeRegExp(title)) }).first().click();
  await page.getByRole("dialog").getByText("Initial email", { exact: true }).waitFor();
}

async function assertNoBrowserLeak(page, recordingPath) {
  const content = await page.content();
  const bodyText = await page.locator("body").innerText();
  const recording = existsSync(recordingPath) ? readFileSync(recordingPath, "utf8") : "";
  const combined = `${content}\n${bodyText}\n${recording}`;
  assert(!/\/v\/access\/[A-Za-z0-9_-]{43}/.test(combined), "Browser/recording leaked a full schedule access URL.");
  assert(!/eyJ[A-Za-z0-9_-]+\./.test(combined), "Browser/recording leaked JWT-like material.");
  assert(!combined.includes(hostedAnonKey), "Browser/recording leaked hosted anon key.");
  assert(!combined.includes("workspace_contact_grants"), "Browser leaked internal grant table name.");
}

async function verifyBrowserFlow() {
  const successRecording = path.join(tempDir, "browser-success.jsonl");
  await startHostedPreview(successRecording);
  let browser;
  try {
    browser = await chromium.launch(browserExecutable ? { executablePath: browserExecutable } : {});
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await addSchedulerCookies(context);
    const page = await context.newPage();
    await openCalendarItem(page, `${fixture.namespace} Browser email success`);
    let dialog = page.getByRole("dialog");
    await dialog.getByText("Ready to send: 1", { exact: true }).waitFor();
    await Promise.all([
      page.waitForURL(/notice=assignment_email_sent/),
      dialog.getByRole("button", { name: "Send initial assignment emails", exact: true }).click(),
    ]);
    await page.getByText("Initial assignment email sent", { exact: true }).waitFor();
    assert.equal(readRecordingLines(successRecording).length, 1, "Browser success send did not record once.");
    await page.reload({ waitUntil: "networkidle" });
    await openCalendarItem(page, `${fixture.namespace} Browser email success`);
    dialog = page.getByRole("dialog");
    await dialog.getByText("Already sent: 1", { exact: true }).waitFor();
    const button = dialog.getByRole("button", { name: "Send initial assignment emails", exact: true });
    await assertNoBrowserLeak(page, successRecording);
    assert(await button.isDisabled(), "Already-sent browser action should be disabled.");
    assert.equal(readRecordingLines(successRecording).length, 1, "Already-sent browser state created another recording.");

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await addSchedulerCookies(mobile);
    const mobilePage = await mobile.newPage();
    await openCalendarItem(mobilePage, `${fixture.namespace} Browser email success`);
    await mobilePage.getByRole("dialog").getByText("Initial email", { exact: true }).waitFor();
    const overflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(overflow, false, "Hosted browser mobile Calendar had horizontal overflow.");
    await assertNoBrowserLeak(mobilePage, successRecording);
    await mobile.close();
    await context.close();
  } finally {
    if (browser) await browser.close();
    await stopHostedPreview();
  }

  const failureRecording = path.join(tempDir, "browser-failure.jsonl");
  const badPath = path.join(tempDir, "missing-browser-parent", "failure.jsonl");
  await startHostedPreview(badPath);
  try {
    browser = await chromium.launch(browserExecutable ? { executablePath: browserExecutable } : {});
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await addSchedulerCookies(context);
    const page = await context.newPage();
    await openCalendarItem(page, `${fixture.namespace} Browser email retry`);
    const dialog = page.getByRole("dialog");
    await Promise.all([
      page.waitForURL(/notice=assignment_email_partial/),
      dialog.getByRole("button", { name: "Send initial assignment emails", exact: true }).click(),
    ]);
    await page.getByText("Initial email partially sent", { exact: true }).waitFor();
    await assertNoBrowserLeak(page, badPath);
    await context.close();
  } finally {
    if (browser) await browser.close();
    await stopHostedPreview();
  }

  await startHostedPreview(failureRecording);
  try {
    browser = await chromium.launch(browserExecutable ? { executablePath: browserExecutable } : {});
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await addSchedulerCookies(context);
    const page = await context.newPage();
    await openCalendarItem(page, `${fixture.namespace} Browser email retry`);
    const dialog = page.getByRole("dialog");
    await Promise.all([
      page.waitForURL(/notice=assignment_email_sent/),
      dialog.getByRole("button", { name: "Send initial assignment emails", exact: true }).click(),
    ]);
    await page.getByText("Initial assignment email sent", { exact: true }).waitFor();
    assert.equal(readRecordingLines(failureRecording).length, 1, "Browser retry success did not record once.");
    await assertNoBrowserLeak(page, failureRecording);
    await context.close();
  } finally {
    if (browser) await browser.close();
    await stopHostedPreview();
  }
}

function idArray(values) {
  return values.map(sqlUuid).join(", ") || "null::uuid";
}

function cleanupHostedFixtures() {
  for (const user of Object.values(fixture.users)) {
    if (user.client) user.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  const workspaceIds = idArray([fixture.workspaceId, fixture.otherWorkspaceId, fixture.inactiveWorkspaceId]);
  const contactIds = idArray(Object.values(fixture.contacts));
  const userIds = idArray(Object.values(fixture.users).map((user) => user.userId));
  runHostedSql(`begin;
delete from public.assignment_notification_deliveries where workspace_id in (${workspaceIds});
delete from public.volunteer_schedule_access_tokens where workspace_id in (${workspaceIds});
delete from public.assignment_response_tokens where workspace_id in (${workspaceIds});
delete from public.assignment_response_link_reveal_events where workspace_id in (${workspaceIds});
delete from public.assignment_responses where workspace_id in (${workspaceIds});
delete from public.calendar_assignments where workspace_id in (${workspaceIds});
delete from public.calendar_items where workspace_id in (${workspaceIds});
delete from public.volunteer_profiles where workspace_id in (${workspaceIds});
delete from public.workspace_contact_grants where workspace_id in (${workspaceIds}) or project_contact_id in (${contactIds});
delete from public.project_contacts where id in (${contactIds}) or auth_user_id in (${userIds});
delete from public.workspaces where id in (${workspaceIds}) or workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.identities where user_id in (${userIds});
delete from auth.users where id in (${userIds}) or email like ${sqlText(`${fixture.namespace}%`)};
commit;`, "Hosted notification cleanup");
  cleanupCompleted = true;
}

function verifyZeroResidue() {
  const workspaceIds = idArray([fixture.workspaceId, fixture.otherWorkspaceId, fixture.inactiveWorkspaceId]);
  const contactIds = idArray(Object.values(fixture.contacts));
  const userIds = idArray(Object.values(fixture.users).map((user) => user.userId));
  const exact = runHostedSql(`select (
  (select count(*) from public.assignment_notification_deliveries where workspace_id in (${workspaceIds})) +
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id in (${workspaceIds})) +
  (select count(*) from public.assignment_responses where workspace_id in (${workspaceIds})) +
  (select count(*) from public.calendar_assignments where workspace_id in (${workspaceIds})) +
  (select count(*) from public.calendar_items where workspace_id in (${workspaceIds})) +
  (select count(*) from public.volunteer_profiles where workspace_id in (${workspaceIds})) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (${workspaceIds}) or project_contact_id in (${contactIds})) +
  (select count(*) from public.project_contacts where id in (${contactIds}) or auth_user_id in (${userIds})) +
  (select count(*) from public.workspaces where id in (${workspaceIds})) +
  (select count(*) from auth.users where id in (${userIds}))
)::int as residue_count;`, "Hosted notification exact residue check")[0]?.residue_count;
  const namespace = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}%`)})
)::int as residue_count;`, "Hosted notification namespace residue check")[0]?.residue_count;
  exactResidueCount = Number(exact);
  namespaceResidueCount = Number(namespace);
  assert.equal(exactResidueCount, 0, "Hosted exact-run disposable residue remains.");
  assert.equal(namespaceResidueCount, 0, "Hosted namespace disposable residue remains.");
  assert.equal(latestHostedMigration(), expectedAfterMigration, "Hosted migration level drifted after cleanup.");
}

async function main() {
  try {
    await verifyStaticBoundaries();
    await verifyTargetAndReadAnonKey();
    await ensureExpectedMigrationApplied();
    await verifyGeneratedTypes();
    tempDir = await mkdtemp(path.join(tmpdir(), "pl-12-22-1-"));
    const recordingPath = path.join(tempDir, "hosted-rpc-recording.jsonl");
    await createHostedAuthFixtures();
    await createProductFixtures();
    await signInHostedUsers();
    await createSchedulerBrowserCookies();
    await verifyRpcBehavior(recordingPath);
    await verifyDatabaseStateAfterRpc();
    await verifyBrowserFlow();
  } catch (error) {
    console.error(redact(error));
    process.exitCode = 1;
  } finally {
    try {
      await stopHostedPreview();
    } catch (error) {
      console.error(redact(error));
      process.exitCode = 1;
    }
    try {
      if (hostedFixturesCreated) {
        cleanupHostedFixtures();
        verifyZeroResidue();
      }
    } catch (error) {
      console.error(redact(error));
      process.exitCode = 1;
    }
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // best effort
      }
    }
  }

  assert(!hostedFixturesCreated || cleanupCompleted, "Hosted cleanup did not complete.");
  if (process.exitCode) return;
  console.log(`Hosted initial assignment notification validation passed for ${expectedName} (${expectedRef}).`);
  console.log(`Project health: ${projectStatus}. Migration before: ${migrationBefore}. Migration after: ${migrationAfter}.`);
  console.log("Validated generated-type parity, summaries, claim/finalize, duplicate/concurrency, failure/retry, stale-claim recovery, schedule-access secrecy, browser explicit-send flow, 390px layout, safe recording transport, and zero hosted residue.");
  console.log(`Hosted disposable residue: exact=${exactResidueCount}, namespace=${namespaceResidueCount}.`);
  console.log("No real external email, schedule bearer, full schedule URL, response token, credential, raw provider payload, or service credential was logged.");
}

await main();
