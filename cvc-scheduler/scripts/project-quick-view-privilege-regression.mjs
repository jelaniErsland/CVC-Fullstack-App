import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseSharedProjectQuickView } from "../lib/projectQuickViewAccess/token.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const root = process.cwd();
const adminFunctions = [
  "issue_project_quick_view_access",
  "read_project_quick_view_share_state",
  "revoke_project_quick_view_access",
];
const recipientFunction = "read_project_quick_view_by_token";

function command(name, args, options = {}) {
  return spawnSync(name, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function runPsql(containerName, sql) {
  const result = command("docker", [
    "exec", "-i", containerName,
    "psql", "--no-psqlrc", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres",
  ], { input: sql });
  assert.equal(result.status, 0, result.stderr || "Local privilege query failed.");
  return result.stdout.trim();
}

function localStatus() {
  const result = command("npx", ["supabase", "status", "--output", "json"], {
    shell: process.platform === "win32",
  });
  assert.equal(result.status, 0, "Local Supabase status is unavailable.");
  return JSON.parse(result.stdout);
}

function isLoopback(value) {
  try {
    return ["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

const migration = await readFile(
  path.join(root, "supabase", "migrations", "20260903120000_revoke_anon_project_quick_view_admin_execute.sql"),
  "utf8",
);
for (const functionName of adminFunctions) {
  assert.match(migration, new RegExp(`revoke execute on function public\\.${functionName}\\([^;]+\\) from anon`, "i"));
  assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}\\([^;]+\\) from PUBLIC`, "i"));
  assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}\\([^;]+\\) to authenticated`, "i"));
}
assert.match(migration, /grant execute on function public\.read_project_quick_view_by_token\(text, date\) to anon, authenticated/i);

const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
assert(projectId, "Local Supabase project id is required.");
const containerName = `supabase_db_${projectId}`;
const inspect = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
assert(inspect.status === 0 && inspect.stdout.trim() === "true", "Local Supabase must be running.");

const privilegeRows = runPsql(containerName, `
  select p.proname || '|' || coalesce(p.proacl::text, '')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'issue_project_quick_view_access',
      'read_project_quick_view_share_state',
      'revoke_project_quick_view_access',
      'read_project_quick_view_by_token'
    )
  order by p.proname;
`).split(/\r?\n/).filter(Boolean);
assert.equal(privilegeRows.length, 4, "Every Quick View RPC must be present.");
for (const row of privilegeRows) {
  const [functionName, acl] = row.split("|", 2);
  assert(acl.includes("authenticated=X/"), `${functionName} must retain authenticated execution.`);
  assert(!/(?:^\{|,)=X\//.test(acl), `${functionName} must not retain PUBLIC execution.`);
  if (adminFunctions.includes(functionName)) {
    assert(!acl.includes("anon=X/"), `${functionName} must deny anonymous execution.`);
  } else {
    assert.equal(functionName, recipientFunction);
    assert(acl.includes("anon=X/"), "Recipient bearer exchange must retain anonymous execution.");
  }
}

const defaultAcl = runPsql(containerName, `
  select defaclacl::text
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where pg_get_userbyid(d.defaclrole) = 'postgres'
    and n.nspname = 'public'
    and d.defaclobjtype = 'f';
`);
assert(defaultAcl.includes("anon=X/postgres"), "Root-cause fixture must retain Supabase's direct anon function default grant.");

const status = localStatus();
const supabaseUrl = status.API_URL;
const anonKey = status.ANON_KEY;
assert(supabaseUrl && anonKey && isLoopback(supabaseUrl), "Privilege regression requires loopback Supabase.");
const anon = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const workspaceId = randomUUID();
const before = Number(runPsql(containerName, "select count(*) from public.project_quick_view_access_tokens;"));
for (const [label, operation] of [
  ["issue", () => anon.rpc("issue_project_quick_view_access", { p_workspace_id: workspaceId })],
  ["state", () => anon.rpc("read_project_quick_view_share_state", { p_workspace_id: workspaceId })],
  ["revoke", () => anon.rpc("revoke_project_quick_view_access", { p_workspace_id: workspaceId })],
]) {
  const result = await operation();
  assert(result.error, `Anonymous ${label} invocation must fail before function execution.`);
  assert.equal(result.data, null, `Anonymous ${label} invocation must return no data.`);
}
const after = Number(runPsql(containerName, "select count(*) from public.project_quick_view_access_tokens;"));
assert.equal(after, before, "Denied anonymous management calls must create no credential row.");

const recipientResult = await anon.rpc(recipientFunction, {
  p_bearer_token: "bad",
  p_project_date: "2026-09-03",
});
assert.equal(recipientResult.error, null, "Anonymous bearer exchange must remain callable.");
assert.equal(parseSharedProjectQuickView(recipientResult.data).kind, "unavailable", "Malformed bearer must remain safely unavailable.");
assert.equal(
  Number(runPsql(containerName, `
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_quick_view_access_tokens'
      and column_name in ('token', 'raw_token', 'bearer', 'secret');
  `)),
  0,
  "Quick View storage must contain no plaintext bearer column.",
);

console.log("Quick View admin-function privilege hardening and recipient-exchange preservation checks passed.");
