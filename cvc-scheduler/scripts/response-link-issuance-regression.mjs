import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  issueAssignmentResponseLinkWithIssuer,
  redactAssignmentResponseLink,
} from "../lib/responseTokens/link.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const responseLinkBaseUrl =
  process.env.RESPONSE_LINK_BASE_URL?.trim() ||
  process.env.PREVIEW_BASE_URL?.trim() ||
  "http://127.0.0.1:3000";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;
const secrets = new Set();

const fixture = {
  workspaceId: randomUUID(),
  contactId: randomUUID(),
  grantId: randomUUID(),
  questionnaireId: randomUUID(),
  volunteerId: randomUUID(),
  taskPresetId: randomUUID(),
  calendarItemId: randomUUID(),
  assignmentId: randomUUID(),
  responseId: randomUUID(),
  workspaceKey: `qa-11-14-${randomUUID()}`,
  workspaceName: "QA 11.14 Disposable Link Workspace",
  taskTitle: "QA 11.14 Response Link Assignment",
  volunteerEmail: `qa-11-14-volunteer-${randomUUID()}@example.invalid`,
};

let authUserId = null;
let authenticatedClient = null;
let issuedTokenId = null;
let issuedBearer = null;
let cleanupCompleted = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)
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
  if (result.status !== 0) throw new Error("The local fixture database command failed.");
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
    "Local Supabase is not running. Start it with `npx supabase start`.",
  );
  return containerName;
}

async function verifyLocalPreflight() {
  assert(
    supabaseUrl && anonKey,
    "Local Supabase environment values are missing. Populate the public local values in .env.local.",
  );
  assert(
    isLoopbackUrl(supabaseUrl),
    "The response-link QA harness only accepts a loopback local Supabase URL.",
  );
  assert(
    isLoopbackUrl(responseLinkBaseUrl),
    "The response-link QA harness only accepts a loopback response-link base URL.",
  );
  secrets.add(anonKey);

  const status =
    process.platform === "win32"
      ? command("cmd.exe", ["/d", "/s", "/c", "npx supabase status --output json"])
      : command("npx", ["supabase", "status", "--output", "json"]);
  assert(
    status.status === 0,
    "Local Supabase status is unavailable. Start it with `npx supabase start`.",
  );

  let localStatus;
  try {
    localStatus = JSON.parse(status.stdout);
  } catch {
    throw new Error("Local Supabase status returned an unreadable result.");
  }
  assert(
    typeof localStatus.API_URL === "string" &&
      new URL(localStatus.API_URL).origin === new URL(supabaseUrl).origin,
    "The configured Supabase URL does not match the running local stack.",
  );

  const healthResponse = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(healthResponse.ok, "The local Supabase Auth health endpoint is unavailable.");
}

function expectUuid(value, stage) {
  assert(typeof value === "string" && uuidPattern.test(value), `${stage} returned an invalid id.`);
  return value;
}

async function createFixtures(containerName) {
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const authEmail = `qa-11-14-contact-${randomUUID()}@example.invalid`;
  secrets.add(password);
  secrets.add(authEmail);

  authenticatedClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await authenticatedClient.auth.signUp({
    email: authEmail,
    password,
  });
  if (error || !data.user) throw new Error("Disposable local Auth user creation failed.");
  authUserId = expectUuid(data.user.id, "Local Auth signup");
  if (data.session?.access_token) secrets.add(data.session.access_token);

  if (!data.session) {
    const { data: signinData, error: signinError } =
      await authenticatedClient.auth.signInWithPassword({ email: authEmail, password });
    if (signinError || !signinData.session) {
      throw new Error("Disposable local Auth user sign-in failed.");
    }
    secrets.add(signinData.session.access_token);
  }

  const questionnaireAnswers = JSON.stringify({
    aboutYou: {
      name: "QA 11.14 Private Volunteer",
      email: fixture.volunteerEmail,
      phone: "+1 555 011 1414",
      congregation: "QA 11.14 Test Congregation",
    },
    availability: { weekdays: ["Tuesday"], preferredTimes: ["Morning"] },
    skillsExperience: { categories: ["General"], maintenanceTaskCards: false },
    emergencyContact: { name: "QA Private Contact", phone: "+1 555 011 1499" },
    otherWaysToHelp: {},
  });

  runPsql(
    containerName,
    `begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, public_intake_enabled
) values (
  '${fixture.workspaceId}'::uuid,
  ${sqlText(fixture.workspaceKey)},
  ${sqlText(fixture.workspaceName)},
  'active',
  'America/Denver',
  false
);
insert into public.project_contacts (id, auth_user_id, status)
values ('${fixture.contactId}'::uuid, '${authUserId}'::uuid, 'active');
insert into public.workspace_contact_grants (
  id, workspace_id, project_contact_id, role, capabilities, status
) values (
  '${fixture.grantId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  '${fixture.contactId}'::uuid,
  'main_contact',
  array['workspace.read', 'assignments.edit']::text[],
  'active'
);
insert into public.questionnaire_submissions (
  id, workspace_id, status, source, questionnaire_version, answers
) values (
  '${fixture.questionnaireId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  'submitted',
  'admin_entry',
  1,
  ${sqlText(questionnaireAnswers)}::jsonb
);
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, lifecycle, readiness_status,
  full_name, email, phone, congregation, availability_snapshot,
  skills_help_snapshot, profile_notes
) values (
  '${fixture.volunteerId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  '${fixture.questionnaireId}'::uuid,
  'active',
  'ready',
  'QA 11.14 Private Volunteer',
  ${sqlText(fixture.volunteerEmail)},
  '+1 555 011 1414',
  'QA 11.14 Test Congregation',
  '{"weekdays":["Tuesday"],"preferredTimes":["Morning"]}'::jsonb,
  '{"skillsExperience":{"categories":["General"]},"otherWaysToHelp":{}}'::jsonb,
  ''
);
insert into public.task_presets (
  id, workspace_id, name, task_type, default_needed_count,
  volunteer_visible, is_system_preset, custom_field_definitions, lifecycle
) values (
  '${fixture.taskPresetId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  ${sqlText(fixture.taskTitle)},
  'general',
  1,
  true,
  false,
  '[]'::jsonb,
  'active'
);
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
  schedule_kind, start_date, start_time, end_time, timezone,
  needed_count, custom_values, lifecycle, follow_up_project_contact_id,
  created_by_project_contact_id, publication_state, published_at,
  published_by_project_contact_id
) values (
  '${fixture.calendarItemId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  '${fixture.taskPresetId}'::uuid,
  ${sqlText(fixture.taskTitle)},
  'general',
  'timed',
  '2030-08-14',
  '09:00:00',
  '11:00:00',
  'America/Denver',
  1,
  '{}'::jsonb,
  'active',
  '${fixture.contactId}'::uuid,
  '${fixture.contactId}'::uuid,
  'published',
  now(),
  '${fixture.contactId}'::uuid
);
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id,
  lifecycle, created_by_auth_user_id
) values (
  '${fixture.assignmentId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  '${fixture.calendarItemId}'::uuid,
  '${fixture.volunteerId}'::uuid,
  'active',
  '${authUserId}'::uuid
);
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status,
  response_source, created_at, updated_at
) values (
  '${fixture.responseId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  '${fixture.assignmentId}'::uuid,
  'needs_response',
  'project_contact',
  now(),
  now()
);
commit;`,
  );
}

