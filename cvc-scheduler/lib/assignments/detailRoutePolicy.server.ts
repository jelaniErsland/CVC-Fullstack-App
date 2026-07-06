import "server-only";

export const ASSIGNMENT_DETAIL_ROUTE_CONTRACT_AVAILABLE = true;
export const ASSIGNMENT_DETAIL_ROUTE_IMPLEMENTATION_AVAILABLE = true;
export const ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION = false;

export const assignmentDetailRouteContract = {
  routeId: "persisted_project_contact_assignment_detail",
  routePathPattern: "/admin/assignments/[assignmentId]",
  eligibleCaller: "verified_project_contact_only",
  requiredCapability: "assignments.view",
  eligibleDataBoundary: "readAssignmentDetailContext_only",
  editReadiness: "can_edit_assignment_boolean_only",
  futureRevealAction: "unavailable_until_action_implementation_and_ui_reviewed",
  rendering: {
    dynamic: true,
    cache: "no_store",
    staticGeneration: "prohibited",
    secretActionPrefetch: "prohibited",
  },
  permittedFields: [
    "assignmentId",
    "assignmentLifecycle",
    "workspaceDisplayName",
    "taskTitle",
    "scheduleKind",
    "scheduledDate",
    "scheduledEndDate",
    "startTime",
    "endTime",
    "timezone",
    "plannedNeededCount",
    "volunteerDisplayName",
    "volunteerCongregation",
    "currentResponseStatus",
    "currentResponseSource",
    "currentResponseUpdatedAt",
    "canEditAssignment",
    "futureActionUnavailable",
  ],
  prohibitedFields: [
    "rawBearer",
    "fullResponseUrl",
    "redactedResponseUrl",
    "responseTokenId",
    "tokenVerifierHash",
    "tokenScope",
    "accessToken",
    "refreshToken",
    "password",
    "apiKey",
    "serviceRoleKey",
    "emergencyContact",
    "questionnaireAnswers",
    "sensitiveIntakeData",
    "capabilities",
    "grant",
    "unrelatedAssignments",
    "unrelatedVolunteers",
    "auditInternals",
  ],
  prohibitedRouteBehavior: [
    "direct_reveal_assignment_response_link_rpc",
    "direct_assignment_response_token_read",
    "service_role_access",
    "mock_data_fallback",
    "mock_and_persisted_data_mixing",
    "prefetch_triggered_secret_action",
    "manual_token_replacement_audit_sequence",
  ],
  unavailableState: {
    appliesTo: [
      "missing",
      "unauthorized",
      "cross_workspace",
      "canceled",
      "archived",
      "inactive",
      "unavailable",
    ],
    presentation: "same_calm_unavailable_state",
    existenceLeak: "prohibited",
    sqlDetails: "prohibited",
    internalScope: "prohibited",
    credentialValues: "prohibited",
  },
  currentIneligibleRoutes: [
    "/admin/calendar",
    "/admin/volunteers",
    "/admin/needs-attention",
    "/admin/announcements",
    "/admin/diagnostics/response-link",
    "/respond/[token]",
    "/v/demo",
    "hosted_validation_scripts",
    "all_mock_prototype_routes",
  ],
  prerequisitesBeforeImplementation: [
    "reviewed_unlinked_dynamic_assignment_detail_route_shell",
    "readAssignmentDetailContext_only_data_access",
    "uniform_unavailable_state",
    "no_mock_fallback_or_data_mixing",
    "route_import_and_cache_regression_checks",
  ],
  prerequisitesBeforeProductNavigationLinks: [
    "persisted_route_shell_reviewed",
    "loading_missing_unauthorized_inactive_states_reviewed",
    "calendar_entrypoint_cutover_reviewed_separately",
    "volunteer_entrypoint_cutover_reviewed_separately",
    "needs_attention_entrypoint_cutover_reviewed_separately",
    "communications_entrypoint_reviewed_separately",
  ],
} as const;

export type AssignmentDetailRouteReadiness = Readonly<{
  unlinkedRouteShellReviewed: boolean;
  persistedContextOnly: boolean;
  dynamicNoStoreProven: boolean;
  uniformUnavailableStateProven: boolean;
  noExistenceLeakProven: boolean;
  noMockFallbackProven: boolean;
  importAndCacheChecksProven: boolean;
}>;

export function describeAssignmentDetailRouteContract() {
  return {
    contractAvailable: ASSIGNMENT_DETAIL_ROUTE_CONTRACT_AVAILABLE,
    implementationAvailable: ASSIGNMENT_DETAIL_ROUTE_IMPLEMENTATION_AVAILABLE,
    linkedFromProductNavigation: ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION,
    contract: assignmentDetailRouteContract,
  } as const;
}

export function evaluateAssignmentDetailRouteReadiness(
  readiness: AssignmentDetailRouteReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.unlinkedRouteShellReviewed) blockers.push("unlinked_route_shell_missing");
  if (!readiness.persistedContextOnly) blockers.push("persisted_context_only_unproven");
  if (!readiness.dynamicNoStoreProven) blockers.push("dynamic_no_store_unproven");
  if (!readiness.uniformUnavailableStateProven) {
    blockers.push("uniform_unavailable_state_unproven");
  }
  if (!readiness.noExistenceLeakProven) blockers.push("no_existence_leak_unproven");
  if (!readiness.noMockFallbackProven) blockers.push("no_mock_fallback_unproven");
  if (!readiness.importAndCacheChecksProven) {
    blockers.push("route_import_cache_checks_unproven");
  }
  if (!ASSIGNMENT_DETAIL_ROUTE_IMPLEMENTATION_AVAILABLE) {
    blockers.push("assignment_detail_route_implementation_unavailable");
  }

  return { allowed: blockers.length === 0, blockers } as const;
}

export function getFutureAssignmentDetailRouteRequirements() {
  return assignmentDetailRouteContract.prerequisitesBeforeImplementation;
}
