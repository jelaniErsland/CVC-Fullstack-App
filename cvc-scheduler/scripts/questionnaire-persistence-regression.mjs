import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isEffectiveWorkspaceReadGrant } from "../lib/auth/grant.ts";
import {
  QuestionnairePayloadValidationError,
  validateQuestionnaireSubmissionPayload,
} from "../lib/questionnaires/payload.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701020000_questionnaire_submissions.sql",
);
const serverBoundaryPath = path.join(root, "lib", "questionnaires", "server.ts");
const environmentExamplePath = path.join(root, ".env.example");

const [migration, serverBoundary, environmentExample] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(serverBoundaryPath, "utf8"),
  readFile(environmentExamplePath, "utf8"),
]);

const createdTables = [...migration.matchAll(/create table\s+public\.([a-z_]+)/gi)].map(
  (match) => match[1],
);
assert.deepEqual(createdTables, ["questionnaire_submissions"]);
assert.match(migration, /workspace_id uuid not null references public\.workspaces/i);
assert.match(migration, /answers jsonb not null/i);
assert.match(migration, /questionnaire_version integer not null default 1/i);
assert.match(migration, /alter table public\.questionnaire_submissions enable row level security/i);
assert.match(migration, /revoke all on table public\.questionnaire_submissions from anon/i);
assert.doesNotMatch(migration, /grant (?:select|insert|update|delete|all).*to anon/i);
assert.match(
  migration,
  /create policy questionnaire_submissions_select_with_review_capability[\s\S]*for select[\s\S]*to authenticated/i,
);
assert.equal([...migration.matchAll(/create policy\s+/gi)].length, 1);

for (const requiredReviewPredicate of [
  "contact.auth_user_id = (select auth.uid())",
  "contact.status = 'active'",
  "grant_row.status = 'active'",
  "grant_row.revoked_at is null",
  "grant_row.valid_from <= now()",
  "grant_row.valid_until is null or grant_row.valid_until > now()",
  "grant_row.capabilities @> array['questionnaires.review']::text[]",
]) {
  assert.ok(
    migration.toLowerCase().includes(requiredReviewPredicate),
    `Questionnaire review RLS is missing: ${requiredReviewPredicate}`,
  );
}

assert.match(
  migration,
  /create function public\.submit_questionnaire_submission\([\s\S]*security definer/i,
);
assert.match(migration, /workspace\.public_intake_enabled = true/i);
assert.match(migration, /workspace\.lifecycle = 'active'/i);
assert.match(migration, /'submitted',[\s\n]*'public_web'/i);
assert.match(
  migration,
  /revoke all on function public\.submit_questionnaire_submission\(text, jsonb, integer\) from public/i,
);
assert.match(
  migration,
  /grant execute on function public\.submit_questionnaire_submission\(text, jsonb, integer\)[\s\n]*to anon, authenticated/i,
);

assert.match(serverBoundary, /^import "server-only";/);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.rpc\("([^"]+)"/g)].map((match) => match[1]),
  ["submit_questionnaire_submission"],
);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]),
  ["questionnaire_submissions"],
);
assert.doesNotMatch(serverBoundary, /SUPABASE_SERVICE_ROLE_KEY|serviceRole/i);
assert.match(serverBoundary, /export function validatePublicQuestionnaireSubmissionPayload/);
assert.doesNotMatch(migration, /service_role/i);
assert.match(environmentExample, /^ADMIN_AUTH_MODE=review$/m);

const validPayload = {
  aboutYou: {
    name: "Alex Rivera",
    email: "alex@example.com",
    phone: "406-555-0100",
    congregation: "Belgrade",
    preferredContactMethod: "Text",
  },
  availability: {
    weekdays: ["Monday", "Saturday"],
    preferredTimes: ["Morning"],
    notes: "Please call before scheduling.",
  },
  skillsExperience: {
    categories: ["General cleanup", "Painting"],
    maintenanceTaskCards: false,
    details: "Some painting experience.",
    physicalWorkNotes: "Avoid ladders.",
  },
  emergencyContact: {
    name: "Jamie Rivera",
    relationship: "Spouse",
    phone: "406-555-0101",
  },
  otherWaysToHelp: {
    selected: {
      housing: false,
      transportation: true,
      laundryDryCleaning: false,
      housekeeping: false,
      hairCare: false,
      medicalSupport: false,
      foodService: true,
    },
    other: "",
    notes: "",
  },
};

