import nextEnv from "@next/env";
import { createBrowserClient } from "@supabase/ssr";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

import {
  createPreviewUrl,
  resolvePreviewBaseUrl,
  resolvePreviewBrowserExecutable,
} from "./preview-config.mjs";
import { buildWorkspaceAccessProvisioningSql } from "../lib/workspaces/provisioning.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const baseUrl = resolvePreviewBaseUrl();
const browserExecutable = resolvePreviewBrowserExecutable();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const writeReviewScreenshots = process.env.WRITE_TASKS_REVIEW_SCREENSHOTS === "1";
const reviewScreenshotDirectory = path.join(
  root,
  "docs",
  "previews",
  "iteration-12-37-tasks-review",
);
const secrets = new Set();
const authUserIds = [];
const authCookieSets = new Map();
let cleanupCompleted = false;

const fixture = {
  namespace: `qa-12-37-browser-${randomUUID()}`,
  workspaceKey: `qa-12-37-${randomUUID()}`,
  validFrom: "2026-07-01T00:00:00.000Z",
  initialPresetId: randomUUID(),
};

const values = writeReviewScreenshots
  ? {
      workspaceName: "Bozeman Local Project",
      initialTask: "Gate Attendant",
      desktopTask: "Material Staging",
      mobileTask: "Site Cleanup",
    }
  : {
      workspaceName: "QA 12.37 Tasks Workspace",
      initialTask: `${fixture.namespace} Gate Attendant`,
      desktopTask: `${fixture.namespace} Material Staging`,
      mobileTask: `${fixture.namespace} Site Cleanup`,
    };

