import "server-only";

export const BOZEMAN_BETA_ROADMAP_REBASELINE_AVAILABLE = true;
export const BOZEMAN_BETA_TARGET_WORKSPACE = "bozeman";
export const BOZEMAN_BETA_IDEAL_READINESS_TARGET = "mid_august_2026";
export const BOZEMAN_BETA_PRINCIPLE = "cut_features_not_integrity";
export const BELGRADE_REMAINS_SHEETS_FALLBACK = true;
export const BOZEMAN_BETA_PRODUCT_IMPLEMENTATION_STARTED = false;
export const BOZEMAN_BETA_BELGRADE_MIGRATION_AVAILABLE = false;
export const BOZEMAN_BETA_RESPONSE_LINK_ACTIVATION_REOPENED = false;
export const BOZEMAN_BETA_SERVICE_ROLE_SHORTCUT_ALLOWED = false;
export const BOZEMAN_BETA_MOCK_PERSISTED_MIXING_ALLOWED = false;
export const BOZEMAN_BETA_REAL_EMAIL_SENDING_AVAILABLE = false;
export const BOZEMAN_BETA_PRODUCTION_DATA_ACCESS_AVAILABLE = false;

type BetaStatus =
  | "production_capable_now"
  | "persisted_backend_foundation_exists"
  | "server_helper_boundary_exists_route_integration_missing"
  | "persisted_read_path_exists_mutation_path_missing"
  | "mock_prototype_ui_exists"
  | "route_ui_mock_only"
  | "not_implemented"
  | "blocked_by_dependency"
  | "beta_critical"
  | "useful_non_blocking"
  | "safely_deferrable_after_beta";

type BetaDomain = Readonly<{
  id: string;
  title: string;
  statuses: readonly BetaStatus[];
  repositoryFindings: readonly string[];
  betaNeed: string;
  blockers: readonly string[];
  deferrable: readonly string[];
}>;

export const bozemanBetaLaunchGate = {
  target: BOZEMAN_BETA_TARGET_WORKSPACE,
  idealReadinessTarget: BOZEMAN_BETA_IDEAL_READINESS_TARGET,
  principle: BOZEMAN_BETA_PRINCIPLE,
  exactGate:
    "Bozeman beta may launch only when the narrow scheduling loop is production-safe end-to-end: one real Bozeman workspace, authorized project-contact access, permanent volunteer profiles, real read/write Calendar scheduled items, real assignments, draft/private versus published/live visibility, secure account-light volunteer schedule access, Confirm/Deny persistence, admin response visibility, basic initial assignment email delivery, approved Project Local visual integration on beta-critical surfaces, production Supabase/deployment/email configuration, hosted validation, mobile/browser proof, observability, backup/recovery, and Belgrade Sheets fallback.",
  requiredWorkflow: [
    "authorized_project_contact_can_access_correct_bozeman_workspace",
    "trusted_helpers_can_add_or_import_volunteer_profiles",
    "authorized_scheduler_can_create_and_edit_real_calendar_scheduled_items",
    "scheduled_items_support_task_preset_or_one_off_custom_definitions",
    "volunteers_can_be_assigned_to_scheduled_items",
    "draft_private_and_published_live_state_are_correct",
    "assigned_volunteers_can_securely_access_their_own_schedules_without_normal_accounts",
    "volunteers_can_confirm_or_deny_assignments",
    "authorized_contacts_can_see_accurate_response_state",
    "basic_initial_assignment_notification_email_can_send_reliably",
    "beta_critical_surfaces_use_approved_polished_project_local_visual_direction",
  ],
  mustNotWeaken: [
    "workspace_isolation",
    "authenticated_project_contact_identity",
    "explicit_capability_authorization",
    "server_owned_workspace_contact_capability_derivation",
    "deny_by_default_access",
    "reviewed_server_only_boundaries",
    "bounded_reads_where_applicable",
    "one_user_facing_truth_source_per_route_execution",
    "no_silent_mock_persisted_truth_mixing",
    "assignment_current_response_source_of_truth",
    "safe_public_volunteer_access",
    "credential_token_secrecy",
    "safe_error_states",
    "incremental_reviewed_cutovers",
    "local_disposable_validation_where_useful",
    "browser_mobile_validation",
    "regression_coverage",
    "production_recovery_fallback_planning",
  ],
} as const;

