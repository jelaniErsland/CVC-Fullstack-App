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
import {
  DIAGNOSTIC_RESPONSE_LINK_TTL_HOURS,
  FULL_RESPONSE_LINK_EXPOSURE_POLICY,
  PRODUCT_RESPONSE_LINK_DEFAULT_TTL_HOURS,
  PRODUCT_RESPONSE_LINK_MAXIMUM_TTL_HOURS,
  RESPONSE_LINK_AUDIT_RETENTION,
  RESPONSE_LINK_DELIVERY_PREREQUISITES,
  RESPONSE_LINK_REPLACEMENT_POLICY,
  ResponseLinkPolicyError,
  describeResponseLinkReplacementPolicy,
  mayExposeFullAssignmentResponseLink,
  normalizeResponseLinkTtlHours,
} from "../lib/responseTokens/policy.ts";
import {
  RESPONSE_LINK_REVEAL_AUDIT_EVENT_FIELDS,
  RESPONSE_LINK_REVEAL_AUDIT_METADATA_MAX_KEYS,
  RESPONSE_LINK_REVEAL_AUDIT_REASON_CODE_MAX_LENGTH,
  RESPONSE_LINK_REVEAL_AUDIT_PERSISTENCE_AVAILABLE,
  RESPONSE_LINK_REVEAL_AUDIT_PROHIBITED_FIELDS,
  RESPONSE_LINK_REVEAL_MODES,
  RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE,
  RESPONSE_LINK_REVEAL_TRANSACTIONAL_COMMAND_AVAILABLE,
  canCurrentSurfaceRevealFullResponseLink,
  describeResponseLinkRevealPrerequisites,
  evaluateFutureResponseLinkReveal,
  responseLinkRevealPolicy,
} from "../lib/responseTokens/revealPolicy.server.ts";
import {
  FUTURE_RESPONSE_LINK_PRODUCT_SURFACE,
  RESPONSE_LINK_ASSIGNMENT_DETAIL_CONTEXT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE,
  describeResponseLinkProductSurfaceReadiness,
  getFutureResponseLinkProductSurfaceRequirements,
  isResponseLinkProductSurfaceAvailable,
  responseLinkProductSurfaceContract,
} from "../lib/responseTokens/productSurfacePolicy.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260701070000_assignment_response_tokens.sql",
);
const replacementMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260702000000_atomic_response_token_replacement.sql",
);
const revealAuditMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260703000000_response_link_reveal_audit.sql",
);
const auditedRevealMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260704000000_audited_response_link_reveal.sql",
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
const hostedResponseReplacementQaPath = path.join(
  root,
  "scripts",
  "hosted-response-replacement-regression.mjs",
);
const hostedResponseRevealAuditQaPath = path.join(
  root,
  "scripts",
  "hosted-response-reveal-audit-regression.mjs",
);
const hostedAuditedResponseRevealQaPath = path.join(
  root,
  "scripts",
  "hosted-response-reveal-regression.mjs",
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
const responseLinkPolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "policy.ts",
);
const responseLinkRevealPolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "revealPolicy.server.ts",
);
const responseLinkProductSurfacePolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productSurfacePolicy.server.ts",
);
const responseLinkRevealAuditBoundaryPath = path.join(
  root,
  "lib",
  "responseTokens",
  "revealAudit.server.ts",
);
const auditedResponseLinkRevealBoundaryPath = path.join(
  root,
  "lib",
  "responseTokens",
  "auditedReveal.server.ts",
);
const responseTokenReplacementBoundaryPath = path.join(
  root,
  "lib",
  "responseTokens",
  "replacement.server.ts",
);
const responseLinkReplacementBoundaryPath = path.join(
  root,
  "lib",
  "responseTokens",
  "replacementLink.server.ts",
);
const environmentExamplePath = path.join(root, ".env.example");
const packagePath = path.join(root, "package.json");
const [
  migration,
  replacementMigration,
  revealAuditMigration,
  auditedRevealMigration,
  serverBoundary,
  publicRouteBoundary,
  publicRouteState,
  responsePage,
  responseAction,
  responseRouteQa,
  responseLinkBoundary,
  responseLinkQa,
  hostedResponseReplacementQa,
  hostedResponseRevealAuditQa,
  hostedAuditedResponseRevealQa,
  responseLinkDiagnosticBoundary,
  responseLinkDiagnosticPage,
  responseLinkDiagnosticAction,
  responseLinkPolicy,
  responseLinkRevealPolicySource,
  responseLinkProductSurfacePolicySource,
  responseLinkRevealAuditBoundary,
  auditedResponseLinkRevealBoundary,
  responseTokenReplacementBoundary,
  responseLinkReplacementBoundary,
  environmentExample,
  packageSource,
] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(replacementMigrationPath, "utf8"),
  readFile(revealAuditMigrationPath, "utf8"),
  readFile(auditedRevealMigrationPath, "utf8"),
  readFile(serverBoundaryPath, "utf8"),
  readFile(publicRouteBoundaryPath, "utf8"),
  readFile(publicRouteStatePath, "utf8"),
  readFile(responsePagePath, "utf8"),
  readFile(responseActionPath, "utf8"),
  readFile(responseRouteQaPath, "utf8"),
  readFile(responseLinkBoundaryPath, "utf8"),
  readFile(responseLinkQaPath, "utf8"),
  readFile(hostedResponseReplacementQaPath, "utf8"),
  readFile(hostedResponseRevealAuditQaPath, "utf8"),
  readFile(hostedAuditedResponseRevealQaPath, "utf8"),
  readFile(responseLinkDiagnosticBoundaryPath, "utf8"),
  readFile(responseLinkDiagnosticPagePath, "utf8"),
  readFile(responseLinkDiagnosticActionPath, "utf8"),
  readFile(responseLinkPolicyPath, "utf8"),
  readFile(responseLinkRevealPolicyPath, "utf8"),
  readFile(responseLinkProductSurfacePolicyPath, "utf8"),
  readFile(responseLinkRevealAuditBoundaryPath, "utf8"),
  readFile(auditedResponseLinkRevealBoundaryPath, "utf8"),
  readFile(responseTokenReplacementBoundaryPath, "utf8"),
  readFile(responseLinkReplacementBoundaryPath, "utf8"),
  readFile(environmentExamplePath, "utf8"),
  readFile(packagePath, "utf8"),
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
const revokeFunction = migration.match(
  /create function public\.revoke_assignment_response_token\(p_token_id uuid\)([\s\S]*?)\$\$;/i,
)?.[1];
assert.ok(revokeFunction);
assert.match(revokeFunction, /set revoked_at = now\(\)/i);
assert.match(revokeFunction, /grant_row\.capabilities @> array\['assignments\.edit'\]::text\[\]/i);
assert.doesNotMatch(revokeFunction, /delete from/i);
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
assert.match(
  migration,
  /create function public\.read_assignment_response_by_token\(p_bearer_token text\)[\s\S]*?token\.revoked_at is null[\s\S]*?\$\$;/i,
);

