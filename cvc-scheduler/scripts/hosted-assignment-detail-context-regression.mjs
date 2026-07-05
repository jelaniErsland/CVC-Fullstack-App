import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedName = "project-local-staging";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const hostedUrl = `https://${expectedRef}.supabase.co`;
const secrets = new Set();

const fixture = {
  namespace: `qa-11-27-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  viewerUserId: randomUUID(),
  otherUserId: randomUUID(),
  viewerIdentityId: randomUUID(),
  otherIdentityId: randomUUID(),
  viewerContactId: randomUUID(),
  otherContactId: randomUUID(),
  viewerGrantId: randomUUID(),
  otherGrantId: randomUUID(),
  questionnaireId: randomUUID(),
  volunteerId: randomUUID(),
  taskPresetId: randomUUID(),
  calendarItemId: randomUUID(),
  assignmentId: randomUUID(),
  responseId: randomUUID(),
};

let viewerClient = null;
let otherClient = null;
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
    ? [path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"), "--yes", "supabase", ...args]
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
  const output = runSupabaseCli([
    "db", "query", "--linked", sql.replace(/\r?\n/g, " "), "--output", "json",
  ]);
  const result = parseCliJson(output, stage);
  assert(Array.isArray(result.rows), `${stage} omitted rows.`);
  return result.rows;
}

async function verifyPreflightAndReadAnonKey() {
  assert(
    process.env.RUN_HOSTED_ASSIGNMENT_DETAIL_CONTEXT_VALIDATION === expectedConfirmation,
    `Refusing hosted validation without RUN_HOSTED_ASSIGNMENT_DETAIL_CONTEXT_VALIDATION=${expectedConfirmation}.`,
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
  )[0]?.version;
  assert(latestMigration === "20260705000000", "Hosted staging is not migrated through 20260705000000.");

  const apiKeys = parseCliJson(
    runSupabaseCli(["projects", "api-keys", "--project-ref", expectedRef, "--output", "json"], { sensitiveOutput: true }),
    "Hosted API-key discovery",
  );
  for (const entry of apiKeys) if (typeof entry.api_key === "string") secrets.add(entry.api_key);
  const anonKey = apiKeys.find((entry) => entry.name === "anon")?.api_key;
  assert(typeof anonKey === "string" && anonKey.length > 100, "Hosted anon key is unavailable.");
  return anonKey;
}

function authUserSql({ userId, identityId, email, password }) {
  return `insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid, '${userId}'::uuid,
  'authenticated', 'authenticated', ${sqlText(email)},
  extensions.crypt(${sqlText(password)}, extensions.gen_salt('bf')), clock_timestamp(),
  '', '', '', '', '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb, clock_timestamp(), clock_timestamp()
);
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
) values (
  '${userId}', '${userId}'::uuid,
  jsonb_build_object('sub', '${userId}', 'email', ${sqlText(email)}),
  'email', clock_timestamp(), clock_timestamp(), clock_timestamp(), '${identityId}'::uuid
);`;
}

async function createFixtures(anonKey) {
  const viewerEmail = `${fixture.namespace}-viewer@example.invalid`;
  const otherEmail = `${fixture.namespace}-other@example.invalid`;
  const volunteerEmail = `${fixture.namespace}-volunteer@example.invalid`;
  const viewerPassword = `${randomBytes(24).toString("base64url")}aA1!`;
  const otherPassword = `${randomBytes(24).toString("base64url")}aA1!`;
  for (const value of [viewerEmail, otherEmail, volunteerEmail, viewerPassword, otherPassword]) secrets.add(value);

  runHostedSql(`begin;
${authUserSql({ userId: fixture.viewerUserId, identityId: fixture.viewerIdentityId, email: viewerEmail, password: viewerPassword })}
${authUserSql({ userId: fixture.otherUserId, identityId: fixture.otherIdentityId, email: otherEmail, password: otherPassword })}
commit;
select 'auth-created' as fixture_state;`, "Hosted assignment-detail Auth fixture creation");

  runHostedSql(`begin;
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, public_intake_enabled)
values
  ('${fixture.workspaceId}'::uuid, ${sqlText(`${fixture.namespace}-target`)}, 'QA 11.27 Assignment Workspace', 'active', 'America/Denver', false),
  ('${fixture.otherWorkspaceId}'::uuid, ${sqlText(`${fixture.namespace}-other`)}, 'QA 11.27 Other Workspace', 'active', 'America/Denver', false);
