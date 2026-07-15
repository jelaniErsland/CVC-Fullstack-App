import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const expectedMigration = "20260714121500";
const hostedUrl = `https://${expectedRef}.supabase.co`;
const secrets = new Set();

const fixture = {
  namespace: `qa-12-15-hosted-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  manualProfileId: null,
  duplicateProfileId: null,
  otherWorkspaceProfileId: null,
  questionnaireSubmissionId: randomUUID(),
  questionnaireProfileId: null,
  users: Object.fromEntries(
    ["full", "viewOnly", "noView", "roleOnly", "other", "revoked", "expired", "inactive"].map(
      (label) => [
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
      ],
    ),
  ),
};

let cleanupCompleted = false;

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
    ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"), "--yes", "supabase", ...args]
    : ["--yes", "supabase", ...args];
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`Hosted Supabase CLI command failed: ${redact(detail || "No diagnostic was returned.")}`);
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
  const file = path.join(tmpdir(), `project-local-hosted-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  let output;
  try {
    output = runSupabaseCli(["db", "query", "--linked", "--file", file, "--output", "json"]);
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // Best-effort cleanup only; the file contains disposable validation SQL, not credentials.
    }
  }
  const result = parseCliJson(output, stage);
  assert(Array.isArray(result.rows), `${stage} omitted rows.`);
  return result.rows;
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
  });
  assert(
    normalizeGeneratedTypes(hostedTypes) === normalizeGeneratedTypes(localTypes),
    "Hosted generated public-schema types differ from the committed generated types.",
  );
}

async function verifyPreflightAndReadAnonKey() {
  assert(
    process.env.RUN_HOSTED_VOLUNTEER_PROFILE_MANAGEMENT_VALIDATION === expectedConfirmation,
    `Refusing hosted validation without RUN_HOSTED_VOLUNTEER_PROFILE_MANAGEMENT_VALIDATION=${expectedConfirmation}.`,
  );
  const linkedRef = (await readFile(path.join(root, "supabase", ".temp", "project-ref"), "utf8")).trim();
  assert(linkedRef === expectedRef, "The linked project is not the approved staging ref.");
  const projectsResult = parseCliJson(
    runSupabaseCli(["projects", "list", "--output", "json"]),
    "Hosted project discovery",
  );
  const projects = Array.isArray(projectsResult) ? projectsResult : projectsResult.projects;
  const project = projects?.find((entry) => entry.ref === expectedRef);
  assert(project?.name === expectedName && project?.status === "ACTIVE_HEALTHY", "Approved staging is not active and linked.");

  const latestMigration = runHostedSql(
    "select version from supabase_migrations.schema_migrations order by version desc limit 1;",
    "Hosted migration-level check",
  )[0]?.version;
  assert(
    latestMigration === expectedMigration,
    `Hosted staging is not migrated through ${expectedMigration}. Apply the reviewed 12.15 migration to staging before running this gate.`,
  );

  await verifyGeneratedTypes();

  const apiKeys = parseCliJson(
    runSupabaseCli(["projects", "api-keys", "--project-ref", expectedRef, "--output", "json"], {
      sensitiveOutput: true,
    }),
    "Hosted API-key discovery",
  );
  for (const entry of apiKeys) if (typeof entry.api_key === "string") secrets.add(entry.api_key);
  const anonKey = apiKeys.find((entry) => entry.name === "anon")?.api_key;
  assert(typeof anonKey === "string" && anonKey.length > 100, "Hosted anon key is unavailable.");
  return { anonKey, latestMigration };
}

