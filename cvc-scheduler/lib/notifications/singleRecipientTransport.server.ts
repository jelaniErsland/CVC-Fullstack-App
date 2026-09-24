import "server-only";
import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";
import type { InitialAssignmentEmailConfiguration } from "./initialAssignmentEmail.server.ts";

export type MessageOutcome =
  | { status: "accepted"; providerMessageId: string }
  | { status: "rejected"; reason: "invalid_message" | "provider_rejected" | "recording_unavailable" }
  | { status: "unknown"; reason: "provider_outcome_unknown" };

export type SingleRecipientMessage = {
  operationId: string;
  recipientId: string;
  attempt: number;
  email: string;
  subject: string;
  text: string;
  html: string;
};

// Provider retention is finite. The durable claim must independently prevent
// retries after acceptance/unknown outcomes; this key is additional protection.
export function communicationIdempotencyKey(message: Pick<SingleRecipientMessage, "operationId" | "recipientId" | "attempt">) {
  return `project-local/communication/${message.operationId}/${message.recipientId}/${message.attempt}`;
}

export async function sendSingleRecipientMessage(
  configuration: InitialAssignmentEmailConfiguration,
  message: SingleRecipientMessage,
  runtime: { fetch: typeof fetch } = { fetch: globalThis.fetch },
): Promise<MessageOutcome> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!configuration.ok || !uuid.test(message.operationId) || !uuid.test(message.recipientId)
    || !Number.isInteger(message.attempt) || message.attempt < 1 || message.attempt > 25
    || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(message.email) || message.email.length > 254
    || /[\r\n\0]/.test(message.subject) || !message.subject || message.subject.length > 240
    || !message.text || !message.html || message.text.length > 100000 || message.html.length > 200000) {
    return { status: "rejected", reason: "invalid_message" };
  }
  const key = communicationIdempotencyKey(message);
  if (configuration.transport === "recording") {
    const hash = (s: string) => createHash("sha256").update(s).digest("hex");
    const providerMessageId = `recording-${hash(key).slice(0,24)}`;
    try {
      // Never persist message text, addresses, private links or bearer tokens in logs.
      await appendFile(configuration.recordingPath, JSON.stringify({
        kind: "communication", operationId: message.operationId, recipientId: message.recipientId,
        attempt: message.attempt, recipientEmailHash: hash(message.email), providerMessageId,
      }) + "\n", "utf8");
      return { status: "accepted", providerMessageId };
    } catch { return { status: "rejected", reason: "recording_unavailable" }; }
  }
  try {
    const response = await runtime.fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${configuration.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ from: configuration.from, to: [message.email], subject: message.subject, text: message.text, html: message.html }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    // Timeouts, conflicts, server errors and malformed success cannot prove that
    // a message was not accepted. They must never enter an automatic retry path.
    if ([400,401,403,404,422,429].includes(response.status)) return { status: "rejected", reason: "provider_rejected" };
    if (!response.ok) return { status: "unknown", reason: "provider_outcome_unknown" };
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string" || !/^[A-Za-z0-9._:-]{1,200}$/.test(data.id)) return { status: "unknown", reason: "provider_outcome_unknown" };
    return { status: "accepted", providerMessageId: data.id };
  } catch { return { status: "unknown", reason: "provider_outcome_unknown" }; }
}
