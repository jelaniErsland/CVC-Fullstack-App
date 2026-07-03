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
  namespace: `qa-11-22-${randomUUID()}`,
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
    process.env.RUN_HOSTED_RESPONSE_REVEAL_AUDIT_VALIDATION === expectedConfirmation,
    `Refusing hosted validation without RUN_HOSTED_RESPONSE_REVEAL_AUDIT_VALIDATION=${expectedConfirmation}.`,
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
    latestMigration === "20260703000000",
    "Hosted staging is not migrated through 20260703000000.",
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
  const workspaceName = "QA 11.22 Hosted Reveal Audit Workspace";
  const taskTitle = "QA 11.22 Hosted Reveal Audit Assignment";
  const questionnaireAnswers = JSON.stringify({
    aboutYou: {
      name: "QA 11.22 Disposable Volunteer",
      email: `${fixture.namespace}-volunteer@example.invalid`,
      phone: "+1 555 011 2219",
      congregation: "QA 11.22 Hosted Test",
    },
    availability: { weekdays: ["Tuesday"], preferredTimes: ["Morning"] },
    skillsExperience: { categories: ["General"], maintenanceTaskCards: false },
    emergencyContact: { name: "QA Disposable Contact", phone: "+1 555 011 2299" },
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
  'QA 11.22 Disposable Volunteer', '${fixture.namespace}-volunteer@example.invalid',
  '+1 555 011 2219', 'QA 11.22 Hosted Test',
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

async function verifyRevealAudit(
  publicClient,
  { oldTokenId, oldExpiresAt, replacementTokenId, replacementExpiresAt },
) {
  const tableName = "assignment_response_link_reveal_events";
  const directAnonChecks = await Promise.all([
    publicClient.from(tableName).select("*"),
    publicClient.from(tableName).insert({}),
    publicClient.from(tableName).update({ reveal_mode: "copy_link" }).eq("id", randomUUID()),
    publicClient.from(tableName).delete().eq("id", randomUUID()),
  ]);
  assert(
    directAnonChecks.every((result) => result.error?.code === "42501"),
    "Anon received direct hosted audit-table access.",
  );

  const auditInput = {
    p_assignment_id: fixture.assignmentId,
    p_response_token_id: replacementTokenId,
    p_reveal_surface: "future_project_contact_assignment_response_reveal",
    p_reveal_mode: "copy_link",
    p_expires_at: replacementExpiresAt,
    p_metadata: {},
  };
  const unauthenticated = await publicClient.rpc(
    "record_assignment_response_link_reveal_event",
    auditInput,
  );
  assert(
    unauthenticated.error?.code === "42501" && unauthenticated.data === null,
    "Hosted reveal-audit RPC succeeded without real Auth.",
  );

  runHostedSql(`update public.workspace_contact_grants
set capabilities = array['workspace.read']::text[]
where id = '${fixture.grantId}'::uuid;
select 'restricted' as grant_state;`);
  const denied = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    auditInput,
  );
  assert(
    denied.error?.code === "42501" && denied.data === null,
    "Hosted reveal audit succeeded without assignments.edit.",
  );
  runHostedSql(`update public.workspace_contact_grants
set capabilities = array['workspace.read', 'assignments.edit']::text[]
where id = '${fixture.grantId}'::uuid;
select 'restored' as grant_state;`);

  const wrongAssignment = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    { ...auditInput, p_assignment_id: fixture.calendarItemId },
  );
  assert(
    wrongAssignment.error?.code === "42501" && wrongAssignment.data === null,
    "Hosted reveal audit accepted a token outside the requested assignment.",
  );

  const revoked = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    {
      ...auditInput,
      p_response_token_id: oldTokenId,
      p_expires_at: oldExpiresAt,
    },
  );
  assert(
    revoked.error?.code === "42501" && revoked.data === null,
    "Hosted reveal audit accepted a revoked token.",
  );

  const expiredTokenId = randomUUID();
  const expiredTokenExpiry = runHostedSql(`insert into public.assignment_response_tokens (
  id, workspace_id, assignment_id, volunteer_profile_id,
  token_verifier_hash, purpose, expires_at, created_by_auth_user_id,
  created_at, updated_at
) values (
  '${expiredTokenId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  '${fixture.assignmentId}'::uuid,
  '${fixture.volunteerId}'::uuid,
  extensions.digest('qa-11-22-expired-${expiredTokenId}', 'sha256'),
  'assignment_response',
  clock_timestamp() - interval '1 hour',
  '${fixture.authUserId}'::uuid,
  clock_timestamp() - interval '2 hours',
  clock_timestamp() - interval '2 hours'
)
returning expires_at;`, "Hosted expired-token fixture creation")[0]?.expires_at;
  assert(typeof expiredTokenExpiry === "string", "Hosted expired-token fixture omitted expiry.");
  const expired = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    {
      ...auditInput,
      p_response_token_id: expiredTokenId,
      p_expires_at: expiredTokenExpiry,
    },
  );
  assert(
    expired.error?.code === "42501" && expired.data === null,
    "Hosted reveal audit accepted an expired token.",
  );

  const metadataFailures = await Promise.all([
    authenticatedClient.rpc("record_assignment_response_link_reveal_event", {
      ...auditInput,
      p_metadata: { unexpected: true },
    }),
    authenticatedClient.rpc("record_assignment_response_link_reveal_event", {
      ...auditInput,
      p_metadata: { reason_code: "x".repeat(51) },
    }),
    authenticatedClient.rpc("record_assignment_response_link_reveal_event", {
      ...auditInput,
      p_metadata: {
        reason_code: "hosted_qa",
        delivery_requested: false,
        request_correlation_id: randomUUID(),
        fourth_key: true,
      },
    }),
  ]);
  assert(
    metadataFailures.every((result) => result.error?.code === "42501"),
    "Hosted reveal audit accepted non-allowlisted or out-of-bounds metadata.",
  );

  const requestCorrelationId = randomUUID();
  const metadata = {
    reason_code: "hosted_qa",
    delivery_requested: false,
    request_correlation_id: requestCorrelationId,
  };
  const recorded = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    { ...auditInput, p_metadata: metadata },
  );
  assert(
    !recorded.error &&
      recorded.data?.length === 1 &&
      recorded.data[0]?.assignment_reference === fixture.assignmentId &&
      recorded.data[0]?.response_token_reference === replacementTokenId &&
      recorded.data[0]?.actor_project_contact_reference === fixture.contactId &&
      recorded.data[0]?.event_action === "response_link_revealed" &&
      recorded.data[0]?.event_reveal_surface === auditInput.p_reveal_surface &&
      recorded.data[0]?.event_reveal_mode === "copy_link",
    "Hosted valid credential-free reveal audit was not recorded safely.",
  );
  const eventId = recorded.data[0]?.event_id;
  assert(uuidPattern.test(eventId), "Hosted reveal-audit event id was invalid.");

  const directAuthenticatedChecks = await Promise.all([
    authenticatedClient.from(tableName).select("*"),
    authenticatedClient.from(tableName).insert({}),
    authenticatedClient
      .from(tableName)
      .update({ reveal_mode: "email_delivery" })
      .eq("id", eventId),
    authenticatedClient.from(tableName).delete().eq("id", eventId),
  ]);
  assert(
    directAuthenticatedChecks.every((result) => result.error?.code === "42501"),
    "Authenticated callers received direct hosted audit-table access.",
  );

  const stored = runHostedSql(`select
  workspace_id,
  assignment_id,
  response_token_id,
  actor_project_contact_id,
  action,
  reveal_surface,
  reveal_mode,
  expires_at = '${replacementExpiresAt}'::timestamptz as expiry_matches,
  metadata,
  (select count(*) from information_schema.columns
   where table_schema = 'public'
     and table_name = 'assignment_response_link_reveal_events'
     and column_name in (
       'token', 'raw_token', 'bearer_token', 'full_url', 'response_url',
       'token_verifier_hash', 'password', 'access_token', 'refresh_token',
       'service_role_key', 'questionnaire_answers', 'emergency_contact'
     )) as forbidden_columns
from public.assignment_response_link_reveal_events
where id = '${eventId}'::uuid;`, "Hosted reveal-audit persistence check")[0];
  assert(
    stored?.workspace_id === fixture.workspaceId &&
      stored?.assignment_id === fixture.assignmentId &&
      stored?.response_token_id === replacementTokenId &&
      stored?.actor_project_contact_id === fixture.contactId &&
      stored?.action === "response_link_revealed" &&
      stored?.reveal_surface === auditInput.p_reveal_surface &&
      stored?.reveal_mode === "copy_link" &&
      stored?.expiry_matches === true &&
      stored?.metadata?.reason_code === metadata.reason_code &&
      stored?.metadata?.delivery_requested === false &&
      stored?.metadata?.request_correlation_id === requestCorrelationId &&
      stored?.forbidden_columns === 0,
    "Hosted reveal-audit persistence contained incorrect scope or credential-capable fields.",
  );
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
  const oldExpiresAt = initialIssue.data[0]?.token_expires_at;
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
  const replacementExpiresAt = replacement.data[0]?.token_expires_at;
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
  await verifyRevealAudit(publicClient, {
    oldTokenId,
    oldExpiresAt,
    replacementTokenId,
    replacementExpiresAt,
  });
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
delete from public.assignment_response_link_reveal_events where workspace_id = '${fixture.workspaceId}'::uuid;
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
  (select count(*) from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id = '${fixture.workspaceId}'::uuid)
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

function verifyNamespaceResidue() {
  const residue = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like 'qa-11-22-%') +
  (select count(*) from auth.users where email like 'qa-11-22-%@example.invalid')
) as residue_count;`, "Hosted 11.22 namespace residue check")[0]?.residue_count;
  assert(residue === 0, "Hosted qa-11-22 namespace left fixture or Auth residue.");
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
  assert(verifyNamespaceResidue() === 0, "Hosted namespace cleanup did not complete.");
  console.log("Hosted staging response-link reveal-audit QA passed.");
  console.log("Validated migration 20260703000000 against the approved non-production staging ref.");
  console.log("Verified direct-table denial, Auth/capability enforcement, token scope/lifecycle rejection, metadata bounds, credential-free audit persistence, and atomic-replacement compatibility.");
  console.log("Hosted disposable fixture and Auth residue: 0.");
  console.log("No bearer, response URL, verifier, password, access token, refresh token, database password, or API key was logged.");
}

main().catch((error) => {
  console.error(`Hosted response-link reveal-audit QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
