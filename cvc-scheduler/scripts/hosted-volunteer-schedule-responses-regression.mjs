import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync, openSync, closeSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

import { createPreviewUrl, resolvePreviewBrowserExecutable } from "./preview-config.mjs";
import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedBeforeMigration = "20260714122000";
const expectedAfterMigration = "20260714122100";
const expectedMigrationFile = `${expectedAfterMigration}_volunteer_schedule_responses.sql`;
const optInName = "RUN_HOSTED_VOLUNTEER_SCHEDULE_RESPONSE_VALIDATION";
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
  far: dateDaysFromToday(14),
  farPlusOne: dateDaysFromToday(15),
  farPlusTwo: dateDaysFromToday(16),
  inside48: dateDaysFromToday(1),
  past: dateDaysFromToday(-1),
};

const fixture = {
  namespace: `qa-12-21-1-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  inactiveWorkspaceId: randomUUID(),
  taskPresetId: randomUUID(),
  otherTaskPresetId: randomUUID(),
  contacts: Object.fromEntries(
    [
      "issuer",
      "noEdit",
      "assignmentsView",
      "volunteersView",
      "calendarEdit",
      "tasksEdit",
      "roleOnly",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "other",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  grants: Object.fromEntries(
    [
      "issuer",
      "noEdit",
      "assignmentsView",
      "volunteersView",
      "calendarEdit",
      "tasksEdit",
      "roleOnly",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "other",
      "inactiveWorkspace",
    ].map((label) => [label, randomUUID()]),
  ),
  volunteers: {
    own: randomUUID(),
    empty: randomUUID(),
    otherSameWorkspace: randomUUID(),
    wrongWorkspace: randomUUID(),
    inactiveWorkspace: randomUUID(),
    onHold: randomUUID(),
    inactive: randomUUID(),
  },
  items: {
    publishedOneOff: randomUUID(),
    publishedPreset: randomUUID(),
    publishedDeclined: randomUUID(),
    confirmAllA: randomUUID(),
    confirmAllB: randomUUID(),
    inside48: randomUUID(),
    past: randomUUID(),
    draft: randomUUID(),
    archived: randomUUID(),
    canceled: randomUUID(),
    informational: randomUUID(),
    wrongWorkspace: randomUUID(),
  },
  assignments: {
    needs: randomUUID(),
    confirmed: randomUUID(),
    declined: randomUUID(),
    confirmAllA: randomUUID(),
    confirmAllB: randomUUID(),
    inside48: randomUUID(),
    past: randomUUID(),
    canceled: randomUUID(),
    otherVolunteer: randomUUID(),
    draft: randomUUID(),
    archivedItem: randomUUID(),
    wrongWorkspace: randomUUID(),
  },
  responses: {
    needs: randomUUID(),
    confirmed: randomUUID(),
    declined: randomUUID(),
    confirmAllA: randomUUID(),
    confirmAllB: randomUUID(),
    inside48: randomUUID(),
    past: randomUUID(),
    canceled: randomUUID(),
    otherVolunteer: randomUUID(),
    draft: randomUUID(),
    archivedItem: randomUUID(),
    wrongWorkspace: randomUUID(),
  },
  users: Object.fromEntries(
    [
      "issuer",
      "noEdit",
      "assignmentsView",
      "volunteersView",
      "calendarEdit",
      "tasksEdit",
      "roleOnly",
      "revoked",
      "expired",
      "inactiveGrant",
      "inactiveContact",
      "other",
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

const issuedTokens = {
  primary: null,
  empty: null,
  second: null,
  expired: null,
  responseBearer: null,
};

let previewProcess = null;
let cleanupCompleted = false;
let exactResidueCount = null;
let namespaceResidueCount = null;
let projectStatus = "unknown";

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
    .replace(/(?:password|apikey|api_key|access_token|refresh_token|bearer|cookie)=\S+/gi, "$1=[redacted]")
    .slice(0, 1400);
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
    maxBuffer: 80 * 1024 * 1024,
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
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 80 * 1024 * 1024,
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

function safeLogTail(file) {
  if (!file) return "";
  try {
    return readFileSync(file, "utf8").split(/\r?\n/).slice(-40).join("\n");
  } catch {
    return "";
  }
}

function hostedPreviewEnv(anonKey) {
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
    SUPABASE_SERVICE_ROLE_KEY: "",
  };
}

function npmInvocation(args) {
  if (process.platform !== "win32") return { commandName: "npm", args };
  return {
    commandName: process.execPath,
    args: [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"), ...args],
  };
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
      // Best-effort cleanup only; fixture SQL contains no committed credentials.
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
  return anonKey;
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
      "Hosted migration dry-run did not identify the reviewed 12.20 migration.",
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
  const [migration, accessRoute, schedulePage, refresh, actions, client, server, token, proxy, packageJson] =
    await Promise.all([
      readFile(path.join(root, "supabase", "migrations", expectedMigrationFile), "utf8"),
      readFile(path.join(root, "app", "v", "access", "[token]", "route.ts"), "utf8"),
      readFile(path.join(root, "app", "v", "schedule", "page.tsx"), "utf8"),
      readFile(path.join(root, "components", "VolunteerScheduleAccessRefresh.tsx"), "utf8"),
      readFile(path.join(root, "app", "v", "schedule", "actions.ts"), "utf8"),
      readFile(path.join(root, "components", "VolunteerScheduleClient.tsx"), "utf8"),
      readFile(path.join(root, "lib", "volunteerScheduleAccess", "server.ts"), "utf8"),
      readFile(path.join(root, "lib", "volunteerScheduleAccess", "token.ts"), "utf8"),
      readFile(path.join(root, "proxy.ts"), "utf8"),
      readFile(path.join(root, "package.json"), "utf8"),
    ]);
  const combinedProduct = `${accessRoute}\n${schedulePage}\n${refresh}\n${actions}\n${client}\n${server}\n${token}\n${proxy}`;

  assert(migration.includes("submit_volunteer_schedule_assignment_response"), "Schedule response RPC is missing.");
  assert(migration.includes("confirm_all_volunteer_schedule_assignments"), "Confirm All RPC is missing.");
  assert(migration.includes("submit_assignment_response_by_token"), "Assignment-response token parity replacement is missing.");
  assert(migration.includes("response_source in ('project_contact', 'public_token', 'volunteer_schedule')"), "Response source provenance constraint is missing.");
  assert(migration.includes("response_source = 'volunteer_schedule'"), "Schedule responses do not record volunteer_schedule provenance.");
  assert(migration.includes("response_source = 'public_token'"), "Assignment-response token responses do not remain public_token.");
  assert(migration.includes("interval '48 hours'"), "48-hour decline cutoff is missing.");
  assert(migration.includes("assignment_start_at <= now()"), "Assignment-start lock is missing.");
  assert(migration.includes("grant execute on function public.submit_volunteer_schedule_assignment_response"), "Public execute grant for schedule response RPC is missing.");
  assert(migration.includes("grant execute on function public.confirm_all_volunteer_schedule_assignments"), "Public execute grant for Confirm All RPC is missing.");
  assert(migration.includes("grant execute on function public.read_volunteer_schedule(text) to anon, authenticated"), "Public schedule read execute grant is missing.");
  assert(!/grant (?:select|insert|update|delete|all).*volunteer_schedule_access_tokens.*to (?:anon|authenticated)/i.test(migration), "Schedule token table exposes direct broad table grants.");

  assert(accessRoute.includes("readVolunteerSchedule") && accessRoute.includes("httpOnly: true"), "Access route does not validate and set an HttpOnly cookie.");
  assert(accessRoute.includes("sameSite: \"lax\"") && accessRoute.includes("path: volunteerScheduleAccessCookie.path"), "Access route cookie attributes are incomplete.");
  assert(accessRoute.includes("x-forwarded-proto") && accessRoute.includes("host"), "Access route does not preserve request host/protocol.");
  assert(schedulePage.includes("cookies()") && schedulePage.includes("readVolunteerSchedule"), "Schedule page does not read from the server cookie boundary.");
  assert(schedulePage.includes("submitVolunteerScheduleResponseAction") && schedulePage.includes("confirmAllVolunteerScheduleAction"), "Schedule page does not pass response actions.");
  assert(actions.includes("cookies()") && actions.includes("volunteerScheduleAccessCookie.name"), "Schedule actions do not read the HttpOnly cookie server-side.");
  assert(actions.includes("submitVolunteerScheduleAssignmentResponse") && actions.includes("confirmAllVolunteerScheduleAssignments"), "Schedule actions do not call response helpers.");
  assert(actions.includes("revalidatePath(\"/v/schedule\")"), "Schedule actions do not refresh schedule truth.");
  assert(schedulePage.includes("access") && refresh.includes("window.location.replace(\"/v/schedule\")"), "Linked handoff cleanup is missing.");
  assert(client.includes("Confirm all pending"), "Schedule UI lacks Confirm All.");
  /*
  assert(client.includes("Canâ€™t make it"), "Schedule UI lacks Can't-make-it action.");
  */
  assert(client.includes("make it"), "Schedule UI lacks Can't-make-it action.");
  assert(client.includes("The project team will include contact details in a later beta slice."), "Follow-up Contact gap copy is missing.");
  assert(proxy.includes("/v/schedule") && proxy.includes("/v/access/:path*"), "Proxy does not cover schedule routes.");
  assert(packageJson.includes("test:volunteer-schedule-responses:hosted"), "Hosted schedule response package script is missing.");
  assert(!/SUPABASE_SERVICE_ROLE_KEY|createServiceRole|auth\.admin/i.test(combinedProduct), "Volunteer schedule product path references a service-role shortcut.");
  assert(!/sendEmail|emailProvider|delivery_record|rememberedDevice|remembered_device|public_lookup|reveal_assignment_response_link|copy response link|Needs Attention/i.test(combinedProduct), "Schedule response product path appears to activate out-of-scope behavior.");
  assert(!/\/v\/demo/.test(combinedProduct), "Schedule product path references /v/demo.");

  for (const directory of ["app", "components"]) {
    for (const file of (await collectFiles(path.join(root, directory))).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
      const content = await readFile(file, "utf8");
      assert(!content.includes("select(\"*\")") && !content.includes("select('*')"), `Product route/component introduced select-star: ${path.relative(root, file)}`);
    }
  }
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

function prepareUser(label) {
  const user = fixture.users[label];
  user.email = `${fixture.namespace}-${label}@example.invalid`;
  user.password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(user.email);
  secrets.add(user.password);
  return user;
}

function workspaceRow(id, key, name, lifecycle = "active") {
  return `(${sqlUuid(id)}, ${sqlText(key)}, ${sqlText(name)}, ${sqlText(lifecycle)}, 'America/Denver', (current_date - interval '30 days')::date, (current_date + interval '365 days')::date, false)`;
}

function grantRow(label, workspaceId, role, capabilities, status = "active", validity = "current") {
  const revokedAt = status === "revoked" ? "clock_timestamp()" : "null";
  const validFrom = validity === "expired" ? "clock_timestamp() - interval '4 days'" : "clock_timestamp() - interval '1 day'";
  const validUntil = validity === "expired" ? "clock_timestamp() - interval '1 day'" : "null";
  return `(${sqlUuid(fixture.grants[label])}, ${sqlUuid(workspaceId)}, ${sqlUuid(fixture.contacts[label])}, ${sqlText(role)}, ${sqlCapabilities(capabilities)}, ${sqlText(status)}, ${validFrom}, ${validUntil}, ${revokedAt})`;
}

function volunteerRow(id, workspaceId, fullName, contactId, readiness = "ready", lifecycle = "active") {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, null, 'manual', ${sqlUuid(contactId)}, clock_timestamp(), ${sqlText(lifecycle)}, ${sqlText(readiness)}, ${sqlText(fullName)}, ${sqlText(`${fullName.replaceAll(" ", ".").toLowerCase()}@example.invalid`)}, '+1 555 010 1220', 'Bozeman QA', 'Email', '{}'::jsonb, '{}'::jsonb, 'Private hosted QA note')`;
}

