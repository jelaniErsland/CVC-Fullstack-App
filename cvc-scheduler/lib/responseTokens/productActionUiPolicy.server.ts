import "server-only";

export const RESPONSE_LINK_PRODUCT_ACTION_UI_CONTRACT_AVAILABLE = true;
export const RESPONSE_LINK_PRODUCT_ACTION_UI_READINESS_REVIEW_AVAILABLE = true;
export const RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE = false;
export const RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE = false;

export const responseLinkProductActionUiContract = {
  eligibleSurface: "/admin/assignments/[assignmentId]",
  eligibleContext: "persisted_assignment_detail_context_only",
  assignmentDataBoundary: "readAssignmentDetailContext_only",
  actionBoundary: "assignment_detail_product_action_server_boundary_only",
  currentRouteImport: "prohibited_until_reviewed_ui_slice",
  trigger: {
    required: "deliberate_click_or_tap",
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
  preActionDisclosure: [
    "warn_link_grants_response_access_for_this_assignment",
    "show_expiration_before_action",
    "state_no_email_or_reminder_is_sent",
    "state_manual_copy_available_only_after_audited_success",
  ],
  postSuccessDisplay: [
    "show_full_url_only_in_successful_explicit_action_response",
    "show_expiration_after_action",
    "repeat_assignment_specific_access_warning",
    "allow_manual_copy_only_after_success",
    "never_auto_copy_to_clipboard",
  ],
  fullCredentialLifetime: {
    allowedLocation: "successful_explicit_action_response_only",
    storage: "prohibited",
    logging: "prohibited",
    renderBeforeSuccess: "prohibited",
    errorState: "prohibited",
  },
  prohibitedErrorStateFields: [
    "fullResponseUrl",
    "rawBearer",
    "tokenVerifierHash",
    "responseTokenId",
    "auditEventId",
    "rawAuditData",
    "credential",
    "sqlDetail",
    "sensitiveFixtureValue",
    "accessToken",
    "refreshToken",
    "password",
    "apiKey",
    "serviceRoleKey",
  ],
  currentRouteRequirements: [
    "remain_dynamic_no_store",
    "remain_unlinked_from_product_navigation",
    "remain_read_only_until_reviewed_ui_slice",
    "read_assignment_data_only_through_readAssignmentDetailContext",
    "do_not_import_action_boundary_yet",
    "do_not_render_copy_or_reveal_control",
  ],
  prerequisitesBeforeUiAvailability: [
    "reviewed_route_action_wiring",
    "reviewed_warning_and_expiration_copy",
    "browser_proof_no_url_before_success",
    "browser_proof_no_get_render_prefetch_hover_focus_reveal",
    "browser_proof_manual_copy_after_success_only",
    "log_redaction_review",
    "explicit_product_owner_enablement",
  ],
} as const;

export type AssignmentDetailResponseLinkUiReadiness = Readonly<{
  reviewedRouteActionWiring: boolean;
  reviewedWarningAndExpirationCopy: boolean;
  noUrlBeforeSuccessProven: boolean;
  noImplicitRevealProven: boolean;
  manualCopyAfterSuccessOnlyProven: boolean;
  logRedactionReviewed: boolean;
  productOwnerApproved: boolean;
}>;

export function describeResponseLinkProductActionUiContract() {
  return {
    contractAvailable: RESPONSE_LINK_PRODUCT_ACTION_UI_CONTRACT_AVAILABLE,
    readinessReviewAvailable: RESPONSE_LINK_PRODUCT_ACTION_UI_READINESS_REVIEW_AVAILABLE,
    implementationAvailable: RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE,
    copyAffordanceAvailable: RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE,
    contract: responseLinkProductActionUiContract,
  } as const;
}

export function evaluateResponseLinkProductActionUiReadiness(
  readiness: AssignmentDetailResponseLinkUiReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.reviewedRouteActionWiring) blockers.push("route_action_wiring_missing");
  if (!readiness.reviewedWarningAndExpirationCopy) {
    blockers.push("warning_expiration_copy_missing");
  }
  if (!readiness.noUrlBeforeSuccessProven) {
    blockers.push("no_url_before_success_unproven");
  }
  if (!readiness.noImplicitRevealProven) {
    blockers.push("implicit_reveal_guard_unproven");
  }
  if (!readiness.manualCopyAfterSuccessOnlyProven) {
    blockers.push("manual_copy_after_success_unproven");
  }
  if (!readiness.logRedactionReviewed) blockers.push("log_redaction_review_missing");
  if (!readiness.productOwnerApproved) blockers.push("product_owner_approval_missing");
  if (!RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE) {
    blockers.push("product_action_ui_implementation_unavailable");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE) {
    blockers.push("copy_affordance_unavailable");
  }

  return { allowed: blockers.length === 0, blockers } as const;
}

export function getFutureResponseLinkProductActionUiRequirements() {
  return responseLinkProductActionUiContract.prerequisitesBeforeUiAvailability;
}