const seedPresets = writeReviewScreenshots
  ? [
      {
        id: fixture.initialPresetId,
        name: values.initialTask,
        description: "Welcome arriving volunteers and direct them to the project check-in area.",
        taskType: "general",
        neededCount: 2,
        volunteerVisible: true,
        lifecycle: "active",
      },
      {
        id: randomUUID(),
        name: "Drywall Crew",
        description: "Install and finish drywall in the east building work area.",
        taskType: "general",
        neededCount: 6,
        volunteerVisible: true,
        lifecycle: "active",
      },
      {
        id: randomUUID(),
        name: "Welcome Desk",
        description: "Check in volunteers and help them find their assigned team.",
        taskType: "general",
        neededCount: 3,
        volunteerVisible: true,
        lifecycle: "active",
      },
      {
        id: randomUUID(),
        name: "Lunch Support",
        description: "Set up the serving area and assist with project lunch service.",
        taskType: "food",
        neededCount: 4,
        volunteerVisible: true,
        lifecycle: "active",
      },
      {
        id: randomUUID(),
        name: "Evening Security",
        description: "Monitor the project entrance during the evening work session.",
        taskType: "security",
        neededCount: 2,
        volunteerVisible: true,
        lifecycle: "active",
      },
      {
        id: randomUUID(),
        name: "Tool Check-out",
        description: "Track shared tools as crews collect and return equipment.",
        taskType: "custom",
        neededCount: 2,
        volunteerVisible: false,
        lifecycle: "active",
      },
      {
        id: randomUUID(),
        name: "Parking Team",
        description: "Guide vehicles into the designated volunteer parking area.",
        taskType: "general",
        neededCount: 4,
        volunteerVisible: true,
        lifecycle: "active",
      },
      {
        id: randomUUID(),
        name: "Sign-in Tent",
        description: "Previous check-in setup retained for operational reference.",
        taskType: "general",
        neededCount: 2,
        volunteerVisible: true,
        lifecycle: "archived",
      },
    ]
  : [
      {
        id: fixture.initialPresetId,
        name: values.initialTask,
        description: "Welcome arriving volunteers.",
        taskType: "general",
        neededCount: 2,
        volunteerVisible: true,
        lifecycle: "active",
      },
    ];

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
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]");
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
    throw new Error(redact(result.stderr || "The local Tasks browser fixture command failed."));
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
    "Local Supabase is unavailable. Start the disposable local stack before browser QA.",
  );
  return containerName;
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
  assert(!signup.error && signup.data.user, `Disposable Auth creation failed for ${label}.`);
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Disposable Auth sign-in failed for ${label}.`);
    session = signin.data.session;
  }
  secrets.add(session.access_token);
  secrets.add(session.refresh_token);
  authUserIds.push(signup.data.user.id);
  assert(cookieJar.size > 0, `Disposable Auth did not produce SSR cookies for ${label}.`);
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

function provisioningInput(authUserId, capabilities, role = "main_contact") {
  return {
    workspace: {
      key: fixture.workspaceKey,
      displayName: values.workspaceName,
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

function seedWorkspace(containerName, editorUserId, viewOnlyUserId) {
  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput(editorUserId, [
        "workspace.read",
        "tasks.view",
        "tasks.edit",
        "calendar.view",
        "calendar.edit",
        "assignments.view",
      ]),
    ),
  );
  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput(
        viewOnlyUserId,
        ["workspace.read", "tasks.view"],
        "assistant_contact",
      ),
    ),
  );
  runPsql(
    containerName,
    `insert into public.task_presets (
  id, workspace_id, name, description, task_type, default_needed_count, volunteer_visible,
  is_system_preset, custom_field_definitions, lifecycle
)
values
${seedPresets
  .map(
    (preset) =>
      `(${sqlText(preset.id)}::uuid,
  (select id from public.workspaces where workspace_key = ${sqlText(fixture.workspaceKey)}),
  ${sqlText(preset.name)}, ${sqlText(preset.description)}, ${sqlText(preset.taskType)},
  ${preset.neededCount}, ${preset.volunteerVisible}, false, '[]'::jsonb,
  ${sqlText(preset.lifecycle)})`,
  )
  .join(",\n")};`,
  );
}

async function captureReviewScreenshot(page, filename) {
  if (!writeReviewScreenshots) return;
  await mkdir(reviewScreenshotDirectory, { recursive: true });
  await page.screenshot({
    animations: "disabled",
    fullPage: false,
    path: path.join(reviewScreenshotDirectory, filename),
  });
}

async function openTasksPage(context) {
  const page = await context.newPage();
  const failures = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  const response = await page.goto(createPreviewUrl(baseUrl, "/admin/tasks"), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assert(response?.ok(), `Tasks route returned ${response?.status() ?? "no response"}.`);
  await page.getByRole("heading", { name: "Tasks", exact: true }).waitFor();
  return { page, failures };
}

async function createTaskThroughUi(page, name, count = "3") {
  await page.getByRole("button", { name: "New task", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.waitFor();
  await dialog.getByLabel("Task name").fill(name);
  await dialog.getByLabel("Category").selectOption("general");
  await dialog.getByLabel("Volunteers needed").fill(count);
  await dialog.getByLabel(/Description/).fill("Created through the persisted Tasks route.");
  await Promise.all([
    page.waitForURL(/notice=created/),
    dialog.getByRole("button", { name: "Save task" }).click(),
  ]);
  await page.getByText("Task created", { exact: true }).waitFor();
  await page.getByText(name, { exact: true }).first().waitFor();
}

async function archiveSelectedTask(page, name) {
  const detail = page.getByRole("dialog", { name: "Task details" });
  if (!(await detail.isVisible())) {
    await page.getByText(name, { exact: true }).first().click();
  }
  const surface = (await detail.isVisible()) ? detail : page.locator("aside").filter({ hasText: name });
  await surface.getByRole("button", { name: "Archive task", exact: true }).click();
  await surface.getByText("Archive this task?", { exact: true }).waitFor();
  await surface.getByText("Existing scheduled items won’t be changed.", { exact: true }).waitFor();
  await Promise.all([
    page.waitForURL(/notice=archived/),
    surface.getByRole("button", { name: "Archive task", exact: true }).click(),
  ]);
  await page.getByText("Task archived", { exact: true }).waitFor();
}

async function assertCalendarPresetOption(page, taskName, expected) {
  const response = await page.goto(createPreviewUrl(baseUrl, "/admin/calendar"), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assert(response?.ok(), `Calendar route returned ${response?.status() ?? "no response"}.`);
  await page.getByRole("heading", { name: "Calendar", exact: true }).waitFor();
  await page.getByRole("button", { name: "Create item", exact: true }).click();
  await page.getByRole("heading", { name: "Plan project work", exact: true }).waitFor();
  await page.getByRole("button", { name: "Task preset", exact: true }).click();
  const presetSelect = page.locator('select[aria-label="Task preset"]:visible');
  await presetSelect.waitFor();
  const options = await presetSelect.locator("option").allTextContents();
  assert.equal(
    options.includes(taskName),
    expected,
    `${taskName} Calendar selector state mismatch; synthetic options: ${options.join(" | ")}.`,
  );
  await page
    .getByRole("button", { name: "Close project work planner", exact: true })
    .click();
}

async function verifyDesktop(browser) {
  const context = await browser.newContext({
    viewport: writeReviewScreenshots
      ? { width: 1440, height: 1000 }
      : { width: 1280, height: 900 },
  });
  await applyAuthCookies(context, "editor");
  const { page, failures } = await openTasksPage(context);
  await page.getByText(values.initialTask, { exact: true }).first().waitFor();
  assert.equal(await page.getByText("Site Preparation", { exact: true }).count(), 0);
  await page.getByText(values.initialTask, { exact: true }).first().click();
  await page.locator("aside").getByRole("heading", { name: values.initialTask }).waitFor();
  await captureReviewScreenshot(page, "tasks-desktop-library-1440x1000.png");

  if (writeReviewScreenshots) {
    await page.getByRole("button", { name: "New task", exact: true }).first().click();
    const newTaskDialog = page.getByRole("dialog", { name: "New task" });
    await newTaskDialog.waitFor();
    await captureReviewScreenshot(page, "tasks-desktop-new-task-1440x1000.png");
    await newTaskDialog.getByRole("button", { name: "Close new task", exact: true }).click();
  }

  await createTaskThroughUi(page, values.desktopTask);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText(values.desktopTask, { exact: true }).first().waitFor();
  await assertCalendarPresetOption(page, values.desktopTask, true);

  await page.goto(createPreviewUrl(baseUrl, "/admin/tasks"), { waitUntil: "domcontentloaded" });
  await archiveSelectedTask(page, values.desktopTask);
  await page.getByPlaceholder("Search tasks").fill(values.desktopTask);
  await page.getByText("No matching tasks", { exact: true }).waitFor();
  await assertCalendarPresetOption(page, values.desktopTask, false);

  assert.deepEqual(failures, []);
  await context.close();

  const viewOnlyContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyAuthCookies(viewOnlyContext, "viewOnly");
  const { page: viewPage, failures: viewFailures } = await openTasksPage(viewOnlyContext);
  await viewPage.getByText(values.initialTask, { exact: true }).first().waitFor();
  await viewPage.getByText("View only", { exact: true }).waitFor();
  assert.equal(await viewPage.getByRole("button", { name: "New task", exact: true }).count(), 0);
  assert.equal(await viewPage.getByRole("button", { name: "Archive task", exact: true }).count(), 0);
  assert.deepEqual(viewFailures, []);
  await viewOnlyContext.close();
}

async function verifyMobile(browser) {
  const context = await browser.newContext({
    viewport: writeReviewScreenshots ? { width: 390, height: 844 } : { width: 390, height: 900 },
  });
  await applyAuthCookies(context, "editor");
  const { page, failures } = await openTasksPage(context);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "390px Tasks route has horizontal overflow.",
  );
  await captureReviewScreenshot(page, "tasks-mobile-library-390x844.png");

  if (writeReviewScreenshots) {
    await page.getByText(values.initialTask, { exact: true }).first().click();
    const reviewDetail = page.getByRole("dialog", { name: "Task details" });
    await reviewDetail.waitFor();
    await captureReviewScreenshot(page, "tasks-mobile-detail-390x844.png");
    await reviewDetail
      .getByRole("button", { name: "Close task details", exact: true })
      .click();

    await page.getByRole("button", { name: "New task", exact: true }).first().click();
    const reviewNewTask = page.getByRole("dialog", { name: "New task" });
    await reviewNewTask.waitFor();
    await captureReviewScreenshot(page, "tasks-mobile-new-task-390x844.png");
    await reviewNewTask.getByRole("button", { name: "Close new task", exact: true }).click();
  }

  await createTaskThroughUi(page, values.mobileTask, "2");
  await page.getByText(values.mobileTask, { exact: true }).first().click();
  const detail = page.getByRole("dialog", { name: "Task details" });
  await detail.waitFor();
  await detail.getByText("Volunteer visibility", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "390px task inspector has horizontal overflow.",
  );
  await archiveSelectedTask(page, values.mobileTask);
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "390px archive result has horizontal overflow.",
  );
  assert.deepEqual(failures, []);
  await context.close();

  const viewOnlyContext = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await applyAuthCookies(viewOnlyContext, "viewOnly");
  const { page: viewPage, failures: viewFailures } = await openTasksPage(viewOnlyContext);
  await viewPage.getByText(values.initialTask, { exact: true }).first().click();
  const viewDetail = viewPage.getByRole("dialog", { name: "Task details" });
  await viewDetail.waitFor();
  assert.equal(await viewDetail.getByRole("button", { name: "Archive task" }).count(), 0);
  assert.equal(await viewPage.getByRole("button", { name: "New task" }).count(), 0);
  assert.equal(
    await viewPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "390px view-only Tasks route has horizontal overflow.",
  );
  assert.deepEqual(viewFailures, []);
  await viewOnlyContext.close();
}

async function verifyReadyEmpty(browser, containerName) {
  if (!writeReviewScreenshots) return;
  runPsql(
    containerName,
    `delete from public.task_presets
