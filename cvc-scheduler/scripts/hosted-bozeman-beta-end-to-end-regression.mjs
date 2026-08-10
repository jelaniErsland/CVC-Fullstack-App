import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const root = process.cwd();
const expectedName = "project-local-staging";
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedMigration = "20260714122230";
const optInName = "RUN_HOSTED_BOZEMAN_BETA_E2E_VALIDATION";
const hostedUrl = `https://${expectedRef}.supabase.co`;
const previewBaseUrl = "http://127.0.0.1:3000";

const secrets = new Set();
const report = {
  projectStatus: null,
  migrationBefore: null,
  migrationAfter: null,
  generatedTypes: "not-run",
  optInRefusal: "not-run",
  auth: "not-run",
  volunteers: "not-run",
  oneOff: "not-run",
  preset: "not-run",
  assignment: "not-run",
  draftPrivacy: "not-run",
  publication: "not-run",
  notification: "not-run",
  duplicateSend: "not-run",
  scheduleHandoff: "not-run",
  confirm: "not-run",
  decline: "not-run",
  confirmAll: "not-run",
  adminCoverage: "not-run",
  negatives: "not-run",
  leakage: "not-run",
  recording: "not-run",
  screenshots: 0,
  exactResidue: null,
  namespaceResidue: null,
  authResidue: null,
  previewStopped: "not-run",
};

function dateDaysFromToday(days) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const fixtureDates = {
  future: dateDaysFromToday(20),
  future2: dateDaysFromToday(21),
  future3: dateDaysFromToday(22),
  future4: dateDaysFromToday(23),
  inside48: dateDaysFromToday(1),
  started: dateDaysFromToday(-1),
};

const fixture = {
  namespace: `qa-12-23-1-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  taskPresetId: randomUUID(),
  otherTaskPresetId: randomUUID(),
  contacts: {
    scheduler: randomUUID(),
    viewOnly: randomUUID(),
    other: randomUUID(),
    missingFollow: randomUUID(),
  },
  grants: {
    scheduler: randomUUID(),
    viewOnly: randomUUID(),
    other: randomUUID(),
  },
  users: {
    scheduler: { label: "scheduler", userId: randomUUID(), identityId: randomUUID() },
    viewOnly: { label: "view-only", userId: randomUUID(), identityId: randomUUID() },
    other: { label: "other", userId: randomUUID(), identityId: randomUUID() },
    missingFollow: { label: "missing-follow", userId: randomUUID(), identityId: randomUUID() },
  },
  volunteers: {
    browser: null,
    helper: randomUUID(),
    missingEmail: randomUUID(),
    other: randomUUID(),
  },
  items: {
    oneOff: null,
    preset: null,
    decline: randomUUID(),
    allA: randomUUID(),
    allB: randomUUID(),
    inside48: randomUUID(),
    started: randomUUID(),
    missingFollow: randomUUID(),
    other: randomUUID(),
  },
  assignments: {
    oneOffBrowser: null,
    oneOffHelper: null,
    oneOffMissingEmail: randomUUID(),
    decline: randomUUID(),
    allA: randomUUID(),
    allB: randomUUID(),
    inside48: randomUUID(),
    started: randomUUID(),
    missingFollow: randomUUID(),
    other: randomUUID(),
  },
  responses: {
    oneOffMissingEmail: randomUUID(),
    decline: randomUUID(),
    allA: randomUUID(),
    allB: randomUUID(),
    inside48: randomUUID(),
    started: randomUUID(),
    missingFollow: randomUUID(),
    other: randomUUID(),
  },
};

let hostedAnonKey = null;
let tempDir = null;
let previewProcess = null;
let previewLogs = [];
let hostedFixturesCreated = false;
const cookieJars = new Map();

function redact(input) {
  let output = String(input instanceof Error ? input.message : input);
  for (const secret of secrets) {
    if (secret && typeof secret === "string") {
      output = output.split(secret).join("[redacted-secret]");
    }
  }
  return output
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/https:\/\/[a-z0-9]+\.supabase\.co[^\s]*/gi, "https://[redacted].supabase.co/[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-db-url]")
    .replace(/\/v\/access\/[A-Za-z0-9_-]{20,}/g, "/v/access/[redacted]");
}

function npmInvocation(args) {
  if (process.platform === "win32") {
    return {
      commandName: process.execPath,
      args: [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), ...args],
    };
  }
  return { commandName: "npm", args };
}

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 160 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
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
  const result = command(executable, executableArgs);
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`${options.stage ?? "Hosted Supabase command"} failed: ${redact(detail || "No diagnostic.")}`);
  }
  return result.stdout.trim();
}

function parseCliJson(output, stage) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${stage} returned unreadable JSON.`);
  }
}

