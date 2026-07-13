import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
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
const secrets = new Set();

const fixture = {
  namespace: `qa-11-31-${randomUUID()}`,
  workspaceId: randomUUID(),
  workspaceName: "QA 11.31 Assignment Workspace",
  contactId: randomUUID(),
  grantId: randomUUID(),
  questionnaireId: randomUUID(),
  volunteerId: randomUUID(),
  volunteerName: "QA 11.31 Safe Volunteer",
  volunteerCongregation: "QA 11.31 Safe Congregation",
  volunteerEmail: `qa-11-31-volunteer-${randomUUID()}@example.invalid`,
  volunteerPhone: "+1 555 011 3131",
  emergencyName: "QA 11.31 Private Emergency Contact",
  emergencyPhone: "+1 555 011 3199",
  privateAnswer: "QA_11_31_PRIVATE_INTAKE_MARKER",
  taskPresetId: randomUUID(),
  taskTitle: "QA 11.31 Persisted Assignment Detail",
  calendarItemId: randomUUID(),
  assignmentId: randomUUID(),
  responseId: randomUUID(),
  unrelatedCalendarItemId: randomUUID(),
  unrelatedAssignmentId: randomUUID(),
  unrelatedResponseId: randomUUID(),
  unrelatedTitle: "QA 11.31 Unrelated Assignment Must Stay Hidden",
  missingAssignmentId: randomUUID(),
};

const authCookies = new Map();
let authClient = null;
let authUserId = null;
let browser = null;
let cleanupCompleted = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isLoopbackUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      ["127.0.0.1", "localhost", "[::1]", "::1"].includes(parsed.hostname)
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
  if (result.status !== 0) {
    throw new Error("The local assignment-detail browser fixture command failed.");
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
    "Local public Supabase environment values are missing.",
  );
  assert(isLoopbackUrl(supabaseUrl), "Assignment-detail browser QA accepts only local Supabase.");
  assert(
    isLoopbackUrl(previewBaseUrl),
    "Assignment-detail browser QA accepts only a loopback production preview.",
  );
  secrets.add(anonKey);

  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");

  let previewResponse;
  try {
    previewResponse = await fetch(
      createPreviewUrl(previewBaseUrl, `/admin/assignments/${fixture.missingAssignmentId}`),
      { redirect: "error" },
    );
  } catch {
    throw new Error(
      "The production preview is unavailable. Run `npm run build` and `npm run preview` before this QA command.",
    );
  }
  const previewText = await previewResponse.text();
  assert(
    previewResponse.ok && previewText.includes("Assignment unavailable"),
    "The running preview does not contain the persisted assignment-detail route.",
  );
}

