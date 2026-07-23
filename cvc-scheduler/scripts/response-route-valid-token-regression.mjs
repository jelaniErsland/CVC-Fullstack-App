import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { chromium } from "playwright";

import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const previewBaseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;
const secrets = new Set();

const fixture = {
  workspaceId: randomUUID(),
  contactId: randomUUID(),
  grantId: randomUUID(),
  workspaceKey: `qa-11-13-${randomUUID()}`,
  workspaceName: "QA 11.13 Disposable Workspace",
  targetTaskTitle: "QA 11.13 Valid Token Assignment",
  unrelatedTaskTitle: "QA 11.13 Unrelated Assignment Must Stay Hidden",
  volunteerName: "QA 11.13 Private Volunteer",
  volunteerEmail: `qa-11-13-volunteer-${randomUUID()}@example.invalid`,
  volunteerPhone: "+1 555 011 1313",
  emergencyName: "QA 11.13 Private Emergency Contact",
  emergencyPhone: "+1 555 011 1399",
  privateAnswer: "QA_11_13_PRIVATE_QUESTIONNAIRE_MARKER",
};

let authUserId = null;
let authenticatedClient = null;
let browser = null;
let bearerToken = null;
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
    throw new Error("The local fixture database command failed.");
  }
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
    "Local Supabase environment values are missing. Populate NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
  );
  assert(
    isLoopbackUrl(supabaseUrl),
    "The response-route QA harness only accepts a loopback local Supabase URL.",
  );
  assert(
    isLoopbackUrl(previewBaseUrl),
    "The response-route QA harness only accepts a loopback production preview URL.",
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

  let previewResponse;
  try {
    previewResponse = await fetch(createPreviewUrl(previewBaseUrl, "/respond/not-a-token"), {
      redirect: "error",
    });
  } catch {
    throw new Error(
      "The production preview is unavailable. Run `npm run build` and `npm run preview` before this QA command.",
    );
  }
  const previewText = await previewResponse.text();
  assert(
    previewResponse.ok && previewText.includes("This link is expired or unavailable"),
    "The running preview does not contain the 11.12 response route. Rebuild and restart the preview.",
  );
}

async function rpc(client, name, args, stage) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new Error(`${stage} failed${error.code ? ` (${error.code})` : ""}.`);
  }
  return data;
}

function expectUuid(value, stage) {
  assert(typeof value === "string" && uuidPattern.test(value), `${stage} returned an invalid id.`);
  return value;
}

