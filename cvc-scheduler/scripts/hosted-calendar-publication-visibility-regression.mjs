import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedBeforeMigration = "20260714121800";
const expectedAfterMigration = "20260714121900";
const expectedMigrationFile = `${expectedAfterMigration}_calendar_publication_visibility.sql`;
const hostedUrl = `https://${expectedRef}.supabase.co`;
const secrets = new Set();

const fixture = {
  namespace: `qa-12-19-1-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  inactiveWorkspaceId: randomUUID(),
  taskPresetId: randomUUID(),
  otherTaskPresetId: randomUUID(),
  volunteers: {
    readyA: randomUUID(),
    readyB: randomUUID(),
    other: randomUUID(),
  },
  legacyUnknownItemId: randomUUID(),
  legacyAssignmentId: randomUUID(),
  legacyResponseId: randomUUID(),
  legacyTokenId: randomUUID(),
  legacyBearerToken: randomBytes(32).toString("base64url"),
  createdDraftId: null,
  presetDraftId: null,
  publishedAssignmentId: null,
  draftAssignmentId: null,
  users: Object.fromEntries(
    [
      "owner",
      "editor",
      "readOnly",
      "calendarOnly",
      "assignmentsOnly",
      "tasksOnly",
      "roleOnly",
      "other",
      "revoked",
      "expired",
      "inactive",
      "inactiveContact",
      "inactiveWorkspace",
    ].map((label) => [
      label,
      {
        label,
        userId: randomUUID(),
        identityId: randomUUID(),
        contactId: randomUUID(),
        grantId: randomUUID(),
        email: "",
        password: "",
        client: null,
      },
    ]),
  ),
};

let cleanupCompleted = false;
let exactResidueCount = null;
let namespaceResidueCount = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .replace(/(?:password|apikey|api_key|access_token|refresh_token|bearer)=\S+/gi, "$1=[redacted]");
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
    maxBuffer: 50 * 1024 * 1024,
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
    output = runSupabaseCli(["db", "query", "--linked", "--file", file, "--output", "json"]);
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // Best-effort only; temp file contains disposable validation SQL, not credentials.
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
    process.env.RUN_HOSTED_CALENDAR_PUBLICATION_VISIBILITY_VALIDATION === expectedConfirmation,
    `Refusing hosted validation without RUN_HOSTED_CALENDAR_PUBLICATION_VISIBILITY_VALIDATION=${expectedConfirmation}.`,
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
  return { anonKey, projectStatus: project.status };
}

async function ensureExpectedMigrationApplied() {
  const before = latestHostedMigration();
  assert(
    before === expectedBeforeMigration || before === expectedAfterMigration,
    `Hosted staging latest migration is ${before ?? "unavailable"}, not ${expectedBeforeMigration} or ${expectedAfterMigration}.`,
  );

  if (before === expectedBeforeMigration) {
    const localPending = await localMigrationVersionsAfter(before);
    assert(
      JSON.stringify(localPending) === JSON.stringify([expectedAfterMigration]),
      `Unexpected local pending migrations for hosted staging: ${localPending.join(", ") || "none"}.`,
    );

    const dryRun = runSupabaseCli(["db", "push", "--linked", "--dry-run", "--yes"], {
      includeStderr: true,
    });
    assert(
      dryRun.includes(expectedMigrationFile) || dryRun.includes(expectedAfterMigration),
      "Hosted migration dry-run did not identify the reviewed 12.19 migration.",
    );
    for (const match of dryRun.matchAll(/\b20\d{12}\b/g)) {
      assert(
        match[0] <= expectedBeforeMigration || match[0] === expectedAfterMigration,
        `Hosted migration dry-run included unexpected migration ${match[0]}.`,
      );
    }

    runSupabaseCli(["db", "push", "--linked", "--yes"], {
      sensitiveOutput: true,
      stage: "Hosted reviewed migration application",
    });
  }

  const after = latestHostedMigration();
  assert(after === expectedAfterMigration, `Hosted staging did not reach ${expectedAfterMigration}.`);
  return { before, after };
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  }))).flat();
}

async function verifyStaticBoundaries() {
  const [migration, calendarServer, route, client, packageJson] = await Promise.all([
    readFile(path.join(root, "supabase", "migrations", expectedMigrationFile), "utf8"),
    readFile(path.join(root, "lib", "calendar", "server.ts"), "utf8"),
    readFile(path.join(root, "app", "admin", "calendar", "page.tsx"), "utf8"),
    readFile(path.join(root, "components", "CalendarClient.tsx"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);
  assert(migration.includes("publication_state") && migration.includes("created_by_project_contact_id"), "12.19 publication columns are missing.");
  assert(migration.includes("published_at") && migration.includes("published_by_project_contact_id"), "12.19 published metadata columns are missing.");
  assert(migration.includes("create or replace function public.publish_calendar_item"), "publish_calendar_item RPC is missing.");
  assert(migration.includes("created_by_project_contact_id = contact.id"), "Draft owner-only rule is missing from publication migration.");
  assert(migration.includes("item.publication_state = 'published'"), "Draft response-token/public-response prohibition is missing.");
  assert(migration.includes("grant execute on function public.publish_calendar_item"), "publish_calendar_item execute grant is missing.");
  assert(calendarServer.includes("publish_calendar_item"), "Calendar server helper does not call publish_calendar_item.");
  assert(route.includes("publishCalendarItemAction"), "Calendar route does not expose the publish server action.");
  assert(client.includes("Private draft") && client.includes("Publish item"), "Calendar client publication UI is missing.");
  assert(packageJson.includes("test:calendar-publication-visibility:hosted"), "Hosted publication package script is missing.");
  assert(!/unpublish|returnToDraft|return_to_draft/i.test(`${migration}\n${calendarServer}\n${route}\n${client}`), "12.19 introduced unpublish/return-to-draft behavior.");
  assert(!/sendEmail|sendAssignment|delivery_queue|remembered_device|public_lookup|volunteer_schedule_credential/i.test(`${migration}\n${calendarServer}\n${route}\n${client}`), "12.19 appears to activate email, delivery, public lookup, or volunteer schedule access.");
  assert(!/SUPABASE_SERVICE_ROLE_KEY|createServiceRole|auth\.admin/i.test(`${calendarServer}\n${route}\n${client}`), "Publication product path references a service-role shortcut.");

  for (const directory of ["app", "components"]) {
    for (const file of (await collectFiles(path.join(root, directory))).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
      const content = await readFile(file, "utf8");
      assert(!content.includes("select(\"*\")") && !content.includes("select('*')"), `Product route/component introduced select-star: ${path.relative(root, file)}`);
    }
  }
}

function authUserSql({ userId, identityId, email, password }) {
  return `insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid, ${sqlUuid(userId)},
  'authenticated', 'authenticated', ${sqlText(email)}, extensions.crypt(${sqlText(password)}, extensions.gen_salt('bf')), clock_timestamp(),
  '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, clock_timestamp(), clock_timestamp()
);
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
) values (
  ${sqlText(userId)}, ${sqlUuid(userId)},
  jsonb_build_object('sub', ${sqlText(userId)}, 'email', ${sqlText(email)}),
  'email', clock_timestamp(), clock_timestamp(), clock_timestamp(), ${sqlUuid(identityId)}
);`;
}

function userValues(label) {
  const user = fixture.users[label];
  user.email = `${fixture.namespace}-${label}@example.invalid`;
  user.password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(user.email);
  secrets.add(user.password);
  return user;
}

function workspaceRow(id, key, name, lifecycle = "active") {
  return `(${sqlUuid(id)}, ${sqlText(key)}, ${sqlText(name)}, ${sqlText(lifecycle)}, 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false)`;
}

function grantRow(label, workspaceId, role, capabilities, status = "active", validity = "current") {
  const user = fixture.users[label];
  const revokedAt = status === "revoked" ? "clock_timestamp()" : "null";
  const validFrom = validity === "expired" ? "clock_timestamp() - interval '4 days'" : "clock_timestamp() - interval '1 day'";
  const validUntil = validity === "expired" ? "clock_timestamp() - interval '1 day'" : "null";
  return `(${sqlUuid(user.grantId)}, ${sqlUuid(workspaceId)}, ${sqlUuid(user.contactId)}, ${sqlText(role)}, ${sqlCapabilities(capabilities)}, ${sqlText(status)}, ${validFrom}, ${validUntil}, ${revokedAt})`;
}

function volunteerRow(id, workspaceId, fullName, contactId) {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, null, 'manual', ${sqlUuid(contactId)}, clock_timestamp(), 'active', 'ready', ${sqlText(fullName)}, ${sqlText(`${fullName.replaceAll(" ", ".").toLowerCase()}@example.invalid`)}, '+1 555 010 1919', 'Bozeman QA', 'Email', '{}'::jsonb, '{}'::jsonb, 'Hosted private QA note')`;
}