async function issueAndVerifyLink(containerName) {
  const result = await issueAssignmentResponseLinkWithIssuer(
    {
      assignmentId: fixture.assignmentId,
      expiresInHours: 1,
      baseUrl: responseLinkBaseUrl,
    },
    async (tokenInput) => {
      assert(tokenInput.assignmentId === fixture.assignmentId, "Link issuance changed assignment scope.");
      assert(tokenInput.internalNote === null, "Link issuance accepted an unexpected internal note.");
      const { data, error } = await authenticatedClient.rpc(
        "issue_assignment_response_token",
        {
          p_assignment_id: tokenInput.assignmentId,
          p_ttl_hours: tokenInput.expiresInHours,
          p_internal_note: tokenInput.internalNote,
        },
      );
      if (error || !Array.isArray(data) || data.length !== 1) {
        throw new Error(`Authorized response-token issuance failed${error?.code ? ` (${error.code})` : ""}.`);
      }

      issuedTokenId = expectUuid(data[0]?.token_id, "Response-token issuance");
      issuedBearer = data[0]?.bearer_token;
      assert(bearerPattern.test(issuedBearer), "Response-token issuance returned an invalid bearer.");
      secrets.add(issuedBearer);
      return {
        tokenId: issuedTokenId,
        token: issuedBearer,
        expiresAt: data[0]?.token_expires_at,
      };
    },
  );
  secrets.add(result.responseUrl);

  assert(
    Object.keys(result).sort().join(",") === "expiresAt,redactedUrl,responseUrl,tokenId",
    "The response-link result exposed an unexpected field.",
  );
  assert(result.tokenId === issuedTokenId, "The response-link result used the wrong token id.");
  const parsed = new URL(result.responseUrl);
  assert(parsed.origin === new URL(responseLinkBaseUrl).origin, "The response link used the wrong origin.");
  assert(parsed.pathname === `/respond/${issuedBearer}`, "The response link used the wrong route.");
  assert(!result.redactedUrl.includes(issuedBearer), "The redacted response link exposed the bearer.");
  assert(
    result.redactedUrl === `${parsed.origin}/respond/[redacted]`,
    "The response link did not provide the expected redacted display form.",
  );
  assert(
    redactAssignmentResponseLink(result.responseUrl) === result.redactedUrl,
    "The response-link diagnostic redactor returned an unexpected result.",
  );
  assert(Number.isFinite(Date.parse(result.expiresAt)), "The response link omitted expiration metadata.");

  const anonymousClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data: verified, error: verificationError } = await anonymousClient.rpc(
    "read_assignment_response_by_token",
    { p_bearer_token: issuedBearer },
  );
  assert(
    !verificationError &&
      Array.isArray(verified) &&
      verified.length === 1 &&
      verified[0]?.workspace_display_name === fixture.workspaceName &&
      verified[0]?.task_title === fixture.taskTitle,
    "The generated response link bearer did not verify to the expected safe assignment context.",
  );

  const storedTokenState = runPsql(
    containerName,
    `select concat_ws('|',
  octet_length(token_verifier_hash)::text,
  purpose,
  (
    select count(*)::text
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignment_response_tokens'
      and column_name in ('token', 'raw_token', 'bearer_token')
  )
)
from public.assignment_response_tokens
where id = '${issuedTokenId}'::uuid;`,
  );
  assert(
    storedTokenState === "32|assignment_response|0",
    "The issued token row did not preserve hash-only storage.",
  );

  runPsql(
    containerName,
    `update public.workspace_contact_grants
set capabilities = array['workspace.read']::text[]
where id = '${fixture.grantId}'::uuid;`,
  );
  const unauthorizedRevocation = await authenticatedClient.rpc(
    "revoke_assignment_response_token",
    { p_token_id: result.tokenId },
  );
  runPsql(
    containerName,
    `update public.workspace_contact_grants
set capabilities = array['workspace.read', 'assignments.edit']::text[]
where id = '${fixture.grantId}'::uuid;`,
  );
  assert(
    unauthorizedRevocation.error?.code === "42501" && unauthorizedRevocation.data === null,
    "Token revocation succeeded without assignments.edit.",
  );

  const stillValidAfterDeniedRevocation = await anonymousClient.rpc(
    "read_assignment_response_by_token",
    { p_bearer_token: issuedBearer },
  );
  assert(
    !stillValidAfterDeniedRevocation.error &&
      Array.isArray(stillValidAfterDeniedRevocation.data) &&
      stillValidAfterDeniedRevocation.data.length === 1,
    "Denied revocation changed the public token state.",
  );

  const authorizedRevocation = await authenticatedClient.rpc(
    "revoke_assignment_response_token",
    { p_token_id: result.tokenId },
  );
  assert(
    !authorizedRevocation.error && authorizedRevocation.data === result.tokenId,
    "Authorized token revocation failed.",
  );

  const revokedVerification = await anonymousClient.rpc(
    "read_assignment_response_by_token",
    { p_bearer_token: issuedBearer },
  );
  assert(
    !revokedVerification.error &&
      Array.isArray(revokedVerification.data) &&
      revokedVerification.data.length === 0,
    "A revoked token still verified publicly.",
  );

  const revokedSubmission = await anonymousClient.rpc(
    "submit_assignment_response_by_token",
    {
      p_bearer_token: issuedBearer,
      p_response_status: "confirmed",
      p_response_note: null,
    },
  );
  assert(
    revokedSubmission.error?.code === "42501" && revokedSubmission.data === null,
    "A revoked token still submitted a public response.",
  );

  const revokedTokenState = runPsql(
    containerName,
    `select concat_ws('|',
  octet_length(token_verifier_hash)::text,
  purpose,
  (revoked_at is not null)::text,
  (select response_status from public.assignment_responses where assignment_id = '${fixture.assignmentId}'::uuid)
)
from public.assignment_response_tokens
where id = '${result.tokenId}'::uuid;`,
  );
  assert(
    revokedTokenState === "32|assignment_response|true|needs_response",
    "Revocation did not preserve the hash-only token row and response truth.",
  );

  return result.redactedUrl;
}

