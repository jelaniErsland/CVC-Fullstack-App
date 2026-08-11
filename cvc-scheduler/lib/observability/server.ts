import "server-only";

export const OPERATIONAL_EVENT_SCHEMA_VERSION =
  "project-local.operational-event.v1" as const;

const operationalEventDefinitions = {
  "auth.callback_failure": {
    severity: "error",
    category: "auth",
    stage: "callback",
    outcome: "failure",
    failureCodes: [
      "missing_code",
      "configuration_unavailable",
      "exchange_failed",
    ],
  },
  "calendar.create_failure": {
    severity: "error",
    category: "calendar",
    stage: "create",
    outcome: "failure",
    failureCodes: [
      "context_unavailable",
      "validation_failed",
      "persistence_failed",
    ],
  },
  "calendar.update_failure": {
    severity: "error",
    category: "calendar",
    stage: "update",
    outcome: "failure",
    failureCodes: [
      "context_unavailable",
      "validation_failed",
      "persistence_failed",
    ],
  },
  "calendar.publish_failure": {
    severity: "error",
    category: "calendar",
    stage: "publish",
    outcome: "failure",
    failureCodes: [
      "context_unavailable",
      "validation_failed",
      "persistence_failed",
    ],
  },
  "volunteer.create_failure": {
    severity: "error",
    category: "volunteer",
    stage: "create",
    outcome: "failure",
    failureCodes: [
      "context_unavailable",
      "validation_failed",
      "persistence_failed",
    ],
  },
  "volunteer.update_failure": {
    severity: "error",
    category: "volunteer",
    stage: "update",
    outcome: "failure",
    failureCodes: [
      "context_unavailable",
      "validation_failed",
      "persistence_failed",
    ],
  },
  "assignment.create_failure": {
    severity: "error",
    category: "assignment",
    stage: "create",
    outcome: "failure",
    failureCodes: [
      "context_unavailable",
      "validation_failed",
      "persistence_failed",
    ],
  },
  "assignment.cancel_failure": {
    severity: "error",
    category: "assignment",
    stage: "cancel",
    outcome: "failure",
    failureCodes: [
      "context_unavailable",
      "validation_failed",
      "persistence_failed",
    ],
  },
  "schedule_access.exchange_failure": {
    severity: "warn",
    category: "schedule_access",
    stage: "exchange",
    outcome: "failure",
    failureCodes: [
      "credential_unavailable",
      "invalid_credential",
      "read_unavailable",
      "unexpected_failure",
    ],
  },
  "volunteer_response.submit_failure": {
    severity: "warn",
    category: "volunteer_response",
    stage: "submit",
    outcome: "failure",
    failureCodes: [
      "credential_unavailable",
      "response_changed",
      "response_unavailable",
      "persistence_failed",
    ],
  },
  "volunteer_response.confirm_all_failure": {
    severity: "warn",
    category: "volunteer_response",
    stage: "confirm_all",
    outcome: "failure",
    failureCodes: [
      "credential_unavailable",
      "response_changed",
      "response_unavailable",
      "persistence_failed",
    ],
  },
  "assignment_email.configuration_failure": {
    severity: "error",
    category: "assignment_email",
    stage: "configuration",
    outcome: "failure",
    failureCodes: [
      "transport_disabled",
      "transport_unsupported",
      "origin_unavailable",
      "from_unavailable",
      "recording_path_unavailable",
      "resend_api_key_unavailable",
    ],
  },
  "assignment_email.request_failure": {
    severity: "error",
    category: "assignment_email",
    stage: "request",
    outcome: "failure",
    failureCodes: [
      "context_unavailable",
      "validation_failed",
      "unexpected_failure",
    ],
  },
  "assignment_email.claim_failure": {
    severity: "error",
    category: "assignment_email",
    stage: "claim",
    outcome: "failure",
    failureCodes: ["claim_unavailable"],
  },
  "assignment_email.schedule_access_failure": {
    severity: "error",
    category: "assignment_email",
    stage: "schedule_access",
    outcome: "failure",
    failureCodes: ["issue_failed", "revoke_failed"],
  },
  "assignment_email.provider_failure": {
    severity: "error",
    category: "assignment_email",
    stage: "provider",
    outcome: "failure",
    failureCodes: ["provider_send_failed"],
  },
  "assignment_email.finalization_failure": {
    severity: "error",
    category: "assignment_email",
    stage: "finalize",
    outcome: "failure",
    failureCodes: ["finalize_unavailable"],
  },
  "assignment_email.sent": {
    severity: "info",
    category: "assignment_email",
    stage: "finalize",
    outcome: "success",
    failureCodes: [],
  },
  "assignment_email.stale_delivery_detected": {
    severity: "warn",
    category: "assignment_email",
    stage: "stale_detection",
    outcome: "detected",
    failureCodes: ["sending_expired"],
  },
} as const;