async function createAuthenticatedContact() {
  const email = `qa-11-31-contact-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);

  authClient = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
    cookies: {
      getAll() {
        return Array.from(authCookies.values()).map(({ name, value }) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          if (cookie.value) authCookies.set(cookie.name, cookie);
          else authCookies.delete(cookie.name);
        }
      },
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });

  const signup = await authClient.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, "Disposable local Auth user creation failed.");
  authUserId = signup.data.user.id;
  let session = signup.data.session;
  if (!session) {
    const signin = await authClient.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, "Disposable local Auth sign-in failed.");
    session = signin.data.session;
  }
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  for (const cookie of authCookies.values()) secrets.add(cookie.value);
  assert(authCookies.size > 0, "Disposable Auth did not produce the SSR session cookie.");
}

async function createFixtures(containerName) {
  await createAuthenticatedContact();
  const answers = JSON.stringify({
    aboutYou: {
      name: fixture.volunteerName,
      email: fixture.volunteerEmail,
      phone: fixture.volunteerPhone,
      congregation: fixture.volunteerCongregation,
    },
    availability: { weekdays: ["Monday"] },
    skillsExperience: { categories: ["General"] },
    emergencyContact: {
      name: fixture.emergencyName,
      phone: fixture.emergencyPhone,
    },
    otherWaysToHelp: { notes: fixture.privateAnswer },
  });

  runPsql(containerName, `begin;
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, public_intake_enabled)
values (
  '${fixture.workspaceId}'::uuid,
  ${sqlText(fixture.namespace)},
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
  array['workspace.read', 'assignments.view', 'assignments.edit']::text[],
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
  ${sqlText(answers)}::jsonb
);
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, lifecycle, readiness_status, full_name,
  email, phone, congregation, availability_snapshot, skills_help_snapshot, profile_notes
) values (
  '${fixture.volunteerId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  '${fixture.questionnaireId}'::uuid,
  'active',
  'ready',
  ${sqlText(fixture.volunteerName)},
  ${sqlText(fixture.volunteerEmail)},
  ${sqlText(fixture.volunteerPhone)},
  ${sqlText(fixture.volunteerCongregation)},
  '{"weekdays":["Monday"]}'::jsonb,
  '{"skillsExperience":{"categories":["General"]}}'::jsonb,
  ''
);
insert into public.task_presets (
  id, workspace_id, name, task_type, default_needed_count, volunteer_visible,
  is_system_preset, custom_field_definitions, lifecycle
) values (
  '${fixture.taskPresetId}'::uuid,
  '${fixture.workspaceId}'::uuid,
  ${sqlText(fixture.taskTitle)},
  'general',
  3,
  true,
  false,
  '[]'::jsonb,
  'active'
);
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
  schedule_kind, start_date, start_time, end_time, timezone, needed_count,
  custom_values, lifecycle
) values
  (
    '${fixture.calendarItemId}'::uuid,
    '${fixture.workspaceId}'::uuid,
    '${fixture.taskPresetId}'::uuid,
    ${sqlText(fixture.taskTitle)},
    'general',
    'timed',
    '2031-07-15',
    '09:00:00',
    '11:30:00',
    'America/Denver',
    3,
    '{}'::jsonb,
    'active'
  ),
  (
    '${fixture.unrelatedCalendarItemId}'::uuid,
    '${fixture.workspaceId}'::uuid,
    null,
    ${sqlText(fixture.unrelatedTitle)},
    'general',
    'date_based',
    '2031-07-16',
    null,
    null,
    'America/Denver',
    1,
    '{}'::jsonb,
    'active'
  );
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, created_by_auth_user_id
) values
  (
    '${fixture.assignmentId}'::uuid,
    '${fixture.workspaceId}'::uuid,
    '${fixture.calendarItemId}'::uuid,
    '${fixture.volunteerId}'::uuid,
    'active',
    '${authUserId}'::uuid
  ),
  (
    '${fixture.unrelatedAssignmentId}'::uuid,
    '${fixture.workspaceId}'::uuid,
    '${fixture.unrelatedCalendarItemId}'::uuid,
    '${fixture.volunteerId}'::uuid,
    'active',
    '${authUserId}'::uuid
  );
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, responded_at, created_at, updated_at
) values
  (
    '${fixture.responseId}'::uuid,
    '${fixture.workspaceId}'::uuid,
    '${fixture.assignmentId}'::uuid,
    'confirmed',
    'project_contact',
    now(),
    now(),
    now()
  ),
  (
    '${fixture.unrelatedResponseId}'::uuid,
    '${fixture.workspaceId}'::uuid,
    '${fixture.unrelatedAssignmentId}'::uuid,
    'needs_response',
    'project_contact',
    null,
    now(),
    now()
  );
commit;`);
}

function browserCookieValues() {
  return Array.from(authCookies.values()).map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    url: previewBaseUrl,
  }));
}

async function assertNoHorizontalOverflow(page, stage) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${stage} has horizontal overflow.`,
  );
}

