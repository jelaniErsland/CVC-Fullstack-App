import "server-only";

import {
  ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION,
} from "../assignments/detailRoutePolicy.server.ts";
import {
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
} from "../assignments/detailResponseLinkEnablementChecklist.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
} from "./productActionDisabledAdapter.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_CONTRACT_AVAILABLE,
} from "./productActionDisabledResultStatePolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE,
} from "./productActionServerActionPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE,
} from "./productActionUiPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE } from "./productSurfacePolicy.server.ts";
import { RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE } from "./revealPolicy.server.ts";

export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_CONTRACT_AVAILABLE =
  true;
export const RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_SUCCESS_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE =
  false;
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_ELIGIBLE_ROUTE =
  "/admin/assignments/[assignmentId]" as const;

export const responseLinkProductActionDisabledResultRendererPolicy = {
  eligibleRoute: RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_ELIGIBLE_ROUTE,
  currentStatus: "disabled_result_renderer_contract_only_route_unused",
  routeRequirements: {
    rendering: ["dynamic", "no_store"],
    dataBoundary: "readAssignmentDetailContext_only",
    assignmentDataReader: "readAssignmentDetailContext",
    unavailableState:
      "same_non_disclosing_unavailable_state_without_response_link_renderer_detail",
  },
  rendererInputRules: {
    source:
      "already_sanitized_disabled_error_like_state_from_11_48_disabled_result_state_contract_only",
    mustNotCallServerAction: true,
    rawActionResultsFromUnreviewedSources: "forbidden",
    arbitraryErrorStrings: "forbidden",
    stackTraces: "forbidden",
    providerPayloads: "forbidden",
    supabaseErrorObjects: "forbidden",
    rpcExceptions: "forbidden",
    thrownExceptions: "forbidden",
    fixedAllowlistedCopyMap:
      "required_keyed_by_safe_state_codes_only",
  },
  allowedStateCodes: [
    "disabled",
    "not_approved",
    "checklist_blocked",
    "malformed_input",
    "unavailable",
    "action_error",
    "impossible_success_reduced_to_disabled",
  ],
  routeImportRules: {
    prohibitedDirectRouteImportsOrCalls: [
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
    ],
  },
  copyRules: {
    tone: "credential_free_calm_generic_non_disclosing",
    allowedReferences: [
      "already_authorized_assignment_detail_context",
      "general_readiness_state",
    ],
    mustNotDistinguishContexts: [
      "unauthorized",
      "missing",
      "cross_workspace",
      "inactive",
      "canceled",
      "archived",
      "stale",
      "malformed",
      "unavailable",
    ],
    prohibitedImplications: [
      "usable_response_link_generated",
      "copying",
      "sending",
      "emailing",
      "texting",
      "delivering",
      "sharing",
      "opening",
      "testing_generated_link",
      "token_row_exists",
      "link_previously_generated",
      "token_is_active",
      "token_was_revoked",
      "volunteer_can_still_act_through_respond_token",
      "assignment_exists_outside_authorized_projection",
    ],
  },
  semanticsRules: {
    passiveStatusOrAlertSemantics: "allowed_only_when_not_success_generation",
    ariaLiveSuccessAnnouncementForLinkGeneration: "forbidden",
  },
  prohibitedRendererAffordances: [
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
  ],
  prohibitedRendererValues: [
    "generated_url_field",
    "url_shaped_string",
    "/respond/",
    "[redacted]",
    "bearer_like_value",
    "token_like_value",
    "hash_like_value",
    "audit_id",
    "diagnostic_id",
  ],
  prohibitedHiddenMetadata: [
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
  ],
  futureActiveSuccessRules: {
    fullUrlRendererAvailability:
      "later_separately_reviewed_active_success_slice_after_final_approval_audited_reveal_browser_proof_log_proof_product_owner_checkpoint_and_explicit_copy_ui_review_only",
    manualCopyAvailability:
      "later_separately_reviewed_post_success_slice_only",
    automaticClipboardWrite: "forbidden",
    delivery: "forbidden",
  },
  activeFlagsThatMustRemainFalse: [
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
  ],
} as const;