function runHostedSql(sql, stage = "Hosted database query") {
  const file = path.join(tmpdir(), `project-local-e2e-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    const output = runSupabaseCli(["db", "query", "--linked", "--file", file, "--output", "json"], {
      sensitiveOutput: true,
      stage,
    });
    const result = parseCliJson(output, stage);
    assert(Array.isArray(result.rows), `${stage} omitted rows.`);
    return result.rows;
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // best effort
    }
  }
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function sqlCapabilities(values) {
  return `array[${values.map(sqlText).join(", ")}]::text[]`;
}

function idArray(values) {
  const ids = values.filter(Boolean);
  return ids.length ? ids.map(sqlUuid).join(", ") : "null::uuid";
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

function latestHostedMigration() {
  return runHostedSql(
    "select version from supabase_migrations.schema_migrations order by version desc limit 1;",
    "Hosted migration-level check",
  )[0]?.version;
}

async function verifyGeneratedTypes() {
  const localTypes = await readFile(path.join(root, "lib", "supabase", "database.types.ts"), "utf8");
  const hostedTypes = runSupabaseCli(["gen", "types", "typescript", "--linked", "--schema", "public"], {
    sensitiveOutput: true,
    stage: "Hosted generated-type comparison",
  });
  assert.equal(
    normalizeGeneratedTypes(hostedTypes),
    normalizeGeneratedTypes(localTypes),
    "Hosted generated public-schema types differ from committed types.",
  );
  report.generatedTypes = "passed";
}

async function verifyStaticBoundaries() {
  const [
    launchGate,
    runbook,
    goNoGo,
    calendarClient,
    notificationProvider,
    packageJson,
    responseRoute,
  ] = await Promise.all([
    readFile(path.join(root, "lib", "readiness", "bozemanBetaLaunchGate.server.ts"), "utf8"),
    readFile(path.join(root, "docs", "BOZEMAN_BETA_LAUNCH_RUNBOOK.md"), "utf8"),
    readFile(path.join(root, "docs", "BOZEMAN_BETA_GO_NO_GO.md"), "utf8"),
    readFile(path.join(root, "components", "CalendarClient.tsx"), "utf8"),
    readFile(path.join(root, "lib", "notifications", "initialAssignmentEmail.server.ts"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
    readFile(path.join(root, "app", "v", "schedule", "page.tsx"), "utf8"),
  ]);
  assert(launchGate.includes("NO-GO"), "Launch gate must remain NO-GO before production blockers are resolved.");
  assert(runbook.includes("Belgrade Sheets/App Script remains the fallback"), "Runbook must preserve Belgrade fallback.");
  assert(goNoGo.includes("Conclusion: NO-GO"), "GO/NO-GO matrix must not be promoted by this validation gate alone.");
  assert(calendarClient.includes("Send initial assignment emails"), "Calendar Initial email action is missing.");
  assert(calendarClient.includes("Publish item"), "Calendar publication action is missing.");
  assert(calendarClient.includes("Assign selected"), "Calendar assignment picker action is missing.");
  assert(notificationProvider.includes("/v/access/[redacted]"), "Recording provider must redact schedule access links.");
  assert(packageJson.includes("test:bozeman-beta-launch:hosted"), "Hosted launch verifier package command is missing.");
  assert(responseRoute.includes("remembered-device access is not active yet"), "Volunteer schedule route must keep remembered-device behavior paused.");
}

async function verifyOptInRefusal() {
  const env = { ...process.env };
  delete env[optInName];
  const result = command(process.execPath, [path.join(root, "scripts", "hosted-bozeman-beta-end-to-end-regression.mjs")], {
    env,
  });
  assert.notEqual(result.status, 0, "Hosted E2E command should refuse missing opt-in.");
  assert(
    redact(result.stderr + result.stdout).includes(`Refusing hosted Bozeman beta E2E validation without ${optInName}`),
    "Missing opt-in refusal did not explain the target lock.",
  );
  report.optInRefusal = "passed";
}

async function verifyTargetAndReadAnonKey() {
  assert(
    process.env[optInName] === expectedConfirmation,
    `Refusing hosted Bozeman beta E2E validation without ${optInName}=${expectedConfirmation}.`,
  );
  const linkedRef = (await readFile(path.join(root, "supabase", ".temp", "project-ref"), "utf8")).trim();
  assert.equal(linkedRef, expectedRef, "The linked Supabase project is not the approved staging ref.");
  const projectsResult = parseCliJson(
    runSupabaseCli(["projects", "list", "--output", "json"], { stage: "Hosted project discovery" }),
    "Hosted project discovery",
  );
  const projects = Array.isArray(projectsResult) ? projectsResult : projectsResult.projects;
  const project = projects?.find((entry) => entry.ref === expectedRef);
  assert(project?.name === expectedName, "Approved staging project name/ref did not match.");
  assert(project?.status === "ACTIVE_HEALTHY", "Approved staging target is not ACTIVE_HEALTHY.");
  report.projectStatus = project.status;

  report.migrationBefore = latestHostedMigration();
  assert.equal(report.migrationBefore, expectedMigration, `Hosted staging must already be at ${expectedMigration}.`);

  const apiKeys = parseCliJson(
    runSupabaseCli(["projects", "api-keys", "--project-ref", expectedRef, "--output", "json"], {
      sensitiveOutput: true,
      stage: "Hosted API-key discovery",
    }),
    "Hosted API-key discovery",
  );
  const keys = Array.isArray(apiKeys) ? apiKeys : apiKeys.api_keys;
  const anon = keys?.find((key) => ["anon", "publishable"].includes(String(key.name ?? key.type ?? "").toLowerCase()));
  hostedAnonKey = anon?.api_key ?? anon?.key;
  assert(hostedAnonKey, "Hosted anon/publishable key was not available through the approved CLI path.");
  secrets.add(hostedAnonKey);
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
select 'auth-created' as fixture_state;`, "Hosted Bozeman E2E Auth fixture creation");
  hostedFixturesCreated = true;
}

function grantRow(label, workspaceId, capabilities) {
  const role = label === "viewOnly" ? "assistant_contact" : "main_contact";
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, ${sqlText(role)}, ${sqlCapabilities(capabilities)}, 'active', clock_timestamp() - interval '1 day', null, null)`;
}

function seededVolunteerRow(label, workspaceId, overrides = {}) {
  const id = fixture.volunteers[label];
  const email = Object.hasOwn(overrides, "email")
    ? overrides.email
    : `${fixture.namespace}-${label}@example.invalid`;
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, null, 'manual', ${sqlUuid(fixture.contacts.scheduler)}, clock_timestamp(), ${sqlText(overrides.lifecycle ?? "active")}, ${sqlText(overrides.readiness ?? "ready")}, ${sqlText(`${fixture.namespace} ${overrides.name ?? label}`)}, ${sqlText(email)}, ${sqlText(overrides.phone ?? "406-555-0199")}, ${sqlText(overrides.congregation ?? "Bozeman QA")}, ${sqlText(overrides.preferred ?? "Email")}, '{}'::jsonb, '{}'::jsonb, '')`;
}

function itemRow(label, title, date, overrides = {}) {
  const publication = overrides.publication ?? "published";
  const publishedAt = publication === "published" ? "clock_timestamp()" : "null";
  const publishedBy = publication === "published" ? sqlUuid(fixture.contacts.scheduler) : "null";
  const follow = Object.hasOwn(overrides, "follow") ? overrides.follow : fixture.contacts.scheduler;
  return `(${sqlUuid(fixture.items[label])}, ${sqlUuid(overrides.workspaceId ?? fixture.workspaceId)}, ${overrides.presetId ? sqlUuid(overrides.presetId) : "null"}, ${sqlText(title)}, ${sqlText(overrides.taskType ?? "general")}, 'timed', ${sqlText(date)}::date, null, ${sqlText(overrides.start ?? "10:00")}::time, ${sqlText(overrides.end ?? "12:00")}::time, 'America/Denver', ${Number(overrides.needed ?? 1)}, ${sqlText(overrides.notes ?? `${label} notes`)}, '{}'::jsonb, 'active', ${follow ? sqlUuid(follow) : "null"}, ${sqlUuid(fixture.contacts.scheduler)}, ${sqlText(publication)}, ${publishedAt}, ${publishedBy})`;
}

function assignmentRow(label, itemLabel, volunteerId, overrides = {}) {
  return `(${sqlUuid(fixture.assignments[label])}, ${sqlUuid(overrides.workspaceId ?? fixture.workspaceId)}, ${sqlUuid(fixture.items[itemLabel])}, ${sqlUuid(volunteerId)}, ${sqlText(overrides.lifecycle ?? "active")}, ${sqlText(overrides.note ?? null)}, ${sqlUuid(fixture.users.scheduler.userId)})`;
}

function responseRow(label, overrides = {}) {
  const status = overrides.status ?? "needs_response";
  const respondedAt = status === "needs_response" ? "null" : "clock_timestamp()";
  return `(${sqlUuid(fixture.responses[label])}, ${sqlUuid(overrides.workspaceId ?? fixture.workspaceId)}, ${sqlUuid(fixture.assignments[label])}, ${sqlText(status)}, ${sqlText(overrides.source ?? "project_contact")}, ${sqlText(overrides.note ?? null)}, ${respondedAt}, ${sqlUuid(fixture.users.scheduler.userId)})`;
}