export const bozemanBetaAuditDomains: readonly BetaDomain[] = [
  {
    id: "workspace_admin_access",
    title: "Workspace and admin access",
    statuses: [
      "persisted_backend_foundation_exists",
      "production_capable_now",
      "beta_critical",
      "blocked_by_dependency",
    ],
    repositoryFindings: [
      "workspace identity, project contacts, grants, Auth shell, and contact-scoped grant readers exist",
      "calendar route selection now requires exactly one eligible active workspace and fails closed on ambiguity",
      "real Bozeman provisioning and contact invitation/grant workflow are not yet productized",
    ],
    betaNeed:
      "Create/provision one Bozeman workspace and authorized contacts with explicit capabilities before any real beta data entry.",
    blockers: [
      "bozeman_workspace_provisioning_runbook_or_admin_flow",
      "project_contact_invite_and_grant_assignment_process",
      "multiple_workspace_operator_policy_before_more_than_one_live_workspace",
    ],
    deferrable: ["full_platform_workspace_switcher", "belgrade_migration"],
  },
  {
    id: "volunteer_data_entry_import",
    title: "Volunteer data entry/import",
    statuses: [
      "persisted_backend_foundation_exists",
      "route_ui_mock_only",
      "mock_prototype_ui_exists",
      "beta_critical",
    ],
    repositoryFindings: [
      "volunteer_profiles table, RLS, and questionnaire conversion RPC exist",
      "/admin/volunteers and questionnaire review routes remain mock/prototype",
      "no permanent manual Add/Edit Volunteer route or controlled CSV import exists",
    ],
    betaNeed:
      "Use the permanent volunteer_profile model for manual Add/Edit first; optionally add controlled CSV import if it saves enough real Bozeman setup time.",
    blockers: [
      "manual_add_volunteer_command_and_admin_ui",
      "volunteer_profile_edit_update_command",
      "trusted_helper_capability_path_for_data_entry",
      "minimum_required_fields_review_for_name_contact_method_availability_skills_notes_readiness",
    ],
    deferrable: [
      "full_public_questionnaire_cutover",
      "broad_bulk_import_mapping_ui",
      "advanced_duplicate_merge",
    ],
  },
  {
    id: "tasks",
    title: "Tasks",
    statuses: [
      "persisted_backend_foundation_exists",
      "route_ui_mock_only",
      "mock_prototype_ui_exists",
      "server_helper_boundary_exists_route_integration_missing",
      "beta_critical",
    ],
    repositoryFindings: [
      "task_presets persistence and create/archive server helpers exist",
      "12.13 defines the route-unused read-model contract",
      "/admin/tasks remains mock/prototype",
      "Calendar write flow can use a narrower reviewed task-preset selector without first cutting over the full Tasks library",
    ],
    betaNeed:
      "Preserve Task preset = reusable definition and Scheduled item = Calendar occurrence; expose only the task-preset selection needed for Calendar creation before a full Tasks route cutover if timeline is tight.",
    blockers: [
      "route_unused_or_calendar_scoped_task_preset_selector_read_seam",
      "decision_on_minimum_preset_management_before_beta",
      "task_schema_gap_review_for_default_duration_location_follow_up_contact_if_required",
    ],
    deferrable: [
      "full_admin_tasks_route_cutover",
      "task_duplicate_update_ui",
      "times_scheduled_or_upcoming_occurrence_aggregates",
    ],
  },
  {
    id: "calendar",
    title: "Calendar",
    statuses: [
      "production_capable_now",
      "persisted_read_path_exists_mutation_path_missing",
      "beta_critical",
    ],
    repositoryFindings: [
      "/admin/calendar uses persisted item truth through server-owned bounded reads",
      "database create_calendar_item and archive_calendar_item RPCs exist behind calendar.edit",
      "product route write integration remains preview-only/local and non-persistent",
      "publication semantics are not fully resolved in the current route UI",
    ],
    betaNeed:
      "Add narrow Calendar create/edit/archive and route refresh using reviewed server-only commands, with task-preset or one-off custom item creation.",
    blockers: [
      "calendar_create_edit_route_action_boundary",
      "date_time_timezone_validation_for_product_ui",
      "needed_count_and_notes_mapping",
      "draft_private_vs_published_live_decision",
      "follow_up_contact_schema_or_product_decision",
      "safe_revalidation_after_writes",
    ],
    deferrable: ["drag_drop_persistence", "resize_persistence", "recurrence_copy_persistence"],
  },
  {
    id: "volunteer_assignment",
    title: "Volunteer assignment",
    statuses: [
      "persisted_backend_foundation_exists",
      "server_helper_boundary_exists_route_integration_missing",
      "beta_critical",
    ],
    repositoryFindings: [
      "calendar_assignments and current assignment_responses exist",
      "create/cancel assignment RPCs and server helpers exist",
      "no assignment picker/add/remove UI is integrated into Calendar",
      "coverage counts already derive from assignments/current responses in Calendar reads",
    ],
    betaNeed:
      "Provide a narrow volunteer picker with add/remove assignment commands and duplicate prevention before publication/email.",
    blockers: [
      "volunteer_picker_read_model_for_scheduling",
      "assignment_create_cancel_route_actions",
      "response_preservation_rules_on_cancel_reassign",
      "basic_conflict_warning_decision_for_beta",
    ],
    deferrable: ["advanced_availability_engine", "bulk_assignment_optimization", "broad_assignment_directory"],
  },
  {
    id: "publication_lifecycle",
    title: "Publication lifecycle",
    statuses: ["blocked_by_dependency", "not_implemented", "beta_critical"],
    repositoryFindings: [
      "workspace and task/calendar lifecycles exist, but beta publication semantics need explicit review",
      "volunteer visibility must not depend on email delivery success",
      "assignments can exist before volunteer-facing publication only if hidden from public access until published/live",
    ],
    betaNeed:
      "Define and implement draft/private versus published/live truth before volunteers can see schedules.",
    blockers: [
      "calendar_item_publication_schema_or_mapping_decision",
      "volunteer_schedule_visibility_rule",
      "publication_mutation_boundary",
      "notification_separate_from_publication_truth",
    ],
    deferrable: ["multi_stage_approval_workflow", "scheduled_publication_jobs"],
  },
  {
    id: "volunteer_schedule_access",
    title: "Volunteer schedule access",
    statuses: [
      "persisted_backend_foundation_exists",
      "mock_prototype_ui_exists",
      "server_helper_boundary_exists_route_integration_missing",
      "beta_critical",
    ],
    repositoryFindings: [
      "mock /v/demo schedule exists and is not secure/persisted",
      "/respond/[token] securely verifies one assignment token and allows one assignment response",
      "assignment response-token infrastructure exists but admin product reveal remains boxed",
      "no persisted volunteer schedule/home route exists",
    ],
    betaNeed:
      "Use direct secure links as the primary account-light beta path; expose only the volunteer's published assignments in the correct workspace.",
    blockers: [
      "volunteer_schedule_token_or_access_model_decision",
      "published_assignment_scoped_schedule_read",
      "non_disclosing_unavailable_states",
      "secure_link_generation_boundary_for_notifications_without_reopening_admin_copy_ui",
    ],
    deferrable: ["manual_public_lookup", "remembered_device_behavior", "broad_volunteer_portal_account_model"],
  },
  {
    id: "confirm_deny",
    title: "Confirm/Deny",
    statuses: [
      "persisted_backend_foundation_exists",
      "server_helper_boundary_exists_route_integration_missing",
      "beta_critical",
    ],
    repositoryFindings: [
      "assignment_responses persist current needs_response/confirmed/declined truth",
      "/respond/[token] supports per-assignment Confirm/Deny",
      "Confirm All, denial notes policy, stale/passed assignment handling, and volunteer schedule integration remain missing",
    ],
    betaNeed:
      "Support per-assignment Confirm/Deny in the volunteer schedule and show accurate response state to authorized admins.",
    blockers: [
      "volunteer_schedule_response_integration",
      "confirm_all_decision_for_beta",
      "denial_note_storage_policy",
      "stale_expired_passed_assignment_cutoff_rules",
    ],
    deferrable: ["response_history_timeline", "advanced_reason_codes"],
  },
  {
    id: "initial_assignment_email",
    title: "Initial assignment email",
    statuses: ["mock_prototype_ui_exists", "not_implemented", "beta_critical"],
    repositoryFindings: [
      "Communications/reminders are mock-only and explicitly do not send real email",
      "no email provider, queue, duplicate-send guard, delivery audit, or recipient resolution is implemented",
      "response-link delivery remains separate from assignment-detail admin reveal/copy activation",
    ],
    betaNeed:
      "Add a minimum reliable initial assignment notification path with recipient resolution, secure schedule/action link, Follow-up Contact, duplicate prevention, and observable failure handling.",
    blockers: [
      "email_provider_and_environment_configuration",
      "recipient_resolution_from_volunteer_profiles",
      "secure_link_generation_for_email",
      "send_now_or_minimal_queue_decision",
      "duplicate_send_prevention",
      "delivery_attempt_observability",
    ],
    deferrable: [
      "full_communications_authoring",
      "automatic_reminder_cadence",
      "delivery_analytics",
      "announcement_blasts",
    ],
  },
  {
    id: "ui_integration",
    title: "UI integration",
    statuses: ["mock_prototype_ui_exists", "beta_critical", "blocked_by_dependency"],
    repositoryFindings: [
      "existing prototype and sample mockup images define the approved bright polished Project Local direction",
      "Calendar currently preserves the approved shell and persisted read behavior",
      "beta-critical admin/volunteer write and response surfaces are not yet visually integrated",
    ],
    betaNeed:
      "Integrate polish progressively into beta-critical surfaces, then perform one focused consolidation pass before launch.",
    blockers: [
      "calendar_create_edit_inspector_visual_integration",
      "volunteer_picker_visual_integration",
      "manual_add_edit_volunteer_visual_integration",
      "volunteer_schedule_and_response_visual_integration",
      "empty_unavailable_error_state_polish",
    ],
    deferrable: ["full_app_redesign", "non_beta_food_security_visual_rebuild", "all_mockup_image_coverage"],
  },
  {
    id: "production_readiness",
    title: "Production readiness",
    statuses: ["blocked_by_dependency", "not_implemented", "beta_critical"],
    repositoryFindings: [
      "local and hosted non-production validation patterns exist",
      "production Supabase/deployment/email/domain/observability/backup configuration is not yet beta-ready",
      "Belgrade Sheets/App Script remains the operational fallback",
    ],
    betaNeed:
      "Complete production environment, hosted validation, pilot testing, logging/error visibility, backup/recovery, mobile proof, and rollback/fallback plan before real Bozeman use.",
    blockers: [
      "production_supabase_environment",
      "deployment_environment_and_domain",
      "auth_email_configuration",
      "email_provider_secrets_and_suppression_policy",
      "hosted_validation_gates",
      "logging_error_observability",
      "backup_recovery_expectations",
      "realistic_pilot_test",
      "rollback_to_belgrade_sheets_fallback_plan",
    ],
    deferrable: ["multi_project_operations_runbook", "full_analytics", "advanced_admin_observability"],
  },
];

