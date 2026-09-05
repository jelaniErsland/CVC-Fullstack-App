import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const { loadEnvConfig } = nextEnv;
const root = process.cwd();
loadEnvConfig(root);

function shell(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

function localStatus() {
  const result = shell("npx", ["supabase", "status", "--output", "env"], {
    shell: process.platform === "win32",
  });
  assert.equal(result.status, 0, "Disposable local Supabase must be running.");
  return result.stdout ?? "";
}

function statusValue(output, name) {
  return output.match(new RegExp(`^${name}="?([^\\r\\n"]+)`, "m"))?.[1];
}

const config = readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
const projectId = config.match(/^project_id\s*=\s*"([\w-]+)"/m)?.[1];
assert(projectId, "Local Supabase project id is missing.");
const containerName = `supabase_db_${projectId}`;

function psql(sql) {
  const result = shell(
    "docker",
    [
      "exec", "-i", containerName, "psql", "--no-psqlrc", "-X", "-qAt",
      "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres",
    ],
    { input: sql },
  );
  assert.equal(result.status, 0, "Disposable local SQL failed.");
  return result.stdout.trim();
}

const signatures = Object.freeze([
  "public.update_current_workspace_project_dates(date,date)",
  "public.delete_history_free_volunteer_profile(uuid)",
  "public.create_current_workspace_repeated_calendar_items(uuid,uuid,text,text,date,date,smallint[],time without time zone,time without time zone,integer,text,jsonb)",
]);

function assertPrivileges() {
  for (const signature of signatures) {
    const result = psql(`
      select
        has_function_privilege('anon', '${signature}', 'EXECUTE')::text || '|' ||
        has_function_privilege('public', '${signature}', 'EXECUTE')::text || '|' ||
        has_function_privilege('authenticated', '${signature}', 'EXECUTE')::text;
    `);
    assert.equal(result, "false|false|true", `${signature} must deny anon/PUBLIC and preserve authenticated EXECUTE.`);
  }
}

function productSnapshot() {
  return psql(`
    select jsonb_build_object(
      'workspace_dates', (
        select md5(coalesce(jsonb_agg(jsonb_build_array(id, starts_on, ends_on) order by id)::text, '[]'))
        from public.workspaces
      ),
      'volunteers', (select count(*) from public.volunteer_profiles),
      'calendar_items', (select count(*) from public.calendar_items),
      'repeat_requests', (select count(*) from public.calendar_repeat_creation_requests),
      'assignments', (select count(*) from public.calendar_assignments),
      'deliveries', (select count(*) from public.assignment_notification_deliveries),
      'schedule_access', (select count(*) from public.volunteer_schedule_access_tokens)
    )::text;
  `);
}

async function expectAnonymousDenial(label, operation) {
  const { data, error } = await operation();
  assert.equal(data, null, `${label} must return no data to anon.`);
  assert(error, `${label} must deny anonymous execution.`);
  assert.equal(error.code, "42501", `${label} must fail at the privilege boundary.`);
}

async function main() {
  const output = localStatus();
  const supabaseUrl = statusValue(output, "API_URL");
  const anonKey = statusValue(output, "ANON_KEY");
  assert(supabaseUrl && anonKey, "Local Supabase API URL and anon key are required.");
  assert(["127.0.0.1", "localhost"].includes(new URL(supabaseUrl).hostname), "Regression refuses non-local Supabase.");

  assertPrivileges();
  const before = productSnapshot();
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await expectAnonymousDenial("project-date RPC", () => anon.rpc(
    "update_current_workspace_project_dates",
    { p_starts_on: "2026-09-29", p_ends_on: "2026-12-08" },
  ));
  await expectAnonymousDenial("volunteer-delete RPC", () => anon.rpc(
    "delete_history_free_volunteer_profile",
    { p_profile_id: randomUUID() },
  ));
  await expectAnonymousDenial("repeat-create RPC", () => anon.rpc(
    "create_current_workspace_repeated_calendar_items",
    {
      p_request_key: randomUUID(),
      p_task_preset_id: null,
      p_one_off_title: "Anonymous denial proof",
      p_one_off_task_type: "general",
      p_start_date: "2026-11-02",
      p_end_date: "2026-11-03",
      p_weekdays: [1, 2],
      p_start_time: "08:00",
      p_end_time: "10:00",
      p_needed_count: 1,
      p_schedule_notes: null,
      p_custom_values: {},
    },
  ));

  assert.equal(productSnapshot(), before, "Anonymous RPC attempts must produce zero product mutation.");
  console.log("PASS operational-usability privilege regression");
}

await main();
