import "server-only";

import {
  CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED,
  CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED,
  CALENDAR_READ_MODEL_QUERY_HELPER_SERVICE_ROLE_AVAILABLE,
  CALENDAR_READ_MODEL_QUERY_SELECTORS,
} from "./readModelQuery.server.ts";

export const CALENDAR_ROUTE_CUTOVER_READINESS_REVIEW_AVAILABLE = true;
export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED = false;
export const CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER = false;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED = false;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE = false;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE = false;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE = false;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED = false;
export const CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE = false;
export const CALENDAR_REMINDER_DELIVERY_AVAILABLE = false;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE =
  CALENDAR_READ_MODEL_QUERY_HELPER_SERVICE_ROLE_AVAILABLE;
export const CALENDAR_SEED_DATA_AVAILABLE = false;
export const CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE = false;

export const CALENDAR_ROUTE_CUTOVER_ELIGIBLE_ROUTE = "/admin/calendar" as const;
export const CALENDAR_ROUTE_CUTOVER_NEXT_RECOMMENDED_SLICE =
  "12.8 Calendar Route Cutover Dry-Run Harness" as const;

export const calendarRouteCutoverRenderingConstraints = {
  eligibleRoute: CALENDAR_ROUTE_CUTOVER_ELIGIBLE_ROUTE,
  routeMustBeDynamicNoStoreWhenPersisted: true,
  persistedReadExecution: "server_boundary_only",
  clientSupabaseForProductCalendarDataAllowed: false,
  browserProvidedWorkspaceIdTrusted: false,
  browserProvidedCapabilitiesTrusted: false,
  browserProvidedActorIdTrusted: false,
  browserProvidedSelectorTrusted: false,
  contextSource:
    "reviewed_authenticated_server_helpers_for_workspace_contact_capabilities_and_timezone",
  routeMayCallOnly: "reviewed_server_only_calendar_read_seams",
  routeMayCallFromDirectly: false,
  routeMayCallRpcDirectly: false,
  serviceRoleAllowed: false,
  broadTableQueriesAllowed: false,
  rawErrorRenderingAllowed: false,
  secretOrInternalPolicyRenderingAllowed: false,
} as const;

export const calendarRouteCutoverRequiredDataPath = [
  "verified_project_contact_session",
  "active_workspace_contact_grant_resolution",
  "calendar.view_capability",
  "assignments.view_capability_for_coverage_bearing_output",
  "trusted_workspace_id",
  "trusted_contact_actor_id",
  "trusted_workspace_timezone",
  "server_derived_explicit_bounded_calendar_period_range",
  "12.6_dependency_injected_query_helper_or_reviewed_successor",
  "12.3_pure_read_model_projection_or_reviewed_successor",
] as const;

export const calendarRouteCutoverRangeAndPeriodRules = {
  supportedPeriods: ["day", "week", "month", "list"],
  everyPeriodResolvesToExplicitBoundedDateRange: true,
  unboundedWorkspaceWideReadsAllowed: false,
  arbitraryRouteProvidedRangeAllowedWithoutServerValidation: false,
  endMustBeAfterStart: true,
  mustObeyHelperBoundedRangePolicy: true,
  timezoneSource: "trusted_workspace_data_not_browser_input",
  emptyRangeOrNoItemsStateRequired: true,
} as const;

export const calendarRouteCutoverCapabilityRules = {
  missingAuthBehavior: "reviewed_admin_auth_redirect_or_unauthenticated_state",
  missingWorkspaceContactGrantFailsClosed: true,
  missingCalendarViewRevealsCalendarItemExistence: false,
  missingAssignmentsViewMaySilentlyProduceZeroCoverage: false,
  roleOrTitleAloneAuthorizesReads: false,
  rawGrantCapabilityArraysRendered: false,
  assistantContactRelaxationRequiresLaterReview: true,
  requiredCapabilitiesForCoverage: ["calendar.view", "assignments.view"],
} as const;

export const calendarRouteCutoverMockToRealRules = {
  silentlyCombineMockAndPersistedCalendarItemsAllowed: false,
  persistedReadFallbackToMockInSameTruthSourceAllowed: false,
  singleTruthSourcePerExecutionPathRequired: true,
  temporaryPreviewModeMustBeVisiblyLabeledAndSeparatelyGated: true,
  existingMockCalendarRegressionRemainsUiReferenceUntilCutover: true,
  mockFieldsNotProductionTruth: [
    "filledCount",
    "assignedVolunteerIds",
    "deterministicColors",
    "localCreationDrafts",
  ],
} as const;

export const calendarRouteCutoverRequiredStates = [
  "unauthenticated",
  "unauthorized_or_no_workspace_access",
  "missing_calendar.view",
  "missing_assignments.view",
  "no_calendar_items_in_selected_range",
  "local_supabase_unavailable_or_configuration_issue",
  "query_helper_safe_failure",
  "invalid_period_or_range",
  "workspace_inactive_or_archived_if_applicable",
] as const;

