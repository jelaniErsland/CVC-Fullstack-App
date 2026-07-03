import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const hostedUrl = `https://${expectedRef}.supabase.co`;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;
const secrets = new Set();

const fixture = {
  namespace: `qa-11-19-${randomUUID()}`,
  authUserId: randomUUID(),
  identityId: randomUUID(),
  workspaceId: randomUUID(),
  contactId: randomUUID(),
  grantId: randomUUID(),
  questionnaireId: randomUUID(),
  volunteerId: randomUUID(),
  taskPresetId: randomUUID(),
  calendarItemId: randomUUID(),
  assignmentId: randomUUID(),
  responseId: randomUUID(),
};

let authenticatedClient = null;
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
  return message;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
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
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(
      `Hosted Supabase CLI command failed (${args.slice(0, 2).join(" ")}): ${redact(detail || "No diagnostic was returned.")}`,
    );
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
  const singleLineSql = sql.replace(/\r?\n/g, " ");
  let output;
  try {
    output = runSupabaseCli([
      "db",
      "query",
      "--linked",
      singleLineSql,
      "--output",
      "json",
    ]);
  } catch (error) {
    throw new Error(`${stage} failed at SQL length ${sql.length}: ${redact(error)}`);
  }
  const result = parseCliJson(output, stage);
  assert(Array.isArray(result.rows), "Hosted database query omitted rows.");
  return result.rows;
}

async function verifyPreflightAndReadAnonKey() {
  assert(
    process.env.RUN_HOSTED_RESPONSE_REPLACEMENT_VALIDATION === expectedConfirmation,
    `Refusing hosted validation without RUN_HOSTED_RESPONSE_REPLACEMENT_VALIDATION=${expectedConfirmation}.`,
  );

  const linkedRef = (
    await readFile(path.join(root, "supabase", ".temp", "project-ref"), "utf8")
  ).trim();
  assert(linkedRef === expectedRef, "The linked Supabase project is not the approved staging ref.");

  const projectsResult = parseCliJson(
    runSupabaseCli(["projects", "list", "--output", "json"]),
    "Hosted project discovery",
  );
  const projects = Array.isArray(projectsResult) ? projectsResult : projectsResult.projects;
  const project = projects?.find((entry) => entry.ref === expectedRef);
  assert(
    project?.name === expectedName && project?.status === "ACTIVE_HEALTHY",
    "The approved hosted staging project is not active and linked.",
  );

  const latestMigration = runHostedSql(
    "select version from supabase_migrations.schema_migrations order by version desc limit 1;",
  )[0]?.version;
  assert(
    latestMigration === "20260702000000",
    "Hosted staging is not migrated through 20260702000000.",
  );

  const apiKeys = parseCliJson(
    runSupabaseCli(
      ["projects", "api-keys", "--project-ref", expectedRef, "--output", "json"],
      { sensitiveOutput: true },
    ),
    "Hosted API-key discovery",
  );
  for (const entry of apiKeys) {
    if (typeof entry.api_key === "string") secrets.add(entry.api_key);
  }
  const anonKey = apiKeys.find((entry) => entry.name === "anon")?.api_key;
  assert(typeof anonKey === "string" && anonKey.length > 100, "Hosted anon key is unavailable.");
  return anonKey;
}

