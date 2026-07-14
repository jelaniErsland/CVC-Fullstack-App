import "server-only";

import {
  CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE as DRY_RUN_CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE,
  CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED as DRY_RUN_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
  CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE,
  CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER as DRY_RUN_CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
  CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED as DRY_RUN_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
  CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED as DRY_RUN_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
  CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE as DRY_RUN_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
  CALENDAR_ROUTE_USES_DRY_RUN_HARNESS as DRY_RUN_CALENDAR_ROUTE_USES_DRY_RUN_HARNESS,
  CALENDAR_SEED_DATA_AVAILABLE as DRY_RUN_CALENDAR_SEED_DATA_AVAILABLE,
  CALENDAR_SERVICE_ROLE_READ_AVAILABLE as DRY_RUN_CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
  describeCalendarRouteCutoverDryRun,
} from "./routeCutoverDryRun.server.ts";
import {
  CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE as READINESS_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
  CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE as READINESS_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
  CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE as READINESS_CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
  CALENDAR_REMINDER_DELIVERY_AVAILABLE as READINESS_CALENDAR_REMINDER_DELIVERY_AVAILABLE,
  describeCalendarRouteCutoverReadiness,
} from "./routeCutoverReadiness.server.ts";
import { describeCalendarReadModelQueryHelper } from "./readModelQuery.server.ts";

export const CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_AVAILABLE = true;
export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED =
  DRY_RUN_CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED;
export const CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER =
  DRY_RUN_CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER;
export const CALENDAR_ROUTE_USES_DRY_RUN_HARNESS =
  DRY_RUN_CALENDAR_ROUTE_USES_DRY_RUN_HARNESS;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED =
  DRY_RUN_CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE =
  DRY_RUN_CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE =
  READINESS_CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE =
  READINESS_CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED =
  DRY_RUN_CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED;
export const CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE =
  READINESS_CALENDAR_PUBLIC_LOOKUP_CUTOVER_AVAILABLE;
export const CALENDAR_REMINDER_DELIVERY_AVAILABLE =
  READINESS_CALENDAR_REMINDER_DELIVERY_AVAILABLE;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE =
  DRY_RUN_CALENDAR_SERVICE_ROLE_READ_AVAILABLE;
export const CALENDAR_SEED_DATA_AVAILABLE = DRY_RUN_CALENDAR_SEED_DATA_AVAILABLE;
export const CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE =
  DRY_RUN_CALENDAR_HOSTED_CUTOVER_VALIDATION_AVAILABLE;

export const CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_NEXT_RECOMMENDED_SLICE =
  "12.10 Calendar Route Cutover Empty/Unavailable State Prototype" as const;

export const calendarRouteCutoverFinalCandidateScope = {
  candidateRoute: "/admin/calendar",
  candidateDataPath: "persisted_read_only_calendar_display_items",
  readOnlyOnly: true,
  calendarWritesAllowed: false,
  assignmentMutationsAllowed: false,
  assignmentPickerAllowed: false,
  assignmentDetailLinksAllowed: false,
  responseLinkActivationAllowed: false,
  deliveryAllowed: false,
  publicVolunteerLookupAllowed: false,
  rememberedDeviceBehaviorAllowed: false,
  seedDataAllowed: false,
  serviceRoleUsageAllowed: false,
} as const;

export const calendarRouteCutoverFinalRequiredImplementationPath = [
  "dynamic_no_store_admin_calendar_server_boundary",
  "verified_project_contact_session",
  "reviewed_workspace_contact_grant_resolution",
  "trusted_workspace_id",
  "trusted_actor_contact_id",
  "trusted_workspace_timezone",
  "calendar.view_capability",
  "assignments.view_capability_for_coverage_bearing_output",
  "server_derived_bounded_period_range",
  "12.8_dry_run_equivalent_state_contract",
  "12.6_dependency_injected_query_helper_or_reviewed_successor",
  "12.3_safe_projection_helper_or_reviewed_successor",
  "one_user_facing_truth_source_per_route_execution",
] as const;

export const calendarRouteCutoverFinalGoNoGoChecklist = [
  "local_disposable_validation_green",
  "dry_run_harness_green",
  "route_cutover_readiness_green",
  "query_helper_regression_green",
  "calendar_browser_regression_green",
  "assignment_detail_response_link_guardrails_green",
  "no_migration_or_type_change_required_for_cutover",
  "hosted_validation_not_required_unless_db_rpc_type_or_hosted_behavior_changes",
  "rollback_path_defined",
  "empty_unavailable_states_defined",
  "route_import_plan_defined",
  "mock_to_real_non_mixing_rule_defined",
  "safe_error_rendering_rule_defined",
  "preview_browser_proof_defined",
] as const;