async function verifyRevealAudit(
  containerName,
  anonymousClient,
  { oldTokenId, oldExpiresAt, replacementTokenId, replacementExpiresAt },
) {
  const tableName = "assignment_response_link_reveal_events";
  const directAnonChecks = await Promise.all([
    anonymousClient.from(tableName).select("*"),
    anonymousClient.from(tableName).insert({}),
    anonymousClient.from(tableName).update({ reveal_mode: "copy_link" }).eq("id", randomUUID()),
    anonymousClient.from(tableName).delete().eq("id", randomUUID()),
  ]);
  assert(
    directAnonChecks.every((result) => result.error?.code === "42501"),
    "Anon received direct audit-table access.",
  );
  const anonymousAudit = await anonymousClient.rpc(
    "record_assignment_response_link_reveal_event",
    {
      p_assignment_id: fixture.assignmentId,
      p_response_token_id: replacementTokenId,
      p_reveal_surface: "future_project_contact_assignment_response_reveal",
      p_reveal_mode: "copy_link",
      p_expires_at: replacementExpiresAt,
      p_metadata: {},
    },
  );
  assert(
    anonymousAudit.error?.code === "42501" && anonymousAudit.data === null,
    "Reveal audit RPC succeeded without real Auth.",
  );

  runPsql(
    containerName,
    `update public.workspace_contact_grants
set capabilities = array['workspace.read']::text[]
where id = '${fixture.grantId}'::uuid;`,
  );
  const deniedAudit = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    {
      p_assignment_id: fixture.assignmentId,
      p_response_token_id: replacementTokenId,
      p_reveal_surface: "future_project_contact_assignment_response_reveal",
      p_reveal_mode: "copy_link",
      p_expires_at: replacementExpiresAt,
      p_metadata: {},
    },
  );
  assert(
    deniedAudit.error?.code === "42501" && deniedAudit.data === null,
    "Reveal audit succeeded without assignments.edit.",
  );
  runPsql(
    containerName,
    `update public.workspace_contact_grants
set capabilities = array['workspace.read', 'assignments.edit']::text[]
where id = '${fixture.grantId}'::uuid;`,
  );

  const wrongAssignmentAudit = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    {
      p_assignment_id: fixture.calendarItemId,
      p_response_token_id: replacementTokenId,
      p_reveal_surface: "future_project_contact_assignment_response_reveal",
      p_reveal_mode: "copy_link",
      p_expires_at: replacementExpiresAt,
      p_metadata: {},
    },
  );
  assert(
    wrongAssignmentAudit.error?.code === "42501" && wrongAssignmentAudit.data === null,
    "Reveal audit accepted a token outside the requested assignment.",
  );

  const revokedAudit = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    {
      p_assignment_id: fixture.assignmentId,
      p_response_token_id: oldTokenId,
      p_reveal_surface: "future_project_contact_assignment_response_reveal",
      p_reveal_mode: "copy_link",
      p_expires_at: oldExpiresAt,
      p_metadata: {},
    },
  );
  assert(
    revokedAudit.error?.code === "42501" && revokedAudit.data === null,
    "Reveal audit accepted a revoked token.",
  );

  const expiredTokenId = randomUUID();
  const expiredTokenExpiry = runPsql(
    containerName,
    `insert into public.assignment_response_tokens (
  id, workspace_id, assignment_id, volunteer_profile_id,
  token_verifier_hash, purpose, expires_at, created_by_auth_user_id,
  created_at, updated_at
) values (
  '${expiredTokenId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  '${fixture.assignmentId}'::uuid,
  '${fixture.volunteerId}'::uuid,
  extensions.digest('qa-11-21-expired-${expiredTokenId}', 'sha256'),
  'assignment_response',
  clock_timestamp() - interval '1 hour',
  '${authUserId}'::uuid,
  clock_timestamp() - interval '2 hours',
  clock_timestamp() - interval '2 hours'
)
returning to_char(expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');`,
  );
  const expiredAudit = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    {
      p_assignment_id: fixture.assignmentId,
      p_response_token_id: expiredTokenId,
      p_reveal_surface: "future_project_contact_assignment_response_reveal",
      p_reveal_mode: "copy_link",
      p_expires_at: expiredTokenExpiry,
      p_metadata: {},
    },
  );
  assert(
    expiredAudit.error?.code === "42501" && expiredAudit.data === null,
    "Reveal audit accepted an expired token.",
  );

  const excessiveMetadata = Object.fromEntries(
    Array.from({ length: 11 }, (_, index) => [`key${index}`, index]),
  );
  const boundedFailures = await Promise.all([
    authenticatedClient.rpc("record_assignment_response_link_reveal_event", {
      p_assignment_id: fixture.assignmentId,
      p_response_token_id: replacementTokenId,
      p_reveal_surface: "future_project_contact_assignment_response_reveal",
      p_reveal_mode: "copy_link",
      p_expires_at: replacementExpiresAt,
      p_metadata: excessiveMetadata,
    }),
    authenticatedClient.rpc("record_assignment_response_link_reveal_event", {
      p_assignment_id: fixture.assignmentId,
      p_response_token_id: replacementTokenId,
      p_reveal_surface: "future_project_contact_assignment_response_reveal",
      p_reveal_mode: "copy_link",
      p_expires_at: replacementExpiresAt,
      p_metadata: { reason_code: "x".repeat(51) },
    }),
  ]);
  assert(
    boundedFailures.every((result) => result.error?.code === "42501"),
    "Reveal audit accepted non-allowlisted or out-of-bounds metadata.",
  );

  const requestCorrelationId = randomUUID();
  const recorded = await authenticatedClient.rpc(
    "record_assignment_response_link_reveal_event",
    {
      p_assignment_id: fixture.assignmentId,
      p_response_token_id: replacementTokenId,
      p_reveal_surface: "future_project_contact_assignment_response_reveal",
      p_reveal_mode: "copy_link",
      p_expires_at: replacementExpiresAt,
      p_metadata: {
        reason_code: "qa_validation",
        delivery_requested: false,
        request_correlation_id: requestCorrelationId,
      },
    },
  );
  assert(
    !recorded.error &&
      recorded.data?.length === 1 &&
      recorded.data[0]?.assignment_reference === fixture.assignmentId &&
      recorded.data[0]?.response_token_reference === replacementTokenId &&
      recorded.data[0]?.actor_project_contact_reference === fixture.contactId &&
      recorded.data[0]?.event_action === "response_link_revealed" &&
      recorded.data[0]?.event_reveal_surface ===
        "future_project_contact_assignment_response_reveal" &&
      recorded.data[0]?.event_reveal_mode === "copy_link",
    "Valid credential-free reveal audit was not recorded safely.",
  );
  const eventId = expectUuid(recorded.data[0]?.event_id, "Reveal audit event");

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
    "Authenticated callers received direct audit-table access.",
  );

  const storedAuditState = runPsql(
    containerName,
    `select concat_ws('|',
  (select count(*)::text from public.assignment_response_link_reveal_events where workspace_id = '${fixture.workspaceId}'::uuid),
  workspace_id::text,
  assignment_id::text,
  response_token_id::text,
  actor_project_contact_id::text,
  action,
  reveal_surface,
  reveal_mode,
  (expires_at = '${replacementExpiresAt}'::timestamptz)::text,
  metadata::text,
  (
    select count(*)::text
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assignment_response_link_reveal_events'
      and column_name in (
        'token', 'raw_token', 'bearer_token', 'full_url', 'response_url',
        'token_verifier_hash', 'password', 'access_token', 'refresh_token',
        'service_role_key', 'questionnaire_answers', 'emergency_contact'
      )
  )
)
from public.assignment_response_link_reveal_events
where id = '${eventId}'::uuid;`,
  );
  assert(
    storedAuditState ===
      `1|${fixture.workspaceId}|${fixture.assignmentId}|${replacementTokenId}|${fixture.contactId}|response_link_revealed|future_project_contact_assignment_response_reveal|copy_link|true|{"reason_code": "qa_validation", "delivery_requested": false, "request_correlation_id": "${requestCorrelationId}"}|0`,
    "Stored reveal audit contained incorrect scope or credential-capable columns.",
  );
}