async function createFixtures(password) {
  const authEmail = `${fixture.namespace}@example.invalid`;
  const workspaceKey = fixture.namespace;
  const workspaceName = "QA 11.19 Hosted Replacement Workspace";
  const taskTitle = "QA 11.19 Hosted Replacement Assignment";
  const questionnaireAnswers = JSON.stringify({
    aboutYou: {
      name: "QA 11.19 Disposable Volunteer",
      email: `${fixture.namespace}-volunteer@example.invalid`,
      phone: "+1 555 011 1919",
      congregation: "QA 11.19 Hosted Test",
    },
    availability: { weekdays: ["Tuesday"], preferredTimes: ["Morning"] },
    skillsExperience: { categories: ["General"], maintenanceTaskCards: false },
    emergencyContact: { name: "QA Disposable Contact", phone: "+1 555 011 1999" },
    otherWaysToHelp: {},
  });
  secrets.add(authEmail);

  runHostedSql(`begin;
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '${fixture.authUserId}'::uuid,
  'authenticated',
  'authenticated',
  ${sqlText(authEmail)},
  extensions.crypt(${sqlText(password)}, extensions.gen_salt('bf')),
  clock_timestamp(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  clock_timestamp(),
  clock_timestamp()
);
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at, id
) values (
  '${fixture.authUserId}',
  '${fixture.authUserId}'::uuid,
  jsonb_build_object('sub', '${fixture.authUserId}', 'email', ${sqlText(authEmail)}),
  'email',
  clock_timestamp(),
  clock_timestamp(),
  clock_timestamp(),
  '${fixture.identityId}'::uuid
);
commit;
select 'auth-created' as fixture_state;`, "Hosted Auth fixture creation");

  runHostedSql(`begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, public_intake_enabled
) values (
  '${fixture.workspaceId}'::uuid, ${sqlText(workspaceKey)}, ${sqlText(workspaceName)},
  'active', 'America/Denver', false
);
insert into public.project_contacts (id, auth_user_id, status)
values ('${fixture.contactId}'::uuid, '${fixture.authUserId}'::uuid, 'active');
insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status
) values (
  '${fixture.grantId}'::uuid, '${fixture.workspaceId}'::uuid,
  '${fixture.contactId}'::uuid, 'main_contact',
  array['workspace.read', 'assignments.edit']::text[], 'active'
);
insert into public.questionnaire_submissions (
  id, workspace_id, status, source, questionnaire_version, answers
) values (
  '${fixture.questionnaireId}'::uuid, '${fixture.workspaceId}'::uuid,
  'submitted', 'admin_entry', 1, ${sqlText(questionnaireAnswers)}::jsonb
);
commit;
select 'scope-created' as fixture_state;`, "Hosted scope fixture creation");

  runHostedSql(`begin;
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, lifecycle, readiness_status,
  full_name, email, phone, congregation, availability_snapshot,
  skills_help_snapshot, profile_notes
) values (
  '${fixture.volunteerId}'::uuid, '${fixture.workspaceId}'::uuid,
  '${fixture.questionnaireId}'::uuid, 'active', 'ready',
  'QA 11.19 Disposable Volunteer', '${fixture.namespace}-volunteer@example.invalid',
  '+1 555 011 1919', 'QA 11.19 Hosted Test',
  '{"weekdays":["Tuesday"],"preferredTimes":["Morning"]}'::jsonb,
  '{"skillsExperience":{"categories":["General"]},"otherWaysToHelp":{}}'::jsonb,
  ''
);
insert into public.task_presets (
  id, workspace_id, name, task_type, default_needed_count,
  volunteer_visible, is_system_preset, custom_field_definitions, lifecycle
) values (
  '${fixture.taskPresetId}'::uuid, '${fixture.workspaceId}'::uuid,
  ${sqlText(taskTitle)}, 'general', 1, true, false, '[]'::jsonb, 'active'
);
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
  schedule_kind, start_date, start_time, end_time, timezone,
  needed_count, custom_values, lifecycle
) values (
  '${fixture.calendarItemId}'::uuid, '${fixture.workspaceId}'::uuid,
  '${fixture.taskPresetId}'::uuid, ${sqlText(taskTitle)}, 'general',
  'timed', '2030-09-19', '09:00:00', '11:00:00', 'America/Denver',
  1, '{}'::jsonb, 'active'
);
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id,
  lifecycle, created_by_auth_user_id
) values (
  '${fixture.assignmentId}'::uuid, '${fixture.workspaceId}'::uuid,
  '${fixture.calendarItemId}'::uuid, '${fixture.volunteerId}'::uuid,
  'active', '${fixture.authUserId}'::uuid
);
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source
) values (
  '${fixture.responseId}'::uuid, '${fixture.workspaceId}'::uuid,
  '${fixture.assignmentId}'::uuid, 'needs_response', 'project_contact'
);
commit;
select 'created' as fixture_state;`, "Hosted product fixture creation");

  return { authEmail, workspaceName, taskTitle };
}