export const bozemanBetaBlockers = [
  "bozeman_workspace_provisioning_and_project_contact_grants",
  "manual_volunteer_add_edit_or_controlled_import",
  "calendar_create_edit_archive_publication_mutations",
  "draft_private_vs_published_live_visibility_truth",
  "volunteer_picker_and_assignment_create_cancel_ui",
  "secure_account_light_volunteer_schedule_access",
  "confirm_deny_integration_with_admin_visible_response_state",
  "basic_initial_assignment_email_delivery_boundary",
  "approved_ui_integration_for_beta_critical_surfaces",
  "production_supabase_deployment_auth_email_domain_observability_backup_validation",
];

export const bozemanBetaDeferredFeatures = [
  "belgrade_migration_from_sheets",
  "full_admin_tasks_route_cutover_if_not_needed_for_calendar_creation",
  "full_public_questionnaire_workflow",
  "manual_public_lookup",
  "remembered_devices",
  "response_link_admin_reveal_copy_activation",
  "full_communications_announcement_authoring",
  "automatic_reminder_engine",
  "delivery_analytics",
  "advanced_availability_conflict_engine",
  "drag_drop_resize_recurrence_calendar_persistence",
  "food_security_as_separate_modules",
  "needs_attention_persistence",
  "broad_assignment_directory",
];