async function verifyAtomicReplacement(containerName) {
  const anonymousClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const initialIssue = await authenticatedClient.rpc("issue_assignment_response_token", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 24,
    p_internal_note: null,
  });
  assert(
    !initialIssue.error && Array.isArray(initialIssue.data) && initialIssue.data.length === 1,
    "Replacement setup token issuance failed.",
  );
  const oldTokenId = expectUuid(initialIssue.data[0]?.token_id, "Replacement setup issuance");
  const oldBearer = initialIssue.data[0]?.bearer_token;
  const oldExpiresAt = initialIssue.data[0]?.token_expires_at;
  assert(bearerPattern.test(oldBearer), "Replacement setup returned an invalid bearer.");
  secrets.add(oldBearer);

  runPsql(
    containerName,
    `update public.workspace_contact_grants
set capabilities = array['workspace.read']::text[]
where id = '${fixture.grantId}'::uuid;`,
  );
  const deniedReplacement = await authenticatedClient.rpc(
    "replace_assignment_response_token",
    { p_assignment_id: fixture.assignmentId, p_ttl_hours: 72 },
  );
  assert(
    deniedReplacement.error?.code === "42501" && deniedReplacement.data === null,
    "Response-token replacement succeeded without assignments.edit.",
  );

  const validAfterDeniedReplacement = await anonymousClient.rpc(
    "read_assignment_response_by_token",
    { p_bearer_token: oldBearer },
  );
  assert(
    !validAfterDeniedReplacement.error && validAfterDeniedReplacement.data?.length === 1,
    "Denied replacement changed the existing active token.",
  );

  runPsql(
    containerName,
    `update public.workspace_contact_grants
set capabilities = array['workspace.read', 'assignments.edit']::text[]
where id = '${fixture.grantId}'::uuid;`,
  );
  const replacementStartedAt = Date.now();
  const replacement = await authenticatedClient.rpc("replace_assignment_response_token", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 72,
  });
  assert(
    !replacement.error && Array.isArray(replacement.data) && replacement.data.length === 1,
    "Authorized atomic response-token replacement failed.",
  );
  const replacementTokenId = expectUuid(
    replacement.data[0]?.token_id,
    "Atomic response-token replacement",
  );
  const replacementBearer = replacement.data[0]?.bearer_token;
  assert(bearerPattern.test(replacementBearer), "Replacement returned an invalid bearer.");
  secrets.add(replacementBearer);
  const replacementTtlHours =
    (Date.parse(replacement.data[0]?.token_expires_at) - replacementStartedAt) / 3_600_000;
  assert(
    replacementTtlHours > 71.9 && replacementTtlHours <= 72.1,
    "Replacement did not use the 72-hour product default supplied by the policy boundary.",
  );

  const revokedOldVerification = await anonymousClient.rpc(
    "read_assignment_response_by_token",
    { p_bearer_token: oldBearer },
  );
  assert(
    !revokedOldVerification.error && revokedOldVerification.data?.length === 0,
    "Atomic replacement left the older token publicly valid.",
  );
  const revokedOldSubmission = await anonymousClient.rpc(
    "submit_assignment_response_by_token",
    {
      p_bearer_token: oldBearer,
      p_response_status: "declined",
      p_response_note: null,
    },
  );
  assert(
    revokedOldSubmission.error?.code === "42501" && revokedOldSubmission.data === null,
    "An older replaced token still submitted a response.",
  );

  const replacementVerification = await anonymousClient.rpc(
    "read_assignment_response_by_token",
    { p_bearer_token: replacementBearer },
  );
  assert(
    !replacementVerification.error && replacementVerification.data?.length === 1,
    "The new replacement token did not verify publicly.",
  );
  await verifyRevealAudit(containerName, anonymousClient, {
    oldTokenId,
    oldExpiresAt,
    replacementTokenId,
    replacementExpiresAt: replacement.data[0]?.token_expires_at,
  });
  const replacementSubmission = await anonymousClient.rpc(
    "submit_assignment_response_by_token",
    {
      p_bearer_token: replacementBearer,
      p_response_status: "confirmed",
      p_response_note: null,
    },
  );
  assert(
    !replacementSubmission.error && replacementSubmission.data?.[0]?.current_response_status === "confirmed",
    "The new replacement token could not submit a public response.",
  );

  const persistedReplacementState = runPsql(
    containerName,
    `select concat_ws('|',
  (select (revoked_at is not null)::text from public.assignment_response_tokens where id = '${oldTokenId}'::uuid),
  (select octet_length(token_verifier_hash)::text from public.assignment_response_tokens where id = '${replacementTokenId}'::uuid),
  (select response_status from public.assignment_responses where assignment_id = '${fixture.assignmentId}'::uuid),
  (select response_source from public.assignment_responses where assignment_id = '${fixture.assignmentId}'::uuid),
  (select (last_used_at is not null)::text from public.assignment_response_tokens where id = '${replacementTokenId}'::uuid),
  (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'assignment_response_tokens' and column_name in ('token', 'raw_token', 'bearer_token'))
);`,
  );
  assert(
    persistedReplacementState === "true|32|confirmed|public_token|true|0",
    "Replacement did not preserve hash-only storage and public response truth.",
  );

  const excessiveTtl = await authenticatedClient.rpc("replace_assignment_response_token", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 169,
  });
  assert(
    excessiveTtl.error?.code === "42501" && excessiveTtl.data === null,
    "The replacement RPC accepted a TTL above the 168-hour product maximum.",
  );
  const validAfterRejectedTtl = await anonymousClient.rpc(
    "read_assignment_response_by_token",
    { p_bearer_token: replacementBearer },
  );
  assert(
    !validAfterRejectedTtl.error && validAfterRejectedTtl.data?.length === 1,
    "A rejected replacement TTL changed the active token.",
  );

  const concurrentResults = await Promise.all([
    authenticatedClient.rpc("replace_assignment_response_token", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 72,
    }),
    authenticatedClient.rpc("replace_assignment_response_token", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 72,
    }),
  ]);
  const concurrentTokens = concurrentResults.map((result, index) => {
    assert(
      !result.error && Array.isArray(result.data) && result.data.length === 1,
      `Concurrent replacement ${index + 1} failed unexpectedly.`,
    );
    const tokenId = expectUuid(result.data[0]?.token_id, `Concurrent replacement ${index + 1}`);
    const bearer = result.data[0]?.bearer_token;
    assert(bearerPattern.test(bearer), `Concurrent replacement ${index + 1} returned an invalid bearer.`);
    secrets.add(bearer);
    return { tokenId, bearer };
  });

  const concurrentVerification = await Promise.all(
    concurrentTokens.map(({ bearer }) =>
      anonymousClient.rpc("read_assignment_response_by_token", { p_bearer_token: bearer }),
    ),
  );
  const usableConcurrentTokens = concurrentVerification.filter(
    (result) => !result.error && result.data?.length === 1,
  );
  assert(
    usableConcurrentTokens.length === 1,
    "Concurrent replacements left more than one usable token.",
  );
  const finalDatabaseState = runPsql(
    containerName,
    `select concat_ws('|',
  count(*) filter (where revoked_at is null and expires_at > clock_timestamp())::text,
  count(*) filter (where revoked_at is not null)::text,
  (select response_status from public.assignment_responses where assignment_id = '${fixture.assignmentId}'::uuid)
)
from public.assignment_response_tokens
where workspace_id = '${fixture.workspaceId}'::uuid
  and assignment_id = '${fixture.assignmentId}'::uuid
  and purpose = 'assignment_response';`,
  );
  const [activeCount, revokedCount, responseStatus] = finalDatabaseState.split("|");
  assert(activeCount === "1", "Concurrent replacement did not leave exactly one active token.");
  assert(Number(revokedCount) >= 4, "Concurrent replacement did not revoke earlier token rows.");
  assert(responseStatus === "confirmed", "Concurrent replacement changed assignment response truth.");
}