async function verifyReplacement(anonKey, password, fixtureLabels) {
  authenticatedClient = createClient(hostedUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const signIn = await authenticatedClient.auth.signInWithPassword({
    email: fixtureLabels.authEmail,
    password,
  });
  assert(!signIn.error && signIn.data.session, "Hosted disposable contact sign-in failed.");
  secrets.add(signIn.data.session.access_token);
  secrets.add(signIn.data.session.refresh_token);

  const publicClient = createClient(hostedUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const initialIssue = await authenticatedClient.rpc("issue_assignment_response_token", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 24,
    p_internal_note: null,
  });
  assert(!initialIssue.error && initialIssue.data?.length === 1, "Hosted setup token issuance failed.");
  const oldTokenId = initialIssue.data[0]?.token_id;
  const oldBearer = initialIssue.data[0]?.bearer_token;
  assert(uuidPattern.test(oldTokenId) && bearerPattern.test(oldBearer), "Hosted setup token was invalid.");
  secrets.add(oldBearer);

  runHostedSql(`update public.workspace_contact_grants
set capabilities = array['workspace.read']::text[]
where id = '${fixture.grantId}'::uuid;
select 'restricted' as grant_state;`);
  const denied = await authenticatedClient.rpc("replace_assignment_response_token", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 72,
  });
  assert(denied.error?.code === "42501" && denied.data === null, "Hosted replacement bypassed assignments.edit.");
  const oldAfterDenied = await publicClient.rpc("read_assignment_response_by_token", {
    p_bearer_token: oldBearer,
  });
  assert(!oldAfterDenied.error && oldAfterDenied.data?.length === 1, "Denied hosted replacement changed the old token.");

  runHostedSql(`update public.workspace_contact_grants
set capabilities = array['workspace.read', 'assignments.edit']::text[]
where id = '${fixture.grantId}'::uuid;
select 'restored' as grant_state;`);
  const replacement = await authenticatedClient.rpc("replace_assignment_response_token", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 72,
  });
  assert(!replacement.error && replacement.data?.length === 1, "Hosted authorized replacement failed.");
  const replacementTokenId = replacement.data[0]?.token_id;
  const replacementBearer = replacement.data[0]?.bearer_token;
  assert(uuidPattern.test(replacementTokenId) && bearerPattern.test(replacementBearer), "Hosted replacement result was invalid.");
  secrets.add(replacementBearer);

  const oldVerification = await publicClient.rpc("read_assignment_response_by_token", {
    p_bearer_token: oldBearer,
  });
  assert(!oldVerification.error && oldVerification.data?.length === 0, "Hosted old token still verified after replacement.");
  const oldSubmission = await publicClient.rpc("submit_assignment_response_by_token", {
    p_bearer_token: oldBearer,
    p_response_status: "declined",
    p_response_note: null,
  });
  assert(oldSubmission.error?.code === "42501" && oldSubmission.data === null, "Hosted old token still submitted after replacement.");

  const replacementVerification = await publicClient.rpc("read_assignment_response_by_token", {
    p_bearer_token: replacementBearer,
  });
  assert(
    !replacementVerification.error &&
      replacementVerification.data?.[0]?.workspace_display_name === fixtureLabels.workspaceName &&
      replacementVerification.data?.[0]?.task_title === fixtureLabels.taskTitle,
    "Hosted replacement token did not verify to the safe assignment context.",
  );
  const replacementSubmission = await publicClient.rpc("submit_assignment_response_by_token", {
    p_bearer_token: replacementBearer,
    p_response_status: "confirmed",
    p_response_note: null,
  });
  assert(
    !replacementSubmission.error && replacementSubmission.data?.[0]?.current_response_status === "confirmed",
    "Hosted replacement token could not submit a response.",
  );

  const persisted = runHostedSql(`select
  (select revoked_at is not null from public.assignment_response_tokens where id = '${oldTokenId}'::uuid) as old_revoked,
  (select octet_length(token_verifier_hash) from public.assignment_response_tokens where id = '${replacementTokenId}'::uuid) as verifier_bytes,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'assignment_response_tokens' and column_name in ('token', 'raw_token', 'bearer_token')) as raw_columns,
  (select response_status from public.assignment_responses where assignment_id = '${fixture.assignmentId}'::uuid) as response_status,
  (select response_source from public.assignment_responses where assignment_id = '${fixture.assignmentId}'::uuid) as response_source,
  (select last_used_at is not null from public.assignment_response_tokens where id = '${replacementTokenId}'::uuid) as last_used;`)[0];
  assert(
    persisted?.old_revoked === true && persisted?.verifier_bytes === 32 && persisted?.raw_columns === 0 &&
      persisted?.response_status === "confirmed" && persisted?.response_source === "public_token" && persisted?.last_used === true,
    "Hosted replacement persistence state was unsafe or incomplete.",
  );

  const excessiveTtl = await authenticatedClient.rpc("replace_assignment_response_token", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 169,
  });
  assert(excessiveTtl.error?.code === "42501" && excessiveTtl.data === null, "Hosted replacement accepted 169 hours.");
  const validAfterRejectedTtl = await publicClient.rpc("read_assignment_response_by_token", {
    p_bearer_token: replacementBearer,
  });
  assert(!validAfterRejectedTtl.error && validAfterRejectedTtl.data?.length === 1, "Rejected hosted TTL changed token state.");

  const concurrent = await Promise.all([
    authenticatedClient.rpc("replace_assignment_response_token", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 72,
    }),
    authenticatedClient.rpc("replace_assignment_response_token", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 72,
    }),
  ]);
  const concurrentBearers = concurrent.map((result, index) => {
    assert(!result.error && result.data?.length === 1, `Hosted concurrent replacement ${index + 1} failed.`);
    const bearer = result.data[0]?.bearer_token;
    assert(bearerPattern.test(bearer), `Hosted concurrent replacement ${index + 1} returned an invalid bearer.`);
    secrets.add(bearer);
    return bearer;
  });
  const concurrentVerification = await Promise.all(
    concurrentBearers.map((bearer) =>
      publicClient.rpc("read_assignment_response_by_token", { p_bearer_token: bearer }),
    ),
  );
  assert(
    concurrentVerification.filter((result) => !result.error && result.data?.length === 1).length === 1,
    "Hosted concurrent replacements left more than one usable token.",
  );
  const finalState = runHostedSql(`select
  count(*) filter (where revoked_at is null and expires_at > clock_timestamp()) as active_tokens,
  count(*) filter (where revoked_at is not null) as revoked_tokens,
  (select response_status from public.assignment_responses where assignment_id = '${fixture.assignmentId}'::uuid) as response_status
from public.assignment_response_tokens
where workspace_id = '${fixture.workspaceId}'::uuid
  and assignment_id = '${fixture.assignmentId}'::uuid
  and purpose = 'assignment_response';`)[0];
  assert(
    finalState?.active_tokens === 1 && finalState?.revoked_tokens >= 3 && finalState?.response_status === "confirmed",
    "Hosted concurrency did not leave one active token and preserved response truth.",
  );
}

