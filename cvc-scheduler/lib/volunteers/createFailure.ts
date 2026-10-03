export type VolunteerCreateFailure = Readonly<{
  notice: "permission" | "duplicate" | "validation" | "error";
  failureCode: "permission_denied" | "duplicate_identity" | "validation_failed" | "persistence_failed";
}>;

export function classifyVolunteerCreatePersistenceFailure(error: unknown): VolunteerCreateFailure {
  const cause = error instanceof Error ? error.cause : error;
  const code = typeof cause === "object" && cause !== null && "code" in cause
    ? cause.code
    : undefined;
  if (code === "42501" || code === "PGRST301") {
    return { notice: "permission", failureCode: "permission_denied" };
  }
  if (code === "23505") {
    return { notice: "duplicate", failureCode: "duplicate_identity" };
  }
  if (code === "22023" || code === "22P02" || code === "23502" || code === "23514") {
    return { notice: "validation", failureCode: "validation_failed" };
  }
  return { notice: "error", failureCode: "persistence_failed" };
}
