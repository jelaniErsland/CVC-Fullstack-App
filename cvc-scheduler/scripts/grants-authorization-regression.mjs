import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isEffectiveWorkspaceReadGrant,
  parseProjectContactGrant,
} from "../lib/auth/grant.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701010000_project_contact_grants.sql",
);
const grantsReaderPath = path.join(root, "lib", "auth", "project-contact-grants.ts");
const workspacesReaderPath = path.join(root, "lib", "workspaces", "granted.ts");
const environmentExamplePath = path.join(root, ".env.example");

const [migration, grantsReader, workspacesReader, environmentExample] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(grantsReaderPath, "utf8"),
  readFile(workspacesReaderPath, "utf8"),
  readFile(environmentExamplePath, "utf8"),
]);

const createdTables = [...migration.matchAll(/create table\s+public\.([a-z_]+)/gi)].map(
  (match) => match[1],
);
assert.deepEqual(createdTables, ["project_contacts", "workspace_contact_grants"]);
assert.match(migration, /auth_user_id uuid not null references auth\.users/i);
assert.match(migration, /workspace_id uuid not null references public\.workspaces/i);
assert.match(migration, /capabilities @> array\['workspace\.read'\]::text\[\]/i);
assert.match(migration, /alter table public\.project_contacts enable row level security/i);
assert.match(
  migration,
  /alter table public\.workspace_contact_grants enable row level security/i,
);
assert.match(migration, /revoke all on table public\.workspaces from anon/i);
assert.match(
  migration,
  /create policy workspaces_select_with_active_contact_grant[\s\S]*for select[\s\S]*to authenticated/i,
);
assert.doesNotMatch(migration, /to anon|grant (?:insert|update|delete|all)/i);

for (const requiredPredicate of [
  "contact.auth_user_id = (select auth.uid())",
  "contact.status = 'active'",
  "grant_row.status = 'active'",
  "grant_row.revoked_at is null",
  "grant_row.valid_from <= now()",
  "grant_row.valid_until is null or grant_row.valid_until > now()",
  "grant_row.capabilities @> array['workspace.read']::text[]",
]) {
  assert.ok(
    migration.toLowerCase().includes(requiredPredicate),
    `Workspace RLS is missing: ${requiredPredicate}`,
  );
}

assert.match(grantsReader, /^import "server-only";/);
assert.match(workspacesReader, /^import "server-only";/);
assert.deepEqual(
  [...grantsReader.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]),
  ["workspace_contact_grants"],
);
assert.deepEqual(
  [...workspacesReader.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]),
  ["workspaces"],
);
assert.doesNotMatch(
  `${grantsReader}\n${workspacesReader}`,
  /SUPABASE_SERVICE_ROLE_KEY|serviceRole/i,
);
assert.match(environmentExample, /^ADMIN_AUTH_MODE=review$/m);

const at = new Date("2026-07-01T12:00:00.000Z");
const contacts = [
  { id: "contact-a", authUserId: "user-a", status: "active" },
  { id: "contact-b", authUserId: "user-b", status: "active" },
  { id: "contact-inactive", authUserId: "user-inactive", status: "inactive" },
];
const grantRows = [
  {
    id: "grant-a",
    workspace_id: "workspace-a",
    project_contact_id: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read"],
    status: "active",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_until: null,
    revoked_at: null,
  },
  {
    id: "grant-b",
    workspace_id: "workspace-b",
    project_contact_id: "contact-b",
    role: "assistant_contact",
    capabilities: ["workspace.read"],
    status: "active",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_until: null,
    revoked_at: null,
  },
  {
    id: "grant-a-expired",
    workspace_id: "workspace-expired",
    project_contact_id: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read"],
    status: "active",
    valid_from: "2025-01-01T00:00:00.000Z",
    valid_until: "2026-06-30T00:00:00.000Z",
    revoked_at: null,
  },
  {
    id: "grant-a-future",
    workspace_id: "workspace-future",
    project_contact_id: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read"],
    status: "active",
    valid_from: "2026-07-02T00:00:00.000Z",
    valid_until: null,
    revoked_at: null,
  },
  {
    id: "grant-a-revoked",
    workspace_id: "workspace-revoked",
    project_contact_id: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read"],
    status: "revoked",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_until: null,
    revoked_at: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "grant-a-inactive",
    workspace_id: "workspace-inactive-grant",
    project_contact_id: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read"],
    status: "inactive",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_until: null,
    revoked_at: null,
  },
  {
    id: "grant-inactive-contact",
    workspace_id: "workspace-inactive-contact",
    project_contact_id: "contact-inactive",
    role: "on_site_contact",
    capabilities: ["workspace.read"],
    status: "active",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_until: null,
    revoked_at: null,
  },
];

function visibleWorkspaceIds(authUserId) {
  if (authUserId === null) {
    return [];
  }

  return grantRows
    .map(parseProjectContactGrant)
    .filter((grant) => {
      const contact = contacts.find((candidate) => candidate.id === grant.projectContactId);
      return (
        contact?.authUserId === authUserId &&
        contact.status === "active" &&
        isEffectiveWorkspaceReadGrant(grant, at)
      );
    })
    .map((grant) => grant.workspaceId)
    .sort();
}

assert.deepEqual(visibleWorkspaceIds(null), [], "anon must see no workspaces");
assert.deepEqual(visibleWorkspaceIds("user-without-grants"), []);
assert.deepEqual(visibleWorkspaceIds("user-a"), ["workspace-a"]);
assert.deepEqual(visibleWorkspaceIds("user-b"), ["workspace-b"]);
assert.deepEqual(visibleWorkspaceIds("user-inactive"), []);

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
const routeImports = [];
for (const file of routeFiles) {
  const source = await readFile(file, "utf8");
  if (
    source.includes("lib/workspaces/granted") ||
    source.includes("lib/workspaces/read") ||
    source.includes("lib/auth/project-contact-grants")
  ) {
    routeImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}

assert.deepEqual(
  routeImports,
  ["app/admin/login/page.tsx"],
  "Only the existing Auth shell may inspect grant status; mock product routes must stay isolated",
);

console.log("Project contact grant authorization checks passed.");
console.log("Confirmed policy predicates, isolation fixtures, and no product-route cutover.");
