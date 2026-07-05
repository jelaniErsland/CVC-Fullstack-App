import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();

const fixture = {
  namespace: `qa-11-26-${randomUUID()}`,
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
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

const authUserIds = [];
const clients = [];
let cleanupCompleted = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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
      "exec", "-i", containerName, "psql", "--no-psqlrc", "-X", "-qAt",
      "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
    ],
    { input: sql },
  );
  if (result.status !== 0) throw new Error("The local assignment-detail fixture command failed.");
  return result.stdout.trim();
}

async function resolveLocalDatabaseContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define a local project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
  assert(result.status === 0 && result.stdout.trim() === "true", "Local Supabase is not running.");
  return containerName;
}

async function verifyLocalPreflight() {
  assert(supabaseUrl && anonKey, "Local public Supabase environment values are missing.");
  assert(isLoopbackUrl(supabaseUrl), "Assignment-detail QA accepts only local Supabase.");
  secrets.add(anonKey);
  const health = await fetch(new URL("/auth/v1/health", supabaseUrl), {
    headers: { apikey: anonKey },
    redirect: "error",
  });
  assert(health.ok, "Local Supabase Auth is unavailable.");
}

async function createAuthenticatedClient(label) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const email = `${fixture.namespace}-${label}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, `Disposable ${label} Auth creation failed.`);
  authUserIds.push(signup.data.user.id);
  if (!signup.data.session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, `Disposable ${label} sign-in failed.`);
    secrets.add(signin.data.session.access_token);
    secrets.add(signin.data.session.refresh_token);
  } else {
    secrets.add(signup.data.session.access_token);
    secrets.add(signup.data.session.refresh_token);
  }
  clients.push(client);
  return client;
}

async function createFixtures(containerName) {
  const viewerClient = await createAuthenticatedClient("viewer");
  const otherClient = await createAuthenticatedClient("other-workspace");
  const answers = JSON.stringify({
    aboutYou: {
      name: "QA 11.26 Private Volunteer",
      email: `${fixture.namespace}-volunteer@example.invalid`,
      phone: "+1 555 011 2626",
      congregation: "QA 11.26 Congregation",
    },
    availability: { weekdays: ["Friday"] },
    skillsExperience: { categories: ["General"] },
    emergencyContact: { name: "QA Private Contact", phone: "+1 555 011 2699" },
    otherWaysToHelp: {},
  });

  runPsql(containerName, `begin;
insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, public_intake_enabled)
values
  ('${fixture.workspaceId}'::uuid, ${sqlText(`${fixture.namespace}-target`)}, 'QA 11.26 Assignment Workspace', 'active', 'America/Denver', false),
  ('${fixture.otherWorkspaceId}'::uuid, ${sqlText(`${fixture.namespace}-other`)}, 'QA 11.26 Other Workspace', 'active', 'America/Denver', false);
insert into public.project_contacts (id, auth_user_id, status)
values
  ('${fixture.viewerContactId}'::uuid, '${authUserIds[0]}'::uuid, 'active'),
  ('${fixture.otherContactId}'::uuid, '${authUserIds[1]}'::uuid, 'active');
insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status)
values
  ('${fixture.viewerGrantId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.viewerContactId}'::uuid, 'main_contact', array['workspace.read', 'assignments.view']::text[], 'active'),
  ('${fixture.otherGrantId}'::uuid, '${fixture.otherWorkspaceId}'::uuid, '${fixture.otherContactId}'::uuid, 'main_contact', array['workspace.read', 'assignments.view']::text[], 'active');