export const bozemanBetaCriticalPath = [
  {
    order: 1,
    id: "bozeman_workspace_access_provisioning",
    milestone: "12.14",
    title: "Bozeman Workspace Access and Provisioning Readiness",
    unlocks: ["first_real_bozeman_volunteer_record", "all_beta_admin_access"],
  },
  {
    order: 2,
    id: "manual_volunteer_profile_entry",
    milestone: "12.15",
    title: "Manual Volunteer Profile Add/Edit Permanent Path",
    unlocks: ["first_real_bozeman_volunteer_record", "volunteer_picker_source"],
  },
  {
    order: 3,
    id: "calendar_write_foundation",
    milestone: "12.16",
    title: "Calendar Create/Edit Scheduled Item Implementation",
    unlocks: ["first_real_persisted_scheduled_item_created_from_product_ui"],
  },
  {
    order: 4,
    id: "calendar_task_preset_selector",
    milestone: "12.17",
    title: "Calendar Task Preset Selector and One-Off Definition Path",
    unlocks: ["preset_derived_and_one_off_scheduled_items"],
  },
  {
    order: 5,
    id: "assignment_picker_commands",
    milestone: "12.18",
    title: "Volunteer Assignment Picker and Create/Cancel Commands",
    unlocks: ["first_real_volunteer_assignment"],
  },
  {
    order: 6,
    id: "publication_lifecycle",
    milestone: "12.19",
    title: "Draft/Private Versus Published/Live Calendar Visibility",
    unlocks: ["first_published_volunteer_visible_assignment"],
  },
  {
    order: 7,
    id: "volunteer_schedule_access",
    milestone: "12.20",
    title: "Secure Account-Light Volunteer Schedule Access",
    unlocks: ["volunteer_can_view_own_published_assignments"],
  },
  {
    order: 8,
    id: "confirm_deny_round_trip",
    milestone: "12.21",
    title: "Volunteer Confirm/Deny Round Trip",
    unlocks: ["first_real_confirm_deny_round_trip", "admin_response_state_visibility"],
  },
  {
    order: 9,
    id: "initial_assignment_email",
    milestone: "12.22",
    title: "Initial Assignment Notification Email Boundary",
    unlocks: ["first_real_assignment_notification_email"],
  },
  {
    order: 10,
    id: "beta_ui_and_production_gate",
    milestone: "12.23",
    title: "Bozeman Beta UI Polish, Hosted Validation, and Launch Gate",
    unlocks: ["bozeman_beta_launch_candidate"],
  },
] as const;