assert.match(migration, /create function public\.submit_assignment_response_by_token\(/i);
const submitSignature = migration.match(
  /create function public\.submit_assignment_response_by_token\(([\s\S]*?)\)\s*returns table/i,
)?.[1];
assert.ok(submitSignature);
assert.doesNotMatch(submitSignature, /workspace|assignment_id|volunteer|source|hash|verifier|coverage|filled/i);
assert.match(migration, /p_response_status not in \('confirmed', 'declined'\)/i);
assert.match(migration, /response_source = 'public_token'/i);
assert.match(
  migration,
  /create function public\.submit_assignment_response_by_token\([\s\S]*?token\.revoked_at is null[\s\S]*?\$\$;/i,
);
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
assert.doesNotMatch(migration, /delete from public\.assignment_response_tokens/i);

assert.match(
  replacementMigration,
  /create function public\.replace_assignment_response_token\(\s*p_assignment_id uuid,\s*p_ttl_hours integer\s*\)/i,
);
assert.match(replacementMigration, /language plpgsql\s*security definer\s*set search_path = ''/i);
assert.match(replacementMigration, /p_ttl_hours not between 1 and 168/i);
assert.match(replacementMigration, /auth\.uid\(\)/i);
assert.match(replacementMigration, /grant_row\.capabilities @> array\['assignments\.edit'\]::text\[\]/i);
assert.match(replacementMigration, /for update of assignment/i);
assert.match(
  replacementMigration,
  /update public\.assignment_response_tokens as token[\s\S]*token\.assignment_id = p_assignment_id[\s\S]*token\.purpose = 'assignment_response'[\s\S]*token\.revoked_at is null/i,
);
assert.match(replacementMigration, /set revoked_at = replacement_time/i);
assert.match(replacementMigration, /extensions\.gen_random_bytes\(32\)/i);
assert.match(replacementMigration, /extensions\.digest\(replacement_bearer_token, 'sha256'\)/i);
assert.match(
  replacementMigration,
  /returns table \(\s*token_id uuid,\s*bearer_token text,\s*token_expires_at timestamptz/i,
);
assert.match(
  replacementMigration,
  /grant execute on function public\.replace_assignment_response_token\(uuid, integer\) to authenticated/i,
);
assert.doesNotMatch(
  replacementMigration,
  /delete from|service_role|create policy|grant (?:select|insert|update|delete|all).*assignment_response_tokens/i,
);

const revealAuditTable = revealAuditMigration.match(
  /create table public\.assignment_response_link_reveal_events\s*\(([\s\S]*?)\n\);/i,
)?.[1];
assert.ok(revealAuditTable);
assert.match(
  revealAuditTable,
  /foreign key\s*\(\s*workspace_id,\s*assignment_id,\s*response_token_id\s*\)[\s\S]*references public\.assignment_response_tokens\s*\(\s*workspace_id,\s*assignment_id,\s*id\s*\)/i,
);
assert.match(revealAuditTable, /action = 'response_link_revealed'/i);
assert.match(
  revealAuditTable,
  /reveal_surface = 'future_project_contact_assignment_response_reveal'/i,
);
assert.match(
  revealAuditTable,
  /reveal_mode in \('copy_link', 'email_delivery', 'reminder_delivery'\)/i,
);
assert.match(revealAuditTable, /response_link_reveal_metadata_is_valid\(metadata\)/i);
assert.doesNotMatch(
  revealAuditTable,
  /^\s*(?:note|raw_bearer|bearer_token|full_response_url|response_url|token_verifier_hash|password|access_token|refresh_token|service_role|emergency_contact|questionnaire_answers)\s/im,
);
assert.match(
  revealAuditMigration,
  /entry\.key not in \('reason_code', 'delivery_requested', 'request_correlation_id'\)/i,
);
assert.match(revealAuditMigration, /metadata_key_count > 3/i);
assert.match(
  revealAuditMigration,
  /alter table public\.assignment_response_link_reveal_events enable row level security/i,
);
assert.match(
  revealAuditMigration,
  /revoke all on table public\.assignment_response_link_reveal_events from anon, authenticated/i,
);
assert.doesNotMatch(
  revealAuditMigration,
  /create policy[\s\S]*assignment_response_link_reveal_events|grant (?:select|insert|update|delete|all).*assignment_response_link_reveal_events|delete from|service_role/i,
);
assert.match(
  revealAuditMigration,
  /create function public\.record_assignment_response_link_reveal_event\(/i,
);
assert.match(revealAuditMigration, /language plpgsql\s*security definer\s*set search_path = ''/i);
assert.match(revealAuditMigration, /auth\.uid\(\)/i);
assert.match(revealAuditMigration, /grant_row\.capabilities @> array\['assignments\.edit'\]::text\[\]/i);
assert.match(revealAuditMigration, /token\.assignment_id = p_assignment_id/i);
assert.match(revealAuditMigration, /token\.revoked_at is null/i);
assert.match(revealAuditMigration, /token\.expires_at > recorded_at/i);
assert.match(revealAuditMigration, /token\.expires_at = p_expires_at/i);
assert.match(revealAuditMigration, /for share of token/i);
assert.doesNotMatch(
  revealAuditMigration.match(
    /create function public\.record_assignment_response_link_reveal_event\(([\s\S]*?)\$\$;/i,
  )?.[1] ?? "",
  /bearer|verifier|questionnaire|emergency|volunteer_profile/i,
);
assert.match(
  revealAuditMigration,
  /grant execute on function public\.record_assignment_response_link_reveal_event\([\s\S]*?\) to authenticated/i,
);

assert.match(
  auditedRevealMigration,
  /create function public\.reveal_assignment_response_link\(\s*p_assignment_id uuid,\s*p_ttl_hours integer,\s*p_reveal_mode text,\s*p_metadata jsonb\s*\)/i,
);
assert.match(auditedRevealMigration, /language plpgsql\s*security definer\s*set search_path = ''/i);
assert.match(auditedRevealMigration, /auth\.uid\(\)/i);
assert.match(auditedRevealMigration, /p_ttl_hours not between 1 and 168/i);
assert.match(auditedRevealMigration, /response_link_reveal_metadata_is_valid\(normalized_metadata\)/i);
assert.match(auditedRevealMigration, /grant_row\.capabilities @> array\['assignments\.edit'\]::text\[\]/i);
assert.match(auditedRevealMigration, /for update of assignment/i);
assert.match(
  auditedRevealMigration,
  /update public\.assignment_response_tokens as token[\s\S]*token\.assignment_id = p_assignment_id[\s\S]*token\.purpose = 'assignment_response'[\s\S]*token\.revoked_at is null/i,
);
assert.match(auditedRevealMigration, /extensions\.gen_random_bytes\(32\)/i);
assert.match(auditedRevealMigration, /extensions\.digest\(replacement_bearer_token, 'sha256'\)/i);
assert.match(
  auditedRevealMigration,
  /insert into public\.assignment_response_link_reveal_events[\s\S]*replacement_token_id[\s\S]*target_actor_project_contact_id/i,
);
assert.match(
  auditedRevealMigration,
  /returns table \(\s*response_token_id uuid,\s*audit_event_id uuid,\s*token_expires_at timestamptz,\s*bearer_token text,\s*event_reveal_surface text,\s*event_reveal_mode text/i,
);
assert.match(
  auditedRevealMigration,
  /grant execute on function public\.reveal_assignment_response_link\(uuid, integer, text, jsonb\) to authenticated/i,
);
assert.doesNotMatch(
  auditedRevealMigration,
  /delete from|service_role|create policy|grant (?:select|insert|update|delete|all).*assignment_response/i,
);

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
assert.match(
  packageSource,
  /"test:response-replacement:hosted":\s*"node scripts\/hosted-response-replacement-regression\.mjs"/,
);
assert.match(hostedResponseReplacementQa, /const expectedRef = "kfuujcfxoayukywvtaeh"/);
assert.match(hostedResponseReplacementQa, /const expectedName = "project-local-staging"/);
assert.match(
  hostedResponseReplacementQa,
  /RUN_HOSTED_RESPONSE_REPLACEMENT_VALIDATION === expectedConfirmation/,
);
assert.match(hostedResponseReplacementQa, /supabase[\s\S]*\.temp[\s\S]*project-ref/);
assert.match(hostedResponseReplacementQa, /entry\.name === "anon"/);
assert.doesNotMatch(hostedResponseReplacementQa, /--reveal|service_role|SUPABASE_SERVICE_ROLE_KEY/);
assert.match(hostedResponseReplacementQa, /finally\s*\{[\s\S]*cleanupFixtures\(\)/);
assert.match(hostedResponseReplacementQa, /Hosted disposable fixture and Auth residue: 0/);
assert.match(hostedResponseReplacementQa, /replace_assignment_response_token/);
assert.match(hostedResponseReplacementQa, /p_ttl_hours: 169/);
assert.match(hostedResponseReplacementQa, /Promise\.all\(\[/);
assert.doesNotMatch(
  hostedResponseReplacementQa,
  /console\.(?:log|error)\(\s*(?:oldBearer|replacementBearer|concurrentBearers|password|access_token|refresh_token|api_key)\b/i,
);
assert.doesNotMatch(
  hostedResponseReplacementQa,
  /console\.(?:log|error)\(\s*`[^`]*\$\{(?:oldBearer|replacementBearer|concurrentBearers|password|access_token|refresh_token|api_key)\}/i,
);
assert.match(
  packageSource,
  /"test:response-reveal-audit:hosted":\s*"node scripts\/hosted-response-reveal-audit-regression\.mjs"/,
);
assert.match(hostedResponseRevealAuditQa, /const expectedRef = "kfuujcfxoayukywvtaeh"/);
assert.match(hostedResponseRevealAuditQa, /const expectedName = "project-local-staging"/);
assert.match(
  hostedResponseRevealAuditQa,
  /RUN_HOSTED_RESPONSE_REVEAL_AUDIT_VALIDATION === expectedConfirmation/,
);
assert.match(hostedResponseRevealAuditQa, /latestMigration === "20260703000000"/);
assert.match(hostedResponseRevealAuditQa, /record_assignment_response_link_reveal_event/);
assert.match(hostedResponseRevealAuditQa, /assignment_response_link_reveal_events/);
assert.match(hostedResponseRevealAuditQa, /replace_assignment_response_token/);
assert.match(hostedResponseRevealAuditQa, /qa-11-22-%/);
assert.match(hostedResponseRevealAuditQa, /finally\s*\{[\s\S]*cleanupFixtures\(\)/);
assert.match(hostedResponseRevealAuditQa, /Hosted disposable fixture and Auth residue: 0/);
assert.doesNotMatch(
  hostedResponseRevealAuditQa,
  /--reveal|SUPABASE_SERVICE_ROLE_KEY|entry\.name === "service_role"|delete\s+from\s+public\.assignment_response_tokens\s+where\s+id\s*=/i,
);
assert.doesNotMatch(
  hostedResponseRevealAuditQa,
  /console\.(?:log|error)\(\s*(?:oldBearer|replacementBearer|concurrentBearers|password|access_token|refresh_token|api_key)\b/i,
);
assert.match(
  packageSource,
  /"test:response-reveal:hosted":\s*"node scripts\/hosted-response-reveal-regression\.mjs"/,
);
assert.match(hostedAuditedResponseRevealQa, /const expectedRef = "kfuujcfxoayukywvtaeh"/);
assert.match(hostedAuditedResponseRevealQa, /const expectedName = "project-local-staging"/);
assert.match(
  hostedAuditedResponseRevealQa,
  /RUN_HOSTED_AUDITED_RESPONSE_REVEAL_VALIDATION === expectedConfirmation/,
);
assert.match(hostedAuditedResponseRevealQa, /latestMigration === "20260704000000"/);
assert.match(hostedAuditedResponseRevealQa, /reveal_assignment_response_link/);
assert.match(hostedAuditedResponseRevealQa, /replace_assignment_response_token/);
assert.match(hostedAuditedResponseRevealQa, /record_assignment_response_link_reveal_event/);
assert.match(hostedAuditedResponseRevealQa, /qa-11-24-%/);
assert.match(hostedAuditedResponseRevealQa, /p_ttl_hours: 169/);
assert.match(hostedAuditedResponseRevealQa, /finally\s*\{[\s\S]*cleanupFixtures\(\)/);
assert.match(hostedAuditedResponseRevealQa, /Hosted disposable fixture and Auth residue: 0/);
assert.doesNotMatch(
  hostedAuditedResponseRevealQa,
  /--reveal|SUPABASE_SERVICE_ROLE_KEY|entry\.name === "service_role"|delete\s+from\s+public\.assignment_response_tokens\s+where\s+id\s*=/i,
);
assert.doesNotMatch(
  hostedAuditedResponseRevealQa,
  /console\.(?:log|error)\(\s*(?:oldBearer|bearer|concurrentBearer|password|access_token|refresh_token|api_key)\b/i,
);

assert.match(responseLinkDiagnosticBoundary, /^import "server-only";/);
assert.match(responseLinkDiagnosticBoundary, /issueAssignmentResponseLink\(/);
assert.match(
  responseLinkDiagnosticBoundary,
  /finally\s*\{[\s\S]*revokeAssignmentResponseToken\(\{ tokenId: issued\.tokenId \}\)/,
);
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
assert.match(responseLinkDiagnosticPage, /max=\{1\}/);
assert.match(responseLinkDiagnosticPage, /readOnly/);
assert.doesNotMatch(
  responseLinkDiagnosticPage,
  /responseUrl|bearer_token|token_verifier|tokenId|token_id|serviceRole|SUPABASE_SERVICE_ROLE_KEY|mockData|volunteerPreview|navigator\.clipboard|writeText\(|Copy full/i,
);
assert.match(responseLinkDiagnosticAction, /issueResponseLinkDiagnostic\(/);
assert.match(responseLinkDiagnosticAction, /formData\.get\("assignmentId"\)/);
assert.match(responseLinkDiagnosticAction, /formData\.get\("expiresInHours"\)/);
assert.doesNotMatch(
  responseLinkDiagnosticAction,
  /\.rpc\(|issue_assignment_response_token|responseUrl|bearer|verifier|tokenId|token_id|workspaceId|volunteerId|actor|source|purpose|serviceRole|SUPABASE_SERVICE_ROLE_KEY/i,
);

assert.match(responseLinkPolicy, /^import "server-only";/);
assert.doesNotMatch(
  responseLinkPolicy,
  /\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\.|delete\s+from/i,
);
assert.match(responseLinkRevealPolicySource, /^import "server-only";/);
assert.doesNotMatch(
  responseLinkRevealPolicySource,
  /\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createClient|console\.|logger\.|delete\s+from/i,
);
assert.match(responseLinkProductSurfacePolicySource, /^import "server-only";/);
assert.match(
  responseLinkProductSurfacePolicySource,
  /RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE = false/,
);
assert.match(responseLinkProductSurfacePolicySource, /requestMethod: "POST"/);
assert.match(responseLinkProductSurfacePolicySource, /rendering: "dynamic_no_store"/);
assert.match(
  responseLinkProductSurfacePolicySource,
  /credentialBoundary: "createAuditedAssignmentResponseLinkReveal_only"/,
);
assert.doesNotMatch(
  responseLinkProductSurfacePolicySource,
  /createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\.|delete\s+from/i,
);
assert.match(responseLinkRevealAuditBoundary, /^import "server-only";/);
assert.match(responseLinkRevealAuditBoundary, /"record_assignment_response_link_reveal_event"/);
assert.match(responseLinkRevealAuditBoundary, /supabase\.auth\.getUser\(\)/);
assert.doesNotMatch(
  responseLinkRevealAuditBoundary,
  /issueAssignmentResponseLink|issueReplacementAssignmentResponseLink|responseUrl|bearer|verifier|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\.|\.from\(|delete/i,
);
assert.match(auditedResponseLinkRevealBoundary, /^import "server-only";/);
assert.match(auditedResponseLinkRevealBoundary, /"reveal_assignment_response_link"/);
assert.match(auditedResponseLinkRevealBoundary, /supabase\.auth\.getUser\(\)/);
assert.match(auditedResponseLinkRevealBoundary, /normalizeResponseLinkTtlHours\("product"/);
assert.match(auditedResponseLinkRevealBoundary, /validateResponseLinkBaseUrl/);
assert.match(auditedResponseLinkRevealBoundary, /redactAssignmentResponseLink/);
assert.doesNotMatch(
  auditedResponseLinkRevealBoundary,
  /replace_assignment_response_token|record_assignment_response_link_reveal_event|\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\.|delete/i,
);
assert.match(responseTokenReplacementBoundary, /^import "server-only";/);
assert.match(responseTokenReplacementBoundary, /normalizeResponseLinkTtlHours/);
assert.match(responseTokenReplacementBoundary, /supabase\.auth\.getUser\(\)/);
assert.match(responseTokenReplacementBoundary, /"replace_assignment_response_token"/);
assert.match(responseTokenReplacementBoundary, /parseIssuedAssignmentResponseToken/);
assert.doesNotMatch(
  responseTokenReplacementBoundary,
  /\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\.|delete/i,
);
assert.match(responseLinkReplacementBoundary, /^import "server-only";/);
assert.match(responseLinkReplacementBoundary, /issueAssignmentResponseLinkWithIssuer/);
assert.match(responseLinkReplacementBoundary, /replaceAssignmentResponseTokenWithClient/);
assert.match(responseLinkReplacementBoundary, /replaceAssignmentResponseToken\(/);
assert.doesNotMatch(
  responseLinkReplacementBoundary,
  /\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|console\.|logger\./i,
);
assert.equal(PRODUCT_RESPONSE_LINK_DEFAULT_TTL_HOURS, 72);
assert.equal(PRODUCT_RESPONSE_LINK_MAXIMUM_TTL_HOURS, 168);
assert.equal(DIAGNOSTIC_RESPONSE_LINK_TTL_HOURS, 1);
assert.ok(PRODUCT_RESPONSE_LINK_DEFAULT_TTL_HOURS < PRODUCT_RESPONSE_LINK_MAXIMUM_TTL_HOURS);
assert.ok(PRODUCT_RESPONSE_LINK_MAXIMUM_TTL_HOURS <= 168);
assert.equal(normalizeResponseLinkTtlHours("product"), 72);
assert.equal(normalizeResponseLinkTtlHours("product", 24), 24);
assert.equal(normalizeResponseLinkTtlHours("product", 168), 168);
assert.equal(normalizeResponseLinkTtlHours("diagnostic"), 1);
assert.equal(normalizeResponseLinkTtlHours("diagnostic", 1), 1);
for (const invalidTtl of [0, 169, 1.5, "72"]) {
  assert.throws(
    () => normalizeResponseLinkTtlHours("product", invalidTtl),
    ResponseLinkPolicyError,
  );
}
assert.throws(
  () => normalizeResponseLinkTtlHours("diagnostic", 2),
  ResponseLinkPolicyError,
);
assert.equal(
  describeResponseLinkReplacementPolicy(),
  RESPONSE_LINK_REPLACEMENT_POLICY,
);
assert.equal(
  RESPONSE_LINK_REPLACEMENT_POLICY.enforcement,
  "atomic_database_command_enforced",
);
assert.equal(
  RESPONSE_LINK_REPLACEMENT_POLICY.databaseCommand,
  "replace_assignment_response_token",
);
assert.equal(
  RESPONSE_LINK_REPLACEMENT_POLICY.revocationFailure,
  "fail_closed_without_issuing_or_revealing_a_replacement",
);
assert.equal(
  RESPONSE_LINK_AUDIT_RETENTION.strategy,
  "retain_hash_only_token_rows_without_automatic_deletion",
);
assert.ok(RESPONSE_LINK_AUDIT_RETENTION.fields.includes("token_verifier_hash"));
assert.deepEqual(RESPONSE_LINK_AUDIT_RETENTION.prohibitedValues, [
  "raw_bearer",
  "full_response_url",
]);
assert.ok(RESPONSE_LINK_DELIVERY_PREREQUISITES.includes("delivery_provider_boundary_and_delivery_audit"));
assert.equal(
  FULL_RESPONSE_LINK_EXPOSURE_POLICY.allowedLayer,
  "future_explicit_product_issuance_surface",
);
const exposureConditions = {
  atomicReplacementCompleted: true,
  verifiedProjectContact: true,
  assignmentsEditAuthorized: true,
  trustedServerOrigin: true,
  explicitCredentialReveal: true,
  auditEventPersisted: true,
  automaticLoggingDisabled: true,
  postRequest: true,
  dynamicNoStoreResponse: true,
  clipboardDeferredUntilReveal: true,
};
assert.equal(
  mayExposeFullAssignmentResponseLink({
    surface: "diagnostic",
    ...exposureConditions,
  }),
  false,
);
assert.equal(
  mayExposeFullAssignmentResponseLink({
    surface: "future_product_issuance",
    ...exposureConditions,
    atomicReplacementCompleted: false,
  }),
  false,
);
assert.equal(
  mayExposeFullAssignmentResponseLink({
    surface: "future_product_issuance",
    ...exposureConditions,
    assignmentsEditAuthorized: false,
  }),
  false,
);
assert.equal(
  mayExposeFullAssignmentResponseLink({
    surface: "future_product_issuance",
    ...exposureConditions,
  }),
  true,
);
assert.equal(RESPONSE_LINK_REVEAL_AUDIT_PERSISTENCE_AVAILABLE, true);
assert.equal(RESPONSE_LINK_REVEAL_TRANSACTIONAL_COMMAND_AVAILABLE, true);
assert.equal(RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_ASSIGNMENT_DETAIL_CONTEXT_AVAILABLE, true);
assert.equal(isResponseLinkProductSurfaceAvailable(), false);
assert.equal(
  FUTURE_RESPONSE_LINK_PRODUCT_SURFACE,
  "future_project_contact_assignment_response_reveal",
);
assert.equal(
  responseLinkProductSurfaceContract.intendedLocation,
  "future_persisted_project_contact_assignment_detail_action",
);
assert.equal(responseLinkProductSurfaceContract.requiredServerAction.requestMethod, "POST");
assert.equal(
  responseLinkProductSurfaceContract.requiredServerAction.rendering,
  "dynamic_no_store",
);
assert.equal(
  responseLinkProductSurfaceContract.requiredServerAction.credentialBoundary,
  "createAuditedAssignmentResponseLinkReveal_only",
);
assert.deepEqual(responseLinkProductSurfaceContract.browserAllowedInputs, [
  "assignmentId",
  "expiresInHours",
]);
for (const prohibitedInput of [
  "workspaceId",
  "actorId",
  "volunteerId",
  "responseTokenId",
  "bearer",
  "responseUrl",
  "tokenVerifierHash",
  "origin",
]) {
  assert.ok(responseLinkProductSurfaceContract.browserProhibitedInputs.includes(prohibitedInput));
}
assert.equal(describeResponseLinkProductSurfaceReadiness().available, false);
assert.ok(
  getFutureResponseLinkProductSurfaceRequirements().includes(
    "persisted_project_contact_assignment_detail_context",
  ),
);
assert.equal(RESPONSE_LINK_REVEAL_AUDIT_METADATA_MAX_KEYS, 3);
assert.equal(RESPONSE_LINK_REVEAL_AUDIT_REASON_CODE_MAX_LENGTH, 50);
assert.equal(
  responseLinkRevealPolicy.currentStatus,
  "blocked_explicit_product_surface_missing",
);
assert.equal(responseLinkRevealPolicy.requestMethod, "POST");
assert.equal(responseLinkRevealPolicy.rendering, "dynamic_no_store");
assert.equal(
  describeResponseLinkRevealPrerequisites().auditPersistenceAvailable,
  true,
);
assert.equal(
  describeResponseLinkRevealPrerequisites().transactionalCommandAvailable,
  true,
);
assert.deepEqual(RESPONSE_LINK_REVEAL_MODES, [
  "copy_link",
  "email_delivery",
  "reminder_delivery",
]);
for (const surface of responseLinkRevealPolicy.currentDisallowedSurfaces) {
  assert.equal(canCurrentSurfaceRevealFullResponseLink(surface), false);
}
for (const requiredField of [
  "workspaceId",
  "assignmentId",
  "responseTokenId",
  "actorProjectContactId",
  "action",
  "revealSurface",
  "mode",
  "expiresAt",
  "occurredAt",
  "metadata",
]) {
  assert.ok(RESPONSE_LINK_REVEAL_AUDIT_EVENT_FIELDS.includes(requiredField));
}
for (const prohibitedField of [
  "rawBearer",
  "fullResponseUrl",
  "tokenVerifierHash",
  "password",
  "accessToken",
  "refreshToken",
  "serviceRoleKey",
  "volunteerEmergencyContact",
  "questionnaireAnswers",
]) {
  assert.ok(RESPONSE_LINK_REVEAL_AUDIT_PROHIBITED_FIELDS.includes(prohibitedField));
}
const otherwiseReadyReveal = evaluateFutureResponseLinkReveal({
  surface: "future_project_contact_assignment_response_reveal",
  verifiedProjectContactSession: true,
  assignmentsEditAuthorizedByDatabase: true,
  atomicReplacementCompleted: true,
  trustedServerOrigin: true,
  explicitUserAction: true,
  auditEventPersisted: true,
  automaticLoggingDisabled: true,
  postRequest: true,
  dynamicNoStoreResponse: true,
  clipboardDeferredUntilReveal: true,
  expiresInHours: 72,
});
assert.equal(otherwiseReadyReveal.allowed, false);
assert.deepEqual(otherwiseReadyReveal.blockers, ["explicit_product_surface_missing"]);
const unsafeReveal = evaluateFutureResponseLinkReveal({
  surface: "future_project_contact_assignment_response_reveal",
  verifiedProjectContactSession: false,
  assignmentsEditAuthorizedByDatabase: false,
  atomicReplacementCompleted: false,
  trustedServerOrigin: false,
  explicitUserAction: false,
  auditEventPersisted: false,
  automaticLoggingDisabled: false,
  postRequest: false,
  dynamicNoStoreResponse: false,
  clipboardDeferredUntilReveal: false,
  expiresInHours: 169,
});
assert.equal(unsafeReveal.allowed, false);
assert.ok(unsafeReveal.blockers.includes("audit_event_write_required"));
assert.ok(unsafeReveal.blockers.includes("product_ttl_invalid"));

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
assert.equal(issuedLink.tokenId, tokenId);
assert.equal(issuedLink.redactedUrl, "https://preview.example.test/respond/[redacted]");
assert.equal(redactAssignmentResponseLink(issuedLink.responseUrl), issuedLink.redactedUrl);
assert.equal(redactAssignmentResponseLink("not-a-link"), "[invalid response link]");
let defaultPolicyIssuerInput;
await issueAssignmentResponseLinkWithIssuer(
  { assignmentId, baseUrl: "https://preview.example.test" },
  async (input) => {
    defaultPolicyIssuerInput = input;
    return {
      tokenId,
      token: bearerToken,
      expiresAt: "2026-07-05T12:00:00.000Z",
    };
  },
);
assert.equal(
  defaultPolicyIssuerInput.expiresInHours,
  PRODUCT_RESPONSE_LINK_DEFAULT_TTL_HOURS,
);
await assert.rejects(
  issueAssignmentResponseLinkWithIssuer(
    {
      assignmentId,
      expiresInHours: PRODUCT_RESPONSE_LINK_MAXIMUM_TTL_HOURS + 1,
      baseUrl: "https://preview.example.test",
    },
    async () => ({ tokenId, token: bearerToken, expiresAt: "2026-07-03T12:00:00.000Z" }),
  ),
  ResponseLinkValidationError,
);
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
const responseLinkPolicyRouteImports = [];
const responseTokenReplacementRouteImports = [];
const responseLinkRevealPolicyRouteImports = [];
const responseLinkRevealAuditRouteImports = [];
const auditedResponseLinkRevealRouteImports = [];
const responseLinkProductSurfacePolicyRouteImports = [];
const persistedAssignmentDetailRouteImports = [];
const unsafeCredentialRouteOutputs = [];
for (const file of routeFiles) {
  const source = await readFile(file, "utf8");
  if (source.includes("lib/responseTokens/server")) {
    routeImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
  if (source.includes("lib/responseTokens/link")) {
    responseLinkRouteImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
  if (source.includes("lib/responseTokens/policy")) {
    responseLinkPolicyRouteImports.push(path.relative(root, file).replaceAll("\\", "/"));
  }
  if (source.includes("lib/responseTokens/replacement")) {
    responseTokenReplacementRouteImports.push(
      path.relative(root, file).replaceAll("\\", "/"),
    );
  }
  if (source.includes("lib/responseTokens/revealPolicy")) {
    responseLinkRevealPolicyRouteImports.push(
      path.relative(root, file).replaceAll("\\", "/"),
    );
  }
  if (source.includes("lib/responseTokens/revealAudit")) {
    responseLinkRevealAuditRouteImports.push(
      path.relative(root, file).replaceAll("\\", "/"),
    );
  }
  if (source.includes("lib/responseTokens/auditedReveal")) {
    auditedResponseLinkRevealRouteImports.push(
      path.relative(root, file).replaceAll("\\", "/"),
    );
  }
  if (source.includes("lib/responseTokens/productSurfacePolicy")) {
    responseLinkProductSurfacePolicyRouteImports.push(
      path.relative(root, file).replaceAll("\\", "/"),
    );
  }
  if (source.includes("lib/assignments/detailContext")) {
    persistedAssignmentDetailRouteImports.push(
      path.relative(root, file).replaceAll("\\", "/"),
    );
  }
  if (
    /issueReplacementAssignmentResponseLink|createAuditedAssignmentResponseLinkReveal|reveal_assignment_response_link|responseUrl|tokenVerifierHash|token_verifier_hash|bearer_token/.test(
      source,
    )
  ) {
    unsafeCredentialRouteOutputs.push(path.relative(root, file).replaceAll("\\", "/"));
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
assert.deepEqual(
  responseLinkPolicyRouteImports,
  [],
  "No route may import response-link exposure policy helpers",
);
assert.deepEqual(
  responseTokenReplacementRouteImports,
  [],
  "No route may import response-token replacement or full-link helpers",
);
assert.deepEqual(
  responseLinkRevealPolicyRouteImports,
  [],
  "No current route may import the future reveal policy",
);
assert.deepEqual(
  responseLinkRevealAuditRouteImports,
  [],
  "No current route may import the reveal-audit command helper",
);
assert.deepEqual(
  auditedResponseLinkRevealRouteImports,
  [],
  "No current route may import the transactional audited-reveal helper",
);
assert.deepEqual(
  responseLinkProductSurfacePolicyRouteImports,
  [],
  "No current route may import the future product-surface planning policy",
);
assert.deepEqual(
  persistedAssignmentDetailRouteImports,
  [],
  "No current route may import the persisted assignment-detail context",
);
assert.deepEqual(
  unsafeCredentialRouteOutputs,
  [],
  "No current route may expose replacement-link credential fields",
);

const unsafeClipboardSources = [];
const unsafeProductRevealSources = [];
for (const directory of ["app", "components"]) {
  const files = (await collectFiles(path.join(root, directory))).filter((file) =>
    /\.(?:ts|tsx)$/.test(file),
  );
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (
      /navigator\.clipboard|clipboard\.writeText|Copy full (?:response )?link|Copy response link/i.test(
        source,
      )
    ) {
      unsafeClipboardSources.push(path.relative(root, file).replaceAll("\\", "/"));
    }
    if (
      /lib\/responseTokens\/(?:auditedReveal|replacementLink)|createAuditedAssignmentResponseLinkReveal|reveal_assignment_response_link/.test(
        source,
      )
    ) {
      unsafeProductRevealSources.push(path.relative(root, file).replaceAll("\\", "/"));
    }
  }
}
assert.deepEqual(unsafeClipboardSources, [], "No copy-link UI may exist in current routes");
assert.deepEqual(
  unsafeProductRevealSources,
  [],
  "No route or component may consume the full-link reveal boundaries",
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