insert into public.project_contacts (id, auth_user_id, status)
values
  ('${fixture.viewerContactId}'::uuid, '${fixture.viewerUserId}'::uuid, 'active'),
  ('${fixture.otherContactId}'::uuid, '${fixture.otherUserId}'::uuid, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status)
values
  ('${fixture.viewerGrantId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.viewerContactId}'::uuid, 'main_contact', array['workspace.read', 'assignments.view']::text[], 'active'),
  ('${fixture.otherGrantId}'::uuid, '${fixture.otherWorkspaceId}'::uuid, '${fixture.otherContactId}'::uuid, 'main_contact', array['workspace.read', 'assignments.view']::text[], 'active');
insert into public.questionnaire_submissions (id, workspace_id, status, source, questionnaire_version, answers)
values (
  '${fixture.questionnaireId}'::uuid, '${fixture.workspaceId}'::uuid, 'submitted', 'admin_entry', 1,
  '{"aboutYou":{},"availability":{},"skillsExperience":{},"emergencyContact":{},"otherWaysToHelp":{}}'::jsonb
);
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, lifecycle, readiness_status, full_name,
  email, phone, congregation, availability_snapshot, skills_help_snapshot, profile_notes
) values (
  '${fixture.volunteerId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.questionnaireId}'::uuid,
  'active', 'ready', 'QA 11.27 Safe Volunteer', ${sqlText(volunteerEmail)}, null, 'QA 11.27 Congregation', '{}'::jsonb, '{}'::jsonb, ''
);
insert into public.task_presets (
  id, workspace_id, name, task_type, default_needed_count, volunteer_visible,
  is_system_preset, custom_field_definitions, lifecycle
) values ('${fixture.taskPresetId}'::uuid, '${fixture.workspaceId}'::uuid, 'QA 11.27 Task', 'general', 2, true, false, '[]'::jsonb, 'active');
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot, schedule_kind,
  start_date, start_time, end_time, timezone, needed_count, custom_values, lifecycle
) values (
  '${fixture.calendarItemId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.taskPresetId}'::uuid,
  'QA 11.27 Assignment Detail', 'general', 'timed', '2031-02-27', '09:00:00', '11:30:00',
  'America/Denver', 2, '{}'::jsonb, 'active'
);
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, created_by_auth_user_id
) values ('${fixture.assignmentId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.calendarItemId}'::uuid, '${fixture.volunteerId}'::uuid, 'active', '${fixture.viewerUserId}'::uuid);
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, created_at, updated_at
) values ('${fixture.responseId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.assignmentId}'::uuid, 'needs_response', 'project_contact', now(), now());
commit;
select 'product-created' as fixture_state;`, "Hosted assignment-detail product fixture creation");

  viewerClient = createClient(hostedUrl, anonKey, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  otherClient = createClient(hostedUrl, anonKey, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  const viewerSignin = await viewerClient.auth.signInWithPassword({ email: viewerEmail, password: viewerPassword });
  const otherSignin = await otherClient.auth.signInWithPassword({ email: otherEmail, password: otherPassword });
  assert(!viewerSignin.error && viewerSignin.data.session, "Hosted viewer sign-in failed.");
  assert(!otherSignin.error && otherSignin.data.session, "Hosted other-workspace sign-in failed.");
  for (const value of [
    viewerSignin.data.session.access_token, viewerSignin.data.session.refresh_token,
    otherSignin.data.session.access_token, otherSignin.data.session.refresh_token,
  ]) secrets.add(value);
}

const safeKeys = [
  "assignment_lifecycle", "assignment_reference", "calendar_item_reference", "can_edit_assignment",
  "current_response_source", "current_response_status", "current_response_updated_at",
  "future_response_link_surface", "planned_needed_count", "response_link_product_surface_available",
  "schedule_kind", "schedule_timezone", "scheduled_date", "scheduled_end_date",
  "scheduled_end_time", "scheduled_start_time", "task_title", "volunteer_congregation",
  "volunteer_display_name", "volunteer_profile_reference", "workspace_display_name", "workspace_reference",
].sort();

async function expectNoRow(client, label) {
  const result = await client.rpc("read_assignment_detail_context", { p_assignment_id: fixture.assignmentId });
  assert(!result.error && result.data?.length === 0, `${label} did not fail closed.`);
}

async function verifyHostedContext(anonKey) {
  const publicClient = createClient(hostedUrl, anonKey, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  const unauthenticated = await publicClient.rpc("read_assignment_detail_context", { p_assignment_id: fixture.assignmentId });
  assert(unauthenticated.error?.code === "42501", "Hosted assignment-detail RPC allowed anon execute.");

  const visible = await viewerClient.rpc("read_assignment_detail_context", { p_assignment_id: fixture.assignmentId });
  assert(!visible.error && visible.data?.length === 1, "Hosted assignments.view could not read detail context.");
  const row = visible.data[0];
  assert(JSON.stringify(Object.keys(row).sort()) === JSON.stringify(safeKeys), "Hosted assignment detail returned an unsafe field shape.");
  assert(
    row.assignment_reference === fixture.assignmentId && row.assignment_lifecycle === "active" &&
      row.workspace_reference === fixture.workspaceId && row.workspace_display_name === "QA 11.27 Assignment Workspace" &&
      row.calendar_item_reference === fixture.calendarItemId && row.task_title === "QA 11.27 Assignment Detail" &&
      row.schedule_kind === "timed" && row.scheduled_date === "2031-02-27" &&
      row.scheduled_start_time === "09:00:00" && row.scheduled_end_time === "11:30:00" &&
      row.schedule_timezone === "America/Denver" && row.planned_needed_count === 2 &&
      row.volunteer_profile_reference === fixture.volunteerId && row.volunteer_display_name === "QA 11.27 Safe Volunteer" &&
      row.volunteer_congregation === "QA 11.27 Congregation" && row.current_response_status === "needs_response" &&
      row.current_response_source === "project_contact" && row.can_edit_assignment === false &&
      row.response_link_product_surface_available === false &&
      row.future_response_link_surface === "future_project_contact_assignment_response_reveal",
    "Hosted assignment-detail safe projection was incorrect.",
  );
  const grantState = runHostedSql(`select capabilities from public.workspace_contact_grants where id = '${fixture.viewerGrantId}'::uuid;`)[0]?.capabilities;
  assert(JSON.stringify(grantState) === JSON.stringify(["workspace.read", "assignments.view"]), "Hosted viewer unexpectedly required broad capabilities.");

  runHostedSql(`update public.workspace_contact_grants set capabilities = array['workspace.read']::text[] where id = '${fixture.viewerGrantId}'::uuid; select 'restricted' as state;`);
  await expectNoRow(viewerClient, "Hosted under-capability context");
  runHostedSql(`update public.workspace_contact_grants set capabilities = array['workspace.read', 'assignments.view', 'assignments.edit']::text[] where id = '${fixture.viewerGrantId}'::uuid; select 'editable' as state;`);
  const editable = await viewerClient.rpc("read_assignment_detail_context", { p_assignment_id: fixture.assignmentId });
  assert(!editable.error && editable.data?.[0]?.can_edit_assignment === true && editable.data?.[0]?.response_link_product_surface_available === false, "Hosted edit boolean or reveal readiness was incorrect.");

  await expectNoRow(otherClient, "Hosted cross-workspace context");
  const missing = await viewerClient.rpc("read_assignment_detail_context", { p_assignment_id: randomUUID() });
  assert(!missing.error && missing.data?.length === 0, "Hosted missing assignment leaked context.");

  for (const [stage, mutate, restore] of [
    ["canceled assignment", `update public.calendar_assignments set lifecycle = 'canceled' where id = '${fixture.assignmentId}'::uuid;`, `update public.calendar_assignments set lifecycle = 'active' where id = '${fixture.assignmentId}'::uuid;`],
    ["archived assignment", `update public.calendar_assignments set lifecycle = 'archived' where id = '${fixture.assignmentId}'::uuid;`, `update public.calendar_assignments set lifecycle = 'active' where id = '${fixture.assignmentId}'::uuid;`],
    ["archived workspace", `update public.workspaces set lifecycle = 'archived' where id = '${fixture.workspaceId}'::uuid;`, `update public.workspaces set lifecycle = 'active' where id = '${fixture.workspaceId}'::uuid;`],
    ["archived Calendar item", `update public.calendar_items set lifecycle = 'archived' where id = '${fixture.calendarItemId}'::uuid;`, `update public.calendar_items set lifecycle = 'active' where id = '${fixture.calendarItemId}'::uuid;`],
    ["inactive volunteer", `update public.volunteer_profiles set lifecycle = 'inactive' where id = '${fixture.volunteerId}'::uuid;`, `update public.volunteer_profiles set lifecycle = 'active' where id = '${fixture.volunteerId}'::uuid;`],
  ]) {
    runHostedSql(`${mutate} select 'mutated' as state;`, `Hosted ${stage} mutation`);
    await expectNoRow(viewerClient, `Hosted ${stage}`);
    runHostedSql(`${restore} select 'restored' as state;`, `Hosted ${stage} restoration`);
  }
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  }))).flat();
}

async function verifyStaticRouteIsolation() {
  const unsafe = [];
  for (const directory of ["app", "components"]) {
    for (const file of (await collectFiles(path.join(root, directory))).filter((entry) => /\.(?:ts|tsx)$/.test(entry))) {
      const source = await readFile(file, "utf8");
      if (/assignments\/detailContext|readAssignmentDetailContext|read_assignment_detail_context|auditedReveal|replacementLink|reveal_assignment_response_link|navigator\.clipboard|Copy response link/i.test(source)) {
        unsafe.push(path.relative(root, file).replaceAll("\\", "/"));
      }
    }
  }
  assert(unsafe.length === 0, "A current route/component consumes persisted detail or reveal behavior.");
}

async function cleanupFixtures() {
  if (viewerClient) await viewerClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (otherClient) await otherClient.auth.signOut({ scope: "local" }).catch(() => undefined);
  runHostedSql(`begin;
