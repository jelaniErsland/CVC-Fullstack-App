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
      ok: true;
      origin: string;
      transport: "resend";
      from: string;
      apiKey: string;
    }>
  | Readonly<{
      ok: false;
      reason:
        | "transport_disabled"
        | "transport_unsupported"
        | "origin_unavailable"
        | "from_unavailable"
        | "recording_path_unavailable"
        | "resend_api_key_unavailable";
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
const senderAddressPattern =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const senderDisplayNamePattern =
  /^[A-Za-z0-9](?:[A-Za-z0-9 .&'()/-]*[A-Za-z0-9.)'])?$/;
const senderControlCharacterPattern = /[\u0000-\u001f\u007f]/;
const maximumSenderDisplayNameLength = 100;
const maximumSenderMailboxLength = 320;
const providerMessageIdPattern = /^[A-Za-z0-9._:-]{1,200}$/;
const resendApiUrl = "https://api.resend.com/emails";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InitialAssignmentEmailRuntime = Readonly<{
  fetch: typeof fetch;
}>;

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 254 || !emailPattern.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeSenderAddress(value: string) {
  const normalized = normalizeEmail(value);
  if (!normalized || !senderAddressPattern.test(normalized)) return null;
  const localPart = normalized.slice(0, normalized.indexOf("@"));
  return localPart.length <= 64 ? normalized : null;
}

function normalizeSenderMailbox(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length < 3 ||
    normalized.length > maximumSenderMailboxLength ||
    senderControlCharacterPattern.test(normalized)
  ) {
    return null;
  }

  if (!normalized.includes("<") && !normalized.includes(">")) {
    return normalizeSenderAddress(normalized);
  }

  const angleAddress = /^(.+?) <([^<>]+)>$/.exec(normalized);
  if (!angleAddress) return null;
  const displayName = angleAddress[1];
  const address = normalizeSenderAddress(angleAddress[2]);
  if (
    !address ||
    displayName.length > maximumSenderDisplayNameLength ||
    !senderDisplayNamePattern.test(displayName)
  ) {
    return null;
  }

  return `${displayName} <${address}>`;
}

