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
  needed_count, custom_values, lifecycle
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
  'active'
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
    Object.keys(result).sort().join(",") === "expiresAt,redactedUrl,responseUrl",
    "The response-link result exposed an unexpected field.",
  );
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

  return result.redactedUrl;
}

async function cleanupFixtures(containerName) {
  if (authenticatedClient) {
    await authenticatedClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  runPsql(
    containerName,
    `begin;
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
  (select count(*) from public.assignment_response_tokens where workspace_id = '${fixture.workspaceId}'::uuid)
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
  } finally {
    await cleanupFixtures(containerName);
  }

  assert(cleanupCompleted, "Disposable response-link fixture cleanup did not complete.");
  console.log("Project-contact response-link issuance QA passed.");
  console.log(`Safe diagnostic: ${redactedUrl}`);
  console.log(
    "Created and removed disposable local Auth, workspace, grant, questionnaire, volunteer, task, Calendar, assignment, response, and token fixtures.",
  );
  console.log("No bearer, full response URL, verifier, password, or access token was logged.");
}

main().catch((error) => {
  console.error(`Response-link issuance QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
