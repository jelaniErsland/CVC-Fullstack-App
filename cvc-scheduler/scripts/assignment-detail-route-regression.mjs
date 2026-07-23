import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_DETAIL_ROUTE_CONTRACT_AVAILABLE,
  ASSIGNMENT_DETAIL_ROUTE_IMPLEMENTATION_AVAILABLE,
  ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION,
} from "../lib/assignments/detailRoutePolicy.server.ts";
import {
  ASSIGNMENT_DETAIL_CALENDAR_ENTRY_LINKAGE_AVAILABLE,
  ASSIGNMENT_DETAIL_COMMUNICATIONS_ENTRY_LINKAGE_AVAILABLE,
  ASSIGNMENT_DETAIL_DIAGNOSTIC_ROUTE_LINKAGE_AVAILABLE,
  ASSIGNMENT_DETAIL_NEEDS_ATTENTION_ENTRY_LINKAGE_AVAILABLE,
  ASSIGNMENT_DETAIL_PUBLIC_VOLUNTEER_ENTRY_LINKAGE_AVAILABLE,
  ASSIGNMENT_DETAIL_RESPONSE_TOKEN_ROUTE_LINKAGE_AVAILABLE,
  ASSIGNMENT_DETAIL_ROUTE_ENTRY_CONTRACT_AVAILABLE,
  ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE,
  ASSIGNMENT_DETAIL_VOLUNTEERS_ENTRY_LINKAGE_AVAILABLE,
  assignmentDetailRouteEntryContract,
  describeAssignmentDetailRouteEntryContract,
  evaluateAssignmentDetailRouteEntryReadiness,
} from "../lib/assignments/detailRouteEntryPolicy.server.ts";
import {
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE,
  assignmentDetailResponseLinkEnablementChecklist,
  describeAssignmentDetailResponseLinkEnablementChecklist,
  evaluateAssignmentDetailResponseLinkEnablement,
  getAssignmentDetailResponseLinkEnablementPrerequisiteGroups,
} from "../lib/assignments/detailResponseLinkEnablementChecklist.server.ts";
import {
  RESPONSE_LINK_ASSIGNMENT_DETAIL_CONTEXT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE,
} from "../lib/responseTokens/productSurfacePolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_CONTRACT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_BOUNDARY_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE,
} from "../lib/responseTokens/productActionPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_INERT_UI_SHELL_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_CONTRACT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_READINESS_REVIEW_AVAILABLE,
  describeResponseLinkProductActionUiContract,
  evaluateResponseLinkProductActionUiReadiness,
  responseLinkProductActionUiContract,
} from "../lib/responseTokens/productActionUiPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_WIRING_CONTRACT_AVAILABLE,
  describeResponseLinkProductActionWiringContract,
  evaluateResponseLinkProductActionWiringReadiness,
  responseLinkProductActionWiringContract,
} from "../lib/responseTokens/productActionWiringPolicy.server.ts";
import {
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REASON_CODE,
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REVEAL_MODE,
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_ROUTE_CONTEXT,
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_WARNING,
  createAssignmentDetailResponseLinkProductActionWithDependencies,
} from "../lib/responseTokens/productAction.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ALLOWED_BROWSER_INPUTS,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_DEFAULT_STATE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FORBIDDEN_BROWSER_INPUTS,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ROUTE_CONTEXT,
  createAssignmentDetailResponseLinkDisabledAdapterWithDependencies,
  describeAssignmentDetailResponseLinkDisabledAdapter,
} from "../lib/responseTokens/productActionDisabledAdapter.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ELIGIBLE_ROUTE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_SHAPE_CONTRACT_AVAILABLE,
  describeResponseLinkProductActionServerActionPolicy,
  evaluateResponseLinkProductActionServerActionReadiness,
  responseLinkProductActionServerActionPolicy,
} from "../lib/responseTokens/productActionServerActionPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_CONTRACT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ELIGIBLE_ROUTE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ROUTE_IMPORT_AVAILABLE,
  describeResponseLinkProductActionDisabledRouteWiringPolicy,
  evaluateResponseLinkProductActionDisabledRouteWiringReadiness,
  responseLinkProductActionDisabledRouteWiringPolicy,
} from "../lib/responseTokens/productActionDisabledRouteWiringPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_CONTRACT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_ELIGIBLE_ROUTE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_IMPLEMENTATION_AVAILABLE,
  describeResponseLinkProductActionDisabledRouteActionBindingPolicy,
  evaluateResponseLinkProductActionDisabledRouteActionBindingReadiness,
  responseLinkProductActionDisabledRouteActionBindingPolicy,
} from "../lib/responseTokens/productActionDisabledRouteActionBindingPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_CONTRACT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_ELIGIBLE_ROUTE,
  describeResponseLinkProductActionDisabledResultStatePolicy,
  evaluateResponseLinkProductActionDisabledResultStateReadiness,
  responseLinkProductActionDisabledResultStatePolicy,
} from "../lib/responseTokens/productActionDisabledResultStatePolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_SUCCESS_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_CONTRACT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_ELIGIBLE_ROUTE,
  describeResponseLinkProductActionDisabledResultRendererPolicy,
  evaluateResponseLinkProductActionDisabledResultRendererReadiness,
  responseLinkProductActionDisabledResultRendererPolicy,
} from "../lib/responseTokens/productActionDisabledResultRendererPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED,
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_ELIGIBLE_SURFACE,
  RESPONSE_LINK_PRODUCT_ACTION_DELIVERY_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_PUBLIC_LOOKUP_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_REMEMBERED_DEVICE_AVAILABLE,
  describeResponseLinkProductActionActivationCheckpoint,
  evaluateResponseLinkProductActionActivationCheckpoint,
  responseLinkProductActionActivationCheckpoint,
} from "../lib/responseTokens/productActionActivationCheckpoint.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_DEFAULT_STATE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_FINAL_APPROVAL_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED,
  describeDisabledAssignmentResponseLinkServerAction,
} from "../lib/responseTokens/productActionServerAction.server.ts";
import { RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE } from "../lib/responseTokens/revealPolicy.server.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const routeRelativePath = "app/admin/assignments/[assignmentId]/page.tsx";
const routePath = path.join(root, ...routeRelativePath.split("/"));
const routeSource = await readFile(routePath, "utf8");
const routeEntryPolicyPath = path.join(
  root,
  "lib",
  "assignments",
  "detailRouteEntryPolicy.server.ts",
);
const routeEntryPolicySource = await readFile(routeEntryPolicyPath, "utf8");
const enablementChecklistPath = path.join(
  root,
  "lib",
  "assignments",
  "detailResponseLinkEnablementChecklist.server.ts",
);
const enablementChecklistSource = await readFile(enablementChecklistPath, "utf8");
const productActionPath = path.join(root, "lib", "responseTokens", "productAction.server.ts");
const productActionSource = await readFile(productActionPath, "utf8");
const productActionDisabledAdapterPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionDisabledAdapter.server.ts",
);
const productActionDisabledAdapterSource = await readFile(
  productActionDisabledAdapterPath,
  "utf8",
);
const productActionDisabledAdapterHarnessPath = path.join(
  root,
  "scripts",
  "assignment-detail-action-adapter-regression.mjs",
);
const productActionDisabledAdapterHarnessSource = await readFile(
  productActionDisabledAdapterHarnessPath,
  "utf8",
);
const packageSource = await readFile(path.join(root, "package.json"), "utf8");
const productActionUiPolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionUiPolicy.server.ts",
);
const productActionUiPolicySource = await readFile(productActionUiPolicyPath, "utf8");
const productActionWiringPolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionWiringPolicy.server.ts",
);
const productActionWiringPolicySource = await readFile(
  productActionWiringPolicyPath,
  "utf8",
);
const productActionServerActionPolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionServerActionPolicy.server.ts",
);
const productActionServerActionPolicySource = await readFile(
  productActionServerActionPolicyPath,
  "utf8",
);
const productActionServerActionPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionServerAction.server.ts",
);
const productActionServerActionSource = await readFile(
  productActionServerActionPath,
  "utf8",
);
const productActionDisabledRouteWiringPolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionDisabledRouteWiringPolicy.server.ts",
);
const productActionDisabledRouteWiringPolicySource = await readFile(
  productActionDisabledRouteWiringPolicyPath,
  "utf8",
);
const productActionDisabledRouteActionBindingPolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionDisabledRouteActionBindingPolicy.server.ts",
);
const productActionDisabledRouteActionBindingPolicySource = await readFile(
  productActionDisabledRouteActionBindingPolicyPath,
  "utf8",
);
const productActionDisabledResultStatePolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionDisabledResultStatePolicy.server.ts",
);
const productActionDisabledResultStatePolicySource = await readFile(
  productActionDisabledResultStatePolicyPath,
  "utf8",
);
const productActionDisabledResultRendererPolicyPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionDisabledResultRendererPolicy.server.ts",
);
const productActionDisabledResultRendererPolicySource = await readFile(
  productActionDisabledResultRendererPolicyPath,
  "utf8",
);
const productActionActivationCheckpointPath = path.join(
  root,
  "lib",
  "responseTokens",
  "productActionActivationCheckpoint.server.ts",
);
const productActionActivationCheckpointSource = await readFile(
  productActionActivationCheckpointPath,
  "utf8",
);
const productActionServerActionHarnessPath = path.join(
  root,
  "scripts",
  "assignment-detail-server-action-regression.mjs",
);
const productActionServerActionHarnessSource = await readFile(
  productActionServerActionHarnessPath,
  "utf8",
);
const supabaseLocalSetupSource = await readFile(
  path.join(root, "docs", "SUPABASE_LOCAL_SETUP.md"),
  "utf8",
);
const supabaseReadinessSource = await readFile(
  path.join(root, "docs", "SUPABASE_AUTH_PERSISTENCE_READINESS.md"),
  "utf8",
);
const exampleAssignmentId = "11111111-1111-4111-8111-111111111111";

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

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

async function collectTrackedTextFiles() {
  const result = spawnSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, "Unable to list tracked files for secret guardrail.");
  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((relative) =>
      /\.(?:cjs|css|env|example|html|js|json|jsx|md|mjs|sql|toml|ts|tsx|txt|yml|yaml)$/i.test(
        relative,
      ),
    );
}