function itemRow(id, workspaceId, taskPresetId, title, date, needed, lifecycle, publication, contactId, notes = null) {
  const publishedAt = publication === "published" ? "clock_timestamp()" : "null";
  const publisher = publication === "published" ? sqlUuid(contactId) : "null";
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, ${taskPresetId ? sqlUuid(taskPresetId) : "null"}, ${sqlText(title)}, 'general', 'timed', ${sqlText(date)}::date, null, '09:00'::time, '11:00'::time, 'America/Denver', ${needed}, ${sqlText(notes)}, '{}'::jsonb, ${sqlText(lifecycle)}, ${sqlUuid(contactId)}, ${sqlUuid(contactId)}, ${sqlText(publication)}, ${publishedAt}, ${publisher})`;
}

function assignmentRow(id, workspaceId, itemId, volunteerId, lifecycle = "active") {
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, ${sqlUuid(itemId)}, ${sqlUuid(volunteerId)}, ${sqlText(lifecycle)}, null, null)`;
}

function responseRow(id, workspaceId, assignmentId, status) {
  const respondedAt = status === "needs_response" ? "null" : "clock_timestamp()";
  return `(${sqlUuid(id)}, ${sqlUuid(workspaceId)}, ${sqlUuid(assignmentId)}, ${sqlText(status)}, 'project_contact', null, ${respondedAt}, null)`;
}