export const bozemanBetaSafestFirsts = {
  firstRealBozemanVolunteerRecord:
    "provision Bozeman workspace/contact/grants, then add one volunteer through permanent volunteer_profile Add/Edit or controlled import path",
  firstRealPersistedScheduledItemCreatedFromProductUi:
    "keep /admin/calendar read route, add reviewed calendar.edit server action for one bounded create/edit path, then refresh the persisted route",
  firstRealVolunteerAssignment:
    "add volunteer picker read seam and assignments.edit create command for one active volunteer/item pair with duplicate prevention",
  firstPublishedVolunteerVisibleAssignment:
    "define publication visibility truth before email; assignment visibility must not depend on delivery success",
  firstRealConfirmDenyRoundTrip:
    "connect secure account-light volunteer schedule or token route to current assignment_responses without reopening admin response-link copy UI",
  firstRealAssignmentNotificationEmail:
    "send a basic initial assignment email with resolved recipient, secure schedule/action link, duplicate-send prevention, and safe failure observability",
} as const;

export const bozemanBetaValidationGates = [
  "static_regressions_for_new_boundaries",
  "local_disposable_validation_for_volunteer_calendar_assignment_public_response_email_boundaries",
  "hosted_validation_for_any_migration_rpc_generated_type_or_hosted_behavior_change",
  "browser_preview_desktop_and_390px_mobile_for_beta_critical_routes",
  "no_secret_output_redacted_supabase_diagnostics",
  "no_mock_persisted_truth_mixing",
  "unsafe_field_leakage_checks",
  "production_environment_secret_domain_email_auth_configuration_review",
  "pilot_test_with_disposable_or_approved_bozeman_data",
  "rollback_fallback_plan_with_belgrade_sheets_unmigrated",
];

export const bozemanBetaUiSequence = [
  "preserve_current_calendar_shell_while_adding_create_edit_inspector_polish",
  "volunteer_picker_and_manual_add_edit_volunteer_surfaces",
  "volunteer_schedule_home_assignment_detail_and_response_states",
  "initial_email_review_send_status_surfaces",
  "empty_loading_unavailable_error_state_consistency",
  "focused_beta_visual_consolidation_against_sample_mockup_images",
];