assert.match(routeSource, /export const dynamic = "force-dynamic"/);
assert.match(routeSource, /export const revalidate = 0/);
assert.match(routeSource, /export const fetchCache = "force-no-store"/);
assert.doesNotMatch(routeSource, /generateStaticParams/);
assert.match(
  routeSource,
  /import \{ readAssignmentDetailContext \} from "@\/lib\/assignments\/detailContext\.server"/,
);
assert.match(
  routeSource,
  /import \{ createDisabledAssignmentResponseLinkServerAction \} from "@\/lib\/responseTokens\/productActionServerAction\.server"/,
);
assert.match(routeSource, /readAssignmentDetailContext\(\{\s*assignmentId:/s);
assert.match(
  routeSource,
  /getDisabledResponseLinkWiringState\(\s*disabledResponseLinkAction,\s*\)/s,
);
assert.doesNotMatch(
  routeSource,
  /createDisabledAssignmentResponseLinkServerAction\([^)]/,
);
assert.match(
  routeSource,
  /const disabledResponseLinkAction =\s*createDisabledAssignmentResponseLinkServerAction\.bind\(null, normalizedAssignmentId\);/s,
);
assert.equal(
  countMatches(routeSource, /createDisabledAssignmentResponseLinkServerAction\.bind\(null, normalizedAssignmentId\)/g),
  1,
);
assert.match(
  routeSource,
  /getDisabledResponseLinkWiringState\(\s*disabledResponseLinkAction,\s*\)/s,
);
assert.doesNotMatch(
  routeSource,
  /action=\{?\s*createDisabledAssignmentResponseLinkServerAction|formAction=\{?\s*createDisabledAssignmentResponseLinkServerAction|useActionState\(\s*createDisabledAssignmentResponseLinkServerAction|useFormState\(\s*createDisabledAssignmentResponseLinkServerAction/s,
);
assert.doesNotMatch(
  routeSource,
  /<[^>]+createDisabledAssignmentResponseLinkServerAction|createDisabledAssignmentResponseLinkServerAction=\{|serverAction=\{createDisabledAssignmentResponseLinkServerAction|actionProp=\{createDisabledAssignmentResponseLinkServerAction/s,
);
assert.match(routeSource, /readProjectContactSession\(\)/);
assert.match(routeSource, /session\.status !== "authenticated"/);
assert.match(routeSource, /Assignment unavailable/);
assert.match(routeSource, /Assignment details are read-only here/);
assert.match(routeSource, /Response link/);
assert.match(routeSource, /Link actions are not available yet/);
assert.match(routeSource, /future link would grant\s+response access for this assignment/s);
assert.match(routeSource, /will\s+expire/s);
assert.match(routeSource, /explicit click or tap/);
assert.match(routeSource, /Manual copying will only be available after an audited\s+success/s);
assert.match(routeSource, /No link is generated on page load/);
assert.match(routeSource, /reviewed server-action seam is present but remains\s+disabled here/s);
assert.doesNotMatch(routeSource, /AdminShell|mockData|volunteerPreview/);
assert.doesNotMatch(
  routeSource,
  /createAssignmentDetailResponseLinkProductAction|productActionDisabledAdapter|createAssignmentDetailResponseLinkDisabledAdapter|productAction\.server|productActionDisabledRouteWiring|productActionDisabledRouteActionBinding|productActionDisabledResultState|productActionDisabledResultRenderer|productActionActivationCheckpoint|activationCheckpoint|productActionUi|productActionWiring|detailRouteEntryPolicy|assignmentDetailRouteEntry|detailResponseLinkEnablementChecklist|assignmentDetailResponseLinkEnablement|createAuditedAssignmentResponseLinkReveal|issueAssignmentResponseLink|replaceAssignmentResponseToken|recordAssignmentResponseLinkRevealAudit|reveal_assignment_response_link|read_assignment_detail_context|assignment_response_tokens|\.rpc\(|\.from\(/,
);
assert.doesNotMatch(
  routeSource,
  /SUPABASE_SERVICE_ROLE_KEY|serviceRole|createServiceRole|navigator\.clipboard|clipboard\.writeText|Copy response link|Copy full link|Generate link|Reveal link|Send reminder|Email volunteer/i,
);
assert.doesNotMatch(
  routeSource,
  /rawBearer|bearerToken|fullResponseUrl|redactedResponseUrl|responseUrl|responseTokenId|tokenId|tokenVerifierHash|verifier|tokenScope|accessToken|refreshToken|password|apiKey|serviceRoleKey|emergencyContact|questionnaireAnswers|sensitiveIntakeData|auditInternals/,
);
assert.doesNotMatch(
  routeSource,
  /<form\b|<button\b|formAction|type=["']submit["']|type=["']hidden["']|onClick=|useActionState|useFormState|useFormStatus|useTransition|resultRenderer|resultComponent|actionResult|disabledResult|activationCheckpoint|checkpoint_only_activation_blocked|not_approved|checklist_blocked|malformed_input|action_error|retry|download|open link|send affordance/i,
);
assert.doesNotMatch(
  routeSource,
  /<input\b|<textarea\b|<select\b|name=["'](?:assignmentId|expiresInHours|workspaceId|volunteerId|actorId|tokenId|bearer|verifier|origin|fullResponseUrl|redactedResponseUrl|auditEventId|capabilities|grant|redirectPath|returnPath|hiddenMetadata)["']|value=\{assignmentId\}|defaultValue=\{assignmentId\}/,
);
assert.doesNotMatch(
  routeSource,
  /data-(?:assignment|assignment-id|ttl|expires|action|token|audit|url|bearer|verifier|workspace|volunteer|actor|capability|grant|redirect|return|metadata)|query\??\.|searchParams|URLSearchParams|params\.assignmentId/s,
);
assert.doesNotMatch(
  routeSource,
  /redirect\(|permanentRedirect\(|revalidatePath\(|revalidateTag\(|cookies\(\)\.set|cookies\(\)\.delete|NextResponse\.redirect|sendEmail|sendReminder|enqueue|cron|seed/i,
);

assert.match(supabaseLocalSetupSource, /Do not print raw Supabase CLI\/status\/start output/);
assert.match(supabaseLocalSetupSource, /Redirect Supabase start\/status output to a temporary file/);
assert.match(supabaseLocalSetupSource, /Redact key-like values before displaying diagnostics/);
assert.match(supabaseLocalSetupSource, /Prefer Docker\/container status, port checks, and health endpoints/);
assert.match(supabaseReadinessSource, /11\.47 disabled action binding security regression review/i);
assert.match(supabaseReadinessSource, /redirected and redacted Supabase diagnostics/i);
assert.match(supabaseReadinessSource, /11\.48 disabled action result-state contract review/i);
assert.match(supabaseReadinessSource, /credential-free disabled\/error-like result states/i);
assert.match(supabaseLocalSetupSource, /After 11\.48 it proves the disabled result-state contract exists/i);
assert.match(supabaseReadinessSource, /11\.49 disabled result renderer readiness review/i);
assert.match(supabaseReadinessSource, /fixed allowlisted copy map keyed by safe state codes/i);
assert.match(supabaseLocalSetupSource, /After 11\.49 it proves the disabled result-renderer contract exists/i);
assert.match(supabaseReadinessSource, /11\.50 assignment response link activation checkpoint review/i);
assert.match(supabaseReadinessSource, /remaining blockers before active reveal/i);
assert.match(supabaseReadinessSource, /safe next implementation options/i);
assert.match(supabaseLocalSetupSource, /After 11\.50 it proves the activation checkpoint exists/i);

const trackedTextFiles = await collectTrackedTextFiles();
const actualLookingSecretPatterns = [
  { name: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
  { name: "supabase_secret_key", pattern: new RegExp("sb_" + "secret_[A-Za-z0-9_-]{20,}") },
  { name: "supabase_publishable_key", pattern: new RegExp("sb_" + "publishable_[A-Za-z0-9_-]{20,}") },
  {
    name: "credentialed_postgres_url",
    pattern: /postgres(?:ql)?:\/\/[^:\s/@]{2,}:[^@\s]{6,}@/i,
  },
];
const trackedSecretFindings = [];
for (const relative of trackedTextFiles) {
  const source = await readFile(path.join(root, relative), "utf8");
  for (const { name, pattern } of actualLookingSecretPatterns) {
    if (pattern.test(source)) trackedSecretFindings.push(`${relative}:${name}`);
  }
}
assert.deepEqual(trackedSecretFindings, []);

assert.match(routeEntryPolicySource, /^import "server-only";/);
assert.match(routeEntryPolicySource, /ASSIGNMENT_DETAIL_ROUTE_ENTRY_CONTRACT_AVAILABLE = true/);
assert.match(
  routeEntryPolicySource,
  /ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE = false/,
);
assert.match(routeEntryPolicySource, /ASSIGNMENT_DETAIL_CALENDAR_ENTRY_LINKAGE_AVAILABLE = false/);
assert.match(routeEntryPolicySource, /ASSIGNMENT_DETAIL_VOLUNTEERS_ENTRY_LINKAGE_AVAILABLE = false/);
assert.match(
  routeEntryPolicySource,
  /ASSIGNMENT_DETAIL_NEEDS_ATTENTION_ENTRY_LINKAGE_AVAILABLE = false/,
);
assert.match(
  routeEntryPolicySource,
  /ASSIGNMENT_DETAIL_COMMUNICATIONS_ENTRY_LINKAGE_AVAILABLE = false/,
);
assert.match(
  routeEntryPolicySource,
  /ASSIGNMENT_DETAIL_PUBLIC_VOLUNTEER_ENTRY_LINKAGE_AVAILABLE = false/,
);
assert.match(
  routeEntryPolicySource,
  /ASSIGNMENT_DETAIL_RESPONSE_TOKEN_ROUTE_LINKAGE_AVAILABLE = false/,
);
assert.match(routeEntryPolicySource, /ASSIGNMENT_DETAIL_DIAGNOSTIC_ROUTE_LINKAGE_AVAILABLE = false/);
assert.match(routeEntryPolicySource, /routePathPattern: "\/admin\/assignments\/\[assignmentId\]"/);
assert.match(routeEntryPolicySource, /secure_project_contact_direct_access_fallback/);
assert.match(
  routeEntryPolicySource,
  /routine_assignment_details_should_remain_contextual_in_inspectors_drawers_or_modals/,
);
assert.match(routeEntryPolicySource, /calendar_item_inspector_or_assignment_list_context/);
assert.match(routeEntryPolicySource, /volunteer_profile_admin_assignment_context/);
assert.match(routeEntryPolicySource, /needs_attention_staffing_or_response_row/);
assert.match(routeEntryPolicySource, /communications_or_reminder_preview_context/);
assert.match(routeEntryPolicySource, /public_volunteer_routes/);
assert.match(routeEntryPolicySource, /\/respond\/\[token\]/);
assert.match(routeEntryPolicySource, /diagnostic_routes/);
assert.match(routeEntryPolicySource, /mock_only_routes/);
assert.match(routeEntryPolicySource, /anonymous_or_unauthenticated_pages/);
assert.match(routeEntryPolicySource, /browser_typed_arbitrary_assignment_id_surfaces/);
assert.match(routeEntryPolicySource, /broad_assignment_directory_or_search/);
assert.match(routeEntryPolicySource, /derive_assignment_id_from_already_authorized_persisted_context/);
assert.match(routeEntryPolicySource, /link_only_to_existing_dynamic_no_store_assignment_detail_route/);
assert.match(routeEntryPolicySource, /avoid_implying_volunteers_should_use_admin_route/);
assert.match(routeEntryPolicySource, /hrefAllowedShape/);
assert.match(routeEntryPolicySource, /query: "none"/);
assert.match(routeEntryPolicySource, /hash: "none"/);
assert.match(routeEntryPolicySource, /responseTokenId/);
assert.match(routeEntryPolicySource, /rawBearer/);
assert.match(routeEntryPolicySource, /tokenVerifierHash/);
assert.match(routeEntryPolicySource, /fullResponseUrl/);
assert.match(routeEntryPolicySource, /auditEventId/);
assert.match(routeEntryPolicySource, /capabilities/);
assert.doesNotMatch(
  routeEntryPolicySource,
  /readAssignmentDetailContext\(|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(enablementChecklistSource, /^import "server-only";/);
assert.match(
  enablementChecklistSource,
  /ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE = true/,
);
assert.match(
  enablementChecklistSource,
  /ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE = false/,
);
assert.match(
  enablementChecklistSource,
  /ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE = false/,
);
assert.match(
  enablementChecklistSource,
  /ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE = false/,
);
assert.match(enablementChecklistSource, /currentStatus: "active_reveal_copy_and_linking_blocked"/);
assert.match(
  enablementChecklistSource,
  /activationRule: "all_prerequisite_groups_must_be_true_before_any_active_flag_flips"/,
);
for (const requiredGroup of [
  "routeSafety",
  "entrySafety",
  "actionSafety",
  "uiSafety",
  "credentialLogSafety",
  "browserProof",
  "productOwnerCheckpoint",
]) {
  assert.match(enablementChecklistSource, new RegExp(requiredGroup));
}
for (const requiredChecklistItem of [
  "assignment_detail_route_remains_dynamic_no_store",
  "verified_project_contact_session_required",
  "persisted_assignment_detail_context_only",
  "non_disclosing_unavailable_state",
  "no_mock_fallback",
  "future_entry_point_comes_from_persisted_authorized_assignment_context",
  "no_public_volunteer_respond_diagnostic_mock_or_anonymous_entry",
  "href_carries_only_admin_assignments_assignment_id_path",
  "no_query_hash_scope_token_capability_workspace_or_volunteer_data",
  "explicit_post_server_action_only",
  "no_render_get_page_load_prefetch_hover_focus_or_effect_reveal",
  "browser_input_assignment_id_plus_optional_bounded_ttl_only",
  "route_calls_only_11_32_product_action_boundary",
  "no_direct_audited_reveal_rpc_token_replacement_table_or_service_role_path",
  "assignment_specific_credential_warning",
  "visible_expiration",
  "disabled_unavailable_states_credential_free",
  "no_automatic_clipboard_write",
  "manual_copy_only_after_audited_success",
  "no_full_url_bearer_verifier_or_token_id_in_render_error_or_logs",
  "no_access_refresh_token_password_or_service_role_key_in_render_error_or_logs",
  "no_local_or_hosted_secrets_in_render_error_or_logs",
  "no_sql_detail_in_user_facing_errors",
  "no_sensitive_intake_or_unrelated_row_data_in_render_error_or_logs",
  "browser_test_proves_no_url_before_success",
  "desktop_and_390px_mobile_have_no_overflow_or_errors",
  "unavailable_state_reveals_no_response_link_capability_detail",
  "explicit_later_product_owner_approval_required_before_active_flags_flip",
]) {
  assert.match(enablementChecklistSource, new RegExp(requiredChecklistItem));
}
assert.doesNotMatch(
  enablementChecklistSource,
  /readAssignmentDetailContext\(|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|\.rpc\(|\.from\(|assignment_response_tokens|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(productActionSource, /^import "server-only";/);
assert.match(productActionSource, /readAssignmentDetailContext/);
assert.match(productActionSource, /createAuditedAssignmentResponseLinkReveal/);
assert.match(productActionSource, /normalizeResponseLinkTtlHours\("product"/);
assert.match(productActionSource, /validateResponseLinkBaseUrl/);
assert.match(productActionSource, /RESPONSE_LINK_BASE_URL/);
assert.match(
  productActionSource,
  /reason_code: ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REASON_CODE/,
);
assert.match(productActionSource, /delivery_requested: false/);
assert.match(productActionSource, /return \{ status: "unavailable" \}/);
assert.doesNotMatch(
  productActionSource,
  /replaceAssignmentResponseToken|recordAssignmentResponseLinkRevealAudit|issueAssignmentResponseLink|replace_assignment_response_token|record_assignment_response_link_reveal_event|reveal_assignment_response_link|assignment_response_tokens|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|serviceRole|createServiceRole|console\.|logger\.|navigator\.clipboard|clipboard\.writeText|Copy response link|Copy full link/i,
);

assert.match(productActionDisabledAdapterSource, /^import "server-only";/);
assert.match(
  productActionDisabledAdapterSource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE = true/,
);
assert.match(
  productActionDisabledAdapterSource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE =\s*\r?\n\s*false/,
);
assert.match(
  productActionDisabledAdapterSource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_DEFAULT_STATE = "disabled"/,
);
assert.match(
  productActionDisabledAdapterSource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ROUTE_CONTEXT =\s*\r?\n\s*"\/admin\/assignments\/\[assignmentId\]"/,
);
assert.match(
  productActionDisabledAdapterSource,
  /ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE/,
);
assert.match(productActionDisabledAdapterSource, /assignmentDetailResponseLinkEnablementChecklist/);
assert.match(productActionDisabledAdapterSource, /createAssignmentDetailResponseLinkProductAction/);
assert.match(productActionDisabledAdapterSource, /RESPONSE_LINK_PRODUCT_ACTION_SERVER_BOUNDARY_AVAILABLE/);
assert.match(productActionDisabledAdapterSource, /"assignmentId"/);
assert.match(productActionDisabledAdapterSource, /"expiresInHours"/);
for (const forbiddenAdapterInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "origin",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
]) {
  assert.match(productActionDisabledAdapterSource, new RegExp(forbiddenAdapterInput));
}
assert.match(productActionDisabledAdapterSource, /"blocked_by_checklist"/);
assert.match(productActionDisabledAdapterSource, /"not_approved"/);
assert.match(productActionDisabledAdapterSource, /"action_boundary_unavailable"/);
assert.match(
  productActionDisabledAdapterSource,
  /if \(!RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE\)/,
);
assert.match(
  productActionDisabledAdapterSource,
  /if \(!RESPONSE_LINK_PRODUCT_ACTION_SERVER_BOUNDARY_AVAILABLE\)/,
);
assert.match(productActionDisabledAdapterSource, /await action\(request\)/);
assert.doesNotMatch(
  productActionDisabledAdapterSource,
  /createAuditedAssignmentResponseLinkReveal\(|issueAssignmentResponseLink|replaceAssignmentResponseToken|recordAssignmentResponseLinkRevealAudit|reveal_assignment_response_link|replace_assignment_response_token|record_assignment_response_link_reveal_event|assignment_response_tokens|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText|Copy response link|Copy full link/i,
);

assert.match(
  packageSource,
  /"test:assignment-detail-action-adapter": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/assignment-detail-action-adapter-regression\.mjs"/,
);
assert.match(
  productActionDisabledAdapterHarnessSource,
  /createAssignmentDetailResponseLinkDisabledAdapterWithDependencies/,
);
assert.match(productActionDisabledAdapterHarnessSource, /productActionCallCount/);
assert.match(productActionDisabledAdapterHarnessSource, /Confirmed credential-free disabled states and zero product-action calls/);
assert.doesNotMatch(
  productActionDisabledAdapterHarnessSource,
  /app\/admin\/assignments|@\/app|readAssignmentDetailContext|createAssignmentDetailResponseLinkProductActionWithDependencies|createAuditedAssignmentResponseLinkReveal|reveal_assignment_response_link|assignment_response_tokens|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|navigator\.clipboard|clipboard\.writeText|Copy response link|Copy full link|fullResponseUrl:|responseUrl: "https?:|rawBearer:|bearer:|tokenVerifierHash:|accessToken:|password:|serviceRoleKey:|sqlDetail:|sensitiveIntakeValue:|unrelatedRowMarker:/i,
);

assert.match(productActionUiPolicySource, /^import "server-only";/);
assert.match(productActionUiPolicySource, /RESPONSE_LINK_PRODUCT_ACTION_UI_CONTRACT_AVAILABLE = true/);
assert.match(
  productActionUiPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_INERT_UI_SHELL_AVAILABLE = true/,
);
assert.match(
  productActionUiPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE = false/,
);
assert.match(
  productActionUiPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE = false/,
);
assert.match(productActionUiPolicySource, /eligibleSurface: "\/admin\/assignments\/\[assignmentId\]"/);
assert.match(productActionUiPolicySource, /required: "deliberate_click_or_tap"/);
assert.match(productActionUiPolicySource, /"GET"/);
assert.match(productActionUiPolicySource, /"page_load"/);
assert.match(productActionUiPolicySource, /"prefetch"/);
assert.match(productActionUiPolicySource, /"hover"/);
assert.match(productActionUiPolicySource, /"focus"/);
assert.match(productActionUiPolicySource, /"automatic_effect"/);
assert.match(productActionUiPolicySource, /warn_link_grants_response_access_for_this_assignment/);
assert.match(productActionUiPolicySource, /show_expiration_before_action/);
assert.match(productActionUiPolicySource, /show_expiration_after_action/);
assert.match(productActionUiPolicySource, /allow_manual_copy_only_after_success/);
assert.match(productActionUiPolicySource, /never_auto_copy_to_clipboard/);
assert.match(productActionUiPolicySource, /successful_explicit_action_response_only/);
assert.match(productActionUiPolicySource, /status: "visible_with_disabled_action_binding"/);
assert.match(productActionUiPolicySource, /route_derived_disabled_action_binding_reference/);
assert.match(productActionUiPolicySource, /non_submittable_disabled_panel_copy_only/);
assert.match(productActionUiPolicySource, /future_link_grants_response_access_for_this_assignment/);
assert.match(productActionUiPolicySource, /future_link_will_expire/);
assert.match(productActionUiPolicySource, /future_action_requires_explicit_click_or_tap/);
assert.match(productActionUiPolicySource, /manual_copy_after_audited_success_only/);
assert.match(productActionUiPolicySource, /hidden_credential_or_action_metadata/);
assert.match(productActionUiPolicySource, /full_or_redacted_live_url/);
assert.doesNotMatch(
  productActionUiPolicySource,
  /createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|\.rpc\(|\.from\(|assignment_response_tokens|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(productActionWiringPolicySource, /^import "server-only";/);
assert.match(
  productActionWiringPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_WIRING_CONTRACT_AVAILABLE = true/,
);
assert.match(
  productActionWiringPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE = false/,
);
assert.match(productActionWiringPolicySource, /eligibleRoute: "\/admin\/assignments\/\[assignmentId\]"/);
assert.match(productActionWiringPolicySource, /currentPanel: "11\.34_inert_response_link_shell"/);
assert.match(productActionWiringPolicySource, /routeDataBoundary: "readAssignmentDetailContext_only"/);
assert.match(
  productActionWiringPolicySource,
  /actionBoundary: "createAssignmentDetailResponseLinkProductAction_only"/,
);
assert.match(productActionWiringPolicySource, /routeRenderCredentialState: "credential_free"/);
assert.match(productActionWiringPolicySource, /"POST"/);
assert.match(productActionWiringPolicySource, /"server_action_only"/);
assert.match(productActionWiringPolicySource, /"render"/);
assert.match(productActionWiringPolicySource, /"GET"/);
assert.match(productActionWiringPolicySource, /"page_load"/);
assert.match(productActionWiringPolicySource, /"prefetch"/);
assert.match(productActionWiringPolicySource, /browserAllowedInputs: \["assignmentId", "expiresInHours"\]/);
assert.match(productActionWiringPolicySource, /fullResponseUrl/);
assert.match(productActionWiringPolicySource, /successful_explicit_action_response_only/);
assert.match(productActionWiringPolicySource, /post_success_only/);
assert.match(productActionWiringPolicySource, /automaticClipboardWrite: "prohibited"/);
assert.match(productActionWiringPolicySource, /do_not_manually_sequence_replacement_and_audit/);
assert.match(productActionWiringPolicySource, /do_not_call_audited_reveal_helper_directly_from_route/);
assert.match(productActionWiringPolicySource, /do_not_call_reveal_rpc_directly_from_route/);
assert.match(productActionWiringPolicySource, /localOrHostedSecret/);
assert.doesNotMatch(
  productActionWiringPolicySource,
  /createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(productActionServerActionPolicySource, /^import "server-only";/);
assert.match(
  productActionServerActionPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_SHAPE_CONTRACT_AVAILABLE =\s*\r?\n\s*true/,
);
assert.match(
  productActionServerActionPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE =\s*\r?\n\s*false/,
);
assert.match(
  productActionServerActionPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ELIGIBLE_ROUTE =\s*\r?\n\s*"\/admin\/assignments\/\[assignmentId\]"/,
);
assert.match(productActionServerActionPolicySource, /contract_only_route_unused_non_executable/);
assert.match(productActionServerActionPolicySource, /executableActionInThisSlice: false/);
for (const requiredServerActionRequirement of [
  "explicit_server_action",
  "POST",
  "same_route_assignment_context",
  "deliberate_submit",
  "deliberate_click",
  "deliberate_tap",
]) {
  assert.match(productActionServerActionPolicySource, new RegExp(requiredServerActionRequirement));
}
for (const prohibitedServerActionTrigger of [
  "render",
  "GET",
  "page_load",
  "prefetch",
  "hover",
  "focus",
  "client_effect",
  "hydration",
]) {
  assert.match(productActionServerActionPolicySource, new RegExp(prohibitedServerActionTrigger));
}
assert.match(productActionServerActionPolicySource, /route_context_or_reviewed_same_route_binding_only/);
assert.match(productActionServerActionPolicySource, /"assignmentId"/);
assert.match(productActionServerActionPolicySource, /"expiresInHours"/);
assert.match(productActionServerActionPolicySource, /"control"/);
for (const forbiddenServerActionInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
]) {
  assert.match(productActionServerActionPolicySource, new RegExp(forbiddenServerActionInput));
}
for (const requiredAllowedBoundary of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "reviewed_active_successor_adapter",
]) {
  assert.match(productActionServerActionPolicySource, new RegExp(requiredAllowedBoundary));
}
for (const prohibitedRouteActionBoundary of [
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "manual_replacement_audit_sequence",
  "service_role_client",
]) {
  assert.match(productActionServerActionPolicySource, new RegExp(prohibitedRouteActionBoundary));
}
for (const credentialFreeResultState of [
  "disabled",
  "unavailable",
  "not_approved",
  "checklist_blocked",
  "malformed",
  "action_error",
]) {
  assert.match(productActionServerActionPolicySource, new RegExp(credentialFreeResultState));
}
for (const prohibitedServerActionResultField of [
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "rawBearer",
  "bearer",
  "verifier",
  "tokenVerifierHash",
  "responseTokenId",
  "tokenId",
  "auditEventId",
  "sqlDetail",
  "internalRpcDetail",
  "accessToken",
  "refreshToken",
  "password",
  "apiKey",
  "serviceRoleKey",
  "localOrHostedSecret",
  "sensitiveIntakeData",
  "unrelatedRowData",
]) {
  assert.match(productActionServerActionPolicySource, new RegExp(prohibitedServerActionResultField));
}
assert.match(
  productActionServerActionPolicySource,
  /successful_explicit_action_response_after_audited_success_in_later_active_slice_only/,
);
assert.match(productActionServerActionPolicySource, /after_successful_explicit_action_response_only/);
assert.match(productActionServerActionPolicySource, /automaticClipboardWrite: "forbidden"/);
assert.doesNotMatch(
  productActionServerActionPolicySource,
  /["']use server["']|createAssignmentDetailResponseLinkProductAction\(|createAssignmentDetailResponseLinkDisabledAdapter\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|replaceAssignmentResponseToken\(|issueAssignmentResponseLink\(|recordAssignmentResponseLinkRevealAudit\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(productActionServerActionSource, /^import "server-only";/);
assert.match(productActionServerActionSource, /"use server";/);
assert.match(
  productActionServerActionSource,
  /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE = true/,
);
assert.match(
  productActionServerActionSource,
  /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED = false/,
);
assert.match(
  productActionServerActionSource,
  /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_FINAL_APPROVAL_AVAILABLE =\s*\r?\n\s*false/,
);
assert.match(productActionServerActionSource, /createAssignmentDetailResponseLinkDisabledAdapterWithDependencies/);
assert.match(productActionServerActionSource, /routeUnusedServerActionChecklistReadiness/);
assert.match(productActionServerActionSource, /"\/admin\/assignments\/\[assignmentId\]"/);
assert.match(productActionServerActionSource, /RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ALLOWED_FORM_FIELDS/);
assert.match(productActionServerActionSource, /"expiresInHours"/);
for (const forbiddenServerActionField of [
  "assignmentId",
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
]) {
  assert.match(productActionServerActionSource, new RegExp(forbiddenServerActionField));
}
assert.doesNotMatch(
  productActionServerActionSource,
  /from "\.\/productAction\.server|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal|reveal_assignment_response_link|replaceAssignmentResponseToken|replace_assignment_response_token|issueAssignmentResponseLink|recordAssignmentResponseLinkRevealAudit|assignment_response_tokens|\.rpc\(|(?<!Array)\.from\(|redirect\(|permanentRedirect\(|revalidatePath\(|revalidateTag\(|cookies\(|headers\(|NextResponse|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText|sendEmail|sendReminder|enqueue/i,
);
assert.match(
  packageSource,
  /"test:assignment-detail-server-action": "node --conditions=react-server --no-warnings --experimental-strip-types scripts\/assignment-detail-server-action-regression\.mjs"/,
);
assert.match(
  productActionServerActionHarnessSource,
  /createDisabledAssignmentResponseLinkServerActionWithDependencies/,
);
assert.match(productActionServerActionHarnessSource, /adapterCallCount/);
assert.match(
  productActionServerActionHarnessSource,
  /Confirmed disabled route binding without normal user submission and disabled-adapter-only execution/,
);

assert.match(productActionDisabledRouteWiringPolicySource, /^import "server-only";/);
assert.match(
  productActionDisabledRouteWiringPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_CONTRACT_AVAILABLE =\s*\r?\n\s*true/,
);
assert.match(
  productActionDisabledRouteWiringPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE =\s*\r?\n\s*true/,
);
assert.match(
  productActionDisabledRouteWiringPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ROUTE_IMPORT_AVAILABLE =\s*\r?\n\s*true/,
);
assert.match(
  productActionDisabledRouteWiringPolicySource,
  /"\/admin\/assignments\/\[assignmentId\]"/,
);
assert.match(productActionDisabledRouteWiringPolicySource, /dynamic/);
assert.match(productActionDisabledRouteWiringPolicySource, /no_store/);
assert.match(
  productActionDisabledRouteWiringPolicySource,
  /readAssignmentDetailContext_only/,
);
for (const requiredDisabledWiringTrigger of [
  "deliberate_submit",
  "deliberate_click",
  "deliberate_tap",
]) {
  assert.match(
    productActionDisabledRouteWiringPolicySource,
    new RegExp(requiredDisabledWiringTrigger),
  );
}
for (const prohibitedDisabledWiringTrigger of [
  "render",
  "GET",
  "page_load",
  "prefetch",
  "hover",
  "focus",
  "client_effect",
  "hydration",
  "unavailable_state_render",
]) {
  assert.match(
    productActionDisabledRouteWiringPolicySource,
    new RegExp(prohibitedDisabledWiringTrigger),
  );
}
assert.match(
  productActionDisabledRouteWiringPolicySource,
  /same_dynamic_route_segment_or_reviewed_same_route_server_binding_only/,
);
assert.match(productActionDisabledRouteWiringPolicySource, /"expiresInHours"/);
for (const forbiddenDisabledWiringInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
]) {
  assert.match(
    productActionDisabledRouteWiringPolicySource,
    new RegExp(forbiddenDisabledWiringInput),
  );
}
assert.match(
  productActionDisabledRouteWiringPolicySource,
  /allowedRouteCall: "createDisabledAssignmentResponseLinkServerAction"/,
);
for (const prohibitedDisabledWiringRouteCall of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "manual_replacement_audit_sequence",
]) {
  assert.match(
    productActionDisabledRouteWiringPolicySource,
    new RegExp(prohibitedDisabledWiringRouteCall),
  );
}
assert.match(productActionDisabledRouteWiringPolicySource, /non_disclosing_and_credential_free/);
assert.match(
  productActionDisabledRouteWiringPolicySource,
  /later_reviewed_active_success_slice_after_audited_success_only/,
);
assert.match(productActionDisabledRouteWiringPolicySource, /later_reviewed_post_success_slice_only/);
assert.match(productActionDisabledRouteWiringPolicySource, /automaticClipboardWrite: "forbidden"/);
assert.doesNotMatch(
  productActionDisabledRouteWiringPolicySource,
  /["']use server["']|createDisabledAssignmentResponseLinkServerAction\(|createAssignmentDetailResponseLinkDisabledAdapter\(|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|replaceAssignmentResponseToken\(|issueAssignmentResponseLink\(|recordAssignmentResponseLinkRevealAudit\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(productActionDisabledRouteActionBindingPolicySource, /^import "server-only";/);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_CONTRACT_AVAILABLE =\s*\r?\n\s*true/,
);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_IMPLEMENTATION_AVAILABLE =\s*\r?\n\s*true/,
);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /"\/admin\/assignments\/\[assignmentId\]"/,
);
assert.match(productActionDisabledRouteActionBindingPolicySource, /dynamic/);
assert.match(productActionDisabledRouteActionBindingPolicySource, /no_store/);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /readAssignmentDetailContext_only/,
);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /assignmentDataReader: "readAssignmentDetailContext"/,
);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /onlyAllowedFutureCallable: "createDisabledAssignmentResponseLinkServerAction"/,
);
for (const prohibitedActionBindingRouteCall of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "direct_supabase_mutation_helper",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "detailRouteEntryPolicy",
  "detailResponseLinkEnablementChecklist",
  "productActionServerActionPolicy",
  "productActionDisabledRouteWiringPolicy",
  "productActionDisabledRouteActionBindingPolicy",
]) {
  assert.match(
    productActionDisabledRouteActionBindingPolicySource,
    new RegExp(prohibitedActionBindingRouteCall),
  );
}
for (const allowedActionBindingTrigger of [
  "deliberate_click",
  "deliberate_tap",
  "deliberate_submit",
]) {
  assert.match(
    productActionDisabledRouteActionBindingPolicySource,
    new RegExp(allowedActionBindingTrigger),
  );
}
for (const prohibitedActionBindingTrigger of [
  "render",
  "GET",
  "page_load",
  "prefetch",
  "hover",
  "focus",
  "client_effect",
  "hydration",
  "unavailable_state_render",
  "panel_mount",
  "tab_navigation",
]) {
  assert.match(
    productActionDisabledRouteActionBindingPolicySource,
    new RegExp(prohibitedActionBindingTrigger),
  );
}
for (const forbiddenActionBindingAssignmentIdSource of [
  "browser_input",
  "query_params",
  "hidden_field",
  "arbitrary_typed_id",
  "client_component_prop",
  "data_attribute",
  "metadata",
]) {
  assert.match(
    productActionDisabledRouteActionBindingPolicySource,
    new RegExp(forbiddenActionBindingAssignmentIdSource),
  );
}
assert.match(productActionDisabledRouteActionBindingPolicySource, /"expiresInHours"/);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /bounded_by_existing_response_link_product_ttl_policy/,
);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /do_not_hide_ttl_if_ambiguous_server_default_must_be_used_when_no_user_control_exists/,
);
for (const forbiddenActionBindingInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
  "unknownFields",
]) {
  assert.match(
    productActionDisabledRouteActionBindingPolicySource,
    new RegExp(forbiddenActionBindingInput),
  );
}
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /non_disclosing_beyond_existing_authorized_assignment_detail_context/,
);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /later_separately_reviewed_active_success_slice_after_audited_success_and_explicit_approval_only/,
);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /later_separately_reviewed_post_success_slice_only/,
);
assert.match(
  productActionDisabledRouteActionBindingPolicySource,
  /automaticClipboardWrite: "forbidden"/,
);
assert.doesNotMatch(
  productActionDisabledRouteActionBindingPolicySource,
  /["']use server["']|createDisabledAssignmentResponseLinkServerAction\(|createAssignmentDetailResponseLinkDisabledAdapter\(|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|replaceAssignmentResponseToken\(|issueAssignmentResponseLink\(|recordAssignmentResponseLinkRevealAudit\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(productActionDisabledResultStatePolicySource, /^import "server-only";/);
assert.match(
  productActionDisabledResultStatePolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_CONTRACT_AVAILABLE =\s*\r?\n\s*true/,
);
assert.match(
  productActionDisabledResultStatePolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE =\s*\r?\n\s*false/,
);
assert.match(
  productActionDisabledResultStatePolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE =\s*\r?\n\s*false/,
);
assert.match(
  productActionDisabledResultStatePolicySource,
  /"\/admin\/assignments\/\[assignmentId\]"/,
);
assert.match(productActionDisabledResultStatePolicySource, /dynamic/);
assert.match(productActionDisabledResultStatePolicySource, /no_store/);
assert.match(productActionDisabledResultStatePolicySource, /readAssignmentDetailContext_only/);
assert.match(
  productActionDisabledResultStatePolicySource,
  /assignmentDataReader: "readAssignmentDetailContext"/,
);
assert.match(
  productActionDisabledResultStatePolicySource,
  /createDisabledAssignmentResponseLinkServerAction_or_reviewed_successor/,
);
for (const prohibitedResultStateRouteCall of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "direct_supabase_mutation_helper",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "detailRouteEntryPolicy",
  "detailResponseLinkEnablementChecklist",
  "productActionServerActionPolicy",
  "productActionDisabledRouteWiringPolicy",
  "productActionDisabledRouteActionBindingPolicy",
  "productActionDisabledResultStatePolicy",
]) {
  assert.match(
    productActionDisabledResultStatePolicySource,
    new RegExp(prohibitedResultStateRouteCall),
  );
}
for (const allowedDisabledResultState of [
  "disabled",
  "not_approved",
  "checklist_blocked",
  "malformed_input",
  "unavailable",
  "action_error",
  "impossible_success_reduced_to_disabled",
]) {
  assert.match(
    productActionDisabledResultStatePolicySource,
    new RegExp(allowedDisabledResultState),
  );
}
for (const prohibitedDisabledResultField of [
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "rawBearer",
  "bearer",
  "verifier",
  "tokenVerifierHash",
  "responseTokenId",
  "tokenId",
  "auditEventId",
  "auditMetadata",
  "auditInternals",
  "accessToken",
  "refreshToken",
  "password",
  "apiKey",
  "serviceRoleKey",
  "localOrHostedSecret",
  "databaseUrl",
  "sqlDetail",
  "internalRpcDetail",
  "sensitiveIntakeValue",
  "sensitiveIntakeData",
  "emergencyContactDetail",
  "questionnaireAnswers",
  "rawGrants",
  "capabilities",
  "rawCapabilityArrays",
  "unrelatedRowData",
  "stackTrace",
  "providerErrorDump",
  "rawExceptionMessage",
]) {
  assert.match(
    productActionDisabledResultStatePolicySource,
    new RegExp(prohibitedDisabledResultField),
  );
}
for (const nonDisclosingResultContext of [
  "unavailable",
  "unauthorized",
  "cross_workspace",
  "inactive",
  "canceled",
  "archived",
  "missing",
  "malformed",
  "stale",
]) {
  assert.match(
    productActionDisabledResultStatePolicySource,
    new RegExp(nonDisclosingResultContext),
  );
}
for (const prohibitedResultImplication of [
  "usable_link_generated",
  "copying",
  "sending",
  "emailing",
  "texting",
  "delivering_link",
  "hidden_token_row_exists",
  "volunteer_can_still_act_through_respond_token",
  "distinguish_unauthorized_from_missing_cross_workspace_unavailable",
]) {
  assert.match(
    productActionDisabledResultStatePolicySource,
    new RegExp(prohibitedResultImplication),
  );
}
assert.match(
  productActionDisabledResultStatePolicySource,
  /later_separately_reviewed_active_success_slice_after_final_approval_audited_reveal_browser_proof_log_proof_and_product_owner_checkpoint_only/,
);
assert.match(
  productActionDisabledResultStatePolicySource,
  /later_separately_reviewed_post_success_slice_only/,
);
assert.match(productActionDisabledResultStatePolicySource, /automaticClipboardWrite: "forbidden"/);
assert.match(productActionDisabledResultStatePolicySource, /delivery: "forbidden"/);
assert.doesNotMatch(
  productActionDisabledResultStatePolicySource,
  /["']use server["']|createDisabledAssignmentResponseLinkServerAction\(|createAssignmentDetailResponseLinkDisabledAdapter\(|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|replaceAssignmentResponseToken\(|issueAssignmentResponseLink\(|recordAssignmentResponseLinkRevealAudit\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(productActionDisabledResultRendererPolicySource, /^import "server-only";/);
assert.match(
  productActionDisabledResultRendererPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_CONTRACT_AVAILABLE =\s*\r?\n\s*true/,
);
assert.match(
  productActionDisabledResultRendererPolicySource,
  /RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_SUCCESS_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE =\s*\r?\n\s*false/,
);
assert.match(
  productActionDisabledResultRendererPolicySource,
  /"\/admin\/assignments\/\[assignmentId\]"/,
);
assert.match(productActionDisabledResultRendererPolicySource, /dynamic/);
assert.match(productActionDisabledResultRendererPolicySource, /no_store/);
assert.match(
  productActionDisabledResultRendererPolicySource,
  /readAssignmentDetailContext_only/,
);
assert.match(
  productActionDisabledResultRendererPolicySource,
  /assignmentDataReader: "readAssignmentDetailContext"/,
);
assert.match(
  productActionDisabledResultRendererPolicySource,
  /already_sanitized_disabled_error_like_state_from_11_48_disabled_result_state_contract_only/,
);
assert.match(productActionDisabledResultRendererPolicySource, /mustNotCallServerAction: true/);
assert.match(productActionDisabledResultRendererPolicySource, /fixedAllowlistedCopyMap/);
assert.match(
  productActionDisabledResultRendererPolicySource,
  /required_keyed_by_safe_state_codes_only/,
);
for (const forbiddenRendererInput of [
  "rawActionResultsFromUnreviewedSources",
  "arbitraryErrorStrings",
  "stackTraces",
  "providerPayloads",
  "supabaseErrorObjects",
  "rpcExceptions",
  "thrownExceptions",
]) {
  assert.match(
    productActionDisabledResultRendererPolicySource,
    new RegExp(forbiddenRendererInput),
  );
  assert.match(
    productActionDisabledResultRendererPolicySource,
    new RegExp(`${forbiddenRendererInput}: "forbidden"`),
  );
}
for (const allowedRendererStateCode of [
  "disabled",
  "not_approved",
  "checklist_blocked",
  "malformed_input",
  "unavailable",
  "action_error",
  "impossible_success_reduced_to_disabled",
]) {
  assert.match(
    productActionDisabledResultRendererPolicySource,
    new RegExp(allowedRendererStateCode),
  );
}
for (const prohibitedRendererRouteImport of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "direct_supabase_mutation_helper",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "detailRouteEntryPolicy",
  "detailResponseLinkEnablementChecklist",
  "productActionServerActionPolicy",
  "productActionDisabledRouteWiringPolicy",
  "productActionDisabledRouteActionBindingPolicy",
  "productActionDisabledResultStatePolicy",
  "productActionDisabledResultRendererPolicy",
]) {
  assert.match(
    productActionDisabledResultRendererPolicySource,
    new RegExp(prohibitedRendererRouteImport),
  );
}
for (const prohibitedRendererAffordance of [
  "button",
  "link",
  "copy_affordance",
  "retry_affordance",
  "reveal_affordance",
  "download_affordance",
  "open_link_affordance",
  "email_affordance",
  "text_affordance",
  "send_affordance",
  "hidden_interactive_fallback",
]) {
  assert.match(
    productActionDisabledResultRendererPolicySource,
    new RegExp(prohibitedRendererAffordance),
  );
}
for (const prohibitedRendererValue of [
  "generated_url_field",
  "url_shaped_string",
  "/respond/",
  "\\[redacted\\]",
  "bearer_like_value",
  "token_like_value",
  "hash_like_value",
  "audit_id",
  "diagnostic_id",
]) {
  assert.match(
    productActionDisabledResultRendererPolicySource,
    new RegExp(prohibitedRendererValue),
  );
}
for (const prohibitedRendererHiddenMetadata of [
  "assignmentId",
  "expiresInHours",
  "actionMetadata",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "tokenId",
  "auditEventId",
  "bearer",
  "verifier",
  "workspaceId",
  "volunteerId",
  "actorId",
  "capabilities",
  "grant",
  "redirectPath",
  "returnPath",
  "copyMode",
]) {
  assert.match(
    productActionDisabledResultRendererPolicySource,
    new RegExp(prohibitedRendererHiddenMetadata),
  );
}
assert.match(
  productActionDisabledResultRendererPolicySource,
  /later_separately_reviewed_active_success_slice_after_final_approval_audited_reveal_browser_proof_log_proof_product_owner_checkpoint_and_explicit_copy_ui_review_only/,
);
assert.match(
  productActionDisabledResultRendererPolicySource,
  /later_separately_reviewed_post_success_slice_only/,
);
assert.match(productActionDisabledResultRendererPolicySource, /automaticClipboardWrite: "forbidden"/);
assert.match(productActionDisabledResultRendererPolicySource, /delivery: "forbidden"/);
assert.doesNotMatch(
  productActionDisabledResultRendererPolicySource,
  /["']use server["']|createDisabledAssignmentResponseLinkServerAction\(|createAssignmentDetailResponseLinkDisabledAdapter\(|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|replaceAssignmentResponseToken\(|issueAssignmentResponseLink\(|recordAssignmentResponseLinkRevealAudit\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

assert.match(productActionActivationCheckpointSource, /^import "server-only";/);
assert.match(
  productActionActivationCheckpointSource,
  /RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_AVAILABLE = true/,
);
assert.match(
  productActionActivationCheckpointSource,
  /RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED = false/,
);
assert.match(productActionActivationCheckpointSource, /RESPONSE_LINK_PRODUCT_ACTION_DELIVERY_AVAILABLE = false/);
assert.match(
  productActionActivationCheckpointSource,
  /RESPONSE_LINK_PRODUCT_ACTION_PUBLIC_LOOKUP_AVAILABLE = false/,
);
assert.match(
  productActionActivationCheckpointSource,
  /RESPONSE_LINK_PRODUCT_ACTION_REMEMBERED_DEVICE_AVAILABLE = false/,
);
assert.match(productActionActivationCheckpointSource, /"\/admin\/assignments\/\[assignmentId\]"/);
assert.match(productActionActivationCheckpointSource, /checkpoint_only_activation_blocked/);
assert.match(productActionActivationCheckpointSource, /readAssignmentDetailContext_only/);
assert.match(productActionActivationCheckpointSource, /assignmentDataReader: "readAssignmentDetailContext"/);
assert.match(productActionActivationCheckpointSource, /assignment_detail_context_only/);
assert.match(productActionActivationCheckpointSource, /server_derived_trusted_origin_only/);
for (const provenFoundation of [
  "public_response_token_tables_and_rpcs_exist_and_were_locally_and_hosted_validated",
  "atomic_replacement_exists_and_was_hosted_validated",
  "reveal_audit_persistence_exists_and_was_hosted_validated",
  "transactional_audited_reveal_exists_and_was_hosted_validated",
  "persisted_assignment_detail_context_exists_and_was_hosted_validated",
  "assignment_detail_route_exists_unlinked_dynamic_no_store_read_only_persisted",
  "assignment_detail_route_reads_only_readAssignmentDetailContext",
  "assignment_detail_route_has_exactly_one_route_derived_disabled_binding_to_11_41_stub",
  "disabled_server_action_stub_remains_disabled_by_default_and_credential_free",
  "disabled_result_state_policy_exists_and_remains_route_unused",
  "disabled_result_renderer_policy_exists_and_remains_route_unused",
  "static_guards_prove_no_active_route_behavior",
  "browser_guards_prove_no_url_copy_result_renderer_form_hidden_metadata_or_delivery",
  "server_action_guards_prove_disabled_adapter_only_credential_free_behavior",
  "redirected_redacted_supabase_diagnostic_guardrail_remains_intact",
]) {
  assert.match(productActionActivationCheckpointSource, new RegExp(provenFoundation));
}
for (const remainingBlocker of [
  "explicit_product_owner_approval_and_final_approval_flag",
  "reviewed_active_server_action_implementation_decision",
  "reviewed_active_success_result_state_contract",
  "reviewed_active_success_renderer_contract",
  "reviewed_url_bearing_success_renderer_implementation",
  "reviewed_post_success_manual_copy_ui_implementation",
  "browser_proof_no_url_before_success_and_url_only_after_deliberate_action",
  "log_output_proof_no_full_url_bearer_verifier_token_id_audit_id",
  "no_prefetch_no_render_no_hover_no_focus_no_hydration_execution_proof",
  "unavailable_state_non_disclosure_proof",
  "product_entry_link_decision_from_persisted_authorized_contexts_only",
  "abuse_recovery_rate_limit_operational_policy_for_generated_links",
  "delivery_policy_separate_and_blocked",
  "public_lookup_separate_and_blocked",
  "remembered_devices_separate_and_blocked",
  "hosted_validation_only_if_db_rpc_generated_type_or_hosted_behavior_changes",
  "active_surface_remains_assignment_detail_context_only_with_trusted_server_origin",
]) {
  assert.match(productActionActivationCheckpointSource, new RegExp(remainingBlocker));
}
for (const safeNextOption of [
  "disabled_result_renderer_implementation_still_non_interactive_and_credential_free",
  "active_success_result_state_readiness_contract_still_route_unused",
  "active_success_renderer_readiness_contract_still_route_unused",
  "route_entry_link_readiness_re_review_from_persisted_calendar_volunteers_needs_attention_communications_contexts",
  "pause_response_link_work_and_return_to_higher_priority_mvp_scheduling_assignment_flows",
]) {
  assert.match(productActionActivationCheckpointSource, new RegExp(safeNextOption));
}
for (const nonNegotiable of [
  "no_active_reveal",
  "no_active_copy",
  "no_product_surface_availability",
  "no_navigation_entry_linkage",
  "no_delivery",
  "no_public_lookup",
  "no_remembered_device_behavior",
  "no_service_role_usage",
  "no_mock_to_real_mixing",
  "no_route_import_of_policy_checkpoint_modules",
  "no_direct_route_import_or_call_of_disabled_adapter_product_action_boundary_audited_reveal_rpc_token_helper_replacement_helper_diagnostic_helper_token_table_direct_supabase_helper_or_service_role_path",
]) {
  assert.match(productActionActivationCheckpointSource, new RegExp(nonNegotiable));
}
for (const forbiddenActivationRouteImport of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "diagnostic_response_link_dependency",
  "assignment_response_tokens",
  "direct_supabase_mutation_helper",
  "service_role_client",
  "productActionDisabledResultStatePolicy",
  "productActionDisabledResultRendererPolicy",
  "productActionActivationCheckpoint",
]) {
  assert.match(productActionActivationCheckpointSource, new RegExp(forbiddenActivationRouteImport));
}
assert.match(
  productActionActivationCheckpointSource,
  /hosted_validation_not_required_unless_db_rpc_generated_type_or_hosted_behavior_changes/,
);
assert.match(productActionActivationCheckpointSource, /redirect_supabase_diagnostics_to_temp_files/);
assert.match(productActionActivationCheckpointSource, /redact_key_like_values_before_displaying_excerpts/);
assert.match(productActionActivationCheckpointSource, /do_not_commit_secrets_local_env_values_fixture_credentials_or_generated_keys/);
assert.doesNotMatch(
  productActionActivationCheckpointSource,
  /["']use server["']|createDisabledAssignmentResponseLinkServerAction\(|createAssignmentDetailResponseLinkDisabledAdapter\(|createAssignmentDetailResponseLinkProductAction\(|createAuditedAssignmentResponseLinkReveal\(|reveal_assignment_response_link\s*\(|replaceAssignmentResponseToken\(|issueAssignmentResponseLink\(|recordAssignmentResponseLinkRevealAudit\(|\.rpc\(|\.from\(|SUPABASE_SERVICE_ROLE_KEY|createServiceRole|serviceRole\b|console\.|logger\.|navigator\.clipboard|clipboard\.writeText/i,
);

const appAndComponentFiles = [];
for (const directory of ["app", "components"]) {
  appAndComponentFiles.push(
    ...(await collectFiles(path.join(root, directory))).filter((file) =>
      /\.(?:ts|tsx)$/.test(file),
    ),
  );
}

const contextImporters = [];
const inboundLinks = [];
const routeEntryPolicyImporters = [];
const enablementChecklistImporters = [];
const disabledAdapterImporters = [];
const serverActionPolicyImporters = [];
const serverActionStubImporters = [];
const disabledRouteWiringPolicyImporters = [];
const disabledActionBindingPolicyImporters = [];
const disabledResultStatePolicyImporters = [];
const disabledResultRendererPolicyImporters = [];
const activationCheckpointImporters = [];
const unsafeCurrentRouteOrComponentUi = [];
for (const file of appAndComponentFiles) {
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const source = await readFile(file, "utf8");
  if (
    source.includes("lib/assignments/detailContext") ||
    source.includes("readAssignmentDetailContext")
  ) {
    contextImporters.push(relative);
  }
  if (relative !== routeRelativePath && source.includes("/admin/assignments/")) {
    inboundLinks.push(relative);
  }
  if (
    source.includes("detailRouteEntryPolicy") ||
    source.includes("assignmentDetailRouteEntry")
  ) {
    routeEntryPolicyImporters.push(relative);
  }
  if (
    source.includes("detailResponseLinkEnablementChecklist") ||
    source.includes("assignmentDetailResponseLinkEnablement")
  ) {
    enablementChecklistImporters.push(relative);
  }
  if (
    source.includes("productActionDisabledAdapter") ||
    source.includes("createAssignmentDetailResponseLinkDisabledAdapter")
  ) {
    disabledAdapterImporters.push(relative);
  }
  if (
    source.includes("productActionServerActionPolicy") ||
    source.includes("responseLinkProductActionServerAction") ||
    source.includes("RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION")
  ) {
    serverActionPolicyImporters.push(relative);
  }
  if (
    source.includes("productActionServerAction.server") ||
    source.includes("createDisabledAssignmentResponseLinkServerAction") ||
    source.includes("RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB")
  ) {
    serverActionStubImporters.push(relative);
  }
  if (
    source.includes("productActionDisabledRouteWiringPolicy") ||
    source.includes("responseLinkProductActionDisabledRouteWiring") ||
    source.includes("RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING")
  ) {
    disabledRouteWiringPolicyImporters.push(relative);
  }
  if (
    source.includes("productActionDisabledRouteActionBindingPolicy") ||
    source.includes("responseLinkProductActionDisabledRouteActionBinding") ||
    source.includes("RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING")
  ) {
    disabledActionBindingPolicyImporters.push(relative);
  }
  if (
    source.includes("productActionDisabledResultStatePolicy") ||
    source.includes("responseLinkProductActionDisabledResultState") ||
    source.includes("RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT")
  ) {
    disabledResultStatePolicyImporters.push(relative);
  }
  if (
    source.includes("productActionDisabledResultRendererPolicy") ||
    source.includes("responseLinkProductActionDisabledResultRenderer") ||
    source.includes("RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER")
  ) {
    disabledResultRendererPolicyImporters.push(relative);
  }
  if (
    source.includes("productActionActivationCheckpoint") ||
    source.includes("responseLinkProductActionActivationCheckpoint") ||
    source.includes("RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT")
  ) {
    activationCheckpointImporters.push(relative);
  }
  if (
    /createAssignmentDetailResponseLinkProductAction|productActionDisabledAdapter|createAssignmentDetailResponseLinkDisabledAdapter|productActionServerAction\.server|createDisabledAssignmentResponseLinkServerAction|productActionServerActionPolicy|responseLinkProductActionServerAction|productActionDisabledRouteWiringPolicy|responseLinkProductActionDisabledRouteWiring|productActionDisabledRouteActionBindingPolicy|responseLinkProductActionDisabledRouteActionBinding|productActionDisabledResultStatePolicy|responseLinkProductActionDisabledResultState|productActionDisabledResultRendererPolicy|responseLinkProductActionDisabledResultRenderer|productActionActivationCheckpoint|responseLinkProductActionActivationCheckpoint|activationCheckpoint|productActionUiPolicy|productActionWiringPolicy|detailRouteEntryPolicy|assignmentDetailRouteEntry|detailResponseLinkEnablementChecklist|assignmentDetailResponseLinkEnablement|createAuditedAssignmentResponseLinkReveal|reveal_assignment_response_link|assignment_response_tokens|navigator\.clipboard|clipboard\.writeText|Copy response link|Copy full link|Generate link|Reveal link|fullResponseUrl|responseUrl|responseTokenId|tokenVerifierHash|bearerToken|rawBearer|resultRenderer|resultComponent|actionResult|disabledResult|retry_affordance|download_affordance|open_link_affordance|send_affordance/i.test(
      source,
    )
  ) {
    unsafeCurrentRouteOrComponentUi.push(relative);
  }
}

assert.deepEqual(contextImporters, [routeRelativePath]);
assert.deepEqual(inboundLinks, []);
assert.deepEqual(routeEntryPolicyImporters, []);
assert.deepEqual(enablementChecklistImporters, []);
assert.deepEqual(disabledAdapterImporters, []);
assert.deepEqual(serverActionPolicyImporters, []);
assert.deepEqual(serverActionStubImporters, [routeRelativePath]);
assert.deepEqual(disabledRouteWiringPolicyImporters, []);
assert.deepEqual(disabledActionBindingPolicyImporters, []);
assert.deepEqual(disabledResultStatePolicyImporters, []);
assert.deepEqual(disabledResultRendererPolicyImporters, []);
assert.deepEqual(activationCheckpointImporters, []);
assert.deepEqual(
  unsafeCurrentRouteOrComponentUi.filter(
    (relative) =>
      relative !== routeRelativePath &&
      !relative.startsWith("app/v/schedule/") &&
      relative !== "components/VolunteerScheduleClient.tsx",
  ),
  [],
);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_CONTRACT_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_IMPLEMENTATION_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION, false);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_ENTRY_CONTRACT_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_CALENDAR_ENTRY_LINKAGE_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_VOLUNTEERS_ENTRY_LINKAGE_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_NEEDS_ATTENTION_ENTRY_LINKAGE_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_COMMUNICATIONS_ENTRY_LINKAGE_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_PUBLIC_VOLUNTEER_ENTRY_LINKAGE_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_RESPONSE_TOKEN_ROUTE_LINKAGE_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_DIAGNOSTIC_ROUTE_LINKAGE_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE, true);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE, false);
assert.equal(ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE, false);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_CONTRACT_AVAILABLE,
  true,
);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_IMPLEMENTATION_AVAILABLE,
  true,
);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_ELIGIBLE_ROUTE,
  "/admin/assignments/[assignmentId]",
);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_CONTRACT_AVAILABLE, true);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
  false,
);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
  false,
);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_ELIGIBLE_ROUTE,
  "/admin/assignments/[assignmentId]",
);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_CONTRACT_AVAILABLE, true);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_SUCCESS_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
  false,
);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_ELIGIBLE_ROUTE,
  "/admin/assignments/[assignmentId]",
);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED, false);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_ELIGIBLE_SURFACE,
  "/admin/assignments/[assignmentId]",
);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DELIVERY_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_PUBLIC_LOOKUP_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_REMEMBERED_DEVICE_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_DEFAULT_STATE, "disabled");
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
  false,
);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ROUTE_CONTEXT,
  "/admin/assignments/[assignmentId]",
);
assert.deepEqual(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ALLOWED_BROWSER_INPUTS, [
  "assignmentId",
  "expiresInHours",
]);
for (const forbiddenAdapterInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "origin",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
]) {
  assert.ok(
    RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FORBIDDEN_BROWSER_INPUTS.includes(
      forbiddenAdapterInput,
    ),
  );
}
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_SHAPE_CONTRACT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE, false);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ELIGIBLE_ROUTE,
  "/admin/assignments/[assignmentId]",
);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_DEFAULT_STATE, "disabled");
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_FINAL_APPROVAL_AVAILABLE, false);
const serverActionStubDescription = describeDisabledAssignmentResponseLinkServerAction();
assert.equal(serverActionStubDescription.stubAvailable, true);
assert.equal(serverActionStubDescription.routeUnused, false);
assert.equal(serverActionStubDescription.defaultState, "disabled");
assert.equal(serverActionStubDescription.finalApprovalAvailable, false);
assert.equal(
  serverActionStubDescription.eligibleRoute,
  "/admin/assignments/[assignmentId]",
);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_CONTRACT_AVAILABLE, true);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE,
  true,
);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ROUTE_IMPORT_AVAILABLE,
  true,
);
assert.equal(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ELIGIBLE_ROUTE,
  "/admin/assignments/[assignmentId]",
);
const disabledRouteWiringDescription =
  describeResponseLinkProductActionDisabledRouteWiringPolicy();