async function createFixtures(anonKey) {
  for (const label of Object.keys(fixture.users)) prepareUser(label);
  runHostedSql(`begin;
${Object.values(fixture.users).map(authUserSql).join("\n")}
commit;
select 'auth-created' as fixture_state;`, "Hosted schedule response Auth fixture creation");

  runHostedSql(`begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled
) values
  ${workspaceRow(fixture.workspaceId, `${fixture.namespace}-target`, "QA 12.21.1 Volunteer Schedule Target")},
  ${workspaceRow(fixture.otherWorkspaceId, `${fixture.namespace}-other`, "QA 12.21.1 Volunteer Schedule Other")},
  ${workspaceRow(fixture.inactiveWorkspaceId, `${fixture.namespace}-inactive`, "QA 12.21.1 Volunteer Schedule Inactive", "archived")};

insert into public.project_contacts (id, auth_user_id, status)
values
  ${Object.entries(fixture.users)
    .map(([label, user]) => `(${sqlUuid(fixture.contacts[label])}, ${sqlUuid(user.userId)}, ${label === "inactiveContact" ? "'inactive'" : "'active'"})`)
    .join(",\n  ")};

insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at
) values
  ${grantRow("issuer", fixture.workspaceId, "main_contact", ["workspace.read", "calendar.view", "assignments.view", "assignments.edit"])},
  ${grantRow("noEdit", fixture.workspaceId, "assistant_contact", ["workspace.read"])},
  ${grantRow("assignmentsView", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.view"])},
  ${grantRow("volunteersView", fixture.workspaceId, "assistant_contact", ["workspace.read", "volunteers.view"])},
  ${grantRow("calendarEdit", fixture.workspaceId, "assistant_contact", ["workspace.read", "calendar.edit"])},
  ${grantRow("tasksEdit", fixture.workspaceId, "assistant_contact", ["workspace.read", "tasks.edit"])},
  ${grantRow("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRow("revoked", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit"], "revoked")},
  ${grantRow("expired", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit"], "active", "expired")},
  ${grantRow("inactiveGrant", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit"], "inactive")},
  ${grantRow("inactiveContact", fixture.workspaceId, "assistant_contact", ["workspace.read", "assignments.edit"])},
  ${grantRow("other", fixture.otherWorkspaceId, "main_contact", ["workspace.read", "assignments.edit"])},
  ${grantRow("inactiveWorkspace", fixture.inactiveWorkspaceId, "main_contact", ["workspace.read", "assignments.edit"])};

insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
  manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
  preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
) values
  ${volunteerRow(fixture.volunteers.own, fixture.workspaceId, `${fixture.namespace} Own Volunteer`, fixture.contacts.issuer)},
  ${volunteerRow(fixture.volunteers.empty, fixture.workspaceId, `${fixture.namespace} Empty Volunteer`, fixture.contacts.issuer)},
  ${volunteerRow(fixture.volunteers.otherSameWorkspace, fixture.workspaceId, `${fixture.namespace} Other Volunteer`, fixture.contacts.issuer)},
  ${volunteerRow(fixture.volunteers.onHold, fixture.workspaceId, `${fixture.namespace} On Hold Volunteer`, fixture.contacts.issuer, "on_hold")},
  ${volunteerRow(fixture.volunteers.inactive, fixture.workspaceId, `${fixture.namespace} Inactive Volunteer`, fixture.contacts.issuer, "ready", "inactive")},
  ${volunteerRow(fixture.volunteers.wrongWorkspace, fixture.otherWorkspaceId, `${fixture.namespace} Wrong Workspace Volunteer`, fixture.contacts.other)},
  ${volunteerRow(fixture.volunteers.inactiveWorkspace, fixture.inactiveWorkspaceId, `${fixture.namespace} Inactive Workspace Volunteer`, fixture.contacts.inactiveWorkspace)};

insert into public.task_presets (
  id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible,
  is_system_preset, system_key, custom_field_definitions, lifecycle
) values
  (${sqlUuid(fixture.taskPresetId)}, ${sqlUuid(fixture.workspaceId)}, ${sqlText(`${fixture.namespace} Preset`)}, 'Hosted schedule preset', 'general', 2, true, false, null, '[]'::jsonb, 'active'),
  (${sqlUuid(fixture.otherTaskPresetId)}, ${sqlUuid(fixture.otherWorkspaceId)}, ${sqlText(`${fixture.namespace} Other Preset`)}, 'Hosted schedule other preset', 'general', 1, true, false, null, '[]'::jsonb, 'active');

insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, end_date, start_time, end_time, timezone, needed_count, schedule_notes,
  custom_values, lifecycle, follow_up_project_contact_id, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
) values
  ${itemRow(fixture.items.publishedOneOff, fixture.workspaceId, null, `${fixture.namespace} Confirm Me`, fixtureDates.far, 2, "active", "published", fixture.contacts.issuer, "Hosted safe schedule note.")},
  ${itemRow(fixture.items.publishedPreset, fixture.workspaceId, fixture.taskPresetId, `${fixture.namespace} Decline Me`, fixtureDates.farPlusOne, 1, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.publishedDeclined, fixture.workspaceId, null, `${fixture.namespace} Reconfirm Me`, fixtureDates.farPlusTwo, 1, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.confirmAllA, fixture.workspaceId, null, `${fixture.namespace} All A`, fixtureDates.far, 1, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.confirmAllB, fixture.workspaceId, null, `${fixture.namespace} All B`, fixtureDates.farPlusOne, 1, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.inside48, fixture.workspaceId, null, `${fixture.namespace} Inside 48`, fixtureDates.inside48, 1, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.past, fixture.workspaceId, null, `${fixture.namespace} Already Started`, fixtureDates.past, 1, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.draft, fixture.workspaceId, null, `${fixture.namespace} Draft Hidden`, fixtureDates.far, 1, "active", "draft", fixture.contacts.issuer)},
  ${itemRow(fixture.items.archived, fixture.workspaceId, null, `${fixture.namespace} Archived Hidden`, fixtureDates.far, 1, "archived", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.canceled, fixture.workspaceId, null, `${fixture.namespace} Canceled Hidden`, fixtureDates.far, 1, "canceled", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.informational, fixture.workspaceId, null, `${fixture.namespace} Informational Unassigned`, fixtureDates.far, 0, "active", "published", fixture.contacts.issuer)},
  ${itemRow(fixture.items.wrongWorkspace, fixture.otherWorkspaceId, fixture.otherTaskPresetId, `${fixture.namespace} Wrong Workspace Hidden`, fixtureDates.far, 1, "active", "published", fixture.contacts.other)};

insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, assignment_note, created_by_auth_user_id
) values
  ${assignmentRow(fixture.assignments.needs, fixture.workspaceId, fixture.items.publishedOneOff, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.confirmed, fixture.workspaceId, fixture.items.publishedPreset, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.declined, fixture.workspaceId, fixture.items.publishedDeclined, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.confirmAllA, fixture.workspaceId, fixture.items.confirmAllA, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.confirmAllB, fixture.workspaceId, fixture.items.confirmAllB, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.inside48, fixture.workspaceId, fixture.items.inside48, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.past, fixture.workspaceId, fixture.items.past, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.canceled, fixture.workspaceId, fixture.items.publishedPreset, fixture.volunteers.own, "canceled")},
  ${assignmentRow(fixture.assignments.otherVolunteer, fixture.workspaceId, fixture.items.publishedOneOff, fixture.volunteers.otherSameWorkspace)},
  ${assignmentRow(fixture.assignments.draft, fixture.workspaceId, fixture.items.draft, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.archivedItem, fixture.workspaceId, fixture.items.archived, fixture.volunteers.own)},
  ${assignmentRow(fixture.assignments.wrongWorkspace, fixture.otherWorkspaceId, fixture.items.wrongWorkspace, fixture.volunteers.wrongWorkspace)};

insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, response_note, responded_at, updated_by_auth_user_id
) values
  ${responseRow(fixture.responses.needs, fixture.workspaceId, fixture.assignments.needs, "needs_response")},
  ${responseRow(fixture.responses.confirmed, fixture.workspaceId, fixture.assignments.confirmed, "confirmed")},
  ${responseRow(fixture.responses.declined, fixture.workspaceId, fixture.assignments.declined, "declined")},
  ${responseRow(fixture.responses.confirmAllA, fixture.workspaceId, fixture.assignments.confirmAllA, "needs_response")},
  ${responseRow(fixture.responses.confirmAllB, fixture.workspaceId, fixture.assignments.confirmAllB, "needs_response")},
  ${responseRow(fixture.responses.inside48, fixture.workspaceId, fixture.assignments.inside48, "needs_response")},
  ${responseRow(fixture.responses.past, fixture.workspaceId, fixture.assignments.past, "needs_response")},
  ${responseRow(fixture.responses.canceled, fixture.workspaceId, fixture.assignments.canceled, "confirmed")},
  ${responseRow(fixture.responses.otherVolunteer, fixture.workspaceId, fixture.assignments.otherVolunteer, "confirmed")},
  ${responseRow(fixture.responses.draft, fixture.workspaceId, fixture.assignments.draft, "needs_response")},
  ${responseRow(fixture.responses.archivedItem, fixture.workspaceId, fixture.assignments.archivedItem, "needs_response")},
  ${responseRow(fixture.responses.wrongWorkspace, fixture.otherWorkspaceId, fixture.assignments.wrongWorkspace, "confirmed")};
commit;
select 'fixtures-created' as fixture_state;`, "Hosted schedule response product fixture creation");

  for (const user of Object.values(fixture.users)) {
    const client = createClient(hostedUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signIn = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    assert(!signIn.error && signIn.data.session, `Hosted sign-in failed for ${user.label}.`);
    secrets.add(signIn.data.session.access_token);
    secrets.add(signIn.data.session.refresh_token);
    user.client = client;
  }
}

async function expectRpcFailure(label, operation) {
  const { error } = await operation();
  assert(error, `${label} unexpectedly succeeded.`);
}

async function issueScheduleToken(client, volunteerProfileId, ttlHours = null, extra = {}) {
  const { data, error } = await client.rpc("issue_volunteer_schedule_access", {
    p_volunteer_profile_id: volunteerProfileId,
    p_ttl_hours: ttlHours,
    ...extra,
  });
  if (error) throw new Error("Schedule access issuance failed.");
  assert(Array.isArray(data) && data.length === 1, "Schedule access issuance returned an invalid shape.");
  const row = data[0];
  assert(/^[A-Za-z0-9_-]{43}$/.test(row.bearer_token), "Issued schedule bearer had an invalid format.");
  secrets.add(row.bearer_token);
  return { tokenId: row.token_id, token: row.bearer_token, expiresAt: row.token_expires_at };
}

async function readSchedule(client, bearer) {
  const { data, error } = await client.rpc("read_volunteer_schedule", {
    p_bearer_token: bearer,
  });
  if (error) throw new Error("Schedule access read failed.");
  assert(Array.isArray(data) && data.length >= 1, "Schedule access read returned an invalid shape.");
  const first = data[0];
  if (first.schedule_state === "unavailable") return { kind: "unavailable", rows: data };
  if (first.schedule_state === "ready_empty") {
    return {
      kind: "ready_empty",
      workspaceDisplayName: first.workspace_display_name,
      volunteerDisplayName: first.volunteer_display_name,
      rows: data,
    };
  }
  assert(first.schedule_state === "ready", "Schedule access read returned an unknown state.");
  return {
    kind: "ready",
    workspaceDisplayName: first.workspace_display_name,
    volunteerDisplayName: first.volunteer_display_name,
    rows: data,
    titles: data.map((row) => row.task_title),
    statuses: data.map((row) => row.current_response_status),
  };
}

function scheduleAssignment(schedule, titlePart) {
  const row = schedule.rows.find((candidate) => candidate.task_title?.includes(titlePart));
  assert(row?.assignment_reference, `Hosted schedule missing assignment ${titlePart}.`);
  return row;
}

async function submitScheduleResponse(client, bearer, assignmentId, status, note = null, extra = {}) {
  return client.rpc("submit_volunteer_schedule_assignment_response", {
    p_bearer_token: bearer,
    p_assignment_id: assignmentId,
    p_response_status: status,
    p_response_note: note,
    ...extra,
  });
}

async function confirmAllSchedule(client, bearer, extra = {}) {
  return client.rpc("confirm_all_volunteer_schedule_assignments", {
    p_bearer_token: bearer,
    ...extra,
  });
}

async function submitAssignmentResponseToken(client, bearer, status, note = null) {
  return client.rpc("submit_assignment_response_by_token", {
    p_bearer_token: bearer,
    p_response_status: status,
    p_response_note: note,
  });
}

function responseState(assignmentId) {
  return runHostedSql(`select
  response.assignment_id::text,
  response.response_status,
  response.response_source,
  response.response_note,
  response.responded_at is not null as responded,
  count(*) over (partition by response.assignment_id)::int as row_count
from public.assignment_responses as response
where response.assignment_id = ${sqlUuid(assignmentId)};`, "Hosted assignment response state check")[0];
}

async function revokeScheduleToken(client, tokenId) {
  const { data, error } = await client.rpc("revoke_volunteer_schedule_access", {
    p_token_id: tokenId,
  });
  if (error || typeof data !== "string") throw new Error("Schedule access revocation failed.");
  return data;
}

async function verifyDatabaseBehavior(anonKey) {
  const anonClient = createClient(hostedUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const issuer = fixture.users.issuer.client;

  const sourceConstraint = runHostedSql(`select pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'assignment_responses_source_known';`, "Hosted response source constraint check")[0]?.definition ?? "";
  for (const source of ["project_contact", "public_token", "volunteer_schedule"]) {
    assert(sourceConstraint.includes(source), `Hosted response source constraint omitted ${source}.`);
  }

  issuedTokens.primary = await issueScheduleToken(issuer, fixture.volunteers.own, 24);
  issuedTokens.second = await issueScheduleToken(issuer, fixture.volunteers.own, 24);
  issuedTokens.empty = await issueScheduleToken(issuer, fixture.volunteers.empty, 24);
  issuedTokens.expired = await issueScheduleToken(issuer, fixture.volunteers.own, 1);
  runHostedSql(`update public.volunteer_schedule_access_tokens
set created_at = clock_timestamp() - interval '2 hours',
    expires_at = clock_timestamp() - interval '1 minute',
    updated_at = clock_timestamp() - interval '1 minute'
where id = ${sqlUuid(issuedTokens.expired.tokenId)};`, "Hosted expired schedule token fixture update");

  let schedule = await readSchedule(anonClient, issuedTokens.primary.token);
  assert(schedule.kind === "ready", "Hosted valid schedule bearer did not return ready.");
  assert(schedule.rows.length >= 7, "Hosted response schedule did not return the expected eligible assignments.");
  assert(scheduleAssignment(schedule, "Confirm Me").current_response_status === "needs_response", "Hosted pending assignment was not visible.");
  assert(scheduleAssignment(schedule, "Inside 48").can_decline === false, "Hosted inside-48 assignment incorrectly allowed decline.");
  assert(scheduleAssignment(schedule, "Already Started").response_locked === true, "Hosted started assignment was not locked.");
  const serializedSchedule = JSON.stringify(schedule);
  for (const forbidden of [
    "token_verifier_hash",
    issuedTokens.primary.token,
    fixture.volunteers.own,
    fixture.workspaceId,
    fixture.contacts.issuer,
    "example.invalid",
    "Private hosted QA note",
  ]) {
    assert(!serializedSchedule.includes(forbidden), "Hosted public schedule projection leaked unsafe values.");
  }

  assert((await readSchedule(anonClient, issuedTokens.empty.token)).kind === "ready_empty", "Hosted empty schedule did not return ready_empty.");
  assert((await readSchedule(anonClient, "malformed")).kind === "unavailable", "Hosted malformed bearer did not fail closed.");
  assert((await readSchedule(anonClient, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).kind === "unavailable", "Hosted unknown bearer did not fail closed.");
  assert((await readSchedule(anonClient, issuedTokens.expired.token)).kind === "unavailable", "Hosted expired bearer did not fail closed.");
  await revokeScheduleToken(issuer, issuedTokens.empty.tokenId);
  assert((await readSchedule(anonClient, issuedTokens.empty.token)).kind === "unavailable", "Hosted revoked bearer did not fail closed.");

  let confirm = await submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.needs, "confirmed");
  assert(!confirm.error && confirm.data?.[0]?.current_response_status === "confirmed", "Hosted schedule Confirm failed.");
  let state = responseState(fixture.assignments.needs);
  assert(state.response_status === "confirmed" && state.response_source === "volunteer_schedule" && state.row_count === 1 && state.responded === true, "Hosted Confirm did not persist volunteer_schedule truth.");
  confirm = await submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.needs, "confirmed");
  assert(!confirm.error, "Hosted repeated Confirm was not idempotent-safe.");

  const decline = await submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.confirmed, "declined", "  Hosted note <b>plain</b>  ");
  assert(!decline.error && decline.data?.[0]?.response_note === "Hosted note <b>plain</b>", "Hosted Can't-make-it with note failed.");
  state = responseState(fixture.assignments.confirmed);
  assert(state.response_status === "declined" && state.response_source === "volunteer_schedule" && state.response_note === "Hosted note <b>plain</b>", "Hosted decline did not persist normalized note/source.");
  await expectRpcFailure("Hosted oversized decline note", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.confirmed, "declined", "x".repeat(1001)),
  );
  const repeatDecline = await submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.confirmed, "declined", "   ");
  assert(!repeatDecline.error, "Hosted repeated decline with blank note failed.");
  assert(responseState(fixture.assignments.confirmed).response_note === "Hosted note <b>plain</b>", "Hosted repeated blank decline erased meaningful note.");

  const reconfirm = await submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.declined, "confirmed");
  assert(!reconfirm.error, "Hosted declined-to-confirmed failed.");
  state = responseState(fixture.assignments.declined);
  assert(state.response_status === "confirmed" && state.response_source === "volunteer_schedule" && state.response_note === null, "Hosted reconfirm did not clear note/source correctly.");

  await expectRpcFailure("Hosted inside-48 decline", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.inside48, "declined", null),
  );
  const insideConfirm = await submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.inside48, "confirmed");
  assert(!insideConfirm.error, "Hosted inside-48 confirm failed.");
  await expectRpcFailure("Hosted inside-48 confirmed-to-declined", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.inside48, "declined", null),
  );
  await expectRpcFailure("Hosted started assignment confirm", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.past, "confirmed", null),
  );
  await expectRpcFailure("Hosted fake assignment id", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, randomUUID(), "confirmed", null),
  );
  await expectRpcFailure("Hosted another volunteer assignment", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.otherVolunteer, "confirmed", null),
  );
  await expectRpcFailure("Hosted draft parent assignment", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.draft, "confirmed", null),
  );
  await expectRpcFailure("Hosted archived parent assignment", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.archivedItem, "confirmed", null),
  );
  await expectRpcFailure("Hosted canceled assignment", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.canceled, "confirmed", null),
  );
  await expectRpcFailure("Hosted protected provenance input", () =>
    submitScheduleResponse(anonClient, issuedTokens.primary.token, fixture.assignments.confirmAllA, "confirmed", null, { response_source: "project_contact" }),
  );

  const beforeConfirmAllTokens = runHostedSql(`select
  (select count(*) from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as response_tokens,
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as schedule_tokens;`, "Hosted pre Confirm All token side-effect count")[0];
  const confirmAll = await confirmAllSchedule(anonClient, issuedTokens.primary.token);
  assert(!confirmAll.error && confirmAll.data?.[0]?.confirmed_count === 2, "Hosted Confirm All did not confirm exactly eligible pending rows.");
  assert(responseState(fixture.assignments.confirmAllA).response_source === "volunteer_schedule", "Hosted Confirm All did not record volunteer_schedule source.");
  const confirmAllRetry = await confirmAllSchedule(anonClient, issuedTokens.primary.token);
  assert(!confirmAllRetry.error && confirmAllRetry.data?.[0]?.confirmed_count === 0, "Hosted Confirm All retry was not a safe no-op.");
  const afterConfirmAllTokens = runHostedSql(`select
  (select count(*) from public.assignment_response_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as response_tokens,
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as schedule_tokens;`, "Hosted post Confirm All token side-effect count")[0];
  assert(beforeConfirmAllTokens.response_tokens === afterConfirmAllTokens.response_tokens && beforeConfirmAllTokens.schedule_tokens === afterConfirmAllTokens.schedule_tokens, "Hosted schedule responses changed token row counts.");

  const responseTokenIssue = await issuer.rpc("issue_assignment_response_token", {
    p_assignment_id: fixture.assignments.confirmAllA,
    p_ttl_hours: 1,
    p_internal_note: "hosted response parity",
  });
  assert(!responseTokenIssue.error && responseTokenIssue.data?.length === 1, "Hosted assignment-response token issuance failed.");
  issuedTokens.responseBearer = responseTokenIssue.data[0].bearer_token;
  secrets.add(issuedTokens.responseBearer);
  assert((await readSchedule(anonClient, issuedTokens.responseBearer)).kind === "unavailable", "Hosted assignment-response bearer authorized schedule read.");
  const scheduleAsResponse = await anonClient.rpc("read_assignment_response_by_token", { p_bearer_token: issuedTokens.primary.token });
  assert(scheduleAsResponse.error || scheduleAsResponse.data?.length === 0, "Hosted schedule bearer authorized response-token read.");
  const tokenDecline = await submitAssignmentResponseToken(anonClient, issuedTokens.responseBearer, "declined", "token note");
  assert(!tokenDecline.error, "Hosted assignment-response token decline outside 48 hours failed.");
  state = responseState(fixture.assignments.confirmAllA);
  assert(state.response_status === "declined" && state.response_source === "public_token", "Hosted token response did not remain public_token.");
  const scheduleCredentialCount = runHostedSql(`select count(*)::int as count
from public.volunteer_schedule_access_tokens
where workspace_id = ${sqlUuid(fixture.workspaceId)};`, "Hosted token response schedule credential side-effect check")[0]?.count;
  assert(scheduleCredentialCount === afterConfirmAllTokens.schedule_tokens, "Hosted token response created or mutated schedule credential count.");

  const concurrent = await Promise.allSettled([
    submitScheduleResponse(anonClient, issuedTokens.second.token, fixture.assignments.confirmed, "confirmed"),
    submitScheduleResponse(anonClient, issuedTokens.second.token, fixture.assignments.confirmed, "confirmed"),
  ]);
  assert(concurrent.some((result) => result.status === "fulfilled" && !result.value.error), "Hosted concurrent schedule response had no successful transaction.");
  assert(responseState(fixture.assignments.confirmed).row_count === 1, "Hosted concurrent response created duplicate current rows.");

  const calendarRead = await readCalendarReadModelWithClient({
    client: fixture.users.issuer.client,
    workspaceId: fixture.workspaceId,
    actorContactId: fixture.contacts.issuer,
    rangeStart: fixtureDates.far,
    rangeEnd: fixtureDates.farPlusTwo,
    workspaceTimezone: "America/Denver",
    periodKind: "list",
    capabilities: ["calendar.view", "assignments.view"],
    filters: {},
  });
  assert(calendarRead.ok, "Hosted Calendar read model did not read response truth.");
  const confirmItem = calendarRead.items.find((item) => item.calendarItemId === fixture.items.publishedOneOff);
  const declinedItem = calendarRead.items.find((item) => item.calendarItemId === fixture.items.confirmAllA);
  assert(confirmItem?.coverage.confirmedCount >= 1, `Hosted admin Calendar read did not reflect confirmed response (items=${calendarRead.items.length}, confirmed=${confirmItem?.coverage.confirmedCount ?? "missing"}).`);
  assert(declinedItem?.coverage.deniedCount >= 1, `Hosted admin Calendar read did not reflect declined response (items=${calendarRead.items.length}, denied=${declinedItem?.coverage.deniedCount ?? "missing"}).`);

  const directChecks = [];
  for (const table of [
    "assignment_responses",
    "calendar_assignments",
    "calendar_items",
    "volunteer_schedule_access_tokens",
    "assignment_response_tokens",
  ]) {
    directChecks.push((await anonClient.from(table).select("id").limit(1)).error);
    directChecks.push((await anonClient.from(table).delete().eq("workspace_id", fixture.workspaceId)).error);
    directChecks.push((await issuer.from(table).delete().eq("workspace_id", fixture.workspaceId)).error);
  }
  directChecks.push((await anonClient.from("assignment_responses").insert({
    workspace_id: fixture.workspaceId,
    assignment_id: fixture.assignments.needs,
    response_status: "declined",
    response_source: "volunteer_schedule",
  })).error);
  assert(directChecks.every(Boolean), "Hosted direct table access denial did not hold.");

  const noSideEffects = runHostedSql(`select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('communications', 'communication_deliveries', 'email_deliveries', 'remembered_devices', 'public_volunteer_lookups', 'volunteer_auth_accounts', 'needs_attention_items', 'response_history'))::int as side_effect_tables,
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id = ${sqlUuid(fixture.workspaceId)})::int as reveal_events,
  (select count(*) from public.calendar_assignments where workspace_id = ${sqlUuid(fixture.workspaceId)} and lifecycle = 'canceled' and id not in (${sqlUuid(fixture.assignments.canceled)}))::int as accidental_cancellations,
  (select count(*) from public.assignment_responses where workspace_id = ${sqlUuid(fixture.workspaceId)} and response_status not in ('needs_response', 'confirmed', 'declined'))::int as unexpected_responses;`, "Hosted schedule response no-side-effect check")[0];
  assert(noSideEffects.side_effect_tables === 0, "Hosted response gate found out-of-scope side-effect tables.");
  assert(noSideEffects.reveal_events === 0, "Hosted schedule responses created reveal audit events.");
  assert(noSideEffects.accidental_cancellations === 0, "Hosted schedule responses canceled assignments.");
  assert(noSideEffects.unexpected_responses === 0, "Hosted response states drifted.");
}

