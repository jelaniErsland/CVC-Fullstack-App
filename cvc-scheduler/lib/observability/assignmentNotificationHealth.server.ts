import "server-only";

import type { AppSupabaseClient } from "../supabase/types.ts";
import {
  observeStaleAssignmentDeliveries,
  type StaleAssignmentDeliveryRuntime,
} from "./staleAssignmentDeliveries.server.ts";

export const ASSIGNMENT_NOTIFICATION_HEALTH_READ_LIMIT = 100;

export type AssignmentNotificationHealthResult =
  | Readonly<{
      kind: "healthy";
      staleDeliveryCount: 0;
      checkedSendingDeliveryCount: number;
      atReadLimit: boolean;
    }>
  | Readonly<{
      kind: "attention";
      staleDeliveryCount: number;
      checkedSendingDeliveryCount: number;
      atReadLimit: boolean;
    }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "error" }>;

type AssignmentNotificationHealthRuntime = StaleAssignmentDeliveryRuntime;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const allowedRowKeys = new Set([
  "delivery_id",
  "delivery_state",
  "sending_expires_at",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCandidate(value: unknown) {
  if (!isRecord(value)) return null;
  if (!Object.keys(value).every((key) => allowedRowKeys.has(key))) return null;
  if (
    typeof value.delivery_id !== "string" ||
    !uuidPattern.test(value.delivery_id) ||
    value.delivery_state !== "sending" ||
    typeof value.sending_expires_at !== "string" ||
    value.sending_expires_at.length > 40 ||
    !timestampPattern.test(value.sending_expires_at) ||
    !Number.isFinite(Date.parse(value.sending_expires_at))
  ) {
    return null;
  }

  return {
    deliveryId: value.delivery_id.toLowerCase(),
    deliveryState: "sending" as const,
    sendingExpiresAt: new Date(value.sending_expires_at).toISOString(),
  };
}

function isAuthorizationFailure(value: unknown) {
  return isRecord(value) && value.code === "42501";
}

export async function readAssignmentNotificationHealthWithClient(
  supabase: AppSupabaseClient,
  runtime: AssignmentNotificationHealthRuntime = {},
): Promise<AssignmentNotificationHealthResult> {
  try {
    const { data, error } = await supabase.rpc(
      "read_assignment_notification_delivery_health",
    );
    if (error) {
      return isAuthorizationFailure(error)
        ? { kind: "unavailable" }
        : { kind: "error" };
    }
    if (!Array.isArray(data) || data.length > ASSIGNMENT_NOTIFICATION_HEALTH_READ_LIMIT) {
      return { kind: "error" };
    }

    const candidates = data.map(parseCandidate);
    if (candidates.some((candidate) => candidate === null)) {
      return { kind: "error" };
    }

    const safeCandidates = candidates.filter(
      (candidate): candidate is NonNullable<typeof candidate> => candidate !== null,
    );
    const staleDeliveries = observeStaleAssignmentDeliveries(
      safeCandidates,
      runtime,
    );
    const common = {
      checkedSendingDeliveryCount: safeCandidates.length,
      atReadLimit:
        safeCandidates.length === ASSIGNMENT_NOTIFICATION_HEALTH_READ_LIMIT,
    } as const;

    if (staleDeliveries.length === 0) {
      return {
        kind: "healthy",
        staleDeliveryCount: 0,
        ...common,
      };
    }

    return {
      kind: "attention",
      staleDeliveryCount: staleDeliveries.length,
      ...common,
    };
  } catch {
    return { kind: "error" };
  }
}
