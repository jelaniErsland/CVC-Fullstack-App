import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  buildWorkspaceAccessProvisioningSql,
  normalizeWorkspaceProvisioningInput,
} from "../lib/workspaces/provisioning.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return [
    "Usage:",
    "  node --conditions=react-server --no-warnings --experimental-strip-types scripts/provision-workspace-access.mjs --input <file.json> --emit-sql",
    "  node --conditions=react-server --no-warnings --experimental-strip-types scripts/provision-workspace-access.mjs --input <file.json> --local-execute",
    "",
    "Notes:",
    "  - Create/invite the approved Auth user first through Supabase Auth administration.",
    "  - This command does not read or require SUPABASE_SERVICE_ROLE_KEY.",
    "  - --local-execute works only against the local Supabase postgres Docker container.",
  ].join("\n");
}

function parseArgs(argv) {
  const args = { input: null, mode: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") {
      args.input = argv[index + 1] ?? null;
      index += 1;
    } else if (value === "--emit-sql" || value === "--local-execute") {
      args.mode = value;
    } else if (value === "--help" || value === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!args.input) throw new Error("Missing --input.");
  if (!args.mode) throw new Error("Choose --emit-sql or --local-execute.");
  return args;
}

function command(commandName, args, options = {}) {
  return spawnSync(commandName, args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

async function resolveLocalDatabaseContainer() {
  const config = await readFile(path.join(root, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
  if (!projectId) throw new Error("supabase/config.toml must define project_id.");
  const containerName = `supabase_db_${projectId}`;
  const result = command("docker", ["inspect", "--format", "{{.State.Running}}", containerName]);
  if (result.status !== 0 || result.stdout.trim() !== "true") {
    throw new Error("Local Supabase database container is not running.");
  }
  return containerName;
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
    throw new Error("Local workspace provisioning failed.");
  }
  return result.stdout.trim();
}

try {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input);
  const raw = JSON.parse(await readFile(inputPath, "utf8"));
  const input = normalizeWorkspaceProvisioningInput(raw);
  const sql = buildWorkspaceAccessProvisioningSql(input);

  if (args.mode === "--emit-sql") {
    console.log(sql);
  } else {
    const containerName = await resolveLocalDatabaseContainer();
    const output = runPsql(containerName, sql);
    console.log(output || "Workspace access provisioning completed.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Workspace provisioning failed.");
  console.error(usage());
  process.exit(1);
}