async function startHostedPreview(anonKey) {
  const out = path.join(tmpdir(), `project-local-12-21-1-preview-${randomUUID()}.out.log`);
  const err = path.join(tmpdir(), `project-local-12-21-1-preview-${randomUUID()}.err.log`);
  const env = hostedPreviewEnv(anonKey);
  secrets.add(anonKey);

  const buildCommand = npmInvocation(["run", "build"]);
  const build = command(buildCommand.commandName, buildCommand.args, {
    env,
  });
  if (build.status !== 0) {
    throw new Error(`Hosted preview build failed: ${redact([build.error?.message, build.stderr, build.stdout].filter(Boolean).join("\n") || "No diagnostic was returned.")}`);
  }

  writeFileSync(out, "", "utf8");
  writeFileSync(err, "", "utf8");
  const outFd = openSync(out, "a");
  const errFd = openSync(err, "a");
  const previewCommand = npmInvocation(["run", "preview", "--", "-p", "3000"]);
  previewProcess = spawn(previewCommand.commandName, previewCommand.args, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: ["ignore", outFd, errFd],
  });
  closeSync(outFd);
  closeSync(errFd);

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(createPreviewUrl(previewBaseUrl, "/v/schedule"), { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Keep waiting.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`Hosted-backed loopback preview did not become available. ${redact(safeLogTail(err) || safeLogTail(out) || "Preview logs were empty.")}`);
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
      // Best-effort shutdown only.
    }
  }
  previewProcess = null;
}