function authUserSql({ userId, identityId, email, password }) {
  return `insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid, ${sqlUuid(userId)},
  'authenticated', 'authenticated', ${sqlText(email)},
  extensions.crypt(${sqlText(password)}, extensions.gen_salt('bf')), clock_timestamp(),
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

function workspaceRowSql(id, key, name) {
  return `(${sqlUuid(id)}, ${sqlText(key)}, ${sqlText(name)}, 'active', 'America/Denver', '2026-08-01'::date, '2026-12-31'::date, false)`;
}

function grantRowSql(label, workspaceId, role, capabilities, status = "active", validity = "current") {
  const user = fixture.users[label];
  const revokedAt = status === "revoked" ? "clock_timestamp()" : "null";
  const validFrom =
    validity === "expired" ? "clock_timestamp() - interval '4 days'" : "clock_timestamp() - interval '1 day'";
  const validUntil = validity === "expired" ? "clock_timestamp() - interval '1 day'" : "null";
  return `(${sqlUuid(user.grantId)}, ${sqlUuid(workspaceId)}, ${sqlUuid(user.contactId)}, ${sqlText(role)}, ${sqlCapabilities(capabilities)}, ${sqlText(status)}, ${validFrom}, ${validUntil}, ${revokedAt})`;
}

async function createFixtures(anonKey) {
  for (const label of Object.keys(fixture.users)) userValues(label);

  runHostedSql(`begin;
${Object.values(fixture.users)
  .map((user) =>
    authUserSql({
      userId: user.userId,
      identityId: user.identityId,
      email: user.email,
      password: user.password,
    }),
  )
  .join("\n")}
commit;
select 'auth-created' as fixture_state;`, "Hosted volunteer Auth fixture creation");

  const fullCaps = ["workspace.read", "questionnaires.review", "volunteers.view", "volunteers.edit"];
  runHostedSql(`begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled
) values
  ${workspaceRowSql(fixture.workspaceId, `${fixture.namespace}-target`, "QA 12.15 Hosted Target Workspace")},
  ${workspaceRowSql(fixture.otherWorkspaceId, `${fixture.namespace}-other`, "QA 12.15 Hosted Other Workspace")};

insert into public.project_contacts (id, auth_user_id, status)
values
  ${Object.values(fixture.users)
    .map((user) => `(${sqlUuid(user.contactId)}, ${sqlUuid(user.userId)}, 'active')`)
    .join(",\n  ")};

insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status, valid_from, valid_until, revoked_at
) values
  ${grantRowSql("full", fixture.workspaceId, "main_contact", fullCaps)},
  ${grantRowSql("viewOnly", fixture.workspaceId, "assistant_contact", ["workspace.read", "volunteers.view"])},
  ${grantRowSql("noView", fixture.workspaceId, "assistant_contact", ["workspace.read"])},
  ${grantRowSql("roleOnly", fixture.workspaceId, "main_contact", ["workspace.read"])},
  ${grantRowSql("other", fixture.otherWorkspaceId, "main_contact", fullCaps)},
  ${grantRowSql("revoked", fixture.workspaceId, "assistant_contact", fullCaps, "revoked")},
  ${grantRowSql("expired", fixture.workspaceId, "assistant_contact", fullCaps, "active", "expired")},
  ${grantRowSql("inactive", fixture.workspaceId, "assistant_contact", fullCaps, "inactive")};