async function createBaseProductFixtures() {
  runHostedSql(`
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values
  (${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace}-main`)}, ${sqlText(`${fixture.namespace} Main`)}, 'active', 'America/Denver', ${sqlText(fixtureDates.started)}::date, ${sqlText(fixtureDates.future4)}::date, false),
  (${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace}-other`)}, ${sqlText(`${fixture.namespace} Other`)}, 'active', 'America/Denver', ${sqlText(fixtureDates.started)}::date, ${sqlText(fixtureDates.future4)}::date, false);

insert into public.project_contacts (
  id, auth_user_id, status, volunteer_facing_display_name, volunteer_facing_email, volunteer_facing_phone
) values
  (${sqlUuid(fixture.contacts.scheduler)}, ${sqlUuid(fixture.users.scheduler.userId)}, 'active', ${sqlText(`${fixture.namespace} Follow-up`)}, ${sqlText(`${fixture.namespace}-follow-up@example.invalid`)}, '406-555-0100'),
  (${sqlUuid(fixture.contacts.viewOnly)}, ${sqlUuid(fixture.users.viewOnly.userId)}, 'active', ${sqlText(`${fixture.namespace} View Only`)}, ${sqlText(`${fixture.namespace}-view@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.other)}, ${sqlUuid(fixture.users.other.userId)}, 'active', ${sqlText(`${fixture.namespace} Other`)}, ${sqlText(`${fixture.namespace}-other-contact@example.invalid`)}, null),
  (${sqlUuid(fixture.contacts.missingFollow)}, ${sqlUuid(fixture.users.missingFollow.userId)}, 'active', null, null, null);

insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at)
values
  ${grantRow("scheduler", fixture.workspaceId, ["workspace.read", "volunteers.view", "volunteers.edit", "tasks.view", "calendar.view", "calendar.edit", "assignments.view", "assignments.edit"])},
  ${grantRow("viewOnly", fixture.workspaceId, ["workspace.read", "volunteers.view", "tasks.view", "calendar.view", "assignments.view"])},
  ${grantRow("other", fixture.otherWorkspaceId, ["workspace.read", "volunteers.view", "volunteers.edit", "tasks.view", "calendar.view", "calendar.edit", "assignments.view", "assignments.edit"])};

insert into public.task_presets (
  id, workspace_id, name, task_type, default_needed_count, description, lifecycle,
  volunteer_visible, custom_field_definitions, is_system_preset, system_key
) values
  (${sqlUuid(fixture.taskPresetId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace} Preset`)}, 'general', 2, ${sqlText("Hosted E2E persisted preset")}, 'active', true, '[]'::jsonb, false, null),
  (${sqlUuid(fixture.otherTaskPresetId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace} Other Preset`)}, 'general', 1, ${sqlText("Wrong workspace preset")}, 'active', true, '[]'::jsonb, false, null);

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values
  ${seededVolunteerRow("helper", fixture.workspaceId, { name: "Helper Volunteer" })},
  ${seededVolunteerRow("missingEmail", fixture.workspaceId, { name: "Missing Email", email: null })},
  ${seededVolunteerRow("other", fixture.otherWorkspaceId, { name: "Wrong Workspace", email: `${fixture.namespace}-wrong@example.invalid` })};

select 'base-fixtures-created' as fixture_state;`, "Hosted Bozeman E2E base fixture creation");
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
  report.auth = "passed";
}

async function createBrowserCookies(label) {
  const user = fixture.users[label];
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
  const signIn = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert(!signIn.error && signIn.data.session, `Hosted browser sign-in failed for ${label}.`);
  secrets.add(signIn.data.session.access_token);
  secrets.add(signIn.data.session.refresh_token);
  for (const cookie of cookieJar.values()) secrets.add(cookie.value);
  assert(cookieJar.size > 0, `Hosted browser sign-in did not create cookies for ${label}.`);
  cookieJars.set(label, cookieJar);
}

async function addBrowserCookies(context, label) {
  const cookieJar = cookieJars.get(label);
  assert(cookieJar?.size > 0, `Missing hosted browser cookies for ${label}.`);
  await context.addCookies(
    Array.from(cookieJar.values()).map((cookie) => ({
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

function createPreviewUrl(baseUrl, relativePath) {
  return new URL(relativePath, baseUrl).toString();
}

function hostedPreviewEnv(recordingPath) {
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
  for (const key of passthrough) if (typeof process.env[key] === "string") env[key] = process.env[key];
  return {
    ...env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SUPABASE_URL: hostedUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: hostedAnonKey,
    ADMIN_AUTH_MODE: "enforced",
    ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT: "recording",
    ASSIGNMENT_NOTIFICATION_BASE_URL: previewBaseUrl,
    ASSIGNMENT_NOTIFICATION_FROM: `${fixture.namespace}-sender@example.invalid`,
    ASSIGNMENT_NOTIFICATION_RECORDING_PATH: recordingPath,
    SUPABASE_SERVICE_ROLE_KEY: "",
  };
}

function safeLogTail(file) {
  try {
    return readFileSync(file, "utf8").split(/\r?\n/).slice(-60).join("\n");
  } catch {
    return "";
  }
}

async function startHostedPreview(recordingPath) {
  const out = path.join(tempDir, `preview-${randomUUID()}.out.log`);
  const err = path.join(tempDir, `preview-${randomUUID()}.err.log`);
  previewLogs.push(out, err);
  const env = hostedPreviewEnv(recordingPath);
  const existing = await fetch(createPreviewUrl(previewBaseUrl, "/admin/calendar"), {
    signal: AbortSignal.timeout(900),
  }).catch(() => null);
  assert(!existing, "Loopback preview port is already serving before the hosted E2E gate.");

  const buildCommand = npmInvocation(["run", "build"]);
  const build = command(buildCommand.commandName, buildCommand.args, { env });
  if (build.status !== 0) {
    throw new Error(`Hosted Bozeman E2E preview build failed: ${redact([build.error?.message, build.stderr, build.stdout].filter(Boolean).join("\n") || "No diagnostic.")}`);
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

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(createPreviewUrl(previewBaseUrl, "/admin/calendar"), { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // wait
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Hosted Bozeman E2E preview did not become available. ${redact(safeLogTail(err) || safeLogTail(out) || "Preview logs were empty.")}`);
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
    throw new Error("Hosted Bozeman E2E preview is still serving after shutdown.");
  } catch (error) {
    if (String(error?.message ?? "").includes("still serving")) throw error;
  }
  report.previewStopped = "passed";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactDayLabel(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return `${new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(parsed)} ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed)}`;
}