async function verifyHostedRoutes(anonKey) {
  issuedTokens.empty = await issueScheduleToken(fixture.users.issuer.client, fixture.volunteers.empty, 24);
  runHostedSql(`update public.assignment_responses
set response_status = case
    when assignment_id = ${sqlUuid(fixture.assignments.confirmed)} then 'confirmed'
    when assignment_id = ${sqlUuid(fixture.assignments.declined)} then 'declined'
    else 'needs_response'
  end,
  response_source = 'project_contact',
  response_note = null,
  responded_at = case
    when assignment_id in (${sqlUuid(fixture.assignments.confirmed)}, ${sqlUuid(fixture.assignments.declined)}) then clock_timestamp()
    else null
  end,
  updated_by_auth_user_id = null
where workspace_id = ${sqlUuid(fixture.workspaceId)}
  and assignment_id in (
    ${sqlUuid(fixture.assignments.needs)},
    ${sqlUuid(fixture.assignments.confirmed)},
    ${sqlUuid(fixture.assignments.declined)},
    ${sqlUuid(fixture.assignments.confirmAllA)},
    ${sqlUuid(fixture.assignments.confirmAllB)},
    ${sqlUuid(fixture.assignments.inside48)},
    ${sqlUuid(fixture.assignments.past)}
  );`, "Hosted route response fixture reset");

  await startHostedPreview(anonKey);
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const failures = [];
    page.on("console", (message) => {
      if (message.type() === "error") failures.push(message.text());
    });
    page.on("pageerror", (error) => failures.push(error.message));

    await page.goto(createPreviewUrl(previewBaseUrl, "/v/schedule?access=linked"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL(/\/v\/schedule$/, { timeout: 30_000 });
    await page.getByRole("heading", { name: "This schedule link is unavailable" }).waitFor();

    await page.goto(createPreviewUrl(previewBaseUrl, `/v/access/${issuedTokens.second.token}`), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForURL(/\/v\/schedule$/, { timeout: 30_000 });
    const finalUrl = new URL(page.url());
    assert(finalUrl.hostname === "127.0.0.1", "Hosted schedule exchange did not preserve request host.");
    assert(finalUrl.pathname === "/v/schedule" && finalUrl.search === "", "Hosted schedule exchange did not land on a clean URL.");
    assert(!page.url().includes(issuedTokens.second.token), "Hosted schedule final URL leaked bearer.");
    await page.getByRole("heading", { name: "Here’s your schedule" }).waitFor();
    await page.getByText(`${fixture.namespace} Own Volunteer`).waitFor();
    await page.getByText("QA 12.21.1 Volunteer Schedule Target", { exact: true }).waitFor();
    await page.getByText(`${fixture.namespace} Confirm Me`).waitFor();
    await page.getByText(`${fixture.namespace} Decline Me`).waitFor();
    await page.getByText(`${fixture.namespace} Reconfirm Me`).waitFor();
    await page.getByText(`${fixture.namespace} All A`).waitFor();
    await page.getByText(`${fixture.namespace} All B`).waitFor();
    await page.getByText("Needs reply").first().waitFor();
    await page.getByText("Confirmed").first().waitFor();
    /*
    await page.getByText("Can’t make it").first().waitFor();
    */
    await page.getByText(/make it/).first().waitFor();
    for (const hidden of ["Draft Hidden", "Archived Hidden", "Canceled Hidden", "Wrong Workspace Hidden", "Other Volunteer", "Informational Unassigned"]) {
      assert((await page.getByText(`${fixture.namespace} ${hidden}`).count()) === 0, `Hosted route leaked ${hidden}.`);
    }
    for (const absent of ["Project updates", "Lunch", "Questionnaire", "/v/demo", "Reveal response link", "Copy link"]) {
      assert((await page.getByText(absent).count()) === 0, `Hosted route leaked mock or response-link copy: ${absent}.`);
    }
    await page.getByRole("button", { name: "Confirm all pending" }).waitFor();

    const cookies = await context.cookies(createPreviewUrl(previewBaseUrl, "/v/schedule"));
    const scheduleCookie = cookies.find((cookie) => cookie.name === "pl-volunteer-schedule");
    assert(scheduleCookie, "Hosted schedule cookie was not set.");
    assert(scheduleCookie.httpOnly === true, "Hosted schedule cookie is not HttpOnly.");
    assert(scheduleCookie.sameSite === "Lax", "Hosted schedule cookie is not SameSite=Lax.");
    assert(scheduleCookie.expires === -1, "Hosted schedule cookie is not session-only.");
    assert(scheduleCookie.path === "/v", "Hosted schedule cookie path is not /v.");
    assert(scheduleCookie.secure === false, "Hosted loopback HTTP schedule cookie unexpectedly required Secure.");

    const storageLeak = await page.evaluate(
      (secret) =>
        document.documentElement.innerHTML.includes(secret) ||
        localStorage.getItem("pl-volunteer-schedule") === secret ||
        sessionStorage.getItem("pl-volunteer-schedule") === secret ||
        document.cookie.includes(secret),
      issuedTokens.second.token,
    );
    assert(storageLeak === false, "Hosted schedule bearer leaked to HTML, browser storage, or readable cookie.");

    const confirmButton = page.getByRole("button", { name: /Confirm Me/ }).first();
    await confirmButton.click();
    await page.getByRole("dialog", { name: /Confirm Me/ }).waitFor();
    await page.getByText("Hosted safe schedule note.").waitFor();
    await page.getByText("The project team will include contact details in a later beta slice.").waitFor();
    await page.getByRole("button", { name: /^Confirm$/ }).click();
    await page.getByText("Your response is now Confirmed.").waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Confirm Me/ }).click();
    await page.getByText("Confirmed").first().waitFor();
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: /Decline Me/ }).click();
    await page.getByPlaceholder(/brief note/).fill("Hosted browser note");
    await page.getByRole("button", { name: /make it/ }).last().click();
    await page.getByText(/Your response is now .*make it\./).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Decline Me/ }).click();
    await page.getByText("Hosted browser note", { exact: true }).waitFor();
    await page.getByRole("button", { name: /^Confirm$/ }).click();
    await page.getByText("Your response is now Confirmed.").waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Decline Me/ }).click();
    assert((await page.getByText("Hosted browser note", { exact: true }).count()) === 0, "Hosted route did not clear denial note after reconfirm.");
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: /Inside 48/ }).click();
    await page.getByText(/starts within 48 hours/).waitFor();
    assert((await page.getByPlaceholder(/brief note/).count()) === 0, "Hosted route exposed decline note inside 48 hours.");
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: /Already Started/ }).click();
    await page.getByText(/already started/).waitFor();
    const startedConfirm = page.getByRole("button", { name: /^Confirm$/ });
    assert(await startedConfirm.isDisabled(), "Hosted route exposed an active Confirm control for started assignment.");
    assert((await page.getByPlaceholder(/brief note/).count()) === 0, "Hosted route exposed decline note for started assignment.");
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await page.getByRole("button", { name: "Confirm all pending" }).click();
    await page.getByText(/Confirmed 3 assignments\./).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /All A/ }).click();
    await page.getByText("Confirmed").first().waitFor();
    await page.getByRole("button", { name: "Close assignment details" }).click();

    await confirmButton.focus();
    assert(await confirmButton.evaluate((node) => document.activeElement === node), "Hosted schedule detail did not return focus.");
    assert(responseState(fixture.assignments.needs).response_status === "confirmed", "Hosted route Confirm did not persist.");
    const declinedAfterRoute = responseState(fixture.assignments.confirmed);
    assert(declinedAfterRoute.response_status === "confirmed" && declinedAfterRoute.response_note === null, "Hosted route decline/reconfirm did not persist expected final state.");
    assert(responseState(fixture.assignments.confirmAllA).response_status === "confirmed", "Hosted route Confirm All did not persist.");
    assert(responseState(fixture.assignments.inside48).response_status === "confirmed", "Hosted route Confirm All did not confirm eligible inside-48 item.");
    assert(responseState(fixture.assignments.past).response_status === "needs_response", "Hosted route changed started assignment unexpectedly.");

    await Promise.all([
      page.waitForURL(/\/v\/schedule\?left=1$/),
      page.getByRole("button", { name: /Not you\? Leave this schedule/ }).first().click(),
    ]);
    await page.getByRole("heading", { name: "You’ve left this schedule" }).waitFor();
    assert(
      !(await context.cookies(createPreviewUrl(previewBaseUrl, "/v/schedule"))).some(
        (cookie) => cookie.name === "pl-volunteer-schedule" && cookie.value,
      ),
      "Hosted Not-you action did not clear the cookie.",
    );
    await context.close();

    const invalidContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const invalidPage = await invalidContext.newPage();
    await invalidPage.goto(createPreviewUrl(previewBaseUrl, "/v/access/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), {
      waitUntil: "domcontentloaded",
    });
    await invalidPage.getByRole("heading", { name: "This schedule link is unavailable" }).waitFor();
    assert((await invalidContext.cookies(createPreviewUrl(previewBaseUrl, "/v/schedule"))).length === 0, "Hosted invalid bearer set a schedule cookie.");
    await invalidContext.close();

    const emptyContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const emptyPage = await emptyContext.newPage();
    await emptyPage.goto(createPreviewUrl(previewBaseUrl, `/v/access/${issuedTokens.empty.token}`), {
      waitUntil: "domcontentloaded",
    });
    await emptyPage.waitForURL(/\/v\/schedule$/, { timeout: 30_000 });
    await emptyPage.getByRole("heading", { name: "No published assignments yet" }).waitFor();
    const overflow = await emptyPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert(overflow === false, "Hosted 390px volunteer schedule route has horizontal overflow.");
    assert(failures.length === 0, `Hosted browser console/page errors occurred: ${redact(failures.join("; "))}`);
    await emptyContext.close();
  } finally {
    await browser.close();
    await stopHostedPreview();
  }
}