export type OperationalEventName = keyof typeof operationalEventDefinitions;
type OperationalEventDefinition =
  (typeof operationalEventDefinitions)[OperationalEventName];

export type OperationalEvent = Readonly<{
  schemaVersion: typeof OPERATIONAL_EVENT_SCHEMA_VERSION;
  event: OperationalEventName;
  severity: OperationalEventDefinition["severity"];
  category: OperationalEventDefinition["category"];
  stage: OperationalEventDefinition["stage"];
  outcome: OperationalEventDefinition["outcome"];
  timestamp: string;
  failureCode?: string;
  correlationId?: string;
}>;

export type OperationalEventInput = Readonly<{
  event: OperationalEventName;
  failureCode?: string;
  correlationId?: string;
}>;

export type OperationalEventRuntime = Readonly<{
  now?: () => Date;
  write?: (event: OperationalEvent) => void;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedInputKeys = new Set(["event", "failureCode", "correlationId"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

function hasOnlyAllowedInputKeys(value: Record<string, unknown>) {
  return Object.keys(value).every((key) => allowedInputKeys.has(key));
}

function defaultWrite(event: OperationalEvent) {
  const serialized = JSON.stringify(event);
  if (event.severity === "error") {
    console.error(serialized);
  } else if (event.severity === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export function createOperationalEvent(
  input: OperationalEventInput | unknown,
  runtime: Pick<OperationalEventRuntime, "now"> = {},
): OperationalEvent | null {
  try {
    if (!isRecord(input) || !hasOnlyAllowedInputKeys(input)) return null;
    if (typeof input.event !== "string") return null;

    const eventName = input.event as OperationalEventName;
    const definition = operationalEventDefinitions[eventName];
    if (!definition) return null;

    const failureCode = input.failureCode;
    const requiresFailureCode = definition.failureCodes.length > 0;
    if (
      (requiresFailureCode &&
        (typeof failureCode !== "string" ||
          !(definition.failureCodes as readonly string[]).includes(failureCode))) ||
      (!requiresFailureCode && failureCode !== undefined)
    ) {
      return null;
    }
    const normalizedFailureCode =
      typeof failureCode === "string" ? failureCode : undefined;

    const correlationId = input.correlationId;
    if (
      correlationId !== undefined &&
      (typeof correlationId !== "string" || !uuidPattern.test(correlationId))
    ) {
      return null;
    }

    const timestamp = (runtime.now ?? (() => new Date()))().toISOString();
    const event: OperationalEvent = {
      schemaVersion: OPERATIONAL_EVENT_SCHEMA_VERSION,
      event: eventName,
      severity: definition.severity,
      category: definition.category,
      stage: definition.stage,
      outcome: definition.outcome,
      timestamp,
      ...(normalizedFailureCode ? { failureCode: normalizedFailureCode } : {}),
      ...(correlationId
        ? { correlationId: correlationId.toLowerCase() }
        : {}),
    };
    return Object.freeze(event);
  } catch {
    return null;
  }
}

export function emitOperationalEvent(
  input: OperationalEventInput | unknown,
  runtime: OperationalEventRuntime = {},
) {
  try {
    const event = createOperationalEvent(input, runtime);
    if (!event) return false;
    (runtime.write ?? defaultWrite)(event);
    return true;
  } catch {
    return false;
  }
}