async function screenshot(page, label) {
  const dir = path.join(tempDir, "screenshots");
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${label}.png`), fullPage: true });
  report.screenshots += 1;
}

function visibleField(page, label, control = "input, textarea, select") {
  return page.locator(`label:has-text("${label}") ${control}:visible`).first();
}

function visibleButton(page, label) {
  return page.locator(`button:visible:has-text("${label}")`).first();
}

async function formPayloadForButton(button) {
  return button.evaluate((node) => {
    const form = node instanceof HTMLButtonElement ? node.form : null;
    if (!form) return {};
    const entries = {};
    for (const [key, value] of new FormData(form).entries()) {
      const current = entries[key];
      if (Array.isArray(current)) current.push(String(value));
      else if (typeof current === "string") entries[key] = [current, String(value)];
      else entries[key] = String(value);
    }
    return entries;
  });
}

function singlePayloadValue(payload, key) {
  const value = payload[key];
  assert(!Array.isArray(value), `Create form payload unexpectedly duplicated ${key}.`);
  assert.equal(typeof value, "string", true, `Create form payload omitted ${key}.`);
  return value;
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, `${label} has horizontal overflow.`);
}

async function assertNoRenderedLeak(page, recordingPath = null) {
  const content = await page.content();
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const recording = recordingPath && existsSync(recordingPath) ? readFileSync(recordingPath, "utf8") : "";
  const combined = `${content}\n${bodyText}\n${recording}`;
  for (const secret of secrets) {
    assert(!secret || !combined.includes(secret), "Rendered/browser/recording output leaked a secret.");
  }
  assert(!/\/v\/access\/[A-Za-z0-9_-]{20,}/.test(combined), "Rendered/browser/recording output leaked a schedule URL.");
  assert(!/\/respond\/[A-Za-z0-9_-]{20,}/.test(combined), "Rendered/browser/recording output leaked a response URL.");
  assert(!/eyJ[A-Za-z0-9_-]+\./.test(combined), "Rendered/browser/recording output leaked JWT-like material.");
  assert(!combined.includes("workspace_contact_grants"), "Rendered output leaked grant internals.");
  assert(!combined.includes("service_role"), "Rendered output leaked service-role wording/material.");
  assert(!combined.includes("questionnaire_answers"), "Rendered output leaked questionnaire internals.");
}

function getRowsByTitle(title) {
  return runHostedSql(
    `select id, workspace_id, task_preset_id, title_snapshot, publication_state, follow_up_project_contact_id, created_by_project_contact_id, needed_count
from public.calendar_items
where workspace_id = ${sqlUuid(fixture.workspaceId)} and title_snapshot = ${sqlText(title)}
order by created_at desc;`,
    "Hosted item lookup",
  );
}

function findVolunteerByName(name) {
  return runHostedSql(
    `select id, profile_source, source_submission_id, full_name, email from public.volunteer_profiles where workspace_id = ${sqlUuid(fixture.workspaceId)} and full_name = ${sqlText(name)} order by created_at desc limit 1;`,
    "Hosted volunteer lookup",
  )[0];
}

async function addAndEditVolunteer(page) {
  const original = `${fixture.namespace} Browser Volunteer`;
  const edited = `${fixture.namespace} Browser Edited`;
  await page.goto(createPreviewUrl(previewBaseUrl, "/admin/volunteers"), { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Volunteers", exact: true }).waitFor();
  await page.locator("summary").filter({ hasText: "Add volunteer" }).first().click();
  await page.getByLabel("Full name").first().fill(original);
  await page.getByLabel("Email").first().fill(`${fixture.namespace}-browser-volunteer@example.invalid`);
  await page.getByLabel("Phone").first().fill("406-555-0123");
  await page.getByLabel("Congregation").first().fill("Bozeman QA");
  await page.getByLabel("Preferred contact").first().selectOption("Email");
  await Promise.all([
    page.waitForURL(/notice=created/),
    page.getByRole("button", { name: "Save volunteer" }).click(),
  ]);
  await page.getByText("Volunteer saved").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(original).waitFor();
  await screenshot(page, "volunteers-after-add");

  await page.getByText("Edit volunteer").first().click();
  const editDetails = page.locator("details").filter({ hasText: "Edit volunteer" }).first();
  await editDetails.getByLabel("Full name").fill(edited);
  await Promise.all([
    page.waitForURL(/notice=updated/),
    editDetails.getByRole("button", { name: "Save changes" }).click(),
  ]);
  await page.getByText("Volunteer updated").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(edited).waitFor();
  await screenshot(page, "volunteers-after-edit");

  const row = findVolunteerByName(edited);
  assert(row?.id, "Product-added volunteer was not persisted.");
  assert.equal(row.profile_source, "manual", "Product-added volunteer did not use manual provenance.");
  assert.equal(row.source_submission_id, null, "Product-added volunteer fabricated questionnaire provenance.");
  fixture.volunteers.browser = row.id;
  report.volunteers = "passed";
}

async function openCreationSlot(page, date, hourLabel = "3 PM") {
  await page.goto(createPreviewUrl(previewBaseUrl, `/admin/calendar?view=day&date=${date}`), { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Calendar" }).waitFor();
  await page.getByRole("button", { name: `Plan project work on ${compactDayLabel(date)} at ${hourLabel}` }).click();
  await page.getByRole("dialog", { name: "Plan project work" }).waitFor();
}

async function createOneOffDraft(page) {
  const title = `${fixture.namespace} One-off`;
  const edited = `${fixture.namespace} One-off Edited`;
  await openCreationSlot(page, fixtureDates.future, "3 PM");
  await visibleField(page, "Custom task name", "input").fill(title);
  await visibleField(page, "Date", "input").fill(fixtureDates.future);
  await visibleField(page, "Start", "input").fill("15:00");
  await visibleField(page, "End", "input").fill("16:00");
  await visibleField(page, "Needed", "input").fill("2");
  await visibleField(page, "Schedule notes", "textarea").fill(`${fixture.namespace} one-off notes`);
  const createButton = visibleButton(page, "Save draft");
  const createPayload = await formPayloadForButton(createButton);
  assert.equal(singlePayloadValue(createPayload, "sourceMode"), "oneOff", "One-off create payload source mode drifted.");
  assert.equal(singlePayloadValue(createPayload, "title"), title, "One-off create payload did not include the custom title.");
  assert.equal(singlePayloadValue(createPayload, "date"), fixtureDates.future, "One-off create payload date drifted.");
  assert.equal(singlePayloadValue(createPayload, "startTime"), "15:00", "One-off create payload start time drifted.");
  assert.equal(singlePayloadValue(createPayload, "endTime"), "16:00", "One-off create payload end time drifted.");
  assert.equal(singlePayloadValue(createPayload, "neededCount"), "2", "One-off create payload needed count drifted.");
  await Promise.all([
    page.waitForURL(/notice=created/),
    createButton.click(),
  ]);
  await page.getByText("Calendar draft saved").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(escapeRegExp(title)) }).first().click();
  await page.getByRole("dialog", { name: "Calendar item inspector" }).waitFor();
  await page.getByText("Private draft").first().waitFor();
  await screenshot(page, "calendar-one-off-draft");

  let row = getRowsByTitle(title)[0];
  assert(row?.id, "One-off draft was not persisted.");
  assert.equal(row.publication_state, "draft");
  assert.equal(row.follow_up_project_contact_id, fixture.contacts.scheduler);
  assert.equal(row.created_by_project_contact_id, fixture.contacts.scheduler);
  fixture.items.oneOff = row.id;

  const editForm = page.locator('form:visible').filter({ hasText: "Edit scheduled item" }).first();
  await editForm.locator('input[name="title"]').fill(edited);
  await editForm.locator('input[name="startTime"]').fill("15:30");
  await editForm.locator('input[name="endTime"]').fill("16:30");
  await editForm.locator('textarea[name="notes"]').fill(`${fixture.namespace} edited one-off notes`);
  await Promise.all([
    page.waitForURL(/notice=updated/),
    editForm.getByRole("button", { name: "Save item changes" }).click(),
  ]);
  await page.getByText("Calendar item updated").waitFor();
  row = runHostedSql(
    `select id, title_snapshot, start_time, end_time from public.calendar_items where id = ${sqlUuid(fixture.items.oneOff)};`,
    "Hosted one-off edit lookup",
  )[0];
  assert.equal(row?.title_snapshot, edited, "One-off edit did not persist the edited title.");
  assert.equal(String(row?.start_time).slice(0, 5), "15:30", "One-off edit did not persist the edited start time.");
  await openCalendarItem(page, edited, fixtureDates.future);
  report.oneOff = "passed";
  return edited;
}

async function createPresetDraft(page) {
  const title = `${fixture.namespace} Preset`;
  await openCreationSlot(page, fixtureDates.future2, "4 PM").catch(async () => {
    await openCreationSlot(page, fixtureDates.future2, "3 PM");
  });
  await page.getByRole("button", { name: "Task preset" }).first().click();
  await visibleField(page, "Task preset", "select").selectOption(fixture.taskPresetId);
  await visibleField(page, "Date", "input").fill(fixtureDates.future2);
  await visibleField(page, "Start", "input").fill("16:00");
  await visibleField(page, "End", "input").fill("17:00");
  await visibleField(page, "Schedule notes", "textarea").fill(`${fixture.namespace} preset-backed notes`);
  await Promise.all([
    page.waitForURL(/notice=created/),
    visibleButton(page, "Save draft").click(),
  ]);
  await page.getByText("Calendar draft saved").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: new RegExp(escapeRegExp(title)) }).first().click();
  await page.getByRole("dialog", { name: "Calendar item inspector" }).waitFor();
  await page.getByText("Task preset").first().waitFor();
  const row = getRowsByTitle(title)[0];
  assert.equal(row?.task_preset_id, fixture.taskPresetId, "Preset-backed draft did not preserve task preset id.");
  assert.equal(row?.publication_state, "draft");
  fixture.items.preset = row.id;
  await screenshot(page, "calendar-preset-draft");
  report.preset = "passed";
}

async function openCalendarItem(page, title, date = fixtureDates.future) {
  await page.goto(createPreviewUrl(previewBaseUrl, `/admin/calendar?view=week&date=${date}`), {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: new RegExp(escapeRegExp(title)) }).first().click();
  await page.getByRole("dialog", { name: "Calendar item inspector" }).waitFor();
}

async function assignVolunteers(page, title) {
  await openCalendarItem(page, title, fixtureDates.future);
  const dialog = page.getByRole("dialog", { name: "Calendar item inspector" });
  for (const volunteerName of [`${fixture.namespace} Browser Edited`, `${fixture.namespace} Helper Volunteer`]) {
    const checkbox = dialog.locator("label").filter({ hasText: volunteerName }).locator('input[type="checkbox"]').first();
    await checkbox.check({ force: true });
  }
  await screenshot(page, "calendar-assignment-picker");
  await Promise.all([
    page.waitForURL(/notice=assigned/),
    dialog.getByRole("button", { name: "Assign selected" }).click(),
  ]);
  await page.getByText("Volunteer assigned").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await openCalendarItem(page, title, fixtureDates.future);
  await page.getByText("Needs response").first().waitFor();
  const rows = runHostedSql(
    `select id, volunteer_profile_id from public.calendar_assignments where workspace_id = ${sqlUuid(fixture.workspaceId)} and calendar_item_id = ${sqlUuid(fixture.items.oneOff)} and lifecycle = 'active';`,
    "Hosted assignment lookup",
  );
  assert.equal(rows.length, 2, "Product assignment picker did not persist two active assignments.");
  fixture.assignments.oneOffBrowser = rows.find((row) => row.volunteer_profile_id === fixture.volunteers.browser)?.id;
  fixture.assignments.oneOffHelper = rows.find((row) => row.volunteer_profile_id === fixture.volunteers.helper)?.id;
  assert(fixture.assignments.oneOffBrowser && fixture.assignments.oneOffHelper, "Assignment rows did not map to expected volunteers.");
  const tokenRows = runHostedSql(`select count(*)::int as count from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)};`, "Response-token absence check");
  assert.equal(tokenRows[0]?.count, 0, "Assignment creation created response tokens.");
  report.assignment = "passed";
}

function createSupplementalRows(oneOffTitle) {
  runHostedSql(`
