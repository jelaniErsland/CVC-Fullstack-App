import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { setProjectDayExpectedOnSiteWithClient } from "../lib/operations/projectDay.server.ts";
import {
  readAuthorizedFoodOperationalProjection,
  readAuthorizedQuickViewSafeProjection,
} from "../lib/operations/projectQuickView.server.ts";
import { readSchedulerFacetProjectionsWithVerifiedContext } from "../lib/questionnaires/schedulerFacets.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const namespace = `qa-project-day-${randomUUID()}`;
const workspaceIds = [randomUUID(), randomUUID(), randomUUID()];
const contactIds = [randomUUID(), randomUUID(), randomUUID()];
const grantIds = [randomUUID(), randomUUID(), randomUUID()];
const calendarItemIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const volunteerProfileIds = [randomUUID(), randomUUID()];
const authUserIds = [];
const clients = [];
const secrets = new Set();
let containerName;

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function sqlText(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  return `${sqlText(value)}::uuid`;
}

function sqlUuidArray(values) {
  return values.length === 0
    ? "array[]::uuid[]"
    : `array[${values.map(sqlUuid).join(",")}]`;
}

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function normalizeGeneratedTypes(value) {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function redact(value) {
  let message = value instanceof Error ? value.stack ?? value.message : String(value);
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, "[redacted]");
  }
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]")
    .slice(0, 1800);
}