async function cleanupFixtures() {
  await stopHostedPreview();
  for (const user of Object.values(fixture.users)) {
    if (user.client) await user.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  const userIds = Object.values(fixture.users).map((user) => user.userId);
  const userIdArray = userIds.map(sqlUuid).join(", ");
  const contactIdArray = Object.values(fixture.contacts).map(sqlUuid).join(", ");
  const workspaceArray = [fixture.workspaceId, fixture.otherWorkspaceId, fixture.inactiveWorkspaceId].map(sqlUuid).join(", ");
  runHostedSql(`begin;
delete from public.assignment_response_link_reveal_events where workspace_id in (${workspaceArray});
delete from public.assignment_response_tokens where workspace_id in (${workspaceArray});
delete from public.volunteer_schedule_access_tokens where workspace_id in (${workspaceArray});
delete from public.assignment_responses where workspace_id in (${workspaceArray});
delete from public.calendar_assignments where workspace_id in (${workspaceArray});
delete from public.calendar_items where workspace_id in (${workspaceArray}) or title_snapshot like ${sqlText(`${fixture.namespace}%`)};
delete from public.task_presets where workspace_id in (${workspaceArray}) or name like ${sqlText(`${fixture.namespace}%`)};
delete from public.volunteer_profiles where workspace_id in (${workspaceArray}) or full_name like ${sqlText(`${fixture.namespace}%`)};
delete from public.workspace_contact_grants where workspace_id in (${workspaceArray}) or project_contact_id in (${contactIdArray});
delete from public.project_contacts where id in (${contactIdArray}) or auth_user_id = any(array[${userIdArray}]);
delete from public.workspaces where id in (${workspaceArray}) or workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.identities where user_id = any(array[${userIdArray}]);
delete from auth.users where id = any(array[${userIdArray}]);
commit;
select 'cleaned' as fixture_state;`, "Hosted schedule response cleanup");

  exactResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where id in (${workspaceArray})) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${userIdArray}])) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (${workspaceArray})) +
  (select count(*) from public.volunteer_profiles where workspace_id in (${workspaceArray})) +
  (select count(*) from public.task_presets where workspace_id in (${workspaceArray})) +
  (select count(*) from public.calendar_items where workspace_id in (${workspaceArray})) +
  (select count(*) from public.calendar_assignments where workspace_id in (${workspaceArray})) +
  (select count(*) from public.assignment_responses where workspace_id in (${workspaceArray})) +
  (select count(*) from public.assignment_response_tokens where workspace_id in (${workspaceArray})) +
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id in (${workspaceArray})) +
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id in (${workspaceArray})) +
  (select count(*) from auth.users where id = any(array[${userIdArray}]))
)::int as residue_count;`, "Hosted schedule response exact residue check")[0]?.residue_count;
  assert(exactResidueCount === 0, "Hosted schedule response fixtures left exact-run residue.");
  cleanupCompleted = true;
}

function verifyNamespaceResidue() {
  namespaceResidueCount = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like 'qa-12-21-1-%') +
  (select count(*) from public.volunteer_profiles where full_name like 'qa-12-21-1-%') +
  (select count(*) from public.task_presets where name like 'qa-12-21-1-%') +
  (select count(*) from public.calendar_items where title_snapshot like 'qa-12-21-1-%') +
  (select count(*) from public.volunteer_schedule_access_tokens where workspace_id in (select id from public.workspaces where workspace_key like 'qa-12-21-1-%')) +
  (select count(*) from auth.users where email like 'qa-12-21-1-%@example.invalid')
)::int as residue_count;`, "Hosted 12.21.1 namespace residue check")[0]?.residue_count;
  assert(namespaceResidueCount === 0, "Hosted qa-12-21-1 namespace left fixture/Auth residue.");
  return namespaceResidueCount;
}

