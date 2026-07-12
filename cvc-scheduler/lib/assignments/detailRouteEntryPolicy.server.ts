import "server-only";

export const ASSIGNMENT_DETAIL_ROUTE_ENTRY_CONTRACT_AVAILABLE = true;
export const ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_CALENDAR_ENTRY_LINKAGE_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_VOLUNTEERS_ENTRY_LINKAGE_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_NEEDS_ATTENTION_ENTRY_LINKAGE_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_COMMUNICATIONS_ENTRY_LINKAGE_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_PUBLIC_VOLUNTEER_ENTRY_LINKAGE_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_RESPONSE_TOKEN_ROUTE_LINKAGE_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_DIAGNOSTIC_ROUTE_LINKAGE_AVAILABLE = false;

export const assignmentDetailRouteEntryContract = {
  routePathPattern: "/admin/assignments/[assignmentId]",
  routeRole: "secure_project_contact_direct_access_fallback",
  routeUxExpectation:
    "routine_assignment_details_should_remain_contextual_in_inspectors_drawers_or_modals",
  currentImplementation: "no_entry_points_link_to_route",
  futureEligibleEntrySurfaces: [
    {
      surface: "calendar_item_inspector_or_assignment_list_context",
      requirement: "assignment_id_derived_from_persisted_authorized_calendar_assignment",
    },
    {
      surface: "volunteer_profile_admin_assignment_context",
      requirement: "assignment_id_derived_from_persisted_authorized_volunteer_assignment",
    },
    {
      surface: "needs_attention_staffing_or_response_row",
      requirement: "assignment_id_derived_from_persisted_authorized_followup_row",
    },
    {
      surface: "communications_or_reminder_preview_context",
      requirement: "assignment_id_derived_from_persisted_authorized_message_context",
    },
  ],
  ineligibleEntrySurfaces: [
    "public_volunteer_routes",
    "/respond/[token]",
    "diagnostic_routes",
    "mock_only_routes",
    "anonymous_or_unauthenticated_pages",
    "browser_typed_arbitrary_assignment_id_surfaces",
    "broad_assignment_directory_or_search",
  ],
  futureEntryRequirements: [
    "derive_assignment_id_from_already_authorized_persisted_context",
    "link_only_to_existing_dynamic_no_store_assignment_detail_route",
    "preserve_non_disclosing_unavailable_state_for_stale_or_unauthorized_ids",
    "avoid_broad_assignment_directory_or_search_surface",
    "avoid_implying_volunteers_should_use_admin_route",
    "keep_entry_points_minimal_and_specific",
  ],
  hrefAllowedShape: {
    path: "/admin/assignments/[assignmentId]",
    query: "none",
    hash: "none",
  },
  hrefForbiddenData: [
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
  ],
  prerequisitesBeforeAnyEntryLink: [
    "source_route_uses_persisted_authorized_assignment_context",
    "source_route_has_no_mock_fallback_for_assignment_ids",
    "source_route_preserves_scope_without_href_query_data",
    "source_route_reviewed_for_non_disclosing_unavailable_fallback",
    "source_route_static_and_browser_linkage_guards_pass",
  ],
} as const;

export type AssignmentDetailRouteEntryReadiness = Readonly<{
  persistedAuthorizedSourceContext: boolean;
  noMockFallbackForAssignmentIds: boolean;
  hrefCarriesOnlyAssignmentPathSegment: boolean;
  unavailableFallbackReviewed: boolean;
  staticAndBrowserLinkageGuardsPassed: boolean;
  productOwnerApprovedEntrySurface: boolean;
}>;

export function describeAssignmentDetailRouteEntryContract() {
  return {
    contractAvailable: ASSIGNMENT_DETAIL_ROUTE_ENTRY_CONTRACT_AVAILABLE,
    implementationAvailable: ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE,
    calendarEntryLinkageAvailable: ASSIGNMENT_DETAIL_CALENDAR_ENTRY_LINKAGE_AVAILABLE,
    volunteersEntryLinkageAvailable: ASSIGNMENT_DETAIL_VOLUNTEERS_ENTRY_LINKAGE_AVAILABLE,
    needsAttentionEntryLinkageAvailable:
      ASSIGNMENT_DETAIL_NEEDS_ATTENTION_ENTRY_LINKAGE_AVAILABLE,
    communicationsEntryLinkageAvailable:
      ASSIGNMENT_DETAIL_COMMUNICATIONS_ENTRY_LINKAGE_AVAILABLE,
    publicVolunteerEntryLinkageAvailable:
      ASSIGNMENT_DETAIL_PUBLIC_VOLUNTEER_ENTRY_LINKAGE_AVAILABLE,
    responseTokenRouteLinkageAvailable:
      ASSIGNMENT_DETAIL_RESPONSE_TOKEN_ROUTE_LINKAGE_AVAILABLE,
    diagnosticRouteLinkageAvailable: ASSIGNMENT_DETAIL_DIAGNOSTIC_ROUTE_LINKAGE_AVAILABLE,
    contract: assignmentDetailRouteEntryContract,
  } as const;
}

export function evaluateAssignmentDetailRouteEntryReadiness(
  readiness: AssignmentDetailRouteEntryReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.persistedAuthorizedSourceContext) {
    blockers.push("persisted_authorized_source_context_missing");
  }
  if (!readiness.noMockFallbackForAssignmentIds) {
    blockers.push("mock_fallback_for_assignment_ids_unproven");
  }
  if (!readiness.hrefCarriesOnlyAssignmentPathSegment) {
    blockers.push("href_shape_not_limited_to_assignment_path_segment");
  }
  if (!readiness.unavailableFallbackReviewed) {
    blockers.push("unavailable_fallback_review_missing");
  }
  if (!readiness.staticAndBrowserLinkageGuardsPassed) {
    blockers.push("linkage_guards_missing");
  }
  if (!readiness.productOwnerApprovedEntrySurface) {
    blockers.push("product_owner_entry_surface_approval_missing");
  }
  if (!ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE) {
    blockers.push("assignment_detail_route_entry_implementation_unavailable");
  }

  return { allowed: blockers.length === 0, blockers } as const;
}

export function getFutureAssignmentDetailRouteEntryRequirements() {
  return assignmentDetailRouteEntryContract.prerequisitesBeforeAnyEntryLink;
}