async function createFixtures(anonKey) {
  for (const label of Object.keys(fixture.users)) userValues(label);
  secrets.add(fixture.legacyBearerToken);

  runHostedSql(`begin;
${Object.values(fixture.users).map(authUserSql).join("\n")}
commit;
select 'auth-created' as fixture_state;`, "Hosted Calendar publication Auth fixture creation");

  const fullCaps = ["workspace.read", "calendar.view", "assignments.view", "calendar.edit", "assignments.edit", "volunteers.view", "tasks.view", "tasks.edit"];
  runHostedSql(`begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled
) values
  ${workspaceRow(fixture.workspaceId, `${fixture.namespace}-target`, "QA 12.19.1 Calendar Publication Target")},
  ${workspaceRow(fixture.otherWorkspaceId, `${fixture.namespace}-other`, "QA 12.19.1 Calendar Publication Other")},
  ${workspaceRow(fixture.inactiveWorkspaceId, `${fixture.namespace}-inactive`, "QA 12.19.1 Calendar Publication Inactive", "archived")};

insert into public.project_contacts (id, auth_user_id, status)
values
  ${Object.values(fixture.users)
    .map((user) => `(${sqlUuid(user.contactId)}, ${sqlUuid(user.userId)}, ${user.label === "inactiveContact" ? "'inactive'" : "'active'"})`)
    .join(",\n  ")};

insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at
) values
  ${grantRow("owner", fixture.workspaceId, "main_contact", fullCaps)},
  ${grantRow("editor", fixture.workspaceId, "assistant_contact", fullCaps)},
  ${grantRow("readOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view", "assignments.view", "volunteers.view"])},
  ${grantRow("calendarOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.view"])},
  ${grantRow("assignmentsOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit", "assignments.view"])},
  ${grantRow("tasksOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "tasks.edit", "tasks.view"])},
  ${grantRow("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRow("other", fixture.otherWorkspaceId, "main_contact", fullCaps)},
  ${grantRow("revoked", fixture.workspaceId, "main_contact", fullCaps, "revoked")},
  ${grantRow("expired", fixture.workspaceId, "main_contact", fullCaps, "active", "expired")},
  ${grantRow("inactive", fixture.workspaceId, "main_contact", fullCaps, "inactive")},
  ${grantRow("inactiveContact", fixture.workspaceId, "main_contact", fullCaps)},
  ${grantRow("inactiveWorkspace", fixture.inactiveWorkspaceId, "main_contact", fullCaps)};

insert into public.task_presets (
  id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible,
  is_system_preset, custom_field_definitions, lifecycle
) values
  (${sqlUuid(fixture.taskPresetId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace} Preset`)}, 'Hosted publication preset', 'general', 1, true, false, '[]'::jsonb, 'active'),
  (${sqlUuid(fixture.otherTaskPresetId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace} Other Preset`)}, 'Hosted publication other preset', 'general', 1, true, false, '[]'::jsonb, 'active');

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values
  ${volunteerRow(fixture.volunteers.readyA, fixture.workspaceId, `${fixture.namespace} Ready A`, fixture.users.owner.contactId)},
  ${volunteerRow(fixture.volunteers.readyB, fixture.workspaceId, `${fixture.namespace} Ready B`, fixture.users.owner.contactId)},
  ${volunteerRow(fixture.volunteers.other, fixture.otherWorkspaceId, `${fixture.namespace} Other`, fixture.users.other.contactId)};

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
) values (
  ${sqlUuid(fixture.legacyUnknownItemId)}, ${sqlUuid(fixture.workspaceId)}, null,
  ${sqlText(`${fixture.namespace} Unknown Legacy Draft`)}, 'general', 'timed',
  '2026-08-22', null, '08:00', '09:00', 'America/Denver', 1,
  'Legacy unknown-owner draft note', '{}'::jsonb, 'active', null, null,
  'draft', null, null
);

insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values (
  ${sqlUuid(fixture.legacyAssignmentId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.legacyUnknownItemId)},
  ${sqlUuid(fixture.volunteers.readyA)}, 'active', 'Legacy draft assignment', ${sqlUuid(fixture.users.owner.userId)}
);

insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, responded_at, updated_by_auth_user_id
) values (
  ${sqlUuid(fixture.legacyResponseId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.legacyAssignmentId)},
  'needs_response', 'project_contact', null, ${sqlUuid(fixture.users.owner.userId)}
);

insert into public.assignment_response_tokens (
  id, workspace_id, assignment_id, volunteer_profile_id, token_verifier_hash, expires_at,
  internal_note, created_by_auth_user_id
) values (
  ${sqlUuid(fixture.legacyTokenId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.legacyAssignmentId)},
  ${sqlUuid(fixture.volunteers.readyA)}, extensions.digest(${sqlText(fixture.legacyBearerToken)}, 'sha256'),
  clock_timestamp() + interval '2 hours', 'Existing draft-token fixture', ${sqlUuid(fixture.users.owner.userId)}
);
commit;
select 'product-created' as fixture_state;`, "Hosted Calendar publication product fixture creation");

  for (const user of Object.values(fixture.users)) {
    const client = createClient(hostedUrl, anonKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const signin = await client.auth.signInWithPassword({ email: user.email, password: user.password });
    assert(!signin.error && signin.data.session, `Hosted ${user.label} sign-in failed.`);
    secrets.add(signin.data.session.access_token);
    secrets.add(signin.data.session.refresh_token);
    user.client = client;
  }
}

function calendarCreateArgs(overrides = {}) {
  return {
    p_workspace_id: fixture.workspaceId,
    p_task_preset_id: null,
    p_one_off_title: `${fixture.namespace} Draft One-Off`,
    p_one_off_task_type: "general",
    p_schedule_kind: "timed",
    p_start_date: "2026-08-20",
    p_end_date: null,
    p_start_time: "09:00",
    p_end_time: "10:00",
    p_needed_count: 1,
    p_schedule_notes: "Hosted publication draft.",
    p_custom_values: {},
    ...overrides,
  };
}

async function expectFailure(operation, label) {
  try {
    const result = await operation;
    if (result && typeof result === "object" && "error" in result && result.error) return;
  } catch {
    return;
  }
  throw new Error(`${label} should have failed closed.`);
}

async function createCalendarItem(client, overrides = {}) {
  const { data, error } = await client.rpc("create_calendar_item", calendarCreateArgs(overrides));
  if (error || typeof data !== "string") throw new Error("Hosted Calendar item create failed.");
  return data;
}

async function updateOneOffItem(client, calendarItemId, overrides = {}) {
  const { data, error } = await client.rpc("update_calendar_item_one_off_timed", {
    p_calendar_item_id: calendarItemId,
    p_one_off_title: `${fixture.namespace} Edited One-Off`,
    p_one_off_task_type: "general",
    p_start_date: "2026-08-21",
    p_start_time: "10:00",
    p_end_time: "11:00",
    p_needed_count: 1,
    p_schedule_notes: "Hosted publication edited.",
    p_custom_values: {},
    ...overrides,
  });
  if (error || data !== calendarItemId) throw new Error("Hosted one-off item update failed.");
  return data;
}

async function updatePresetItem(client, calendarItemId, overrides = {}) {
  const { data, error } = await client.rpc("update_calendar_item_preset_timed", {
    p_calendar_item_id: calendarItemId,
    p_start_date: "2026-08-21",
    p_start_time: "12:00",
    p_end_time: "13:00",
    p_needed_count: 1,
    p_schedule_notes: "Hosted preset publication edited.",
    p_custom_values: {},
    ...overrides,
  });
  if (error || data !== calendarItemId) throw new Error("Hosted preset item update failed.");
  return data;
}

async function publishItem(client, calendarItemId) {
  const { data, error } = await client.rpc("publish_calendar_item", {
    p_calendar_item_id: calendarItemId,
  });
  if (error || data !== calendarItemId) throw new Error("Hosted Calendar publish failed.");
  return data;
}

async function createAssignmentsBatch(client, calendarItemId, volunteerIds = [fixture.volunteers.readyA]) {
  const { data, error } = await client.rpc("create_calendar_assignments_batch", {
    p_calendar_item_id: calendarItemId,
    p_volunteer_profile_ids: volunteerIds,
    p_assignment_note: "Hosted draft assignment prep",
  });
  if (error || !Array.isArray(data)) throw new Error("Hosted assignment batch create failed.");
  return data;
}

async function cancelAssignment(client, assignmentId) {
  const { data, error } = await client.rpc("cancel_calendar_assignment", {
    p_assignment_id: assignmentId,
  });
  if (error || data !== assignmentId) throw new Error("Hosted assignment cancel failed.");
  return data;
}

async function readModel(client, actorContactId) {
  return readCalendarReadModelWithClient({
    client,
    workspaceId: fixture.workspaceId,
    actorContactId,
    workspaceTimezone: "America/Denver",
    rangeStart: "2026-08-01",
    rangeEnd: "2026-09-01",
    periodKind: "month",
    capabilities: ["calendar.view", "assignments.view"],
  });
}

async function assertReadModelContains(client, actorContactId, calendarItemId, publicationState) {
  const model = await readModel(client, actorContactId);
  assert(model.ok, "Hosted Calendar read model should be available.");
  const item = model.items.find((candidate) => candidate.calendarItemId === calendarItemId);
  assert(item, "Expected hosted Calendar item to be visible.");
  assert(item.publicationState === publicationState, `Expected publication state ${publicationState}.`);
  return item;
}

async function assertReadModelOmits(client, actorContactId, calendarItemId, label) {
  const model = await readModel(client, actorContactId);
  assert(model.ok, "Hosted Calendar read model should be available.");
  assert(
    !model.items.some((candidate) => candidate.calendarItemId === calendarItemId),
    `${label} leaked through the hosted Calendar read model.`,
  );
}

function itemRow(calendarItemId) {
  const row = runHostedSql(`select id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
       schedule_kind, start_date::text, start_time::text, end_time::text, timezone,
       needed_count, schedule_notes, custom_values::text, lifecycle,
       follow_up_project_contact_id, created_by_project_contact_id,
       publication_state, published_at, published_by_project_contact_id
from public.calendar_items
where id = ${sqlUuid(calendarItemId)};`, "Hosted Calendar item row check")[0];
  assert(row, "Hosted Calendar item row was missing.");
  return row;
}

function countRows(sql, stage) {
  return runHostedSql(sql, stage)[0]?.count ?? 0;
}

async function verifyHostedBehavior(anonKey) {
  const anonClient = createClient(hostedUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  const invalidPublicationState = runHostedSql(`select count(*)::int as count
from pg_constraint
where conname = 'calendar_items_publication_state_known';`, "Hosted publication constraint check")[0]?.count;
  assert(invalidPublicationState === 1, "Hosted publication-state check constraint is missing.");

  await assertReadModelOmits(fixture.users.owner.client, fixture.users.owner.contactId, fixture.legacyUnknownItemId, "unknown-owner legacy draft");
  await assertReadModelOmits(fixture.users.editor.client, fixture.users.editor.contactId, fixture.legacyUnknownItemId, "unknown-owner legacy draft");
  const legacyRow = itemRow(fixture.legacyUnknownItemId);
  assert(legacyRow.publication_state === "draft" && !legacyRow.created_by_project_contact_id, "Hosted legacy unknown-owner row was not fail-closed draft.");
  assert(legacyRow.published_at === null && legacyRow.published_by_project_contact_id === null, "Hosted legacy row fabricated publisher metadata.");
  assert(
    countRows(`select count(*)::int as count from public.assignment_response_tokens where id = ${sqlUuid(fixture.legacyTokenId)};`, "Hosted legacy token retention check") === 1,
    "Hosted migration deleted an existing token on a draft parent.",
  );
  const draftPublicRead = await anonClient.rpc("read_assignment_response_by_token", {
    p_bearer_token: fixture.legacyBearerToken,
  });
  assert(
    draftPublicRead.error || draftPublicRead.data?.length === 0,
    "Draft public token verification must return a safe unavailable result.",
  );
  const draftPublicSubmit = await anonClient.rpc("submit_assignment_response_by_token", {
    p_bearer_token: fixture.legacyBearerToken,
    p_response_status: "confirmed",
    p_response_note: null,
  });
  assert(draftPublicSubmit.error || draftPublicSubmit.data?.length === 0, "Draft public response submission must not succeed.");
  const legacyTokenAfter = runHostedSql(`select last_used_at is null as unused
from public.assignment_response_tokens
where id = ${sqlUuid(fixture.legacyTokenId)};`, "Hosted legacy draft token use check")[0];
  assert(legacyTokenAfter?.unused === true, "Hosted draft token was consumed or mutated.");

  const draftId = await createCalendarItem(fixture.users.owner.client);
  fixture.createdDraftId = draftId;
  const draftRow = itemRow(draftId);
  assert(draftRow.publication_state === "draft", "Hosted new one-off item did not default to draft.");
  assert(draftRow.created_by_project_contact_id === fixture.users.owner.contactId, "Hosted creator provenance was not server-derived.");
  assert(draftRow.follow_up_project_contact_id === fixture.users.owner.contactId, "Hosted Follow-up Contact was not server-derived.");
  assert(draftRow.published_at === null && draftRow.published_by_project_contact_id === null, "Hosted draft contained publisher metadata.");

  const forgedCreate = await fixture.users.owner.client.rpc("create_calendar_item", {
    ...calendarCreateArgs({
      p_one_off_title: `${fixture.namespace} Forged Attempt`,
      publication_state: "published",
      created_by_project_contact_id: fixture.users.editor.contactId,
      published_by_project_contact_id: fixture.users.editor.contactId,
    }),
  });
  if (!forgedCreate.error) {
    assert(typeof forgedCreate.data === "string", "Forged create returned an invalid result.");
    const forgedRow = itemRow(forgedCreate.data);
    assert(forgedRow.publication_state === "draft" && forgedRow.created_by_project_contact_id === fixture.users.owner.contactId, "Hosted create trusted forged publication fields.");
  }

  const presetDraftId = await createCalendarItem(fixture.users.owner.client, {
    p_task_preset_id: fixture.taskPresetId,
    p_one_off_title: null,
    p_one_off_task_type: null,
  });
  fixture.presetDraftId = presetDraftId;
  const presetDraftRow = itemRow(presetDraftId);
  assert(presetDraftRow.publication_state === "draft" && presetDraftRow.task_preset_id === fixture.taskPresetId, "Hosted new preset-backed item did not default to a draft with source intact.");

  await assertReadModelContains(fixture.users.owner.client, fixture.users.owner.contactId, draftId, "draft");
  await assertReadModelOmits(fixture.users.editor.client, fixture.users.editor.contactId, draftId, "same-workspace broad non-owner draft");
  await assertReadModelOmits(fixture.users.readOnly.client, fixture.users.readOnly.contactId, draftId, "same-workspace read-only non-owner draft");

  await updateOneOffItem(fixture.users.owner.client, draftId);
  await updatePresetItem(fixture.users.owner.client, presetDraftId);
  await expectFailure(updateOneOffItem(fixture.users.editor.client, draftId), "same-workspace non-owner draft edit");
  await expectFailure(updatePresetItem(fixture.users.editor.client, presetDraftId), "same-workspace non-owner preset draft edit");
  await expectFailure(updateOneOffItem(fixture.users.other.client, draftId), "wrong-workspace draft edit");

  const draftAssignments = await createAssignmentsBatch(fixture.users.owner.client, draftId, [fixture.volunteers.readyA]);
  fixture.draftAssignmentId = draftAssignments[0];
  await expectFailure(
    fixture.users.editor.client.rpc("create_calendar_assignments_batch", {
      p_calendar_item_id: draftId,
      p_volunteer_profile_ids: [fixture.volunteers.readyB],
      p_assignment_note: "blocked",
    }),
    "same-workspace non-owner draft assignment",
  );
  await expectFailure(cancelAssignment(fixture.users.editor.client, fixture.draftAssignmentId), "same-workspace non-owner draft assignment cancel");
  const draftItem = await assertReadModelContains(fixture.users.owner.client, fixture.users.owner.contactId, draftId, "draft");
  assert(
    draftItem.assignedFractionLabel === "1/1 assigned",
    `Hosted draft assignment-derived coverage was not visible to owner (label=${draftItem.assignedFractionLabel}).`,
  );

  const ownerDetail = await fixture.users.owner.client.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.draftAssignmentId,
  });
  assert(!ownerDetail.error && ownerDetail.data?.length === 1, "Hosted draft assignment detail should be available to owner.");
  const editorDetail = await fixture.users.editor.client.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.draftAssignmentId,
  });
  assert(!editorDetail.error && editorDetail.data?.length === 0, "Hosted draft assignment detail leaked to non-owner.");
  const otherDetail = await fixture.users.other.client.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.draftAssignmentId,
  });
  assert(!otherDetail.error && otherDetail.data?.length === 0, "Hosted draft assignment detail leaked to wrong-workspace contact.");

  await expectFailure(
    fixture.users.owner.client.rpc("issue_assignment_response_token", {
      p_assignment_id: fixture.draftAssignmentId,
      p_ttl_hours: 1,
      p_internal_note: "blocked draft issue",
    }),
    "draft response-token issuance",
  );
  await expectFailure(
    fixture.users.owner.client.rpc("replace_assignment_response_token", {
      p_assignment_id: fixture.draftAssignmentId,
      p_ttl_hours: 1,
    }),
    "draft response-token replacement",
  );
  await expectFailure(
    fixture.users.owner.client.rpc("reveal_assignment_response_link", {
      p_assignment_id: fixture.draftAssignmentId,
      p_ttl_hours: 1,
      p_reveal_mode: "copy_link",
      p_metadata: { reason_code: "hosted_publication_validation", delivery_requested: false },
    }),
    "draft response-link reveal",
  );
  assert(
    countRows(`select count(*)::int as count from public.assignment_response_tokens where assignment_id = ${sqlUuid(fixture.draftAssignmentId)};`, "Hosted failed draft token side-effect check") === 0,
    "Failed hosted draft token issuance created a token row.",
  );

  for (const label of ["readOnly", "calendarOnly", "assignmentsOnly", "tasksOnly", "roleOnly", "other", "revoked", "expired", "inactive", "inactiveContact", "inactiveWorkspace"]) {
    await expectFailure(
      fixture.users[label].client.rpc("publish_calendar_item", { p_calendar_item_id: draftId }),
      `${label} publish authorization`,
    );
  }
  await expectFailure(
    fixture.users.owner.client.rpc("publish_calendar_item", { p_calendar_item_id: "not-a-uuid" }),
    "malformed publish id",
  );
  await expectFailure(
    fixture.users.owner.client.rpc("publish_calendar_item", { p_calendar_item_id: randomUUID() }),
    "fake publish id",
  );

  const directPublish = await fixture.users.owner.client
    .from("calendar_items")
    .update({
      publication_state: "published",
      published_at: new Date().toISOString(),
      published_by_project_contact_id: fixture.users.owner.contactId,
    })
    .eq("id", draftId);
  assert(directPublish.error, "Direct authenticated publication update must remain denied.");
  for (const table of ["calendar_items", "calendar_assignments", "assignment_responses", "assignment_response_tokens", "assignment_response_link_reveal_events"]) {
    const result = await fixture.users.owner.client.from(table).delete().eq("workspace_id", fixture.workspaceId);
    assert(result.error, `Direct authenticated delete on ${table} must remain denied.`);
  }

  const beforePublish = itemRow(draftId);
  await publishItem(fixture.users.owner.client, draftId);
  const firstPublished = itemRow(draftId);
  await publishItem(fixture.users.owner.client, draftId);
  const afterRetry = itemRow(draftId);
  assert(firstPublished.publication_state === "published", "Hosted publication did not set published state.");
  assert(firstPublished.published_at && firstPublished.published_by_project_contact_id === fixture.users.owner.contactId, "Hosted publication metadata was missing.");
  assert(afterRetry.published_at === firstPublished.published_at && afterRetry.published_by_project_contact_id === firstPublished.published_by_project_contact_id, "Hosted repeated publish replaced publication metadata.");
  for (const key of ["id", "workspace_id", "lifecycle", "task_preset_id", "title_snapshot", "task_type_snapshot", "schedule_kind", "start_date", "start_time", "end_time", "timezone", "needed_count", "schedule_notes", "custom_values", "follow_up_project_contact_id", "created_by_project_contact_id"]) {
    assert(String(firstPublished[key]) === String(beforePublish[key]), `Hosted publication changed protected field ${key}.`);
  }
  await assertReadModelContains(fixture.users.owner.client, fixture.users.owner.contactId, draftId, "published");
  const editorPublishedItem = await assertReadModelContains(fixture.users.editor.client, fixture.users.editor.contactId, draftId, "published");
  assert(!("created_by_project_contact_id" in editorPublishedItem) && !("published_by_project_contact_id" in editorPublishedItem), "Hosted safe projection exposed raw contact ids.");
  await assertReadModelOmits(fixture.users.other.client, fixture.users.other.contactId, draftId, "wrong-workspace published item");

  await updateOneOffItem(fixture.users.editor.client, draftId, {
    p_one_off_title: `${fixture.namespace} Published Edit`,
    p_start_time: "14:00",
    p_end_time: "15:00",
  });
  const publishedAssignments = await createAssignmentsBatch(fixture.users.editor.client, draftId, [fixture.volunteers.readyB]);
  fixture.publishedAssignmentId = publishedAssignments[0];
  await cancelAssignment(fixture.users.editor.client, fixture.publishedAssignmentId);

  const issued = await fixture.users.editor.client.rpc("issue_assignment_response_token", {
    p_assignment_id: fixture.draftAssignmentId,
    p_ttl_hours: 1,
    p_internal_note: "published issue",
  });
  assert(!issued.error && issued.data?.length === 1, "Hosted published token issuance should remain compatible.");
  const bearerToken = issued.data[0]?.bearer_token;
  assert(typeof bearerToken === "string" && bearerToken.length === 43, "Hosted published token issuance returned an invalid bearer.");
  secrets.add(bearerToken);
  const publicRead = await anonClient.rpc("read_assignment_response_by_token", { p_bearer_token: bearerToken });
  assert(!publicRead.error && publicRead.data?.length === 1, "Hosted published public verification should work.");
  const publicSubmit = await anonClient.rpc("submit_assignment_response_by_token", {
    p_bearer_token: bearerToken,
    p_response_status: "confirmed",
    p_response_note: null,
  });
  assert(!publicSubmit.error && publicSubmit.data?.length === 1, "Hosted published public response submit should work.");
  const replacement = await fixture.users.editor.client.rpc("replace_assignment_response_token", {
    p_assignment_id: fixture.draftAssignmentId,
    p_ttl_hours: 1,
  });
  assert(!replacement.error && replacement.data?.length === 1, "Hosted published response-token replacement should remain compatible.");
  secrets.add(replacement.data[0]?.bearer_token);
  const reveal = await fixture.users.editor.client.rpc("reveal_assignment_response_link", {
    p_assignment_id: fixture.draftAssignmentId,
    p_ttl_hours: 1,
    p_reveal_mode: "copy_link",
    p_metadata: { reason_code: "hosted_publication_validation", delivery_requested: false },
  });
  assert(!reveal.error && reveal.data?.length === 1, "Hosted published reveal boundary should remain compatible while product UI stays inactive.");
  secrets.add(reveal.data[0]?.bearer_token);

  const noSideEffects = runHostedSql(`select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('communications', 'communication_deliveries', 'email_deliveries', 'volunteer_schedule_credentials', 'remembered_devices', 'public_volunteer_lookups'))::int as activated_tables,
  (select count(*) from public.assignment_response_tokens where assignment_id = ${sqlUuid(fixture.draftAssignmentId)})::int as explicit_tokens;`, "Hosted no email/volunteer-access side-effect check")[0];
  assert(noSideEffects.activated_tables === 0, "Hosted publication activated email/public lookup/volunteer schedule tables.");
  assert(noSideEffects.explicit_tokens >= 2, "Hosted explicit published token operations were not recorded as expected.");

  await expectFailure(
    fixture.users.owner.client.rpc("publish_calendar_item", {
      p_calendar_item_id: draftId,
      p_unpublish: true,
      p_publication_state: "draft",
    }),
    "unsupported unpublish browser fields",
  );
}

