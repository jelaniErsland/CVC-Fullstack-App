import "server-only";

export const FUTURE_RESPONSE_LINK_PRODUCT_SURFACE =
  "future_project_contact_assignment_response_reveal" as const;

export const RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE = false;

export const responseLinkProductSurfaceContract = {
  intendedLocation: "future_persisted_project_contact_assignment_detail_action",
  intendedAudience: "verified_project_contact",
  currentStatus: "planning_only_not_implemented",
  allowedRevealMode: "copy_link",
  requiredServerAction: {
    requestMethod: "POST",
    rendering: "dynamic_no_store",
    trigger: "explicit_user_action_only",
    credentialBoundary: "createAuditedAssignmentResponseLinkReveal_only",
    databaseCommand: "reveal_assignment_response_link",
    trustedOrigin: "server_configuration_only",
    credentialResponse: "same_explicit_action_response_only",
    getReveal: "prohibited",
    pageLoadReveal: "prohibited",
    prefetchReveal: "prohibited",
    manualReplacementAuditComposition: "prohibited",
  },
  browserAllowedInputs: ["assignmentId", "expiresInHours"],
  browserProhibitedInputs: [
    "workspaceId",
    "actorId",
    "volunteerId",
    "responseTokenId",
    "bearer",
    "responseUrl",
    "tokenVerifierHash",
    "origin",
    "revealMode",
    "auditMetadata",
  ],
  interactionRequirements: [
    "warn_link_grants_assignment_response_access",
    "show_expiration",
    "copy_only_after_audited_action_success",
    "never_write_clipboard_automatically",
    "never_reveal_on_render_or_prefetch",
  ],
  prohibitedVisibleData: [
    "raw_bearer_separately",
    "token_verifier_hash",
    "token_scope",
    "audit_internals",
    "volunteer_sensitive_profile_data",
    "questionnaire_answers",
    "emergency_contact",
  ],
  currentIneligibleSurfaces: [
    "admin_response_link_diagnostic",
    "mock_calendar_item_inspector",
    "mock_volunteer_profile",
    "mock_communications_preview",
    "needs_attention",
    "public_assignment_response",
    "public_volunteer_preview",
    "hosted_validation_gate",
  ],
  prerequisitesBeforeAvailability: [
    "persisted_project_contact_assignment_detail_context",
    "reviewed_post_only_no_store_server_action",
    "trusted_origin_configuration",
    "explicit_credential_reveal_interaction",
    "copy_warning_and_expiration_ui",
    "no_prefetch_or_automatic_reveal",
    "targeted_route_and_browser_regression_coverage",
    "security_and_logging_review",
  ],
  loggingPolicy: {
    rawBearer: "prohibited",
    fullResponseUrl: "prohibited",
    verifierHash: "prohibited",
    credentials: "prohibited",
    auditWrite: "transactionally_required_before_return",
  },
} as const;

export function describeResponseLinkProductSurfaceReadiness() {
  return {
    surface: FUTURE_RESPONSE_LINK_PRODUCT_SURFACE,
    available: RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE,
    contract: responseLinkProductSurfaceContract,
    nextSlice:
      "persisted_project_contact_assignment_detail_with_reviewed_post_only_reveal_action",
  } as const;
}

export function isResponseLinkProductSurfaceAvailable() {
  return false as const;
}

export function getFutureResponseLinkProductSurfaceRequirements() {
  return responseLinkProductSurfaceContract.prerequisitesBeforeAvailability;
}