assert.equal(disabledRouteWiringDescription.contractAvailable, true);
assert.equal(
  disabledRouteWiringDescription.disabledRouteWiringImplementationAvailable,
  true,
);
assert.equal(
  disabledRouteWiringDescription.disabledRouteWiringRouteImportAvailable,
  true,
);
assert.equal(disabledRouteWiringDescription.serverActionStubAvailable, true);
assert.equal(disabledRouteWiringDescription.serverActionStubRouteUnused, false);
assert.equal(
  disabledRouteWiringDescription.routeServerActionImplementationAvailable,
  false,
);
assert.equal(disabledRouteWiringDescription.finalApprovalAvailable, false);
assert.equal(disabledRouteWiringDescription.activeRevealAvailable, false);
assert.equal(disabledRouteWiringDescription.activeCopyAvailable, false);
assert.equal(disabledRouteWiringDescription.activeEntryLinkingAvailable, false);
assert.equal(disabledRouteWiringDescription.routeWiringImplementationAvailable, false);
assert.equal(
  disabledRouteWiringDescription.productActionUiImplementationAvailable,
  false,
);
assert.equal(disabledRouteWiringDescription.copyAffordanceAvailable, false);
assert.equal(disabledRouteWiringDescription.productSurfaceImplementationAvailable, false);
assert.equal(disabledRouteWiringDescription.revealProductSurfaceAvailable, false);
assert.equal(disabledRouteWiringDescription.assignmentDetailNavigationLinked, false);
assert.equal(RESPONSE_LINK_ASSIGNMENT_DETAIL_CONTEXT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_CONTRACT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_SERVER_BOUNDARY_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_UI_CONTRACT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_UI_READINESS_REVIEW_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_INERT_UI_SHELL_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_WIRING_CONTRACT_AVAILABLE, true);
assert.equal(RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE, false);
assert.equal(RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE, false);
assert.equal(
  describeAssignmentDetailRouteEntryContract().contract.routePathPattern,
  "/admin/assignments/[assignmentId]",
);
assert.equal(describeAssignmentDetailRouteEntryContract().implementationAvailable, false);
assert.equal(describeAssignmentDetailRouteEntryContract().calendarEntryLinkageAvailable, false);
assert.equal(describeAssignmentDetailRouteEntryContract().volunteersEntryLinkageAvailable, false);
assert.equal(
  describeAssignmentDetailRouteEntryContract().needsAttentionEntryLinkageAvailable,
  false,
);
assert.equal(
  describeAssignmentDetailRouteEntryContract().communicationsEntryLinkageAvailable,
  false,
);
assert.equal(
  describeAssignmentDetailRouteEntryContract().publicVolunteerEntryLinkageAvailable,
  false,
);
assert.equal(
  describeAssignmentDetailRouteEntryContract().responseTokenRouteLinkageAvailable,
  false,
);
assert.equal(describeAssignmentDetailRouteEntryContract().diagnosticRouteLinkageAvailable, false);
assert.equal(
  assignmentDetailRouteEntryContract.routeRole,
  "secure_project_contact_direct_access_fallback",
);
assert.equal(
  assignmentDetailRouteEntryContract.currentImplementation,
  "no_entry_points_link_to_route",
);
for (const futureSurface of [
  "calendar_item_inspector_or_assignment_list_context",
  "volunteer_profile_admin_assignment_context",
  "needs_attention_staffing_or_response_row",
  "communications_or_reminder_preview_context",
]) {
  assert.ok(
    assignmentDetailRouteEntryContract.futureEligibleEntrySurfaces.some(
      (entry) => entry.surface === futureSurface,
    ),
  );
}
for (const ineligibleSurface of [
  "public_volunteer_routes",
  "/respond/[token]",
  "diagnostic_routes",
  "mock_only_routes",
  "anonymous_or_unauthenticated_pages",
  "browser_typed_arbitrary_assignment_id_surfaces",
  "broad_assignment_directory_or_search",
]) {
  assert.ok(
    assignmentDetailRouteEntryContract.ineligibleEntrySurfaces.includes(
      ineligibleSurface,
    ),
  );
}
for (const futureRequirement of [
  "derive_assignment_id_from_already_authorized_persisted_context",
  "link_only_to_existing_dynamic_no_store_assignment_detail_route",
  "preserve_non_disclosing_unavailable_state_for_stale_or_unauthorized_ids",
  "avoid_broad_assignment_directory_or_search_surface",
  "avoid_implying_volunteers_should_use_admin_route",
  "keep_entry_points_minimal_and_specific",
]) {
  assert.ok(
    assignmentDetailRouteEntryContract.futureEntryRequirements.includes(
      futureRequirement,
    ),
  );
}
assert.deepEqual(assignmentDetailRouteEntryContract.hrefAllowedShape, {
  path: "/admin/assignments/[assignmentId]",
  query: "none",
  hash: "none",
});
for (const forbiddenHrefData of [
  "workspaceId",
  "volunteerId",
  "responseTokenId",
  "rawBearer",
  "tokenVerifierHash",
  "fullResponseUrl",
  "redactedResponseUrl",
  "auditEventId",
  "responseLinkMetadata",
  "capabilities",
  "grant",
]) {
  assert.ok(assignmentDetailRouteEntryContract.hrefForbiddenData.includes(forbiddenHrefData));
}
const otherwiseReadyEntry = evaluateAssignmentDetailRouteEntryReadiness({
  persistedAuthorizedSourceContext: true,
  noMockFallbackForAssignmentIds: true,
  hrefCarriesOnlyAssignmentPathSegment: true,
  unavailableFallbackReviewed: true,
  staticAndBrowserLinkageGuardsPassed: true,
  productOwnerApprovedEntrySurface: true,
});
assert.equal(otherwiseReadyEntry.allowed, false);
assert.ok(
  otherwiseReadyEntry.blockers.includes(
    "assignment_detail_route_entry_implementation_unavailable",
  ),
);
const enablementDescription = describeAssignmentDetailResponseLinkEnablementChecklist();
assert.equal(enablementDescription.checklistAvailable, true);
assert.equal(enablementDescription.activeRevealAvailable, false);
assert.equal(enablementDescription.activeCopyAvailable, false);
assert.equal(enablementDescription.activeEntryLinkingAvailable, false);
assert.equal(
  enablementDescription.checklist.currentStatus,
  "active_reveal_copy_and_linking_blocked",
);
assert.equal(
  enablementDescription.checklist.activationRule,
  "all_prerequisite_groups_must_be_true_before_any_active_flag_flips",
);
assert.equal(
  assignmentDetailResponseLinkEnablementChecklist.route,
  "/admin/assignments/[assignmentId]",
);
for (const requiredActiveFalseFlag of [
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE",
  "ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE",
  "ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION",
  "RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE",
]) {
  assert.ok(
    assignmentDetailResponseLinkEnablementChecklist.activeFlagsThatMustRemainFalse.includes(
      requiredActiveFalseFlag,
    ),
  );
}
const enablementPrerequisiteGroups =
  getAssignmentDetailResponseLinkEnablementPrerequisiteGroups();
