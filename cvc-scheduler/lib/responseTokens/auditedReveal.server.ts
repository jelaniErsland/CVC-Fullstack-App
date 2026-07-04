import "server-only";

import {
  redactAssignmentResponseLink,
  validateResponseLinkBaseUrl,
} from "@/lib/responseTokens/link";
import {
  normalizeResponseLinkTtlHours,
} from "@/lib/responseTokens/policy";
import {
  RESPONSE_LINK_REVEAL_AUDIT_METADATA_MAX_KEYS,
  RESPONSE_LINK_REVEAL_AUDIT_REASON_CODE_MAX_LENGTH,
  RESPONSE_LINK_REVEAL_MODES,
  responseLinkRevealPolicy,
  type PlannedResponseLinkRevealMode,
} from "@/lib/responseTokens/revealPolicy.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";

export type CreateAuditedAssignmentResponseLinkRevealInput = Readonly<{
  assignmentId: string;
  expiresInHours?: number;
  revealMode: PlannedResponseLinkRevealMode;
  metadata?: Readonly<{
    reason_code?: string;
    delivery_requested?: boolean;
    request_correlation_id?: string;
  }> | null;
  baseUrl: string;
}>;

export type AuditedAssignmentResponseLinkReveal = Readonly<{
  responseUrl: string;
  redactedUrl: string;
  expiresAt: string;
  responseTokenId: string;
  auditEventId: string;
  revealMode: PlannedResponseLinkRevealMode;
}>;

export class AuditedResponseLinkRevealValidationError extends Error {
  constructor() {
    super("Audited assignment response link reveal input is invalid.");
    this.name = "AuditedResponseLinkRevealValidationError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMetadata(value: unknown) {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new AuditedResponseLinkRevealValidationError();

  const entries = Object.entries(value);
  if (
    entries.length > RESPONSE_LINK_REVEAL_AUDIT_METADATA_MAX_KEYS ||
    entries.some(([key]) =>
      !["reason_code", "delivery_requested", "request_correlation_id"].includes(key),
    ) ||
    ("reason_code" in value &&
      (typeof value.reason_code !== "string" ||
        !new RegExp(
          `^[a-z0-9_]{1,${RESPONSE_LINK_REVEAL_AUDIT_REASON_CODE_MAX_LENGTH}}$`,
        ).test(value.reason_code))) ||
    ("delivery_requested" in value && typeof value.delivery_requested !== "boolean") ||
    ("request_correlation_id" in value &&
      (typeof value.request_correlation_id !== "string" ||
        !uuidPattern.test(value.request_correlation_id)))
  ) {
    throw new AuditedResponseLinkRevealValidationError();
  }

  const normalized = Object.fromEntries(entries) as {
    reason_code?: string;
    delivery_requested?: boolean;
    request_correlation_id?: string;
  };
  if (new TextEncoder().encode(JSON.stringify(normalized)).length > 2000) {
    throw new AuditedResponseLinkRevealValidationError();
  }
  return normalized;
}

function normalizeInput(input: unknown) {
  if (!isRecord(input)) throw new AuditedResponseLinkRevealValidationError();
  if (
    Object.keys(input).some(
      (key) =>
        !["assignmentId", "expiresInHours", "revealMode", "metadata", "baseUrl"].includes(
          key,
        ),
    ) ||
    typeof input.assignmentId !== "string" ||
    !uuidPattern.test(input.assignmentId.trim()) ||
    typeof input.revealMode !== "string" ||
    !RESPONSE_LINK_REVEAL_MODES.includes(input.revealMode as PlannedResponseLinkRevealMode)
  ) {
    throw new AuditedResponseLinkRevealValidationError();
  }

  let expiresInHours: number;
  let baseUrl: string;
  try {
    expiresInHours = normalizeResponseLinkTtlHours("product", input.expiresInHours);
    baseUrl = validateResponseLinkBaseUrl(input.baseUrl);
  } catch {
    throw new AuditedResponseLinkRevealValidationError();
  }

  return {
    assignmentId: input.assignmentId.trim().toLowerCase(),
    expiresInHours,
    revealMode: input.revealMode as PlannedResponseLinkRevealMode,
    metadata: normalizeMetadata(input.metadata),
    baseUrl,
  } as const;
}

function parseResult(
  value: unknown,
  baseUrl: string,
  expectedMode: PlannedResponseLinkRevealMode,
): AuditedAssignmentResponseLinkReveal {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new Error("Audited response link reveal returned an invalid result.");
  }
  const row = value[0];
  if (
    typeof row.response_token_id !== "string" ||
    !uuidPattern.test(row.response_token_id) ||
    typeof row.audit_event_id !== "string" ||
    !uuidPattern.test(row.audit_event_id) ||
    typeof row.token_expires_at !== "string" ||
    !Number.isFinite(Date.parse(row.token_expires_at)) ||
    typeof row.bearer_token !== "string" ||
    !bearerPattern.test(row.bearer_token) ||
    row.event_reveal_surface !== responseLinkRevealPolicy.allowedFutureSurface ||
    row.event_reveal_mode !== expectedMode
  ) {
    throw new Error("Audited response link reveal returned an invalid result.");
  }

  const responseUrl = new URL(
    `/respond/${encodeURIComponent(row.bearer_token)}`,
    baseUrl,
  ).toString();
  return {
    responseUrl,
    redactedUrl: redactAssignmentResponseLink(responseUrl),
    expiresAt: row.token_expires_at,
    responseTokenId: row.response_token_id.toLowerCase(),
    auditEventId: row.audit_event_id.toLowerCase(),
    revealMode: expectedMode,
  };
}

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Audited reveal requires an authenticated contact.");
}

export async function createAuditedAssignmentResponseLinkRevealWithClient(
  supabase: AppSupabaseClient,
  input: CreateAuditedAssignmentResponseLinkRevealInput | unknown,
) {
  await requireAuthenticatedContact(supabase);
  const request = normalizeInput(input);
  const { data, error } = await supabase.rpc(
    "reveal_assignment_response_link",
    {
      p_assignment_id: request.assignmentId,
      p_ttl_hours: request.expiresInHours,
      p_reveal_mode: request.revealMode,
      p_metadata: request.metadata,
    } as PublicRpcArgs<"reveal_assignment_response_link">,
  );
  if (error) {
    throw new Error("Audited assignment response link could not be revealed.", {
      cause: error,
    });
  }
  return parseResult(data, request.baseUrl, request.revealMode);
}

export async function createAuditedAssignmentResponseLinkReveal(
  input: CreateAuditedAssignmentResponseLinkRevealInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return createAuditedAssignmentResponseLinkRevealWithClient(supabase, input);
}