async function verifyAuditedReveal(containerName) {
  const anonymousClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const unauthenticated = await anonymousClient.rpc("reveal_assignment_response_link", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 72,
    p_reveal_mode: "copy_link",
    p_metadata: {},
  });
  assert(
    unauthenticated.error?.code === "42501" && unauthenticated.data === null,
    "Audited reveal RPC succeeded without real Auth.",
  );
  const setup = await authenticatedClient.rpc("replace_assignment_response_token", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 24,
  });
  assert(!setup.error && setup.data?.length === 1, "Audited reveal setup failed.");
  const oldTokenId = expectUuid(setup.data[0]?.token_id, "Audited reveal setup token");
  const oldBearer = setup.data[0]?.bearer_token;
  assert(bearerPattern.test(oldBearer), "Audited reveal setup bearer was invalid.");
  secrets.add(oldBearer);

  const stateBeforeDenied = runPsql(
    containerName,
    `select concat_ws('|',
  (select count(*)::text from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid),
  (select count(*)::text from public.assignment_response_link_reveal_events where workspace_id = '${fixture.workspaceId}'::uuid),
  (select count(*)::text from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid and revoked_at is null)
);`,
  );
  runPsql(
    containerName,
    `update public.workspace_contact_grants
set capabilities = array['workspace.read']::text[]
where id = '${fixture.grantId}'::uuid;`,
  );
  const denied = await authenticatedClient.rpc("reveal_assignment_response_link", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 72,
    p_reveal_mode: "copy_link",
    p_metadata: { reason_code: "qa_validation" },
  });
  assert(
    denied.error?.code === "42501" && denied.data === null,
    "Audited reveal succeeded without assignments.edit.",
  );
  const stateAfterDenied = runPsql(
    containerName,
    `select concat_ws('|',
  (select count(*)::text from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid),
  (select count(*)::text from public.assignment_response_link_reveal_events where workspace_id = '${fixture.workspaceId}'::uuid),
  (select count(*)::text from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid and revoked_at is null)
);`,
  );
  assert(stateAfterDenied === stateBeforeDenied, "Denied audited reveal mutated token or audit state.");
  const oldAfterDenied = await anonymousClient.rpc("read_assignment_response_by_token", {
    p_bearer_token: oldBearer,
  });
  assert(!oldAfterDenied.error && oldAfterDenied.data?.length === 1, "Denied audited reveal revoked the old token.");

  runPsql(
    containerName,
    `update public.workspace_contact_grants
set capabilities = array['workspace.read', 'assignments.edit']::text[]
where id = '${fixture.grantId}'::uuid;`,
  );
  const rejectedInputs = await Promise.all([
    authenticatedClient.rpc("reveal_assignment_response_link", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 169,
      p_reveal_mode: "copy_link",
      p_metadata: {},
    }),
    authenticatedClient.rpc("reveal_assignment_response_link", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 72,
      p_reveal_mode: "unsupported",
      p_metadata: {},
    }),
    authenticatedClient.rpc("reveal_assignment_response_link", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 72,
      p_reveal_mode: "copy_link",
      p_metadata: { unexpected: true },
    }),
  ]);
  assert(
    rejectedInputs.every((result) => result.error?.code === "42501" && result.data === null),
    "Audited reveal accepted an invalid TTL, mode, or metadata object.",
  );
  const stateAfterRejectedInputs = runPsql(
    containerName,
    `select concat_ws('|',
  (select count(*)::text from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid),
  (select count(*)::text from public.assignment_response_link_reveal_events where workspace_id = '${fixture.workspaceId}'::uuid),
  (select count(*)::text from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid and revoked_at is null)
);`,
  );
  assert(
    stateAfterRejectedInputs === stateBeforeDenied,
    "Rejected audited reveal input mutated token or audit state.",
  );

  const correlationId = randomUUID();
  const revealStartedAt = Date.now();
  const revealResult = await authenticatedClient.rpc("reveal_assignment_response_link", {
    p_assignment_id: fixture.assignmentId,
    p_ttl_hours: 72,
    p_reveal_mode: "copy_link",
    p_metadata: {
      reason_code: "qa_validation",
      delivery_requested: false,
      request_correlation_id: correlationId,
    },
  });
  assert(!revealResult.error && revealResult.data?.length === 1, "Valid audited reveal failed.");
  const revealRow = revealResult.data[0];
  const responseUrl = new URL(
    `/respond/${encodeURIComponent(revealRow?.bearer_token)}`,
    responseLinkBaseUrl,
  ).toString();
  const revealed = {
    responseUrl,
    redactedUrl: redactAssignmentResponseLink(responseUrl),
    expiresAt: revealRow?.token_expires_at,
    responseTokenId: revealRow?.response_token_id,
    auditEventId: revealRow?.audit_event_id,
    revealMode: revealRow?.event_reveal_mode,
  };
  secrets.add(revealed.responseUrl);
  const revealedUrl = new URL(revealed.responseUrl);
  const revealedBearer = decodeURIComponent(revealedUrl.pathname.split("/").at(-1) ?? "");
  assert(bearerPattern.test(revealedBearer), "Audited reveal helper returned an invalid bearer URL.");
  secrets.add(revealedBearer);
  assert(
    revealed.redactedUrl === `${new URL(responseLinkBaseUrl).origin}/respond/[redacted]` &&
      revealed.revealMode === "copy_link" &&
      uuidPattern.test(revealed.responseTokenId) &&
      uuidPattern.test(revealed.auditEventId),
    "Audited reveal helper returned an invalid safe result shape.",
  );
  const revealTtlHours = (Date.parse(revealed.expiresAt) - revealStartedAt) / 3_600_000;
  assert(
    revealTtlHours > 71.9 && revealTtlHours <= 72.1,
    "Audited reveal did not use the 72-hour product TTL default.",
  );

  const oldVerification = await anonymousClient.rpc("read_assignment_response_by_token", {
    p_bearer_token: oldBearer,
  });
  const oldSubmission = await anonymousClient.rpc("submit_assignment_response_by_token", {
    p_bearer_token: oldBearer,
    p_response_status: "declined",
    p_response_note: null,
  });
  assert(
    !oldVerification.error && oldVerification.data?.length === 0 &&
      oldSubmission.error?.code === "42501" && oldSubmission.data === null,
    "Audited reveal left the older bearer usable.",
  );
  const newVerification = await anonymousClient.rpc("read_assignment_response_by_token", {
    p_bearer_token: revealedBearer,
  });
  assert(!newVerification.error && newVerification.data?.length === 1, "Audited reveal bearer did not verify publicly.");

  const persisted = runPsql(
    containerName,
    `select concat_ws('|',
  (select (revoked_at is not null)::text from public.assignment_response_tokens where id = '${oldTokenId}'::uuid),
  (select octet_length(token_verifier_hash)::text from public.assignment_response_tokens where id = '${revealed.responseTokenId}'::uuid),
  (select count(*)::text from public.assignment_response_link_reveal_events where id = '${revealed.auditEventId}'::uuid and response_token_id = '${revealed.responseTokenId}'::uuid and workspace_id = '${fixture.workspaceId}'::uuid and assignment_id = '${fixture.assignmentId}'::uuid and actor_project_contact_id = '${fixture.contactId}'::uuid and reveal_surface = 'future_project_contact_assignment_response_reveal' and reveal_mode = 'copy_link' and metadata = '{"reason_code":"qa_validation","delivery_requested":false,"request_correlation_id":"${correlationId}"}'::jsonb),
  (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'assignment_response_link_reveal_events' and column_name in ('token', 'raw_token', 'bearer_token', 'full_url', 'response_url', 'token_verifier_hash', 'password', 'access_token', 'refresh_token', 'service_role_key', 'questionnaire_answers', 'emergency_contact'))
);`,
  );
  assert(
    persisted === "true|32|1|0",
    "Audited reveal did not atomically persist one credential-free audit for its hash-only token.",
  );

  const newSubmission = await anonymousClient.rpc("submit_assignment_response_by_token", {
    p_bearer_token: revealedBearer,
    p_response_status: "declined",
    p_response_note: null,
  });
  assert(
    !newSubmission.error && newSubmission.data?.[0]?.current_response_status === "declined",
    "Audited reveal bearer could not submit a public response.",
  );

  const concurrent = await Promise.all([
    authenticatedClient.rpc("reveal_assignment_response_link", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 72,
      p_reveal_mode: "copy_link",
      p_metadata: { reason_code: "qa_concurrency" },
    }),
    authenticatedClient.rpc("reveal_assignment_response_link", {
      p_assignment_id: fixture.assignmentId,
      p_ttl_hours: 72,
      p_reveal_mode: "copy_link",
      p_metadata: { reason_code: "qa_concurrency" },
    }),
  ]);
  const concurrentResults = concurrent.map((result, index) => {
    assert(!result.error && result.data?.length === 1, `Concurrent audited reveal ${index + 1} failed.`);
    const bearer = result.data[0]?.bearer_token;
    assert(bearerPattern.test(bearer), `Concurrent audited reveal ${index + 1} returned an invalid bearer.`);
    secrets.add(bearer);
    return {
      tokenId: expectUuid(result.data[0]?.response_token_id, `Concurrent audited reveal ${index + 1} token`),
      auditId: expectUuid(result.data[0]?.audit_event_id, `Concurrent audited reveal ${index + 1} audit`),
      bearer,
    };
  });
  const concurrentVerification = await Promise.all(
    concurrentResults.map(({ bearer }) =>
      anonymousClient.rpc("read_assignment_response_by_token", { p_bearer_token: bearer }),
    ),
  );
  assert(
    concurrentVerification.filter((result) => !result.error && result.data?.length === 1).length === 1,
    "Concurrent audited reveals left more than one usable token.",
  );
  const concurrentState = runPsql(
    containerName,
    `select concat_ws('|',
  (select count(*)::text from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid and assignment_id = '${fixture.assignmentId}'::uuid and revoked_at is null and expires_at > clock_timestamp()),
  (select count(*)::text from public.assignment_response_link_reveal_events where id in ('${concurrentResults[0].auditId}'::uuid, '${concurrentResults[1].auditId}'::uuid) and response_token_id in ('${concurrentResults[0].tokenId}'::uuid, '${concurrentResults[1].tokenId}'::uuid))
);`,
  );
  assert(
    concurrentState === "1|2",
    "Concurrent audited reveals did not leave one active token and one audit per successful command.",
  );
}