insert into public.calendar_assignments (id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id)
values
  ${assignmentRow("oneOffMissingEmail", "oneOff", fixture.volunteers.missingEmail)};

insert into public.assignment_responses (id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id)
values
  ${responseRow("oneOffMissingEmail")};

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
) values
  ${itemRow("decline", `${fixture.namespace} Decline Me`, fixtureDates.future2, { needed: 1 })},
  ${itemRow("allA", `${fixture.namespace} All A`, fixtureDates.future3, { needed: 1 })},
  ${itemRow("allB", `${fixture.namespace} All B`, fixtureDates.future4, { needed: 1 })},
  ${itemRow("inside48", `${fixture.namespace} Inside 48`, fixtureDates.inside48, { needed: 1 })},
  ${itemRow("started", `${fixture.namespace} Started`, fixtureDates.started, { needed: 1, start: "08:00", end: "09:00" })},
  ${itemRow("missingFollow", `${fixture.namespace} Missing Follow`, fixtureDates.future2, { follow: fixture.contacts.missingFollow, needed: 1 })},
  ${itemRow("other", `${fixture.namespace} Other Workspace`, fixtureDates.future2, { workspaceId: fixture.otherWorkspaceId, needed: 1 })};

insert into public.calendar_assignments (id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id)
values
  ${assignmentRow("decline", "decline", fixture.volunteers.browser)},
  ${assignmentRow("allA", "allA", fixture.volunteers.browser)},
  ${assignmentRow("allB", "allB", fixture.volunteers.browser)},
  ${assignmentRow("inside48", "inside48", fixture.volunteers.browser)},
  ${assignmentRow("started", "started", fixture.volunteers.browser)},
  ${assignmentRow("missingFollow", "missingFollow", fixture.volunteers.browser)},
  ${assignmentRow("other", "other", fixture.volunteers.other, { workspaceId: fixture.otherWorkspaceId })};

insert into public.assignment_responses (id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id)
values
  ${responseRow("decline")},
  ${responseRow("allA")},
  ${responseRow("allB")},
  ${responseRow("inside48")},
  ${responseRow("started")},
  ${responseRow("missingFollow")},
  ${responseRow("other", { workspaceId: fixture.otherWorkspaceId })};