assert.deepEqual(Object.keys(enablementPrerequisiteGroups), [
  "routeSafety",
  "entrySafety",
  "actionSafety",
  "uiSafety",
  "credentialLogSafety",
  "browserProof",
  "productOwnerCheckpoint",
]);
for (const [groupName, items] of Object.entries(enablementPrerequisiteGroups)) {
  assert.ok(items.length > 0, `${groupName} must have checklist items`);
}
for (const requiredRouteSafetyItem of [
  "assignment_detail_route_remains_dynamic_no_store",
  "verified_project_contact_session_required",
  "persisted_assignment_detail_context_only",
  "non_disclosing_unavailable_state",
  "no_mock_fallback",
]) {
  assert.ok(enablementPrerequisiteGroups.routeSafety.includes(requiredRouteSafetyItem));
}
for (const requiredEntrySafetyItem of [
  "future_entry_point_comes_from_persisted_authorized_assignment_context",
  "no_public_volunteer_respond_diagnostic_mock_or_anonymous_entry",
  "href_carries_only_admin_assignments_assignment_id_path",
  "no_query_hash_scope_token_capability_workspace_or_volunteer_data",
]) {
  assert.ok(enablementPrerequisiteGroups.entrySafety.includes(requiredEntrySafetyItem));
}
for (const requiredActionSafetyItem of [
  "explicit_post_server_action_only",
  "no_render_get_page_load_prefetch_hover_focus_or_effect_reveal",
  "browser_input_assignment_id_plus_optional_bounded_ttl_only",
  "route_calls_only_11_32_product_action_boundary",
  "no_direct_audited_reveal_rpc_token_replacement_table_or_service_role_path",
]) {
  assert.ok(enablementPrerequisiteGroups.actionSafety.includes(requiredActionSafetyItem));
}
for (const requiredUiSafetyItem of [
  "assignment_specific_credential_warning",
  "visible_expiration",
  "disabled_unavailable_states_credential_free",
  "no_automatic_clipboard_write",
  "manual_copy_only_after_audited_success",
]) {
  assert.ok(enablementPrerequisiteGroups.uiSafety.includes(requiredUiSafetyItem));
}
for (const requiredCredentialLogSafetyItem of [
  "no_full_url_bearer_verifier_or_token_id_in_render_error_or_logs",
  "no_access_refresh_token_password_or_service_role_key_in_render_error_or_logs",
  "no_local_or_hosted_secrets_in_render_error_or_logs",
  "no_sql_detail_in_user_facing_errors",
  "no_sensitive_intake_or_unrelated_row_data_in_render_error_or_logs",
]) {
  assert.ok(
    enablementPrerequisiteGroups.credentialLogSafety.includes(
      requiredCredentialLogSafetyItem,
    ),
  );
}
for (const requiredBrowserProofItem of [
  "browser_test_proves_no_url_before_success",
  "desktop_and_390px_mobile_have_no_overflow_or_errors",
  "unavailable_state_reveals_no_response_link_capability_detail",
]) {
  assert.ok(enablementPrerequisiteGroups.browserProof.includes(requiredBrowserProofItem));
}
assert.ok(
  enablementPrerequisiteGroups.productOwnerCheckpoint.includes(
    "explicit_later_product_owner_approval_required_before_active_flags_flip",
  ),
);
const otherwiseReadyEnablement = evaluateAssignmentDetailResponseLinkEnablement({
  routeSafety: true,
  entrySafety: true,
  actionSafety: true,
  uiSafety: true,
  credentialLogSafety: true,
  browserProof: true,
  productOwnerCheckpoint: true,
});
assert.equal(otherwiseReadyEnablement.allowed, false);
assert.ok(
  otherwiseReadyEnablement.blockers.includes("active_response_link_reveal_unavailable"),
);
assert.ok(
  otherwiseReadyEnablement.blockers.includes("active_response_link_copy_unavailable"),
);
assert.ok(
  otherwiseReadyEnablement.blockers.includes(
    "active_response_link_entry_linking_unavailable",
  ),
);
const disabledAdapterDescription = describeAssignmentDetailResponseLinkDisabledAdapter();
assert.equal(disabledAdapterDescription.adapterAvailable, true);
assert.equal(disabledAdapterDescription.defaultState, "disabled");
assert.equal(disabledAdapterDescription.finalApprovalAvailable, false);
assert.equal(
  disabledAdapterDescription.routeContext,
  "/admin/assignments/[assignmentId]",
);
assert.equal(
  disabledAdapterDescription.enablementChecklistStatus,
  "active_reveal_copy_and_linking_blocked",
);