async function cleanupFixtures() {
  if (authenticatedClient) {
    await authenticatedClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  runHostedSql(`begin;
delete from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.assignment_responses where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.calendar_assignments where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.calendar_items where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.volunteer_profiles where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.questionnaire_submissions where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.workspace_contact_grants where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.project_contacts where id = '${fixture.contactId}'::uuid;
delete from public.workspaces where id = '${fixture.workspaceId}'::uuid;
delete from auth.identities where user_id = '${fixture.authUserId}'::uuid;
delete from auth.users where id = '${fixture.authUserId}'::uuid;
commit;
select 'cleaned' as fixture_state;`, "Hosted fixture cleanup");

  const scopeResidue = runHostedSql(`select (
  (select count(*) from public.workspaces where id = '${fixture.workspaceId}'::uuid or workspace_key = ${sqlText(fixture.namespace)}) +
  (select count(*) from public.project_contacts where id = '${fixture.contactId}'::uuid) +
  (select count(*) from public.workspace_contact_grants where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.questionnaire_submissions where workspace_id = '${fixture.workspaceId}'::uuid)
) as residue_count;`, "Hosted scope fixture residue check")[0]?.residue_count;
  const productResidue = runHostedSql(`select (
  (select count(*) from public.volunteer_profiles where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.calendar_items where workspace_id = '${fixture.workspaceId}'::uuid)
) as residue_count;`, "Hosted product fixture residue check")[0]?.residue_count;
  const responseResidue = runHostedSql(`select (
  (select count(*) from public.calendar_assignments where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.assignment_responses where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid)
) as residue_count;`, "Hosted response fixture residue check")[0]?.residue_count;
  const authResidue = runHostedSql(`select (
  (select count(*) from auth.identities where user_id = '${fixture.authUserId}'::uuid) +
  (select count(*) from auth.sessions where user_id = '${fixture.authUserId}'::uuid) +
  (select count(*) from auth.users where id = '${fixture.authUserId}'::uuid)
) as residue_count;`, "Hosted Auth fixture residue check")[0]?.residue_count;
  const residue = scopeResidue + productResidue + responseResidue + authResidue;
  assert(residue === 0, "Hosted disposable fixtures left residue.");
  cleanupCompleted = true;
  return residue;
}

async function main() {
  const anonKey = await verifyPreflightAndReadAnonKey();
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(password);
  let residue = null;

  try {
    const labels = await createFixtures(password);
    await verifyReplacement(anonKey, password, labels);
  } finally {
    residue = await cleanupFixtures();
  }

  assert(cleanupCompleted && residue === 0, "Hosted fixture cleanup did not complete.");
  console.log("Hosted staging atomic response-token replacement QA passed.");
  console.log("Validated migration 20260702000000 against the approved non-production staging ref.");
  console.log("Verified authorization, rollback, replacement, public use, hash-only storage, TTL rejection, and concurrent single-active-token behavior.");
  console.log("Hosted disposable fixture and Auth residue: 0.");
  console.log("No bearer, response URL, verifier, password, access token, refresh token, or API key was logged.");
}

main().catch((error) => {
  console.error(`Hosted response-token replacement QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