function runPsql(sql) {
  const result = command(
    "docker",
    ["exec", "-i", containerName, "psql", "--no-psqlrc", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    { input: sql },
  );
  if (result.status !== 0) throw new Error(redact(result.stderr || "Local Project Day SQL failed."));
  return result.stdout.trim();
}

async function resolveLocalDatabaseContainer() {
  assert(supabaseUrl && anonKey, "Local Supabase environment variables are required.");
  assert(isLoopbackUrl(supabaseUrl), "Project Day regression refuses non-loopback Supabase.");
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define a local project_id.");
  const candidate = `supabase_db_${projectId}`;
  const inspect = command("docker", ["inspect", "--format", "{{.State.Running}}", candidate]);
  assert(inspect.status === 0 && inspect.stdout.trim() === "true", "Local Supabase must be running.");
  return candidate;
}

async function createAuthenticatedUser(label) {
  const email = `${namespace}-${label}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user && signup.data.session, `Auth fixture ${label} could not sign in.`);
  secrets.add(signup.data.session.access_token);
  secrets.add(signup.data.session.refresh_token);
  authUserIds.push(signup.data.user.id);
  clients.push(client);
  return { client, userId: signup.data.user.id };
}

async function expectFailure(label, operation) {
  try {
    const result = await operation();
    if (result?.error) return;
  } catch {
    return;
  }
  assert.fail(`${label} should fail closed.`);
}

async function cleanup() {
  await Promise.allSettled(clients.map((client) => client.auth.signOut()));
  if (!containerName) return;
  runPsql(`
    delete from public.project_days where workspace_id = any(${sqlUuidArray(workspaceIds)});
    delete from public.calendar_items where id = any(${sqlUuidArray(calendarItemIds)});
    delete from public.volunteer_profiles where id = any(${sqlUuidArray(volunteerProfileIds)});
    delete from public.workspace_contact_grants where id = any(${sqlUuidArray(grantIds)});
    delete from public.project_contacts where id = any(${sqlUuidArray(contactIds)});
    delete from public.workspaces where id = any(${sqlUuidArray(workspaceIds)});
    delete from auth.users where id = any(${sqlUuidArray(authUserIds)});
  `);
  const residue = Number(runPsql(`
    select
      (select count(*) from public.workspaces where workspace_key like ${sqlText(`${namespace}%`)}) +
      (select count(*) from auth.users where email like ${sqlText(`${namespace}%`)});
  `));
  assert.equal(residue, 0, "Project Day fixture residue must be zero.");
}

try {
  containerName = await resolveLocalDatabaseContainer();
  const generatedTypes = command(
    "npx",
    ["supabase", "gen", "types", "typescript", "--local", "--schema", "public"],
    { shell: process.platform === "win32" },
  );
  assert.equal(generatedTypes.status, 0, "Local generated database types could not be reproduced.");
  assert.equal(
    normalizeGeneratedTypes(generatedTypes.stdout),
    normalizeGeneratedTypes(await readFile(path.join(root, "lib", "supabase", "database.types.ts"), "utf8")),
    "Committed working-tree database types must exactly match local generation.",
  );
  const [owner, other, noCapability] = await Promise.all([
    createAuthenticatedUser("owner"),
    createAuthenticatedUser("other"),
    createAuthenticatedUser("no-capability"),
  ]);
  runPsql(`
    insert into public.workspaces (id, workspace_key, display_name, lifecycle, timezone)
    values
      (${sqlUuid(workspaceIds[0])}, ${sqlText(`${namespace}-one`)}, 'Project Day One', 'active', 'America/Denver'),
      (${sqlUuid(workspaceIds[1])}, ${sqlText(`${namespace}-two`)}, 'Project Day Two', 'active', 'America/Denver'),
      (${sqlUuid(workspaceIds[2])}, ${sqlText(`${namespace}-three`)}, 'Project Day Three', 'active', 'America/Denver');
    insert into public.project_contacts (id, auth_user_id, status)
    values
      (${sqlUuid(contactIds[0])}, ${sqlUuid(owner.userId)}, 'active'),
      (${sqlUuid(contactIds[1])}, ${sqlUuid(other.userId)}, 'active'),
      (${sqlUuid(contactIds[2])}, ${sqlUuid(noCapability.userId)}, 'active');
    insert into public.workspace_contact_grants
      (id, workspace_id, project_contact_id, role, capabilities, status, valid_from)
    values
      (${sqlUuid(grantIds[0])}, ${sqlUuid(workspaceIds[0])}, ${sqlUuid(contactIds[0])}, 'main_contact', array['workspace.read','calendar.view','calendar.edit','volunteers.view']::text[], 'active', now() - interval '1 day'),
      (${sqlUuid(grantIds[1])}, ${sqlUuid(workspaceIds[1])}, ${sqlUuid(contactIds[1])}, 'main_contact', array['workspace.read','calendar.view','calendar.edit','volunteers.view']::text[], 'active', now() - interval '1 day'),
      (${sqlUuid(grantIds[2])}, ${sqlUuid(workspaceIds[2])}, ${sqlUuid(contactIds[2])}, 'main_contact', array['workspace.read']::text[], 'active', now() - interval '1 day');
    insert into public.calendar_items
      (id, workspace_id, title_snapshot, task_type_snapshot, schedule_kind, start_date, start_time, end_time, timezone, needed_count, schedule_notes, publication_state, published_at, published_by_project_contact_id)
    values
      (${sqlUuid(calendarItemIds[0])}, ${sqlUuid(workspaceIds[0])}, 'Published setup', 'general', 'timed', '2026-09-14', '08:00', '12:00', 'America/Denver', 3, 'private general note', 'published', now(), ${sqlUuid(contactIds[0])}),
      (${sqlUuid(calendarItemIds[1])}, ${sqlUuid(workspaceIds[0])}, 'Private draft', 'general', 'timed', '2026-09-14', '13:00', '14:00', 'America/Denver', 2, 'private draft note', 'draft', null, null),
      (${sqlUuid(calendarItemIds[2])}, ${sqlUuid(workspaceIds[0])}, 'Restricted security detail', 'security', 'timed', '2026-09-14', '14:00', '15:00', 'America/Denver', 2, 'restricted post detail', 'published', now(), ${sqlUuid(contactIds[0])}),
      (${sqlUuid(calendarItemIds[3])}, ${sqlUuid(workspaceIds[0])}, 'Published lunch', 'food', 'date_based', '2026-09-14', null, null, 'America/Denver', 4, 'private food note', 'published', now(), ${sqlUuid(contactIds[0])});
    insert into public.volunteer_profiles
      (id, workspace_id, lifecycle, readiness_status, full_name, email, congregation, availability_snapshot, skills_help_snapshot, profile_notes, profile_source, manual_created_at, manual_created_by_project_contact_id)
    values
      (${sqlUuid(volunteerProfileIds[0])}, ${sqlUuid(workspaceIds[0])}, 'active', 'ready', 'Safe Facet Volunteer', 'facet-owner@example.invalid', 'Bozeman North',
        '{"weekdays":["Monday","Saturday"],"preferredTimes":["Morning"],"notes":"private availability note"}'::jsonb,
        '{"skillsExperience":{"categories":["Electrical assist","Food service"],"details":"private skills detail","physicalWorkNotes":"private physical note"},"otherWaysToHelp":{"selected":{"medicalSupport":true}}}'::jsonb,
        'private profile note', 'manual', now(), ${sqlUuid(contactIds[0])}),
      (${sqlUuid(volunteerProfileIds[1])}, ${sqlUuid(workspaceIds[1])}, 'active', 'ready', 'Other Workspace Volunteer', 'facet-other@example.invalid', 'Other',
        '{"weekdays":["Tuesday"],"preferredTimes":["Evening"]}'::jsonb,
        '{"skillsExperience":{"categories":["Security"]}}'::jsonb,
        'cross-workspace private note', 'manual', now(), ${sqlUuid(contactIds[1])});
  `);

  const ownerContext = {
    supabase: owner.client,
    authenticatedUserId: owner.userId,
    projectContactId: contactIds[0],
    ownGrants: [{
      id: grantIds[0],
      workspaceId: workspaceIds[0],
      projectContactId: contactIds[0],
      role: "main_contact",
      capabilities: ["workspace.read", "calendar.view", "calendar.edit", "volunteers.view"],
      status: "active",
      validFrom: "2026-08-30T00:00:00Z",
      validUntil: null,
      revokedAt: null,
    }],
    workspaces: [{
      id: workspaceIds[0],
      key: `${namespace}-one`,
      displayName: "Project Day One",
      lifecycle: "active",
      timezone: "America/Denver",
      startsOn: null,
      endsOn: null,
      publicIntakeEnabled: false,
      createdAt: "2026-08-31T00:00:00Z",
      updatedAt: "2026-08-31T00:00:00Z",
    }],
  };

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonRead = await anon.from("project_days").select("project_date");
  assert(anonRead.error || (anonRead.data ?? []).length === 0, "Anonymous Project Day read must be denied.");

  let row = await setProjectDayExpectedOnSiteWithClient(owner.client, {
    date: "2026-09-14",
    expectedOnSiteCount: null,
  });
  assert.equal(row.expectedOnSiteCount, null);
  const createdAt = row.createdAt;
  for (const value of [0, 1, 275, null]) {
    row = await setProjectDayExpectedOnSiteWithClient(owner.client, {
      date: "2026-09-14",
      expectedOnSiteCount: value,
    });
    assert.equal(row.expectedOnSiteCount, value);
    assert.equal(row.createdAt, createdAt, "Updating a Project Day must preserve creation audit time.");
  }

  const ownerRead = await owner.client
    .from("project_days")
    .select("workspace_id,project_date,expected_on_site_count")
    .eq("workspace_id", workspaceIds[0]);
  assert(!ownerRead.error && ownerRead.data.length === 1);
  assert.equal(ownerRead.data[0].expected_on_site_count, null);
  assert.equal(Number(runPsql(`select count(*) from public.project_days where workspace_id = ${sqlUuid(workspaceIds[0])} and project_date = '2026-09-14'::date;`)), 1, "Workspace/date must remain unique after repeated updates.");

  await setProjectDayExpectedOnSiteWithClient(other.client, {
    date: "2026-09-14",
    expectedOnSiteCount: 18,
  });
  const crossWorkspaceRead = await owner.client
    .from("project_days")
    .select("project_date")
    .eq("workspace_id", workspaceIds[1]);
  assert(!crossWorkspaceRead.error && crossWorkspaceRead.data.length === 0, "Cross-workspace Project Day read must be isolated.");

  await setProjectDayExpectedOnSiteWithClient(owner.client, {
    date: "2026-09-14",
    expectedOnSiteCount: 275,
  });
  const quickView = await readAuthorizedQuickViewSafeProjection(ownerContext, "2026-09-14");
  assert.deepEqual(Object.keys(quickView).sort(), ["date", "expectedOnSiteCount", "projectDisplayName", "publishedSchedule"]);
  assert.deepEqual(quickView.publishedSchedule.map((item) => item.title), ["Published setup", "Published lunch"]);
  const serializedQuickView = JSON.stringify(quickView);
  for (const forbidden of [
    "Safe Facet Volunteer",
    "facet-owner@example.invalid",
    "Other Workspace Volunteer",
    "facet-other@example.invalid",
    "private profile note",
    "private general note",
    "Private draft",
    "Restricted security detail",
    "restricted post detail",
    "workspace_id",
    "assignment_id",
    "questionnaire",
    "token",
    "credential",
    "provider",
    "needs_attention",
  ]) assert.equal(serializedQuickView.includes(forbidden), false, `Runtime Quick View leaked ${forbidden}.`);
  const foodProjection = await readAuthorizedFoodOperationalProjection(ownerContext, "2026-09-14");
  assert.equal(foodProjection.expectedOnSiteCount, 275);
  assert.deepEqual(foodProjection.publishedFoodSchedule.map((item) => item.title), ["Published lunch"]);

  const schedulerFacets = await readSchedulerFacetProjectionsWithVerifiedContext(ownerContext);
  assert.deepEqual(schedulerFacets, [{
    volunteerProfileId: volunteerProfileIds[0],
    congregation: "Bozeman North",
    skillTags: ["Electrical assist", "Food service"],
    availability: { weekdays: ["Monday", "Saturday"], preferredTimes: ["Morning"] },
    keywordTerms: ["bozeman north", "electrical assist", "food service"],
  }]);
  const serializedFacets = JSON.stringify(schedulerFacets);
  for (const forbidden of [
    "Other Workspace Volunteer",
    "private availability note",
    "private skills detail",
    "private physical note",
    "medicalSupport",
    "private profile note",
    "email",
    "phone",
    "birthdate",
  ]) assert.equal(serializedFacets.includes(forbidden), false, `Runtime scheduler facets leaked ${forbidden}.`);

  const noCapabilityRead = await noCapability.client.from("project_days").select("project_date");
  assert(!noCapabilityRead.error && noCapabilityRead.data.length === 0, "Missing calendar.view must hide Project Days.");
  await expectFailure("Missing calendar.edit RPC", () =>
    noCapability.client.rpc("set_current_project_day_expected_on_site", {
      p_project_date: "2026-09-14",
      p_expected_on_site_count: 4,
    }),
  );
  await expectFailure("Negative count", () =>
    owner.client.rpc("set_current_project_day_expected_on_site", {
      p_project_date: "2026-09-15",
      p_expected_on_site_count: -1,
    }),
  );
  await expectFailure("Decimal count", () =>
    owner.client.rpc("set_current_project_day_expected_on_site", {
      p_project_date: "2026-09-15",
      p_expected_on_site_count: 1.5,
    }),
  );
  await expectFailure("Malformed date", () =>
    owner.client.rpc("set_current_project_day_expected_on_site", {
      p_project_date: "not-a-date",
      p_expected_on_site_count: 1,
    }),
  );
  await expectFailure("Browser-supplied workspace authority", () =>
    owner.client.rpc("set_current_project_day_expected_on_site", {
      p_project_date: "2026-09-15",
      p_expected_on_site_count: 1,
      p_workspace_id: workspaceIds[1],
    }),
  );
  await expectFailure("Direct authenticated insert", () =>
    owner.client.from("project_days").insert({
      workspace_id: workspaceIds[0],
      project_date: "2026-09-16",
      expected_on_site_count: 9,
      created_by_project_contact_id: contactIds[0],
      updated_by_project_contact_id: contactIds[0],
    }),
  );
  await expectFailure("Direct authenticated update", () =>
    owner.client
      .from("project_days")
      .update({ expected_on_site_count: 99 })
      .eq("workspace_id", workspaceIds[0]),
  );

  console.log("Project Day local persistence and authorization regression checks passed.");
  console.log("Validated nullable/updatable manual truth, workspace isolation, RLS, and RPC-only writes.");
} catch (error) {
  console.error(redact(error));
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    console.error(redact(cleanupError));
    process.exitCode = 1;
  }
}
