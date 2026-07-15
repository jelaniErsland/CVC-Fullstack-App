import "server-only";

export const TASKS_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE = true;
export const TASKS_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE = false;
export const TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE = false;
export const TASKS_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED = false;
export const TASKS_ROUTE_PERSISTED_WRITE_AVAILABLE = false;
export const TASKS_CALENDAR_OCCURRENCE_DECORATION_AVAILABLE = false;
export const TASKS_ASSIGNMENT_COVERAGE_DECORATION_AVAILABLE = false;
export const TASKS_SERVICE_ROLE_READ_AVAILABLE = false;
export const TASKS_SEED_DATA_AVAILABLE = false;
export const TASKS_HOSTED_VALIDATION_REQUIRED = false;
export const TASKS_RESPONSE_LINK_ACTIVATION_REOPENED = false;
export const TASKS_PUBLIC_LOOKUP_CUTOVER_AVAILABLE = false;
export const TASKS_REMINDER_DELIVERY_AVAILABLE = false;
export const TASKS_REMEMBERED_DEVICE_AVAILABLE = false;

export const persistedTasksReadModelContract = {
  milestone: "12.13",
  routeUnused: true,
  eligibleFutureRoute: "/admin/tasks",
  currentRouteCutover: false,
  currentRouteTruthSource: "mock_prototype_until_separate_cutover",
  canonicalEntity:
    "task_template_or_preset_reusable_scheduling_definition_not_calendar_occurrence",
  requiredCapability: "tasks.view",
  routeStates: [
    "ready_with_presets",
    "ready_empty",
    "unavailable",
    "error",
  ],
  authContext: {
    authenticatedProjectContactRequired: true,
    authenticatedProjectContactIdRequired: true,
    deterministicActiveWorkspaceContextRequired: true,
    serverDerivedWorkspaceScopeRequired: true,
    roleOrTitleStringsAuthorizeReads: false,
    browserProvidedWorkspaceIdTrusted: false,
    browserProvidedContactIdTrusted: false,
    browserProvidedCapabilityArrayTrusted: false,
    browserProvidedRoleNameTrusted: false,
    browserProvidedSelectorTrusted: false,
    stabilizedWorkspaceSelectionPrinciple:
      "reuse_12_12_contact_scoped_effective_grant_selection_and_fail_closed_on_ambiguous_workspace",
  },
  currentSchemaSupportedFields: [
    "id",
    "workspace_id",
    "name",
    "description",
    "task_type",
    "default_needed_count",
    "volunteer_visible",
    "is_system_preset",
    "system_key",
    "custom_field_definitions",
    "lifecycle",
    "created_at",
    "updated_at",
  ],
  safeProjectionConcepts: [
    "task_preset_id",
    "stable_display_reference",
    "name",
    "description_or_instructions_when_present",
    "high_level_type_category_general_food_security_custom",
    "default_needed_count",
    "volunteer_visibility_default",
    "lifecycle_active_or_archived",
    "bounded_custom_field_definitions",
    "safe_system_trusted_identity",
    "timestamps_only_if_needed_for_tasks_ui",
  ],
  currentSchemaGaps: [
    "default_duration",
    "default_area_or_location",
    "congregation_preference",
    "skill_text",
    "age_driver_equipment_safety_notes",
    "default_follow_up_contact",
    "richer_default_publication_behavior",
  ],
  calendarSeparation: {
    calendarOccurrenceStateAllowed: false,
    taskPresetFieldsMustNotInclude: [
      "scheduled_date",
      "start_time",
      "end_time",
      "date_range",
      "calendar_placement",
      "calendar_item_id_as_preset_state",
      "calendar_item_lifecycle_publication_state",
      "occurrence_specific_notes",
      "occurrence_specific_follow_up_contact",
      "recurrence_instances",
      "assigned_volunteers",
      "assignment_responses",
      "assigned_count",
      "confirmed_count",
      "denied_count",
      "coverage_state",
      "times_scheduled",
      "upcoming_occurrence_count",
    ],
    calendarTablesMustNotBeQueriedForTasksLibraryDecoration: true,
    currentCoverageOrUpcomingOccurrenceAggregatesAllowed: false,
  },
  customFieldContract: {
    sourceField: "custom_field_definitions",
    bounded: true,
    maximumFieldCount: 20,
    maximumSerializedBytes: 16384,
    preserveOrder: true,
    allowedFieldTypes: ["short_text", "long_text", "number", "select", "checkbox"],
    safeDefinitionMetadata: ["key", "label", "type", "required", "options_for_select_only"],
    executableConfigurationAllowed: false,
    malformedOrUnsupportedStructuresFailClosed: true,
    submittedVolunteerAnswersAllowed: false,
    calendarOccurrenceValuesAllowed: false,
  },
  systemTrustedPresetContract: {
    preserveSchemaSupportedIdentity: true,
    safeFields: ["is_system_preset", "system_key_when_needed"],
    ordinaryRowsMayMasqueradeAsSystemPresets: false,
    privilegedInternalMetadataExposureAllowed: false,
    historicalLunchCompatibilityIsNotCanonicalMealsModel: true,
    mealsSchemaAdded: false,
  },
  searchFilterSort: {
    taskNameSearchAllowed: true,
    categoryFilters: ["general", "food", "security", "custom"],
    lifecycleFilters: ["active", "archived"],
    stableDefaultSort: ["active_before_archived", "name", "id"],
    nondeterministicDatabaseRowOrderAllowed: false,
    clientQueryIntegrationImplemented: false,
  },
  futureQueryShapeRules: {
    explicitAllowlistedSelectorRequired: true,
    selectStarAllowed: false,
    broadRawRowOutputAllowed: false,
    routeDirectFromRpcAllowed: false,
    serviceRoleAllowed: false,
    allowedTableConcepts: ["task_presets"],
    forbiddenTableConcepts: [
      "calendar_items",
      "calendar_assignments",
      "assignment_responses",
      "volunteer_profiles",
      "questionnaire_submissions",
      "assignment_response_tokens",
      "assignment_response_link_reveal_events",
      "project_contacts_for_output",
      "workspace_contact_grants_for_output",
      "auth_tables",
      "storage_tables",
      "diagnostics_tables",
    ],
  },
  stateContract: {
    ready_with_presets:
      "successful_authorized_persisted_read_returning_one_or_more_task_presets",
    ready_empty:
      "successful_authorized_persisted_read_returning_zero_task_presets_not_error",
    unavailable:
      "intentional_fail_closed_missing_auth_contact_workspace_tasks_view_or_ambiguous_context",
    error:
      "unexpected_safe_read_failure_after_prerequisites_without_raw_provider_error",
    mockFallbackAllowed: false,
  },
  mockToRealBoundary: {
    oneUserFacingTruthSourcePerExecutionPath: true,
    persistedAndMockPresetMixingAllowed: false,
    failedPersistedReadMayFallbackToMockPresets: false,
    historicalMockPresetsMayRemainElsewhereUntilCleanup: true,
    calendarPreviewScaffoldingDoesNotDefineTasksRouteTruth: true,
  },
  unsafeDataDenylist: [
    "volunteer_contact_details",
    "volunteer_profiles",
    "questionnaire_submissions",
    "questionnaire_answers",
    "emergency_contact_data",
    "calendar_assignment_rows",
    "assignment_responses",
    "response_token_rows",
    "response_urls",
    "bearers",
    "verifiers",
    "audit_reveal_rows",
    "raw_grants_capability_arrays",
    "auth_session_secrets",
    "service_role_credentials",
    "provider_error_dumps",
    "stack_traces",
    "sql_internal_rpc_detail",
    "unrelated_workspace_rows",
  ],
  blockedInThisSlice: [
    "admin_tasks_route_cutover",
    "tasks_route_loader",
    "client_side_supabase_tasks_read",
    "tasks_create_edit_archive_ui_behavior",
    "calendar_write_behavior",
    "response_link_activation",
    "email_reminder_delivery",
    "public_lookup",
    "remembered_device_behavior",
    "migration",
    "generated_supabase_type_change",
    "hosted_validation",
    "seed_data",
  ],
  recommendedNextSlice: {
    id: "12.14",
    title: "Route-Unused Persisted Tasks Read Model Helper / Query-Shape Review",
    authorizesAdminTasksCutover: false,
  },
} as const;