insert into public.questionnaire_submissions (id, workspace_id, status, source, questionnaire_version, answers)
values ('${fixture.questionnaireId}'::uuid, '${fixture.workspaceId}'::uuid, 'submitted', 'admin_entry', 1, ${sqlText(answers)}::jsonb);
insert into public.volunteer_profiles (
  id, workspace_id, source_submission_id, lifecycle, readiness_status, full_name,
  email, phone, congregation, availability_snapshot, skills_help_snapshot, profile_notes
) values (
  '${fixture.volunteerId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.questionnaireId}'::uuid,
  'active', 'ready', 'QA 11.26 Safe Volunteer', '${fixture.namespace}-volunteer@example.invalid',
  '+1 555 011 2626', 'QA 11.26 Congregation', '{"weekdays":["Friday"]}'::jsonb,
  '{"skillsExperience":{"categories":["General"]}}'::jsonb, ''
);
insert into public.task_presets (
  id, workspace_id, name, task_type, default_needed_count, volunteer_visible,
  is_system_preset, custom_field_definitions, lifecycle
) values (
  '${fixture.taskPresetId}'::uuid, '${fixture.workspaceId}'::uuid, 'QA 11.26 Task',
  'general', 2, true, false, '[]'::jsonb, 'active'
);
insert into public.calendar_items (
  id, workspace_id, task_preset_id, title_snapshot, task_type_snapshot,
  schedule_kind, start_date, start_time, end_time, timezone, needed_count,
  custom_values, lifecycle
) values (
  '${fixture.calendarItemId}'::uuid, '${fixture.workspaceId}'::uuid,
  '${fixture.taskPresetId}'::uuid, 'QA 11.26 Assignment Detail', 'general',
  'timed', '2031-01-26', '09:00:00', '11:30:00', 'America/Denver', 2, '{}'::jsonb, 'active'
);
insert into public.calendar_assignments (
  id, workspace_id, calendar_item_id, volunteer_profile_id, lifecycle, created_by_auth_user_id
) values (
  '${fixture.assignmentId}'::uuid, '${fixture.workspaceId}'::uuid,
  '${fixture.calendarItemId}'::uuid, '${fixture.volunteerId}'::uuid, 'active', '${authUserIds[0]}'::uuid
);
insert into public.assignment_responses (
  id, workspace_id, assignment_id, response_status, response_source, created_at, updated_at
) values (
  '${fixture.responseId}'::uuid, '${fixture.workspaceId}'::uuid, '${fixture.assignmentId}'::uuid,
  'needs_response', 'project_contact', now(), now()
);
commit;`);
  return { viewerClient, otherClient };
}

const safeKeys = [
  "assignment_lifecycle", "assignment_reference", "calendar_item_reference",
  "can_edit_assignment", "current_response_source", "current_response_status",
  "current_response_updated_at", "future_response_link_surface", "planned_needed_count",
  "response_link_product_surface_available", "schedule_kind", "schedule_timezone",
  "scheduled_date", "scheduled_end_date", "scheduled_end_time", "scheduled_start_time",
  "task_title", "volunteer_congregation", "volunteer_display_name",
  "volunteer_profile_reference", "workspace_display_name", "workspace_reference",
].sort();

async function verifyLiveContext(containerName, viewerClient, otherClient) {
  const anonymousClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const unauthenticated = await anonymousClient.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.assignmentId,
  });
  assert(unauthenticated.error?.code === "42501", "Assignment detail RPC allowed anon execute.");

  const visible = await viewerClient.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.assignmentId,
  });
  assert(!visible.error && visible.data?.length === 1, "assignments.view could not read detail context.");
  const row = visible.data[0];
  assert(JSON.stringify(Object.keys(row).sort()) === JSON.stringify(safeKeys), "Assignment detail returned an unsafe field shape.");
  assert(
    row.assignment_reference === fixture.assignmentId &&
      row.assignment_lifecycle === "active" &&
      row.workspace_reference === fixture.workspaceId &&
      row.workspace_display_name === "QA 11.26 Assignment Workspace" &&
      row.calendar_item_reference === fixture.calendarItemId &&
      row.task_title === "QA 11.26 Assignment Detail" &&
      row.schedule_kind === "timed" &&
      row.scheduled_date === "2031-01-26" &&
      row.scheduled_start_time === "09:00:00" &&
      row.scheduled_end_time === "11:30:00" &&
      row.schedule_timezone === "America/Denver" &&
      row.planned_needed_count === 2 &&
      row.volunteer_profile_reference === fixture.volunteerId &&
      row.volunteer_display_name === "QA 11.26 Safe Volunteer" &&
      row.volunteer_congregation === "QA 11.26 Congregation" &&
      row.current_response_status === "needs_response" &&
      row.current_response_source === "project_contact" &&
      row.can_edit_assignment === false &&
      row.response_link_product_surface_available === false &&
      row.future_response_link_surface === "future_project_contact_assignment_response_reveal",
    "Assignment detail safe projection was incorrect.",
  );

  runPsql(containerName, `update public.workspace_contact_grants
set capabilities = array['workspace.read']::text[] where id = '${fixture.viewerGrantId}'::uuid;`);
  const withoutView = await viewerClient.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.assignmentId,
  });
  assert(!withoutView.error && withoutView.data?.length === 0, "Contact without assignments.view read detail context.");
  runPsql(containerName, `update public.workspace_contact_grants
set capabilities = array['workspace.read', 'assignments.view', 'assignments.edit']::text[]
where id = '${fixture.viewerGrantId}'::uuid;`);

  const editable = await viewerClient.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.assignmentId,
  });
  assert(
    !editable.error && editable.data?.[0]?.can_edit_assignment === true &&
      editable.data?.[0]?.response_link_product_surface_available === false,
    "assignments.edit was not collapsed to a boolean or incorrectly enabled reveal.",
  );

  const crossWorkspace = await otherClient.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.assignmentId,
  });
  const missing = await viewerClient.rpc("read_assignment_detail_context", {
    p_assignment_id: randomUUID(),
  });
  assert(
    !crossWorkspace.error && crossWorkspace.data?.length === 0 &&
      !missing.error && missing.data?.length === 0,
    "Unavailable assignment detail leaked across workspace or missing ids.",
  );

  runPsql(containerName, `update public.calendar_assignments set lifecycle = 'canceled'
