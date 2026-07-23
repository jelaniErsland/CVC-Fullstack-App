export const assignmentLifecycles = ["active", "canceled", "archived"] as const;
export const assignmentResponseStatuses = ["needs_response", "confirmed", "declined"] as const;

export type AssignmentLifecycle = (typeof assignmentLifecycles)[number];
export type AssignmentResponseStatus = (typeof assignmentResponseStatuses)[number];

export type CreateAssignmentInput = Readonly<{
  calendarItemId: string;
  volunteerProfileId: string;
  note?: string | null;
}>;

export type CreateAssignmentBatchInput = Readonly<{
  calendarItemId: string;
  volunteerProfileIds: readonly string[];
  note?: string | null;
}>;

export type CancelAssignmentInput = Readonly<{
  assignmentId: string;
}>;

export type UpdateAssignmentResponseInput = Readonly<{
  assignmentId: string;
  status: AssignmentResponseStatus;
  note?: string | null;
}>;

export type CalendarAssignment = Readonly<{
  id: string;
  workspaceId: string;
  calendarItemId: string;
  volunteerProfileId: string;
  lifecycle: AssignmentLifecycle;
  note: string | null;
  createdByAuthUserId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type AssignmentResponse = Readonly<{
  id: string;
  workspaceId: string;
  assignmentId: string;
  status: AssignmentResponseStatus;
  source: "project_contact" | "public_token" | "volunteer_schedule";
  note: string | null;
  respondedAt: string | null;
  updatedByAuthUserId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export class AssignmentValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Assignment input is invalid.");
    this.name = "AssignmentValidationError";
    this.issues = issues;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeUuid(value: unknown, label: string, issues: string[]) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    issues.push(`${label} must be a UUID.`);
    return "";
  }
  return value.trim().toLowerCase();
}

function nullableUuid(value: unknown, label: string, issues: string[]) {
  return value === null ? null : normalizeUuid(value, label, issues);
}

function parseOptionalNote(
  value: unknown,
  label: string,
  maximum: number,
  issues: string[],
) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    issues.push(`${label} must be text.`);
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length < 1 || normalized.length > maximum) {
    issues.push(`${label} must be 1-${maximum} characters when supplied.`);
  }
  return normalized;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  issues: string[],
) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) issues.push(`unsupported fields: ${unknown.sort().join(", ")}.`);
}

export function validateCreateAssignmentInput(input: unknown): CreateAssignmentInput {
  if (!isRecord(input)) throw new AssignmentValidationError(["input must be an object."]);
  const issues: string[] = [];
  rejectUnknownKeys(input, ["calendarItemId", "volunteerProfileId", "note"], issues);
  const normalized: CreateAssignmentInput = {
    calendarItemId: normalizeUuid(input.calendarItemId, "calendarItemId", issues),
    volunteerProfileId: normalizeUuid(
      input.volunteerProfileId,
      "volunteerProfileId",
      issues,
    ),
    note: parseOptionalNote(input.note, "note", 2000, issues),
  };
  if (issues.length > 0) throw new AssignmentValidationError(issues);
  return normalized;
}

export function validateCreateAssignmentBatchInput(
  input: unknown,
): CreateAssignmentBatchInput {
  if (!isRecord(input)) throw new AssignmentValidationError(["input must be an object."]);
  const issues: string[] = [];
  rejectUnknownKeys(input, ["calendarItemId", "volunteerProfileIds", "note"], issues);
  const volunteerProfileIds = Array.isArray(input.volunteerProfileIds)
    ? input.volunteerProfileIds.map((value) =>
        normalizeUuid(value, "volunteerProfileIds", issues),
      )
    : [];
  if (!Array.isArray(input.volunteerProfileIds)) {
    issues.push("volunteerProfileIds must be an array.");
  }
  const uniqueVolunteerProfileIds = new Set(volunteerProfileIds);
  if (volunteerProfileIds.length < 1 || volunteerProfileIds.length > 25) {
    issues.push("volunteerProfileIds must include 1-25 volunteers.");
  }
  if (uniqueVolunteerProfileIds.size !== volunteerProfileIds.length) {
    issues.push("volunteerProfileIds must not contain duplicates.");
  }
  const normalized: CreateAssignmentBatchInput = {
    calendarItemId: normalizeUuid(input.calendarItemId, "calendarItemId", issues),
    volunteerProfileIds,
    note: parseOptionalNote(input.note, "note", 2000, issues),
  };
  if (issues.length > 0) throw new AssignmentValidationError(issues);
  return normalized;
}