export function describePersistedTasksReadModelContract() {
  return {
    contractAvailable: TASKS_PERSISTED_READ_MODEL_CONTRACT_AVAILABLE,
    implementationAvailable: TASKS_PERSISTED_READ_MODEL_IMPLEMENTATION_AVAILABLE,
    routeCutoverAvailable: TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
    mockToRealMixingAllowed: TASKS_ROUTE_MOCK_TO_REAL_MIXING_ALLOWED,
    persistedWriteAvailable: TASKS_ROUTE_PERSISTED_WRITE_AVAILABLE,
    calendarOccurrenceDecorationAvailable:
      TASKS_CALENDAR_OCCURRENCE_DECORATION_AVAILABLE,
    assignmentCoverageDecorationAvailable:
      TASKS_ASSIGNMENT_COVERAGE_DECORATION_AVAILABLE,
    serviceRoleReadAvailable: TASKS_SERVICE_ROLE_READ_AVAILABLE,
    seedDataAvailable: TASKS_SEED_DATA_AVAILABLE,
    hostedValidationRequired: TASKS_HOSTED_VALIDATION_REQUIRED,
    responseLinkActivationReopened: TASKS_RESPONSE_LINK_ACTIVATION_REOPENED,
    publicLookupCutoverAvailable: TASKS_PUBLIC_LOOKUP_CUTOVER_AVAILABLE,
    reminderDeliveryAvailable: TASKS_REMINDER_DELIVERY_AVAILABLE,
    rememberedDeviceAvailable: TASKS_REMEMBERED_DEVICE_AVAILABLE,
    requiredCapability: persistedTasksReadModelContract.requiredCapability,
    eligibleFutureRoute: persistedTasksReadModelContract.eligibleFutureRoute,
    routeStates: persistedTasksReadModelContract.routeStates,
    recommendedNextSlice: persistedTasksReadModelContract.recommendedNextSlice,
  } as const;
}

export function evaluatePersistedTasksReadModelReadiness() {
  return {
    allowedForAdminTasksCutover: false,
    blockers: [
      "read_model_implementation_unavailable",
      "admin_tasks_route_cutover_unavailable",
      "mock_to_real_mixing_disallowed",
      "persisted_writes_unavailable",
      "calendar_occurrence_decoration_unavailable",
      "assignment_coverage_decoration_unavailable",
      "service_role_read_unavailable",
      "seed_data_unavailable",
      "response_link_activation_paused_after_11_50",
    ],
    recommendedNextImplementationSlice:
      persistedTasksReadModelContract.recommendedNextSlice,
  } as const;
}
