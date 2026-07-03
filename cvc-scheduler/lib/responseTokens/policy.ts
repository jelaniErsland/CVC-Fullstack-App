import "server-only";

export const PRODUCT_RESPONSE_LINK_DEFAULT_TTL_HOURS = 72;
export const PRODUCT_RESPONSE_LINK_MAXIMUM_TTL_HOURS = 168;
export const DIAGNOSTIC_RESPONSE_LINK_TTL_HOURS = 1;

export const RESPONSE_LINK_REPLACEMENT_POLICY = {
  rule: "revoke_active_same_assignment_and_purpose_before_replacement",
  enforcement: "future_atomic_database_command_required",
  revocationFailure: "fail_closed_without_issuing_or_revealing_a_replacement",
} as const;

export const RESPONSE_LINK_AUDIT_RETENTION = {
  strategy: "retain_hash_only_token_rows_without_automatic_deletion",
  fields: [
    "id",
    "workspace_id",
    "assignment_id",
    "volunteer_profile_id",
    "purpose",
    "token_verifier_hash",
    "created_by_auth_user_id",
    "created_at",
    "expires_at",
    "revoked_at",
    "last_used_at",
    "internal_note",
  ],
  prohibitedValues: ["raw_bearer", "full_response_url"],
} as const;

export const FULL_RESPONSE_LINK_EXPOSURE_POLICY = {
  allowedLayer: "future_explicit_product_issuance_surface",
  requiredConditions: [
    "atomic_replacement_completed",
    "verified_project_contact",
    "assignments_edit_authorized",
    "explicit_credential_reveal",
    "automatic_logging_disabled",
  ],
  diagnosticBehavior: "redacted_only_and_immediately_revoked",
} as const;

export const RESPONSE_LINK_DELIVERY_PREREQUISITES = [
  "atomic_same_assignment_purpose_replacement_command",
  "explicit_audited_product_reveal_surface",
  "delivery_provider_boundary_and_delivery_audit",
  "revocation_failure_recovery",
  "rate_limit_and_abuse_controls",
] as const;

export type ResponseLinkUsageMode = "product" | "diagnostic";
export type ResponseLinkExposureSurface =
  | "diagnostic"
  | "public_response_route"
  | "future_product_issuance";

export class ResponseLinkPolicyError extends Error {
  constructor() {
    super("Assignment response link policy rejected the request.");
    this.name = "ResponseLinkPolicyError";
  }
}

export function normalizeResponseLinkTtlHours(
  mode: ResponseLinkUsageMode,
  requestedTtlHours?: unknown,
) {
  const defaultTtl =
    mode === "diagnostic"
      ? DIAGNOSTIC_RESPONSE_LINK_TTL_HOURS
      : PRODUCT_RESPONSE_LINK_DEFAULT_TTL_HOURS;
  const maximumTtl =
    mode === "diagnostic"
      ? DIAGNOSTIC_RESPONSE_LINK_TTL_HOURS
      : PRODUCT_RESPONSE_LINK_MAXIMUM_TTL_HOURS;
  const ttl = requestedTtlHours === undefined ? defaultTtl : requestedTtlHours;

  if (typeof ttl !== "number" || !Number.isInteger(ttl) || ttl < 1 || ttl > maximumTtl) {
    throw new ResponseLinkPolicyError();
  }

  return ttl;
}

export function describeResponseLinkReplacementPolicy() {
  return RESPONSE_LINK_REPLACEMENT_POLICY;
}

export function mayExposeFullAssignmentResponseLink(input: Readonly<{
  surface: ResponseLinkExposureSurface;
  atomicReplacementCompleted: boolean;
  verifiedProjectContact: boolean;
  assignmentsEditAuthorized: boolean;
  explicitCredentialReveal: boolean;
  automaticLoggingDisabled: boolean;
}>) {
  return (
    input.surface === "future_product_issuance" &&
    input.atomicReplacementCompleted &&
    input.verifiedProjectContact &&
    input.assignmentsEditAuthorized &&
    input.explicitCredentialReveal &&
    input.automaticLoggingDisabled
  );
}