export function validateCancelAssignmentInput(input: unknown): CancelAssignmentInput {
  if (!isRecord(input)) throw new AssignmentValidationError(["input must be an object."]);
  const issues: string[] = [];
  rejectUnknownKeys(input, ["assignmentId"], issues);
  const normalized: CancelAssignmentInput = {
    assignmentId: normalizeUuid(input.assignmentId, "assignmentId", issues),
  };
  if (issues.length > 0) throw new AssignmentValidationError(issues);
  return normalized;
}

export function validateUpdateAssignmentResponseInput(
  input: unknown,
): UpdateAssignmentResponseInput {
  if (!isRecord(input)) throw new AssignmentValidationError(["input must be an object."]);
  const issues: string[] = [];
  rejectUnknownKeys(input, ["assignmentId", "status", "note"], issues);
  const status = input.status;
  if (
    typeof status !== "string" ||
    !assignmentResponseStatuses.includes(status as AssignmentResponseStatus)
  ) {
    issues.push("status is unsupported.");
  }
  const normalized: UpdateAssignmentResponseInput = {
    assignmentId: normalizeUuid(input.assignmentId, "assignmentId", issues),
    status: assignmentResponseStatuses.includes(status as AssignmentResponseStatus)
      ? (status as AssignmentResponseStatus)
      : "needs_response",
    note: parseOptionalNote(input.note, "note", 1000, issues),
  };
  if (issues.length > 0) throw new AssignmentValidationError(issues);
  return normalized;
}

function requiredText(record: Record<string, unknown>, field: string, issues: string[]) {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    issues.push(`${field} is invalid.`);
    return "";
  }
  return value;
}

function nullableText(record: Record<string, unknown>, field: string, issues: string[]) {
  const value = record[field];
  if (value !== null && typeof value !== "string") {
    issues.push(`${field} is invalid.`);
    return null;
  }
  return value as string | null;
}

export function parseCalendarAssignment(value: unknown): CalendarAssignment {
  if (!isRecord(value)) throw new Error("Assignment read returned an invalid row.");
  const issues: string[] = [];
  const lifecycle = value.lifecycle;
  if (!assignmentLifecycles.includes(lifecycle as AssignmentLifecycle)) {
    issues.push("lifecycle is invalid.");
  }
  const result: CalendarAssignment = {
    id: normalizeUuid(value.id, "id", issues),
    workspaceId: normalizeUuid(value.workspace_id, "workspace_id", issues),
    calendarItemId: normalizeUuid(value.calendar_item_id, "calendar_item_id", issues),
    volunteerProfileId: normalizeUuid(
      value.volunteer_profile_id,
      "volunteer_profile_id",
      issues,
    ),
    lifecycle: lifecycle as AssignmentLifecycle,
    note: nullableText(value, "assignment_note", issues),
    createdByAuthUserId: nullableUuid(
      value.created_by_auth_user_id,
      "created_by_auth_user_id",
      issues,
    ),
    createdAt: requiredText(value, "created_at", issues),
    updatedAt: requiredText(value, "updated_at", issues),
  };
  if (issues.length > 0) throw new Error("Assignment row is invalid.");
  return result;
}

export function parseAssignmentResponse(value: unknown): AssignmentResponse {
  if (!isRecord(value)) throw new Error("Assignment response read returned an invalid row.");
  const issues: string[] = [];
  const status = value.response_status;
  const source = value.response_source;
  if (!assignmentResponseStatuses.includes(status as AssignmentResponseStatus)) {
    issues.push("response_status is invalid.");
  }
  if (
    source !== "project_contact" &&
    source !== "public_token" &&
    source !== "volunteer_schedule"
  ) {
    issues.push("response_source is invalid.");
  }
  const respondedAt = nullableText(value, "responded_at", issues);
  if (
    (status === "needs_response" && respondedAt !== null) ||
    ((status === "confirmed" || status === "declined") && respondedAt === null)
  ) {
    issues.push("responded_at does not match response_status.");
  }
  const result: AssignmentResponse = {
    id: normalizeUuid(value.id, "id", issues),
    workspaceId: normalizeUuid(value.workspace_id, "workspace_id", issues),
    assignmentId: normalizeUuid(value.assignment_id, "assignment_id", issues),
    status: status as AssignmentResponseStatus,
    source: source as AssignmentResponse["source"],
    note: nullableText(value, "response_note", issues),
    respondedAt,
    updatedByAuthUserId: nullableUuid(
      value.updated_by_auth_user_id,
      "updated_by_auth_user_id",
      issues,
    ),
    createdAt: requiredText(value, "created_at", issues),
    updatedAt: requiredText(value, "updated_at", issues),
  };
  if (issues.length > 0) throw new Error("Assignment response row is invalid.");
  return result;
}