const validated = validateQuestionnaireSubmissionPayload(validPayload);
assert.equal(validated.aboutYou.name, "Alex Rivera");
assert.deepEqual(validated.availability.weekdays, ["Monday", "Saturday"]);
assert.throws(
  () =>
    validateQuestionnaireSubmissionPayload({
      ...validPayload,
      aboutYou: { ...validPayload.aboutYou, name: "" },
    }),
  QuestionnairePayloadValidationError,
);
assert.throws(
  () =>
    validateQuestionnaireSubmissionPayload({
      ...validPayload,
      availability: { ...validPayload.availability, weekdays: ["Monday", "Monday"] },
    }),
  QuestionnairePayloadValidationError,
);
assert.throws(
  () =>
    validateQuestionnaireSubmissionPayload({
      ...validPayload,
      skillsExperience: {
        ...validPayload.skillsExperience,
        details: "x".repeat(70_000),
      },
    }),
  QuestionnairePayloadValidationError,
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
    capabilities: ["workspace.read", "questionnaires.review"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
  {
    id: "grant-b-no-review",
    workspaceId: "workspace-b",
    projectContactId: "contact-b",
    role: "assistant_contact",
    capabilities: ["workspace.read"],
    status: "active",
    validFrom: "2026-01-01T00:00:00.000Z",
    validUntil: null,
    revokedAt: null,
  },
  {
    id: "grant-a-expired",
    workspaceId: "workspace-expired",
    projectContactId: "contact-a",
    role: "main_contact",
    capabilities: ["workspace.read", "questionnaires.review"],
    status: "active",
    validFrom: "2025-01-01T00:00:00.000Z",
    validUntil: "2026-06-30T00:00:00.000Z",
    revokedAt: null,
  },
];

function reviewableWorkspaceIds(authUserId) {
  if (authUserId === null) return [];
  return grants
    .filter((grant) => {
      const contact = contacts.find((candidate) => candidate.id === grant.projectContactId);
      return (
        contact?.authUserId === authUserId &&
        contact.status === "active" &&
        grant.capabilities.includes("questionnaires.review") &&
        isEffectiveWorkspaceReadGrant(grant, at)
      );
    })
    .map((grant) => grant.workspaceId);
}

assert.deepEqual(reviewableWorkspaceIds(null), []);
assert.deepEqual(reviewableWorkspaceIds("user-without-grants"), []);
assert.deepEqual(reviewableWorkspaceIds("user-a"), ["workspace-a"]);
assert.deepEqual(reviewableWorkspaceIds("user-b"), []);

const workspaceIntake = [
  { key: "open-active", lifecycle: "active", enabled: true },
  { key: "closed-active", lifecycle: "active", enabled: false },
  { key: "open-draft", lifecycle: "draft", enabled: true },
];
const maySubmit = (key) =>
  workspaceIntake.some(
    (workspace) =>
      workspace.key === key && workspace.lifecycle === "active" && workspace.enabled,
  );
assert.equal(maySubmit("open-active"), true);
assert.equal(maySubmit("closed-active"), false);
assert.equal(maySubmit("open-draft"), false);
assert.equal(maySubmit("unknown"), false);

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
  if (source.includes("lib/questionnaires/server")) {
    routeImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}
assert.deepEqual(
  routeImports,
  [],
  "Existing public/admin routes must not import persisted questionnaire boundaries",
);

console.log("Questionnaire persistence and authorization checks passed.");
console.log("Confirmed controlled public creation, scoped review, and no route cutover.");
