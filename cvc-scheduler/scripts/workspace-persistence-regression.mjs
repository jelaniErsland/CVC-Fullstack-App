import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeWorkspaceReference,
  parseWorkspaceIdentity,
} from "../lib/workspaces/identity.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701000000_workspace_identity.sql",
);
const readBoundaryPath = path.join(root, "lib", "workspaces", "read.ts");

const [migration, readBoundary] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(readBoundaryPath, "utf8"),
]);

assert.match(migration, /create table public\.workspaces\s*\(/i);
assert.equal(
  [...migration.matchAll(/create table\s+/gi)].length,
  1,
  "11.4 must create exactly one table",
);
assert.match(migration, /workspace_key text not null/i);
assert.match(migration, /constraint workspaces_workspace_key_unique unique/i);
assert.match(migration, /constraint workspaces_date_range_ordered check/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /force row level security/i);
assert.doesNotMatch(
  migration,
  /create policy/i,
  "Workspace RLS must remain deny-by-default until grants are implemented",
);
assert.doesNotMatch(migration, /service_role/i);

assert.match(readBoundary, /^import "server-only";/);
assert.equal(
  [...readBoundary.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]).join(","),
  "workspaces",
  "The read boundary may query only workspace identity",
);
assert.doesNotMatch(readBoundary, /SUPABASE_SERVICE_ROLE_KEY|serviceRole/i);

assert.deepEqual(normalizeWorkspaceReference({ key: "belgrade-remodel-2026" }), {
  column: "workspace_key",
  value: "belgrade-remodel-2026",
});
assert.deepEqual(
  normalizeWorkspaceReference({ id: "550E8400-E29B-41D4-A716-446655440000" }),
  { column: "id", value: "550e8400-e29b-41d4-a716-446655440000" },
);
assert.throws(() => normalizeWorkspaceReference({ key: "Other Workspace" }));
assert.throws(() => normalizeWorkspaceReference({ id: "not-an-id" }));

const workspaceRow = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  workspace_key: "belgrade-remodel-2026",
  display_name: "Belgrade Major Remodel 2026",
  lifecycle: "active",
  timezone: "America/Denver",
  starts_on: "2026-01-12",
  ends_on: "2026-06-30",
  public_intake_enabled: false,
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};
const parsed = parseWorkspaceIdentity(workspaceRow);
assert.equal(parsed.key, "belgrade-remodel-2026");
assert.equal(parsed.publicIntakeEnabled, false);
assert.throws(() => parseWorkspaceIdentity({ ...workspaceRow, lifecycle: "unknown" }));

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

const routeFiles = (await collectFiles(path.join(root, "app"))).filter((file) =>
  /\.(?:ts|tsx)$/.test(file),
);
const routeSources = await Promise.all(routeFiles.map((file) => readFile(file, "utf8")));
assert.equal(
  routeSources.some((source) => source.includes("lib/workspaces/read")),
  false,
  "Existing routes must not cut over to the persisted workspace read boundary",
);

console.log("Workspace persistence regression checks passed.");
console.log("Confirmed the 11.4 base migration is deny-by-default with no route cutover.");
