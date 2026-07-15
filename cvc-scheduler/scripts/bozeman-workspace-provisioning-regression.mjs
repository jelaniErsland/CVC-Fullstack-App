import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  BOZEMAN_WORKSPACE_PROVISIONING_OPERATOR_BOUNDARY_AVAILABLE,
  BOZEMAN_WORKSPACE_PROVISIONING_PRODUCT_UI_AVAILABLE,
  BOZEMAN_WORKSPACE_PROVISIONING_SERVICE_ROLE_AVAILABLE,
  BOZEMAN_WORKSPACE_PROVISIONING_SEED_DATA_AVAILABLE,
  BOZEMAN_WORKSPACE_PROVISIONING_RESPONSE_LINK_REOPENED,
  bozemanBetaCapabilitySets,
  buildWorkspaceAccessProvisioningSql,
  describeBozemanWorkspaceProvisioningReadiness,
  existingProjectLocalCapabilities,
  normalizeWorkspaceProvisioningInput,
} from "../lib/workspaces/provisioning.server.ts";
import { isEffectiveWorkspaceReadGrant, parseProjectContactGrant } from "../lib/auth/grant.ts";
import { selectCalendarRouteWorkspaceContext } from "../lib/calendar/routeRead.server.ts";
import { describeBozemanBetaRoadmap } from "../lib/readiness/bozemanBetaRoadmap.server.ts";

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
  namespace: `qa-12-14-${randomUUID()}`,
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
    throw new Error(redact(result.stderr || "The local provisioning SQL command failed."));
  }
  return result.stdout.trim();
}