commit;
select 'product-created' as fixture_state;`, "Hosted volunteer product fixture creation");

  for (const user of Object.values(fixture.users)) {
    const client = createClient(hostedUrl, anonKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    const signin = await client.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
    assert(!signin.error && signin.data.session, `Hosted ${user.label} sign-in failed.`);
    secrets.add(signin.data.session.access_token);
    secrets.add(signin.data.session.refresh_token);
    user.client = client;
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  }))).flat();
}

async function verifyStaticBoundaries() {
  const [migration, server, routeRead, route] = await Promise.all([
    readFile(path.join(root, "supabase", "migrations", "20260714121500_manual_volunteer_profiles.sql"), "utf8"),
    readFile(path.join(root, "lib", "volunteers", "server.ts"), "utf8"),
    readFile(path.join(root, "lib", "volunteers", "routeRead.server.ts"), "utf8"),
    readFile(path.join(root, "app", "admin", "volunteers", "page.tsx"), "utf8"),
  ]);
  assert(migration.includes("create_manual_volunteer_profile"), "Manual create RPC migration is missing.");
  assert(migration.includes("update_volunteer_profile_manual_fields"), "Manual update RPC migration is missing.");
  assert(!/grant (?:insert|update|delete|all).*volunteer_profiles.*to authenticated/i.test(migration), "Manual migration broadened direct volunteer table writes.");
  assert(
    !/process\.env\.SUPABASE_SERVICE_ROLE_KEY|createServiceRole|auth\.admin/i.test(
      `${migration}\n${server}\n${routeRead}\n${route}`,
    ),
    "Volunteer path references a service-role shortcut.",
  );
  assert(/readVolunteerManagementRouteState/.test(route), "Volunteer route is not using the reviewed route read state.");
  assert(!/mockData|projectVolunteers|getVolunteerById/i.test(route), "Volunteer route still references mock volunteer truth.");

  const unsafeImports = [];
  for (const directory of ["app", "components"]) {
    for (const file of (await collectFiles(path.join(root, directory))).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
      const relative = path.relative(root, file).replaceAll("\\", "/");
      const source = await readFile(file, "utf8");
      if (
        source.includes("hosted-volunteer-profile-management-regression") ||
        (source.includes("SUPABASE_SERVICE_ROLE_KEY") && /volunteer/i.test(source))
      ) {
        unsafeImports.push(relative);
      }
    }
  }
  assert(unsafeImports.length === 0, "A route/component imports hosted validation or service-role volunteer behavior.");
}

function questionnaireAnswers(label) {
  return {
    aboutYou: {
      name: `${fixture.namespace} ${label} Questionnaire Volunteer`,
      email: `${fixture.namespace}-${label}@example.invalid`,
      phone: "406-555-1212",
      congregation: "Bozeman",
      preferredContactMethod: "Email",
    },
    availability: { weekdays: ["Monday"], preferredTimes: ["Morning"] },
    skillsExperience: { categories: ["General"], maintenanceTaskCards: false },
    emergencyContact: { name: "Emergency Contact", phone: "406-555-4545" },
    otherWaysToHelp: {},
  };
}

async function rpcCreate(client, workspaceId, overrides = {}) {
  const result = await client.rpc("create_manual_volunteer_profile", {
    p_workspace_id: workspaceId,
    p_full_name: `${fixture.namespace} Manual Volunteer`,
    p_email: `${fixture.namespace}-manual@example.invalid`,
    p_phone: "406-555-0101",
    p_congregation: "Bozeman",
    p_preferred_contact_method: "Text",
    p_readiness_status: "ready",
    p_profile_notes: "Hosted manual beta scheduling profile.",
    ...overrides,
  });
  if (result.error || typeof result.data !== "string") {
    throw new Error("Hosted manual volunteer create failed.", { cause: result.error });
  }
  return result.data;
}

async function rpcUpdate(client, profileId, overrides = {}) {
  const result = await client.rpc("update_volunteer_profile_manual_fields", {
    p_profile_id: profileId,
    p_full_name: `${fixture.namespace} Edited Volunteer`,
    p_email: `${fixture.namespace}-edited@example.invalid`,
    p_phone: "406-555-0202",
    p_congregation: "Bozeman",
    p_preferred_contact_method: "Email",
    p_lifecycle: "inactive",
    p_readiness_status: "on_hold",
    p_profile_notes: "Hosted edit persisted.",
    ...overrides,
  });
  if (result.error || typeof result.data !== "string") {
    throw new Error("Hosted manual volunteer update failed.", { cause: result.error });
  }
  return result.data;
}

async function expectRpcFailure(promise, label) {
  const result = await promise;
  assert(result.error, `${label} must fail closed.`);
}

async function readProfiles(client, workspaceId) {
  const result = await client
    .from("volunteer_profiles")
    .select("id,workspace_id,source_submission_id,profile_source,manual_created_by_project_contact_id,manual_created_at,lifecycle,readiness_status,full_name,email,phone,congregation,preferred_contact_method,profile_notes,created_at,updated_at")
    .eq("workspace_id", workspaceId)
    .order("full_name");
  assert(!result.error, "Hosted volunteer profile read unexpectedly errored.");
  return result.data ?? [];
}

function verifyHostedSchema() {
  const columns = runHostedSql(`select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'volunteer_profiles'
  and column_name in (
    'source_submission_id',
    'profile_source',
    'manual_created_by_project_contact_id',
    'manual_created_at'
  )
order by column_name;`, "Hosted volunteer provenance column check");
  const byName = new Map(columns.map((row) => [row.column_name, row]));
  assert(byName.get("source_submission_id")?.is_nullable === "YES", "Hosted source_submission_id is not nullable for manual profiles.");
  assert(byName.get("profile_source")?.is_nullable === "NO", "Hosted profile_source is nullable.");
  assert(
    String(byName.get("profile_source")?.column_default ?? "").includes("'questionnaire'"),
    "Hosted profile_source default is not questionnaire.",
  );
  assert(byName.has("manual_created_by_project_contact_id"), "Hosted manual creator column is missing.");
  assert(byName.has("manual_created_at"), "Hosted manual timestamp column is missing.");

  const functions = runHostedSql(`select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'create_manual_volunteer_profile',
    'update_volunteer_profile_manual_fields',
    'convert_questionnaire_submission_to_volunteer_profile'
  )
