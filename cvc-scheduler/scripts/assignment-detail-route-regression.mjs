import assert from "node:assert/strict";
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

assert.match(routeSource, /export const dynamic = "force-dynamic"/);
assert.match(routeSource, /export const revalidate = 0/);
assert.match(routeSource, /export const fetchCache = "force-no-store"/);
assert.doesNotMatch(routeSource, /generateStaticParams/);
assert.match(
  routeSource,
  /import \{ readAssignmentDetailContext \} from "@\/lib\/assignments\/detailContext\.server"/,
);
assert.match(routeSource, /readAssignmentDetailContext\(\{\s*assignmentId:/s);
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
assert.doesNotMatch(routeSource, /AdminShell|mockData|volunteerPreview/);
assert.doesNotMatch(routeSource, /@\/lib\/responseTokens\//);
assert.doesNotMatch(
  routeSource,
  /createAssignmentDetailResponseLinkProductAction|productAction|productActionUi|productActionWiring|detailRouteEntryPolicy|assignmentDetailRouteEntry|detailResponseLinkEnablementChecklist|assignmentDetailResponseLinkEnablement|createAuditedAssignmentResponseLinkReveal|issueAssignmentResponseLink|replaceAssignmentResponseToken|recordAssignmentResponseLinkRevealAudit|reveal_assignment_response_link|read_assignment_detail_context|assignment_response_tokens|\.rpc\(|\.from\(/,
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
  /<form\b|<button\b|formAction|type=["']submit["']|type=["']hidden["']|onClick=|useActionState|useFormStatus|useTransition/,
);

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
assert.match(productActionUiPolicySource, /status: "visible_but_inert"/);
assert.match(productActionUiPolicySource, /future_link_grants_response_access_for_this_assignment/);
assert.match(productActionUiPolicySource, /future_link_will_expire/);
assert.match(productActionUiPolicySource, /future_action_requires_explicit_click_or_tap/);
assert.match(productActionUiPolicySource, /manual_copy_after_audited_success_only/);
assert.match(productActionUiPolicySource, /server_action_binding/);
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
    /createAssignmentDetailResponseLinkProductAction|productActionUiPolicy|productActionWiringPolicy|detailRouteEntryPolicy|assignmentDetailRouteEntry|detailResponseLinkEnablementChecklist|assignmentDetailResponseLinkEnablement|createAuditedAssignmentResponseLinkReveal|reveal_assignment_response_link|assignment_response_tokens|navigator\.clipboard|clipboard\.writeText|Copy response link|Copy full link|Generate link|Reveal link|fullResponseUrl|responseUrl|responseTokenId|tokenVerifierHash|bearerToken|rawBearer/i.test(
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
assert.deepEqual(unsafeCurrentRouteOrComponentUi, []);
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
assert.equal(responseLinkProductActionUiContract.currentInertShell.status, "visible_but_inert");
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
  "server_action_binding",
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