where id = '${fixture.assignmentId}'::uuid;`);
  const canceled = await viewerClient.rpc("read_assignment_detail_context", {
    p_assignment_id: fixture.assignmentId,
  });
  assert(!canceled.error && canceled.data?.length === 0, "Canceled assignment detail remained available.");
  runPsql(containerName, `update public.calendar_assignments set lifecycle = 'active'
where id = '${fixture.assignmentId}'::uuid;`);
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  }));
  return nested.flat();
}

async function verifyStaticBoundaries() {
  const migration = await readFile(path.join(root, "supabase", "migrations", "20260705000000_assignment_detail_context.sql"), "utf8");
  const helper = await readFile(path.join(root, "lib", "assignments", "detailContext.server.ts"), "utf8");
  assert(/^import "server-only";/m.test(helper), "Assignment detail helper is not server-only.");
  assert(/"read_assignment_detail_context"/.test(helper), "Assignment detail helper does not call its narrow RPC.");
  assert(!/auditedReveal|replacementLink|responseTokens\/(?:link|server|token)|reveal_assignment_response_link|responseUrl|bearer|verifier/i.test(helper), "Assignment detail helper imported a response-link boundary.");
  assert(!/assignment_response_tokens|questionnaire_submissions|emergency_contact|bearer|verifier|response_url|access_token|refresh_token|service_role/i.test(migration), "Assignment detail RPC reads or exposes prohibited data.");
  assert(/grant execute on function public\.read_assignment_detail_context\(uuid\) to authenticated/i.test(migration), "Assignment detail RPC lacks authenticated execute.");
  assert(!/to anon/i.test(migration), "Assignment detail RPC grants anon access.");

  const routeFiles = [];
  for (const directory of ["app", "components"]) {
    routeFiles.push(...(await collectFiles(path.join(root, directory))).filter((file) => /\.(?:ts|tsx)$/.test(file)));
  }
  const unsafe = [];
  for (const file of routeFiles) {
    const source = await readFile(file, "utf8");
    if (/assignments\/detailContext|readAssignmentDetailContext|auditedReveal|reveal_assignment_response_link|navigator\.clipboard|clipboard\.writeText|Copy response link/i.test(source)) {
      unsafe.push(path.relative(root, file).replaceAll("\\", "/"));
    }
  }
  assert(unsafe.length === 0, "A current route/component imports persisted detail or reveal behavior.");
}

async function cleanupFixtures(containerName) {
  for (const client of clients) await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  runPsql(containerName, `begin;
delete from public.assignment_responses where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.calendar_assignments where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.calendar_items where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.task_presets where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.volunteer_profiles where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.questionnaire_submissions where workspace_id = '${fixture.workspaceId}'::uuid;
delete from public.workspace_contact_grants where workspace_id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
delete from public.project_contacts where id in ('${fixture.viewerContactId}'::uuid, '${fixture.otherContactId}'::uuid);
delete from public.workspaces where id in ('${fixture.workspaceId}'::uuid, '${fixture.otherWorkspaceId}'::uuid);
${authUserIds.map((id) => `delete from auth.users where id = '${id}'::uuid;`).join("\n")}
commit;`);
  const residue = runPsql(containerName, `select (
  (select count(*) from public.workspaces where workspace_key like 'qa-11-26-%') +
  (select count(*) from auth.users where email like 'qa-11-26-%@example.invalid')
)::text;`);
  assert(residue === "0", "Assignment-detail fixtures left local residue.");
  cleanupCompleted = true;
}

async function main() {
  await verifyLocalPreflight();
  const containerName = await resolveLocalDatabaseContainer();
  try {
    const { viewerClient, otherClient } = await createFixtures(containerName);
    await verifyLiveContext(containerName, viewerClient, otherClient);
    await verifyStaticBoundaries();
  } finally {
    await cleanupFixtures(containerName);
  }
  assert(cleanupCompleted, "Assignment-detail fixture cleanup did not complete.");
  console.log("Persisted assignment-detail context QA passed.");
  console.log("Verified assignments.view isolation, safe projection, edit boolean, inactive handling, route isolation, and zero residue.");
  console.log("No bearer, response URL, verifier, password, access token, refresh token, or API key was logged.");
}

main().catch((error) => {
  console.error(`Assignment-detail context QA failed: ${redact(error)}`);
  process.exitCode = 1;
});