export const calendarRouteCutoverStateRequirements = {
  states: calendarRouteCutoverRequiredStates,
  calmAndNonDisclosing: true,
  rawDatabaseProviderErrorsAllowed: false,
  stackTracesAllowed: false,
  unrelatedWorkspaceProjectVolunteerExistenceDisclosureAllowed: false,
  unauthorizedCapabilityDetailsAllowed: false,
  mockFallbackAllowedOnlyIfRouteRemainsExplicitlyMockOnly: true,
} as const;

export const calendarRouteCutoverBlockedUiAndProductChanges = [
  "calendar_create_edit_archive_delete_persistence",
  "draft_saving",
  "drag_drop_persistence",
  "resize_persistence",
  "copy_repeat_persistence",
  "assignment_picker",
  "assignment_create_cancel",
  "assignment_response_mutation_from_calendar_ui",
  "assignment_detail_entry_links",
  "response_link_generation",
  "copy_ui",
  "delivery",
  "public_lookup",
  "remembered_device_behavior",
  "seed_data",
  "service_role_usage",
] as const;

export const calendarRouteCutoverBrowserProofRequirements = [
  "desktop_calendar_renders_without_browser_errors",
  "mobile_390px_has_no_horizontal_overflow",
  "day_week_month_list_switch",
  "filters_open_and_close",
  "creation_and_inspector_surfaces_do_not_stack_incorrectly",
  "empty_persisted_data_shows_calm_empty_state",
  "unauthorized_persisted_contexts_show_calm_unavailable_state",
  "no_mock_persisted_data_mix_appears",
  "no_raw_ids_capabilities_errors_or_secrets_render",
  "no_response_link_or_assignment_detail_entry_behavior",
  "no_unexpected_network_calls_to_response_token_reveal_diagnostic_or_write_endpoints",
  "preview_logs_are_redirected_and_redacted",
] as const;

export const calendarRouteCutoverRollbackRules = {
  cutoverMustBeSmallAndReversible: true,
  schemaChangesInSameSliceAllowed: false,
  uiRedesignInSameSliceAllowed: false,
  calendarWritesInSameSliceAllowed: false,
  keepMockRouteBehaviorReferenceUntilCutoverSucceeds: true,
  optionalRouteFlagMustRemainReviewedFalseUntilImplementation: true,
  failedValidationAction: "revert_route_integration_not_authorization_or_helper_weakening",
} as const;

export function describeCalendarRouteCutoverReadiness() {
  return {
    readinessReviewAvailable: CALENDAR_ROUTE_CUTOVER_READINESS_REVIEW_AVAILABLE,
    eligibleRoute: CALENDAR_ROUTE_CUTOVER_ELIGIBLE_ROUTE,
    routePersistedReadCutoverImplemented: CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
    routeImportsReadModelQueryHelper: CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
    mockToRealMixingAllowed: CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
    persistedWriteAvailable: CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
    assignmentPickerCutoverAvailable: CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
    assignmentDetailLinkingAvailable: CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
    responseLinkActivationReopened: CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
    publicLookupCutoverAvailable: CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
    reminderDeliveryAvailable: CALENDAR_REMINDER_DELIVERY_AVAILABLE,
    serviceRoleReadAvailable: CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
    seedDataAvailable: CALENDAR_SEED_DATA_AVAILABLE,
    hostedCutoverValidationAvailable: CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
    queryHelperRouteUnused: CALENDAR_READ_MODEL_QUERY_HELPER_ROUTE_UNUSED,
    queryHelperDependencyInjected: CALENDAR_READ_MODEL_QUERY_HELPER_DEPENDENCY_INJECTED,
    queryHelperExplicitSelectors: CALENDAR_READ_MODEL_QUERY_SELECTORS,
    renderingConstraints: calendarRouteCutoverRenderingConstraints,
    requiredDataPath: calendarRouteCutoverRequiredDataPath,
    rangeAndPeriodRules: calendarRouteCutoverRangeAndPeriodRules,
    capabilityRules: calendarRouteCutoverCapabilityRules,
    mockToRealRules: calendarRouteCutoverMockToRealRules,
    stateRequirements: calendarRouteCutoverStateRequirements,
    blockedUiAndProductChanges: calendarRouteCutoverBlockedUiAndProductChanges,
    browserProofRequirements: calendarRouteCutoverBrowserProofRequirements,
    rollbackRules: calendarRouteCutoverRollbackRules,
    nextRecommendedSlice: CALENDAR_ROUTE_CUTOVER_NEXT_RECOMMENDED_SLICE,
  } as const;
}
