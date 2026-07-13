import "server-only";

import {
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
  ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE,
} from "../assignments/detailResponseLinkEnablementChecklist.server.ts";
import { ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION } from "../assignments/detailRoutePolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
} from "./productActionDisabledAdapter.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE,
} from "./productActionUiPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE } from "./productActionWiringPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE } from "./productSurfacePolicy.server.ts";
import { RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE } from "./revealPolicy.server.ts";

export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_SHAPE_CONTRACT_AVAILABLE =
  true;
export const RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE =
  false;
export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ELIGIBLE_ROUTE =
  "/admin/assignments/[assignmentId]" as const;

export const responseLinkProductActionServerActionPolicy = {
  eligibleRoute: RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ELIGIBLE_ROUTE,
  currentStatus: "contract_only_route_unused_non_executable",
  currentRouteImport: "prohibited_until_reviewed_wiring_slice",
  executableActionInThisSlice: false,
  methodShape: {
    required: ["explicit_server_action", "POST", "same_route_assignment_context"],
    trigger: ["deliberate_submit", "deliberate_click", "deliberate_tap"],
    prohibited: [
      "render",
      "GET",
      "page_load",
      "prefetch",
      "hover",
      "focus",
      "client_effect",
      "hydration",
    ],
  },
  inputShape: {
    assignmentIdSource: "route_context_or_reviewed_same_route_binding_only",
    browserAllowedInputs: ["assignmentId", "expiresInHours"],
    futureFormDataAllowedFields: ["expiresInHours", "control"],
    browserForbiddenInputs: [
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
    ],
  },
  actionBoundary: {
    allowed: [
      "createAssignmentDetailResponseLinkDisabledAdapter",
      "reviewed_active_successor_adapter",
    ],
    prohibited: [
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
    ],
    serverSideRechecks: [
      "enablement_checklist",
      "final_approval",
      "route_context_assignment_id",
    ],
  },
  resultShape: {
    credentialFreeStates: [
      "disabled",
      "unavailable",
      "not_approved",
      "checklist_blocked",
      "malformed",
      "action_error",
    ],
    prohibitedErrorAndLogFields: [
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
    ],
    existenceLeakPolicy: "do_not_distinguish_sensitive_existence_or_capability_internals",
  },
  fullUrlRules: {
    allowedLocation:
      "successful_explicit_action_response_after_audited_success_in_later_active_slice_only",
    prohibitedLocations: [
      "route_render",
      "GET_response",
      "page_load",
      "prefetch_response",
      "initial_html",
      "disabled_state",
      "error_state",
      "logs",
    ],
  },
  copyRules: {
    manualCopyAvailability: "after_successful_explicit_action_response_only",
    automaticClipboardWrite: "forbidden",
    preSuccessCopyAffordance: "forbidden",
  },
  activeFlagsThatMustRemainFalse: [
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
  ],
} as const;

export type ResponseLinkProductActionServerActionReadiness = Readonly<{
  routeReviewedForServerAction: boolean;
  explicitPostOnlyProven: boolean;
  noRenderGetPrefetchRevealProven: boolean;
  browserInputShapeProven: boolean;
  adapterBoundaryOnlyProven: boolean;
  credentialFreeDisabledAndErrorStatesProven: boolean;
  productOwnerApproved: boolean;
}>;

export function describeResponseLinkProductActionServerActionPolicy() {
  return {
    contractAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_SHAPE_CONTRACT_AVAILABLE,
    routeServerActionImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE,
    disabledAdapterAvailable: RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE,
    finalApprovalAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
    enablementChecklistAvailable:
      ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE,
    activeRevealAvailable: ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
    activeCopyAvailable: ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
    activeEntryLinkingAvailable:
      ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
    routeWiringImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE,
    productActionUiImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE,
    copyAffordanceAvailable: RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE,
    productSurfaceImplementationAvailable:
      RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE,
    revealProductSurfaceAvailable: RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE,
    assignmentDetailNavigationLinked:
      ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION,
    policy: responseLinkProductActionServerActionPolicy,
  } as const;
}

export function evaluateResponseLinkProductActionServerActionReadiness(
  readiness: ResponseLinkProductActionServerActionReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.routeReviewedForServerAction) {
    blockers.push("route_server_action_review_missing");
  }
  if (!readiness.explicitPostOnlyProven) {
    blockers.push("explicit_post_server_action_unproven");
  }
  if (!readiness.noRenderGetPrefetchRevealProven) {
    blockers.push("no_render_get_prefetch_reveal_unproven");
  }
  if (!readiness.browserInputShapeProven) {
    blockers.push("browser_input_shape_unproven");
  }
  if (!readiness.adapterBoundaryOnlyProven) {
    blockers.push("adapter_boundary_only_unproven");
  }
  if (!readiness.credentialFreeDisabledAndErrorStatesProven) {
    blockers.push("credential_free_disabled_and_error_states_unproven");
  }
  if (!readiness.productOwnerApproved) {
    blockers.push("product_owner_approval_missing");
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
  if (!RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE) {
    blockers.push("route_wiring_implementation_unavailable");
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

export function getFutureResponseLinkProductActionServerActionRequirements() {
  return responseLinkProductActionServerActionPolicy;
}
