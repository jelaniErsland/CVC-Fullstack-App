import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  loadVerifiedProjectContactGrantsWithClient,
  readVerifiedProjectContactIdWithClient,
} from "../lib/auth/project-contact-grants.ts";
import { readVerifiedAdminContextWithClient } from "../lib/auth/verified-admin-context.server.ts";
import { readInitialAssignmentNotificationSummariesWithClient } from "../lib/calendar/assignmentNotifications.server.ts";
import { readCalendarAssignmentPickerWithClient } from "../lib/calendar/assignmentPicker.server.ts";
import { readCalendarReadModelWithClient } from "../lib/calendar/readModelQuery.server.ts";
import { selectCalendarRouteWorkspaceContext } from "../lib/calendar/routeRead.server.ts";
import { readCalendarTaskPresetSelectorWithClient } from "../lib/calendar/taskPresetSelector.server.ts";
import { selectNeedsAttentionWorkspaceContext } from "../lib/needsAttention/routeRead.server.ts";
import { selectOverviewWorkspaceContext } from "../lib/overview/routeRead.server.ts";
import { readTaskPresetsWithClient } from "../lib/tasks/server.ts";
import { selectTaskManagementWorkspaceContext } from "../lib/tasks/routeRead.server.ts";
import { readVolunteerProfilesWithClient } from "../lib/volunteers/server.ts";
import { selectVolunteerManagementWorkspaceContext } from "../lib/volunteers/routeRead.server.ts";
import {
  bozemanBetaCapabilitySets,
  buildWorkspaceAccessProvisioningSql,
} from "../lib/workspaces/provisioning.server.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const stageScope = new AsyncLocalStorage();
const latencyValues = [100, 250, 400];
const fixture = {
  namespace: `qa-12-42-2-${randomUUID()}`,
  userId: null,
  client: null,
  session: null,
};
let cleanupCompleted = false;

function isLoopbackUrl(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(
      new URL(value).hostname,
    );
  } catch {
    return false;
  }
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
    throw new Error("The disposable local performance fixture SQL failed.");
  }
  return result.stdout.trim();
}

async function resolveLocalDatabaseContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  assert(projectId, "supabase/config.toml must define a local project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", [
    "inspect",
    "--format",
    "{{.State.Running}}",
    containerName,
  ]);
  assert(
    result.status === 0 && result.stdout.trim() === "true",
    "Local Supabase is unavailable. Start Docker Desktop and local Supabase before running this harness.",
  );
  return containerName;
}

async function createAuthenticatedFixture(containerName) {
  const email = `${fixture.namespace}-${randomUUID()}@example.invalid`;
  const password = `${randomBytes(24).toString("base64url")}aA1!`;
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signup = await client.auth.signUp({ email, password });
  assert(!signup.error && signup.data.user, "Disposable local Auth creation failed.");
  let session = signup.data.session;
  if (!session) {
    const signin = await client.auth.signInWithPassword({ email, password });
    assert(!signin.error && signin.data.session, "Disposable local Auth sign-in failed.");
    session = signin.data.session;
  }
  assert(session, "Disposable local Auth session creation failed.");
  fixture.userId = signup.data.user.id;
  fixture.client = client;
  fixture.session = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };

  const input = {
    workspace: {
      key: `${fixture.namespace}-workspace`,
      displayName: "QA 12.42.2 Performance Workspace",
      lifecycle: "active",
      timezone: "America/Denver",
      startsOn: "2026-08-01",
      endsOn: "2026-12-31",
      publicIntakeEnabled: false,
    },
    contact: { authUserId: fixture.userId, status: "active" },
    grant: {
      role: "main_contact",
      capabilities: bozemanBetaCapabilitySets.mainScheduler,
      status: "active",
      validFrom: "2026-08-01T00:00:00.000Z",
      validUntil: null,
    },
  };
  const result = JSON.parse(
    runPsql(containerName, buildWorkspaceAccessProvisioningSql(input)),
  );
  assert.equal(result.workspaceKey, input.workspace.key);
}