order by proname;`, "Hosted volunteer RPC check").map((row) => row.proname);
  assert(JSON.stringify(functions) === JSON.stringify([
    "convert_questionnaire_submission_to_volunteer_profile",
    "create_manual_volunteer_profile",
    "update_volunteer_profile_manual_fields",
  ]), "Hosted volunteer RPC set is incomplete.");

  const privileges = runHostedSql(`select
  has_table_privilege('authenticated', 'public.volunteer_profiles', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'public.volunteer_profiles', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.volunteer_profiles', 'UPDATE') as can_update,
  has_table_privilege('authenticated', 'public.volunteer_profiles', 'DELETE') as can_delete;`, "Hosted volunteer table privilege check")[0];
  assert(privileges.can_select === true, "Authenticated role cannot select volunteer profiles.");
  assert(privileges.can_insert === false && privileges.can_update === false && privileges.can_delete === false, "Authenticated role has direct volunteer write privileges.");
}

function verifyProvenanceConstraints() {
  runHostedSql(`do $$
begin
  begin
    insert into public.volunteer_profiles (
      workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
      manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
      preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
    ) values (
      ${sqlUuid(fixture.workspaceId)}, null, 'questionnaire', null, null,
      'active', 'ready', ${sqlText(`${fixture.namespace} Invalid Questionnaire`)},
      ${sqlText(`${fixture.namespace}-invalid-q@example.invalid`)}, null, 'Bozeman',
      'Email', '{}'::jsonb, '{}'::jsonb, ''
    );
    raise exception 'invalid_questionnaire_provenance_accepted';
  exception when check_violation or not_null_violation or foreign_key_violation then
    null;
  end;

  begin
    insert into public.volunteer_profiles (
      workspace_id, source_submission_id, profile_source, manual_created_by_project_contact_id,
      manual_created_at, lifecycle, readiness_status, full_name, email, phone, congregation,
      preferred_contact_method, availability_snapshot, skills_help_snapshot, profile_notes
    ) values (
      ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.questionnaireSubmissionId)}, 'manual',
      ${sqlUuid(fixture.users.full.contactId)}, clock_timestamp(),
      'active', 'ready', ${sqlText(`${fixture.namespace} Invalid Manual`)},
      ${sqlText(`${fixture.namespace}-invalid-m@example.invalid`)}, null, 'Bozeman',
      'Email', '{}'::jsonb, '{}'::jsonb, ''
    );
    raise exception 'invalid_manual_provenance_accepted';
  exception when check_violation or foreign_key_violation then
    null;
  end;
end
$$;
select 'provenance-constraints-checked' as state;`, "Hosted volunteer provenance constraint check");
}

async function verifyDirectTableWriteDenial() {
  const client = fixture.users.full.client;
  const insert = await client.from("volunteer_profiles").insert({
    workspace_id: fixture.workspaceId,
    source_submission_id: null,
    profile_source: "manual",
    manual_created_by_project_contact_id: fixture.users.full.contactId,
    manual_created_at: new Date().toISOString(),
    lifecycle: "active",
    readiness_status: "ready",
    full_name: `${fixture.namespace} Direct Insert`,
    email: `${fixture.namespace}-direct-insert@example.invalid`,
    availability_snapshot: {},
    skills_help_snapshot: {},
    profile_notes: "",
  });
  assert(insert.error, "Hosted direct volunteer insert was allowed.");

  const update = await client
    .from("volunteer_profiles")
    .update({ full_name: `${fixture.namespace} Direct Update` })
    .eq("id", fixture.manualProfileId);
  assert(update.error, "Hosted direct volunteer update was allowed.");

  const deletion = await client.from("volunteer_profiles").delete().eq("id", fixture.manualProfileId);
  assert(deletion.error, "Hosted direct volunteer delete was allowed.");
}

async function verifyHostedBehavior() {
  verifyHostedSchema();

  const full = fixture.users.full.client;
  const viewOnly = fixture.users.viewOnly.client;
  const noView = fixture.users.noView.client;
  const roleOnly = fixture.users.roleOnly.client;
  const other = fixture.users.other.client;

  const beforeSubmissionCount = runHostedSql(
    `select count(*) from public.questionnaire_submissions where workspace_id = ${sqlUuid(fixture.workspaceId)};`,
    "Hosted pre-manual questionnaire count",
  )[0]?.count;
  fixture.manualProfileId = await rpcCreate(full, fixture.workspaceId);
  const afterSubmissionCount = runHostedSql(
    `select count(*) from public.questionnaire_submissions where workspace_id = ${sqlUuid(fixture.workspaceId)};`,
    "Hosted post-manual questionnaire count",
  )[0]?.count;
  assert(afterSubmissionCount === beforeSubmissionCount, "Hosted manual create manufactured a questionnaire submission.");

  let manualRow = runHostedSql(`select
  workspace_id,
  source_submission_id,
  profile_source,
  manual_created_by_project_contact_id,
  manual_created_at is not null as has_manual_created_at,
  full_name,
  email,
  phone,
  congregation,
  preferred_contact_method,
  lifecycle,
  readiness_status,
  profile_notes
