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
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_IMPLEMENTATION_AVAILABLE,
} from "./productActionDisabledRouteActionBindingPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE,
} from "./productActionServerActionPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE,
} from "./productActionServerAction.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE,
} from "./productActionUiPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE } from "./productSurfacePolicy.server.ts";
import { RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE } from "./revealPolicy.server.ts";

export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_CONTRACT_AVAILABLE =
  true;
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE =
  false;
export const RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE =
  false;
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_ELIGIBLE_ROUTE =
  "/admin/assignments/[assignmentId]" as const;

export const responseLinkProductActionDisabledResultStatePolicy = {
  eligibleRoute: RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_ELIGIBLE_ROUTE,
  currentStatus: "disabled_result_state_contract_only_route_unused",
  routeRequirements: {
    rendering: ["dynamic", "no_store"],
    dataBoundary: "readAssignmentDetailContext_only",
    assignmentDataReader: "readAssignmentDetailContext",
    unavailableState:
      "same_non_disclosing_unavailable_state_without_response_link_capability_detail",
  },
  resultSource: {
    allowedFutureResultSource:
      "createDisabledAssignmentResponseLinkServerAction_or_reviewed_successor",
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
    ],
  },
  allowedCurrentResultStates: [
    "disabled",
    "not_approved",
    "checklist_blocked",
    "malformed_input",
    "unavailable",
    "action_error",
    "impossible_success_reduced_to_disabled",
  ],
  prohibitedResultFields: [
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
  ],
  resultCopyRules: {
    nonDisclosingContexts: [
      "unavailable",
      "unauthorized",
      "cross_workspace",
      "inactive",
      "canceled",
      "archived",
      "missing",
      "malformed",
      "stale",
    ],
    allowedReferences: [
      "already_authorized_assignment_detail_context",
      "general_readiness_state",
    ],
    prohibitedImplications: [
      "usable_link_generated",
      "copying",
      "sending",
      "emailing",
      "texting",
      "delivering_link",
      "hidden_token_row_exists",
      "volunteer_can_still_act_through_respond_token",
      "distinguish_unauthorized_from_missing_cross_workspace_unavailable",
    ],
  },
  futureActiveSuccessRules: {
    fullUrlAvailability:
      "later_separately_reviewed_active_success_slice_after_final_approval_audited_reveal_browser_proof_log_proof_and_product_owner_checkpoint_only",
    manualCopyAvailability:
      "later_separately_reviewed_post_success_slice_only",
    automaticClipboardWrite: "forbidden",
    delivery: "forbidden",
  },
  activeFlagsThatMustRemainFalse: [
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
  ],
} as const;

export type ResponseLinkProductActionDisabledResultStateReadiness = Readonly<{
  routeReviewedForDisabledResultState: boolean;
  dynamicNoStoreProven: boolean;
  persistedContextOnlyProven: boolean;
  serverActionStubResultSourceProven: boolean;
  credentialFreeResultStatesProven: boolean;
  nonDisclosingCopyProven: boolean;
  forbiddenFieldsProven: boolean;
  productOwnerApproved: boolean;
}>;

export function describeResponseLinkProductActionDisabledResultStatePolicy() {
  return {
    contractAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_STATE_CONTRACT_AVAILABLE,
    disabledActionBindingImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_ACTION_BINDING_IMPLEMENTATION_AVAILABLE,
    disabledResultRendererImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
    activeResultRendererImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ACTIVE_RESULT_RENDERER_IMPLEMENTATION_AVAILABLE,
    serverActionStubAvailable: RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE,
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
    policy: responseLinkProductActionDisabledResultStatePolicy,
  } as const;
}

export function evaluateResponseLinkProductActionDisabledResultStateReadiness(
  readiness: ResponseLinkProductActionDisabledResultStateReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.routeReviewedForDisabledResultState) {
    blockers.push("route_disabled_result_state_review_missing");
  }
  if (!readiness.dynamicNoStoreProven) blockers.push("dynamic_no_store_unproven");
  if (!readiness.persistedContextOnlyProven) {
    blockers.push("persisted_context_only_unproven");
  }
  if (!readiness.serverActionStubResultSourceProven) {
    blockers.push("server_action_stub_result_source_unproven");
  }
  if (!readiness.credentialFreeResultStatesProven) {
    blockers.push("credential_free_result_states_unproven");
  }
  if (!readiness.nonDisclosingCopyProven) {
    blockers.push("non_disclosing_result_copy_unproven");
  }
  if (!readiness.forbiddenFieldsProven) {
    blockers.push("forbidden_result_fields_unproven");
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

export function getFutureResponseLinkProductActionDisabledResultStateRequirements() {
  return responseLinkProductActionDisabledResultStatePolicy;
}
