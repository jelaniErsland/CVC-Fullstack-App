import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isEffectiveWorkspaceReadGrant } from "../lib/auth/grant.ts";
import { parseVolunteerProfile } from "../lib/volunteers/profile.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701030000_volunteer_profiles.sql",
);
const manualMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260714121500_manual_volunteer_profiles.sql",
);
const serverBoundaryPath = path.join(root, "lib", "volunteers", "server.ts");
const environmentExamplePath = path.join(root, ".env.example");

const [migration, manualMigration, serverBoundary, environmentExample] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(manualMigrationPath, "utf8"),
  readFile(serverBoundaryPath, "utf8"),
  readFile(environmentExamplePath, "utf8"),
]);

const createdTables = [...migration.matchAll(/create table\s+public\.([a-z_]+)/gi)].map(
  (match) => match[1],
);
assert.deepEqual(createdTables, ["volunteer_profiles"]);
assert.match(migration, /workspace_id uuid not null references public\.workspaces/i);
assert.match(migration, /source_submission_id uuid not null/i);
assert.match(manualMigration, /alter column source_submission_id drop not null/i);
assert.match(manualMigration, /profile_source text not null default 'questionnaire'/i);
assert.match(manualMigration, /manual_created_by_project_contact_id uuid/i);
assert.match(manualMigration, /volunteer_profiles_provenance_known/i);
assert.match(
  migration,
  /foreign key\s*\(\s*workspace_id,\s*source_submission_id\s*\)[\s\S]*references public\.questionnaire_submissions\s*\(workspace_id, id\)/i,
);
assert.match(migration, /source_submission_unique unique \(source_submission_id\)/i);
assert.match(migration, /availability_snapshot jsonb not null/i);
assert.match(migration, /skills_help_snapshot jsonb not null/i);
assert.doesNotMatch(
  migration,
  /emergency/i,
  "Emergency-contact answers must remain behind questionnaire authorization",
);

assert.match(migration, /alter table public\.volunteer_profiles enable row level security/i);
assert.match(migration, /revoke all on table public\.volunteer_profiles from anon/i);
assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|all).*to anon/i);
assert.match(
  migration,
  /create policy volunteer_profiles_select_with_view_capability[\s\S]*for select[\s\S]*to authenticated/i,
);
assert.equal([...migration.matchAll(/create policy\s+/gi)].length, 1);

for (const requiredReadPredicate of [
  "contact.auth_user_id = (select auth.uid())",
  "contact.status = 'active'",
  "grant_row.status = 'active'",
  "grant_row.revoked_at is null",
  "grant_row.valid_from <= now()",
  "grant_row.valid_until is null or grant_row.valid_until > now()",
  "grant_row.capabilities @> array['volunteers.view']::text[]",
]) {
  assert.ok(
    migration.toLowerCase().includes(requiredReadPredicate),
    `Volunteer read RLS is missing: ${requiredReadPredicate}`,
  );
}

assert.match(
  migration,
  /create function public\.convert_questionnaire_submission_to_volunteer_profile\(\s*p_submission_id uuid\s*\)[\s\S]*security definer/i,
);
assert.doesNotMatch(
  migration,
  /convert_questionnaire_submission_to_volunteer_profile\(\s*p_submission_id uuid,|p_workspace_id|p_full_name/i,
  "Conversion must accept provenance only, not client-owned scope/profile values",
);
assert.match(migration, /caller_user_id := auth\.uid\(\)/i);
assert.match(migration, /submission\.status = 'submitted'/i);
assert.match(migration, /submission\.questionnaire_version = 1/i);
assert.match(
  migration,
  /grant_row\.capabilities @> array\[\s*'questionnaires\.review',\s*'volunteers\.edit'\s*\]::text\[\]/i,
);
assert.match(migration, /existing_profile\.source_submission_id = source_submission\.id/i);
assert.doesNotMatch(migration, /update public\.questionnaire_submissions/i);
assert.doesNotMatch(migration, /delete from public\.questionnaire_submissions/i);
assert.match(
  manualMigration,
  /create or replace function public\.create_manual_volunteer_profile/i,
);
assert.match(
  manualMigration,
  /create or replace function public\.update_volunteer_profile_manual_fields/i,
);
assert.doesNotMatch(manualMigration, /grant (?:insert|update|delete|all).*volunteer_profiles.*to authenticated/i);
assert.doesNotMatch(
  manualMigration,
  /service_role|SUPABASE_SERVICE_ROLE_KEY|insert\s+into\s+public\.workspaces/i,
);
assert.match(
  migration,
  /revoke all on function public\.convert_questionnaire_submission_to_volunteer_profile\(uuid\)[\s\n]*from public/i,
);
assert.match(
  migration,
  /grant execute on function public\.convert_questionnaire_submission_to_volunteer_profile\(uuid\)[\s\n]*to authenticated/i,
);
assert.doesNotMatch(migration, /to anon|service_role/i);

assert.match(serverBoundary, /^import "server-only";/);
assert.match(serverBoundary, /supabase\.auth\.getUser\(\)/);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((match) => match[1]),
  [
    "convert_questionnaire_submission_to_volunteer_profile",
    "create_manual_volunteer_profile",
    "update_volunteer_profile_manual_fields",
  ],
);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]),
  ["volunteer_profiles"],
);
assert.doesNotMatch(serverBoundary, /emergency|SUPABASE_SERVICE_ROLE_KEY|serviceRole/i);
assert.match(environmentExample, /^ADMIN_AUTH_MODE=review$/m);