from public.volunteer_profiles
where id = ${sqlUuid(fixture.manualProfileId)};`, "Hosted manual profile provenance check")[0];
  assert(manualRow.workspace_id === fixture.workspaceId, "Hosted manual profile used the wrong workspace.");
  assert(manualRow.profile_source === "manual", "Hosted manual profile_source is wrong.");
  assert(manualRow.source_submission_id === null, "Hosted manual profile has questionnaire provenance.");
  assert(manualRow.manual_created_by_project_contact_id === fixture.users.full.contactId, "Hosted manual creator provenance was not derived from the caller.");
  assert(manualRow.has_manual_created_at === true, "Hosted manual created timestamp was not derived.");
  assert(manualRow.full_name === `${fixture.namespace} Manual Volunteer`, "Hosted manual full name normalization failed.");

  fixture.duplicateProfileId = await rpcCreate(full, fixture.workspaceId, {
    p_full_name: `${fixture.namespace} Duplicate Contact Volunteer`,
    p_phone: "406-555-0101",
  });
  assert(fixture.duplicateProfileId !== fixture.manualProfileId, "Hosted duplicate contact-value profile did not create a distinct identity.");

  const readBack = await readProfiles(full, fixture.workspaceId);
  assert(readBack.some((row) => row.id === fixture.manualProfileId), "Hosted authorized contact could not read the manual profile.");

  const viewOnlyRows = await readProfiles(viewOnly, fixture.workspaceId);
  assert(viewOnlyRows.some((row) => row.id === fixture.manualProfileId), "Hosted view-only contact could not read permitted volunteer rows.");
  await expectRpcFailure(
    viewOnly.rpc("create_manual_volunteer_profile", {
      p_workspace_id: fixture.workspaceId,
      p_full_name: "View Only Cannot Create",
      p_email: `${fixture.namespace}-view-only-create@example.invalid`,
    }),
    "Hosted view-only create",
  );
  await expectRpcFailure(
    viewOnly.rpc("update_volunteer_profile_manual_fields", {
      p_profile_id: fixture.manualProfileId,
      p_full_name: "View Only Cannot Edit",
      p_email: `${fixture.namespace}-view-only-edit@example.invalid`,
    }),
    "Hosted view-only edit",
  );

  assert((await readProfiles(noView, fixture.workspaceId)).length === 0, "Hosted missing-view contact read volunteer rows.");
  assert((await readProfiles(roleOnly, fixture.workspaceId)).length === 0, "Hosted role/title-only contact read volunteer rows.");
  await expectRpcFailure(
    roleOnly.rpc("create_manual_volunteer_profile", {
      p_workspace_id: fixture.workspaceId,
      p_full_name: "Role Cannot Create",
      p_email: `${fixture.namespace}-role-create@example.invalid`,
    }),
    "Hosted role/title-only create",
  );

  for (const label of ["revoked", "expired", "inactive"]) {
    const client = fixture.users[label].client;
    assert((await readProfiles(client, fixture.workspaceId)).length === 0, `Hosted ${label} grant read volunteer rows.`);
    await expectRpcFailure(
      client.rpc("create_manual_volunteer_profile", {
        p_workspace_id: fixture.workspaceId,
        p_full_name: `${label} Cannot Create`,
        p_email: `${fixture.namespace}-${label}-create@example.invalid`,
      }),
      `Hosted ${label} grant create`,
    );
  }

  assert((await readProfiles(other, fixture.workspaceId)).length === 0, "Hosted other-workspace contact read target workspace rows.");
  await expectRpcFailure(
    other.rpc("update_volunteer_profile_manual_fields", {
      p_profile_id: fixture.manualProfileId,
      p_full_name: "Other Workspace Cannot Edit",
      p_email: `${fixture.namespace}-other-edit@example.invalid`,
    }),
    "Hosted other-workspace edit",
  );
  await expectRpcFailure(
    full.rpc("create_manual_volunteer_profile", {
      p_workspace_id: fixture.otherWorkspaceId,
      p_full_name: "Target Contact Cannot Create Elsewhere",
      p_email: `${fixture.namespace}-wrong-workspace-create@example.invalid`,
    }),
    "Hosted wrong-workspace create",
  );
  fixture.otherWorkspaceProfileId = await rpcCreate(other, fixture.otherWorkspaceId, {
    p_full_name: `${fixture.namespace} Other Workspace Volunteer`,
    p_email: `${fixture.namespace}-other-workspace@example.invalid`,
  });
  assert(!(await readProfiles(full, fixture.workspaceId)).some((row) => row.id === fixture.otherWorkspaceProfileId), "Hosted wrong-workspace profile bled into target reads.");

  await rpcUpdate(full, fixture.manualProfileId);
  manualRow = runHostedSql(`select
  workspace_id,
  source_submission_id,
  profile_source,
  manual_created_by_project_contact_id,
  manual_created_at is not null as has_manual_created_at,
  full_name,
  email,
  phone,
  lifecycle,
  readiness_status,
  profile_notes
