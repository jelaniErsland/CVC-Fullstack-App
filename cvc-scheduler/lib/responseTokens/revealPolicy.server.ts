import "server-only";

import {
  normalizeResponseLinkTtlHours,
  ResponseLinkPolicyError,
} from "./policy.ts";

export const RESPONSE_LINK_REVEAL_AUDIT_PERSISTENCE_AVAILABLE = true;
export const RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE = false;
export const RESPONSE_LINK_REVEAL_AUDIT_METADATA_MAX_KEYS = 3;
export const RESPONSE_LINK_REVEAL_AUDIT_REASON_CODE_MAX_LENGTH = 50;

export const RESPONSE_LINK_REVEAL_AUDIT_EVENT_FIELDS = [
  "workspaceId",
  "assignmentId",
  "responseTokenId",
  "actorProjectContactId",
  "action",
  "revealSurface",
  "mode",
  "expiresAt",
  "occurredAt",
  "metadata",
] as const;

export const RESPONSE_LINK_REVEAL_AUDIT_PROHIBITED_FIELDS = [
  "rawBearer",
  "fullResponseUrl",
  "tokenVerifierHash",
  "password",
  "accessToken",
  "refreshToken",
  "serviceRoleKey",
  "volunteerEmergencyContact",
  "questionnaireAnswers",
] as const;

export const RESPONSE_LINK_REVEAL_MODES = [
  "copy_link",
  "email_delivery",
  "reminder_delivery",
] as const;

export const responseLinkRevealPolicy = {
  allowedFutureSurface: "future_project_contact_assignment_response_reveal",
  auditAction: "response_link_revealed",
  currentStatus: "blocked_explicit_product_surface_missing",
  requestMethod: "POST",
  rendering: "dynamic_no_store",
  credentialResponse: "explicit_server_action_response_only",
  trustedOriginSource: "server_configuration_only",
  clipboardRule: "only_after_successful_audited_reveal",
  automaticLogging: "prohibited",
  currentDisallowedSurfaces: [
    "admin_response_link_diagnostic",
    "public_assignment_response",
    "calendar",
    "volunteers",
    "communications",
    "needs_attention",
    "public_volunteer_preview",
    "hosted_validation_gate",
  ],
} as const;

export type PlannedResponseLinkRevealMode =
  (typeof RESPONSE_LINK_REVEAL_MODES)[number];

export type PlannedResponseLinkRevealAuditEvent = Readonly<{
  workspaceId: string;
  assignmentId: string;
  responseTokenId: string;
  actorProjectContactId: string;
  action: "response_link_revealed";
  revealSurface: "future_project_contact_assignment_response_reveal";
  mode: PlannedResponseLinkRevealMode;
  expiresAt: string;
  occurredAt: string;
  metadata: Readonly<{
    reason_code?: string;
    delivery_requested?: boolean;
    request_correlation_id?: string;
  }>;
}>;

export type CurrentResponseLinkSurface =
  (typeof responseLinkRevealPolicy.currentDisallowedSurfaces)[number];

export type FutureResponseLinkRevealReadiness = Readonly<{
  surface: "future_project_contact_assignment_response_reveal";
  verifiedProjectContactSession: boolean;
  assignmentsEditAuthorizedByDatabase: boolean;
  atomicReplacementCompleted: boolean;
  trustedServerOrigin: boolean;
  explicitUserAction: boolean;
  auditEventPersisted: boolean;
  automaticLoggingDisabled: boolean;
  postRequest: boolean;
  dynamicNoStoreResponse: boolean;
  clipboardDeferredUntilReveal: boolean;
  expiresInHours?: unknown;
}>;

export function describeResponseLinkRevealPrerequisites() {
  return {
    policy: responseLinkRevealPolicy,
    auditPersistenceAvailable: RESPONSE_LINK_REVEAL_AUDIT_PERSISTENCE_AVAILABLE,
    productSurfaceAvailable: RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE,
    auditBounds: {
      metadataMaxKeys: RESPONSE_LINK_REVEAL_AUDIT_METADATA_MAX_KEYS,
      reasonCodeMaxLength: RESPONSE_LINK_REVEAL_AUDIT_REASON_CODE_MAX_LENGTH,
    },
    auditEventFields: RESPONSE_LINK_REVEAL_AUDIT_EVENT_FIELDS,
    prohibitedAuditFields: RESPONSE_LINK_REVEAL_AUDIT_PROHIBITED_FIELDS,
  } as const;
}

export function canCurrentSurfaceRevealFullResponseLink(
  surface: CurrentResponseLinkSurface,
) {
  void surface;
  return false as const;
}

export function evaluateFutureResponseLinkReveal(
  input: FutureResponseLinkRevealReadiness,
) {
  const blockers: string[] = [];

  if (input.surface !== responseLinkRevealPolicy.allowedFutureSurface) {
    blockers.push("surface_not_allowed");
  }
  if (!input.verifiedProjectContactSession) blockers.push("verified_contact_required");
  if (!input.assignmentsEditAuthorizedByDatabase) {
    blockers.push("assignments_edit_required");
  }
  if (!input.atomicReplacementCompleted) blockers.push("atomic_replacement_required");
  if (!input.trustedServerOrigin) blockers.push("trusted_server_origin_required");
  if (!input.explicitUserAction) blockers.push("explicit_user_action_required");
  if (!input.auditEventPersisted) blockers.push("audit_event_write_required");
  if (!input.automaticLoggingDisabled) blockers.push("automatic_logging_must_be_disabled");
  if (!input.postRequest) blockers.push("post_request_required");
  if (!input.dynamicNoStoreResponse) blockers.push("dynamic_no_store_required");
  if (!input.clipboardDeferredUntilReveal) {
    blockers.push("clipboard_must_follow_audited_reveal");
  }

  try {
    normalizeResponseLinkTtlHours("product", input.expiresInHours);
  } catch (error) {
    if (error instanceof ResponseLinkPolicyError) blockers.push("product_ttl_invalid");
    else throw error;
  }

  if (!RESPONSE_LINK_REVEAL_AUDIT_PERSISTENCE_AVAILABLE) {
    blockers.push("audit_persistence_boundary_missing");
  }
  if (!RESPONSE_LINK_REVEAL_PRODUCT_SURFACE_AVAILABLE) {
    blockers.push("explicit_product_surface_missing");
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  } as const;
}