export type ResponseLinkProductActionDisabledResultRendererReadiness =
  Readonly<{
    routeReviewedForDisabledResultRenderer: boolean;
    dynamicNoStoreProven: boolean;
    persistedContextOnlyProven: boolean;
    sanitizedResultStateInputProven: boolean;
    fixedCopyMapProven: boolean;
    rawErrorRenderingBlocked: boolean;
    noInteractiveAffordanceProven: boolean;
    noUrlOrTokenRenderingProven: boolean;
    productOwnerApproved: boolean;
  }>;

export function describeResponseLinkProductActionDisabledResultRendererPolicy() {
  return {
    contractAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_CONTRACT_AVAILABLE,
    disabledResultStateContractAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_CONTRACT_AVAILABLE,
    disabledResultRendererImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
    activeResultRendererImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
    activeSuccessRendererImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_SUCCESS_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
    routeServerActionImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE,
    finalApprovalAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
    activeRevealAvailable: ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
    activeCopyAvailable: ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
    activeEntryLinkingAvailable:
      ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
    productActionUiImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE,
    copyAffordanceAvailable: RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE,
    productSurfaceImplementationAvailable:
      RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE,
    revealProductSurfaceAvailable: RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE,
    assignmentDetailNavigationLinked:
      ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION,
    policy: responseLinkProductActionDisabledResultRendererPolicy,
  } as const;
}

export function evaluateResponseLinkProductActionDisabledResultRendererReadiness(
  readiness: ResponseLinkProductActionDisabledResultRendererReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.routeReviewedForDisabledResultRenderer) {
    blockers.push("route_disabled_result_renderer_review_missing");
  }
  if (!readiness.dynamicNoStoreProven) blockers.push("dynamic_no_store_unproven");
  if (!readiness.persistedContextOnlyProven) {
    blockers.push("persisted_context_only_unproven");
  }
  if (!readiness.sanitizedResultStateInputProven) {
    blockers.push("sanitized_result_state_input_unproven");
  }
  if (!readiness.fixedCopyMapProven) {
    blockers.push("fixed_copy_map_unproven");
  }
  if (!readiness.rawErrorRenderingBlocked) {
    blockers.push("raw_error_rendering_block_unproven");
  }
  if (!readiness.noInteractiveAffordanceProven) {
    blockers.push("no_interactive_affordance_unproven");
  }
  if (!readiness.noUrlOrTokenRenderingProven) {
    blockers.push("no_url_or_token_rendering_unproven");
  }
  if (!readiness.productOwnerApproved) {
    blockers.push("product_owner_approval_missing");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE) {
    blockers.push("disabled_result_renderer_implementation_unavailable");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE) {
    blockers.push("active_result_renderer_implementation_unavailable");
  }
  if (
    !RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_SUCCESS_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE
  ) {
    blockers.push("active_success_result_renderer_implementation_unavailable");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE) {
    blockers.push("route_server_action_implementation_unavailable");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE) {
    blockers.push("final_approval_unavailable");
  }
  if (!ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE) {
    blockers.push("active_response_link_reveal_unavailable");
  }
  if (!ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE) {
    blockers.push("active_response_link_copy_unavailable");
  }
  if (!ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE) {
    blockers.push("active_response_link_entry_linking_unavailable");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE) {
    blockers.push("product_action_ui_implementation_unavailable");
  }
  if (!RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE) {
    blockers.push("copy_affordance_unavailable");
  }
  if (!RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE) {
    blockers.push("product_surface_implementation_unavailable");
  }
  if (!RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE) {
    blockers.push("reveal_product_surface_unavailable");
  }
  if (!ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION) {
    blockers.push("assignment_detail_navigation_linkage_unavailable");
  }

  return { allowed: blockers.length === 0, blockers } as const;
}

export function getFutureResponseLinkProductActionDisabledResultRendererRequirements() {
  return responseLinkProductActionDisabledResultRendererPolicy;
}