where workspace_id = (
  select id from public.workspaces where workspace_key = ${sqlText(fixture.workspaceKey)}
);`,
  );

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await applyAuthCookies(context, "editor");
  const { page, failures } = await openTasksPage(context);
  const emptyHeading = page.getByText("No reusable tasks yet", { exact: true });
  await emptyHeading.waitFor();
  assert.equal(
    await page.getByText("Choose a task to review its reusable defaults.", { exact: true }).count(),
    0,
    "The ready-empty Tasks state must not render the desktop inspector placeholder.",
  );
  const emptyWorkspace = emptyHeading.locator("xpath=ancestor::section");
  const emptyWorkspaceBox = await emptyWorkspace.boundingBox();
  assert(
    emptyWorkspaceBox && emptyWorkspaceBox.width >= 900,
    "The ready-empty Tasks workspace must use the available desktop width.",
  );
  await captureReviewScreenshot(page, "tasks-desktop-empty-1440x1000.png");
  assert.deepEqual(failures, []);
  await context.close();
}

function cleanup(containerName) {
  const authIds = authUserIds.map((id) => `${sqlText(id)}::uuid`).join(", ");
  const workspaceScope = `(select id from public.workspaces where workspace_key = ${sqlText(
    fixture.workspaceKey,
  )})`;
  runPsql(
    containerName,
    `begin;
