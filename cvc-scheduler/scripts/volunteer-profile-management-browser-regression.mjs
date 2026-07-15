import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";
import {
  buildWorkspaceAccessProvisioningSql,
  bozemanBetaCapabilitySets,
} from "../lib/workspaces/provisioning.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();
const authUserIds = [];
const authCookieSets = new Map();
let cleanupCompleted = false;

const fixture = {
  namespace: `qa-12-15-browser-${randomUUID()}`,
  validFrom: "2026-07-01T00:00:00.000Z",
};

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname);
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
  return message.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]");
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
    throw new Error(redact(result.stderr || "The local volunteer browser SQL command failed."));
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
    "Local Supabase is unavailable. Start it with output redirected/redacted before browser validation.",
  );
  return containerName;
}

async function applyManualVolunteerMigration(containerName) {
  const migration = await readFile(
    path.join(root, "supabase", "migrations", "20260714121500_manual_volunteer_profiles.sql"),
    "utf8",
  );
  runPsql(containerName, migration);
}

async function createAuthenticatedContact(label) {
  const email = `${fixture.namespace}-${label}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const cookieJar = new Map();
  secrets.add(email);
  secrets.add(password);

  const client = createBrowserClient(supabaseUrl, anonKey, {
    isSingleton: false,
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
      detectSessionInUrl: false,
      persistSession: true,
    },
  });

  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, "Disposable Auth user creation failed.");
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, "Disposable Auth sign-in failed.");
    session = signin.data.session;
  }
  authUserIds.push(signup.data.user.id);
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  for (const cookie of cookieJar.values()) secrets.add(cookie.value);
  assert(cookieJar.size > 0, "Disposable Auth did not produce SSR cookies.");
  authCookieSets.set(label, cookieJar);
  return signup.data.user.id;
}

async function applyAuthCookies(context, label) {
  const cookieJar = authCookieSets.get(label);
  assert(cookieJar?.size > 0, `Missing auth cookies for ${label}.`);
  const target = new URL(baseUrl);
  await context.addCookies(
    Array.from(cookieJar.values()).map((cookie) => ({
      domain: target.hostname,
      httpOnly: false,
      name: cookie.name,
      path: "/",
      sameSite: "Lax",
      secure: target.protocol === "https:",
      value: cookie.value,
    })),
  );
}

function provisioningInput({ key, displayName, authUserId, capabilities, role = "main_contact" }) {
  return {
    workspace: {
      key,
      displayName,
      lifecycle: "active",
      timezone: "America/Denver",
      startsOn: "2026-08-01",
      endsOn: "2026-12-31",
      publicIntakeEnabled: false,
    },
    contact: { authUserId, status: "active" },
    grant: {
      role,
      capabilities,
      status: "active",
      validFrom: fixture.validFrom,
      validUntil: null,
    },
  };
}

async function openVolunteersPage(context) {
  const page = await context.newPage();
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  const response = await page.goto(createPreviewUrl(baseUrl, "/admin/volunteers"), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assert(response?.ok(), `Volunteers route returned ${response?.status() ?? "no response"}`);
  await page.getByRole("heading", { name: "Project Volunteers" }).waitFor();
  return { page, failures };
}

async function run() {
  assert(supabaseUrl && anonKey, "Local Supabase env values are required.");
  assert(isLoopbackUrl(supabaseUrl), "Volunteer browser QA accepts only local Supabase.");
  assert(isLoopbackUrl(baseUrl), "Volunteer browser QA accepts only a loopback production preview.");
  secrets.add(anonKey);

  const preview = await fetch(createPreviewUrl(baseUrl, "/admin/volunteers"), {
    redirect: "manual",
  });
  assert(
    preview.status < 500,
    `Volunteer preview is unavailable at ${baseUrl}. Start npm run preview with logs redirected.`,
  );

  const containerName = await resolveLocalDatabaseContainer();
  await applyManualVolunteerMigration(containerName);
  const fullUserId = await createAuthenticatedContact("full");
  const viewOnlyUserId = await createAuthenticatedContact("view-only");
  const targetKey = `${fixture.namespace}-target`;

  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput({
        key: targetKey,
        displayName: "QA 12.15 Browser Workspace",
        authUserId: fullUserId,
        capabilities: bozemanBetaCapabilitySets.mainScheduler,
      }),
    ),
  );
  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput({
        key: targetKey,
        displayName: "QA 12.15 Browser Workspace",
        authUserId: viewOnlyUserId,
        capabilities: ["workspace.read", "volunteers.view"],
        role: "assistant_contact",
      }),
    ),
  );

  const browser = await chromium.launch({
    executablePath: browserExecutable,
    headless: true,
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await applyAuthCookies(context, "full");
    const { page, failures } = await openVolunteersPage(context);
    await page.getByText("No volunteers yet").waitFor();
    await page.getByText("Add volunteer").click();
    await page.getByLabel("Full name").first().fill(`${fixture.namespace} Browser Volunteer`);
    await page.getByLabel("Email").first().fill(`${fixture.namespace}-browser@example.invalid`);
    await page.getByLabel("Phone").first().fill("406-555-9090");
    await page.getByLabel("Congregation").first().fill("Bozeman");
    await page.getByLabel("Preferred contact").first().selectOption("Email");
    await Promise.all([
      page.waitForURL(/notice=created/),
      page.getByRole("button", { name: "Save volunteer" }).click(),
    ]);
    await page.getByText(`${fixture.namespace} Browser Volunteer`).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(`${fixture.namespace} Browser Volunteer`).waitFor();
    await page.getByText("Edit volunteer").click();
    const editDetails = page.locator("details").filter({ hasText: "Edit volunteer" }).first();
    await editDetails.getByLabel("Full name").fill(`${fixture.namespace} Browser Edited`);
    await Promise.all([
      page.waitForURL(/notice=updated/),
      editDetails.getByRole("button", { name: "Save changes" }).click(),
    ]);
    await page.getByText(`${fixture.namespace} Browser Edited`).waitFor();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(`${fixture.namespace} Browser Edited`).waitFor();
    assert.equal(await page.getByText("Alex Rivera").count(), 0, "mock volunteer leaked");
    assert.deepEqual(failures, []);
    await context.close();

    const viewContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
    await applyAuthCookies(viewContext, "view-only");
    const { page: viewPage, failures: viewFailures } = await openVolunteersPage(viewContext);
    await viewPage.getByText(`${fixture.namespace} Browser Edited`).waitFor();
    await viewPage.getByText("Volunteer profile editing is unavailable").first().waitFor();
    assert.equal(await viewPage.getByRole("button", { name: "Save volunteer" }).count(), 0);
    const overflow = await viewPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, "390px Volunteers route has horizontal overflow");
    assert.deepEqual(viewFailures, []);
    await viewContext.close();
  } finally {
    await browser.close();
  }

  console.log("Volunteer profile management browser validation passed.");
  console.log("Confirmed persisted Add/Edit/reload, view-only state, mobile width, and no mock leakage.");
}

async function cleanup(containerName) {
  const authIdArray =
    authUserIds.length > 0
      ? authUserIds.map((id) => `${sqlText(id)}::uuid`).join(", ")
      : "'00000000-0000-4000-8000-000000000000'::uuid";
  const authDeletes = authUserIds
    .map((id) => `delete from auth.users where id = ${sqlText(id)}::uuid;`)
    .join("\n");
  const residue = runPsql(
    containerName,
    `begin;
delete from public.volunteer_profiles where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.questionnaire_submissions where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)});
delete from public.workspace_contact_grants
where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)})
or project_contact_id in (select id from public.project_contacts where auth_user_id = any(array[${authIdArray}]));
delete from public.project_contacts where auth_user_id = any(array[${authIdArray}]);
delete from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)};
${authDeletes}
commit;
select (
  (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${authIdArray}])) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}-%@example.invalid`)})
)::text;`,
  );
  assert.equal(residue, "0", `Volunteer browser cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

let containerName;
try {
  containerName = await resolveLocalDatabaseContainer();
  await run();
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
} finally {
  if (containerName) {
    try {
      await cleanup(containerName);
    } catch (cleanupError) {
      console.error(redact(cleanupError));
      process.exitCode = 1;
    }
  }
  if (!cleanupCompleted) process.exitCode = 1;
}
