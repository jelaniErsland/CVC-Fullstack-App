import "server-only";

export const CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE = true;
export const CALENDAR_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE = false;
export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE = false;
export const CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED = false;
export const CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE = false;
export const CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE = false;
export const CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE = false;
export const CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED = false;
export const CALENDAR_SERVICE_ROLE_READ_AVAILABLE = false;
export const CALENDAR_SEED_DATA_AVAILABLE = false;

export const calendarPersistedReadModelContract = {
  status: "planning_static_guardrail_only",
  eligibleSurface: "/admin/calendar",
  currentRouteCutover: false,
  routeUnused: true,
  periodListRead: {
    workspaceScoped: true,
    authenticatedProjectContactOnly: true,
    capabilityChecked: true,
    anonymousReadAllowed: false,
    serviceRolePathAllowed: false,
    seedDataAllowed: false,
    mockFallbackAllowed: false,
    suitableViews: ["day", "week", "month", "list"],
    explicitDateRangeRequired: true,
    timezoneRule: "workspace_timezone",
    rawBroadTableExposureAllowed: false,
  },
  itemProjection: {
    safeFields: [
      "calendar_item_id",
      "workspace_id_internal_only_when_needed",
      "task_source_label",
      "task_type_category_display_value",
      "schedule_kind",
      "start_date",
      "end_date",
      "start_time",
      "end_time",
      "timezone",
      "needed_count",
      "lifecycle_publication_state",
      "safe_schedule_notes_for_project_contacts",
      "one_off_task_snapshot_label",
      "one_off_task_snapshot_type",
      "task_preset_reference_label",
      "stable_display_reference",
      "assignment_derived_counts",
      "safe_inspector_fields_for_project_contact_calendar_context",
    ],
    clientBroadWorkspaceExposureAllowed: false,
    volunteerContactValuesAllowed: false,
  },
  assignmentDerivedCoverageSummary: {
    sourceOfTruth: "calendar_assignments_and_current_assignment_responses",
    forbiddenProductionTruthSources: [
      "calendar_item_counters",
      "mock_filledCount",
      "assignedVolunteerIds_arrays",
      "client_calculated_coverage",
    ],
    fields: [
      "assigned_count",
      "confirmed_count",
      "denied_count",
      "unassigned_count",
      "waiting_on_confirmation_count",
      "has_denied",
      "all_assigned_helpers_denied",
      "coverage_state",
      "assigned_fraction_label",
    ],
    assignedCountRule:
      "active_assignments_with_current_response_needs_response_or_confirmed",
    confirmedCountRule: "active_assignments_with_current_response_confirmed",
    deniedCountRule: "active_assignments_with_current_response_declined",
    unassignedCountRule: "max(needed_count_minus_assigned_count,0)",
    waitingOnConfirmationRule:
      "active_assignments_with_current_response_needs_response",
    deniedAndRemovedAssignmentsCountTowardAssigned: false,
    needsResponseAndConfirmedCountTowardAssigned: true,
    zeroNeededAssignedFractionLabel: "0/0 assigned",
    informationalItemsDefault:
      "multi_day_window_and_milestone_items_are_zero_needed_non_assignable_until_a_reviewed_child_occurrence_model_exists",
    aggregateVolunteerCountOnMultiDayWindowAllowed: false,
  },
  capabilityContract: {
    calendarItemShellsRequire: ["calendar.view"],
    assignmentDerivedCoverageCountsRequire: ["calendar.view", "assignments.view"],
    strictCurrentSafeRule:
      "require_both_calendar.view_and_assignments.view_for_assignment_derived_counts_until_a_later_permissions_review_relaxes_it",
    volunteerLabelsAllowedInListRead: false,
    volunteerContactDetailsAllowedInListRead: false,
    broadVolunteerValuesAllowed: false,
  },
  filtersAndSorting: {
    explicitDateRangeRequired: true,
    optionalFilters: [
      "task_name_search",
      "type_general_food_security",
      "coverage_unfilled",
      "coverage_filled",
      "coverage_waiting",
      "coverage_confirmed",
      "coverage_denied_someDenied_allDenied",
      "lifecycle_publication",
    ],
    stableSortOrder: ["date", "schedule_kind", "time", "task_label", "id"],
    boundedRangeOrPaginationRequired: true,
  },
  detailInspectorContract: {
    sameReadModelBoundary: true,
    allowedWhenCapabilityRuleAllows: [
      "assignment_derived_aggregate_counts",
      "safe_project_contact_labels",
    ],
    forbiddenFields: [
      "response_link_url",
      "public_token",
      "verifier",
      "token_id",
      "audit_id",
      "questionnaire_answers",
      "emergency_contact_detail",
      "raw_grants",
      "raw_capability_arrays",
      "unrelated_volunteer_rows",
      "broad_assignment_directory",
      "assignment_detail_route_links",
      "helper_contact_values_without_later_review",
    ],
  },
  mockToRealCutoverRules: [
    "admin_calendar_remains_mock_only_after_12_2",
    "no_current_app_route_or_component_imports_this_contract",
    "no_current_route_imports_persisted_calendar_helpers_as_part_of_12_2",
    "no_route_silently_combines_mock_calendar_items_with_persisted_calendar_items",
    "no_route_reads_persisted_calendar_data_and_falls_back_to_mock_data_in_the_same_user_facing_truth_source",
    "existing_mock_calendar_regression_remains_the_product_ui_behavior_reference_until_a_separate_cutover_slice",
  ],
  explicitlyBlocked: [
    "admin_calendar_route_cutover",
    "calendar_create_edit_archive_cancel_ui",
    "calendar_write_commands",
    "drag_drop_persistence",
    "resize_persistence",
    "recurrence_copy_persistence",
    "assignment_picker",
    "assignment_create_cancel",
    "assignment_response_mutation_from_calendar_ui",
    "public_volunteer_lookup",
    "public_volunteer_schedule_cutover",
    "email_reminder_delivery",
    "communications_persistence_cutover",
    "needs_attention_persistence_cutover",
    "response_link_activation",
    "assignment_detail_entry_links",
    "service_role_usage",
    "seed_data",
    "hosted_validation_unless_db_rpc_generated_type_or_hosted_behavior_changes",
  ],
  recommendedNextImplementationSlice: {
    id: "12.3",
    name: "Route-Unused Calendar Read Model Helper or Query-Shape Review",
    condition:
      "Only proceed if the 12.2 contract and static guardrails pass cleanly; otherwise revise this contract first.",
  },
} as const;