async function cleanupFixtures(containerName) {
  if (authenticatedClient) {
    await authenticatedClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  runPsql(
    containerName,
    `begin;
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
${authUserId ? `delete from auth.users where id = '${authUserId}'::uuid;` : ""}
commit;`,
  );

  const residue = runPsql(
    containerName,
    `select (
  (select count(*) from public.workspaces where id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.project_contacts where id = '${fixture.contactId}'::uuid) +
  (select count(*) from public.workspace_contact_grants where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.questionnaire_submissions where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.volunteer_profiles where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.calendar_items where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.calendar_assignments where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.assignment_responses where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.assignment_response_link_reveal_events where workspace_id = '${fixture.workspaceId}'::uuid)
  ${authUserId ? `+ (select count(*) from auth.users where id = '${authUserId}'::uuid) + (select count(*) from auth.identities where user_id = '${authUserId}'::uuid)` : ""}
)::text;`,
  );
  assert(residue === "0", "Disposable response-link fixtures left local rows behind.");
  cleanupCompleted = true;
}

async function main() {
  await verifyLocalPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  let redactedUrl;

  try {
    await createFixtures(containerName);
    redactedUrl = await issueAndVerifyLink(containerName);
    await verifyAtomicReplacement(containerName);
    await verifyAuditedReveal(containerName);
  } finally {
    await cleanupFixtures(containerName);
  }

  assert(cleanupCompleted, "Disposable response-link fixture cleanup did not complete.");
  console.log("Project-contact response-link issuance QA passed.");
  console.log(`Safe diagnostic: ${redactedUrl}`);
  console.log(
    "Verified assignments.edit revocation/replacement authorization, atomic replacement, and concurrent single-active-token behavior.",
  );
  console.log(
    "Verified credential-free reveal-audit RLS, Auth/capability/scope/lifecycle checks, bounds, and safe persistence.",
  );
  console.log(
    "Verified transactional audited reveal rollback, replacement, one-audit coupling, public use, and concurrent single-active-token behavior.",
  );
  console.log(
    "Created and removed disposable local Auth, workspace, grant, questionnaire, volunteer, task, Calendar, assignment, response, and token fixtures.",
  );
  console.log("No bearer, full response URL, verifier, password, or access token was logged.");
}

main().catch((error) => {
  console.error(`Response-link issuance QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
