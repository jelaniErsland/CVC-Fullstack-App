import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  bozemanBetaCapabilitySets,
  buildWorkspaceAccessProvisioningSql,
} from "../lib/workspaces/provisioning.server.ts";
import {
  createManualVolunteerProfileWithClient,
  normalizeManualVolunteerProfileInput,
  readVolunteerProfilesWithClient,
  updateVolunteerProfileManualFieldsWithClient,
} from "../lib/volunteers/server.ts";
import {
  describeVolunteerProfileManagementCutover,
  selectVolunteerManagementWorkspaceContext,
} from "../lib/volunteers/routeRead.server.ts";
import { parseProjectContactGrant, isEffectiveWorkspaceReadGrant } from "../lib/auth/grant.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const secrets = new Set();
const authUserIds = [];
const clients = [];
let cleanupCompleted = false;

const fixture = {
  namespace: `qa-12-15-${randomUUID()}`,
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
    throw new Error(redact(result.stderr || "The local volunteer SQL command failed."));
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
    "Local Supabase is unavailable. Start Docker Desktop and local Supabase before running this local-only validation.",
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

async function createAuthenticatedUser(label) {
  const email = `${fixture.namespace}-${label}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  secrets.add(email);
  secrets.add(password);
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, "Disposable local Auth user creation failed.");
  if (signup.data.session?.access_token) secrets.add(signup.data.session.access_token);
  if (signup.data.session?.refresh_token) secrets.add(signup.data.session.refresh_token);
  if (!signup.data.session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, "Disposable local Auth user sign-in failed.");
    if (signin.data.session.access_token) secrets.add(signin.data.session.access_token);
    if (signin.data.session.refresh_token) secrets.add(signin.data.session.refresh_token);
  }
  const user = await client.auth.getUser();
  assert.equal(user.data.user?.id, signup.data.user.id);
  authUserIds.push(signup.data.user.id);
  clients.push(client);
  return { client, userId: signup.data.user.id };
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
      publicIntakeEnabled: true,
    },
    contact: {
      authUserId,
      status: "active",
    },
    grant: {
      role,
      capabilities,
      status: "active",
      validFrom: fixture.validFrom,
      validUntil: null,
    },
  };
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if ([".next", "node_modules", ".git"].includes(entry.name)) return [];
        return collectFiles(entryPath);
      }
      return [entryPath];
    }),
  );
  return nested.flat();
}

async function verifyStaticBoundaries() {
  const migration = await readFile(
    path.join(root, "supabase", "migrations", "20260714121500_manual_volunteer_profiles.sql"),
    "utf8",
  );
  const route = await readFile(path.join(root, "app", "admin", "volunteers", "page.tsx"), "utf8");
  const routeRead = await readFile(
    path.join(root, "lib", "volunteers", "routeRead.server.ts"),
    "utf8",
  );
  const server = await readFile(path.join(root, "lib", "volunteers", "server.ts"), "utf8");
  const profile = await readFile(path.join(root, "lib", "volunteers", "profile.ts"), "utf8");
  const directory = await readFile(
    path.join(root, "components", "VolunteerDirectory.tsx"),
    "utf8",
  );
  const card = await readFile(path.join(root, "components", "VolunteerCard.tsx"), "utf8");
  const packageSource = await readFile(path.join(root, "package.json"), "utf8");

  assert.match(migration, /profile_source text not null default 'questionnaire'/);
  assert.match(migration, /source_submission_id drop not null/);
  assert.match(migration, /create_manual_volunteer_profile/);
  assert.match(migration, /update_volunteer_profile_manual_fields/);
  assert.match(migration, /grant execute on function public\.create_manual_volunteer_profile/);
  assert.match(migration, /grant execute on function public\.update_volunteer_profile_manual_fields/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|all).*volunteer_profiles.*to authenticated/i);
  assert.doesNotMatch(migration, /service_role|SUPABASE_SERVICE_ROLE_KEY|insert\s+into\s+public\.workspaces/i);
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /fetchCache = "force-no-store"/);
  assert.match(route, /readVolunteerManagementRouteState/);
  assert.match(route, /createManualVolunteerProfileWithClient/);
  assert.match(route, /updateVolunteerProfileManualFieldsWithClient/);
  assert.doesNotMatch(route, /mockData|projectVolunteers|getVolunteerById|\/admin\/volunteers\/\$\{/);
  assert.match(routeRead, /^import "server-only";/);
  assert.match(routeRead, /VOLUNTEER_PROFILE_MANAGEMENT_MOCK_FALLBACK_ALLOWED = false/);
  assert.match(routeRead, /volunteers\.view/);
  assert.match(routeRead, /volunteers\.edit/);
  assert.doesNotMatch(
    `${routeRead}\n${server}`,
    /process\.env\.SUPABASE_SERVICE_ROLE_KEY|createServiceRole|auth\.admin/i,
  );
  assert.match(server, /create_manual_volunteer_profile/);
  assert.match(server, /update_volunteer_profile_manual_fields/);
  assert.match(profile, /profileSource: "questionnaire" \| "manual"/);
  assert.doesNotMatch(`${directory}\n${card}`, /lib\/mockData|ProjectVolunteer|getVolunteerById/);
  assert.match(packageSource, /"test:volunteer-profile-management"/);

  const importedProductFiles = [];
  const appAndComponentFiles = (await collectFiles(path.join(root, "app")))
    .concat(await collectFiles(path.join(root, "components")))
    .filter((file) => /\.(ts|tsx)$/.test(file));
  for (const file of appAndComponentFiles) {
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    const source = await readFile(file, "utf8");
    if (
      source.includes("volunteers/routeRead.server") &&
      relative !== "app/admin/volunteers/page.tsx"
    ) {
      importedProductFiles.push(relative);
    }
  }
  assert.deepEqual(importedProductFiles, []);

  const cutover = describeVolunteerProfileManagementCutover();
  assert.equal(cutover.routeCutoverImplemented, true);
  assert.equal(cutover.persistedTruthSource, true);
  assert.equal(cutover.mockFallbackAllowed, false);
  assert.equal(cutover.serviceRoleAvailable, false);
  assert.equal(cutover.browserProvenanceInputAllowed, false);
  assert.equal(cutover.responseLinkReopened, false);
}

async function readAccess(client) {
  const {
    data: { user },
  } = await client.auth.getUser();
  assert(user?.id);
  const { data: contact, error: contactError } = await client
    .from("project_contacts")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  assert(!contactError, "Project contact read failed for disposable client.");
  const contactId = typeof contact?.id === "string" ? contact.id : null;
  const { data: grantRows, error: grantError } = await client
    .from("workspace_contact_grants")
    .select(
      "id,workspace_id,project_contact_id,role,capabilities,status,valid_from,valid_until,revoked_at",
    )
    .order("workspace_id");
  assert(!grantError, "Workspace grant read failed for disposable client.");
  const grants = (grantRows ?? [])
    .map(parseProjectContactGrant)
    .filter((grant) => isEffectiveWorkspaceReadGrant(grant));
  const { data: workspaceRows, error: workspaceError } = await client
    .from("workspaces")
    .select(
      "id,workspace_key,display_name,lifecycle,timezone,starts_on,ends_on,public_intake_enabled,created_at,updated_at",
    )
    .order("display_name");
  assert(!workspaceError, "Granted workspace read failed for disposable client.");
  const workspaces = (workspaceRows ?? []).map((workspace) => ({
    id: workspace.id,
    key: workspace.workspace_key,
    displayName: workspace.display_name,
    lifecycle: workspace.lifecycle,
    timezone: workspace.timezone,
    startsOn: workspace.starts_on,
    endsOn: workspace.ends_on,
    publicIntakeEnabled: workspace.public_intake_enabled,
    createdAt: workspace.created_at,
    updatedAt: workspace.updated_at,
  }));
  return { userId: user.id, contactId, grants, workspaces };
}

function questionnaireAnswers(label) {
  return {
    aboutYou: {
      name: `${fixture.namespace} ${label} Questionnaire Volunteer`,
      email: `${fixture.namespace}-${label}@example.invalid`,
      phone: "406-555-1212",
      congregation: "Bozeman",
      preferredContactMethod: "Email",
    },
    availability: {
      weekdays: ["Monday"],
      preferredTimes: ["Morning"],
    },
    skillsExperience: {
      categories: ["General"],
      maintenanceTaskCards: false,
    },
    emergencyContact: {
      name: "Emergency Contact",
      phone: "406-555-4545",
    },
    otherWaysToHelp: {},
  };
}

async function expectRpcFailure(promise, label) {
  let failed = false;
  try {
    await promise;
  } catch {
    failed = true;
  }
  assert.equal(failed, true, `${label} must fail closed`);
}

async function run() {
  assert(supabaseUrl && anonKey, "Local Supabase env values are required.");
  assert(isLoopbackUrl(supabaseUrl), "Refusing non-loopback Supabase URL for volunteer management validation.");
  await verifyStaticBoundaries();

  assert.throws(() =>
    normalizeManualVolunteerProfileInput({
      fullName: "Forge",
      email: "forge@example.invalid",
      profileSource: "manual",
    }),
  );
  assert.throws(() => normalizeManualVolunteerProfileInput({ fullName: "", email: "" }));
  assert.throws(() =>
    normalizeManualVolunteerProfileInput({
      fullName: "Bad Email",
      email: "not-an-email",
    }),
  );

  const containerName = await resolveLocalDatabaseContainer();
  await applyManualVolunteerMigration(containerName);

  const full = await createAuthenticatedUser("full");
  const viewOnly = await createAuthenticatedUser("view-only");
  const noView = await createAuthenticatedUser("no-view");
  const roleOnly = await createAuthenticatedUser("role-only");
  const other = await createAuthenticatedUser("other");

  const targetKey = `${fixture.namespace}-target`;
  const otherKey = `${fixture.namespace}-other`;
  const workspaceResult = JSON.parse(
    runPsql(
      containerName,
      buildWorkspaceAccessProvisioningSql(
        provisioningInput({
          key: targetKey,
          displayName: "QA 12.15 Target Workspace",
          authUserId: full.userId,
          capabilities: bozemanBetaCapabilitySets.mainScheduler,
        }),
      ),
    ),
  );
  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput({
        key: targetKey,
        displayName: "QA 12.15 Target Workspace",
        authUserId: viewOnly.userId,
        capabilities: ["workspace.read", "volunteers.view"],
        role: "assistant_contact",
      }),
    ),
  );
  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput({
        key: targetKey,
        displayName: "QA 12.15 Target Workspace",
        authUserId: noView.userId,
        capabilities: ["workspace.read"],
        role: "assistant_contact",
      }),
    ),
  );
  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput({
        key: targetKey,
        displayName: "QA 12.15 Target Workspace",
        authUserId: roleOnly.userId,
        capabilities: ["workspace.read"],
        role: "main_contact",
      }),
    ),
  );
  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput({
        key: otherKey,
        displayName: "QA 12.15 Other Workspace",
        authUserId: other.userId,
        capabilities: bozemanBetaCapabilitySets.mainScheduler,
      }),
    ),
  );

  const fullAccess = await readAccess(full.client);
  const fullSelection = selectVolunteerManagementWorkspaceContext({
    projectContactId: fullAccess.contactId,
    ownGrants: fullAccess.grants,
    workspaces: fullAccess.workspaces,
  });
  assert.equal(fullSelection.ok, true);
  assert.equal(fullSelection.canEdit, true);

  const viewOnlyAccess = await readAccess(viewOnly.client);
  const viewOnlySelection = selectVolunteerManagementWorkspaceContext({
    projectContactId: viewOnlyAccess.contactId,
    ownGrants: viewOnlyAccess.grants,
    workspaces: viewOnlyAccess.workspaces,
  });
  assert.equal(viewOnlySelection.ok, true);
  assert.equal(viewOnlySelection.canEdit, false);

  const noViewAccess = await readAccess(noView.client);
  assert.equal(
    selectVolunteerManagementWorkspaceContext({
      projectContactId: noViewAccess.contactId,
      ownGrants: noViewAccess.grants,
      workspaces: noViewAccess.workspaces,
    }).reason,
    "missing_volunteers_view",
  );

  const roleOnlyAccess = await readAccess(roleOnly.client);
  assert.equal(
    selectVolunteerManagementWorkspaceContext({
      projectContactId: roleOnlyAccess.contactId,
      ownGrants: roleOnlyAccess.grants,
      workspaces: roleOnlyAccess.workspaces,
    }).reason,
    "missing_volunteers_view",
  );

  const beforeSubmissionCount = runPsql(
    containerName,
    `select count(*)::text from public.questionnaire_submissions where workspace_id = ${sqlText(workspaceResult.workspaceId)}::uuid;`,
  );
  const createdProfileId = await createManualVolunteerProfileWithClient(
    full.client,
    workspaceResult.workspaceId,
    normalizeManualVolunteerProfileInput({
      fullName: ` ${fixture.namespace} Manual Volunteer `,
      email: `${fixture.namespace}-manual@example.invalid`,
      phone: "406-555-0101",
      congregation: "Bozeman",
      preferredContactMethod: "Text",
      readinessStatus: "ready",
      lifecycle: "active",
      profileNotes: "Manual beta scheduling profile.",
    }),
  );
  const afterSubmissionCount = runPsql(
    containerName,
    `select count(*)::text from public.questionnaire_submissions where workspace_id = ${sqlText(workspaceResult.workspaceId)}::uuid;`,
  );
  assert.equal(afterSubmissionCount, beforeSubmissionCount, "manual create must not create a questionnaire submission");

  const profilesAfterCreate = await readVolunteerProfilesWithClient(
    full.client,
    workspaceResult.workspaceId,
  );
  const createdProfile = profilesAfterCreate.find((profile) => profile.id === createdProfileId);
  assert(createdProfile);
  assert.equal(createdProfile.workspaceId, workspaceResult.workspaceId);
  assert.equal(createdProfile.profileSource, "manual");
  assert.equal(createdProfile.sourceSubmissionId, null);
  assert.equal(createdProfile.fullName, `${fixture.namespace} Manual Volunteer`);
  assert.equal(createdProfile.email, `${fixture.namespace}-manual@example.invalid`);

  await updateVolunteerProfileManualFieldsWithClient(
    full.client,
    createdProfileId,
    normalizeManualVolunteerProfileInput({
      fullName: `${fixture.namespace} Edited Volunteer`,
      email: `${fixture.namespace}-edited@example.invalid`,
      phone: "406-555-0202",
      congregation: "Bozeman",
      preferredContactMethod: "Email",
      lifecycle: "inactive",
      readinessStatus: "on_hold",
      profileNotes: "Edited and persisted.",
    }),
  );
  const profilesAfterEdit = await readVolunteerProfilesWithClient(
    full.client,
    workspaceResult.workspaceId,
  );
  const editedProfile = profilesAfterEdit.find((profile) => profile.id === createdProfileId);
  assert(editedProfile);
  assert.equal(editedProfile.fullName, `${fixture.namespace} Edited Volunteer`);
  assert.equal(editedProfile.lifecycle, "inactive");
  assert.equal(editedProfile.readinessStatus, "on_hold");
  assert.equal(editedProfile.profileSource, "manual");
  assert.equal(editedProfile.sourceSubmissionId, null);

  const viewOnlyProfiles = await readVolunteerProfilesWithClient(
    viewOnly.client,
    workspaceResult.workspaceId,
  );
  assert.equal(viewOnlyProfiles.length, 1);
  await expectRpcFailure(
    createManualVolunteerProfileWithClient(
      viewOnly.client,
      workspaceResult.workspaceId,
      normalizeManualVolunteerProfileInput({
        fullName: "View Only Cannot Create",
        email: "view-only@example.invalid",
      }),
    ),
    "view-only create",
  );
  await expectRpcFailure(
    updateVolunteerProfileManualFieldsWithClient(
      viewOnly.client,
      createdProfileId,
      normalizeManualVolunteerProfileInput({
        fullName: "View Only Cannot Edit",
        email: "view-only-edit@example.invalid",
      }),
    ),
    "view-only edit",
  );

  const noViewProfiles = await readVolunteerProfilesWithClient(
    noView.client,
    workspaceResult.workspaceId,
  );
  assert.deepEqual(noViewProfiles, []);
  const otherProfiles = await readVolunteerProfilesWithClient(
    other.client,
    workspaceResult.workspaceId,
  );
  assert.deepEqual(otherProfiles, []);
  await expectRpcFailure(
    updateVolunteerProfileManualFieldsWithClient(
      other.client,
      createdProfileId,
      normalizeManualVolunteerProfileInput({
        fullName: "Wrong Workspace Cannot Edit",
        email: "wrong-workspace@example.invalid",
      }),
    ),
    "wrong-workspace edit",
  );

  assert.throws(
    () =>
      normalizeManualVolunteerProfileInput({
        fullName: "Malformed",
        email: "malformed@example.invalid",
        phone: "bad<>phone",
      }),
    /phone/,
  );

  const submissionId = randomUUID();
  runPsql(
    containerName,
    `insert into public.questionnaire_submissions (
      id, workspace_id, status, source, questionnaire_version, answers
    ) values (
      ${sqlText(submissionId)}::uuid,
      ${sqlText(workspaceResult.workspaceId)}::uuid,
      'submitted',
      'admin_entry',
      1,
      ${sqlText(JSON.stringify(questionnaireAnswers("converted")))}::jsonb
    );`,
  );
  const converted = await full.client.rpc(
    "convert_questionnaire_submission_to_volunteer_profile",
    { p_submission_id: submissionId },
  );
  assert(!converted.error && typeof converted.data === "string");
  const profilesWithConverted = await readVolunteerProfilesWithClient(
    full.client,
    workspaceResult.workspaceId,
  );
  const convertedProfile = profilesWithConverted.find((profile) => profile.id === converted.data);
  assert(convertedProfile);
  assert.equal(convertedProfile.profileSource, "questionnaire");
  assert.equal(convertedProfile.sourceSubmissionId, submissionId);
  await updateVolunteerProfileManualFieldsWithClient(
    full.client,
    converted.data,
    normalizeManualVolunteerProfileInput({
      fullName: `${fixture.namespace} Converted Edited`,
      email: `${fixture.namespace}-converted-edited@example.invalid`,
      phone: "406-555-3333",
      congregation: "Bozeman",
      preferredContactMethod: "Phone",
      lifecycle: "active",
      readinessStatus: "ready",
      profileNotes: "Questionnaire provenance preserved.",
    }),
  );
  const convertedProvenance = runPsql(
    containerName,
    `select profile_source || ':' || coalesce(source_submission_id::text, 'null')
from public.volunteer_profiles
where id = ${sqlText(converted.data)}::uuid;`,
  );
  assert.equal(convertedProvenance, `questionnaire:${submissionId}`);

  const otherAccess = await readAccess(other.client);
  assert.deepEqual(
    otherAccess.workspaces.map((workspace) => workspace.key),
    [otherKey],
  );

  console.log("Volunteer profile management local validation passed.");
  console.log("Confirmed persisted create/edit, provenance, authorization isolation, and zero-secret output.");
}

async function cleanup(containerName) {
  for (const client of clients) {
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
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
delete from public.volunteer_profiles
where workspace_id in (
  select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}
);
delete from public.questionnaire_submissions
where workspace_id in (
  select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}
);
delete from public.workspace_contact_grants
where workspace_id in (
  select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}
)
or project_contact_id in (
  select id from public.project_contacts where auth_user_id = any(array[${authIdArray}])
);
delete from public.project_contacts where auth_user_id = any(array[${authIdArray}]);
delete from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)};
${authDeletes}
commit;
select (
  (select count(*) from public.volunteer_profiles where full_name like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.questionnaire_submissions where answers::text like ${sqlText(`%${fixture.namespace}%`)}) +
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${authIdArray}])) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)})) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}-%@example.invalid`)})
)::text;`,
  );
  assert.equal(residue, "0", `Volunteer profile management cleanup left residue count ${residue}.`);
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
