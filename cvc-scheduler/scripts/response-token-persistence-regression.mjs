import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseAssignmentResponse } from "../lib/assignments/assignment.ts";
import { isEffectiveWorkspaceReadGrant } from "../lib/auth/grant.ts";
import {
  ResponseTokenValidationError,
  parseIssuedAssignmentResponseToken,
  parsePublicAssignmentResponseContext,
  parsePublicAssignmentResponseResult,
  validateIssueAssignmentResponseTokenInput,
  validateReadAssignmentResponseByTokenInput,
  validateRevokeAssignmentResponseTokenInput,
  validateSubmitAssignmentResponseByTokenInput,
} from "../lib/responseTokens/token.ts";
import {
  ResponseLinkValidationError,
  issueAssignmentResponseLinkWithIssuer,
  redactAssignmentResponseLink,
  validateResponseLinkBaseUrl,
} from "../lib/responseTokens/link.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701070000_assignment_response_tokens.sql",
);
const serverBoundaryPath = path.join(root, "lib", "responseTokens", "server.ts");
const publicRouteBoundaryPath = path.join(
  root,
  "lib",
  "responseTokens",
  "publicRoute.ts",
);
const publicRouteStatePath = path.join(
  root,
  "lib",
  "responseTokens",
  "publicRouteState.ts",
);
const responsePagePath = path.join(root, "app", "respond", "[token]", "page.tsx");
const responseActionPath = path.join(root, "app", "respond", "[token]", "actions.ts");
const responseRouteQaPath = path.join(
  root,
  "scripts",
  "response-route-valid-token-regression.mjs",
);
const responseLinkBoundaryPath = path.join(
  root,
  "lib",
  "responseTokens",
  "link.server.ts",
);
const responseLinkQaPath = path.join(
  root,
  "scripts",
  "response-link-issuance-regression.mjs",
);
const responseLinkDiagnosticBoundaryPath = path.join(
  root,
  "lib",
  "responseTokens",
  "diagnostic.server.ts",
);
const responseLinkDiagnosticPagePath = path.join(
  root,
  "app",
  "admin",
  "diagnostics",
  "response-link",
  "page.tsx",
);
const responseLinkDiagnosticActionPath = path.join(
  root,
  "app",
  "admin",
  "diagnostics",
  "response-link",
  "actions.ts",
);
const environmentExamplePath = path.join(root, ".env.example");
const [
  migration,
  serverBoundary,
  publicRouteBoundary,
  publicRouteState,
  responsePage,
  responseAction,
  responseRouteQa,
  responseLinkBoundary,
  responseLinkQa,
  responseLinkDiagnosticBoundary,
  responseLinkDiagnosticPage,
  responseLinkDiagnosticAction,
  environmentExample,
] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(serverBoundaryPath, "utf8"),
  readFile(publicRouteBoundaryPath, "utf8"),
  readFile(publicRouteStatePath, "utf8"),
  readFile(responsePagePath, "utf8"),
  readFile(responseActionPath, "utf8"),
  readFile(responseRouteQaPath, "utf8"),
  readFile(responseLinkBoundaryPath, "utf8"),
  readFile(responseLinkQaPath, "utf8"),
  readFile(responseLinkDiagnosticBoundaryPath, "utf8"),
  readFile(responseLinkDiagnosticPagePath, "utf8"),
  readFile(responseLinkDiagnosticActionPath, "utf8"),
  readFile(environmentExamplePath, "utf8"),
]);

const createdTables = [...migration.matchAll(/create table\s+public\.([a-z_]+)/gi)].map(
  (match) => match[1],
);
assert.deepEqual(createdTables, ["assignment_response_tokens"]);
const tableDefinition = migration.match(
  /create table public\.assignment_response_tokens\s*\(([\s\S]*?)\n\);/i,
)?.[1];
assert.ok(tableDefinition);

