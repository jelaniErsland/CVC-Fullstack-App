import "server-only";

export const RESPONSE_LINK_PRODUCT_ACTION_WIRING_CONTRACT_AVAILABLE = true;
export const RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE = false;

export const responseLinkProductActionWiringContract = {
  eligibleRoute: "/admin/assignments/[assignmentId]",
  currentPanel: "11.34_inert_response_link_shell",
  routeDataBoundary: "readAssignmentDetailContext_only",
  actionBoundary: "createAssignmentDetailResponseLinkProductAction_only",
  currentRouteImport: "prohibited_until_reviewed_wiring_slice",
  routeRenderCredentialState: "credential_free",
  routeRenderMustRemain: [
    "dynamic_no_store",
    "read_only_before_explicit_post",
    "unlinked_from_product_navigation",
    "persisted_context_only",
    "no_url_on_initial_render",
    "no_credential_in_html",
  ],
  trigger: {
    required: ["explicit_click_or_tap", "POST", "server_action_only"],
    prohibited: [
      "render",
      "GET",
      "page_load",
      "prefetch",
      "hover",
      "focus",
      "automatic_effect",
    ],
  },
  browserAllowedInputs: ["assignmentId", "expiresInHours"],
  browserForbiddenInputs: [
    "workspaceId",
    "volunteerId",
    "actorId",
    "origin",
    "responseTokenId",
    "bearer",
    "fullResponseUrl",
    "redactedResponseUrl",
    "tokenVerifierHash",
    "auditMetadata",
    "copyMode",
    "capabilities",
  ],
  routeForbiddenImportsAndCalls: [
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
    "mock_data_fallback",
  ],
  actionCallRules: [
    "route_may_call_only_createAssignmentDetailResponseLinkProductAction",
    "do_not_call_audited_reveal_helper_directly_from_route",
    "do_not_call_reveal_rpc_directly_from_route",
    "do_not_read_token_tables_from_route",
    "do_not_manually_sequence_replacement_and_audit",
  ],
  fullUrlRules: {
    allowedLocation: "successful_explicit_action_response_only",
    prohibitedLocations: [
      "route_render",
      "GET_response",
      "prefetch_response",
      "initial_html",
      "error_state",
      "logs",
      "tests",
      "docs",
    ],
  },
  manualCopyRules: {
    availability: "post_success_only",
    automaticClipboardWrite: "prohibited",
    preSuccessCopyAffordance: "prohibited",
  },
  prohibitedErrorAndLogFields: [
    "fullResponseUrl",
    "rawBearer",
    "tokenVerifierHash",
    "responseTokenId",
    "auditInternals",
    "sqlDetail",
    "accessToken",
    "refreshToken",
    "password",
    "apiKey",
    "serviceRoleKey",
    "sensitiveIntakeData",
    "unrelatedRowData",
    "localOrHostedSecret",
  ],
  prerequisitesBeforeRouteWiring: [
    "reviewed_server_action_form_wiring",
    "browser_proof_no_url_on_render_get_prefetch",
    "browser_proof_post_success_only_url",
    "browser_proof_post_success_only_manual_copy",
    "log_redaction_guardrails",
    "explicit_product_owner_enablement",
  ],
} as const;

export type AssignmentDetailResponseLinkWiringReadiness = Readonly<{
  reviewedServerActionFormWiring: boolean;
  noUrlOnRenderGetPrefetchProven: boolean;
  postSuccessOnlyUrlProven: boolean;
  postSuccessOnlyManualCopyProven: boolean;
  logRedactionGuardrailsProven: boolean;
  productOwnerApproved: boolean;
}>;

export function describeResponseLinkProductActionWiringContract() {
  return {
    contractAvailable: RESPONSE_LINK_PRODUCT_ACTION_WIRING_CONTRACT_AVAILABLE,
    routeWiringImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE,
    contract: responseLinkProductActionWiringContract,
  } as const;
}

export function evaluateResponseLinkProductActionWiringReadiness(
  readiness: AssignmentDetailResponseLinkWiringReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.reviewedServerActionFormWiring) {
    blockers.push("reviewed_server_action_form_wiring_missing");
  }
  if (!readiness.noUrlOnRenderGetPrefetchProven) {
    blockers.push("no_url_on_render_get_prefetch_unproven");
  }
  if (!readiness.postSuccessOnlyUrlProven) {
    blockers.push("post_success_only_url_unproven");
  }
  if (!readiness.postSuccessOnlyManualCopyProven) {
    blockers.push("post_success_only_manual_copy_unproven");
  }
  if (!readiness.logRedactionGuardrailsProven) {
    blockers.push("log_redaction_guardrails_unproven");
  }
  if (!readiness.productOwnerApproved) {
    blockers.push("product_owner_approval_missing");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE) {
    blockers.push("product_action_route_wiring_implementation_unavailable");
  }

  return { allowed: blockers.length === 0, blockers } as const;
}

export function getFutureResponseLinkProductActionWiringRequirements() {
  return responseLinkProductActionWiringContract.prerequisitesBeforeRouteWiring;
}