function assertDisabledAdapterResultIsCredentialFree(result) {
  assert.equal(result.status, "disabled");
  const serialized = JSON.stringify(result);
  for (const forbiddenResultFragment of [
    "responseUrl",
    "fullResponseUrl",
    "redactedResponseUrl",
    "rawBearer",
    "bearer",
    "verifier",
    "tokenVerifierHash",
    "responseTokenId",
    "tokenId",
    "accessToken",
    "password",
    "serviceRoleKey",
    "sqlDetail",
    "sensitiveIntakeData",
    "unrelatedRowData",
  ]) {
    assert.equal(
      serialized.includes(forbiddenResultFragment),
      false,
      `disabled adapter result must not include ${forbiddenResultFragment}`,
    );
  }
}

let disabledAdapterActionCalls = 0;
const allChecklistReadiness = {
  routeSafety: true,
  entrySafety: true,
  actionSafety: true,
  uiSafety: true,
  credentialLogSafety: true,
  browserProof: true,
  productOwnerCheckpoint: true,
};
const disabledAdapterMalformed =
  await createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(
    { assignmentId: exampleAssignmentId, workspaceId: "forbidden" },
    {
      readiness: allChecklistReadiness,
      productAction: async () => {
        disabledAdapterActionCalls += 1;
        throw new Error("product action must remain unreachable");
      },
    },
  );
assert.deepEqual(disabledAdapterMalformed, {
  status: "disabled",
  reason: "invalid_input",
});
assertDisabledAdapterResultIsCredentialFree(disabledAdapterMalformed);
assert.equal(disabledAdapterActionCalls, 0);

for (const forbiddenInputKey of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "origin",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "unknownField",
]) {
  const result = await createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(
    { assignmentId: exampleAssignmentId, [forbiddenInputKey]: "forbidden" },
    {
      readiness: allChecklistReadiness,
      productAction: async () => {
        disabledAdapterActionCalls += 1;
        throw new Error("product action must remain unreachable");
      },
    },
  );
  assert.deepEqual(result, { status: "disabled", reason: "invalid_input" });
  assertDisabledAdapterResultIsCredentialFree(result);
}
assert.equal(disabledAdapterActionCalls, 0);

const disabledAdapterBadTtl =
  await createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(
    { assignmentId: exampleAssignmentId, expiresInHours: 169 },
    {
      readiness: allChecklistReadiness,
      productAction: async () => {
        disabledAdapterActionCalls += 1;
        throw new Error("product action must remain unreachable");
      },
    },
  );
assert.deepEqual(disabledAdapterBadTtl, {
  status: "disabled",
  reason: "invalid_input",
});
assertDisabledAdapterResultIsCredentialFree(disabledAdapterBadTtl);
assert.equal(disabledAdapterActionCalls, 0);

const disabledAdapterBlockedByChecklist =
  await createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(
    { assignmentId: exampleAssignmentId, expiresInHours: 72 },
    {
      productAction: async () => {
        disabledAdapterActionCalls += 1;
        throw new Error("product action must remain unreachable");
      },
    },
  );
assert.equal(disabledAdapterBlockedByChecklist.status, "disabled");
assert.equal(disabledAdapterBlockedByChecklist.reason, "blocked_by_checklist");
assert.ok(disabledAdapterBlockedByChecklist.blockers.includes("route_safety_incomplete"));
assert.ok(
  disabledAdapterBlockedByChecklist.blockers.includes("product_owner_checkpoint_missing"),
);
assertDisabledAdapterResultIsCredentialFree(disabledAdapterBlockedByChecklist);
assert.equal(disabledAdapterActionCalls, 0);

const disabledAdapterNotApproved =
  await createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(
    { assignmentId: exampleAssignmentId, expiresInHours: 72 },
    {
      readiness: allChecklistReadiness,
      productAction: async () => {
        disabledAdapterActionCalls += 1;
        return {
          status: "issued",
          responseUrl: "[synthetic action response credential]",
          expiresAt: "2026-07-05T12:00:00.000Z",
          warning: ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_WARNING,
        };
      },
    },
  );