delete from public.assignment_responses where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.calendar_assignments where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.calendar_items where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.volunteer_profiles where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.questionnaire_submissions where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.workspace_contact_grants where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.project_contacts where id in ('${fixture.viewerContactId}'::uuid, '${fixture.otherContactId}'::uuid);
delete from public.workspaces where id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from auth.identities where user_id in ('${fixture.viewerUserId}'::uuid, '${fixture.otherUserId}'::uuid);
delete from auth.users where id in ('${fixture.viewerUserId}'::uuid, '${fixture.otherUserId}'::uuid);
commit;
select 'cleaned' as fixture_state;`, "Hosted assignment-detail cleanup");
  const exactResidue = runHostedSql(`select (
  (select count(*) from public.workspaces where id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid)) +
  (select count(*) from public.project_contacts where id in ('${fixture.viewerContactId}'::uuid, '${fixture.otherContactId}'::uuid)) +
  (select count(*) from public.workspace_contact_grants where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid)) +
  (select count(*) from public.questionnaire_submissions where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.volunteer_profiles where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.calendar_items where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.calendar_assignments where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from public.assignment_responses where workspace_id = '${fixture.workspaceId}'::uuid) +
  (select count(*) from auth.users where id in ('${fixture.viewerUserId}'::uuid, '${fixture.otherUserId}'::uuid))
) as residue_count;`, "Hosted assignment-detail exact residue check")[0]?.residue_count;
  assert(exactResidue === 0, "Hosted assignment-detail fixtures left exact-run residue.");
  cleanupCompleted = true;
}

function verifyNamespaceResidue() {
  const residue = runHostedSql(`select (
  (select count(*) from public.workspaces where workspace_key like 'qa-11-27-%') +
  (select count(*) from auth.users where email like 'qa-11-27-%@example.invalid')
) as residue_count;`, "Hosted 11.27 namespace residue check")[0]?.residue_count;
  assert(residue === 0, "Hosted qa-11-27 namespace left fixture/Auth residue.");
  return residue;
}

async function main() {
  const anonKey = await verifyPreflightAndReadAnonKey();
  try {
    await createFixtures(anonKey);
    await verifyHostedContext(anonKey);
    await verifyStaticRouteIsolation();
  } finally {
    await cleanupFixtures();
  }
  assert(cleanupCompleted && verifyNamespaceResidue() === 0, "Hosted assignment-detail cleanup did not complete.");
  console.log("Hosted staging assignment-detail context QA passed.");
  console.log("Validated migration 20260705000000, assignments.view isolation, safe projection, edit boolean, unavailable-context handling, and route isolation.");
  console.log("Hosted disposable product and Auth residue: 0.");
  console.log("No response link, token value, verifier, credential, or sensitive intake value was logged.");
}

main().catch((error) => {
  console.error(`Hosted assignment-detail context QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
