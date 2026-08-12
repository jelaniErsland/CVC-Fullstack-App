import "server-only";

import {
  emitOperationalEvent,
  type OperationalEventRuntime,
} from "./server.ts";

export type StaleAssignmentDelivery = Readonly<{
  deliveryId: string;
  sendingExpiresAt: string;
}>;

export type StaleAssignmentDeliveryRuntime = Readonly<{
  now?: () => Date;
  observability?: OperationalEventRuntime;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const allowedCandidateKeys = new Set([
  "deliveryId",
  "deliveryState",
  "sendingExpiresAt",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCandidate(value: unknown) {
  if (!isRecord(value)) return null;
  if (!Object.keys(value).every((key) => allowedCandidateKeys.has(key))) return null;
  if (
    typeof value.deliveryId !== "string" ||
    !uuidPattern.test(value.deliveryId) ||
    value.deliveryState !== "sending" ||
    typeof value.sendingExpiresAt !== "string" ||
    value.sendingExpiresAt.length > 40 ||
    !timestampPattern.test(value.sendingExpiresAt)
  ) {
    return null;
  }
  const expirationTime = Date.parse(value.sendingExpiresAt);
  if (!Number.isFinite(expirationTime)) return null;
  return {
    deliveryId: value.deliveryId.toLowerCase(),
    sendingExpiresAt: new Date(expirationTime).toISOString(),
    expirationTime,
  };
}

export function detectStaleAssignmentDeliveries(
  candidates: unknown,
  runtime: Pick<StaleAssignmentDeliveryRuntime, "now"> = {},
): readonly StaleAssignmentDelivery[] {
  try {
    if (!Array.isArray(candidates)) return [];
    const now = (runtime.now ?? (() => new Date()))().getTime();
    if (!Number.isFinite(now)) return [];

    return candidates
      .slice(0, 100)
      .map(parseCandidate)
      .filter(
        (candidate): candidate is NonNullable<ReturnType<typeof parseCandidate>> =>
          candidate !== null && candidate.expirationTime <= now,
      )
      .map(({ deliveryId, sendingExpiresAt }) =>
        Object.freeze({ deliveryId, sendingExpiresAt }),
      );
  } catch {
    return [];
  }
}

export function observeStaleAssignmentDeliveries(
  candidates: unknown,
  runtime: StaleAssignmentDeliveryRuntime = {},
) {
  const staleDeliveries = detectStaleAssignmentDeliveries(candidates, runtime);
  if (staleDeliveries.length > 0) {
    emitOperationalEvent(
      {
        event: "assignment_email.stale_delivery_detected",
        failureCode: "sending_expired",
      },
      runtime.observability,
    );
  }
  return staleDeliveries;
}