select ${sqlText(oneOffTitle)} as fixture_state;`, "Hosted Bozeman E2E supplemental fixture creation");
}

async function verifyDraftPrivacy(page, title) {
  const token = await issueScheduleAccess(fixture.volunteers.browser);
  secrets.add(token);
  const publicContext = page.context();
  const volunteerPage = await publicContext.newPage();
  await volunteerPage.goto(createPreviewUrl(previewBaseUrl, `/v/access/${token}`), { waitUntil: "networkidle" });
  await volunteerPage.waitForURL(/\/v\/schedule/);
  await volunteerPage.getByRole("heading", { name: "Here’s your schedule" }).waitFor();
  assert.equal(await volunteerPage.getByText(title).count(), 0, "Draft item is visible in volunteer schedule.");
  await assertNoRenderedLeak(volunteerPage);
  await volunteerPage.close();

  await openCalendarItem(page, title, fixtureDates.future);
  const dialog = page.getByRole("dialog", { name: "Calendar item inspector" });
  await dialog.getByText("Ready to send: 0").first().waitFor();
  await dialog.getByText("Publish this item before sending assignment email.").first().waitFor();
  assert(await dialog.getByRole("button", { name: "Send initial assignment emails" }).isDisabled(), "Draft email action should be blocked.");
  report.draftPrivacy = "passed";
}

async function publishOneOff(page, title) {
  await openCalendarItem(page, title, fixtureDates.future);
  const dialog = page.getByRole("dialog", { name: "Calendar item inspector" });
  await dialog.getByRole("button", { name: "Publish item", exact: true }).click();
  await dialog.getByText("Publish this Calendar item?").first().waitFor();
  await Promise.all([
    page.waitForURL(/notice=published/),
    dialog.getByRole("button", { name: "Publish item", exact: true }).last().click(),
  ]);
  await page.getByText("Calendar item published").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await openCalendarItem(page, title, fixtureDates.future);
  await page.getByText("Published").first().waitFor();
  await screenshot(page, "calendar-published-state");
  const responseTokenRows = runHostedSql(
    `select count(*)::int as count from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)};`,
    "Response token absence after publish",
  );
  assert.equal(responseTokenRows[0]?.count, 0, "Publication created assignment response tokens.");
  report.publication = "passed";
}

async function sendInitialEmail(page, title, recordingPath) {
  await openCalendarItem(page, title, fixtureDates.future);
  const dialog = page.getByRole("dialog", { name: "Calendar item inspector" });
  await dialog.getByText("Ready to send: 2").first().waitFor();
  await dialog.getByText("Missing email: 1").first().waitFor();
  await screenshot(page, "initial-email-review");
  await Promise.all([
    page.waitForURL(/notice=assignment_email_sent/),
    dialog.getByRole("button", { name: "Send initial assignment emails", exact: true }).click(),
  ]);
  await page.getByText("Initial assignment email sent").waitFor();
  const entries = readRecordingLines(recordingPath);
  assert.equal(entries.length, 2, "Initial email recording count did not match two eligible recipients.");
  for (const entry of entries) {
    assert.equal(entry.kind, "initial_assignment");
    assert.equal(entry.scheduleAccessPath, "/v/access/[redacted]");
    assert(!/\/v\/access\/[A-Za-z0-9_-]{20,}/.test(JSON.stringify(entry)), "Recording entry leaked schedule URL.");
  }
  await screenshot(page, "initial-email-sent");
  await page.reload({ waitUntil: "networkidle" });
  await openCalendarItem(page, title, fixtureDates.future);
  const again = page.getByRole("dialog", { name: "Calendar item inspector" });
  await again.getByText("Already sent: 2").first().waitFor();
  const sendButton = again.getByRole("button", { name: "Send initial assignment emails", exact: true });
  assert(await sendButton.isDisabled(), "Already-sent Initial email button should be disabled.");
  assert.equal(readRecordingLines(recordingPath).length, 2, "Duplicate send created extra recording entries.");
  await screenshot(page, "initial-email-already-sent");
  report.notification = "passed";
  report.duplicateSend = "passed";
  report.recording = "passed";
}

function readRecordingLines(recordingPath) {
  if (!existsSync(recordingPath)) return [];
  return readFileSync(recordingPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function issueScheduleAccess(volunteerProfileId) {
  const { data, error } = await fixture.users.scheduler.client.rpc("issue_volunteer_schedule_access", {
    p_volunteer_profile_id: volunteerProfileId,
    p_ttl_hours: 24,
  });
  assert(!error && Array.isArray(data) && data[0]?.bearer_token, "Schedule access RPC did not issue a bearer.");
  secrets.add(data[0].bearer_token);
  return data[0].bearer_token;
}

async function verifyVolunteerSchedule(token, oneOffTitle) {
  let browser;
  try {
    browser = await chromium.launch(resolveBrowserLaunchOptions());
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(createPreviewUrl(previewBaseUrl, `/v/access/${token}`), { waitUntil: "networkidle" });
    await page.waitForURL(/\/v\/schedule/);
    await page.getByText(oneOffTitle).waitFor();
    await screenshot(page, "volunteer-schedule-desktop");
    report.scheduleHandoff = "passed";

    await page.getByRole("button", { name: new RegExp(escapeRegExp(oneOffTitle)) }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByText("Your response is now Confirmed.").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: new RegExp(escapeRegExp(oneOffTitle)) }).click();
    await page.getByText("Confirmed").first().waitFor();
    await screenshot(page, "volunteer-confirmed-detail");
    report.confirm = "passed";
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: new RegExp(`${escapeRegExp(fixture.namespace)} Decline Me`) }).click();
    await page.getByPlaceholder("Add a brief note if you can’t make it").fill(`${fixture.namespace} Browser note`);
    await page.getByRole("button", { name: "Can’t make it" }).last().click();
    await page.getByText("Your response is now Can’t make it.").waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: new RegExp(`${escapeRegExp(fixture.namespace)} Decline Me`) }).click();
    await page.getByText(`${fixture.namespace} Browser note`).waitFor();
    await screenshot(page, "volunteer-declined-detail");
    report.decline = "passed";
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: "Confirm all pending" }).click();
    await page.getByText(/Confirmed \d+ assignments\./).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: new RegExp(`${escapeRegExp(fixture.namespace)} All A`) }).click();
    await page.getByText("Confirmed").first().waitFor();
    report.confirmAll = "passed";
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: new RegExp(`${escapeRegExp(fixture.namespace)} Inside 48`) }).click();
    const inside48Dialog = page.getByRole("dialog", { name: new RegExp(`${escapeRegExp(fixture.namespace)} Inside 48`) });
    await page.getByText(/starts within 48 hours/).waitFor();
    assert.equal(
      await inside48Dialog.getByPlaceholder(/brief note/).count(),
      0,
      "Inside-48 guidance exposed a decline-note action surface.",
    );
    assert.equal(
      await inside48Dialog.getByRole("button", { name: "Can’t make it" }).count(),
      0,
      "Inside-48 guidance exposed an active decline button.",
    );
    await screenshot(page, "inside-48-guidance");
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: new RegExp(`${escapeRegExp(fixture.namespace)} Started`) }).click();
    const startedDialog = page.getByRole("dialog", { name: new RegExp(`${escapeRegExp(fixture.namespace)} Started`) });
    await startedDialog.getByText(/already started/).waitFor();
    assert(
      await startedDialog.getByRole("button", { name: "Confirm" }).first().isDisabled(),
      "Started assignment exposed an active Confirm control.",
    );
    await screenshot(page, "started-guidance");

    const noTokenLeak = await page.evaluate(
      (secret) =>
        !document.documentElement.innerHTML.includes(secret) &&
        !localStorage.getItem("pl-volunteer-schedule") &&
        !sessionStorage.getItem("pl-volunteer-schedule") &&
        !document.cookie.includes(secret),
      token,
    );
    assert(noTokenLeak, "Volunteer schedule bearer leaked into HTML, storage, or readable cookies.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(createPreviewUrl(previewBaseUrl, "/v/schedule"), { waitUntil: "networkidle" });
    await assertNoOverflow(page, "390px volunteer schedule");
    await screenshot(page, "volunteer-schedule-390");
    await context.close();
  } finally {
    if (browser) await browser.close();
  }
}

async function verifyAdminResponseTruth(page, oneOffTitle) {
  await openCalendarItem(page, oneOffTitle, fixtureDates.future);
  await page.getByText("Confirmed").first().waitFor();
  await page.getByText(/2\/2 assigned|3\/2 assigned|assigned/).first().waitFor();
  await openCalendarItem(page, `${fixture.namespace} Decline Me`, fixtureDates.future2);
  await page.getByText(/Denied|Can’t make it/).first().waitFor();
  await screenshot(page, "admin-response-states");
  const rows = runHostedSql(
    `select ar.response_status, count(*)::int
