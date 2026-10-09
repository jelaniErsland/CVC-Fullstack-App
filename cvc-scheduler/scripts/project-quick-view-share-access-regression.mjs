import { parseIssuedVolunteerScheduleAccess } from "../lib/volunteerScheduleAccess/token.ts";
import { sharedCalendarState } from "../lib/calendar/quickView.server.ts";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  parseIssuedProjectQuickViewAccess,
  parseSharedProjectQuickView,
  ProjectQuickViewAccessValidationError,
  validateQuickViewBearer,
} from "../lib/projectQuickViewAccess/token.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const namespace = `qa-shared-quick-view-${randomUUID()}`;
const workspaceIds = [randomUUID(), randomUUID(), randomUUID()];
const contactIds = [randomUUID(), randomUUID(), randomUUID()];
const grantIds = [randomUUID(), randomUUID(), randomUUID()];
const itemIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const presetId = randomUUID();
const volunteerIds = [randomUUID(), randomUUID(), randomUUID()];
const assignmentIds = [randomUUID(), randomUUID(), randomUUID()];
const dayIds = [randomUUID(), randomUUID()];
const authUserIds = [];
const clients = [];
const secrets = new Set();
let containerName;

function loopback(value) {
  try { return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname); }
  catch { return false; }
}
function sqlText(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function sqlUuid(value) { return `${sqlText(value)}::uuid`; }
function command(name, args, options = {}) {
  return spawnSync(name, args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 30 * 1024 * 1024, ...options });
}
function redact(value) {
  let result = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secrets) if (secret) result = result.replaceAll(secret, "[redacted]");
  return result.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]").slice(0, 2200);
}
function runPsql(sql) {
  const result = command("docker", ["exec", "-i", containerName, "psql", "--no-psqlrc", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: sql });
  if (result.status !== 0) throw new Error(result.stderr || "Local Quick View access SQL failed.");
  return result.stdout.trim();
}
async function resolveContainer() {
  if (!supabaseUrl || !anonKey) {
    const status = command("npx", ["supabase", "status", "--output", "json"], { shell: process.platform === "win32" });
    assert.equal(status.status, 0, "Local Supabase status is unavailable.");
    const config = JSON.parse(status.stdout);
    supabaseUrl = config.API_URL;
    anonKey = config.ANON_KEY;
  }
  assert(supabaseUrl && anonKey && loopback(supabaseUrl), "Shared Quick View regression requires loopback Supabase.");
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "Local Supabase project id is required.");
  const candidate = `supabase_db_${projectId}`;
  const inspect = command("docker", ["inspect", "--format", "{{.State.Running}}", candidate]);
  assert(inspect.status === 0 && inspect.stdout.trim() === "true", "Local Supabase must be running.");
  return candidate;
}
async function user(label) {
  const email = `${namespace}-${label}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email); secrets.add(password);
  const client = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await client.auth.signUp({ email, password });
  assert(!result.error && result.data.user && result.data.session, `Auth fixture ${label} failed.`);
  secrets.add(result.data.session.access_token); secrets.add(result.data.session.refresh_token);
  authUserIds.push(result.data.user.id); clients.push(client);
  return { client, userId: result.data.user.id };
}
async function expectError(label, operation) {
  try {
    const result = await operation();
    if (result?.error) return;
  } catch { return; }
  assert.fail(`${label} should fail closed.`);
}
async function rpcRead(client, token, date = "2026-09-02") {
  const result = await client.rpc("read_project_quick_view_by_token", { p_bearer_token: token, p_project_date: date });
  assert(!result.error, `Quick View read failed: ${result.error?.message}`);
  const access = parseSharedProjectQuickView(result.data);
  return access.kind === "ready" ? { ...access, calendar: sharedCalendarState(result.data, { date, view: "day" }) } : access;
}
async function cleanup() {
  await Promise.allSettled(clients.map((client) => client.auth.signOut()));
  if (!containerName) return;
  runPsql(`
    delete from public.project_quick_view_access_tokens where workspace_id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from public.project_days where workspace_id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from public.volunteer_schedule_access_tokens where workspace_id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from public.assignment_responses where workspace_id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from public.calendar_assignments where workspace_id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from public.volunteer_profiles where workspace_id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from public.calendar_items where workspace_id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from public.task_presets where workspace_id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from public.workspace_contact_grants where id = any(array[${grantIds.map(sqlUuid).join(",")}]);
    delete from public.project_contacts where id = any(array[${contactIds.map(sqlUuid).join(",")}]);
    delete from public.workspaces where id = any(array[${workspaceIds.map(sqlUuid).join(",")}]);
    delete from auth.users where id = any(array[${authUserIds.map(sqlUuid).join(",")}]);
  `);
  const residue = Number(runPsql(`select
    (select count(*) from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)}) +
    (select count(*) from auth.users where email like ${sqlText(`${namespace}%`)});`));
  assert.equal(residue, 0, "Shared Quick View fixture residue must be zero.");
}

try {
  const migration = await readFile(path.join(root, "supabase", "migrations", "20260902120000_project_quick_view_share_access.sql"), "utf8");
  const server = await readFile(path.join(root, "lib", "projectQuickViewAccess", "server.ts"), "utf8");
  const accessRoute = await readFile(path.join(root, "app", "qv", "access", "[token]", "route.ts"), "utf8");
  const recipientPage = await readFile(path.join(root, "app", "qv", "page.tsx"), "utf8");
  const shareControl = await readFile(path.join(root, "components", "ProjectQuickViewShareControl.tsx"), "utf8");
  const proxy = await readFile(path.join(root, "proxy.ts"), "utf8");
  assert.match(migration, /extensions\.gen_random_bytes\(32\)/);
  assert.match(migration, /extensions\.digest\(issued_bearer_token, 'sha256'\)/);
  assert.match(migration, /revoke all on table public\.project_quick_view_access_tokens from anon, authenticated/i);
  assert.match(migration, /capabilities @> array\['workspace\.read', 'calendar\.edit'\]/);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete).*project_quick_view_access_tokens/i);
  assert.doesNotMatch(server, /service.role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.match(accessRoute, /httpOnly: true/);
  assert.match(accessRoute, /sameSite: "lax"/);
  assert.match(accessRoute, /Referrer-Policy", "no-referrer"/);
  assert.match(accessRoute, /noindex, nofollow, noarchive/);
  assert.match(proxy, /"\/qv\/:path\*"/);
  assert.match(proxy, /private, no-store, max-age=0/);
  assert.match(proxy, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(recipientPage, /AdminShell|AdminNav|Overview|Needs Attention/);
  assert.match(shareControl, /"Create share link"/);
  assert.match(shareControl, /"Create new link"/);
  assert.match(shareControl, /"Copy link"/);
  assert.match(shareControl, /active \$\{state\.activeLinkCount === 1 \? "link" : "links"\}/);
  assert.match(shareControl, /trusted on-site personnel/);
  assert.doesNotMatch(shareControl, /safe daily view/);
  assert.throws(() => validateQuickViewBearer("short"), ProjectQuickViewAccessValidationError);

  containerName = await resolveContainer();
  const [owner, otherOwner, viewOnly] = await Promise.all([user("owner"), user("other"), user("view")]);
  runPsql(`
    insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone, starts_on, ends_on)
    values
      (${sqlUuid(workspaceIds[0])}, ${sqlText(`${namespace}-one`)}, 'Shared Quick View One', 'active', 'America/Denver', '2026-08-01', '2030-09-30'),
      (${sqlUuid(workspaceIds[1])}, ${sqlText(`${namespace}-two`)}, 'Shared Quick View Two', 'active', 'America/Denver', '2026-08-01', '2030-09-30'),
      (${sqlUuid(workspaceIds[2])}, ${sqlText(`${namespace}-ended`)}, 'Ended Secret Project', 'active', 'America/Denver', '2026-01-01', '2026-01-02');
    insert into public.project_contacts (id, auth_user_id, status) values
      (${sqlUuid(contactIds[0])}, ${sqlUuid(owner.userId)}, 'active'),
      (${sqlUuid(contactIds[1])}, ${sqlUuid(otherOwner.userId)}, 'active'),
      (${sqlUuid(contactIds[2])}, ${sqlUuid(viewOnly.userId)}, 'active');
    insert into public.workspace_contact_grants (id, workspace_id, project_contact_id, role, capabilities, status, valid_from) values
      (${sqlUuid(grantIds[0])}, ${sqlUuid(workspaceIds[0])}, ${sqlUuid(contactIds[0])}, 'main_contact', array['workspace.read','calendar.view','calendar.edit','tasks.view','tasks.edit','assignments.view','assignments.edit']::text[], 'active', now() - interval '1 day'),
      (${sqlUuid(grantIds[1])}, ${sqlUuid(workspaceIds[1])}, ${sqlUuid(contactIds[1])}, 'main_contact', array['workspace.read','calendar.view','calendar.edit']::text[], 'active', now() - interval '1 day'),
      (${sqlUuid(grantIds[2])}, ${sqlUuid(workspaceIds[0])}, ${sqlUuid(contactIds[2])}, 'assistant_contact', array['workspace.read','calendar.view','tasks.view','assignments.view']::text[], 'active', now() - interval '1 day');
    insert into public.project_days (id, workspace_id, project_date, expected_on_site_count, created_by_project_contact_id, updated_by_project_contact_id) values
      (${sqlUuid(dayIds[0])}, ${sqlUuid(workspaceIds[0])}, '2026-09-02', 47, ${sqlUuid(contactIds[0])}, ${sqlUuid(contactIds[0])}),
      (${sqlUuid(dayIds[1])}, ${sqlUuid(workspaceIds[1])}, '2026-09-02', 8, ${sqlUuid(contactIds[1])}, ${sqlUuid(contactIds[1])});
    insert into public.calendar_items (id, workspace_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, start_time, end_time, timezone, needed_count, schedule_notes, publication_state, published_at, published_by_project_contact_id) values
      (${sqlUuid(itemIds[0])}, ${sqlUuid(workspaceIds[0])}, 'General setup', 'general', 'timed', '2026-09-02', '07:30', '17:00', 'America/Denver', 3, 'private setup note', 'published', now(), ${sqlUuid(contactIds[0])}),
      (${sqlUuid(itemIds[1])}, ${sqlUuid(workspaceIds[0])}, 'Lunch', 'food', 'date_based', '2026-09-02', null, null, 'America/Denver', 1, 'private lunch note', 'published', now(), ${sqlUuid(contactIds[0])}),
      (${sqlUuid(itemIds[2])}, ${sqlUuid(workspaceIds[0])}, 'Restricted security post', 'security', 'timed', '2026-09-02', '08:00', '09:00', 'America/Denver', 2, 'restricted location', 'published', now(), ${sqlUuid(contactIds[0])}),
      (${sqlUuid(itemIds[3])}, ${sqlUuid(workspaceIds[0])}, 'Private draft work', 'general', 'timed', '2026-09-02', '10:00', '11:00', 'America/Denver', 2, 'draft secret', 'draft', null, null);
  `);

  runPsql(`
    insert into public.task_presets (id, workspace_id, name, description, task_type, default_needed_count)
    values (${sqlUuid(presetId)}, ${sqlUuid(workspaceIds[0])}, 'Setup instructions', 'Current preset instructions, independent of the saved occurrence.', 'general', 3);
    update public.calendar_items set task_preset_id=${sqlUuid(presetId)}, custom_values='{"reporting_point":"Synthetic entrance"}'::jsonb where id=${sqlUuid(itemIds[0])};
  `);

  for (let index = 0; index < 3; index++) {
    const response = ["needs_response", "confirmed", "declined"][index];
    runPsql(`
      insert into public.volunteer_profiles (id,workspace_id,full_name,email,profile_source,manual_created_by_project_contact_id,manual_created_at,availability_snapshot,skills_help_snapshot)
      values (${sqlUuid(volunteerIds[index])},${sqlUuid(workspaceIds[0])},${sqlText('Synthetic Volunteer '+index)},'synthetic@example.invalid','manual',${sqlUuid(contactIds[0])},now(),'{}','{}');
      insert into public.calendar_assignments (id,workspace_id,calendar_item_id,volunteer_profile_id)
      values (${sqlUuid(assignmentIds[index])},${sqlUuid(workspaceIds[0])},${sqlUuid(itemIds[0])},${sqlUuid(volunteerIds[index])});
      insert into public.assignment_responses (workspace_id,assignment_id,response_status,responded_at)
      values (${sqlUuid(workspaceIds[0])},${sqlUuid(assignmentIds[index])},${sqlText(response)},${response==='needs_response'?'null':'now()'});
    `);
  }
  runPsql(`update public.volunteer_profiles set phone='+1 555 120 1100',congregation='Synthetic Congregation',profile_notes='private profile marker' where id=${sqlUuid(volunteerIds[0])};`);
  const anon = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await expectError("unauthenticated creation", () => anon.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceIds[0] }));
  await expectError("wrong workspace creation", () => owner.client.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceIds[1] }));
  await expectError("view-only creation", () => viewOnly.client.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceIds[0] }));
  await expectError("ended project creation", () => owner.client.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceIds[2] }));
  await expectError("direct authenticated token read", () => owner.client.from("project_quick_view_access_tokens").select("id"));
  await expectError("direct authenticated token insert", () => owner.client.from("project_quick_view_access_tokens").insert({ workspace_id: workspaceIds[0], token_verifier_hash: "x", expires_at: "2030-01-01T00:00:00Z" }));

  const issuedResult = await owner.client.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceIds[0] });
  assert(!issuedResult.error);
  const issued = parseIssuedProjectQuickViewAccess(issuedResult.data);
  secrets.add(issued.token);
  assert.equal(issued.token.length, 43);
  const contactRead = (token, assignmentId, date = "2026-09-02") => anon.rpc("read_project_quick_view_assigned_contact", {
    p_bearer_token: token,
    p_assignment_id: assignmentId,
    p_project_date: date,
  });
  const contact = await contactRead(issued.token, assignmentIds[0]);
  assert(!contact.error);
  assert.deepEqual(contact.data, [{ contact_name: "Synthetic Volunteer 0", phone: "+1 555 120 1100", email: "synthetic@example.invalid", congregation: "Synthetic Congregation" }]);
  assert(!JSON.stringify(contact.data).includes("private profile marker"));
  assert(!JSON.stringify(contact.data).includes("private setup note"));
  for (const [label, token, id, date] of [
    ["unknown bearer", "A".repeat(43), assignmentIds[0], "2026-09-02"],
    ["unknown assignment", issued.token, randomUUID(), "2026-09-02"],
    ["outside visible dates", issued.token, assignmentIds[0], "2028-09-02"],
  ]) {
    const denied = await contactRead(token, id, date);
    assert(!denied.error && denied.data.length === 0, `${label} returned contact data.`);
  }
  const contactPrivilege = runPsql(`select has_function_privilege('anon','public.read_project_quick_view_assigned_contact(text,uuid,date)','execute')::text || '|' || has_function_privilege('authenticated','public.read_project_quick_view_assigned_contact(text,uuid,date)','execute')::text || '|' || (exists(select 1 from aclexplode(p.proacl) acl where acl.grantee=0 and acl.privilege_type='EXECUTE'))::text from pg_proc p where p.oid='public.read_project_quick_view_assigned_contact(text,uuid,date)'::regprocedure;`);
  assert.equal(contactPrivilege, "true|false|false", "Contact RPC execute privilege must be anon only.");
  await expectError("anonymous profile table read", () => anon.from("volunteer_profiles").select("phone,email").eq("id", volunteerIds[0]));
  const stored = runPsql(`select octet_length(token_verifier_hash)::text || '|' || (encode(token_verifier_hash, 'hex') = ${sqlText(createHash("sha256").update(issued.token).digest("hex"))})::text || '|' || (encode(token_verifier_hash, 'escape') = ${sqlText(issued.token)})::text from public.project_quick_view_access_tokens where id = ${sqlUuid(issued.tokenId)};`);
  assert.equal(stored, "32|true|false", "Only a unique SHA-256 verifier may persist.");

  const ready = await rpcRead(anon, issued.token);
  assert.equal(ready.kind, "ready");
  assert.equal(ready.workspaceDisplayName, "Shared Quick View One");
  assert(!JSON.stringify(ready).includes("expectedOnSiteCount"));
  assert.deepEqual(ready.calendar.items.map((item) => item.displayName).sort(), ["General setup", "Lunch", "Restricted security post"].sort());
  const serialized = JSON.stringify(ready);
  // Approved privacy is enforced in the RPC, before rendering or serialization.
  assert.equal(ready.calendar.items.find(item => item.id === itemIds[0])?.scheduleNotes ?? null, null);
  assert.equal(ready.calendar.items.find(item => item.id === itemIds[0])?.taskDescription, null);
  const ownIssued = await owner.client.rpc("issue_volunteer_schedule_access", { p_volunteer_profile_id: volunteerIds[0], p_ttl_hours: 24 });
  assert(!ownIssued.error);
  const personal = parseIssuedVolunteerScheduleAccess(ownIssued.data); secrets.add(personal.token);
  const personalRead = await anon.rpc("read_volunteer_schedule", { p_bearer_token: personal.token });
  assert(!personalRead.error && personalRead.data.some(row => row.assignment_reference === assignmentIds[0] && row.schedule_notes === "private setup note"));
  assert(personalRead.data.every(row => row.assignment_reference === assignmentIds[0]), "Personalized access crossed volunteer identities.");
  for (const fn of ["read_volunteer_schedule", "read_assignment_response_by_token"]) {
    const unrelatedCredential = await anon.rpc(fn, { p_bearer_token: issued.token });
    assert(!unrelatedCredential.error && !/private setup note|Current preset instructions|Synthetic entrance/.test(JSON.stringify(unrelatedCredential.data)), "Project bearer recovered instructions through a personal credential route.");
  }
  const raw = await anon.rpc("read_project_quick_view_by_token", { p_bearer_token: issued.token, p_project_date: "2026-09-02" });
  assert(!raw.error);
  const source = raw.data[0].schedule_sources.find(item => item.id === itemIds[0]);
  assert.equal(source.schedule_notes, null);
  assert.equal(source.task_description, null);
  assert.deepEqual(source.custom_values, {});
  assert.deepEqual(source.assignments.map(a => a.responseStatus), ["needs_response", "confirmed", "declined"]);
  assert.deepEqual(source.assignments.map(a => a.volunteerDisplayName), ["Synthetic Volunteer 0", "Synthetic Volunteer 1", "Synthetic Volunteer 2"]);
  assert.equal(source.needed_count, 3);
  const assignments = await viewOnly.client.from("calendar_assignments").select("id").eq("workspace_id",workspaceIds[0]);
  const responses = await viewOnly.client.from("assignment_responses").select("assignment_id,response_status").eq("workspace_id",workspaceIds[0]);
  assert(!assignments.error && assignments.data.length === 3, "Read-only staffing rows must survive tightened instruction RLS.");
  assert(!responses.error && responses.data.length === 3, "Read-only response rows must survive tightened instruction RLS.");
  const alternate = await viewOnly.client.rpc("read_assignment_detail_context", { p_assignment_id: assignmentIds[0] });
  assert(!alternate.error && alternate.data.length === 1);
  assert(!/private setup note|Current preset instructions|Synthetic entrance/.test(JSON.stringify(alternate.data)));
  await expectError("read-only notification claim", () => viewOnly.client.rpc("claim_initial_assignment_notification_deliveries", { p_calendar_item_id: itemIds[0] }));
  assert.equal(Number(runPsql(`select count(*) from public.assignment_notification_deliveries where workspace_id=${sqlUuid(workspaceIds[0])};`)), 0);
  for (const actor of [owner.client, viewOnly.client]) {
    const administrative = actor === owner.client;
    const calendar = await actor.rpc("read_authorized_calendar_items", { p_workspace_id: workspaceIds[0] }).select("*");
    const presets = await actor.rpc("read_authorized_task_presets", { p_workspace_id: workspaceIds[0] }).select("*");
    assert(!calendar.error && !presets.error);
    assert.equal(calendar.data.length, administrative ? 4 : 3, "Editors can review ambiguous drafts; read-only contacts see operational items.");
    assert.equal(calendar.data.some(item => item.id === itemIds[3]), administrative);
    assert.equal(presets.data.length >= 1, true);
    const item = calendar.data.find(item => item.id === itemIds[0]);
    const preset = presets.data.find(preset => preset.id === presetId);
    assert.equal(item.schedule_notes, administrative ? "private setup note" : null);
    assert.equal(preset.description, administrative ? "Current preset instructions, independent of the saved occurrence." : null);
    assert.deepEqual(item.custom_values, administrative ? { reporting_point: "Synthetic entrance" } : {});
    for (const table of ["calendar_items", "task_presets"]) {
      const direct = await actor.from(table).select("*").eq("workspace_id", workspaceIds[0]);
      assert(!direct.error);
      assert.equal(direct.data.length > 0, administrative, "Direct table RLS must not bypass instruction privacy.");
    }
    const foreign = await actor.rpc("read_authorized_calendar_items", { p_workspace_id: workspaceIds[1] });
    assert(!foreign.error && foreign.data.length === 0, "Safe RPC must retain workspace isolation.");
  }
  for (const fn of ["read_authorized_calendar_items", "read_authorized_task_presets"]) {
    await expectError("anonymous instruction read", () => anon.rpc(fn, { p_workspace_id: workspaceIds[0] }));
  }
  // Preserve dedicated operational meal fields, including null, zero and positive.
  runPsql(`update public.calendar_items set meal_kind='lunch',meal_provider='Synthetic meal group',meal_contact='Synthetic main contact',meal_menu='Vegetable soup',meal_total=47 where id=${sqlUuid(itemIds[1])};`);
  for (const total of [null, 0, 47]) {
    runPsql(`update public.calendar_items set meal_total=${total === null ? 'null' : total} where id=${sqlUuid(itemIds[1])};`);
    const mealRead = await anon.rpc("read_project_quick_view_by_token", { p_bearer_token: issued.token, p_project_date: "2026-09-02" });
    const meal = mealRead.data[0].schedule_sources.find(item => item.id === itemIds[1]);
    assert.equal(meal.meal_total, total); assert.equal(meal.meal_contact, "Synthetic main contact");
    assert.equal(meal.meal_menu, "Vegetable soup"); assert.equal(meal.meal_provider, "Synthetic meal group");
    assert.equal(meal.schedule_notes, null); assert.equal(meal.task_description, null); assert.deepEqual(meal.custom_values, {});
  }
  runPsql(`update public.task_presets set description='Later current preset wording.' where id=${sqlUuid(presetId)};`);
  const afterPresetEdit = await rpcRead(anon, issued.token);
  assert.equal(afterPresetEdit.calendar.items.find(item => item.id === itemIds[0])?.taskDescription, null, "Preset changes must never expose instructions to bearers.");
  assert.equal(afterPresetEdit.calendar.items.find(item => item.id === itemIds[0])?.scheduleNotes ?? null, null, "Occurrence notes must remain private after preset edits.");
  assert(!JSON.stringify(afterPresetEdit).includes("assignment_instruction_revisions"));
  assert(!serialized.includes("assignment_instruction_revisions") && !serialized.includes("actor_auth_user_id"));
  for (const forbidden of ["private setup note", "private lunch note", "restricted location", "Current preset instructions", "Synthetic entrance", "Private draft", "draft secret", contactIds[0], issued.token]) {
    assert(!serialized.includes(forbidden), `Shared projection leaked ${forbidden}.`);
  }
  assert.equal((await rpcRead(anon, "A".repeat(43))).kind, "unavailable");
  const malformed = await anon.rpc("read_project_quick_view_by_token", { p_bearer_token: "bad", p_project_date: "2026-09-02" });
  assert(!malformed.error && parseSharedProjectQuickView(malformed.data).kind === "unavailable");

  const otherIssuedResult = await otherOwner.client.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceIds[1] });
  assert(!otherIssuedResult.error);
  const otherIssued = parseIssuedProjectQuickViewAccess(otherIssuedResult.data); secrets.add(otherIssued.token);
  const crossProjectContact = await contactRead(otherIssued.token, assignmentIds[0]);
  assert(!crossProjectContact.error && crossProjectContact.data.length === 0, "Other project's bearer returned contact data.");
  const otherView = await rpcRead(anon, otherIssued.token);
  assert.equal(otherView.kind, "ready");
  assert.equal(otherView.workspaceDisplayName, "Shared Quick View Two");
  assert(!JSON.stringify(otherView).includes("Shared Quick View One"), "One project token crossed workspace scope.");

  const expiredBearer = randomBytes(32).toString("base64url"); secrets.add(expiredBearer);
  const endedBearer = randomBytes(32).toString("base64url"); secrets.add(endedBearer);
  runPsql(`
    insert into public.project_quick_view_access_tokens (workspace_id, token_verifier_hash, expires_at, created_at, issued_by_project_contact_id)
    values
      (${sqlUuid(workspaceIds[0])}, decode(${sqlText(createHash("sha256").update(expiredBearer).digest("hex"))}, 'hex'), now() - interval '1 hour', now() - interval '2 days', ${sqlUuid(contactIds[0])}),
      (${sqlUuid(workspaceIds[2])}, decode(${sqlText(createHash("sha256").update(endedBearer).digest("hex"))}, 'hex'), now() + interval '30 days', now(), ${sqlUuid(contactIds[0])});
  `);
  assert.equal((await rpcRead(anon, expiredBearer)).kind, "unavailable");
  assert.equal((await rpcRead(anon, endedBearer)).kind, "unavailable");
  for (const bearer of [expiredBearer, endedBearer]) {
    const denied = await contactRead(bearer, assignmentIds[0]);
    assert(!denied.error && denied.data.length === 0, "Expired or ended project's bearer returned contact data.");
  }

  const revoke = await owner.client.rpc("revoke_project_quick_view_access", { p_workspace_id: workspaceIds[0] });
  assert(!revoke.error && revoke.data >= 1);
  assert.equal((await rpcRead(anon, issued.token)).kind, "unavailable", "Revocation must invalidate established-session bearer reads.");
  const revokedContact = await contactRead(issued.token, assignmentIds[0]);
  assert(!revokedContact.error && revokedContact.data.length === 0, "Revoked bearer returned contact data.");
  const state = await owner.client.rpc("read_project_quick_view_share_state", { p_workspace_id: workspaceIds[0] });
  assert(!state.error && state.data[0].shared_access_enabled === false && state.data[0].active_link_count === 0);

  const bearers = [];
  for (let index = 0; index < 6; index += 1) {
    const result = await owner.client.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceIds[0] });
    assert(!result.error); const parsed = parseIssuedProjectQuickViewAccess(result.data); bearers.push(parsed.token); secrets.add(parsed.token);
  }
  assert.equal(new Set(bearers).size, 6, "Every issued bearer must be unique.");
  assert.equal(Number(runPsql(`select count(*) from public.project_quick_view_access_tokens where workspace_id = ${sqlUuid(workspaceIds[0])} and revoked_at is null and expires_at > now();`)), 5, "Active-link lifecycle must remain bounded.");
  runPsql(`update public.workspaces set ends_on = (now() at time zone 'America/Denver')::date - 1 where id = ${sqlUuid(workspaceIds[0])};`);
  await expectError("ended project creation", () => owner.client.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceIds[0] }));
  await expectError("ended project sharing state", () => owner.client.rpc("read_project_quick_view_share_state", { p_workspace_id: workspaceIds[0] }));
  assert.equal((await rpcRead(anon, bearers.at(-1))).kind, "unavailable", "Project end must invalidate an otherwise active link.");
  runPsql(`update public.workspaces set ends_on = '2030-09-30' where id = ${sqlUuid(workspaceIds[0])};`);

  console.log("Shared Project Quick View credential, authorization, resolution, isolation, and revocation checks passed.");
} catch (error) {
  console.error(redact(error)); process.exitCode = 1;
} finally {
  try { await cleanup(); } catch (error) { console.error(redact(error)); process.exitCode = 1; }
}