delete from public.assignment_responses where workspace_id in ${workspaceScope};
delete from public.calendar_assignments where workspace_id in ${workspaceScope};
delete from public.calendar_items where workspace_id in ${workspaceScope};
delete from public.task_presets where workspace_id in ${workspaceScope};
delete from public.workspace_contact_grants where workspace_id in ${workspaceScope};
delete from public.project_contacts where auth_user_id in (${authIds});
delete from public.workspaces where workspace_key = ${sqlText(fixture.workspaceKey)};
delete from auth.users where id in (${authIds});
commit;`,
  );
  const residue = runPsql(
    containerName,
    `select
  (select count(*) from public.workspaces where workspace_key = ${sqlText(fixture.workspaceKey)}) +
  (select count(*) from public.task_presets where name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from auth.users where email like ${sqlText(
    `${fixture.namespace}-%@example.invalid`,
  )});`,
  );
  assert.equal(residue, "0", `Tasks browser cleanup left residue count ${residue}.`);
  cleanupCompleted = true;
}

let containerName;
try {
  assert(supabaseUrl && anonKey, "Local Supabase environment values are required.");
  assert(isLoopbackUrl(supabaseUrl), "Tasks browser QA accepts only local Supabase.");
  assert(isLoopbackUrl(baseUrl), "Tasks browser QA accepts only a loopback preview.");
  secrets.add(anonKey);
  const preview = await fetch(createPreviewUrl(baseUrl, "/admin/tasks"), { redirect: "manual" });
  assert(preview.status < 500, `Tasks preview is unavailable at ${baseUrl}.`);

  containerName = await resolveLocalDatabaseContainer();
  const editorUserId = await createAuthenticatedContact("editor");
  const viewOnlyUserId = await createAuthenticatedContact("viewOnly");
  seedWorkspace(containerName, editorUserId, viewOnlyUserId);

  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await verifyDesktop(browser);
    await verifyMobile(browser);
    await verifyReadyEmpty(browser, containerName);
  } finally {
    await browser.close();
  }
  console.log("Tasks management browser validation passed.");
  console.log(
    "Confirmed persisted desktop/mobile create, inspector, archive confirmation, view-only state, Calendar selector integration, and 390px width.",
  );
  if (writeReviewScreenshots) {
    console.log(`Tasks visual-review screenshots written to ${reviewScreenshotDirectory}.`);
  }
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
} finally {
  if (containerName) {
    try {
      cleanup(containerName);
    } catch (cleanupError) {
      console.error(redact(cleanupError));
      process.exitCode = 1;
    }
  }
  if (!cleanupCompleted) process.exitCode = 1;
}
