import "server-only";

import {
  RESPONSE_LINK_REVEAL_AUDIT_METADATA_MAX_KEYS,
  RESPONSE_LINK_REVEAL_AUDIT_REASON_CODE_MAX_LENGTH,
  RESPONSE_LINK_REVEAL_MODES,
  responseLinkRevealPolicy,
  type PlannedResponseLinkRevealMode,
} from "@/lib/responseTokens/revealPolicy.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";

export type RecordAssignmentResponseLinkRevealAuditInput = Readonly<{
  assignmentId: string;
  responseTokenId: string;
  revealSurface: "future_project_contact_assignment_response_reveal";
  revealMode: PlannedResponseLinkRevealMode;
  expiresAt: string;
  metadata?: Readonly<{
    reason_code?: string;
    delivery_requested?: boolean;
    request_correlation_id?: string;
  }> | null;
}>;

export type AssignmentResponseLinkRevealAuditEvent = Readonly<{
  eventId: string;
  assignmentId: string;
  responseTokenId: string;
  actorProjectContactId: string;
  action: "response_link_revealed";
  revealSurface: "future_project_contact_assignment_response_reveal";
  revealMode: PlannedResponseLinkRevealMode;
  expiresAt: string;
  occurredAt: string;
  metadata: Readonly<{
    reason_code?: string;
    delivery_requested?: boolean;
    request_correlation_id?: string;
  }>;
}>;

export class ResponseLinkRevealAuditValidationError extends Error {
  constructor() {
    super("Response link reveal audit input is invalid.");
    this.name = "ResponseLinkRevealAuditValidationError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMetadata(value: unknown) {
  if (value === undefined || value === null) return {};
  if (!isRecord(value)) throw new ResponseLinkRevealAuditValidationError();

  const entries = Object.entries(value);
  if (
    entries.length > RESPONSE_LINK_REVEAL_AUDIT_METADATA_MAX_KEYS ||
    entries.some(([key]) =>
      !["reason_code", "delivery_requested", "request_correlation_id"].includes(key),
    ) ||
    ("reason_code" in value &&
      (typeof value.reason_code !== "string" ||
        !new RegExp(`^[a-z0-9_]{1,${RESPONSE_LINK_REVEAL_AUDIT_REASON_CODE_MAX_LENGTH}}$`).test(
          value.reason_code,
        ))) ||
    ("delivery_requested" in value && typeof value.delivery_requested !== "boolean") ||
    ("request_correlation_id" in value &&
      (typeof value.request_correlation_id !== "string" ||
        !uuidPattern.test(value.request_correlation_id)))
  ) {
    throw new ResponseLinkRevealAuditValidationError();
  }

  const normalized = Object.fromEntries(entries) as {
    reason_code?: string;
    delivery_requested?: boolean;
    request_correlation_id?: string;
  };
  if (new TextEncoder().encode(JSON.stringify(normalized)).length > 2000) {
    throw new ResponseLinkRevealAuditValidationError();
  }
  return normalized;
}

function normalizeInput(input: unknown) {
  if (!isRecord(input)) throw new ResponseLinkRevealAuditValidationError();
  if (
    Object.keys(input).some(
      (key) =>
        ![
          "assignmentId",
          "responseTokenId",
          "revealSurface",
          "revealMode",
          "expiresAt",
          "metadata",
        ].includes(key),
    ) ||
    typeof input.assignmentId !== "string" ||
    !uuidPattern.test(input.assignmentId.trim()) ||
    typeof input.responseTokenId !== "string" ||
    !uuidPattern.test(input.responseTokenId.trim()) ||
    input.revealSurface !== responseLinkRevealPolicy.allowedFutureSurface ||
    typeof input.revealMode !== "string" ||
    !RESPONSE_LINK_REVEAL_MODES.includes(input.revealMode as PlannedResponseLinkRevealMode) ||
    typeof input.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(input.expiresAt)) ||
    Date.parse(input.expiresAt) <= Date.now()
  ) {
    throw new ResponseLinkRevealAuditValidationError();
  }

  return {
    assignmentId: input.assignmentId.trim().toLowerCase(),
    responseTokenId: input.responseTokenId.trim().toLowerCase(),
    revealSurface: input.revealSurface,
    revealMode: input.revealMode as PlannedResponseLinkRevealMode,
    expiresAt: input.expiresAt,
    metadata: normalizeMetadata(input.metadata),
  } as const;
}

function parseAuditEvent(value: unknown): AssignmentResponseLinkRevealAuditEvent {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new Error("Response link reveal audit returned an invalid result.");
  }
  const row = value[0];
  if (
    typeof row.event_id !== "string" ||
    !uuidPattern.test(row.event_id) ||
    typeof row.assignment_reference !== "string" ||
    !uuidPattern.test(row.assignment_reference) ||
    typeof row.response_token_reference !== "string" ||
    !uuidPattern.test(row.response_token_reference) ||
    typeof row.actor_project_contact_reference !== "string" ||
    !uuidPattern.test(row.actor_project_contact_reference) ||
    row.event_action !== "response_link_revealed" ||
    row.event_reveal_surface !== responseLinkRevealPolicy.allowedFutureSurface ||
    typeof row.event_reveal_mode !== "string" ||
    !RESPONSE_LINK_REVEAL_MODES.includes(
      row.event_reveal_mode as PlannedResponseLinkRevealMode,
    ) ||
    typeof row.token_expires_at !== "string" ||
    !Number.isFinite(Date.parse(row.token_expires_at)) ||
    typeof row.event_occurred_at !== "string" ||
    !Number.isFinite(Date.parse(row.event_occurred_at)) ||
    !isRecord(row.event_metadata)
  ) {
    throw new Error("Response link reveal audit returned an invalid result.");
  }

  return {
    eventId: row.event_id.toLowerCase(),
    assignmentId: row.assignment_reference.toLowerCase(),
    responseTokenId: row.response_token_reference.toLowerCase(),
    actorProjectContactId: row.actor_project_contact_reference.toLowerCase(),
    action: "response_link_revealed",
    revealSurface: responseLinkRevealPolicy.allowedFutureSurface,
    revealMode: row.event_reveal_mode as PlannedResponseLinkRevealMode,
    expiresAt: row.token_expires_at,
    occurredAt: row.event_occurred_at,
    metadata: normalizeMetadata(row.event_metadata),
  };
}

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Reveal audit requires an authenticated contact.");
}

export async function recordAssignmentResponseLinkRevealAuditWithClient(
  supabase: AppSupabaseClient,
  input: RecordAssignmentResponseLinkRevealAuditInput | unknown,
) {
  await requireAuthenticatedContact(supabase);
  const request = normalizeInput(input);
  const { data, error } = await supabase.rpc(
    "record_assignment_response_link_reveal_event",
    {
      p_assignment_id: request.assignmentId,
      p_response_token_id: request.responseTokenId,
      p_reveal_surface: request.revealSurface,
      p_reveal_mode: request.revealMode,
      p_expires_at: request.expiresAt,
      p_metadata: request.metadata,
    } as PublicRpcArgs<"record_assignment_response_link_reveal_event">,
  );
  if (error) {
    throw new Error("Response link reveal audit could not be recorded.", {
      cause: error,
    });
  }
  return parseAuditEvent(data);
}

export async function recordAssignmentResponseLinkRevealAudit(
  input: RecordAssignmentResponseLinkRevealAuditInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return recordAssignmentResponseLinkRevealAuditWithClient(supabase, input);
}