assert.deepEqual(disabledAdapterNotApproved, {
  status: "disabled",
  reason: "not_approved",
});
assertDisabledAdapterResultIsCredentialFree(disabledAdapterNotApproved);
assert.equal(disabledAdapterActionCalls, 0);
assert.equal(
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_ROUTE_CONTEXT,
  "/admin/assignments/[assignmentId]",
);
assert.equal(ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REVEAL_MODE, "copy_link");
assert.equal(
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REASON_CODE,
  "assignment_detail_product_action",
);
assert.equal(
  describeResponseLinkProductActionUiContract().contract.eligibleSurface,
  "/admin/assignments/[assignmentId]",
);
assert.equal(describeResponseLinkProductActionUiContract().inertShellAvailable, true);
assert.equal(
  responseLinkProductActionUiContract.assignmentDataBoundary,
  "readAssignmentDetailContext_only",
);
assert.equal(
  responseLinkProductActionUiContract.currentRouteImport,
  "prohibited_until_reviewed_ui_slice",
);
assert.equal(responseLinkProductActionUiContract.trigger.required, "deliberate_click_or_tap");
assert.equal(
  responseLinkProductActionUiContract.currentInertShell.status,
  "visible_with_disabled_action_binding",
);
assert.equal(
  responseLinkProductActionUiContract.currentInertShell.eligibleSurface,
  "/admin/assignments/[assignmentId]",
);
for (const requiredShellCopy of [
  "future_link_grants_response_access_for_this_assignment",
  "future_link_will_expire",
  "future_action_requires_explicit_click_or_tap",
  "manual_copy_after_audited_success_only",
]) {
  assert.ok(
    responseLinkProductActionUiContract.currentInertShell.allowedVisibleCopy.includes(
      requiredShellCopy,
    ),
  );
}
for (const prohibitedShellMechanic of [
  "form",
  "server_action_form_binding",
  "enabled_form_submission",
  "enabled_button",
  "hidden_credential_or_action_metadata",
  "clipboard_call",
  "generated_link_field",
  "full_or_redacted_live_url",
]) {
  assert.ok(
    responseLinkProductActionUiContract.currentInertShell.prohibitedMechanics.includes(
      prohibitedShellMechanic,
    ),
  );
}
for (const prohibitedTrigger of [
  "render",
  "GET",
  "page_load",
  "prefetch",
  "hover",
  "focus",
  "automatic_effect",
]) {
  assert.ok(responseLinkProductActionUiContract.trigger.prohibited.includes(prohibitedTrigger));
}
for (const requiredDisclosure of [
  "warn_link_grants_response_access_for_this_assignment",
  "show_expiration_before_action",
  "state_manual_copy_available_only_after_audited_success",
]) {
  assert.ok(
    responseLinkProductActionUiContract.preActionDisclosure.includes(requiredDisclosure),
  );
}
for (const requiredPostSuccessRule of [
  "show_full_url_only_in_successful_explicit_action_response",
  "show_expiration_after_action",
  "allow_manual_copy_only_after_success",
  "never_auto_copy_to_clipboard",
]) {
  assert.ok(
    responseLinkProductActionUiContract.postSuccessDisplay.includes(
      requiredPostSuccessRule,
    ),
  );
}
for (const prohibitedErrorField of [
  "fullResponseUrl",
  "rawBearer",
  "tokenVerifierHash",
  "responseTokenId",
  "rawAuditData",
  "credential",
  "sqlDetail",
  "sensitiveFixtureValue",
  "accessToken",
  "password",
  "serviceRoleKey",
]) {
  assert.ok(
    responseLinkProductActionUiContract.prohibitedErrorStateFields.includes(
      prohibitedErrorField,
    ),
  );
}
const otherwiseReadyUi = evaluateResponseLinkProductActionUiReadiness({
  reviewedRouteActionWiring: true,
  reviewedWarningAndExpirationCopy: true,
  noUrlBeforeSuccessProven: true,
  noImplicitRevealProven: true,
  manualCopyAfterSuccessOnlyProven: true,
  logRedactionReviewed: true,
  productOwnerApproved: true,
});
assert.equal(otherwiseReadyUi.allowed, false);
assert.ok(
  otherwiseReadyUi.blockers.includes("product_action_ui_implementation_unavailable"),
);
assert.ok(otherwiseReadyUi.blockers.includes("copy_affordance_unavailable"));

assert.equal(
  describeResponseLinkProductActionWiringContract().contract.eligibleRoute,
  "/admin/assignments/[assignmentId]",
);
assert.equal(
  describeResponseLinkProductActionWiringContract().routeWiringImplementationAvailable,
  false,
);
assert.equal(
  responseLinkProductActionWiringContract.currentPanel,
  "11.34_inert_response_link_shell",
);
assert.equal(
  responseLinkProductActionWiringContract.routeDataBoundary,
  "readAssignmentDetailContext_only",
);
assert.equal(
  responseLinkProductActionWiringContract.actionBoundary,
  "createAssignmentDetailResponseLinkProductAction_only",
);
assert.equal(
  responseLinkProductActionWiringContract.routeRenderCredentialState,
  "credential_free",
);
for (const requiredTrigger of ["explicit_click_or_tap", "POST", "server_action_only"]) {
  assert.ok(responseLinkProductActionWiringContract.trigger.required.includes(requiredTrigger));
}
for (const prohibitedTrigger of [
  "render",
  "GET",
  "page_load",
  "prefetch",
  "hover",
  "focus",
  "automatic_effect",
]) {
  assert.ok(responseLinkProductActionWiringContract.trigger.prohibited.includes(prohibitedTrigger));
}
assert.deepEqual(responseLinkProductActionWiringContract.browserAllowedInputs, [
  "assignmentId",
  "expiresInHours",
]);
for (const forbiddenBrowserInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "origin",
  "responseTokenId",
  "bearer",
  "fullResponseUrl",
  "tokenVerifierHash",
  "auditMetadata",
  "copyMode",
  "capabilities",
]) {
  assert.ok(
    responseLinkProductActionWiringContract.browserForbiddenInputs.includes(
      forbiddenBrowserInput,
    ),
  );
}
for (const forbiddenRouteCall of [
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "assignment_response_tokens",
  "token_table_read",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "mock_data_fallback",
]) {
  assert.ok(
    responseLinkProductActionWiringContract.routeForbiddenImportsAndCalls.includes(
      forbiddenRouteCall,
    ),
  );
}
for (const actionCallRule of [
  "route_may_call_only_createAssignmentDetailResponseLinkProductAction",
  "do_not_call_audited_reveal_helper_directly_from_route",
  "do_not_call_reveal_rpc_directly_from_route",
  "do_not_read_token_tables_from_route",
  "do_not_manually_sequence_replacement_and_audit",
]) {
  assert.ok(responseLinkProductActionWiringContract.actionCallRules.includes(actionCallRule));
}
assert.equal(
  responseLinkProductActionWiringContract.fullUrlRules.allowedLocation,
  "successful_explicit_action_response_only",
);
for (const prohibitedLocation of [
  "route_render",
  "GET_response",
  "prefetch_response",
  "initial_html",
  "error_state",
  "logs",
]) {
  assert.ok(
    responseLinkProductActionWiringContract.fullUrlRules.prohibitedLocations.includes(
      prohibitedLocation,
    ),
  );
}
assert.equal(responseLinkProductActionWiringContract.manualCopyRules.availability, "post_success_only");
assert.equal(
  responseLinkProductActionWiringContract.manualCopyRules.automaticClipboardWrite,
  "prohibited",
);
for (const prohibitedErrorOrLogField of [
  "fullResponseUrl",
  "rawBearer",
  "tokenVerifierHash",
  "responseTokenId",
  "auditInternals",
  "sqlDetail",
  "accessToken",
  "password",
  "serviceRoleKey",
  "sensitiveIntakeData",
  "unrelatedRowData",
  "localOrHostedSecret",
]) {
  assert.ok(
    responseLinkProductActionWiringContract.prohibitedErrorAndLogFields.includes(
      prohibitedErrorOrLogField,
    ),
  );
}
const otherwiseReadyWiring = evaluateResponseLinkProductActionWiringReadiness({
  reviewedServerActionFormWiring: true,
  noUrlOnRenderGetPrefetchProven: true,
  postSuccessOnlyUrlProven: true,
  postSuccessOnlyManualCopyProven: true,
  logRedactionGuardrailsProven: true,
  productOwnerApproved: true,
});
assert.equal(otherwiseReadyWiring.allowed, false);
assert.ok(
  otherwiseReadyWiring.blockers.includes(
    "product_action_route_wiring_implementation_unavailable",
  ),
);

const serverActionDescription = describeResponseLinkProductActionServerActionPolicy();
assert.equal(serverActionDescription.contractAvailable, true);
assert.equal(serverActionDescription.routeServerActionImplementationAvailable, false);
assert.equal(serverActionDescription.disabledAdapterAvailable, true);
assert.equal(serverActionDescription.finalApprovalAvailable, false);
assert.equal(serverActionDescription.enablementChecklistAvailable, true);
assert.equal(serverActionDescription.activeRevealAvailable, false);
assert.equal(serverActionDescription.activeCopyAvailable, false);
assert.equal(serverActionDescription.activeEntryLinkingAvailable, false);
assert.equal(serverActionDescription.routeWiringImplementationAvailable, false);
assert.equal(serverActionDescription.productActionUiImplementationAvailable, false);
assert.equal(serverActionDescription.copyAffordanceAvailable, false);
assert.equal(serverActionDescription.productSurfaceImplementationAvailable, false);
assert.equal(serverActionDescription.revealProductSurfaceAvailable, false);
assert.equal(serverActionDescription.assignmentDetailNavigationLinked, false);
assert.equal(
  responseLinkProductActionServerActionPolicy.eligibleRoute,
  "/admin/assignments/[assignmentId]",
);
assert.equal(
  responseLinkProductActionServerActionPolicy.currentStatus,
  "contract_only_route_unused_non_executable",
);
assert.equal(responseLinkProductActionServerActionPolicy.executableActionInThisSlice, false);
for (const requiredServerActionMethod of [
  "explicit_server_action",
  "POST",
  "same_route_assignment_context",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.methodShape.required.includes(
      requiredServerActionMethod,
    ),
  );
}
for (const requiredTrigger of [
  "deliberate_submit",
  "deliberate_click",
  "deliberate_tap",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.methodShape.trigger.includes(
      requiredTrigger,
    ),
  );
}
for (const prohibitedServerActionTrigger of [
  "render",
  "GET",
  "page_load",
  "prefetch",
  "hover",
  "focus",
  "client_effect",
  "hydration",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.methodShape.prohibited.includes(
      prohibitedServerActionTrigger,
    ),
  );
}
assert.equal(
  responseLinkProductActionServerActionPolicy.inputShape.assignmentIdSource,
  "route_context_or_reviewed_same_route_binding_only",
);
assert.deepEqual(responseLinkProductActionServerActionPolicy.inputShape.browserAllowedInputs, [
  "assignmentId",
  "expiresInHours",
]);
assert.deepEqual(
  responseLinkProductActionServerActionPolicy.inputShape.futureFormDataAllowedFields,
  ["expiresInHours", "control"],
);
for (const forbiddenServerActionInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.inputShape.browserForbiddenInputs.includes(
      forbiddenServerActionInput,
    ),
  );
}
for (const allowedServerActionBoundary of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "reviewed_active_successor_adapter",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.actionBoundary.allowed.includes(
      allowedServerActionBoundary,
    ),
  );
}
for (const prohibitedServerActionBoundary of [
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "manual_replacement_audit_sequence",
  "service_role_client",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.actionBoundary.prohibited.includes(
      prohibitedServerActionBoundary,
    ),
  );
}
for (const requiredServerSideRecheck of [
  "enablement_checklist",
  "final_approval",
  "route_context_assignment_id",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.actionBoundary.serverSideRechecks.includes(
      requiredServerSideRecheck,
    ),
  );
}
for (const credentialFreeState of [
  "disabled",
  "unavailable",
  "not_approved",
  "checklist_blocked",
  "malformed",
  "action_error",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.resultShape.credentialFreeStates.includes(
      credentialFreeState,
    ),
  );
}
for (const prohibitedErrorOrLogField of [
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "rawBearer",
  "bearer",
  "verifier",
  "tokenVerifierHash",
  "responseTokenId",
  "tokenId",
  "auditEventId",
  "internalRpcDetail",
  "accessToken",
  "refreshToken",
  "password",
  "apiKey",
  "serviceRoleKey",
  "localOrHostedSecret",
  "sensitiveIntakeData",
  "unrelatedRowData",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.resultShape.prohibitedErrorAndLogFields.includes(
      prohibitedErrorOrLogField,
    ),
  );
}
assert.equal(
  responseLinkProductActionServerActionPolicy.resultShape.existenceLeakPolicy,
  "do_not_distinguish_sensitive_existence_or_capability_internals",
);
assert.equal(
  responseLinkProductActionServerActionPolicy.fullUrlRules.allowedLocation,
  "successful_explicit_action_response_after_audited_success_in_later_active_slice_only",
);
for (const prohibitedUrlLocation of [
  "route_render",
  "GET_response",
  "page_load",
  "prefetch_response",
  "initial_html",
  "disabled_state",
  "error_state",
  "logs",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.fullUrlRules.prohibitedLocations.includes(
      prohibitedUrlLocation,
    ),
  );
}
assert.equal(
  responseLinkProductActionServerActionPolicy.copyRules.manualCopyAvailability,
  "after_successful_explicit_action_response_only",
);
assert.equal(
  responseLinkProductActionServerActionPolicy.copyRules.automaticClipboardWrite,
  "forbidden",
);
assert.equal(
  responseLinkProductActionServerActionPolicy.copyRules.preSuccessCopyAffordance,
  "forbidden",
);
for (const requiredFalseFlag of [
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE",
  "ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION",
]) {
  assert.ok(
    responseLinkProductActionServerActionPolicy.activeFlagsThatMustRemainFalse.includes(
      requiredFalseFlag,
    ),
  );
}
const otherwiseReadyServerAction =
  evaluateResponseLinkProductActionServerActionReadiness({
    routeReviewedForServerAction: true,
    explicitPostOnlyProven: true,
    noRenderGetPrefetchRevealProven: true,
    browserInputShapeProven: true,
    adapterBoundaryOnlyProven: true,
    credentialFreeDisabledAndErrorStatesProven: true,
    productOwnerApproved: true,
  });
assert.equal(otherwiseReadyServerAction.allowed, false);
for (const requiredServerActionBlocker of [
  "route_server_action_implementation_unavailable",
  "final_approval_unavailable",
  "active_response_link_reveal_unavailable",
  "active_response_link_copy_unavailable",
  "route_wiring_implementation_unavailable",
  "product_action_ui_implementation_unavailable",
  "copy_affordance_unavailable",
  "product_surface_implementation_unavailable",
  "reveal_product_surface_unavailable",
  "assignment_detail_navigation_linkage_unavailable",
]) {
  assert.ok(otherwiseReadyServerAction.blockers.includes(requiredServerActionBlocker));
}

assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.eligibleRoute,
  "/admin/assignments/[assignmentId]",
);
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.currentStatus,
  "disabled_route_import_with_disabled_action_binding",
);
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.currentPanel,
  "11.34_inert_response_link_shell",
);
assert.deepEqual(responseLinkProductActionDisabledRouteWiringPolicy.routeRequirements.rendering, [
  "dynamic",
  "no_store",
]);
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.routeRequirements.dataBoundary,
  "readAssignmentDetailContext_only",
);
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.routeRequirements.mockFallback,
  "forbidden",
);
for (const allowedFutureRouteTrigger of [
  "deliberate_submit",
  "deliberate_click",
  "deliberate_tap",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteWiringPolicy.invocationRules.allowedTriggers.includes(
      allowedFutureRouteTrigger,
    ),
  );
}
for (const prohibitedFutureRouteTrigger of [
  "render",
  "GET",
  "page_load",
  "prefetch",
  "hover",
  "focus",
  "client_effect",
  "hydration",
  "unavailable_state_render",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteWiringPolicy.invocationRules.prohibitedTriggers.includes(
      prohibitedFutureRouteTrigger,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.inputRules.assignmentIdSource,
  "same_dynamic_route_segment_or_reviewed_same_route_server_binding_only",
);
for (const prohibitedAssignmentIdSource of [
  "arbitrary_browser_typed_input",
  "hidden_metadata",
  "query_string",
  "hash",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteWiringPolicy.inputRules.assignmentIdBrowserSourcesProhibited.includes(
      prohibitedAssignmentIdSource,
    ),
  );
}
assert.deepEqual(
  responseLinkProductActionDisabledRouteWiringPolicy.inputRules.optionalBrowserControlledFields,
  ["expiresInHours"],
);
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.inputRules.ttlPolicy,
  "bounded_by_existing_response_link_product_ttl_policy",
);
for (const forbiddenDisabledWiringBrowserInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteWiringPolicy.inputRules.forbiddenBrowserFields.includes(
      forbiddenDisabledWiringBrowserInput,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.routeActionBoundary.allowedRouteCall,
  "createDisabledAssignmentResponseLinkServerAction",
);
for (const prohibitedDisabledRouteCall of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "manual_replacement_audit_sequence",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteWiringPolicy.routeActionBoundary.prohibitedDirectRouteCalls.includes(
      prohibitedDisabledRouteCall,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.disabledRenderingRules.currentPanelState,
  "disabled_import_wiring_with_disabled_action_binding",
);
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.disabledRenderingRules.stateDisclosure,
  "non_disclosing_and_credential_free",
);
for (const prohibitedDisabledRenderingField of [
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "rawBearer",
  "bearer",
  "verifier",
  "tokenVerifierHash",
  "responseTokenId",
  "tokenId",
  "auditEventId",
  "auditMetadata",
  "auditInternals",
  "sqlDetail",
  "internalRpcDetail",
  "accessToken",
  "refreshToken",
  "password",
  "apiKey",
  "serviceRoleKey",
  "localOrHostedSecret",
  "sensitiveIntakeData",
  "unrelatedRowData",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteWiringPolicy.disabledRenderingRules.prohibitedFields.includes(
      prohibitedDisabledRenderingField,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.futureActiveSuccessRules.fullUrlAvailability,
  "later_reviewed_active_success_slice_after_audited_success_only",
);
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.futureActiveSuccessRules.manualCopyAvailability,
  "later_reviewed_post_success_slice_only",
);
assert.equal(
  responseLinkProductActionDisabledRouteWiringPolicy.futureActiveSuccessRules.automaticClipboardWrite,
  "forbidden",
);
for (const requiredDisabledRouteWiringFalseFlag of [
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE",
  "ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteWiringPolicy.activeFlagsThatMustRemainFalse.includes(
      requiredDisabledRouteWiringFalseFlag,
    ),
  );
}
const otherwiseReadyDisabledRouteWiring =
  evaluateResponseLinkProductActionDisabledRouteWiringReadiness({
    routeReviewedForDisabledWiring: true,
    dynamicNoStoreProven: true,
    persistedContextOnlyProven: true,
    deliberateTriggerOnlyProven: true,
    noImplicitExecutionProven: true,
    routeDerivedAssignmentIdProven: true,
    browserInputShapeProven: true,
    serverActionStubOnlyProven: true,
    credentialFreeDisabledStatesProven: true,
    productOwnerApproved: true,
  });
assert.equal(otherwiseReadyDisabledRouteWiring.allowed, false);
for (const requiredDisabledRouteWiringBlocker of [
  "route_server_action_implementation_unavailable",
  "final_approval_unavailable",
  "active_response_link_reveal_unavailable",
  "active_response_link_copy_unavailable",
  "route_wiring_implementation_unavailable",
  "product_action_ui_implementation_unavailable",
  "copy_affordance_unavailable",
  "product_surface_implementation_unavailable",
  "reveal_product_surface_unavailable",
  "assignment_detail_navigation_linkage_unavailable",
]) {
  assert.ok(
    otherwiseReadyDisabledRouteWiring.blockers.includes(
      requiredDisabledRouteWiringBlocker,
    ),
  );
}

const disabledActionBindingDescription =
  describeResponseLinkProductActionDisabledRouteActionBindingPolicy();
assert.equal(disabledActionBindingDescription.contractAvailable, true);
assert.equal(
  disabledActionBindingDescription.disabledActionBindingImplementationAvailable,
  true,
);
assert.equal(disabledActionBindingDescription.serverActionStubAvailable, true);
assert.equal(
  disabledActionBindingDescription.routeServerActionImplementationAvailable,
  false,
);
assert.equal(disabledActionBindingDescription.finalApprovalAvailable, false);
assert.equal(disabledActionBindingDescription.activeRevealAvailable, false);
assert.equal(disabledActionBindingDescription.activeCopyAvailable, false);
assert.equal(disabledActionBindingDescription.activeEntryLinkingAvailable, false);
assert.equal(
  disabledActionBindingDescription.routeWiringImplementationAvailable,
  false,
);
assert.equal(
  disabledActionBindingDescription.productActionUiImplementationAvailable,
  false,
);
assert.equal(disabledActionBindingDescription.copyAffordanceAvailable, false);
assert.equal(
  disabledActionBindingDescription.productSurfaceImplementationAvailable,
  false,
);
assert.equal(disabledActionBindingDescription.revealProductSurfaceAvailable, false);
assert.equal(disabledActionBindingDescription.assignmentDetailNavigationLinked, false);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.eligibleRoute,
  "/admin/assignments/[assignmentId]",
);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.currentStatus,
  "disabled_route_action_binding_without_enabled_submit",
);
assert.deepEqual(
  responseLinkProductActionDisabledRouteActionBindingPolicy.routeRequirements.rendering,
  ["dynamic", "no_store"],
);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.routeRequirements.dataBoundary,
  "readAssignmentDetailContext_only",
);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.routeRequirements.assignmentDataReader,
  "readAssignmentDetailContext",
);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.routeCallableSeam
    .onlyAllowedFutureCallable,
  "createDisabledAssignmentResponseLinkServerAction",
);
for (const prohibitedActionBindingRouteImport of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "direct_supabase_mutation_helper",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "detailRouteEntryPolicy",
  "detailResponseLinkEnablementChecklist",
  "productActionServerActionPolicy",
  "productActionDisabledRouteWiringPolicy",
  "productActionDisabledRouteActionBindingPolicy",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteActionBindingPolicy.routeCallableSeam.prohibitedDirectRouteImportsOrCalls.includes(
      prohibitedActionBindingRouteImport,
    ),
  );
}
for (const allowedActionBindingTrigger of [
  "deliberate_click",
  "deliberate_tap",
  "deliberate_submit",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteActionBindingPolicy.invocationRules.allowedTriggers.includes(
      allowedActionBindingTrigger,
    ),
  );
}
for (const prohibitedActionBindingTrigger of [
  "render",
  "GET",
  "page_load",
  "prefetch",
  "hover",
  "focus",
  "client_effect",
  "hydration",
  "unavailable_state_render",
  "panel_mount",
  "tab_navigation",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteActionBindingPolicy.invocationRules.prohibitedTriggers.includes(
      prohibitedActionBindingTrigger,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.assignmentIdRules.source,
  "server_derived_from_route_segment_or_same_route_reviewed_server_binding",
);
for (const forbiddenActionBindingIdSource of [
  "browser_input",
  "query_params",
  "hidden_field",
  "arbitrary_typed_id",
  "client_component_prop",
  "data_attribute",
  "metadata",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteActionBindingPolicy.assignmentIdRules.forbiddenBrowserSources.includes(
      forbiddenActionBindingIdSource,
    ),
  );
}
assert.deepEqual(
  responseLinkProductActionDisabledRouteActionBindingPolicy.ttlRules
    .optionalBrowserControlledFields,
  ["expiresInHours"],
);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.ttlRules.ttlPolicy,
  "bounded_by_existing_response_link_product_ttl_policy",
);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.ttlRules.hiddenTtlPolicy,
  "do_not_hide_ttl_if_ambiguous_server_default_must_be_used_when_no_user_control_exists",
);
for (const forbiddenActionBindingBrowserInput of [
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
  "unknownFields",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteActionBindingPolicy.forbiddenBrowserFields.includes(
      forbiddenActionBindingBrowserInput,
    ),
  );
}
for (const credentialFreeActionBindingState of [
  "disabled",
  "not_approved",
  "checklist_blocked",
  "malformed",
  "action_error",
  "unavailable",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteActionBindingPolicy.disabledResultRules.credentialFreeStates.includes(
      credentialFreeActionBindingState,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.disabledResultRules.stateDisclosure,
  "non_disclosing_beyond_existing_authorized_assignment_detail_context",
);
for (const prohibitedActionBindingResultField of [
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "rawBearer",
  "bearer",
  "verifier",
  "tokenVerifierHash",
  "responseTokenId",
  "tokenId",
  "auditEventId",
  "auditMetadata",
  "auditInternals",
  "sqlDetail",
  "internalRpcDetail",
  "accessToken",
  "refreshToken",
  "password",
  "apiKey",
  "serviceRoleKey",
  "localOrHostedSecret",
  "sensitiveIntakeData",
  "unrelatedRowData",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteActionBindingPolicy.disabledResultRules.prohibitedFields.includes(
      prohibitedActionBindingResultField,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.futureActiveSuccessRules
    .fullUrlAvailability,
  "later_separately_reviewed_active_success_slice_after_audited_success_and_explicit_approval_only",
);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.futureActiveSuccessRules
    .manualCopyAvailability,
  "later_separately_reviewed_post_success_slice_only",
);
assert.equal(
  responseLinkProductActionDisabledRouteActionBindingPolicy.futureActiveSuccessRules
    .automaticClipboardWrite,
  "forbidden",
);
for (const requiredActionBindingFalseFlag of [
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE",
  "ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION",
]) {
  assert.ok(
    responseLinkProductActionDisabledRouteActionBindingPolicy.activeFlagsThatMustRemainFalse.includes(
      requiredActionBindingFalseFlag,
    ),
  );
}
const otherwiseReadyDisabledActionBinding =
  evaluateResponseLinkProductActionDisabledRouteActionBindingReadiness({
    routeReviewedForDisabledActionBinding: true,
    dynamicNoStoreProven: true,
    persistedContextOnlyProven: true,
    serverActionStubOnlyProven: true,
    deliberateTriggerOnlyProven: true,
    noImplicitExecutionProven: true,
    serverDerivedAssignmentIdProven: true,
    browserInputShapeProven: true,
    credentialFreeDisabledResultsProven: true,
    productOwnerApproved: true,
  });
assert.equal(otherwiseReadyDisabledActionBinding.allowed, false);
for (const requiredActionBindingBlocker of [
  "route_server_action_implementation_unavailable",
  "final_approval_unavailable",
  "active_response_link_reveal_unavailable",
  "active_response_link_copy_unavailable",
  "route_wiring_implementation_unavailable",
  "product_action_ui_implementation_unavailable",
  "copy_affordance_unavailable",
  "product_surface_implementation_unavailable",
  "reveal_product_surface_unavailable",
  "assignment_detail_navigation_linkage_unavailable",
]) {
  assert.ok(
    otherwiseReadyDisabledActionBinding.blockers.includes(
      requiredActionBindingBlocker,
    ),
  );
}

const disabledResultStateDescription =
  describeResponseLinkProductActionDisabledResultStatePolicy();
assert.equal(disabledResultStateDescription.contractAvailable, true);
assert.equal(
  disabledResultStateDescription.disabledActionBindingImplementationAvailable,
  true,
);
assert.equal(
  disabledResultStateDescription.disabledResultRendererImplementationAvailable,
  false,
);
assert.equal(
  disabledResultStateDescription.activeResultRendererImplementationAvailable,
  false,
);
assert.equal(disabledResultStateDescription.serverActionStubAvailable, true);
assert.equal(
  disabledResultStateDescription.routeServerActionImplementationAvailable,
  false,
);
assert.equal(disabledResultStateDescription.finalApprovalAvailable, false);
assert.equal(disabledResultStateDescription.activeRevealAvailable, false);
assert.equal(disabledResultStateDescription.activeCopyAvailable, false);
assert.equal(disabledResultStateDescription.activeEntryLinkingAvailable, false);
assert.equal(
  disabledResultStateDescription.productActionUiImplementationAvailable,
  false,
);
assert.equal(disabledResultStateDescription.copyAffordanceAvailable, false);
assert.equal(
  disabledResultStateDescription.productSurfaceImplementationAvailable,
  false,
);
assert.equal(disabledResultStateDescription.revealProductSurfaceAvailable, false);
assert.equal(disabledResultStateDescription.assignmentDetailNavigationLinked, false);
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.eligibleRoute,
  "/admin/assignments/[assignmentId]",
);
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.currentStatus,
  "disabled_result_state_contract_only_route_unused",
);
assert.deepEqual(
  responseLinkProductActionDisabledResultStatePolicy.routeRequirements.rendering,
  ["dynamic", "no_store"],
);
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.routeRequirements.dataBoundary,
  "readAssignmentDetailContext_only",
);
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.routeRequirements
    .assignmentDataReader,
  "readAssignmentDetailContext",
);
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.resultSource
    .allowedFutureResultSource,
  "createDisabledAssignmentResponseLinkServerAction_or_reviewed_successor",
);
for (const prohibitedResultStateRouteImport of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "direct_supabase_mutation_helper",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "detailRouteEntryPolicy",
  "detailResponseLinkEnablementChecklist",
  "productActionServerActionPolicy",
  "productActionDisabledRouteWiringPolicy",
  "productActionDisabledRouteActionBindingPolicy",
  "productActionDisabledResultStatePolicy",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultStatePolicy.resultSource.prohibitedDirectRouteImportsOrCalls.includes(
      prohibitedResultStateRouteImport,
    ),
  );
}
for (const allowedDisabledResultState of [
  "disabled",
  "not_approved",
  "checklist_blocked",
  "malformed_input",
  "unavailable",
  "action_error",
  "impossible_success_reduced_to_disabled",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultStatePolicy.allowedCurrentResultStates.includes(
      allowedDisabledResultState,
    ),
  );
}
for (const prohibitedDisabledResultField of [
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "rawBearer",
  "bearer",
  "verifier",
  "tokenVerifierHash",
  "responseTokenId",
  "tokenId",
  "auditEventId",
  "auditMetadata",
  "auditInternals",
  "accessToken",
  "refreshToken",
  "password",
  "apiKey",
  "serviceRoleKey",
  "localOrHostedSecret",
  "databaseUrl",
  "sqlDetail",
  "internalRpcDetail",
  "sensitiveIntakeValue",
  "sensitiveIntakeData",
  "emergencyContactDetail",
  "questionnaireAnswers",
  "rawGrants",
  "capabilities",
  "rawCapabilityArrays",
  "unrelatedRowData",
  "stackTrace",
  "providerErrorDump",
  "rawExceptionMessage",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultStatePolicy.prohibitedResultFields.includes(
      prohibitedDisabledResultField,
    ),
  );
}
for (const nonDisclosingResultContext of [
  "unavailable",
  "unauthorized",
  "cross_workspace",
  "inactive",
  "canceled",
  "archived",
  "missing",
  "malformed",
  "stale",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultStatePolicy.resultCopyRules.nonDisclosingContexts.includes(
      nonDisclosingResultContext,
    ),
  );
}
for (const allowedResultReference of [
  "already_authorized_assignment_detail_context",
  "general_readiness_state",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultStatePolicy.resultCopyRules.allowedReferences.includes(
      allowedResultReference,
    ),
  );
}
for (const prohibitedResultImplication of [
  "usable_link_generated",
  "copying",
  "sending",
  "emailing",
  "texting",
  "delivering_link",
  "hidden_token_row_exists",
  "volunteer_can_still_act_through_respond_token",
  "distinguish_unauthorized_from_missing_cross_workspace_unavailable",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultStatePolicy.resultCopyRules.prohibitedImplications.includes(
      prohibitedResultImplication,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.futureActiveSuccessRules
    .fullUrlAvailability,
  "later_separately_reviewed_active_success_slice_after_final_approval_audited_reveal_browser_proof_log_proof_and_product_owner_checkpoint_only",
);
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.futureActiveSuccessRules
    .manualCopyAvailability,
  "later_separately_reviewed_post_success_slice_only",
);
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.futureActiveSuccessRules
    .automaticClipboardWrite,
  "forbidden",
);
assert.equal(
  responseLinkProductActionDisabledResultStatePolicy.futureActiveSuccessRules
    .delivery,
  "forbidden",
);
for (const requiredResultStateFalseFlag of [
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE",
  "ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultStatePolicy.activeFlagsThatMustRemainFalse.includes(
      requiredResultStateFalseFlag,
    ),
  );
}
const otherwiseReadyDisabledResultState =
  evaluateResponseLinkProductActionDisabledResultStateReadiness({
    routeReviewedForDisabledResultState: true,
    dynamicNoStoreProven: true,
    persistedContextOnlyProven: true,
    serverActionStubResultSourceProven: true,
    credentialFreeResultStatesProven: true,
    nonDisclosingCopyProven: true,
    forbiddenFieldsProven: true,
    productOwnerApproved: true,
  });
assert.equal(otherwiseReadyDisabledResultState.allowed, false);
for (const requiredDisabledResultStateBlocker of [
  "disabled_result_renderer_implementation_unavailable",
  "active_result_renderer_implementation_unavailable",
  "route_server_action_implementation_unavailable",
  "final_approval_unavailable",
  "active_response_link_reveal_unavailable",
  "active_response_link_copy_unavailable",
  "product_action_ui_implementation_unavailable",
  "copy_affordance_unavailable",
  "product_surface_implementation_unavailable",
  "reveal_product_surface_unavailable",
  "assignment_detail_navigation_linkage_unavailable",
]) {
  assert.ok(
    otherwiseReadyDisabledResultState.blockers.includes(
      requiredDisabledResultStateBlocker,
    ),
  );
}

const disabledResultRendererDescription =
  describeResponseLinkProductActionDisabledResultRendererPolicy();
