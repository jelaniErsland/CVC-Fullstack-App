import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = process.cwd();
const expectedName = "project-local-staging";
const expectedRef = "kfuujcfxoayukywvtaeh";
const expectedConfirmation = `${expectedName}:${expectedRef}`;
const optInName = "RUN_HOSTED_BOZEMAN_BETA_LAUNCH_VALIDATION";
const expectedMigration = "20260714122230";

function redact(value) {
  return String(value)
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/https:\/\/[a-z0-9]+\.supabase\.co[^\s]*/gi, "https://[redacted].supabase.co/[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-db-url]");
}

function runSupabaseCli(args, options = {}) {
  const isWindows = process.platform === "win32";
  const executable = isWindows ? process.execPath : "npx";
  const executableArgs = isWindows
    ? [
        path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
        "--yes",
        "supabase",
        ...args,
      ]
    : ["--yes", "supabase", ...args];
  const result = spawnSync(executable, executableArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 120 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const detail = options.sensitiveOutput
      ? "Sensitive command output was suppressed."
      : [result.error?.message, result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(`Hosted launch-gate Supabase command failed: ${redact(detail || "No diagnostic was returned.")}`);
  }
  return result.stdout.trim();
}

function parseJson(output, stage) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${stage} returned unreadable JSON.`);
  }
}

function runHostedSql(sql, stage) {
  const file = path.join(tmpdir(), `project-local-launch-gate-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    const output = runSupabaseCli(["db", "query", "--linked", "--file", file, "--output", "json"], {
      sensitiveOutput: true,
    });
    const result = parseJson(output, stage);
    assert(Array.isArray(result.rows), `${stage} omitted rows.`);
    return result.rows;
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // best effort
    }
  }
}

function normalizeGeneratedTypes(source) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(
      /\n\s*\/\/ Allows to automatically instantiate createClient with right options\s*\n\s*\/\/ instead of createClient<Database, \{ PostgrestVersion: 'XX' \}>\(URL, KEY\)\s*(?=\n\s*__InternalSupabase:)/m,
      "",
    )
    .replace(
      /\n\s*__InternalSupabase:\s*{\s*\n\s*PostgrestVersion:\s*"[^"]+"\s*\n\s*}\s*(?=\n\s*public:)/m,
      "",
    )
    .trim();
}

async function main() {
  assert(
    process.env[optInName] === expectedConfirmation,
    `Refusing hosted launch validation without ${optInName}=${expectedConfirmation}.`,
  );

  const linkedRef = (await readFile(path.join(root, "supabase", ".temp", "project-ref"), "utf8")).trim();
  assert.equal(linkedRef, expectedRef, "The linked Supabase project is not the approved staging ref.");

  const projectsResult = parseJson(runSupabaseCli(["projects", "list", "--output", "json"]), "Hosted project discovery");
  const projects = Array.isArray(projectsResult) ? projectsResult : projectsResult.projects;
  const project = projects?.find((entry) => entry.ref === expectedRef);
  assert(project?.name === expectedName, "Approved staging project name/ref did not match.");
  assert(project?.status === "ACTIVE_HEALTHY", "Approved staging target is not ACTIVE_HEALTHY.");

  const migration = runHostedSql(
    "select version from supabase_migrations.schema_migrations order by version desc limit 1;",
    "Hosted migration check",
  )[0]?.version;
  assert.equal(migration, expectedMigration, `Hosted staging must be validated at ${expectedMigration}.`);

  const localTypes = readFileSync(path.join(root, "lib", "supabase", "database.types.ts"), "utf8");
  const hostedTypes = runSupabaseCli(["gen", "types", "typescript", "--linked", "--schema", "public"], {
    sensitiveOutput: true,
  });
  assert.equal(
    normalizeGeneratedTypes(hostedTypes),
    normalizeGeneratedTypes(localTypes),
    "Hosted generated public-schema types differ from committed types.",
  );

  const [roadmap, goNoGo, runbook, packageJson] = await Promise.all([
    readFile(path.join(root, "docs", "BOZEMAN_BETA_ROADMAP.md"), "utf8"),
    readFile(path.join(root, "docs", "BOZEMAN_BETA_GO_NO_GO.md"), "utf8"),
    readFile(path.join(root, "docs", "BOZEMAN_BETA_LAUNCH_RUNBOOK.md"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);
  assert(roadmap.includes("12.23 Bozeman Beta UI Polish, Hosted Validation, and Launch Gate"));
  assert(goNoGo.includes("Conclusion: NO-GO"));
  assert(runbook.includes("Belgrade Sheets/App Script remains the fallback"));
  assert(packageJson.includes("test:assignment-notification-email:hosted"));
  assert(packageJson.includes("test:volunteer-schedule-responses:hosted"));
  assert(packageJson.includes("test:calendar-publication-visibility:hosted"));

  console.log(`Hosted Bozeman beta launch verification passed for ${expectedName} (${expectedRef}).`);
  console.log(`Project health: ACTIVE_HEALTHY. Migration level: ${expectedMigration}. Generated-type parity passed.`);
  console.log("No hosted fixtures, production data, provider send, or deployment mutation were created by this launch-gate verification.");
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
