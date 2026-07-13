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
  RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE,
} from "./productActionServerActionPolicy.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED,
} from "./productActionServerAction.server.ts";
import {
  RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE,
  RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE,
} from "./productActionUiPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_ACTION_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE } from "./productActionWiringPolicy.server.ts";
import { RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE } from "./productSurfacePolicy.server.ts";
import { RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE } from "./revealPolicy.server.ts";

export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_CONTRACT_AVAILABLE =
  true;
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE =
  true;
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ROUTE_IMPORT_AVAILABLE =
  true;
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ELIGIBLE_ROUTE =
  "/admin/assignments/[assignmentId]" as const;

export const responseLinkProductActionDisabledRouteWiringPolicy = {
  eligibleRoute: RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ELIGIBLE_ROUTE,
  currentStatus: "disabled_route_import_without_form_or_action_binding",
  currentPanel: "11.34_inert_response_link_shell",
  routeImport: "prohibited_until_later_reviewed_disabled_wiring_slice",
  routeRequirements: {
    rendering: ["dynamic", "no_store"],
    dataBoundary: "readAssignmentDetailContext_only",
    unavailableState:
      "same_non_disclosing_unavailable_state_without_response_link_capability_detail",
    mockFallback: "forbidden",
  },
  invocationRules: {
    allowedTriggers: ["deliberate_submit", "deliberate_click", "deliberate_tap"],
    prohibitedTriggers: [
      "render",
      "GET",
      "page_load",
      "prefetch",
      "hover",
      "focus",
      "client_effect",
      "hydration",
      "unavailable_state_render",
    ],
  },
  inputRules: {
    assignmentIdSource:
      "same_dynamic_route_segment_or_reviewed_same_route_server_binding_only",
    assignmentIdBrowserSourcesProhibited: [
      "arbitrary_browser_typed_input",
      "hidden_metadata",
      "query_string",
      "hash",
    ],
    optionalBrowserControlledFields: ["expiresInHours"],
    ttlPolicy: "bounded_by_existing_response_link_product_ttl_policy",
    forbiddenBrowserFields: [
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
  routeActionBoundary: {
    allowedRouteCall: "createDisabledAssignmentResponseLinkServerAction",
    prohibitedDirectRouteCalls: [
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
    ],
  },
  disabledRenderingRules: {
    currentPanelState: "disabled_import_wiring_without_form_or_action_binding",
    futureDisabledPanelCopy:
      "response_link_generation_unavailable_until_later_reviewed_enablement",
    disabledAndErrorStates: [
      "disabled",
      "not_approved",
      "checklist_blocked",
      "malformed",
      "action_error",
      "unavailable",
    ],
    stateDisclosure: "non_disclosing_and_credential_free",
    prohibitedFields: [
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
    ],
  },
  futureActiveSuccessRules: {
    fullUrlAvailability:
      "later_reviewed_active_success_slice_after_audited_success_only",
    manualCopyAvailability: "later_reviewed_post_success_slice_only",
    automaticClipboardWrite: "forbidden",
  },
  navigationRules: {
    broadAssignmentDirectory: "forbidden",
    searchSurface: "forbidden",
    productNavigationLinkage: "unavailable",
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

export type ResponseLinkProductActionDisabledRouteWiringReadiness = Readonly<{
  routeReviewedForDisabledWiring: boolean;
  dynamicNoStoreProven: boolean;
  persistedContextOnlyProven: boolean;
  deliberateTriggerOnlyProven: boolean;
  noImplicitExecutionProven: boolean;
  routeDerivedAssignmentIdProven: boolean;
  browserInputShapeProven: boolean;
  serverActionStubOnlyProven: boolean;
  credentialFreeDisabledStatesProven: boolean;
  productOwnerApproved: boolean;
}>;

export function describeResponseLinkProductActionDisabledRouteWiringPolicy() {
  return {
    contractAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_CONTRACT_AVAILABLE,
    disabledRouteWiringImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE,
    disabledRouteWiringRouteImportAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_ROUTE_IMPORT_AVAILABLE,
    serverActionStubAvailable: RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE,
    serverActionStubRouteUnused:
      RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED,
    routeServerActionImplementationAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ROUTE_SERVER_ACTION_IMPLEMENTATION_AVAILABLE,
    finalApprovalAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
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
    policy: responseLinkProductActionDisabledRouteWiringPolicy,
  } as const;
}

export function evaluateResponseLinkProductActionDisabledRouteWiringReadiness(
  readiness: ResponseLinkProductActionDisabledRouteWiringReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.routeReviewedForDisabledWiring) {
    blockers.push("route_disabled_wiring_review_missing");
  }
  if (!readiness.dynamicNoStoreProven) blockers.push("dynamic_no_store_unproven");
  if (!readiness.persistedContextOnlyProven) {
    blockers.push("persisted_context_only_unproven");
  }
  if (!readiness.deliberateTriggerOnlyProven) {
    blockers.push("deliberate_trigger_only_unproven");
  }
  if (!readiness.noImplicitExecutionProven) {
    blockers.push("no_implicit_execution_unproven");
  }
  if (!readiness.routeDerivedAssignmentIdProven) {
    blockers.push("route_derived_assignment_id_unproven");
  }
  if (!readiness.browserInputShapeProven) {
    blockers.push("browser_input_shape_unproven");
  }
  if (!readiness.serverActionStubOnlyProven) {
    blockers.push("server_action_stub_only_unproven");
  }
  if (!readiness.credentialFreeDisabledStatesProven) {
    blockers.push("credential_free_disabled_states_unproven");
  }
  if (!readiness.productOwnerApproved) {
    blockers.push("product_owner_approval_missing");
  }
  if (
    !RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ROUTE_WIRING_IMPLEMENTATION_AVAILABLE
  ) {
    blockers.push("disabled_route_wiring_implementation_unavailable");
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

export function getFutureResponseLinkProductActionDisabledRouteWiringRequirements() {
  return responseLinkProductActionDisabledRouteWiringPolicy;
}