assert.equal(disabledResultRendererDescription.contractAvailable, true);
assert.equal(
  disabledResultRendererDescription.disabledResultStateContractAvailable,
  true,
);
assert.equal(
  disabledResultRendererDescription.disabledResultRendererImplementationAvailable,
  false,
);
assert.equal(
  disabledResultRendererDescription.activeResultRendererImplementationAvailable,
  false,
);
assert.equal(
  disabledResultRendererDescription.activeSuccessRendererImplementationAvailable,
  false,
);
assert.equal(
  disabledResultRendererDescription.routeServerActionImplementationAvailable,
  false,
);
assert.equal(disabledResultRendererDescription.finalApprovalAvailable, false);
assert.equal(disabledResultRendererDescription.activeRevealAvailable, false);
assert.equal(disabledResultRendererDescription.activeCopyAvailable, false);
assert.equal(disabledResultRendererDescription.activeEntryLinkingAvailable, false);
assert.equal(
  disabledResultRendererDescription.productActionUiImplementationAvailable,
  false,
);
assert.equal(disabledResultRendererDescription.copyAffordanceAvailable, false);
assert.equal(
  disabledResultRendererDescription.productSurfaceImplementationAvailable,
  false,
);
assert.equal(disabledResultRendererDescription.revealProductSurfaceAvailable, false);
assert.equal(disabledResultRendererDescription.assignmentDetailNavigationLinked, false);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.eligibleRoute,
  "/admin/assignments/[assignmentId]",
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.currentStatus,
  "disabled_result_renderer_contract_only_route_unused",
);
assert.deepEqual(
  responseLinkProductActionDisabledResultRendererPolicy.routeRequirements.rendering,
  ["dynamic", "no_store"],
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.routeRequirements.dataBoundary,
  "readAssignmentDetailContext_only",
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.routeRequirements
    .assignmentDataReader,
  "readAssignmentDetailContext",
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.rendererInputRules.source,
  "already_sanitized_disabled_error_like_state_from_11_48_disabled_result_state_contract_only",
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.rendererInputRules
    .mustNotCallServerAction,
  true,
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.rendererInputRules
    .fixedAllowlistedCopyMap,
  "required_keyed_by_safe_state_codes_only",
);
for (const forbiddenRendererInput of [
  "rawActionResultsFromUnreviewedSources",
  "arbitraryErrorStrings",
  "stackTraces",
  "providerPayloads",
  "supabaseErrorObjects",
  "rpcExceptions",
  "thrownExceptions",
]) {
  assert.equal(
    responseLinkProductActionDisabledResultRendererPolicy.rendererInputRules[
      forbiddenRendererInput
    ],
    "forbidden",
  );
}
for (const allowedRendererStateCode of [
  "disabled",
  "not_approved",
  "checklist_blocked",
  "malformed_input",
  "unavailable",
  "action_error",
  "impossible_success_reduced_to_disabled",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultRendererPolicy.allowedStateCodes.includes(
      allowedRendererStateCode,
    ),
  );
}
for (const prohibitedRendererRouteImport of [
  "createAssignmentDetailResponseLinkDisabledAdapter",
  "createAssignmentDetailResponseLinkProductAction",
  "createAuditedAssignmentResponseLinkReveal",
  "reveal_assignment_response_link",
  "replace_assignment_response_token",
  "replaceAssignmentResponseToken",
  "recordAssignmentResponseLinkRevealAudit",
  "issueAssignmentResponseLink",
  "assignment_response_tokens",
  "token_table_read",
  "direct_supabase_mutation_helper",
  "diagnostic_response_link_dependency",
  "service_role_client",
  "detailRouteEntryPolicy",
  "detailResponseLinkEnablementChecklist",
  "productActionServerActionPolicy",
  "productActionDisabledRouteWiringPolicy",
  "productActionDisabledRouteActionBindingPolicy",
  "productActionDisabledResultStatePolicy",
  "productActionDisabledResultRendererPolicy",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultRendererPolicy.routeImportRules.prohibitedDirectRouteImportsOrCalls.includes(
      prohibitedRendererRouteImport,
    ),
  );
}
for (const prohibitedRendererAffordance of [
  "button",
  "link",
  "copy_affordance",
  "retry_affordance",
  "reveal_affordance",
  "download_affordance",
  "open_link_affordance",
  "email_affordance",
  "text_affordance",
  "send_affordance",
  "hidden_interactive_fallback",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultRendererPolicy.prohibitedRendererAffordances.includes(
      prohibitedRendererAffordance,
    ),
  );
}
for (const prohibitedRendererValue of [
  "generated_url_field",
  "url_shaped_string",
  "/respond/",
  "[redacted]",
  "bearer_like_value",
  "token_like_value",
  "hash_like_value",
  "audit_id",
  "diagnostic_id",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultRendererPolicy.prohibitedRendererValues.includes(
      prohibitedRendererValue,
    ),
  );
}
for (const prohibitedRendererHiddenMetadata of [
  "assignmentId",
  "expiresInHours",
  "actionMetadata",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "tokenId",
  "auditEventId",
  "bearer",
  "verifier",
  "workspaceId",
  "volunteerId",
  "actorId",
  "capabilities",
  "grant",
  "redirectPath",
  "returnPath",
  "copyMode",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultRendererPolicy.prohibitedHiddenMetadata.includes(
      prohibitedRendererHiddenMetadata,
    ),
  );
}
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.futureActiveSuccessRules
    .fullUrlRendererAvailability,
  "later_separately_reviewed_active_success_slice_after_final_approval_audited_reveal_browser_proof_log_proof_product_owner_checkpoint_and_explicit_copy_ui_review_only",
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.futureActiveSuccessRules
    .manualCopyAvailability,
  "later_separately_reviewed_post_success_slice_only",
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.futureActiveSuccessRules
    .automaticClipboardWrite,
  "forbidden",
);
assert.equal(
  responseLinkProductActionDisabledResultRendererPolicy.futureActiveSuccessRules
    .delivery,
  "forbidden",
);
for (const requiredResultRendererFalseFlag of [
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_SUCCESS_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE",
  "ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION",
]) {
  assert.ok(
    responseLinkProductActionDisabledResultRendererPolicy.activeFlagsThatMustRemainFalse.includes(
      requiredResultRendererFalseFlag,
    ),
  );
}
const otherwiseReadyDisabledResultRenderer =
  evaluateResponseLinkProductActionDisabledResultRendererReadiness({
    routeReviewedForDisabledResultRenderer: true,
    dynamicNoStoreProven: true,
    persistedContextOnlyProven: true,
    sanitizedResultStateInputProven: true,
    fixedCopyMapProven: true,
    rawErrorRenderingBlocked: true,
    noInteractiveAffordanceProven: true,
    noUrlOrTokenRenderingProven: true,
    productOwnerApproved: true,
  });
assert.equal(otherwiseReadyDisabledResultRenderer.allowed, false);
for (const requiredDisabledResultRendererBlocker of [
  "disabled_result_renderer_implementation_unavailable",
  "active_result_renderer_implementation_unavailable",
  "active_success_result_renderer_implementation_unavailable",
  "route_server_action_implementation_unavailable",
  "final_approval_unavailable",
  "active_response_link_reveal_unavailable",
  "active_response_link_copy_unavailable",
  "product_action_ui_implementation_unavailable",
  "copy_affordance_unavailable",
  "product_surface_implementation_unavailable",
  "reveal_product_surface_unavailable",
  "assignment_detail_navigation_linkage_unavailable",
]) {
  assert.ok(
    otherwiseReadyDisabledResultRenderer.blockers.includes(
      requiredDisabledResultRendererBlocker,
    ),
  );
}

const activationCheckpointDescription =
  describeResponseLinkProductActionActivationCheckpoint();
assert.equal(activationCheckpointDescription.checkpointAvailable, true);
assert.equal(activationCheckpointDescription.activationApproved, false);
assert.equal(activationCheckpointDescription.finalApprovalAvailable, false);
assert.equal(activationCheckpointDescription.assignmentDetailContextAvailable, true);
assert.equal(
  activationCheckpointDescription.assignmentDetailRouteImplementationAvailable,
  true,
);
assert.equal(
  activationCheckpointDescription.disabledActionBindingImplementationAvailable,
  true,
);
assert.equal(activationCheckpointDescription.serverActionStubAvailable, true);
assert.equal(activationCheckpointDescription.disabledResultStateContractAvailable, true);
assert.equal(
  activationCheckpointDescription.disabledResultRendererContractAvailable,
  true,
);
assert.equal(activationCheckpointDescription.routeServerActionImplementationAvailable, false);
assert.equal(
  activationCheckpointDescription.disabledResultRendererImplementationAvailable,
  false,
);
assert.equal(
  activationCheckpointDescription.activeResultRendererImplementationAvailable,
  false,
);
assert.equal(
  activationCheckpointDescription.activeSuccessRendererImplementationAvailable,
  false,
);
assert.equal(activationCheckpointDescription.activeRevealAvailable, false);
assert.equal(activationCheckpointDescription.activeCopyAvailable, false);
assert.equal(activationCheckpointDescription.activeEntryLinkingAvailable, false);
assert.equal(activationCheckpointDescription.productActionUiImplementationAvailable, false);
assert.equal(activationCheckpointDescription.copyAffordanceAvailable, false);
assert.equal(activationCheckpointDescription.productSurfaceImplementationAvailable, false);
assert.equal(activationCheckpointDescription.revealProductSurfaceAvailable, false);
assert.equal(activationCheckpointDescription.assignmentDetailNavigationLinked, false);
assert.equal(activationCheckpointDescription.deliveryAvailable, false);
assert.equal(activationCheckpointDescription.publicLookupAvailable, false);
assert.equal(activationCheckpointDescription.rememberedDeviceAvailable, false);
assert.equal(
  responseLinkProductActionActivationCheckpoint.eligibleFutureProductRevealSurface,
  "/admin/assignments/[assignmentId]",
);
assert.equal(
  responseLinkProductActionActivationCheckpoint.currentStatus,
  "checkpoint_only_activation_blocked",
);
assert.deepEqual(
  responseLinkProductActionActivationCheckpoint.routeRequirements.rendering,
  ["dynamic", "no_store"],
);
assert.equal(
  responseLinkProductActionActivationCheckpoint.routeRequirements.assignmentDataReader,
  "readAssignmentDetailContext",
);
assert.equal(
  responseLinkProductActionActivationCheckpoint.routeRequirements.futureActiveSurfaceScope,
  "assignment_detail_context_only",
);
for (const foundationGroup of [
  "persistenceAndReveal",
  "routeAndDisabledSeams",
  "guardrails",
]) {
  assert.ok(
    Object.hasOwn(responseLinkProductActionActivationCheckpoint.provenFoundations, foundationGroup),
  );
}
for (const provenFoundation of [
  "public_response_token_tables_and_rpcs_exist_and_were_locally_and_hosted_validated",
  "atomic_replacement_exists_and_was_hosted_validated",
  "reveal_audit_persistence_exists_and_was_hosted_validated",
  "transactional_audited_reveal_exists_and_was_hosted_validated",
  "persisted_assignment_detail_context_exists_and_was_hosted_validated",
]) {
  assert.ok(
    responseLinkProductActionActivationCheckpoint.provenFoundations.persistenceAndReveal.includes(
      provenFoundation,
    ),
  );
}
for (const provenFoundation of [
  "assignment_detail_route_exists_unlinked_dynamic_no_store_read_only_persisted",
  "assignment_detail_route_reads_only_readAssignmentDetailContext",
  "assignment_detail_route_has_exactly_one_route_derived_disabled_binding_to_11_41_stub",
  "disabled_server_action_stub_remains_disabled_by_default_and_credential_free",
  "disabled_result_state_policy_exists_and_remains_route_unused",
  "disabled_result_renderer_policy_exists_and_remains_route_unused",
]) {
  assert.ok(
    responseLinkProductActionActivationCheckpoint.provenFoundations.routeAndDisabledSeams.includes(
      provenFoundation,
    ),
  );
}
for (const provenFoundation of [
  "static_guards_prove_no_active_route_behavior",
  "browser_guards_prove_no_url_copy_result_renderer_form_hidden_metadata_or_delivery",
  "server_action_guards_prove_disabled_adapter_only_credential_free_behavior",
  "redirected_redacted_supabase_diagnostic_guardrail_remains_intact",
]) {
  assert.ok(
    responseLinkProductActionActivationCheckpoint.provenFoundations.guardrails.includes(
      provenFoundation,
    ),
  );
}
for (const remainingBlocker of [
  "explicit_product_owner_approval_and_final_approval_flag",
  "reviewed_active_server_action_implementation_decision",
  "reviewed_active_success_result_state_contract",
  "reviewed_active_success_renderer_contract",
  "reviewed_url_bearing_success_renderer_implementation",
  "reviewed_post_success_manual_copy_ui_implementation",
  "browser_proof_no_url_before_success_and_url_only_after_deliberate_action",
  "log_output_proof_no_full_url_bearer_verifier_token_id_audit_id_access_token_refresh_token_password_api_key_service_role_key_sql_detail_rpc_detail_sensitive_intake_emergency_contact_questionnaire_answer_raw_grant_capability_provider_dump_stack_trace_raw_exception_or_unrelated_row_leak",
  "no_prefetch_no_render_no_hover_no_focus_no_hydration_execution_proof",
  "unavailable_state_non_disclosure_proof",
  "product_entry_link_decision_from_persisted_authorized_contexts_only",
  "abuse_recovery_rate_limit_operational_policy_for_generated_links",
  "delivery_policy_separate_and_blocked",
  "public_lookup_separate_and_blocked",
  "remembered_devices_separate_and_blocked",
  "hosted_validation_only_if_db_rpc_generated_type_or_hosted_behavior_changes",
  "active_surface_remains_assignment_detail_context_only_with_trusted_server_origin",
]) {
  assert.ok(
    responseLinkProductActionActivationCheckpoint.remainingBlockersBeforeActiveReveal.includes(
      remainingBlocker,
    ),
  );
}
for (const safeNextOption of [
  "disabled_result_renderer_implementation_still_non_interactive_and_credential_free",
  "active_success_result_state_readiness_contract_still_route_unused",
  "active_success_renderer_readiness_contract_still_route_unused",
  "route_entry_link_readiness_re_review_from_persisted_calendar_volunteers_needs_attention_communications_contexts",
  "pause_response_link_work_and_return_to_higher_priority_mvp_scheduling_assignment_flows",
]) {
  assert.ok(
    responseLinkProductActionActivationCheckpoint.safeNextImplementationOptionsWithoutAuthorization.includes(
      safeNextOption,
    ),
  );
}
for (const currentNonNegotiable of [
  "no_active_reveal",
  "no_active_copy",
  "no_product_surface_availability",
  "no_navigation_entry_linkage",
  "no_delivery",
  "no_public_lookup",
  "no_remembered_device_behavior",
  "no_service_role_usage",
  "no_mock_to_real_mixing",
  "no_route_import_of_policy_checkpoint_modules",
  "no_direct_route_import_or_call_of_disabled_adapter_product_action_boundary_audited_reveal_rpc_token_helper_replacement_helper_diagnostic_helper_token_table_direct_supabase_helper_or_service_role_path",
]) {
  assert.ok(
    responseLinkProductActionActivationCheckpoint.currentNonNegotiables.includes(
      currentNonNegotiable,
    ),
  );
}
for (const requiredActivationFalseFlag of [
  "RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED",
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_SUCCESS_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE",
  "RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE",
  "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE",
  "ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION",
  "RESPONSE_LINK_PRODUCT_ACTION_DELIVERY_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_PUBLIC_LOOKUP_AVAILABLE",
  "RESPONSE_LINK_PRODUCT_ACTION_REMEMBERED_DEVICE_AVAILABLE",
]) {
  assert.ok(
    responseLinkProductActionActivationCheckpoint.activeFlagsThatMustRemainFalse.includes(
      requiredActivationFalseFlag,
    ),
  );
}
const activationCheckpointEvaluation =
  evaluateResponseLinkProductActionActivationCheckpoint();
assert.equal(activationCheckpointEvaluation.allowed, false);
for (const requiredActivationBlocker of [
  "activation_approval_unavailable",
  "final_approval_unavailable",
  "active_reveal_unavailable",
  "active_copy_unavailable",
  "route_server_action_implementation_unavailable",
  "disabled_result_renderer_implementation_unavailable",
  "active_result_renderer_implementation_unavailable",
  "active_success_result_renderer_implementation_unavailable",
  "product_action_ui_implementation_unavailable",
  "copy_affordance_unavailable",
  "product_surface_implementation_unavailable",
  "reveal_availability_unavailable",
  "entry_linkage_unavailable",
  "navigation_linkage_unavailable",
  "delivery_unavailable",
  "public_lookup_unavailable",
  "remembered_device_unavailable",
]) {
  assert.ok(activationCheckpointEvaluation.blockers.includes(requiredActivationBlocker));
}

async function exerciseAction(input, readContextResult, revealResult = undefined) {
  let readContextCalls = 0;
  let revealCalls = 0;
  let revealInput = null;
  const result = await createAssignmentDetailResponseLinkProductActionWithDependencies(input, {
    environment: { RESPONSE_LINK_BASE_URL: "https://preview.example.test" },
    readContext: async (request) => {
      readContextCalls += 1;
      assert.deepEqual(Object.keys(request), ["assignmentId"]);
      return readContextResult;
    },
    reveal: async (request) => {
      revealCalls += 1;
      revealInput = request;
      if (revealResult instanceof Error) throw revealResult;
      return (
        revealResult ?? {
          responseUrl: "[synthetic action response credential]",
          expiresAt: "2026-07-05T12:00:00.000Z",
        }
      );
    },
  });
  return { result, readContextCalls, revealCalls, revealInput };
}

const malformed = await exerciseAction(
  { assignmentId: exampleAssignmentId, workspaceId: "forbidden" },
  { assignmentId: exampleAssignmentId, canEditAssignment: true },
);
assert.deepEqual(malformed.result, { status: "invalid" });
assert.equal(malformed.readContextCalls, 0);
assert.equal(malformed.revealCalls, 0);

const missingContext = await exerciseAction({ assignmentId: exampleAssignmentId }, null);
assert.deepEqual(missingContext.result, { status: "unavailable" });
assert.equal(missingContext.readContextCalls, 1);
assert.equal(missingContext.revealCalls, 0);

const readOnlyContext = await exerciseAction(
  { assignmentId: exampleAssignmentId, expiresInHours: 24 },
  { assignmentId: exampleAssignmentId, canEditAssignment: false },
);
assert.deepEqual(readOnlyContext.result, { status: "unavailable" });
assert.equal(readOnlyContext.readContextCalls, 1);
assert.equal(readOnlyContext.revealCalls, 0);

const mismatchedContext = await exerciseAction(
  { assignmentId: exampleAssignmentId },
  {
    assignmentId: "22222222-2222-4222-8222-222222222222",
    canEditAssignment: true,
  },
);
assert.deepEqual(mismatchedContext.result, { status: "unavailable" });
assert.equal(mismatchedContext.revealCalls, 0);

const revealFailure = await exerciseAction(
  { assignmentId: exampleAssignmentId },
  { assignmentId: exampleAssignmentId, canEditAssignment: true },
  new Error("denied"),
);
assert.deepEqual(revealFailure.result, { status: "unavailable" });
assert.equal(revealFailure.revealCalls, 1);

const success = await exerciseAction(
  { assignmentId: exampleAssignmentId, expiresInHours: 72 },
  { assignmentId: exampleAssignmentId, canEditAssignment: true },
);
assert.equal(success.result.status, "issued");
assert.equal(success.result.expiresAt, "2026-07-05T12:00:00.000Z");
assert.equal(success.result.warning, ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_WARNING);
assert.equal(success.revealCalls, 1);
assert.deepEqual(success.revealInput, {
  assignmentId: exampleAssignmentId,
  expiresInHours: 72,
  revealMode: "copy_link",
  metadata: {
    reason_code: "assignment_detail_product_action",
    delivery_requested: false,
  },
  baseUrl: "https://preview.example.test",
});
assert.equal("responseTokenId" in success.result, false);
assert.equal("auditEventId" in success.result, false);
assert.equal("bearer" in success.result, false);

console.log("Persisted assignment-detail route shell checks passed.");
console.log("Confirmed one approved context importer, no inbound product links, and fail-closed product action boundary.");
