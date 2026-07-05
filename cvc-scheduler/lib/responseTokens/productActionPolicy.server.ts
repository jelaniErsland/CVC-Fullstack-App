import "server-only";

export const RESPONSE_LINK_PRODUCT_ACTION_CONTRACT_AVAILABLE = true;
export const RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE = false;
export const RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE = false;

export const responseLinkProductActionContract = {
  eligibleSurface: "future_project_contact_assignment_response_reveal",
  eligibleContext: "persisted_assignment_detail_context_only",
  intendedAction: "future_project_contact_copy_assignment_response_link",
  request: {
    method: "POST",
    rendering: "dynamic_no_store",
    trigger: "explicit_user_action_only",
    prefetch: "prohibited",
    pageLoadExecution: "prohibited",
    getExecution: "prohibited",
  },
  browserAllowedInputs: ["assignmentId", "expiresInHours"],
  browserForbiddenInputs: [
    "workspaceId",
    "volunteerId",
    "actorId",
    "responseId",
    "responseTokenId",
    "bearer",
    "responseUrl",
    "redactedUrl",
    "tokenVerifierHash",
    "origin",
    "copyMode",
    "auditMetadata",
    "grant",
    "capabilities",
  ],
  requiredServerSequence: [
    "verify_project_contact_session",
    "read_assignment_detail_context_first",
    "require_context_can_edit_assignment",
    "use_server_configured_response_link_origin",
    "call_createAuditedAssignmentResponseLinkReveal_once",
    "return_credential_only_in_successful_explicit_action_response",
  ],
  prohibitedServerBehavior: [
    "manual_token_replacement_then_audit_sequence",
    "direct_reveal_assignment_response_link_rpc_from_route",
    "token_table_read",
    "credential_logging",
    "credential_persistence_outside_verifier_and_audit_tables",
    "credential_in_error_response",
    "sql_detail_in_user_copy",
  ],
  successResponseRequirements: [
    "full_response_url",
    "expiration",
    "credential_access_warning",
  ],
  futureUiRequirements: [
    "warn_link_grants_response_access_for_assignment",
    "show_expiration",
    "require_explicit_click_or_tap",
    "no_clipboard_write_before_audited_success",
    "manual_copy_only_from_success_response",
    "no_email_or_reminder_delivery",
    "no_communications_integration",
  ],
  failureBehavior: [
    "safe_unavailable_state",
    "no_assignment_existence_leak",
    "no_token_or_audit_mutation_when_denied",
    "no_full_url_in_error_state",
    "no_internal_sql_detail",
  ],
  prerequisitesBeforeEnablement: [
    "persisted_assignment_detail_route_surface",
    "reviewed_post_only_server_action_implementation",
    "reviewed_warning_and_expiration_ui",
    "proven_dynamic_no_store_and_no_prefetch",
    "proven_log_redaction_and_static_guards",
    "browser_tests_prove_no_url_before_success",
    "product_owner_explicit_enablement_approval",
  ],
} as const;

export type ResponseLinkProductActionReadiness = Readonly<{
  persistedAssignmentDetailSurface: boolean;
  reviewedPostOnlyAction: boolean;
  reviewedWarningAndExpirationUi: boolean;
  dynamicNoStoreProven: boolean;
  noPrefetchProven: boolean;
  logRedactionProven: boolean;
  noCredentialBeforeSuccessProven: boolean;
  productOwnerApproved: boolean;
}>;

export function describeResponseLinkProductActionContract() {
  return {
    contractAvailable: RESPONSE_LINK_PRODUCT_ACTION_CONTRACT_AVAILABLE,
    implementationAvailable: RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE,
    uiAvailable: RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE,
    contract: responseLinkProductActionContract,
  } as const;
}

export function evaluateResponseLinkProductActionReadiness(
  readiness: ResponseLinkProductActionReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.persistedAssignmentDetailSurface) {
    blockers.push("persisted_assignment_detail_surface_missing");
  }
  if (!readiness.reviewedPostOnlyAction) blockers.push("reviewed_post_action_missing");
  if (!readiness.reviewedWarningAndExpirationUi) {
    blockers.push("reviewed_warning_expiration_ui_missing");
  }
  if (!readiness.dynamicNoStoreProven) blockers.push("dynamic_no_store_unproven");
  if (!readiness.noPrefetchProven) blockers.push("no_prefetch_unproven");
  if (!readiness.logRedactionProven) blockers.push("log_redaction_unproven");
  if (!readiness.noCredentialBeforeSuccessProven) {
    blockers.push("credential_before_success_guard_unproven");
  }
  if (!readiness.productOwnerApproved) blockers.push("product_owner_approval_missing");
  if (!RESPONSE_LINK_PRODUCT_ACTION_IMPLEMENTATION_AVAILABLE) {
    blockers.push("product_action_implementation_unavailable");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_UI_AVAILABLE) {
    blockers.push("product_action_ui_unavailable");
  }

  return { allowed: blockers.length === 0, blockers } as const;
}

export function getFutureResponseLinkProductActionRequirements() {
  return responseLinkProductActionContract.prerequisitesBeforeEnablement;
}