export const bozemanBetaOld12_14Decision = {
  oldRecommendedSlice: "12.14 Route-Unused Persisted Tasks Read Model Helper / Query-Shape Review",
  decision: "move_and_modify",
  rationale:
    "A full /admin/tasks persisted read helper remains useful, but it is not the highest-priority beta unblocker. Calendar writes can proceed with a narrower reviewed task-preset selector/read seam, while Bozeman workspace provisioning and volunteer data entry are more immediate critical-path blockers.",
  immediateNextImplementationSlice:
    "12.14 Bozeman Workspace Access and Provisioning Readiness",
  tasksHelperReturnPoint:
    "Revisit as a scoped Calendar task-preset selector seam before or during Calendar create/edit work, or as the full /admin/tasks helper after beta-critical scheduling is safe.",
} as const;

export const bozemanBetaRoadmap = {
  status: "roadmap_rebaseline_audit_only",
  target: BOZEMAN_BETA_TARGET_WORKSPACE,
  idealReadinessTarget: BOZEMAN_BETA_IDEAL_READINESS_TARGET,
  belgradeFallback: BELGRADE_REMAINS_SHEETS_FALLBACK,
  principle: BOZEMAN_BETA_PRINCIPLE,
  launchGate: bozemanBetaLaunchGate,
  domains: bozemanBetaAuditDomains,
  blockers: bozemanBetaBlockers,
  deferredFeatures: bozemanBetaDeferredFeatures,
  criticalPath: bozemanBetaCriticalPath,
  safestFirsts: bozemanBetaSafestFirsts,
  validationGates: bozemanBetaValidationGates,
  uiSequence: bozemanBetaUiSequence,
  old12_14Decision: bozemanBetaOld12_14Decision,
  implementationAddedInThisSlice: false,
  migrationAddedInThisSlice: false,
  hostedValidationRequiredForThisSlice: false,
} as const;

export function describeBozemanBetaRoadmap() {
  return {
    roadmapAvailable: BOZEMAN_BETA_ROADMAP_REBASELINE_AVAILABLE,
    target: BOZEMAN_BETA_TARGET_WORKSPACE,
    idealReadinessTarget: BOZEMAN_BETA_IDEAL_READINESS_TARGET,
    belgradeRemainsSheetsFallback: BELGRADE_REMAINS_SHEETS_FALLBACK,
    principle: BOZEMAN_BETA_PRINCIPLE,
    productImplementationStarted: BOZEMAN_BETA_PRODUCT_IMPLEMENTATION_STARTED,
    responseLinkActivationReopened: BOZEMAN_BETA_RESPONSE_LINK_ACTIVATION_REOPENED,
    serviceRoleShortcutAllowed: BOZEMAN_BETA_SERVICE_ROLE_SHORTCUT_ALLOWED,
    mockPersistedMixingAllowed: BOZEMAN_BETA_MOCK_PERSISTED_MIXING_ALLOWED,
    realEmailSendingAvailable: BOZEMAN_BETA_REAL_EMAIL_SENDING_AVAILABLE,
    productionDataAccessAvailable: BOZEMAN_BETA_PRODUCTION_DATA_ACCESS_AVAILABLE,
    domainCount: bozemanBetaAuditDomains.length,
    blockers: bozemanBetaBlockers,
    deferredFeatures: bozemanBetaDeferredFeatures,
    criticalPath: bozemanBetaCriticalPath,
    validationGates: bozemanBetaValidationGates,
    old12_14Decision: bozemanBetaOld12_14Decision,
  } as const;
}

export function evaluateBozemanBetaLaunchReadiness() {
  return {
    allowedToLaunch: false,
    blockers: bozemanBetaBlockers,
    immediateNextImplementationSlice:
      bozemanBetaOld12_14Decision.immediateNextImplementationSlice,
    old12_14Decision: bozemanBetaOld12_14Decision.decision,
    reason:
      "The repo has strong persisted foundations and a stabilized Calendar read cutover, but the Bozeman beta still lacks provisioning, volunteer entry, Calendar writes, assignment UI, publication visibility, secure volunteer schedule access, Confirm/Deny integration, email delivery, production environment gates, and beta-critical UI polish.",
  } as const;
}