const parsedProfile = parseVolunteerProfile({
  id: "550e8400-e29b-41d4-a716-446655440001",
  workspace_id: "550e8400-e29b-41d4-a716-446655440002",
  source_submission_id: "550e8400-e29b-41d4-a716-446655440003",
  profile_source: "questionnaire",
  manual_created_by_project_contact_id: null,
  manual_created_at: null,
  lifecycle: "active",
  readiness_status: "ready",
  full_name: "Alex Rivera",
  email: "alex@example.com",
  phone: "406-555-0100",
  congregation: "Belgrade",
  preferred_contact_method: "Text",
  availability_snapshot: { weekdays: ["Monday"] },
  skills_help_snapshot: { skillsExperience: { categories: ["Painting"] } },
  profile_notes: "",
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-01T12:00:00.000Z",
});
assert.equal(parsedProfile.fullName, "Alex Rivera");
assert.equal(parsedProfile.profileSource, "questionnaire");
assert.equal("emergencyContact" in parsedProfile, false);
assert.throws(() =>
  parseVolunteerProfile({
    ...parsedProfile,
    id: parsedProfile.id,
    workspace_id: parsedProfile.workspaceId,
    source_submission_id: parsedProfile.sourceSubmissionId,
    profile_source: parsedProfile.profileSource,
    manual_created_by_project_contact_id: parsedProfile.manualCreatedByProjectContactId,
    manual_created_at: parsedProfile.manualCreatedAt,
    readiness_status: "unknown",
    full_name: parsedProfile.fullName,
    preferred_contact_method: parsedProfile.preferredContactMethod,
    availability_snapshot: parsedProfile.availabilitySnapshot,
    skills_help_snapshot: parsedProfile.skillsHelpSnapshot,
    profile_notes: parsedProfile.profileNotes,
    created_at: parsedProfile.createdAt,
    updated_at: parsedProfile.updatedAt,
  }),
);

const at = new Date("2026-07-01T12:00:00.000Z");
const contacts = [
  { id: "contact-a", authUserId: "user-a", status: "active" },
  { id: "contact-b", authUserId: "user-b", status: "active" },
];
const grants = [
  {
    id: "grant-a",
    workspaceId: "workspace-a",
    projectContactId: "contact-a",
    role: "main_contact",
    capabilities: [
      "workspace.read",
      "questionnaires.review",
      "volunteers.edit",
      "volunteers.view",
    ],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
  {
    id: "grant-b-view-only",
    workspaceId: "workspace-b",
    projectContactId: "contact-b",
    role: "assistant_contact",
    capabilities: ["workspace.read", "volunteers.view"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
];

function authorizedWorkspaces(authUserId, requiredCapabilities) {
  if (authUserId === null) return [];
  return grants
    .filter((grant) => {
      const contact = contacts.find((candidate) => candidate.id === grant.projectContactId);
      return (
        contact?.authUserId === authUserId &&
        contact.status === "active" &&
        requiredCapabilities.every((capability) => grant.capabilities.includes(capability)) &&
        isEffectiveWorkspaceReadGrant(grant, at)
      );
    })
    .map((grant) => grant.workspaceId);
}

assert.deepEqual(authorizedWorkspaces(null, ["volunteers.view"]), []);
assert.deepEqual(authorizedWorkspaces("user-a", ["volunteers.view"]), ["workspace-a"]);
assert.deepEqual(authorizedWorkspaces("user-b", ["volunteers.view"]), ["workspace-b"]);
assert.deepEqual(
  authorizedWorkspaces("user-a", ["questionnaires.review", "volunteers.edit"]),
  ["workspace-a"],
);
assert.deepEqual(
  authorizedWorkspaces("user-b", ["questionnaires.review", "volunteers.edit"]),
  [],
);

const convertedSubmissionIds = new Set();
function modelConversion(submissionId, sourceStatus, authorized) {
  if (!authorized || sourceStatus !== "submitted" || convertedSubmissionIds.has(submissionId)) {
    return false;
  }
  convertedSubmissionIds.add(submissionId);
  return true;
}
assert.equal(modelConversion("submission-a", "submitted", true), true);
assert.equal(modelConversion("submission-a", "submitted", true), false);
assert.equal(modelConversion("submission-b", "approved", true), false);
assert.equal(modelConversion("submission-c", "submitted", false), false);

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
  if (source.includes("lib/volunteers/server")) {
    routeImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}
assert.deepEqual(
  routeImports,
  ["app/admin/volunteers/page.tsx"],
  "Only the approved 12.15 persisted volunteer-management route may import persisted volunteer boundaries",
);

console.log("Volunteer profile persistence and authorization checks passed.");
console.log("Confirmed explicit conversion, manual provenance, scoped reads, sensitive separation, and the approved 12.15 route cutover boundary.");