from public.volunteer_profiles
where id = ${sqlUuid(fixture.manualProfileId)};`, "Hosted manual profile edit check")[0];
  assert(manualRow.profile_source === "manual" && manualRow.source_submission_id === null, "Hosted manual edit changed provenance.");
  assert(manualRow.manual_created_by_project_contact_id === fixture.users.full.contactId, "Hosted manual edit changed creator provenance.");
  assert(manualRow.full_name === `${fixture.namespace} Edited Volunteer`, "Hosted manual edit did not persist.");
  assert(manualRow.lifecycle === "inactive" && manualRow.readiness_status === "on_hold", "Hosted manual edit did not update allowed state.");

  await expectRpcFailure(
    full.rpc("create_manual_volunteer_profile", {
      p_workspace_id: fixture.workspaceId,
      p_full_name: "Bad Email",
      p_email: "not-an-email",
    }),
    "Hosted malformed create",
  );
  await expectRpcFailure(
    full.rpc("update_volunteer_profile_manual_fields", {
      p_profile_id: fixture.manualProfileId,
      p_full_name: "Bad Readiness",
      p_email: `${fixture.namespace}-bad-readiness@example.invalid`,
      p_readiness_status: "forged",
    }),
    "Hosted malformed update",
  );
  await expectRpcFailure(
    full.rpc("create_manual_volunteer_profile", {
      p_workspace_id: fixture.workspaceId,
      p_full_name: "Extra Protected Field",
      p_email: `${fixture.namespace}-extra@example.invalid`,
      source_submission_id: randomUUID(),
    }),
    "Hosted protected create argument",
  );

  runHostedSql(`insert into public.questionnaire_submissions (
  id, workspace_id, status, source, questionnaire_version, answers
) values (
  ${sqlUuid(fixture.questionnaireSubmissionId)},
  ${sqlUuid(fixture.workspaceId)},
  'submitted',
  'admin_entry',
  1,
  ${sqlText(JSON.stringify(questionnaireAnswers("converted")))}::jsonb
);
select 'questionnaire-created' as state;`, "Hosted questionnaire fixture creation");

  verifyProvenanceConstraints();

  const converted = await full.rpc("convert_questionnaire_submission_to_volunteer_profile", {
    p_submission_id: fixture.questionnaireSubmissionId,
  });
  assert(!converted.error && typeof converted.data === "string", "Hosted questionnaire conversion failed.");
  fixture.questionnaireProfileId = converted.data;
  let questionnaireRow = runHostedSql(`select profile_source, source_submission_id, manual_created_by_project_contact_id, manual_created_at