function normalizeResendApiKey(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length < 12 ||
    normalized.length > 512 ||
    !/^re_[^\s\u0000-\u001f\u007f]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function readInitialAssignmentEmailConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): InitialAssignmentEmailConfiguration {
  const transport = environment.ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT?.trim();
  if (!transport || transport === "disabled") {
    return { ok: false, reason: "transport_disabled" };
  }
  if (transport !== "recording" && transport !== "resend") {
    return { ok: false, reason: "transport_unsupported" };
  }

  let origin: string;
  try {
    origin = validateResponseLinkBaseUrl(
      environment.ASSIGNMENT_NOTIFICATION_BASE_URL?.trim(),
    );
  } catch {
    return { ok: false, reason: "origin_unavailable" };
  }
  if (transport === "resend" && !origin.startsWith("https://")) {
    return { ok: false, reason: "origin_unavailable" };
  }

  const from = normalizeSenderMailbox(environment.ASSIGNMENT_NOTIFICATION_FROM);
  if (!from) return { ok: false, reason: "from_unavailable" };

  if (transport === "resend") {
    const apiKey = normalizeResendApiKey(environment.RESEND_API_KEY);
    if (!apiKey) return { ok: false, reason: "resend_api_key_unavailable" };

    return {
      ok: true,
      origin,
      transport,
      from,
      apiKey,
    };
  }

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

export function buildResendInitialAssignmentIdempotencyKey(
  input: Pick<InitialAssignmentEmailInput, "idempotencyKey">,
) {
  return `project-local/initial-assignment/${hash(input.idempotencyKey).slice(0, 48)}`;
}

function validateSafeMessage(
  configuration: Extract<InitialAssignmentEmailConfiguration, { ok: true }>,
  input: InitialAssignmentEmailInput,
) {
  if (
    !uuidPattern.test(input.deliveryId) ||
    !uuidPattern.test(input.assignmentId) ||
    input.idempotencyKey !==
      `${INITIAL_ASSIGNMENT_EMAIL_KIND}:${INITIAL_ASSIGNMENT_EMAIL_TEMPLATE_VERSION}:${input.assignmentId}` ||
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
    return (
      url.origin === configuration.origin &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/v\/access\/[A-Za-z0-9_-]{43}$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return escaped[character];
  });
}

function scheduleTimeLabel(input: InitialAssignmentEmailInput) {
  if (!input.scheduleStartTime) return "Time not specified";
  return input.scheduleEndTime
    ? `${input.scheduleStartTime}–${input.scheduleEndTime}`
    : input.scheduleStartTime;
}

function buildResendMessage(input: InitialAssignmentEmailInput) {
  const subject = `New Project Local assignment · ${input.workspaceDisplayName.trim()}`;
  const timeLabel = scheduleTimeLabel(input);
  const followUpPhone = input.followUpContact.phone?.trim();
  const note = input.scheduleNotes?.trim();
  const contactLines = [
    input.followUpContact.displayName.trim(),
    input.followUpContact.email.trim(),
    followUpPhone,
  ].filter((value): value is string => Boolean(value));
  const textBody = [
    "PROJECT LOCAL",
    "",
    `Hi ${input.volunteerDisplayName.trim()},`,
    "",
    `A new assignment is available for ${input.workspaceDisplayName.trim()}.`,
    "",
    input.taskTitle.trim(),
    `Date: ${input.scheduleDate}`,
    `Time: ${timeLabel}`,
    ...(note ? [`Details: ${note}`] : []),
    "",
    `View your schedule: ${input.scheduleAccessUrl}`,
    "",
    "Follow-up Contact",
    ...contactLines,
  ].join("\n");

  const detailRows = [
    ["Date", input.scheduleDate],
    ["Time", timeLabel],
    ...(note ? [["Details", note]] : []),
  ];
  const htmlBody = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f5f8fc;color:#10233f;font-family:Arial,sans-serif;">
    <div style="margin:0 auto;max-width:600px;padding:32px 20px;">
      <div style="border:1px solid #dbe4ef;border-radius:18px;background:#ffffff;box-shadow:0 8px 24px rgba(16,35,63,.08);overflow:hidden;">
        <div style="padding:24px 28px 18px;border-bottom:1px solid #e6edf5;">
          <div style="color:#246bfd;font-size:12px;font-weight:700;letter-spacing:.12em;">PROJECT LOCAL</div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">A new assignment is available</h1>
        </div>
        <div style="padding:24px 28px;">
          <p style="margin:0 0 18px;line-height:1.6;">Hi ${escapeHtml(input.volunteerDisplayName.trim())},</p>
          <p style="margin:0 0 20px;line-height:1.6;">You have a new assignment for <strong>${escapeHtml(input.workspaceDisplayName.trim())}</strong>.</p>
          <div style="margin:0 0 22px;padding:18px;border-radius:12px;background:#f5f8fc;">
            <div style="margin-bottom:12px;font-size:18px;font-weight:700;">${escapeHtml(input.taskTitle.trim())}</div>
            ${detailRows.map(([label, value]) => `<div style="margin-top:7px;line-height:1.5;"><span style="color:#60728a;">${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`).join("")}
          </div>
          <a href="${escapeHtml(input.scheduleAccessUrl)}" style="display:inline-block;border-radius:10px;background:#246bfd;color:#ffffff;font-weight:700;text-decoration:none;padding:12px 18px;">View your schedule</a>
          <div style="margin-top:26px;padding-top:20px;border-top:1px solid #e6edf5;line-height:1.6;">
            <div style="font-size:13px;font-weight:700;color:#60728a;">Follow-up Contact</div>
            <div>${contactLines.map(escapeHtml).join("<br>")}</div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text: textBody, html: htmlBody };
}

async function sendWithResend(
  configuration: Extract<
    InitialAssignmentEmailConfiguration,
    { ok: true; transport: "resend" }
  >,
  input: InitialAssignmentEmailInput,
  runtime: InitialAssignmentEmailRuntime,
): Promise<InitialAssignmentEmailSendResult> {
  const message = buildResendMessage(input);

  try {
    const response = await runtime.fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": buildResendInitialAssignmentIdempotencyKey(input),
      },
      body: JSON.stringify({
        from: configuration.from,
        to: [normalizeEmail(input.recipientEmail)],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { ok: false, safeFailureCode: "provider_send_failed" };
    }

    const payload: unknown = await response.json();
    const providerMessageId =
      typeof payload === "object" && payload !== null && "id" in payload
        ? (payload as { id?: unknown }).id
        : null;
    if (
      typeof providerMessageId !== "string" ||
      !providerMessageIdPattern.test(providerMessageId)
    ) {
      return { ok: false, safeFailureCode: "provider_send_failed" };
    }
    return { ok: true, providerMessageId };
  } catch {
    return { ok: false, safeFailureCode: "provider_send_failed" };
  }
}

export async function sendInitialAssignmentEmail(
  configuration: InitialAssignmentEmailConfiguration,
  input: InitialAssignmentEmailInput,
  runtime: InitialAssignmentEmailRuntime = { fetch: globalThis.fetch },
): Promise<InitialAssignmentEmailSendResult> {
  if (!configuration.ok || !validateSafeMessage(configuration, input)) {
    return { ok: false, safeFailureCode: "provider_send_failed" };
  }

  if (configuration.transport === "resend") {
    return sendWithResend(configuration, input, runtime);
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