from public.assignment_responses ar
join public.calendar_assignments ca on ca.workspace_id = ar.workspace_id and ca.id = ar.assignment_id
where ar.workspace_id = ${sqlUuid(fixture.workspaceId)}
  and ca.volunteer_profile_id = ${sqlUuid(fixture.volunteers.browser)}
group by ar.response_status
order by ar.response_status;`,
    "Hosted response truth check",
  );
  const counts = Object.fromEntries(rows.map((row) => [row.response_status, row.count]));
  assert(Number(counts.confirmed ?? 0) >= 2, "Confirm/Confirm All did not persist confirmed responses.");
  assert(Number(counts.declined ?? 0) >= 1, "Decline response did not persist.");
  report.adminCoverage = "passed";
}

async function verifyNegativePaths(oneOffTitle, recordingPath) {
  let browser;
  try {
    browser = await chromium.launch(resolveBrowserLaunchOptions());
    const viewContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await addBrowserCookies(viewContext, "viewOnly");
    const viewPage = await viewContext.newPage();
    await viewPage.goto(createPreviewUrl(previewBaseUrl, "/admin/volunteers"), { waitUntil: "networkidle" });
    await viewPage.getByText("Volunteer profile editing is unavailable").first().waitFor();
    assert.equal(await viewPage.getByRole("button", { name: "Save volunteer" }).count(), 0);
    await viewPage.goto(createPreviewUrl(previewBaseUrl, `/admin/calendar?view=week&date=${fixtureDates.future}`), { waitUntil: "networkidle" });
    await viewPage.getByRole("button", { name: new RegExp(escapeRegExp(oneOffTitle)) }).first().click();
    const dialog = viewPage.getByRole("dialog", { name: "Calendar item inspector" });
    await dialog.getByText("This contact can view Calendar assignments but cannot change them.").first().waitFor();
    assert.equal(await dialog.getByRole("button", { name: "Publish item" }).count(), 0);
    assert.equal(await dialog.getByRole("button", { name: "Send initial assignment emails" }).count(), 0);
    await viewContext.close();

    const otherContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await addBrowserCookies(otherContext, "other");
    const otherPage = await otherContext.newPage();
    await otherPage.goto(createPreviewUrl(previewBaseUrl, "/admin/volunteers"), { waitUntil: "networkidle" });
    assert.equal(await otherPage.getByText(`${fixture.namespace} Browser Edited`).count(), 0, "Wrong workspace saw main volunteer.");
    await otherPage.goto(createPreviewUrl(previewBaseUrl, `/admin/calendar?view=week&date=${fixtureDates.future}`), { waitUntil: "networkidle" });
    assert.equal(await otherPage.getByText(oneOffTitle).count(), 0, "Wrong workspace saw main Calendar item.");
    await otherContext.close();

    const schedulerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await addBrowserCookies(schedulerContext, "scheduler");
    const schedulerPage = await schedulerContext.newPage();
    await openCalendarItem(schedulerPage, `${fixture.namespace} Missing Follow`, fixtureDates.future2);
    await schedulerPage.getByText("Needs Follow-up Contact: 1").first().waitFor();
    const missingFollowButton = schedulerPage.getByRole("dialog").getByRole("button", {
      name: "Send initial assignment emails",
      exact: true,
    });
    assert(await missingFollowButton.isDisabled(), "Missing Follow-up Contact item should not be sendable.");
    assert.equal(readRecordingLines(recordingPath).length, 2, "Missing Follow-up Contact check sent email.");
    await schedulerContext.close();

    const invalid = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const invalidPage = await invalid.newPage();
    await invalidPage.goto(createPreviewUrl(previewBaseUrl, "/v/access/not-a-real-project-local-token"), { waitUntil: "networkidle" });
    await invalidPage.getByText(/schedule link is unavailable|secure schedule access/i).first().waitFor();
    assert.equal(await invalidPage.getByText(`${fixture.namespace} Browser Edited`).count(), 0);
    await invalid.close();

    report.negatives = "passed";
  } finally {
    if (browser) await browser.close();
  }
}

function resolveBrowserLaunchOptions() {
  const executable = resolvePreviewBrowserExecutable();
  return executable ? { executablePath: executable } : {};
}

function resolvePreviewBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.MSEDGE_EXECUTABLE_PATH,
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? undefined;
}

async function verifyDirectWriteDenial() {
  const client = fixture.users.scheduler.client;
  const insert = await client.from("calendar_items").insert({
    workspace_id: fixture.workspaceId,
    title_snapshot: `${fixture.namespace} forbidden direct insert`,
    task_type_snapshot: "general",
    schedule_kind: "timed",
    start_date: fixtureDates.future,
    start_time: "07:00",
    end_time: "08:00",
    timezone: "America/Denver",
    needed_count: 1,
  });
  assert(insert.error, "Authenticated direct calendar_items insert unexpectedly succeeded.");
  const volunteerUpdate = await client.from("volunteer_profiles").update({ full_name: "forbidden" }).eq("id", fixture.volunteers.browser);
  assert(volunteerUpdate.error, "Authenticated direct volunteer profile update unexpectedly succeeded.");
}

async function verifyBrowserLoop(recordingPath) {
  await startHostedPreview(recordingPath);
  let browser;
  try {
    browser = await chromium.launch(resolveBrowserLaunchOptions());
    await createBrowserCookies("scheduler");
    await createBrowserCookies("viewOnly");
    await createBrowserCookies("other");
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await addBrowserCookies(context, "scheduler");
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(redact(error)));
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(redact(message.text()));
    });

    await addAndEditVolunteer(page);
    const oneOffTitle = await createOneOffDraft(page);
    await createPresetDraft(page);
    await assignVolunteers(page, oneOffTitle);
    createSupplementalRows(oneOffTitle);
    await verifyDraftPrivacy(page, oneOffTitle);
    await publishOneOff(page, oneOffTitle);
    await sendInitialEmail(page, oneOffTitle, recordingPath);
    const scheduleToken = await issueScheduleAccess(fixture.volunteers.browser);
    await verifyVolunteerSchedule(scheduleToken, oneOffTitle);
    await verifyAdminResponseTruth(page, oneOffTitle);
    await verifyNegativePaths(oneOffTitle, recordingPath);
    await verifyDirectWriteDenial();
    await assertNoRenderedLeak(page, recordingPath);
    assert.equal(failures.length, 0, `Browser console/page errors occurred: ${failures.join(" | ")}`);
    await context.close();
    report.leakage = "passed";
  } finally {
    if (browser) await browser.close();
    await stopHostedPreview();
  }
}

function verifyDatabaseInvariants() {
  const rows = runHostedSql(
    `select
  (select count(*) from public.assignment_notification_deliveries where workspace_id = ${sqlUuid(fixture.workspaceId)} and delivery_state = 'sent')::int as sent_count,
  (select count(*) from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as response_token_count,
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as reveal_event_count,
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as schedule_token_count,
  (select count(*) from public.calendar_items where workspace_id = ${sqlUuid(fixture.workspaceId)} and publication_state = 'draft')::int as draft_count,
  (select count(*) from public.calendar_items where workspace_id = ${sqlUuid(fixture.workspaceId)} and publication_state = 'published')::int as published_count;`,
    "Hosted final invariant check",
  )[0];
  assert.equal(rows.sent_count, 2, "Unexpected hosted sent-delivery count.");
  assert.equal(rows.response_token_count, 0, "Hosted E2E created assignment response tokens.");
  assert.equal(rows.reveal_event_count, 0, "Hosted E2E activated response-link reveal/copy.");
  assert(Number(rows.schedule_token_count) >= 3, "Hosted E2E did not issue schedule access credentials.");
  assert(Number(rows.draft_count) >= 1, "Hosted E2E lost draft state.");
  assert(Number(rows.published_count) >= 1, "Hosted E2E did not preserve published state.");
}

function cleanupHostedFixtures() {
  for (const user of Object.values(fixture.users)) {
    if (user.client) user.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  const workspaceIds = idArray([fixture.workspaceId, fixture.otherWorkspaceId]);
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
delete from public.task_presets where workspace_id in (${workspaceIds}) or name like ${sqlText(`${fixture.namespace}%`)};
delete from public.volunteer_profiles where workspace_id in (${workspaceIds}) or full_name like ${sqlText(`${fixture.namespace}%`)};
delete from public.workspace_contact_grants where workspace_id in (${workspaceIds}) or project_contact_id in (${contactIds});
delete from public.project_contacts where id in (${contactIds}) or auth_user_id in (${userIds});
delete from public.workspaces where id in (${workspaceIds}) or workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.identities where user_id in (${userIds});
delete from auth.users where id in (${userIds}) or email like ${sqlText(`${fixture.namespace}%`)};
commit;`, "Hosted Bozeman E2E cleanup");
}

