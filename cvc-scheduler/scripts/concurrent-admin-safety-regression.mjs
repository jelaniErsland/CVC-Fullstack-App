import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { createBrowserClient } from "@supabase/ssr";
import { chromium } from "playwright";
import { resolvePreviewBaseUrl, resolvePreviewBrowserExecutable } from "./preview-config.mjs";

const root = process.cwd();
const fixture = {
  namespace: `qa-12-46a-${randomUUID()}`,
  workspaceId: randomUUID(),
  presetId: randomUUID(),
  mealPresetId: randomUUID(),
  volunteerId: randomUUID(),
  contacts: [randomUUID(), randomUUID()],
  grants: [randomUUID(), randomUUID()],
  items: {
    edit: randomUUID(),
    assignment: randomUUID(),
    archive: randomUUID(),
    meal: randomUUID(),
  },
};
const authUserIds = [];

function command(name, args, options = {}) {
  return spawnSync(name, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function localStatus() {
  const result = process.platform === "win32"
    ? command("powershell.exe", ["-NoProfile", "-Command", "npx supabase status --output json"])
    : command("npx", ["supabase", "status", "--output", "json"]);
  assert.equal(result.status, 0, "Local Supabase must be running.");
  const start = result.stdout.indexOf("{");
  assert(start >= 0, "Local Supabase status did not return JSON.");
  const status = JSON.parse(result.stdout.slice(start));
  assert.match(status.API_URL, /^http:\/\/(127\.0\.0\.1|localhost):/);
  return status;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function runSql(sql) {
  const result = command("docker", [
    "exec", "-i", "supabase_db_cvc-scheduler", "psql", "--no-psqlrc", "-X",
    "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
  ], { input: sql });
  assert.equal(result.status, 0, result.stderr.slice(0, 1000));
  return result.stdout.trim();
}

function queryOne(sql) {
  const output = runSql(`select row_to_json(result)::text from (${sql}) result;`);
  assert(output, "Expected one fixture row.");
  return JSON.parse(output);
}

async function createAdmin(status, index) {
  const cookieJar = new Map();
  const client = createBrowserClient(status.API_URL, status.ANON_KEY, {
    isSingleton: false,
    cookies: {
      getAll: () => [...cookieJar.values()].map(({ name, value }) => ({ name, value })),
      setAll: (cookies) => cookies.forEach((cookie) => cookie.value ? cookieJar.set(cookie.name, cookie) : cookieJar.delete(cookie.name)),
    },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true },
  });
  const email = `${fixture.namespace}-${index}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, `Local admin ${index} signup failed.`);
  if (!signup.data.session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Local admin ${index} sign-in failed.`);
  }
  authUserIds.push(signup.data.user.id);
  assert(cookieJar.size > 0, `Local admin ${index} did not receive SSR auth cookies.`);
  return { client, userId: signup.data.user.id, cookieJar };
}