async function cleanupFixtures() {
  for (const user of Object.values(fixture.users)) {
    if (user.client) await user.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  const userIds = Object.values(fixture.users).map((user) => user.userId);
  const userIdArray = userIds.map(sqlUuid).join(", ");
  const contactIdArray = Object.values(fixture.users).map((user) => sqlUuid(user.contactId)).join(", ");
  runHostedSql(`begin;
delete from public.assignment_response_link_reveal_events
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)});
delete from public.assignment_response_tokens
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)});
delete from public.assignment_responses
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)});
delete from public.calendar_assignments
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)});
delete from public.calendar_items
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})
   or title_snapshot like ${sqlText(`${fixture.namespace}%`)};
delete from public.task_presets
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)});
delete from public.volunteer_profiles
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or full_name like ${sqlText(`${fixture.namespace}%`)};
delete from public.workspace_contact_grants
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})
   or project_contact_id in (${contactIdArray});
delete from public.project_contacts
where id in (${contactIdArray})
   or auth_user_id = any(array[${userIdArray}]);
delete from public.workspaces
where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})
   or workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.identities where user_id = any(array[${userIdArray}]);
delete from auth.users where id = any(array[${userIdArray}]);
commit;
select 'cleaned' as fixture_state;`, "Hosted Calendar publication cleanup");

  exactResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${userIdArray}])) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.volunteer_profiles where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.task_presets where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.calendar_items where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.calendar_assignments where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.assignment_responses where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.assignment_response_tokens where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlUuid(fixture.inactiveWorkspaceId)})) +
  (select count(*) from auth.users where id = any(array[${userIdArray}]))
)::int as residue_count;`, "Hosted Calendar publication exact residue check")[0]?.residue_count;
  assert(exactResidueCount === 0, "Hosted Calendar publication fixtures left exact-run residue.");
  cleanupCompleted = true;
}

function verifyNamespaceResidue() {
  namespaceResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like 'qa-12-19-1-%') +
  (select count(*) from public.volunteer_profiles where full_name like 'qa-12-19-1-%') +
  (select count(*) from public.task_presets where name like 'qa-12-19-1-%') +
  (select count(*) from public.calendar_items where title_snapshot like 'qa-12-19-1-%') +
  (select count(*) from auth.users where email like 'qa-12-19-1-%@example.invalid')
)::int as residue_count;`, "Hosted 12.19.1 namespace residue check")[0]?.residue_count;
  assert(namespaceResidueCount === 0, "Hosted qa-12-19-1 namespace left fixture/Auth residue.");
  return namespaceResidueCount;
}