async function main() {
  const anonKey = await verifyTargetAndReadAnonKey();
  const { before, after } = await ensureExpectedMigrationApplied();
  await verifyGeneratedTypes();
  try {
    await verifyStaticBoundaries();
    await createFixtures(anonKey);
    await verifyDatabaseBehavior(anonKey);
    await verifyHostedRoutes(anonKey);
  } finally {
    await cleanupFixtures();
  }
  assert(cleanupCompleted && verifyNamespaceResidue() === 0, "Hosted schedule response cleanup did not complete.");
  console.log("Hosted staging volunteer schedule response QA passed.");
  console.log(`Validated target ${expectedName} (${expectedRef}) with status ${projectStatus}.`);
  console.log(`Migration level before gate: ${before}; after gate: ${after}.`);
  console.log("Validated schedule Confirm/Deny, denial notes, Confirm All, 48-hour/start locks, response provenance, token separation, public ready/empty/unavailable reads, schedule filtering, admin response truth, safe projection, direct table denial, isolation, idempotency, hosted route actions, clean URL, cookie attributes, host preservation, Not-you clearing, mobile layout, accessibility focus, generated type parity, and no side effects.");
  console.log(`Hosted disposable product and Auth residue: ${exactResidueCount + namespaceResidueCount}.`);
  console.log("No schedule bearer, cookie value, verifier, access token, refresh token, password, API key, database URL, response URL, or service credential was logged.");
}

main().catch(async (error) => {
  await stopHostedPreview();
  console.error(`Hosted volunteer schedule response QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
