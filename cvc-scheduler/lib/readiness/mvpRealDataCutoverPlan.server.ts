import "server-only";

import {
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED,
  RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_AVAILABLE,
} from "../responseTokens/productActionActivationCheckpoint.server.ts";

export const MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE = true;
export const MVP_ROUTE_CUTOVER_IMPLEMENTATION_AVAILABLE = false;
export const CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE = false;
export const TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE = false;
export const VOLUNTEERS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE = false;
export const PUBLIC_VOLUNTEER_LOOKUP_CUTOVER_AVAILABLE = false;
export const COMMUNICATIONS_PERSISTENCE_CUTOVER_AVAILABLE = false;
export const REMINDER_DELIVERY_AVAILABLE = false;
export const RESPONSE_LINK_ACTIVATION_REOPENED = false;
export const MOCK_TO_REAL_MIXING_ALLOWED = false;
export const SERVICE_ROLE_CUTOVER_AVAILABLE = false;

export const mvpRealDataCutoverPlan = {
  status: "planning_static_guardrail_only",
  responseLinkActivationPausedAfter11_50: true,
  persistedFoundationsAvailable: [
    "workspace_identity",
    "project_contact_grants",
    "questionnaire_submissions",
    "volunteer_profiles",
    "task_presets",
    "calendar_items",
    "calendar_assignments_current_responses",
    "public_response_tokens",
    "assignment_detail_context",
    "response_link_infrastructure_boxed_behind_false_activation_flags",
  ],
  mockOnlyPrototypeSurfaces: [
    "/admin/calendar",
    "/admin/tasks",
    "/admin/volunteers",
    "/admin/announcements",
    "/admin/announcements/templates",
    "/v/demo",
    "/v/demo/assignments/[assignmentId]",
    "/v/demo/reminder/[assignmentId]",
    "/",
    "/admin/food",
    "/admin/security",
    "/admin/schedule",
  ],
  recommendedCutoverSequence: [
    {
      order: 1,
      id: "route_scoped_persisted_calendar_read_model",
      description:
        "Route-scoped persisted Calendar read model, still unlinked or behind a clear review boundary.",
    },
    {
      order: 2,
      id: "persisted_task_preset_read_model",
      description: "Persisted task preset read model for Tasks, still no writes to product UI.",
    },
    {
      order: 3,
      id: "persisted_volunteer_profile_admin_scheduling_read_model",
      description:
        "Persisted volunteer profile read model for admin scheduling contexts, still no public volunteer lookup.",
    },
    {
      order: 4,
      id: "persisted_assignment_coverage_read_model",
      description:
        "Persisted assignment coverage/read model for Calendar inspectors and assignment counts.",
    },
    {
      order: 5,
      id: "calendar_creation_edit_command_readiness",
      description:
        "Calendar creation/edit command readiness, still not connected to UI until separately reviewed.",
    },
    {
      order: 6,
      id: "assignment_picker_create_cancel_command_readiness",
      description: "Assignment picker/create/cancel command readiness.",
    },
    {
      order: 7,
      id: "volunteer_schedule_lookup_read_model",
      description: "Volunteer schedule lookup/read model.",
    },
    {
      order: 8,
      id: "public_volunteer_confirm_deny_confirm_all_integration",
      description:
        "Public volunteer Confirm/Deny/Confirm All integration through the already-reviewed response-token route or a separately reviewed lookup route.",
    },
    {
      order: 9,
      id: "communications_reminder_queue_persistence_review_send_workflow",
      description: "Communications/reminder queue persistence and review/send workflow.",
    },
    {
      order: 10,
      id: "automatic_reminder_engine_history_after_communications_persistence",
      description:
        "Automatic reminder engine/history only after Communications persistence is reviewed.",
    },
  ],
  nonNegotiableCutoverRules: [
    "one_route_may_not_silently_mix_mock_items_and_persisted_items_as_one_truth_source",
    "mock_routes_must_stay_clearly_mock_prototype",
    "persisted_routes_must_use_reviewed_server_only_helpers_and_explicit_capability_checks",
    "route_cutovers_must_be_incremental_and_separately_reviewed",
    "persisted_routes_must_define_unavailable_and_empty_states_before_exposing_data",
    "calendar_assignment_counts_must_come_from_assignment_rows_not_mock_counters",
    "volunteer_response_truth_must_come_from_assignment_current_response_rows_not_mock_local_state",
    "communications_reminders_must_not_send_until_review_send_delivery_boundaries_exist",
    "public_volunteer_lookup_must_not_expose_project_or_volunteer_existence_through_ambiguous_errors",
    "response_link_work_remains_paused_unless_a_later_explicit_slice_reopens_it",
    "no_service_role_usage_unless_a_future_reviewed_server_only_operation_requires_it",
    "no_seed_data_or_mock_to_real_bridging",
    "no_broad_assignment_directory_or_search_route_unless_separately_reviewed",
  ],
  recommendedNextImplementationSlice: {
    id: "12.2",
    name: "Persisted Calendar Read Model Contract",
    description:
      "Define a route-unused, server-only read model for Calendar list/detail data using persisted calendar_items, assignment-derived counts, and safe workspace/contact grants, without cutting over /admin/calendar.",
  },
  explicitlyBlockedForNow: [
    "active_response_link_reveal",
    "response_link_copy_ui",
    "assignment_detail_entry_links",
    "public_volunteer_lookup_cutover",
    "remembered_devices",
    "email_reminder_delivery",
    "automatic_reminders",
    "calendar_route_cutover",
    "volunteer_route_cutover",
    "task_route_cutover",
    "communications_route_cutover",
    "production_seed_data",
    "service_role_paths",
    "hosted_validation_unless_db_rpc_generated_type_or_hosted_behavior_changes",
  ],
  currentFalseFlags: [
    "MVP_ROUTE_CUTOVER_IMPLEMENTATION_AVAILABLE",
    "CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
    "TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
    "VOLUNTEERS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE",
    "PUBLIC_VOLUNTEER_LOOKUP_CUTOVER_AVAILABLE",
    "COMMUNICATIONS_PERSISTENCE_CUTOVER_AVAILABLE",
    "REMINDER_DELIVERY_AVAILABLE",
    "RESPONSE_LINK_ACTIVATION_REOPENED",
    "MOCK_TO_REAL_MIXING_ALLOWED",
    "SERVICE_ROLE_CUTOVER_AVAILABLE",
  ],
} as const;