export const calendarRouteCutoverFinalStateContract = {
  states: [
    "unauthenticated",
    "unauthorized_no_workspace_access",
    "missing_calendar.view",
    "missing_assignments.view",
    "invalid_period_or_range",
    "workspace_unavailable_inactive_archived_if_applicable",
    "query_unavailable_safe_error",
    "empty_range_no_calendar_items",
    "ready_with_projected_calendar_items",
  ],
  requirements: {
    calm: true,
    nonDisclosing: true,
    credentialFree: true,
    rawProviderErrorsAllowed: false,
    stackTracesAllowed: false,
    mockFallbackStatesAllowed: false,
    persistedPartialDataMixedWithMockAllowed: false,
  },
} as const;

export const calendarRouteCutoverFinalUiPreservationContract = {
  dayWeekMonthListControlsStillWork: true,
  filtersStillWork: true,
  inspectorStillOpensAndCloses: true,
  creationSurfaceRemainsPreviewOnlyAndDoesNotSave: true,
  mobileMoreFilterCreateInspectDoNotStack: true,
  desktopHorizontalOverflowAllowed: false,
  mobile390HorizontalOverflowAllowed: false,
  compactBlocksShowTaskNamePlusAssignedFractionWhenDataPresent: true,
  emptyPersistedStateIsCalm: true,
  unauthorizedUnavailableStatesAreCalm: true,
  rawIdsCapabilitiesErrorsSecretsRendered: false,
} as const;

export const calendarRouteCutoverFinalSafeMappingFields = [
  "calendar_item_id_or_display_reference",
  "task_source_label",
  "display_type_or_category",
  "schedule_kind",
  "date_range_time_fields",
  "timezone",
  "needed_count",
  "lifecycle_publication_state",
  "safe_schedule_notes_if_allowed",
  "task_preset_or_one_off_labels",
  "assignment_derived_coverage_summary",
  "assigned_fraction_label",
] as const;

export const calendarRouteCutoverFinalForbiddenMappingFields = [
  "volunteer_contact_values",
  "emergency_contacts",
  "questionnaire_answers",
  "response_urls",
  "bearer",
  "verifier",
  "token_id",
  "audit_id",
  "access_token",
  "refresh_token",
  "password",
  "api_key",
  "service_role_key",
  "sql_rpc_detail",
  "raw_grants_capability_arrays",
  "unrelated_rows",
  "provider_dumps",
  "stack_traces",
  "raw_exception_messages",
] as const;

export const calendarRouteCutoverFinalMockToRealBoundary = {
  persistedReadPlusMockFallbackSameExecutionAllowed: false,
  mockCalendarItemMergedWithPersistedCalendarItemAllowed: false,
  mockFilledCountProductionTruthAllowed: false,
  assignedVolunteerIdArrayProductionTruthAllowed: false,
  deterministicMockColorsStorageTruthAllowed: false,
  currentMockRouteBehaviorRemainsVisualReferenceUntilImplementation: true,
  actualCutoverRequiresOneReviewedTruthSourceBranch: true,
} as const;

export const calendarRouteCutoverFinalRollbackPlan = {
  routeIntegrationSmallAndReversible: true,
  schemaChangesInSameSliceAllowed: false,
  uiRedesignInSameSliceAllowed: false,
  calendarWritesInSameSliceAllowed: false,
  assignmentMutationsInSameSliceAllowed: false,
  responseLinkActivationInSameSliceAllowed: false,
  ifValidationFails:
    "revert_route_integration_instead_of_weakening_auth_query_projection_rules",
  previousMockBehaviorRecoverableUntilCutoverSucceeds: true,
} as const;

export function describeCalendarRouteCutoverFinalPreflight() {
  return {
    finalPreflightAvailable: CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_AVAILABLE,
    priorDryRunAvailable: CALENDAR_ROUTE_CUTOVER_DRY_RUN_AVAILABLE,
    routePersistedReadCutoverImplemented: CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_IMPLEMENTED,
    routeImportsReadModelQueryHelper: CALENDAR_ROUTE_IMPORTS_READ_MODEL_QUERY_HELPER,
    routeUsesDryRunHarness: CALENDAR_ROUTE_USES_DRY_RUN_HARNESS,
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
    candidateScope: calendarRouteCutoverFinalCandidateScope,
    requiredImplementationPath: calendarRouteCutoverFinalRequiredImplementationPath,
    goNoGoChecklist: calendarRouteCutoverFinalGoNoGoChecklist,
    futureStateContract: calendarRouteCutoverFinalStateContract,
    uiPreservationContract: calendarRouteCutoverFinalUiPreservationContract,
    safeMappingFields: calendarRouteCutoverFinalSafeMappingFields,
    forbiddenMappingFields: calendarRouteCutoverFinalForbiddenMappingFields,
    mockToRealBoundary: calendarRouteCutoverFinalMockToRealBoundary,
    rollbackPlan: calendarRouteCutoverFinalRollbackPlan,
    priorReadinessReview: describeCalendarRouteCutoverReadiness(),
    priorDryRunHarness: describeCalendarRouteCutoverDryRun(),
    queryHelper: describeCalendarReadModelQueryHelper(),
    nextRecommendedSlice:
      CALENDAR_ROUTE_CUTOVER_FINAL_PREFLIGHT_NEXT_RECOMMENDED_SLICE,
  } as const;
}
