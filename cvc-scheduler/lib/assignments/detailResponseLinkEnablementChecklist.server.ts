import "server-only";

export const ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE = true;
export const ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE = false;
export const ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE = false;

export const assignmentDetailResponseLinkEnablementChecklist = {
  route: "/admin/assignments/[assignmentId]",
  currentStatus: "active_reveal_copy_and_linking_blocked",
  activationRule: "all_prerequisite_groups_must_be_true_before_any_active_flag_flips",
  prerequisiteGroups: {
    routeSafety: [
      "assignment_detail_route_remains_dynamic_no_store",
      "verified_project_contact_session_required",
      "persisted_assignment_detail_context_only",
      "non_disclosing_unavailable_state",
      "no_mock_fallback",
    ],
    entrySafety: [
      "future_entry_point_comes_from_persisted_authorized_assignment_context",
      "no_public_volunteer_respond_diagnostic_mock_or_anonymous_entry",
      "href_carries_only_admin_assignments_assignment_id_path",
      "no_query_hash_scope_token_capability_workspace_or_volunteer_data",
    ],
    actionSafety: [
      "explicit_post_server_action_only",
      "no_render_get_page_load_prefetch_hover_focus_or_effect_reveal",
      "browser_input_assignment_id_plus_optional_bounded_ttl_only",
      "route_calls_only_11_32_product_action_boundary",
      "no_direct_audited_reveal_rpc_token_replacement_table_or_service_role_path",
    ],
    uiSafety: [
      "assignment_specific_credential_warning",
      "visible_expiration",
      "disabled_unavailable_states_credential_free",
      "no_automatic_clipboard_write",
      "manual_copy_only_after_audited_success",
    ],
    credentialLogSafety: [
      "no_full_url_bearer_verifier_or_token_id_in_render_error_or_logs",
      "no_access_refresh_token_password_or_service_role_key_in_render_error_or_logs",
      "no_local_or_hosted_secrets_in_render_error_or_logs",
      "no_sql_detail_in_user_facing_errors",
      "no_sensitive_intake_or_unrelated_row_data_in_render_error_or_logs",
    ],
    browserProof: [
      "browser_test_proves_no_url_before_success",
      "desktop_and_390px_mobile_have_no_overflow_or_errors",
      "unavailable_state_reveals_no_response_link_capability_detail",
    ],
    productOwnerCheckpoint: [
      "explicit_later_product_owner_approval_required_before_active_flags_flip",
    ],
  },
  activeFlagsThatMustRemainFalse: [
    "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE",
    "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE",
    "ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE",
    "ASSIGNMENT_DETAIL_ROUTE_ENTRY_IMPLEMENTATION_AVAILABLE",
    "ASSIGNMENT_DETAIL_ROUTE_LINKED_FROM_PRODUCT_NAVIGATION",
    "RESPONSE_LINK_PRODUCT_ACTION_UI_IMPLEMENTATION_AVAILABLE",
    "RESPONSE_LINK_PRODUCT_ACTION_COPY_AFFORDANCE_AVAILABLE",
    "RESPONSE_LINK_PRODUCT_SURFACE_IMPLEMENTATION_AVAILABLE",
    "RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE",
  ],
} as const;

export type AssignmentDetailResponseLinkEnablementReadiness = Readonly<{
  routeSafety: boolean;
  entrySafety: boolean;
  actionSafety: boolean;
  uiSafety: boolean;
  credentialLogSafety: boolean;
  browserProof: boolean;
  productOwnerCheckpoint: boolean;
}>;

export function describeAssignmentDetailResponseLinkEnablementChecklist() {
  return {
    checklistAvailable: ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE,
    activeRevealAvailable: ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_REVEAL_AVAILABLE,
    activeCopyAvailable: ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_COPY_AVAILABLE,
    activeEntryLinkingAvailable:
      ASSIGNMENT_DETAIL_ACTIVE_RESPONSE_LINK_ENTRY_LINKING_AVAILABLE,
    checklist: assignmentDetailResponseLinkEnablementChecklist,
  } as const;
}

export function evaluateAssignmentDetailResponseLinkEnablement(
  readiness: AssignmentDetailResponseLinkEnablementReadiness,
) {
  const blockers: string[] = [];
  if (!readiness.routeSafety) blockers.push("route_safety_incomplete");
  if (!readiness.entrySafety) blockers.push("entry_safety_incomplete");
  if (!readiness.actionSafety) blockers.push("action_safety_incomplete");
  if (!readiness.uiSafety) blockers.push("ui_safety_incomplete");
  if (!readiness.credentialLogSafety) blockers.push("credential_log_safety_incomplete");
  if (!readiness.browserProof) blockers.push("browser_proof_incomplete");
  if (!readiness.productOwnerCheckpoint) {
    blockers.push("product_owner_checkpoint_missing");
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

  return { allowed: blockers.length === 0, blockers } as const;
}

export function getAssignmentDetailResponseLinkEnablementPrerequisiteGroups() {
  return assignmentDetailResponseLinkEnablementChecklist.prerequisiteGroups;
}