async function createFixtures(containerName) {
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const authEmail = `qa-11-13-contact-${randomUUID()}@example.invalid`;
  secrets.add(password);
  secrets.add(authEmail);

  authenticatedClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data: signupData, error: signupError } = await authenticatedClient.auth.signUp({
    email: authEmail,
    password,
  });
  if (signupError || !signupData.user) {
    throw new Error("Disposable local Auth user creation failed.");
  }
  authUserId = expectUuid(signupData.user.id, "Local Auth signup");
  if (signupData.session?.access_token) secrets.add(signupData.session.access_token);

  if (!signupData.session) {
    const { data: signinData, error: signinError } =
      await authenticatedClient.auth.signInWithPassword({ email: authEmail, password });
    if (signinError || !signinData.session) {
      throw new Error("Disposable local Auth user sign-in failed.");
    }
    secrets.add(signinData.session.access_token);
  }

  runPsql(
    containerName,
    `begin;
insert into public.workspaces (
  id, workspace_key, display_name, lifecycle, timezone, public_intake_enabled
) values (
  '${fixture.workspaceId}'::uuid,
  '${fixture.workspaceKey}',
  '${fixture.workspaceName}',
  'active',
  'America/Denver',
  true
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
  array[
    'workspace.read',
    'questionnaires.review',
    'volunteers.view',
    'volunteers.edit',
    'tasks.view',
    'tasks.edit',
    'calendar.view',
    'calendar.edit',
    'assignments.view',
    'assignments.edit'
  ]::text[],
  'active'
);
commit;`,
  );

  const questionnaireId = expectUuid(
    await rpc(
      authenticatedClient,
      "submit_questionnaire_submission",
      {
        p_workspace_key: fixture.workspaceKey,
        p_questionnaire_version: 1,
        p_answers: {
          aboutYou: {
            name: fixture.volunteerName,
            email: fixture.volunteerEmail,
            phone: fixture.volunteerPhone,
            congregation: "QA 11.13 Test Congregation",
            preferredContactMethod: "Email",
          },
          availability: { weekdays: ["Monday"], preferredTimes: ["Morning"] },
          skillsExperience: { categories: ["General"], maintenanceTaskCards: false },
          emergencyContact: {
            name: fixture.emergencyName,
            phone: fixture.emergencyPhone,
          },
          otherWaysToHelp: { notes: fixture.privateAnswer },
        },
      },
      "Questionnaire fixture creation",
    ),
    "Questionnaire fixture creation",
  );

  const volunteerId = expectUuid(
    await rpc(
      authenticatedClient,
      "convert_questionnaire_submission_to_volunteer_profile",
      { p_submission_id: questionnaireId },
      "Volunteer fixture creation",
    ),
    "Volunteer fixture creation",
  );

  const taskPresetId = expectUuid(
    await rpc(
      authenticatedClient,
      "create_task_preset",
      {
        p_workspace_id: fixture.workspaceId,
        p_name: fixture.targetTaskTitle,
        p_description: "Disposable route QA task",
        p_task_type: "general",
        p_default_needed_count: 1,
        p_volunteer_visible: true,
        p_custom_field_definitions: [],
      },
      "Task fixture creation",
    ),
    "Task fixture creation",
  );

  const targetCalendarItemId = expectUuid(
    await rpc(
      authenticatedClient,
      "create_calendar_item",
      {
        p_workspace_id: fixture.workspaceId,
        p_task_preset_id: taskPresetId,
        p_one_off_title: null,
        p_one_off_task_type: null,
        p_schedule_kind: "timed",
        p_start_date: "2030-07-15",
        p_end_date: null,
        p_start_time: "09:00:00",
        p_end_time: "11:00:00",
        p_needed_count: 1,
        p_schedule_notes: "Disposable route QA schedule",
        p_custom_values: {},
      },
      "Calendar fixture creation",
    ),
    "Calendar fixture creation",
  );

  const unrelatedCalendarItemId = expectUuid(
    await rpc(
      authenticatedClient,
      "create_calendar_item",
      {
        p_workspace_id: fixture.workspaceId,
        p_task_preset_id: null,
        p_one_off_title: fixture.unrelatedTaskTitle,
        p_one_off_task_type: "general",
        p_schedule_kind: "date_based",
        p_start_date: "2030-07-16",
        p_end_date: null,
        p_start_time: null,
        p_end_time: null,
        p_needed_count: 1,
        p_schedule_notes: null,
        p_custom_values: {},
      },
      "Unrelated Calendar fixture creation",
    ),
    "Unrelated Calendar fixture creation",
  );

  await rpc(
    authenticatedClient,
    "publish_calendar_item",
    { p_calendar_item_id: targetCalendarItemId },
    "Target Calendar fixture publication",
  );
  await rpc(
    authenticatedClient,
    "publish_calendar_item",
    { p_calendar_item_id: unrelatedCalendarItemId },
    "Unrelated Calendar fixture publication",
  );

  const targetAssignmentId = expectUuid(
    await rpc(
      authenticatedClient,
      "create_calendar_assignment",
      {
        p_calendar_item_id: targetCalendarItemId,
        p_volunteer_profile_id: volunteerId,
        p_assignment_note: "Disposable route QA assignment",
      },
      "Assignment fixture creation",
    ),
    "Assignment fixture creation",
  );

  await rpc(
    authenticatedClient,
    "create_calendar_assignment",
    {
      p_calendar_item_id: unrelatedCalendarItemId,
      p_volunteer_profile_id: volunteerId,
      p_assignment_note: "Disposable unrelated assignment",
    },
    "Unrelated assignment fixture creation",
  );

  const issued = await rpc(
    authenticatedClient,
    "issue_assignment_response_token",
    {
      p_assignment_id: targetAssignmentId,
      p_ttl_hours: 1,
      p_internal_note: "Disposable 11.13 route QA token",
    },
    "Response-token fixture issuance",
  );
  assert(Array.isArray(issued) && issued.length === 1, "Token issuance returned an invalid result.");
  const tokenId = expectUuid(issued[0]?.token_id, "Token issuance");
  bearerToken = issued[0]?.bearer_token;
  assert(bearerPattern.test(bearerToken), "Token issuance returned an invalid bearer.");
  secrets.add(bearerToken);

  return { targetAssignmentId, tokenId };
}