function verifyZeroResidue() {
  const workspaceIds = idArray([fixture.workspaceId, fixture.otherWorkspaceId]);
  const contactIds = idArray(Object.values(fixture.contacts));
  const userIds = idArray(Object.values(fixture.users).map((user) => user.userId));
  const exact = runHostedSql(`select (
  (select count(*) from public.assignment_notification_deliveries where workspace_id in (${workspaceIds})) +
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id in (${workspaceIds})) +
  (select count(*) from public.assignment_response_tokens where workspace_id in (${workspaceIds})) +
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id in (${workspaceIds})) +
  (select count(*) from public.assignment_responses where workspace_id in (${workspaceIds})) +
  (select count(*) from public.calendar_assignments where workspace_id in (${workspaceIds})) +
  (select count(*) from public.calendar_items where workspace_id in (${workspaceIds})) +
  (select count(*) from public.task_presets where workspace_id in (${workspaceIds})) +
  (select count(*) from public.volunteer_profiles where workspace_id in (${workspaceIds})) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (${workspaceIds}) or project_contact_id in (${contactIds})) +
  (select count(*) from public.project_contacts where id in (${contactIds}) or auth_user_id in (${userIds})) +
  (select count(*) from public.workspaces where id in (${workspaceIds})) +
  (select count(*) from auth.users where id in (${userIds}))
)::int as residue_count;`, "Hosted Bozeman E2E exact residue check")[0]?.residue_count;
  const namespace = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.project_contacts where volunteer_facing_display_name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.task_presets where name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.calendar_items where title_snapshot like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}%`)})
)::int as residue_count;`, "Hosted Bozeman E2E namespace residue check")[0]?.residue_count;
  const auth = runHostedSql(
    `select count(*)::int as residue_count from auth.users where email like ${sqlText(`${fixture.namespace}%`)};`,
    "Hosted Bozeman E2E Auth residue check",
  )[0]?.residue_count;
  report.exactResidue = Number(exact);
  report.namespaceResidue = Number(namespace);
  report.authResidue = Number(auth);
  assert.equal(report.exactResidue, 0, "Hosted exact-run residue remains.");
  assert.equal(report.namespaceResidue, 0, "Hosted namespace residue remains.");
  assert.equal(report.authResidue, 0, "Hosted Auth residue remains.");
  report.migrationAfter = latestHostedMigration();
  assert.equal(report.migrationAfter, expectedMigration, "Hosted migration level drifted after cleanup.");
}

async function main() {
  try {
    if (process.env[optInName] !== expectedConfirmation) {
      assert(
        process.env[optInName] === expectedConfirmation,
        `Refusing hosted Bozeman beta E2E validation without ${optInName}=${expectedConfirmation}.`,
      );
    }
    await verifyStaticBoundaries();
    if (process.env.SKIP_HOSTED_BOZEMAN_BETA_E2E_REFUSAL !== "1") {
      await verifyOptInRefusal();
    }
    await verifyTargetAndReadAnonKey();
    await verifyGeneratedTypes();
    tempDir = await mkdtemp(path.join(tmpdir(), "pl-12-23-1-"));
    const recordingPath = path.join(tempDir, "assignment-email-recording.jsonl");
    await createHostedAuthFixtures();
    await createBaseProductFixtures();
    await signInHostedUsers();
    await verifyBrowserLoop(recordingPath);
    verifyDatabaseInvariants();
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

  if (process.exitCode) return;
  console.log(`Hosted Bozeman beta end-to-end validation passed for ${expectedName} (${expectedRef}).`);
  console.log(`Project health: ${report.projectStatus}. Migration before: ${report.migrationBefore}. Migration after: ${report.migrationAfter}.`);
  console.log(`Validated one namespace (${fixture.namespace}) across Auth, Volunteers Add/Edit, Calendar one-off/preset drafts, assignment, publication, recording-only Initial email, secure schedule handoff, Confirm/Deny/Confirm All, admin response truth, negative paths, safe output, and cleanup.`);
  console.log(`Generated-type parity: ${report.generatedTypes}. Opt-in refusal: ${report.optInRefusal}. Screenshots captured in temp then removed: ${report.screenshots}.`);
  console.log(`Hosted disposable residue: exact=${report.exactResidue}, namespace=${report.namespaceResidue}, auth=${report.authResidue}.`);
  console.log("No production target, real email provider, service-role application path, response-link reveal/copy, public lookup, remembered-device bearer storage, or mock/persisted mixing was used.");
}

await main();