export function describeCalendarPersistedReadModelContract() {
  return {
    contractAvailable: CALENDAR_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE,
    implementationAvailable: CALENDAR_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE,
    routeCutoverAvailable: CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
    mockToRealMixingAllowed: CALENDAR_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
    persistedWriteAvailable: CALENDAR_ROUTE_PERSISTED_WRITE_AVAILABLE,
    assignmentPickerCutoverAvailable: CALENDAR_ASSIGNMENT_PICKER_CUTOVER_AVAILABLE,
    assignmentDetailLinkingAvailable: CALENDAR_ASSIGNMENT_DETAIL_LINKING_AVAILABLE,
    responseLinkActivationReopened: CALENDAR_RESPONSE_LINK_ACTIVATION_REOPENED,
    serviceRoleReadAvailable: CALENDAR_SERVICE_ROLE_READ_AVAILABLE,
    seedDataAvailable: CALENDAR_SEED_DATA_AVAILABLE,
    contract: calendarPersistedReadModelContract,
  } as const;
}

export function evaluateCalendarPersistedReadModelReadiness() {
  return {
    allowedForRouteCutover: false,
    recommendedNextImplementationSlice:
      calendarPersistedReadModelContract.recommendedNextImplementationSlice,
    blockers: [
      "read_model_implementation_unavailable",
      "admin_calendar_route_cutover_unavailable",
      "mock_to_real_mixing_disallowed",
      "calendar_writes_unavailable",
      "assignment_picker_cutover_unavailable",
      "assignment_detail_linking_unavailable",
      "response_link_activation_paused_after_11_50",
      "service_role_read_unavailable",
      "seed_data_unavailable",
    ],
  } as const;
}

export function getCalendarPersistedReadModelContract() {
  return calendarPersistedReadModelContract;
}