function expectPsqlFailure(containerName, sql, label) {
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
  assert.notEqual(result.status, 0, `${label} must fail safely`);
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

function provisioningInput({
  key,
  displayName,
  authUserId,
  capabilities,
  role = "main_contact",
  lifecycle = "active",
  grantStatus = "active",
  validFrom = fixture.validFrom,
  validUntil = null,
}) {
  return {
    workspace: {
      key,
      displayName,
      lifecycle,
      timezone: "America/Denver",
      startsOn: "2026-08-01",
      endsOn: "2026-12-31",
      publicIntakeEnabled: false,
    },
    contact: {
      authUserId,
      status: "active",
    },
    grant: {
      role,
      capabilities,
      status: grantStatus,
      validFrom,
      validUntil,
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
  const moduleSource = await readFile(
    path.join(root, "lib", "workspaces", "provisioning.server.ts"),
    "utf8",
  );
  const cliSource = await readFile(
    path.join(root, "scripts", "provision-workspace-access.mjs"),
    "utf8",
  );
  const routeReadSource = await readFile(
    path.join(root, "lib", "calendar", "routeRead.server.ts"),
    "utf8",
  );
  const packageSource = await readFile(path.join(root, "package.json"), "utf8");
  const localSetup = await readFile(path.join(root, "docs", "SUPABASE_LOCAL_SETUP.md"), "utf8");
  const betaRoadmap = await readFile(path.join(root, "docs", "BOZEMAN_BETA_ROADMAP.md"), "utf8");

  assert.match(moduleSource, /^import "server-only";/);
  assert.equal(BOZEMAN_WORKSPACE_PROVISIONING_OPERATOR_BOUNDARY_AVAILABLE, true);
  assert.equal(BOZEMAN_WORKSPACE_PROVISIONING_PRODUCT_UI_AVAILABLE, false);
  assert.equal(BOZEMAN_WORKSPACE_PROVISIONING_SERVICE_ROLE_AVAILABLE, false);
  assert.equal(BOZEMAN_WORKSPACE_PROVISIONING_SEED_DATA_AVAILABLE, false);
  assert.equal(BOZEMAN_WORKSPACE_PROVISIONING_RESPONSE_LINK_REOPENED, false);
  assert.deepEqual(bozemanBetaCapabilitySets.mainScheduler, [
    "workspace.read",
    "questionnaires.review",
    "volunteers.view",
    "volunteers.edit",
    "tasks.view",
    "tasks.edit",
    "calendar.view",
    "calendar.edit",
    "assignments.view",
    "assignments.edit",
  ]);
  assert.ok(existingProjectLocalCapabilities.includes("calendar.edit"));
  assert.ok(!existingProjectLocalCapabilities.includes("communications.send"));

  assert.doesNotMatch(
    `${moduleSource}\n${cliSource}`,
    /process\.env\.SUPABASE_SERVICE_ROLE_KEY|createServiceRole|auth\.admin|generateLink|inviteUserByEmail|sendEmail|seedDatabase/i,
  );
  assert.match(cliSource, /--emit-sql/);
  assert.match(cliSource, /--local-execute/);
  assert.match(routeReadSource, /eligible\.length > 1/);
  assert.match(routeReadSource, /CALENDAR_ROUTE_AMBIGUOUS_WORKSPACE_SELECTION_ALLOWED = false/);
  assert.match(packageSource, /"test:bozeman-workspace-provisioning"/);
  assert.match(localSetup, /test:bozeman-workspace-provisioning/);
  assert.match(betaRoadmap, /12\.14 Bozeman Workspace Access and Provisioning Readiness/);

  const appAndComponentFiles = (await collectFiles(root)).filter((file) => {
    const relative = path.relative(root, file).replaceAll(path.sep, "/");
    return (
      (relative.startsWith("app/") || relative.startsWith("components/")) &&
      /\.(ts|tsx|js|jsx)$/.test(relative)
    );
  });
  for (const file of appAndComponentFiles) {
    const source = await readFile(file, "utf8");
    assert.equal(
      source.includes("workspaces/provisioning") ||
        source.includes("provision-workspace-access") ||
        source.includes("BOZEMAN_WORKSPACE_PROVISIONING"),
      false,
      `product route/component must not import provisioning boundary: ${path.relative(root, file)}`,
    );
  }
}

async function verifyCliEmitSql(input) {
  const tempPath = path.join(os.tmpdir(), `${fixture.namespace}-provisioning.json`);
  await writeFile(tempPath, JSON.stringify(input, null, 2), "utf8");
  try {
    const result = command("node", [
      "--conditions=react-server",
      "--no-warnings",
      "--experimental-strip-types",
      "scripts/provision-workspace-access.mjs",
      "--input",
      tempPath,
      "--emit-sql",
    ]);
    assert.equal(result.status, 0, "operator CLI --emit-sql must succeed for validated input");
    assert.match(result.stdout, /workspace_key/);
    assert.doesNotMatch(result.stdout, /SUPABASE_SERVICE_ROLE_KEY|service_role|password|access_token|refresh_token/i);
  } finally {
    await rm(tempPath, { force: true });
  }
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
  const grantState =
    grants.length > 0
      ? { status: "authorized", grants }
      : { status: "no_active_grants", grants: [] };
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
  return { userId: user.id, contactId, grantState, workspaces };
}

async function run() {
  assert(supabaseUrl && anonKey, "Local Supabase env values are required.");
  assert(isLoopbackUrl(supabaseUrl), "Refusing non-loopback Supabase URL for local provisioning validation.");
  await verifyStaticBoundaries();
  const readiness = describeBozemanWorkspaceProvisioningReadiness();
  assert.equal(readiness.realBozemanDataCommitted, false);
  assert.equal(describeBozemanBetaRoadmap().target, "bozeman");

  assert.throws(() =>
    normalizeWorkspaceProvisioningInput(
      provisioningInput({
        key: "Bad Key",
        displayName: "Bad",
        authUserId: randomUUID(),
        capabilities: ["workspace.read"],
      }),
    ),
  );
  assert.throws(() =>
    normalizeWorkspaceProvisioningInput(
      provisioningInput({
        key: `${fixture.namespace}-missing-read`,
        displayName: "Missing read",
        authUserId: randomUUID(),
        capabilities: ["calendar.view"],
      }),
    ),
  );
  assert.throws(() =>
    normalizeWorkspaceProvisioningInput(
      provisioningInput({
        key: `${fixture.namespace}-unknown-capability`,
        displayName: "Unknown capability",
        authUserId: randomUUID(),
        capabilities: ["workspace.read", "workspace.owner"],
      }),
    ),
  );
  assert.throws(() =>
    normalizeWorkspaceProvisioningInput({
      ...provisioningInput({
        key: `${fixture.namespace}-bad-timezone`,
        displayName: "Bad timezone",
        authUserId: randomUUID(),
        capabilities: ["workspace.read"],
      }),
      workspace: {
        ...provisioningInput({
          key: `${fixture.namespace}-bad-timezone`,
          displayName: "Bad timezone",
          authUserId: randomUUID(),
          capabilities: ["workspace.read"],
        }).workspace,
        timezone: "Not/A_Timezone",
      },
    }),
  );

  const containerName = await resolveLocalDatabaseContainer();
  const full = await createAuthenticatedUser("full");
  const under = await createAuthenticatedUser("under");
  const roleOnly = await createAuthenticatedUser("role-only");
  const other = await createAuthenticatedUser("other-workspace");

  const targetKey = `${fixture.namespace}-target`;
  const otherKey = `${fixture.namespace}-other`;
  const ambiguousKey = `${fixture.namespace}-ambiguous`;

  const fullInput = provisioningInput({
    key: targetKey,
    displayName: "QA 12.14 Bozeman Target Workspace",
    authUserId: full.userId,
    capabilities: bozemanBetaCapabilitySets.mainScheduler,
  });
  await verifyCliEmitSql(fullInput);

  const fullSql = buildWorkspaceAccessProvisioningSql(fullInput);
  const firstOutput = JSON.parse(runPsql(containerName, fullSql));
  const secondOutput = JSON.parse(runPsql(containerName, fullSql));
  assert.equal(firstOutput.workspaceKey, targetKey);
  assert.equal(secondOutput.workspaceId, firstOutput.workspaceId, "repeat provisioning must be idempotent");
  assert.equal(secondOutput.projectContactId, firstOutput.projectContactId);
  assert.equal(secondOutput.grantId, firstOutput.grantId);

  const underSql = buildWorkspaceAccessProvisioningSql(
    provisioningInput({
      key: targetKey,
      displayName: "QA 12.14 Bozeman Target Workspace",
      authUserId: under.userId,
      capabilities: ["workspace.read", "calendar.view"],
      role: "assistant_contact",
    }),
  );
  runPsql(containerName, underSql);

  const roleOnlySql = buildWorkspaceAccessProvisioningSql(
    provisioningInput({
      key: targetKey,
      displayName: "QA 12.14 Bozeman Target Workspace",
      authUserId: roleOnly.userId,
      capabilities: ["workspace.read"],
      role: "main_contact",
    }),
  );
  runPsql(containerName, roleOnlySql);

  const otherSql = buildWorkspaceAccessProvisioningSql(
    provisioningInput({
      key: otherKey,
      displayName: "QA 12.14 Other Workspace",
      authUserId: other.userId,
      capabilities: bozemanBetaCapabilitySets.mainScheduler,
    }),
  );
  runPsql(containerName, otherSql);

  expectPsqlFailure(
    containerName,
    buildWorkspaceAccessProvisioningSql({
      ...fullInput,
      workspace: { ...fullInput.workspace, displayName: "Conflicting name" },
    }),
    "conflicting duplicate workspace key",
  );
  expectPsqlFailure(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput({
        key: `${fixture.namespace}-missing-auth`,
        displayName: "Missing Auth",
        authUserId: randomUUID(),
        capabilities: ["workspace.read"],
      }),
    ),
    "missing approved Auth user",
  );

  const fullAccess = await readAccess(full.client);
  assert.equal(fullAccess.contactId, firstOutput.projectContactId);
  assert.equal(fullAccess.grantState.status, "authorized");
  assert.deepEqual(
    fullAccess.workspaces.map((workspace) => workspace.key),
    [targetKey],
  );
  assert.deepEqual(fullAccess.grantState.grants[0].capabilities, [
    "workspace.read",
    "questionnaires.review",
    "volunteers.view",
    "volunteers.edit",
    "tasks.view",
    "tasks.edit",
    "calendar.view",
    "calendar.edit",
    "assignments.view",
    "assignments.edit",
  ]);
  assert.deepEqual(
    selectCalendarRouteWorkspaceContext({
      projectContactId: fullAccess.contactId,
      ownGrants: fullAccess.grantState.grants,
      workspaces: fullAccess.workspaces,
    }),
    {
      ok: true,
      workspace: fullAccess.workspaces[0],
      projectContactId: fullAccess.contactId,
      capabilities: ["calendar.view", "assignments.view"],
    },
  );

  const underAccess = await readAccess(under.client);
  assert.equal(underAccess.grantState.status, "authorized");
  assert.equal(
    selectCalendarRouteWorkspaceContext({
      projectContactId: underAccess.contactId,
      ownGrants: underAccess.grantState.grants,
      workspaces: underAccess.workspaces,
    }).reason,
    "missing_assignments_view",
  );

  const roleOnlyAccess = await readAccess(roleOnly.client);
  assert.equal(roleOnlyAccess.grantState.status, "authorized");
  assert.equal(
    selectCalendarRouteWorkspaceContext({
      projectContactId: roleOnlyAccess.contactId,
      ownGrants: roleOnlyAccess.grantState.grants,
      workspaces: roleOnlyAccess.workspaces,
    }).reason,
    "missing_calendar_view",
  );

  const otherAccess = await readAccess(other.client);
  assert.deepEqual(
    otherAccess.workspaces.map((workspace) => workspace.key),
    [otherKey],
  );
  assert.ok(!otherAccess.workspaces.some((workspace) => workspace.key === targetKey));

  runPsql(
    containerName,
    buildWorkspaceAccessProvisioningSql(
      provisioningInput({
        key: ambiguousKey,
        displayName: "QA 12.14 Ambiguous Workspace",
        authUserId: full.userId,
        capabilities: bozemanBetaCapabilitySets.mainScheduler,
      }),
    ),
  );
  const ambiguousAccess = await readAccess(full.client);
  assert.equal(ambiguousAccess.workspaces.length, 2);
  assert.equal(
    selectCalendarRouteWorkspaceContext({
      projectContactId: ambiguousAccess.contactId,
      ownGrants: ambiguousAccess.grantState.grants,
      workspaces: ambiguousAccess.workspaces,
    }).reason,
    "workspace_unavailable",
  );

  runPsql(
    containerName,
    `update public.workspace_contact_grants as grant_row
set status = 'revoked', revoked_at = now()
from public.project_contacts as contact, public.workspaces as workspace
where grant_row.project_contact_id = contact.id
  and grant_row.workspace_id = workspace.id
  and contact.auth_user_id = ${sqlText(under.userId)}::uuid
  and workspace.workspace_key = ${sqlText(targetKey)};`,
  );
  const revokedAccess = await readAccess(under.client);
  assert.equal(revokedAccess.grantState.status, "no_active_grants");
  assert.deepEqual(revokedAccess.workspaces, []);

  console.log("Bozeman workspace provisioning local validation passed.");
  console.log("Confirmed safe operator provisioning, explicit grants, isolation, fail-closed access, and zero-secret output.");
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
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.project_contacts where auth_user_id = any(array[${authIdArray}])) +
  (select count(*) from public.workspace_contact_grants where workspace_id in (select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)})) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}-%@example.invalid`)})
)::text;`,
  );
  assert.equal(residue, "0", `Bozeman workspace provisioning cleanup left residue count ${residue}.`);
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