function delay(milliseconds) {
  return milliseconds === 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createInstrumentedClient(client, syntheticLatencyMs, calls) {
  function record(kind, target) {
    calls.push({
      kind,
      target,
      stage: stageScope.getStore() ?? "unscoped",
      syntheticLatencyMs,
    });
  }

  function wrapBuilder(builder, target) {
    let proxy;
    proxy = new Proxy(builder, {
      get(current, property) {
        if (property === "then") {
          return (fulfilled, rejected) => {
            record("postgrest_or_rpc", target);
            return delay(syntheticLatencyMs)
              .then(() => Promise.resolve(current))
              .then(fulfilled, rejected);
          };
        }
        const value = Reflect.get(current, property, current);
        if (typeof value !== "function") return value;
        return (...args) => {
          const next = value.apply(current, args);
          return next && typeof next === "object" ? wrapBuilder(next, target) : next;
        };
      },
    });
    return proxy;
  }

  const auth = new Proxy(client.auth, {
    get(current, property) {
      if (property === "getUser") {
        return async (...args) => {
          record("auth_get_user", "auth.getUser");
          await delay(syntheticLatencyMs);
          return current.getUser(...args);
        };
      }
      const value = Reflect.get(current, property, current);
      return typeof value === "function" ? value.bind(current) : value;
    },
  });

  const instrumented = new Proxy(client, {
    get(current, property) {
      if (property === "auth") return auth;
      if (property === "from") {
        return (table) => wrapBuilder(current.from(table), `table:${table}`);
      }
      if (property === "rpc") {
        return (name, args, options) =>
          wrapBuilder(current.rpc(name, args, options), `rpc:${name}`);
      }
      const value = Reflect.get(current, property, current);
      return typeof value === "function" ? value.bind(current) : value;
    },
  });

  return instrumented;
}

function runInStage(stage, operation) {
  return stageScope.run(stage, operation);
}

async function readGrantedWorkspaces(client) {
  const { data, error } = await client
    .from("workspaces")
    .select(
      "id,workspace_key,display_name,lifecycle,timezone,starts_on,ends_on,public_intake_enabled,created_at,updated_at",
    )
    .order("display_name");
  assert(!error, "Disposable granted workspace read failed.");
  return (data ?? []).map((row) => ({
    id: row.id,
    key: row.workspace_key,
    displayName: row.display_name,
    lifecycle: row.lifecycle,
    timezone: row.timezone,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    publicIntakeEnabled: row.public_intake_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function readContext(client) {
  return readVerifiedAdminContextWithClient(client, {
    async readVerifiedUser(supabase) {
      const {
        data: { user },
        error,
      } = await runInStage("page_auth", () => supabase.auth.getUser());
      return { user, error };
    },
    loadVerifiedGrants(supabase) {
      return runInStage("context_grants", () =>
        loadVerifiedProjectContactGrantsWithClient(supabase),
      );
    },
    readVerifiedProjectContactId(supabase, userId) {
      return runInStage("context_contact", () =>
        readVerifiedProjectContactIdWithClient(supabase, userId),
      );
    },
    readGrantedWorkspaces(supabase) {
      return runInStage("context_workspaces", () => readGrantedWorkspaces(supabase));
    },
  });
}

function callCountByStage(calls, stage) {
  return calls.filter((call) => call.stage === stage).length;
}

function criticalStagesForGroups(calls, groups) {
  return groups.reduce(
    (total, group) =>
      total + Math.max(...group.map((stage) => callCountByStage(calls, stage))),
    0,
  );
}

const baseGroups = [
  ["proxy_auth"],
  ["page_auth"],
  ["context_grants", "context_contact", "context_workspaces"],
];

async function prepareRoute(proxyClient, pageClient) {
  await runInStage("proxy_auth", () => proxyClient.auth.getUser());
  const context = await readContext(pageClient);
  assert(context, "Disposable verified admin context must resolve.");
  return context;
}

async function runRoute(route, syntheticLatencyMs) {
  const calls = [];
  let clientCreations = 0;
  async function createRouteClient() {
    clientCreations += 1;
    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.setSession(fixture.session);
    assert(!error, "Disposable route session setup failed.");
    return createInstrumentedClient(client, syntheticLatencyMs, calls);
  }
  const [proxyClient, client] = await Promise.all([
    createRouteClient(),
    createRouteClient(),
  ]);
  const context = await prepareRoute(proxyClient, client);
  let groups;

  if (route === "tasks") {
    const selection = selectTaskManagementWorkspaceContext(context);
    assert(selection.ok);
    await runInStage("tasks_read", () =>
      readTaskPresetsWithClient(client, selection.workspace.id),
    );
    groups = [...baseGroups, ["tasks_read"]];
  } else if (route === "volunteers") {
    const selection = selectVolunteerManagementWorkspaceContext(context);
    assert(selection.ok);
    await runInStage("volunteers_read", () =>
      readVolunteerProfilesWithClient(client, selection.workspace.id),
    );
    groups = [...baseGroups, ["volunteers_read"]];
  } else if (route === "needs_attention") {
    const selection = selectNeedsAttentionWorkspaceContext(context);
    assert(selection.ok);
    const result = await runInStage("needs_calendar", () =>
      readCalendarReadModelWithClient({
        client,
        workspaceId: selection.workspace.id,
        actorContactId: selection.projectContactId,
        workspaceTimezone: selection.workspace.timezone,
        rangeStart: "2026-08-24",
        rangeEnd: "2026-09-15",
        periodKind: "list",
        capabilities: ["calendar.view", "assignments.view"],
      }),
    );
    assert(result.ok && result.items.length === 0);
    groups = [...baseGroups, ["needs_calendar"]];
  } else if (route === "overview") {
    const selection = selectOverviewWorkspaceContext(context);
    assert(selection.ok);
    const [calendar, tasks, volunteers] = await Promise.all([
      runInStage("overview_calendar", () =>
        readCalendarReadModelWithClient({
          client,
          workspaceId: selection.workspace.id,
          actorContactId: selection.projectContactId,
          workspaceTimezone: selection.workspace.timezone,
          rangeStart: "2026-08-24",
          rangeEnd: "2026-08-31",
          periodKind: "list",
          capabilities: ["calendar.view", "assignments.view"],
        }),
      ),
      runInStage("overview_tasks", () =>
        readTaskPresetsWithClient(client, selection.workspace.id),
      ),
      runInStage("overview_volunteers", () =>
        readVolunteerProfilesWithClient(client, selection.workspace.id),
      ),
    ]);
    assert(calendar.ok && calendar.items.length === 0);
    assert.deepEqual(tasks, []);
    assert.deepEqual(volunteers, []);
    groups = [
      ...baseGroups,
      ["overview_calendar", "overview_tasks", "overview_volunteers"],
    ];
  } else if (route === "calendar") {
    const selection = selectCalendarRouteWorkspaceContext(context);
    assert(selection.ok);
    const [calendar, selector] = await Promise.all([
      runInStage("calendar_core", () =>
        readCalendarReadModelWithClient({
          client,
          workspaceId: selection.workspace.id,
          actorContactId: selection.projectContactId,
          workspaceTimezone: selection.workspace.timezone,
          rangeStart: "2026-08-24",
          rangeEnd: "2026-09-01",
          periodKind: "week",
          capabilities: selection.capabilities,
        }),
      ),
      runInStage("calendar_selector", () =>
        readCalendarTaskPresetSelectorWithClient({
          client,
          workspaceId: selection.workspace.id,
          canViewTaskPresets: selection.canViewTaskPresets,
        }),
      ),
    ]);
    assert(calendar.ok && calendar.items.length === 0);
    assert(selector.ok && selector.presets.length === 0);
    const itemIds = calendar.items.map((item) => item.calendarItemId);
    const [picker, notifications] = await Promise.all([
      runInStage("calendar_picker", () =>
        readCalendarAssignmentPickerWithClient({
          client,
          workspaceId: selection.workspace.id,
          calendarItemIds: itemIds,
          canViewVolunteers: selection.canViewVolunteers,
        }),
      ),
      runInStage("calendar_notifications", () =>
        readInitialAssignmentNotificationSummariesWithClient({
          supabase: client,
          calendarItemIds: itemIds,
          canSendInitialAssignmentNotifications: selection.canEditAssignments,
        }),
      ),
    ]);
    assert(picker.kind === "ready" && picker.assignments.length === 0);
    assert(notifications.kind === "ready" && notifications.summaries.length === 0);
    groups = [
      ...baseGroups,
      ["calendar_core", "calendar_selector"],
      ["calendar_picker", "calendar_notifications"],
    ];
  } else {
    throw new Error("Unknown route harness label.");
  }

  return {
    route,
    clientCreations,
    remoteCalls: calls.length,
    authGetUserCalls: calls.filter((call) => call.kind === "auth_get_user").length,
    postgrestOrRpcCalls: calls.filter(
      (call) => call.kind === "postgrest_or_rpc",
    ).length,
    criticalStages: criticalStagesForGroups(calls, groups),
    concurrentGroups: groups.filter((group) => group.length > 1),
    stages: Object.fromEntries(
      [...new Set(calls.map((call) => call.stage))].map((stage) => [
        stage,
        callCountByStage(calls, stage),
      ]),
    ),
  };
}

const routeOrder = ["tasks", "volunteers", "needs_attention", "overview", "calendar"];
const currentBaseline = {
  tasks: { calls: 6, criticalStages: 4 },
  volunteers: { calls: 6, criticalStages: 4 },
  needs_attention: { calls: 6, criticalStages: 4 },
  overview: { calls: 8, criticalStages: 4 },
  calendar: { calls: 8, criticalStages: 6 },
};
const fixedArchitecture = {
  ...currentBaseline,
  calendar: { calls: 8, criticalStages: 5 },
};
const pre12421 = {
  tasks: { calls: 8, criticalStages: 8 },
  volunteers: { calls: 8, criticalStages: 8 },
  needs_attention: { calls: 8, criticalStages: 8 },
  overview: { calls: 10, criticalStages: 8 },
  calendar: { calls: 10, criticalStages: 10 },
};
const singleContextRpc = {
  tasks: { calls: 4, criticalStages: 4 },
  volunteers: { calls: 4, criticalStages: 4 },
  needs_attention: { calls: 4, criticalStages: 4 },
  overview: { calls: 6, criticalStages: 4 },
  calendar: { calls: 6, criticalStages: 6 },
};

function simulatedTotals(architecture) {
  return Object.fromEntries(
    routeOrder.map((route) => [
      route,
      Object.fromEntries(
        latencyValues.map((latency) => [
          latency,
          architecture[route].criticalStages * latency,
        ]),
      ),
    ]),
  );
}

async function run() {
  assert(supabaseUrl && anonKey, "Local Supabase env values are required.");
  assert(isLoopbackUrl(supabaseUrl), "Refusing non-loopback Supabase performance harness target.");
  const containerName = await resolveLocalDatabaseContainer();
  await createAuthenticatedFixture(containerName);

  const zeroLatency = {};
  for (const route of routeOrder) {
    zeroLatency[route] = await runRoute(route, 0);
    assert.equal(zeroLatency[route].remoteCalls, fixedArchitecture[route].calls);
    assert.equal(
      zeroLatency[route].criticalStages,
      fixedArchitecture[route].criticalStages,
    );
    assert.equal(zeroLatency[route].clientCreations, 2);
    assert.equal(zeroLatency[route].authGetUserCalls, 2);
  }

  for (const latency of latencyValues) {
    for (const route of routeOrder) {
      const delayed = await runRoute(route, latency);
      assert.equal(delayed.remoteCalls, fixedArchitecture[route].calls);
      assert.equal(delayed.criticalStages, fixedArchitecture[route].criticalStages);
    }
  }

  assert.deepEqual(simulatedTotals(currentBaseline).calendar, {
    100: 600,
    250: 1500,
    400: 2400,
  });
  assert.deepEqual(simulatedTotals(fixedArchitecture).calendar, {
    100: 500,
    250: 1250,
    400: 2000,
  });
  assert.equal(
    singleContextRpc.tasks.criticalStages,
    currentBaseline.tasks.criticalStages,
    "A context RPC lowers calls but not the current critical path.",
  );

  console.log(
    JSON.stringify({
      schema: "project-local.admin-navigation-performance-harness.v1",
      fixture: "disposable_local_empty_main_scheduler",
      latencyMs: latencyValues,
      architectures: {
        pre12421,
        current12421: currentBaseline,
        singleContextRpc,
        fixed: fixedArchitecture,
      },
      simulatedMs: {
        current12421: simulatedTotals(currentBaseline),
        fixed: simulatedTotals(fixedArchitecture),
      },
      actualFixedCallGraph: zeroLatency,
      calendarPopulated: {
        current12421: { calls: 14, criticalStages: 11 },
        fixed: { calls: 14, criticalStages: 9 },
        currentSimulatedMs: { 100: 1100, 250: 2750, 400: 4400 },
        fixedSimulatedMs: { 100: 900, 250: 2250, 400: 3600 },
      },
      productionLatencyClaimed: false,
    }),
  );
}

async function cleanup(containerName) {
  await fixture.client?.auth.signOut({ scope: "local" }).catch(() => undefined);
  const userId = fixture.userId ?? "00000000-0000-4000-8000-000000000000";
  const residue = runPsql(
    containerName,
    `begin;
delete from public.workspace_contact_grants
where workspace_id in (
  select id from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}
);
delete from public.project_contacts where auth_user_id = ${sqlText(userId)}::uuid;
delete from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)};
delete from auth.users where id = ${sqlText(userId)}::uuid;
commit;
select (
  (select count(*) from public.workspaces where workspace_key like ${sqlText(`${fixture.namespace}%`)}) +
  (select count(*) from public.project_contacts where auth_user_id = ${sqlText(userId)}::uuid) +
  (select count(*) from auth.users where email like ${sqlText(`${fixture.namespace}-%@example.invalid`)})
)::text;`,
  );
  assert.equal(residue, "0", "Performance harness cleanup left local residue.");
  cleanupCompleted = true;
}

let containerName;
try {
  containerName = await resolveLocalDatabaseContainer();
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Performance harness failed.");
  process.exitCode = 1;
} finally {
  if (containerName) {
    try {
      await cleanup(containerName);
    } catch {
      console.error("Performance harness cleanup failed.");
      process.exitCode = 1;
    }
  }
  if (!cleanupCompleted) process.exitCode = 1;
}