from public.volunteer_profiles
where id = ${sqlUuid(fixture.questionnaireProfileId)};`, "Hosted questionnaire provenance check")[0];
  assert(questionnaireRow.profile_source === "questionnaire", "Hosted converted profile did not keep questionnaire provenance.");
  assert(questionnaireRow.source_submission_id === fixture.questionnaireSubmissionId, "Hosted converted profile source submission is wrong.");
  assert(questionnaireRow.manual_created_by_project_contact_id === null && questionnaireRow.manual_created_at === null, "Hosted converted profile gained manual provenance.");

  await rpcUpdate(full, fixture.questionnaireProfileId, {
    p_full_name: `${fixture.namespace} Converted Edited`,
    p_email: `${fixture.namespace}-converted-edited@example.invalid`,
    p_lifecycle: "active",
    p_readiness_status: "ready",
  });
  questionnaireRow = runHostedSql(`select profile_source, source_submission_id, manual_created_by_project_contact_id, manual_created_at, full_name
from public.volunteer_profiles
where id = ${sqlUuid(fixture.questionnaireProfileId)};`, "Hosted questionnaire edit provenance check")[0];
  assert(questionnaireRow.profile_source === "questionnaire", "Hosted edit changed questionnaire profile_source.");
  assert(questionnaireRow.source_submission_id === fixture.questionnaireSubmissionId, "Hosted edit erased questionnaire source_submission_id.");
  assert(questionnaireRow.manual_created_by_project_contact_id === null && questionnaireRow.manual_created_at === null, "Hosted edit forged manual provenance.");
  assert(questionnaireRow.full_name === `${fixture.namespace} Converted Edited`, "Hosted questionnaire profile edit did not persist safe fields.");

  await verifyDirectTableWriteDenial();
}

async function cleanupFixtures() {
  for (const user of Object.values(fixture.users)) {
    if (user.client) await user.client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  const userIds = Object.values(fixture.users).map((user) => user.userId);
  const userIdArray = userIds.map(sqlUuid).join(", ");
  runHostedSql(`begin;
delete from public.volunteer_profiles
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or full_name like ${sqlText(`${fixture.namespace}%`)};
delete from public.questionnaire_submissions
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or answers::text like ${sqlText(`%${fixture.namespace}%`)};
delete from public.workspace_contact_grants
where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or project_contact_id in (${Object.values(fixture.users).map((user) => sqlUuid(user.contactId)).join(", ")});
delete from public.project_contacts
where id in (${Object.values(fixture.users).map((user) => sqlUuid(user.contactId)).join(", ")})
   or auth_user_id = any(array[${userIdArray}]);
delete from public.workspaces
where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})
   or workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.identities where user_id = any(array[${userIdArray}]);
delete from auth.users where id = any(array[${userIdArray}]);
commit;
select 'cleaned' as fixture_state;`, "Hosted volunteer cleanup");

  const exactResidue = runHostedSql(`select (
  (select count(*) from public.workspaces where id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${userIdArray}])) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.questionnaire_submissions where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from public.volunteer_profiles where workspace_id in (${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.otherWorkspaceId)})) +
  (select count(*) from auth.users where id = any(array[${userIdArray}]))
) as residue_count;`, "Hosted volunteer exact residue check")[0]?.residue_count;
  assert(exactResidue === 0, "Hosted volunteer fixtures left exact-run residue.");
  cleanupCompleted = true;
}

function verifyNamespaceResidue() {
  const residue = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like 'qa-12-15-hosted-%') +
  (select count(*) from public.volunteer_profiles where full_name like 'qa-12-15-hosted-%') +
  (select count(*) from public.questionnaire_submissions where answers::text like '%qa-12-15-hosted-%') +
  (select count(*) from auth.users where email like 'qa-12-15-hosted-%@example.invalid')
) as residue_count;`, "Hosted 12.15 namespace residue check")[0]?.residue_count;
  assert(residue === 0, "Hosted qa-12-15 namespace left fixture/Auth residue.");
  return residue;
}

async function main() {
  const { anonKey, latestMigration } = await verifyPreflightAndReadAnonKey();
  try {
    await verifyStaticBoundaries();
    await createFixtures(anonKey);
    await verifyHostedBehavior();
  } finally {
    await cleanupFixtures();
  }
  assert(cleanupCompleted && verifyNamespaceResidue() === 0, "Hosted volunteer cleanup did not complete.");
  console.log("Hosted staging volunteer profile management QA passed.");
  console.log(`Validated migration ${latestMigration}, manual create/edit RPCs, questionnaire provenance compatibility, RLS/capability isolation, direct table-write denial, generated types, and safe errors.`);
  console.log("Hosted disposable product and Auth residue: 0.");
  console.log("No access token, refresh token, password, API key, database URL, bearer, verifier, or service credential was logged.");
}

main().catch((error) => {
  console.error(`Hosted volunteer profile management QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