export function describeMvpRealDataCutoverPlan() {
  return {
    planAvailable: MVP_REAL_DATA_CUTOVER_PLAN_AVAILABLE,
    routeCutoverImplementationAvailable: MVP_ROUTE_CUTOVER_IMPLEMENTATION_AVAILABLE,
    calendarRoutePersistedReadCutoverAvailable:
      CALENDAR_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
    tasksRoutePersistedReadCutoverAvailable:
      TASKS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
    volunteersRoutePersistedReadCutoverAvailable:
      VOLUNTEERS_ROUTE_PERSISTED_READ_CUTOVER_AVAILABLE,
    publicVolunteerLookupCutoverAvailable: PUBLIC_VOLUNTEER_LOOKUP_CUTOVER_AVAILABLE,
    communicationsPersistenceCutoverAvailable:
      COMMUNICATIONS_PERSISTENCE_CUTOVER_AVAILABLE,
    reminderDeliveryAvailable: REMINDER_DELIVERY_AVAILABLE,
    responseLinkActivationReopened: RESPONSE_LINK_ACTIVATION_REOPENED,
    responseLinkActivationCheckpointAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_CHECKPOINT_AVAILABLE,
    responseLinkActivationApproved: RESPONSE_LINK_PRODUCT_ACTION_ACTIVATION_APPROVED,
    mockToRealMixingAllowed: MOCK_TO_REAL_MIXING_ALLOWED,
    serviceRoleCutoverAvailable: SERVICE_ROLE_CUTOVER_AVAILABLE,
    plan: mvpRealDataCutoverPlan,
  } as const;
}

export function evaluateMvpRealDataCutoverReadiness() {
  const blockers = [
    "route_cutover_not_implemented",
    "calendar_route_persisted_read_cutover_unavailable",
    "tasks_route_persisted_read_cutover_unavailable",
    "volunteers_route_persisted_read_cutover_unavailable",
    "public_volunteer_lookup_cutover_unavailable",
    "communications_persistence_cutover_unavailable",
    "reminder_delivery_unavailable",
    "response_link_activation_paused_after_11_50",
    "mock_to_real_mixing_disallowed",
    "service_role_cutover_unavailable",
  ];

  return {
    allowed: false,
    recommendedNextImplementationSlice:
      mvpRealDataCutoverPlan.recommendedNextImplementationSlice,
    blockers,
  } as const;
}

export function getMvpRealDataCutoverPlan() {
  return mvpRealDataCutoverPlan;
}