async function captureConflictUx(admin) {
  const baseUrl = resolvePreviewBaseUrl();
  const target = new URL(baseUrl);
  assert(["127.0.0.1", "localhost"].includes(target.hostname), "Conflict captures accept only a local preview.");
  const output = path.resolve(root, "..", "previews", "12.46a-concurrent-admin-safety");
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: resolvePreviewBrowserExecutable(), headless: true });
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 } });
      await context.route("**/*", (route) => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
      await context.addCookies([...admin.cookieJar.values()].map((cookie) => ({
        domain: target.hostname,
        httpOnly: false,
        name: cookie.name,
        path: "/",
        sameSite: "Lax",
        secure: target.protocol === "https:",
        value: cookie.value,
      })));
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      const suffix = width === 390 ? "mobile-390" : "desktop";
      const calendarRoute = width === 390
        ? "/admin/calendar?view=week&date=2026-10-01&notice=conflict"
        : `/admin/calendar?view=week&date=2026-10-01&item=${fixture.items.edit}&section=details&notice=conflict`;
      await page.goto(new URL(calendarRoute, baseUrl).href, { waitUntil: "networkidle" });
      await page.getByText("This item changed while you were editing it. Review the latest version.", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      await page.screenshot({ path: path.join(output, `calendar-edit-conflict-${suffix}.png`), fullPage: false, animations: "disabled" });
      await page.goto(new URL(`/admin/tasks?preset=${fixture.presetId}&notice=conflict`, baseUrl).href, { waitUntil: "networkidle" });
      await page.getByText("This item changed while you were editing it. Review the latest version.", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
      await page.screenshot({ path: path.join(output, `task-preset-edit-conflict-${suffix}.png`), fullPage: false, animations: "disabled" });
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

function insertFixtures(admins) {
  const capabilities = "array['workspace.read','calendar.view','calendar.edit','assignments.view','assignments.edit','volunteers.view','volunteers.edit','tasks.view','tasks.edit']::text[]";
  runSql(`
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on, public_intake_enabled)
values (${sqlUuid(fixture.workspaceId)}, ${sqlText(fixture.namespace)}, 'Concurrent admin QA', 'active', 'America/Denver', '2026-09-01', '2026-12-31', false);
insert into public.project_contacts (id, auth_user_id, status) values
  (${sqlUuid(fixture.contacts[0])}, ${sqlUuid(admins[0].userId)}, 'active'),
  (${sqlUuid(fixture.contacts[1])}, ${sqlUuid(admins[1].userId)}, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from)
values
  (${sqlUuid(fixture.grants[0])}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.contacts[0])}, 'main_contact', ${capabilities}, 'active', clock_timestamp() - interval '1 day'),
  (${sqlUuid(fixture.grants[1])}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.contacts[1])}, 'assistant_contact', ${capabilities}, 'active', clock_timestamp() - interval '1 day');
insert into public.task_presets (id, workspace_id, name, task_type, default_needed_count, volunteer_visible, color_key)
values (${sqlUuid(fixture.presetId)}, ${sqlUuid(fixture.workspaceId)}, 'Concurrent preset', 'general', 2, true, 'blue');
insert into public.task_presets (id, workspace_id, name, task_type, default_needed_count, volunteer_visible, is_system_preset, system_key, color_key)
values (${sqlUuid(fixture.mealPresetId)}, ${sqlUuid(fixture.workspaceId)}, 'Breakfast', 'food', 1, true, true, 'breakfast', 'orange');
insert into public.calendar_items (
  id, workspace_id, title_snapshot, task_type_snapshot, schedule_kind, start_date,
  start_time, end_time, timezone, needed_count, lifecycle, created_by_project_contact_id,
  publication_state, published_at, published_by_project_contact_id
)
values
  (${sqlUuid(fixture.items.edit)}, ${sqlUuid(fixture.workspaceId)}, 'Concurrent item', 'general', 'timed', '2026-10-01', '08:00', '10:00', 'America/Denver', 2, 'active', ${sqlUuid(fixture.contacts[0])}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts[0])}),
  (${sqlUuid(fixture.items.assignment)}, ${sqlUuid(fixture.workspaceId)}, 'Assignment item', 'general', 'timed', '2026-10-02', '08:00', '10:00', 'America/Denver', 2, 'active', ${sqlUuid(fixture.contacts[0])}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts[0])}),
  (${sqlUuid(fixture.items.archive)}, ${sqlUuid(fixture.workspaceId)}, 'Archive item', 'general', 'timed', '2026-10-03', '08:00', '10:00', 'America/Denver', 2, 'active', ${sqlUuid(fixture.contacts[0])}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts[0])});
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, start_time, end_time, timezone, needed_count, lifecycle,
  created_by_project_contact_id, publication_state, published_at,
  published_by_project_contact_id, meal_kind, meal_total, meal_provider
)
values (${sqlUuid(fixture.items.meal)}, ${sqlUuid(fixture.workspaceId)}, ${sqlUuid(fixture.mealPresetId)}, 'Breakfast', 'food', 'timed',
  '2026-10-04', '07:00', '08:00', 'America/Denver', 0, 'active',
  ${sqlUuid(fixture.contacts[0])}, 'published', clock_timestamp(), ${sqlUuid(fixture.contacts[0])},
  'breakfast', 50, 'Original provider');
`);
}

async function createVolunteer(client) {
  const result = await client.rpc("create_manual_volunteer_profile", {
    p_workspace_id: fixture.workspaceId,
    p_full_name: "Concurrent Volunteer",
    p_email: `${fixture.namespace}-volunteer@example.invalid`,
    p_phone: null,
    p_congregation: null,
    p_preferred_contact_method: "Email",
    p_profile_notes: null,
    p_readiness_status: "ready",
  });
  assert(!result.error && typeof result.data === "string");
  fixture.volunteerId = result.data;
}

function calendarUpdate(client, itemId, expectedUpdatedAt, title) {
  return client.rpc("update_calendar_item_one_off_timed", {
    p_calendar_item_id: itemId,
    p_one_off_title: title,
    p_one_off_task_type: "general",
    p_start_date: "2026-10-01",
    p_start_time: "08:00",
    p_end_time: "10:00",
    p_needed_count: 2,
    p_schedule_notes: null,
    p_custom_values: {},
    p_expected_updated_at: expectedUpdatedAt,
  });
}

function assertOneConflict(results, conflictDetail) {
  const successful = results.filter((result) => !result.error);
  const conflicted = results.filter(
    (result) => result.error?.code === "40001" && result.error?.details === conflictDetail,
  );
  assert.equal(successful.length, 1, "Exactly one concurrent edit must persist.");
  assert.equal(conflicted.length, 1, "Exactly one stale concurrent edit must report conflict.");
}

function cleanup() {
  runSql(`
delete from public.assignment_responses where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.calendar_assignments where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.volunteer_profiles where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.calendar_items where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.task_presets where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.workspace_contact_grants where workspace_id = ${sqlUuid(fixture.workspaceId)};
delete from public.project_contacts where id in (${fixture.contacts.map(sqlUuid).join(",")});
delete from public.workspaces where id = ${sqlUuid(fixture.workspaceId)};
delete from auth.users where id in (${authUserIds.map(sqlUuid).join(",")});
`);
}

const status = localStatus();
const admins = await Promise.all([createAdmin(status, 1), createAdmin(status, 2)]);
try {
  insertFixtures(admins);
  await createVolunteer(admins[0].client);

  const calendarBefore = queryOne(`select title_snapshot, updated_at from public.calendar_items where id=${sqlUuid(fixture.items.edit)}`);
  const calendarResults = await Promise.all([
    calendarUpdate(admins[0].client, fixture.items.edit, calendarBefore.updated_at, "Admin one edit"),
    calendarUpdate(admins[1].client, fixture.items.edit, calendarBefore.updated_at, "Admin two edit"),
  ]);
  assertOneConflict(calendarResults, "calendar_item_edit_conflict");
  const calendarAfter = queryOne(`select title_snapshot, updated_at from public.calendar_items where id=${sqlUuid(fixture.items.edit)}`);
  assert(["Admin one edit", "Admin two edit"].includes(calendarAfter.title_snapshot));
  assert.notEqual(calendarAfter.updated_at, calendarBefore.updated_at);

  const mealBefore = queryOne(`select updated_at from public.calendar_items where id=${sqlUuid(fixture.items.meal)}`);
  const mealBase = {
    p_workspace_id: fixture.workspaceId,
    p_calendar_item_id: fixture.items.meal,
    p_meal_kind: "breakfast",
    p_date: "2026-10-04",
    p_start_time: "07:00",
    p_end_time: "08:00",
    p_contact: null,
    p_menu: null,
    p_total: 50,
    p_notes: null,
    p_expected_updated_at: mealBefore.updated_at,
  };
  const mealResults = await Promise.all([
    admins[0].client.rpc("save_calendar_meal", { ...mealBase, p_provider: "Admin one provider" }),
    admins[1].client.rpc("save_calendar_meal", { ...mealBase, p_provider: "Admin two provider" }),
  ]);
  assertOneConflict(mealResults, "calendar_item_edit_conflict");
  assert(["Admin one provider", "Admin two provider"].includes(queryOne(`select meal_provider from public.calendar_items where id=${sqlUuid(fixture.items.meal)}`).meal_provider));

  const presetBefore = queryOne(`select color_key, updated_at from public.task_presets where id=${sqlUuid(fixture.presetId)}`);
  const presetResults = await Promise.all([
    admins[0].client.rpc("update_task_preset_color", { p_preset_id: fixture.presetId, p_color_key: "coral", p_expected_updated_at: presetBefore.updated_at }),
    admins[1].client.rpc("update_task_preset_color", { p_preset_id: fixture.presetId, p_color_key: "violet", p_expected_updated_at: presetBefore.updated_at }),
  ]);
  assertOneConflict(presetResults, "task_preset_edit_conflict");
  const presetAfter = queryOne(`select color_key, updated_at from public.task_presets where id=${sqlUuid(fixture.presetId)}`);
  assert(["coral", "violet"].includes(presetAfter.color_key));
  assert.notEqual(presetAfter.updated_at, presetBefore.updated_at);

  const assignmentResults = await Promise.all([
    admins[0].client.rpc("create_calendar_assignment", { p_calendar_item_id: fixture.items.assignment, p_volunteer_profile_id: fixture.volunteerId, p_assignment_note: null }),
    admins[1].client.rpc("create_calendar_assignment", { p_calendar_item_id: fixture.items.assignment, p_volunteer_profile_id: fixture.volunteerId, p_assignment_note: null }),
  ]);
  assert.equal(assignmentResults.filter((result) => !result.error).length, 1);
  assert.equal(assignmentResults.filter((result) => result.error?.code === "23505").length, 1);
  const assignmentCounts = queryOne(`select
    count(*) filter (where lifecycle='active')::integer active_assignments,
    (select count(*)::integer from public.assignment_responses r join public.calendar_assignments a on a.id=r.assignment_id where a.calendar_item_id=${sqlUuid(fixture.items.assignment)}) responses
    from public.calendar_assignments where calendar_item_id=${sqlUuid(fixture.items.assignment)}`);
  assert.deepEqual(assignmentCounts, { active_assignments: 1, responses: 1 });

  const archiveBefore = queryOne(`select updated_at from public.calendar_items where id=${sqlUuid(fixture.items.archive)}`);
  const [archiveResult, editDuringArchive] = await Promise.all([
    admins[0].client.rpc("archive_calendar_item", { p_calendar_item_id: fixture.items.archive }),
    calendarUpdate(admins[1].client, fixture.items.archive, archiveBefore.updated_at, "Edit racing archive"),
  ]);
  assert(!archiveResult.error, "Archive must succeed once.");
  if (editDuringArchive.error) assert(["40001", "42501"].includes(editDuringArchive.error.code));
  const archived = queryOne(`select lifecycle, title_snapshot from public.calendar_items where id=${sqlUuid(fixture.items.archive)}`);
  assert.equal(archived.lifecycle, "archived");
  assert(["Archive item", "Edit racing archive"].includes(archived.title_snapshot));
  const staleAfterArchive = await calendarUpdate(admins[1].client, fixture.items.archive, archiveBefore.updated_at, "Resurrection attempt");
  assert(staleAfterArchive.error, "An archived item must reject later edit attempts.");
  assert.equal(queryOne(`select lifecycle from public.calendar_items where id=${sqlUuid(fixture.items.archive)}`).lifecycle, "archived");

  if (process.argv.includes("--capture")) await captureConflictUx(admins[0]);

  console.log("PASS 12.46A concurrency: Calendar and meal edits each persisted 1/rejected 1 conflict; Task preset edit persisted 1/rejected 1 conflict; duplicate assignment 1 row/1 response; archive/edit final archived with no resurrection.");
} finally {
  cleanup();
}