function isForbiddenResponseLinkNetworkRequest(request, options = {}) {
  const method = request.method().toUpperCase();
  const url = request.url();
  const lowerUrl = url.toLowerCase();

  if (
    lowerUrl.includes("/respond/") ||
    lowerUrl.includes("/admin/diagnostics/response-link")
  ) {
    return true;
  }

  if (
    /response-link|response_link|reveal|copy|bearer|verifier|audit|fullresponseurl|redactedresponseurl|responsetoken|tokenverifier/.test(
      lowerUrl,
    )
  ) {
    return true;
  }

  if (options.includeGenericTokenTerm && lowerUrl.includes("token")) {
    return true;
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    try {
      const parsedRequestUrl = new URL(url);
      const parsedPreviewUrl = new URL(previewBaseUrl);
      if (
        parsedRequestUrl.origin === parsedPreviewUrl.origin &&
        parsedRequestUrl.pathname.startsWith("/admin/assignments/")
      ) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

function assertNoForbiddenRequests(requests, startIndex, message) {
  const offending = requests.slice(startIndex);
  assert(offending.length === 0, message);
}

async function exerciseBrowserRoute() {
  browser = await chromium.launch(
    browserExecutable ? { executablePath: browserExecutable } : undefined,
  );

  const anonymousContext = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const anonymousPage = await anonymousContext.newPage();
  const anonymousNavigation = await anonymousPage.goto(
    createPreviewUrl(previewBaseUrl, `/admin/assignments/${fixture.assignmentId}`),
    { waitUntil: "domcontentloaded" },
  );
  assert(anonymousNavigation?.ok(), "The assignment-detail sign-in state did not load.");
  const anonymousText = await anonymousPage.locator("body").innerText();
  assert(anonymousText.includes("Assignment unavailable"), "The sign-in state is missing its calm heading.");
  assert(
    anonymousText.includes("Sign in as a project contact"),
    "The anonymous route did not offer project-contact sign-in.",
  );
  assert(!anonymousText.includes(fixture.taskTitle), "The sign-in state leaked assignment context.");
  await assertNoHorizontalOverflow(anonymousPage, "Desktop sign-in state");
  await anonymousContext.close();

  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await context.addCookies(browserCookieValues());
  const page = await context.newPage();
  const browserErrors = [];
  const forbiddenLoadRequests = [];
  const forbiddenInteractionRequests = [];
  page.on("pageerror", () => browserErrors.push("pageerror"));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push("console-error");
  });
  page.on("request", (request) => {
    if (isForbiddenResponseLinkNetworkRequest(request)) {
      forbiddenLoadRequests.push(`${request.method()} ${redact(request.url())}`);
    }
    if (isForbiddenResponseLinkNetworkRequest(request, { includeGenericTokenTerm: true })) {
      forbiddenInteractionRequests.push(`${request.method()} ${redact(request.url())}`);
    }
  });

  const navigation = await page.goto(
    createPreviewUrl(previewBaseUrl, `/admin/assignments/${fixture.assignmentId}`),
    { waitUntil: "domcontentloaded" },
  );
  assert(navigation?.ok(), "The authorized assignment-detail route did not load.");
  const visibleText = await page.locator("body").innerText();
  const visibleTextLower = visibleText.toLowerCase();

  for (const expected of [
    fixture.workspaceName,
    fixture.taskTitle,
    "Active assignment",
    "Scheduled time",
    "Jul 15, 2031",
    "9:00 AM",
    "11:30 AM",
    "America/Denver",
    fixture.volunteerName,
    fixture.volunteerCongregation,
    "Planned volunteers",
    "Confirmed",
    "Project contact",
    "Permission available",
    "Response link",
    "Link actions are not available yet.",
    "Assignment details are read-only here.",
    "future link would grant response access for this assignment",
    "will expire",
    "explicit click or tap",
    "Unavailable in this read-only shell",
    "No link is generated on page load.",
    "No email or reminder is sent from this page.",
    "The reviewed server-action seam is present but remains disabled here.",
    "A disabled action binding is present but cannot be submitted from this page.",
    "Manual copying will only be available after an audited success",
  ]) {
    assert(
      visibleTextLower.includes(expected.toLowerCase()),
      `The assignment detail is missing safe context: ${expected}.`,
    );
  }
  assert(
    visibleTextLower.includes("assignment reference") &&
      visibleTextLower.includes(fixture.assignmentId.slice(0, 8).toLowerCase()),
    "The assignment detail is missing its shortened assignment reference.",
  );

  for (const forbidden of [
    fixture.workspaceId,
    fixture.volunteerId,
    fixture.calendarItemId,
    fixture.unrelatedAssignmentId,
    fixture.unrelatedTitle,
    fixture.volunteerEmail,
    fixture.volunteerPhone,
    fixture.emergencyName,
    fixture.emergencyPhone,
    fixture.privateAnswer,
    "assignments.view",
    "assignments.edit",
    "workspace.read",
    "response_token_id",
    "response token id",
    "token_verifier_hash",
    "verifier",
    "token scope",
    "audit internals",
    "audit event",
    "credential",
    "[redacted]",
    "/respond/",
    "Copy response link",
    "Copy full link",
    "Generate link",
    "Reveal link",
    "Send reminder",
    "Email volunteer",
    "spots",
  ]) {
    assert(
      !visibleTextLower.includes(forbidden.toLowerCase()),
      "The assignment page exposed prohibited or unrelated context.",
    );
  }
  const pageHtml = await page.content();
  for (const secret of secrets) {
    assert(!pageHtml.includes(secret), "The assignment page HTML exposed a credential.");
  }
  for (const forbiddenHtml of [
    "<form",
    "formaction",
    'type="submit"',
    'type="hidden"',
    "data-assignment-id",
    "data-token-id",
    "data-audit-id",
    "data-response-url",
    "data-bearer",
    "data-verifier",
    "__next_action",
    "navigator.clipboard",
    "clipboard.writeText",
    "/respond/",
    "[redacted]",
    "responseUrl",
    "fullResponseUrl",
    "redactedResponseUrl",
    "responseTokenId",
    "tokenVerifierHash",
    "bearerToken",
    "rawBearer",
    "data-action-result",
    "data-result-state",
    "actionResult",
    "resultRenderer",
    "not_approved",
    "checklist_blocked",
    "malformed_input",
    "action_error",
  ]) {
    assert(
      !pageHtml.includes(forbiddenHtml),
      "The assignment page HTML exposed action, clipboard, or credential-bearing markup.",
    );
  }
  assert((await page.locator("button").count()) === 0, "The read-only route rendered an active button.");
  assert((await page.locator("form").count()) === 0, "The read-only route rendered a form.");
  assert(
    (await page.locator('input[type="hidden"], [formaction]').count()) === 0,
    "The read-only route rendered hidden action metadata.",
  );
  assert(
    (await page.locator('[action], [formaction], [data-assignment-id], [data-token-id], [data-audit-id], [data-response-url], [data-bearer], [data-verifier]').count()) === 0,
    "The read-only route rendered browser-discoverable action or credential metadata.",
  );
  assert(
    (await page.locator('[aria-disabled="true"]').count()) >= 1,
    "The inert response-link shell did not expose a disabled visual state.",
  );
  const responseLinkPanel = page
    .locator("div")
    .filter({ hasText: "Link actions are not available yet." })
    .last();
  assert(
    (await responseLinkPanel.count()) === 1,
    "The authorized route did not render exactly one response-link readiness panel.",
  );
  assert(
    (await responseLinkPanel.locator("form").count()) === 0,
    "The response-link panel rendered a form.",
  );
  assert(
    (await responseLinkPanel.locator("button").count()) === 0,
    "The response-link panel rendered a submit-capable button.",
  );
  assert(
    (await responseLinkPanel.locator('input, textarea, select, [formaction]').count()) === 0,
    "The response-link panel rendered browser-controlled action metadata.",
  );
  assert(
    (await responseLinkPanel.locator('[action], [formaction], [data-assignment-id], [data-token-id], [data-audit-id], [data-response-url], [data-bearer], [data-verifier]').count()) === 0,
    "The response-link panel exposed action or credential metadata.",
  );
  assert(
    (await page.locator('a[href^="/respond/"], a[href*="diagnostics/response-link"]').count()) === 0,
    "The read-only route linked to a response or diagnostic surface.",
  );
  assert(
    (await page.locator('[data-action-result], [data-result-state], [aria-live*="result"]').count()) === 0,
    "The read-only route rendered a response-link result state.",
  );
  assertNoForbiddenRequests(
    forbiddenLoadRequests,
    0,
    "Page load or hydration triggered response-link network traffic.",
  );
  const interactionStart = forbiddenInteractionRequests.length;
  const pageUrlBeforeInteraction = page.url();
  await responseLinkPanel.hover();
  await page.waitForTimeout(100);
  await responseLinkPanel.click({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(150);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(100);
  const activeElementSummary = await page.evaluate(() => {
    const activeElement = document.activeElement;
    if (!activeElement) return { interactive: false, text: "" };
    const tagName = activeElement.tagName.toLowerCase();
    const role = activeElement.getAttribute("role") ?? "";
    return {
      interactive:
        ["a", "button", "input", "select", "textarea"].includes(tagName) ||
        ["button", "link", "menuitem"].includes(role),
      text: activeElement.textContent ?? "",
    };
  });
  assert(
    !activeElementSummary.interactive || !/copy|submit|generate|reveal/i.test(activeElementSummary.text),
    "Tabbing exposed an active response-link submit or copy affordance.",
  );
  assert(
    page.url() === pageUrlBeforeInteraction,
    "Interacting with the disabled response-link panel navigated away.",
  );
  assertNoForbiddenRequests(
    forbiddenInteractionRequests,
    interactionStart,
    "Interacting with the disabled response-link panel triggered response-link network traffic.",
  );
  assert(browserErrors.length === 0, "The authorized assignment route emitted a browser error.");
  await assertNoHorizontalOverflow(page, "Desktop assignment detail");

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page, "Mobile assignment detail");

  const missingNavigation = await page.goto(
    createPreviewUrl(previewBaseUrl, `/admin/assignments/${fixture.missingAssignmentId}`),
    { waitUntil: "domcontentloaded" },
  );
  assert(missingNavigation?.ok(), "The authenticated unavailable state did not load.");
  const missingText = await page.locator("body").innerText();
  assert(missingText.includes("Assignment unavailable"), "The missing assignment lacks the calm unavailable state.");
  assert(
    missingText.includes("not available from your current project-contact access"),
    "The authenticated unavailable state has incorrect guidance.",
  );
  assert(!missingText.includes("Sign in as a project contact"), "The signed-in unavailable state offered redundant sign-in.");
  assert(!missingText.includes(fixture.taskTitle), "The unavailable state leaked target assignment context.");
  for (const forbiddenUnavailableCopy of [
    "Response link",
    "future link would grant response access",
    "Manual copying",
    "disabled action binding",
    "disabled result",
    "not approved",
    "checklist blocked",
    "malformed input",
    "action error",
    "reviewed server-action seam",
    "No link is generated",
  ]) {
    assert(
      !missingText.includes(forbiddenUnavailableCopy),
      "The unavailable state exposed response-link-specific capability details.",
    );
  }
  await assertNoHorizontalOverflow(page, "Mobile unavailable state");
  assert(browserErrors.length === 0, "The unavailable assignment route emitted a browser error.");
  await context.close();
}

async function cleanupFixtures(containerName) {
  if (authClient) await authClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  runPsql(containerName, `begin;
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
commit;`);
  const residue = runPsql(containerName, `select (
  (select count(*) from public.workspaces where workspace_key like 'qa-11-31-%') +
  (select count(*) from public.project_contacts where id = '${fixture.contactId}'::uuid) +
  (select count(*) from public.workspace_contact_grants where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.questionnaire_submissions where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.volunteer_profiles where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.calendar_items where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.calendar_assignments where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.assignment_responses where workspace_id = '${fixture.workspaceId}'::uuid)
  ${authUserId ? `+ (select count(*) from auth.users where id = '${authUserId}'::uuid) + (select count(*) from auth.identities where user_id = '${authUserId}'::uuid)` : ""}
)::text;`);
  assert(residue === "0", "Assignment-detail browser fixtures left local residue.");
  cleanupCompleted = true;
}

async function main() {
  await verifyLocalPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  try {
    await createFixtures(containerName);
    await exerciseBrowserRoute();
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await cleanupFixtures(containerName);
  }
  assert(cleanupCompleted, "Assignment-detail browser fixture cleanup did not complete.");
  console.log("Persisted assignment-detail browser QA passed.");
  console.log("Verified sign-in, safe success, unavailable, desktop/mobile overflow, and zero-residue behavior.");
  console.log("No credential, response URL, token metadata, sensitive intake value, or unrelated row was logged.");
}

main().catch((error) => {
  console.error(`Assignment-detail browser QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