async function main() {
  const { anonKey, projectStatus } = await verifyTargetAndReadAnonKey();
  const { before, after } = await ensureExpectedMigrationApplied();
  await verifyGeneratedTypes();
  try {
    await verifyStaticBoundaries();
    await createFixtures(anonKey);
    await verifyHostedBehavior(anonKey);
  } finally {
    await cleanupFixtures();
  }
  assert(cleanupCompleted && verifyNamespaceResidue() === 0, "Hosted Calendar publication cleanup did not complete.");
  console.log("Hosted staging Calendar publication-visibility QA passed.");
  console.log(`Validated target ${expectedName} (${expectedRef}) with status ${projectStatus}.`);
  console.log(`Migration level before gate: ${before}; after gate: ${after}.`);
  console.log("Validated publication defaults, legacy draft fail-closed behavior, creator-only draft reads, published cross-contact visibility, safe projection, publish authorization/idempotency, preservation, draft edit/assignment privacy, token/public-response gating, direct table-write denial, capability isolation, generated type parity, and compatibility.");
  console.log(`Hosted disposable product and Auth residue: ${exactResidueCount + namespaceResidueCount}.`);
  console.log("No access token, refresh token, password, API key, database URL, bearer, verifier, response URL, or service credential was logged.");
}

main().catch((error) => {
  console.error(`Hosted Calendar publication-visibility QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