assert.match(tableDefinition, /token_verifier_hash bytea not null/i);
assert.doesNotMatch(tableDefinition, /^\s*(?:raw_)?(?:bearer_)?token\s/im);
assert.doesNotMatch(tableDefinition, /^\s*(?:email|volunteer_name|phone|questionnaire|emergency_contact)\s/im);
assert.match(
  tableDefinition,
  /foreign key\s*\(\s*workspace_id,\s*assignment_id,\s*volunteer_profile_id\s*\)[\s\S]*references public\.calendar_assignments\s*\(\s*workspace_id,\s*id,\s*volunteer_profile_id\s*\)/i,
);
assert.match(tableDefinition, /unique \(token_verifier_hash\)/i);
assert.match(tableDefinition, /octet_length\(token_verifier_hash\) = 32/i);
assert.match(tableDefinition, /purpose = 'assignment_response'/i);
assert.match(tableDefinition, /expires_at > created_at/i);
assert.match(tableDefinition, /revoked_at is null or revoked_at >= created_at/i);
assert.match(tableDefinition, /last_used_at is null or last_used_at >= created_at/i);
assert.match(tableDefinition, /char_length\(internal_note\) between 1 and 500/i);

assert.match(migration, /create extension if not exists pgcrypto with schema extensions/i);
assert.match(migration, /extensions\.gen_random_bytes\(32\)/i);
assert.match(migration, /translate\([\s\S]*'\+\/'[\s\S]*'-_'/i);
assert.match(migration, /extensions\.digest\(issued_bearer_token, 'sha256'\)/i);
const tokenInsertColumns = migration.match(
  /insert into public\.assignment_response_tokens\s*\(([\s\S]*?)\)\s*values/i,
)?.[1];
assert.ok(tokenInsertColumns);
assert.doesNotMatch(tokenInsertColumns, /raw|bearer/i);

assert.match(migration, /alter table public\.assignment_response_tokens enable row level security/i);
assert.match(
  migration,
  /revoke all on table public\.assignment_response_tokens from anon, authenticated/i,
);
assert.doesNotMatch(
  migration,
  /grant (?:select|insert|update|delete|all).*assignment_response_tokens.*to (?:anon|authenticated)/i,
);
assert.doesNotMatch(migration, /create policy[\s\S]*assignment_response_tokens/i);

assert.match(migration, /response_source in \('project_contact', 'public_token'\)/i);
assert.match(migration, /create function public\.issue_assignment_response_token\(/i);
assert.match(migration, /create function public\.revoke_assignment_response_token\(p_token_id uuid\)/i);
assert.match(migration, /grant_row\.capabilities @> array\['assignments\.edit'\]::text\[\]/i);
assert.match(migration, /assignment\.lifecycle = 'active'/i);
assert.match(migration, /volunteer\.readiness_status = 'ready'/i);
assert.match(migration, /p_ttl_hours not between 1 and 720/i);
assert.match(migration, /returns table \(\s*token_id uuid,\s*bearer_token text,\s*token_expires_at timestamptz/i);

const issueSignature = migration.match(
  /create function public\.issue_assignment_response_token\(([\s\S]*?)\)\s*returns table/i,
)?.[1];
assert.ok(issueSignature);
assert.doesNotMatch(issueSignature, /workspace|volunteer|hash|verifier|bearer|response_status/i);

assert.match(migration, /create function public\.read_assignment_response_by_token\(p_bearer_token text\)/i);
const readReturnShape = migration.match(
  /create function public\.read_assignment_response_by_token\(p_bearer_token text\)\s*returns table \(([\s\S]*?)\)\s*language sql/i,
)?.[1];
assert.ok(readReturnShape);
for (const safeField of [
  "workspace_display_name",
  "assignment_reference",
  "task_title",
  "schedule_kind",
  "start_date",
  "end_date",
  "start_time",
  "end_time",
  "schedule_timezone",
  "current_response_status",
]) {
  assert.match(readReturnShape, new RegExp(`\\b${safeField}\\b`, "i"));
}
assert.doesNotMatch(
  readReturnShape,
  /volunteer|email|phone|questionnaire|emergency|grant|capabilit|token|note|roster|needed_count/i,
);

for (const tokenPredicate of [
  "token.purpose = 'assignment_response'",
  "token.revoked_at is null",
  "token.expires_at > now()",
  "assignment.lifecycle = 'active'",
  "volunteer.lifecycle = 'active'",
  "volunteer.readiness_status = 'ready'",
  "item.lifecycle = 'active'",
  "workspace.lifecycle = 'active'",
]) {
  assert.ok(migration.toLowerCase().includes(tokenPredicate), `Missing: ${tokenPredicate}`);
}
assert.match(migration, /token\.token_verifier_hash = extensions\.digest\(p_bearer_token, 'sha256'\)/i);

assert.match(migration, /create function public\.submit_assignment_response_by_token\(/i);
const submitSignature = migration.match(
  /create function public\.submit_assignment_response_by_token\(([\s\S]*?)\)\s*returns table/i,
)?.[1];
assert.ok(submitSignature);
assert.doesNotMatch(submitSignature, /workspace|assignment_id|volunteer|source|hash|verifier|coverage|filled/i);
assert.match(migration, /p_response_status not in \('confirmed', 'declined'\)/i);
assert.match(migration, /response_source = 'public_token'/i);
assert.match(migration, /for update of token, response nowait/i);
assert.match(migration, /response\.response_status = existing_response_status/i);
assert.match(migration, /set last_used_at = recorded_at/i);
assert.match(migration, /when lock_not_available then[\s\S]*errcode = '40001'/i);
assert.doesNotMatch(migration, /perform public\.update_assignment_response|select public\.update_assignment_response/i);

assert.match(
  migration,
  /grant execute on function public\.issue_assignment_response_token\(uuid, integer, text\) to authenticated/i,
);
assert.doesNotMatch(
  migration,
  /^grant execute on function public\.issue_assignment_response_token\([^\n]+\) to anon/m,
);
assert.match(
  migration,
  /grant execute on function public\.read_assignment_response_by_token\(text\) to anon, authenticated/i,
);
assert.match(
  migration,
  /grant execute on function public\.submit_assignment_response_by_token\(text, text, text\) to anon, authenticated/i,
);
assert.doesNotMatch(migration, /service_role/i);

assert.match(serverBoundary, /^import "server-only";/);
assert.deepEqual(
  [...serverBoundary.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((match) => match[1]),
  [
    "issue_assignment_response_token",
    "revoke_assignment_response_token",
    "read_assignment_response_by_token",
    "submit_assignment_response_by_token",
  ],
);
assert.equal((serverBoundary.match(/supabase\.auth\.getUser\(\)/g) ?? []).length, 1);
assert.doesNotMatch(serverBoundary, /\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\./i);
assert.match(environmentExample, /^ADMIN_AUTH_MODE=review$/m);
assert.match(environmentExample, /^RESPONSE_LINK_BASE_URL=$/m);

assert.match(publicRouteBoundary, /^import "server-only";/);
assert.match(publicRouteBoundary, /readAssignmentResponseByToken/);
assert.match(publicRouteBoundary, /submitAssignmentResponseByToken/);
assert.doesNotMatch(
  publicRouteBoundary,
  /issueAssignmentResponseToken|revokeAssignmentResponseToken|\.from\(|\.rpc\(|serviceRole|SUPABASE_SERVICE_ROLE_KEY|console\.|logger\./i,
);
assert.match(publicRouteState, /sqlState === "40001"[\s\S]*return "changed"/);
assert.match(publicRouteState, /sqlState === "42501"[\s\S]*return "unavailable"/);

assert.match(responsePage, /loadPublicAssignmentResponseRoute\(token\)/);
assert.match(responsePage, /async function submitAction\(formData: FormData\)[\s\S]*"use server"/);
assert.doesNotMatch(responsePage, /\.bind\(null, token\)/);
assert.match(responseAction, /^import "server-only";/);
assert.match(responseAction, /submitPublicAssignmentResponseForRoute/);
assert.match(responseAction, /classifyPublicAssignmentResponseSubmissionError/);
assert.match(responseAction, /noteValue\.trim\(\)[\s\S]*normalizedNote \|\| null/);
assert.doesNotMatch(responseAction, /\.rpc\(|updateAssignmentResponse|assignments\/server/);
assert.doesNotMatch(
  `${responsePage}\n${responseAction}`,
  /volunteerPreview|mockData|serviceRole|SUPABASE_SERVICE_ROLE_KEY|console\.|logger\.|token_verifier|bearer_token|questionnaire|emergency_contact|workspaceId|assignmentId|volunteerId|responseSource/i,
);
assert.doesNotMatch(responsePage, /assignmentReference/);
assert.match(responsePage, /This link is expired or unavailable/);
assert.match(responsePage, /This response changed\./);
assert.match(responsePage, /No account or password is needed/);
assert.match(responsePage, /name="response"[\s\S]*value="confirmed"/);
assert.match(responsePage, /name="response"[\s\S]*value="declined"/);
assert.doesNotMatch(responsePage, /value="needs_response"/);
assert.match(responseRouteQa, /isLoopbackUrl\(supabaseUrl\)/);
assert.match(responseRouteQa, /isLoopbackUrl\(previewBaseUrl\)/);
assert.match(responseRouteQa, /finally\s*\{[\s\S]*cleanupFixtures\(containerName\)/);
assert.match(responseRouteQa, /response_source[\s\S]*last_used_at/);
assert.doesNotMatch(
  responseRouteQa,
  /SUPABASE_SERVICE_ROLE_KEY|serviceRole|createClient\([^\n]+service|console\.(?:log|error)\(\s*(?:bearerToken|responseUrl|password|access_token)|\$\{(?:bearerToken|responseUrl|password|access_token)\}/i,
);

assert.match(responseLinkBoundary, /^import "server-only";/);
assert.match(responseLinkBoundary, /issueAssignmentResponseTokenWithClient/);
assert.match(responseLinkBoundary, /issueAssignmentResponseToken/);
assert.match(responseLinkBoundary, /issueAssignmentResponseLinkWithIssuer/);
assert.doesNotMatch(
  responseLinkBoundary,
  /\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\./i,
);
assert.match(responseLinkQa, /isLoopbackUrl\(supabaseUrl\)/);
assert.match(responseLinkQa, /isLoopbackUrl\(responseLinkBaseUrl\)/);
assert.match(responseLinkQa, /finally\s*\{[\s\S]*cleanupFixtures\(containerName\)/);
assert.match(responseLinkQa, /storedTokenState === "32\|assignment_response\|0"/);
assert.doesNotMatch(
  responseLinkQa,
  /SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.(?:log|error)\(\s*(?:issuedBearer|responseUrl|password|access_token)|console\.(?:log|error)\([^\n]*\$\{(?:issuedBearer|responseUrl|password|access_token)\}/i,
);

assert.match(responseLinkDiagnosticBoundary, /^import "server-only";/);
assert.match(responseLinkDiagnosticBoundary, /issueAssignmentResponseLink\(/);
assert.match(responseLinkDiagnosticBoundary, /validateResponseLinkBaseUrl\(/);
assert.match(responseLinkDiagnosticBoundary, /redactedUrl: issued\.redactedUrl/);
assert.doesNotMatch(
  responseLinkDiagnosticBoundary,
  /\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\./i,
);
assert.match(responseLinkDiagnosticPage, /readProjectContactSession\(\)/);
assert.match(responseLinkDiagnosticPage, /robots: \{ index: false, follow: false \}/);
assert.match(responseLinkDiagnosticPage, /\/respond\/\[redacted\]/);
assert.match(responseLinkDiagnosticPage, /Response-link origin is not configured/);
assert.match(responseLinkDiagnosticPage, /Check the diagnostic input/);
assert.doesNotMatch(
  responseLinkDiagnosticPage,
  /responseUrl|bearer_token|token_verifier|serviceRole|SUPABASE_SERVICE_ROLE_KEY|mockData|volunteerPreview/i,
);
assert.match(responseLinkDiagnosticAction, /issueResponseLinkDiagnostic\(/);
assert.match(responseLinkDiagnosticAction, /formData\.get\("assignmentId"\)/);
assert.match(responseLinkDiagnosticAction, /formData\.get\("expiresInHours"\)/);
assert.doesNotMatch(
  responseLinkDiagnosticAction,
  /\.rpc\(|issue_assignment_response_token|responseUrl|bearer|verifier|workspaceId|volunteerId|actor|source|purpose|serviceRole|SUPABASE_SERVICE_ROLE_KEY/i,
);

const assignmentId = "550e8400-e29b-41d4-a716-446655440040";
const tokenId = "550e8400-e29b-41d4-a716-446655440041";
const bearerToken = "A".repeat(43);
const issueInput = validateIssueAssignmentResponseTokenInput({ assignmentId });
assert.equal(issueInput.expiresInHours, 168);
assert.equal(issueInput.internalNote, null);
assert.deepEqual(validateRevokeAssignmentResponseTokenInput({ tokenId }), { tokenId });
assert.deepEqual(validateReadAssignmentResponseByTokenInput({ token: bearerToken }), {
  token: bearerToken,
});
assert.throws(
  () => validateReadAssignmentResponseByTokenInput({ token: "malformed" }),
  ResponseTokenValidationError,
);
assert.equal(
  validateSubmitAssignmentResponseByTokenInput({
    token: bearerToken,
    status: "confirmed",
    note: "I can help.",
  }).status,
  "confirmed",
);

for (const rejected of [
  { assignmentId, tokenHash: "caller-supplied" },
  { assignmentId, workspaceId: "550e8400-e29b-41d4-a716-446655440042" },
  { assignmentId, volunteerProfileId: "550e8400-e29b-41d4-a716-446655440043" },
  { assignmentId, filledCount: 2 },
  { assignmentId, questionnaireAnswers: {} },
  { assignmentId, emergencyContact: {} },
  { assignmentId, scheduleQuery: {} },
]) {
  assert.throws(() => validateIssueAssignmentResponseTokenInput(rejected), ResponseTokenValidationError);
}
for (const rejected of [
  { token: bearerToken, status: "needs_response" },
  { token: bearerToken, status: "confirmed", assignmentId },
  { token: bearerToken, status: "declined", responseSource: "public_token" },
  { token: bearerToken, status: "confirmed", openCount: 1 },
  { token: bearerToken, status: "confirmed", tokenHash: "forged" },
]) {
  assert.throws(
    () => validateSubmitAssignmentResponseByTokenInput(rejected),
    ResponseTokenValidationError,
  );
}

const issued = parseIssuedAssignmentResponseToken([
  {
    token_id: tokenId,
    bearer_token: bearerToken,
    token_expires_at: "2026-07-08T12:00:00.000Z",
  },
]);
assert.equal(issued.token, bearerToken);
const context = parsePublicAssignmentResponseContext([
  {
    workspace_display_name: "Belgrade Major Remodel 2026",
    assignment_reference: assignmentId,
    task_title: "Material staging",
    schedule_kind: "timed",
    start_date: "2026-07-02",
    end_date: null,
    start_time: "09:00:00",
    end_time: "11:00:00",
    schedule_timezone: "America/Denver",
    current_response_status: "needs_response",
  },
]);
assert.equal(context?.taskTitle, "Material staging");
assert.equal("volunteerName" in context, false);
assert.equal(parsePublicAssignmentResponseContext([]), null);
const responseResult = parsePublicAssignmentResponseResult([
  {
    assignment_reference: assignmentId,
    current_response_status: "confirmed",
    response_recorded_at: "2026-07-01T12:00:00.000Z",
  },
]);
assert.equal(responseResult.status, "confirmed");

assert.equal(validateResponseLinkBaseUrl("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
assert.equal(validateResponseLinkBaseUrl("https://preview.example.test/"), "https://preview.example.test");
for (const invalidBaseUrl of [
  "",
  "not-a-url",
  "javascript:alert(1)",
  "data:text/plain,hello",
  "blob:https://example.test/id",
  "file:///tmp/response",
  "http://example.test",
  "https://user:password@example.test",
  "https://example.test/app",
  "https://example.test/?next=respond",
  " https://example.test",
]) {
  assert.throws(() => validateResponseLinkBaseUrl(invalidBaseUrl), ResponseLinkValidationError);
}

let linkIssuerInput;
const issuedLink = await issueAssignmentResponseLinkWithIssuer(
  {
    assignmentId,
    expiresInHours: 12,
    baseUrl: "https://preview.example.test",
  },
  async (input) => {
    linkIssuerInput = input;
    return {
      tokenId,
      token: bearerToken,
      expiresAt: "2026-07-03T12:00:00.000Z",
    };
  },
);
assert.deepEqual(linkIssuerInput, {
  assignmentId,
  expiresInHours: 12,
  internalNote: null,
});
assert.equal(
  issuedLink.responseUrl,
  `https://preview.example.test/respond/${bearerToken}`,
);
assert.equal(issuedLink.redactedUrl, "https://preview.example.test/respond/[redacted]");
assert.equal(redactAssignmentResponseLink(issuedLink.responseUrl), issuedLink.redactedUrl);
assert.equal(redactAssignmentResponseLink("not-a-link"), "[invalid response link]");
await assert.rejects(
  issueAssignmentResponseLinkWithIssuer(
    { assignmentId, baseUrl: "https://preview.example.test", workspaceId: "forbidden" },
    async () => ({ tokenId, token: bearerToken, expiresAt: "2026-07-03T12:00:00.000Z" }),
  ),
  ResponseLinkValidationError,
);
await assert.rejects(
  issueAssignmentResponseLinkWithIssuer(
    { assignmentId: "malformed", baseUrl: "https://preview.example.test" },
    async () => ({ tokenId, token: bearerToken, expiresAt: "2026-07-03T12:00:00.000Z" }),
  ),
  ResponseLinkValidationError,
);

const parsedStoredResponse = parseAssignmentResponse({
  id: "550e8400-e29b-41d4-a716-446655440044",
  workspace_id: "550e8400-e29b-41d4-a716-446655440045",
  assignment_id: assignmentId,
  response_status: "confirmed",
  response_source: "public_token",
  response_note: null,
  responded_at: "2026-07-01T12:00:00.000Z",
  updated_by_auth_user_id: null,
  created_at: "2026-07-01T11:00:00.000Z",
  updated_at: "2026-07-01T12:00:00.000Z",
});
assert.equal(parsedStoredResponse.source, "public_token");

const at = new Date("2026-07-01T12:00:00.000Z");
const authorizedGrant = {
  id: "grant-a",
  workspaceId: "workspace-a",
  projectContactId: "contact-a",
  role: "main_contact",
  capabilities: ["workspace.read", "assignments.edit"],
  status: "active",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: null,
  revokedAt: null,
};
const adjacentGrant = {
  ...authorizedGrant,
  id: "grant-b",
  capabilities: ["workspace.read", "calendar.view", "volunteers.view"],
};
assert.equal(
  isEffectiveWorkspaceReadGrant(authorizedGrant, at) &&
    authorizedGrant.capabilities.includes("assignments.edit"),
  true,
);
assert.equal(
  isEffectiveWorkspaceReadGrant(adjacentGrant, at) &&
    adjacentGrant.capabilities.includes("assignments.edit"),
  false,
);

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
const responseLinkRouteImports = [];
for (const file of routeFiles) {
  const source = await readFile(file, "utf8");
  if (source.includes("lib/responseTokens/server")) {
    routeImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
  if (source.includes("lib/responseTokens/link")) {
    responseLinkRouteImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
}
assert.deepEqual(
  routeImports,
  [],
  "Routes must not bypass the narrow public response-route boundary",
);
assert.deepEqual(
  responseLinkRouteImports,
  [],
  "No public or admin route may import the project-contact link issuer",
);

const diagnosticRoutePath = "app/admin/diagnostics/response-link/";
const linkedDiagnosticSources = [];
for (const directory of ["app", "components", "lib"]) {
  const files = (await collectFiles(path.join(root, directory))).filter((file) =>
    /\.(?:ts|tsx)$/.test(file),
  );
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll("\\", "/");
    if (relative.startsWith(diagnosticRoutePath)) continue;
    const source = await readFile(file, "utf8");
    if (source.includes("/admin/diagnostics/response-link")) {
      linkedDiagnosticSources.push(relative);
    }
  }
}
assert.deepEqual(
  linkedDiagnosticSources,
  [],
  "The response-link diagnostic must remain unlinked outside its own route",
);

console.log("Public assignment-response token checks passed.");
console.log("Confirmed hashed opaque bearers, narrow public RPCs, and the isolated response route shell.");
