import { ResponseTokenValidationError } from "@/lib/responseTokens/token";

export type PublicAssignmentResponseSubmissionState =
  | "changed"
  | "unavailable"
  | "configuration_unavailable"
  | "error";

export class PublicAssignmentResponseConfigurationError extends Error {
  constructor() {
    super("Public assignment responses are not configured.");
    this.name = "PublicAssignmentResponseConfigurationError";
  }
}

function findSqlState(error: unknown) {
  const visited = new Set<unknown>();
  let current = error;

  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }

  return null;
}

export function classifyPublicAssignmentResponseSubmissionError(
  error: unknown,
): PublicAssignmentResponseSubmissionState {
  if (error instanceof PublicAssignmentResponseConfigurationError) {
    return "configuration_unavailable";
  }
  if (error instanceof ResponseTokenValidationError) return "unavailable";

  const sqlState = findSqlState(error);
  if (sqlState === "40001") return "changed";
  if (sqlState === "42501") return "unavailable";
  return "error";
}