async function exerciseRoute(targetAssignmentId, tokenId, containerName) {
  browser = await chromium.launch(
    browserExecutable ? { executablePath: browserExecutable } : undefined,
  );
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const browserErrors = [];
  page.on("pageerror", () => browserErrors.push("pageerror"));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push("console-error");
  });

  const responseUrl = createPreviewUrl(
    previewBaseUrl,
    `/respond/${encodeURIComponent(bearerToken)}`,
  );
  const navigation = await page.goto(responseUrl, { waitUntil: "domcontentloaded" });
  assert(navigation?.ok(), "The valid-token response route did not load successfully.");

  const visibleText = await page.locator("body").innerText();
  for (const expected of [
    fixture.workspaceName,
    fixture.targetTaskTitle,
    "Needs your response",
    "America/Denver",
    "No account or password is needed",
  ]) {
    assert(visibleText.includes(expected), `The valid-token page is missing expected safe context: ${expected}.`);
  }

  for (const forbidden of [
    bearerToken,
    fixture.volunteerName,
    fixture.volunteerEmail,
    fixture.volunteerPhone,
    fixture.emergencyName,
    fixture.emergencyPhone,
    fixture.privateAnswer,
    fixture.unrelatedTaskTitle,
    fixture.workspaceId,
    targetAssignmentId,
    tokenId,
    "token_verifier_hash",
    "bearer_token",
    "assignments.edit",
  ]) {
    assert(!visibleText.includes(forbidden), "The response page exposed non-public fixture data.");
  }

  const nonScriptBearerLocations = await page.evaluate((token) => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("script").forEach((element) => element.remove());
    return Array.from(clone.querySelectorAll("*"))
      .filter((element) => element.outerHTML.includes(token))
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        attributes: Array.from(element.attributes)
          .filter((attribute) => attribute.value.includes(token))
          .map((attribute) => attribute.name),
        text: element.childElementCount === 0 && element.textContent?.includes(token),
      }))
      .filter((location) => location.attributes.length > 0 || location.text);
  }, bearerToken);
  assert(
    nonScriptBearerLocations.length === 0,
    `The response page exposed the bearer in non-script markup (${nonScriptBearerLocations
      .map((location) => `${location.tag}:${location.attributes.join(",") || "text"}`)
      .join("; ")}).`,
  );

  const submittedFormState = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === "Confirm",
    );
    if (!(button instanceof HTMLButtonElement) || !(button.form instanceof HTMLFormElement)) {
      return null;
    }
    const formData = new FormData(button.form, button);
    return {
      response: formData.get("response"),
      note: formData.get("note"),
    };
  });
  assert(
    submittedFormState?.response === "confirmed" && submittedFormState.note === "",
    "The response form did not construct the expected confirmed payload.",
  );

  const readDatabaseState = () =>
    runPsql(
      containerName,
      `select concat_ws('|', response.response_status, response.response_source, (token.last_used_at is not null)::text)
from public.assignment_responses as response
join public.assignment_response_tokens as token
  on token.assignment_id = response.assignment_id
where response.assignment_id = '${targetAssignmentId}'::uuid
  and token.id = '${tokenId}'::uuid;`,
    );

  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  try {
    await page.getByText("Response saved", { exact: true }).waitFor({ timeout: 10_000 });
  } catch {
    const resultText = await page.locator("body").innerText();
    const routeState = [
      "This response changed.",
      "We couldn’t save that response.",
      "That response is no longer available.",
      "This link is expired or unavailable",
      "We couldn’t load this assignment",
    ].find((candidate) => resultText.includes(candidate));
    throw new Error(
      `The route did not reach success (state: ${routeState ?? "unknown"}; database: ${readDatabaseState() || "missing"}).`,
    );
  }
  await page.getByText("Your response is now Confirmed.", { exact: true }).waitFor();
  assert(browserErrors.length === 0, "The response route emitted a browser error.");

  const databaseState = readDatabaseState();
  assert(
    databaseState === "confirmed|public_token|true",
    "The route response was not persisted with the expected public-token state.",
  );
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
  assert(residue === "0", "Disposable QA fixture cleanup left local database rows behind.");
  cleanupCompleted = true;
}

async function main() {
  await verifyLocalPreflight();
  const containerName = await resolveLocalDatabaseContainer();

  try {
    const { targetAssignmentId, tokenId } = await createFixtures(containerName);
    await exerciseRoute(targetAssignmentId, tokenId, containerName);
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await cleanupFixtures(containerName);
  }

  assert(cleanupCompleted, "Disposable QA fixture cleanup did not complete.");
  console.log("Public assignment-response valid-token route QA passed.");
  console.log(
    "Created and removed disposable local Auth, workspace, grant, questionnaire, volunteer, task, Calendar, assignment, response, and token fixtures.",
  );
  console.log("No bearer, verifier, password, access token, or response URL was logged.");
}

main().catch((error) => {
  console.error(`Public response route QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
