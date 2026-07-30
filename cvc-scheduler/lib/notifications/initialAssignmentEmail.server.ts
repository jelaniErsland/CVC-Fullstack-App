import "server-only";

import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";

import { validateResponseLinkBaseUrl } from "../responseTokens/link.ts";

export const INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION = "initial-assignment.v1";
export const INITIAL_ASSIGNMENT_EMAIL_KIND = "initial_assignment";

export type InitialAssignmentEmailConfiguration =
  | Readonly<{
      ok: true;
      origin: string;
      transport: "recording";
      from: string;
      recordingPath: string;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "transport_disabled"
        | "origin_unavailable"
        | "from_unavailable"
        | "recording_path_unavailable";
    }>;

export type InitialAssignmentEmailInput = Readonly<{
  deliveryId: string;
  assignmentId: string;
  idempotencyKey: string;
  recipientEmail: string;
  volunteerDisplayName: string;
  workspaceDisplayName: string;
  taskTitle: string;
  taskType: string;
  scheduleDate: string;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  scheduleNotes: string | null;
  followUpContact: Readonly<{
    displayName: string;
    email: string;
    phone: string | null;
  }>;
  scheduleAccessUrl: string;
  tokenExpiresAt: string;
  templateVersion: typeof INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION;
}>;

export type InitialAssignmentEmailSendResult =
  | Readonly<{ ok: true; providerMessageId: string }>
  | Readonly<{ ok: false; safeFailureCode: "provider_send_failed" }>;

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 254 || !emailPattern.test(normalized)) {
    return null;
  }
  return normalized;
}

export function readInitialAssignmentEmailConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): InitialAssignmentEmailConfiguration {
  const transport = environment.ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT?.trim();
  if (transport !== "recording") {
    return { ok: false, reason: "transport_disabled" };
  }

  let origin: string;
  try {
    origin = validateResponseLinkBaseUrl(
      environment.ASSIGNMENT_NOTIFICATION_BASE_URL?.trim(),
    );
  } catch {
    return { ok: false, reason: "origin_unavailable" };
  }

  const from = normalizeEmail(environment.ASSIGNMENT_NOTIFICATION_FROM);
  if (!from) return { ok: false, reason: "from_unavailable" };

  const recordingPath = environment.ASSIGNMENT_NOTIFICATION_RECORDING_PATH?.trim();
  if (!recordingPath) return { ok: false, reason: "recording_path_unavailable" };

  return {
    ok: true,
    origin,
    transport: "recording",
    from,
    recordingPath,
  };
}

export function buildVolunteerScheduleAccessUrl(input: {
  origin: string;
  token: string;
}) {
  return new URL(`/v/access/${encodeURIComponent(input.token)}`, input.origin).toString();
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function validateSafeMessage(input: InitialAssignmentEmailInput) {
  if (
    !input.deliveryId ||
    !input.assignmentId ||
    !input.idempotencyKey ||
    !normalizeEmail(input.recipientEmail) ||
    !input.volunteerDisplayName.trim() ||
    !input.workspaceDisplayName.trim() ||
    !input.taskTitle.trim() ||
    !input.followUpContact.displayName.trim() ||
    !normalizeEmail(input.followUpContact.email) ||
    input.templateVersion !== INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION
  ) {
    return false;
  }

  try {
    const url = new URL(input.scheduleAccessUrl);
    return /^\/v\/access\/[A-Za-z0-9_-]{43}$/.test(url.pathname);
  } catch {
    return false;
  }
}

export async function sendInitialAssignmentEmail(
  configuration: InitialAssignmentEmailConfiguration,
  input: InitialAssignmentEmailInput,
): Promise<InitialAssignmentEmailSendResult> {
  if (!configuration.ok || !validateSafeMessage(input)) {
    return { ok: false, safeFailureCode: "provider_send_failed" };
  }

  const providerMessageId = `recording-${hash(input.idempotencyKey).slice(0, 24)}`;
  const record = {
    kind: INITIAL_ASSIGNMENT_EMAIL_KIND,
    templateVersion: input.templateVersion,
    deliveryId: input.deliveryId,
    assignmentId: input.assignmentId,
    providerMessageId,
    idempotencyKeyHash: hash(input.idempotencyKey),
    recipientEmailHash: hash(input.recipientEmail),
    fromEmailHash: hash(configuration.from),
    workspaceDisplayName: input.workspaceDisplayName,
    taskTitle: input.taskTitle,
    taskType: input.taskType,
    scheduleDate: input.scheduleDate,
    scheduleStartTime: input.scheduleStartTime,
    scheduleEndTime: input.scheduleEndTime,
    followUpContactDisplayName: input.followUpContact.displayName,
    followUpContactEmailHash: hash(input.followUpContact.email),
    hasFollowUpContactPhone: Boolean(input.followUpContact.phone),
    scheduleAccessPath: "/v/access/[redacted]",
    tokenExpiresAt: input.tokenExpiresAt,
  };

  try {
    await appendFile(configuration.recordingPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
    });
    return { ok: true, providerMessageId };
  } catch {
    return { ok: false, safeFailureCode: "provider_send_failed" };
  }
}
