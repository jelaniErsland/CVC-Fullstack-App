const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;
const scheduleStates = ["ready", "ready_empty", "unavailable"] as const;
const responseStatuses = ["needs_response", "confirmed", "declined"] as const;
const scheduleKinds = ["timed", "date_based", "multi_day_window", "milestone"] as const;

export const volunteerScheduleAccessTtlHours = {
  default: 720,
  minimum: 1,
  maximum: 2160,
} as const;

export class VolunteerScheduleAccessValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Volunteer schedule access input is invalid.");
    this.name = "VolunteerScheduleAccessValidationError";
    this.issues = issues;
  }
}

export type IssueVolunteerScheduleAccessInput = Readonly<{
  volunteerProfileId: string;
  expiresInHours?: number;
}>;

export type RevokeVolunteerScheduleAccessInput = Readonly<{
  tokenId: string;
}>;

export type ReadVolunteerScheduleInput = Readonly<{
  token: string;
}>;

export type SubmitVolunteerScheduleResponseInput = Readonly<{
  token: string;
  assignmentId: string;
  status: "confirmed" | "declined";
  note?: string | null;
}>;

export type ConfirmAllVolunteerScheduleAssignmentsInput = Readonly<{
  token: string;
}>;

export type IssuedVolunteerScheduleAccess = Readonly<{
  tokenId: string;
  token: string;
  expiresAt: string;
}>;

export type VolunteerScheduleAssignmentResponseStatus =
  (typeof responseStatuses)[number];

export type VolunteerScheduleAssignment = Readonly<{
  assignmentReference: string;
  taskTitle: string;
  taskType: string;
  scheduleKind: (typeof scheduleKinds)[number];
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  neededCount: number;
  scheduleNotes: string | null;
  currentResponseStatus: VolunteerScheduleAssignmentResponseStatus;
  responseNote: string | null;
  canConfirm: boolean;
  canDecline: boolean;
  responseLocked: boolean;
  responseLockReason: "inside_48_hours" | "started" | null;
  activeAssignedCount: number;
  confirmedCount: number;
  declinedCount: number;
  followUpContact: Readonly<{
    displayName: string | null;
    email: string | null;
    phone: string | null;
  }>;
}>;

export type VolunteerSchedule =
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{
      kind: "ready_empty";
      workspaceDisplayName: string;
      workspaceTimezone: string;
      volunteerDisplayName: string;
      upcomingAssignments: readonly VolunteerScheduleAssignment[];
      pastAssignments: readonly VolunteerScheduleAssignment[];
    }>
  | Readonly<{
      kind: "ready";
      workspaceDisplayName: string;
      workspaceTimezone: string;
      volunteerDisplayName: string;
      upcomingAssignments: readonly VolunteerScheduleAssignment[];
      pastAssignments: readonly VolunteerScheduleAssignment[];
    }>;

export type VolunteerScheduleResponseResult = Readonly<{
  assignmentReference: string;
  status: "confirmed" | "declined";
  note: string | null;
  respondedAt: string;
}>;

export type VolunteerScheduleConfirmAllResult = Readonly<{
  confirmedCount: number;
  respondedAt: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  issues: string[],
) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) issues.push(`unsupported fields: ${unknown.sort().join(", ")}.`);
}

function requireInput(input: unknown) {
  if (!isRecord(input)) {
    throw new VolunteerScheduleAccessValidationError(["input must be an object."]);
  }
  return input;
}

function uuid(value: unknown, label: string, issues: string[]) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    issues.push(`${label} must be a UUID.`);
    return "";
  }
  return value.trim().toLowerCase();
}

function bearer(value: unknown, issues: string[]) {
  if (typeof value !== "string" || !bearerPattern.test(value)) {
    issues.push("token must be a 256-bit base64url bearer value.");
    return "";
  }
  return value;
}

function responseStatus(value: unknown, issues: string[]) {
  if (value === "confirmed" || value === "declined") return value;
  issues.push("status is unsupported.");
  return "confirmed";
}

function optionalNote(value: unknown, issues: string[]) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    issues.push("note must be text.");
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > 1000) issues.push("note must be 1000 characters or fewer.");
  return normalized;
}

export function validateIssueVolunteerScheduleAccessInput(input: unknown) {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["volunteerProfileId", "expiresInHours"], issues);
  const expiresInHours =
    value.expiresInHours === undefined
      ? volunteerScheduleAccessTtlHours.default
      : value.expiresInHours;
  if (
    typeof expiresInHours !== "number" ||
    !Number.isInteger(expiresInHours) ||
    expiresInHours < volunteerScheduleAccessTtlHours.minimum ||
    expiresInHours > volunteerScheduleAccessTtlHours.maximum
  ) {
    issues.push(
      `expiresInHours must be an integer from ${volunteerScheduleAccessTtlHours.minimum} to ${volunteerScheduleAccessTtlHours.maximum}.`,
    );
  }
  const normalized = {
    volunteerProfileId: uuid(value.volunteerProfileId, "volunteerProfileId", issues),
    expiresInHours:
      typeof expiresInHours === "number"
        ? expiresInHours
        : volunteerScheduleAccessTtlHours.default,
  };
  if (issues.length > 0) throw new VolunteerScheduleAccessValidationError(issues);
  return normalized;
}

export function validateRevokeVolunteerScheduleAccessInput(input: unknown) {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["tokenId"], issues);
  const normalized = { tokenId: uuid(value.tokenId, "tokenId", issues) };
  if (issues.length > 0) throw new VolunteerScheduleAccessValidationError(issues);
  return normalized;
}

export function validateReadVolunteerScheduleInput(input: unknown) {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["token"], issues);
  const normalized = { token: bearer(value.token, issues) };
  if (issues.length > 0) throw new VolunteerScheduleAccessValidationError(issues);
  return normalized;
}

export function validateSubmitVolunteerScheduleResponseInput(input: unknown) {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["token", "assignmentId", "status", "note"], issues);
  const normalized: SubmitVolunteerScheduleResponseInput = {
    token: bearer(value.token, issues),
    assignmentId: uuid(value.assignmentId, "assignmentId", issues),
    status: responseStatus(value.status, issues),
    note: optionalNote(value.note, issues),
  };
  if (issues.length > 0) throw new VolunteerScheduleAccessValidationError(issues);
  return normalized;
}

export function validateConfirmAllVolunteerScheduleAssignmentsInput(input: unknown) {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["token"], issues);
  const normalized: ConfirmAllVolunteerScheduleAssignmentsInput = {
    token: bearer(value.token, issues),
  };
  if (issues.length > 0) throw new VolunteerScheduleAccessValidationError(issues);
  return normalized;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return isRecord(value[0]) ? value[0] : null;
}

function text(record: Record<string, unknown>, field: string, issues: string[]) {
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

function nullableUuid(record: Record<string, unknown>, field: string, issues: string[]) {
  const value = record[field];
  if (value === null) return null;
  return uuid(value, field, issues);
}

function numberValue(record: Record<string, unknown>, field: string, issues: string[]) {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(`${field} is invalid.`);
    return 0;
  }
  return value;
}

function booleanValue(record: Record<string, unknown>, field: string, issues: string[]) {
  const value = record[field];
  if (typeof value !== "boolean") {
    issues.push(`${field} is invalid.`);
    return false;
  }
  return value;
}

function nullableLockReason(record: Record<string, unknown>, field: string, issues: string[]) {
  const value = record[field];
  if (value === null || value === undefined) return null;
  if (value === "inside_48_hours" || value === "started") return value;
  issues.push(`${field} is invalid.`);
  return null;
}

export function parseIssuedVolunteerScheduleAccess(
  value: unknown,
): IssuedVolunteerScheduleAccess {
  const row = firstRow(value);
  if (!row) throw new Error("Volunteer schedule access issuance returned an invalid result.");
  const issues: string[] = [];
  const token = text(row, "bearer_token", issues);
  if (!bearerPattern.test(token)) issues.push("bearer_token is invalid.");
  const result = {
    tokenId: uuid(row.token_id, "token_id", issues),
    token,
    expiresAt: text(row, "token_expires_at", issues),
  };
  if (issues.length > 0) {
    throw new Error("Volunteer schedule access issuance returned an invalid result.");
  }
  return result;
}

function compareAssignmentDates(assignment: VolunteerScheduleAssignment, now: Date) {
  const end = assignment.endDate ?? assignment.startDate;
  const time = assignment.endTime ?? assignment.startTime ?? "23:59";
  const value = Date.parse(`${end}T${time.slice(0, 5)}:00Z`);
  return Number.isFinite(value) ? value - now.getTime() : 1;
}

export function parseVolunteerScheduleRows(value: unknown): VolunteerSchedule {
  const first = firstRow(value);
  if (!first) return { kind: "unavailable" };
  const issues: string[] = [];
  const state = first.schedule_state;
  if (!scheduleStates.includes(state as (typeof scheduleStates)[number])) {
    issues.push("schedule_state is invalid.");
  }
  if (state === "unavailable") {
    if (issues.length > 0) throw new Error("Volunteer schedule returned an invalid result.");
    return { kind: "unavailable" };
  }

  const workspaceDisplayName = text(first, "workspace_display_name", issues);
  const workspaceTimezone = text(first, "workspace_timezone", issues);
  const volunteerDisplayName = text(first, "volunteer_display_name", issues);

  if (state === "ready_empty") {
    if (issues.length > 0) throw new Error("Volunteer schedule returned an invalid result.");
    return {
      kind: "ready_empty",
      workspaceDisplayName,
      workspaceTimezone,
      volunteerDisplayName,
      upcomingAssignments: [],
      pastAssignments: [],
    };
  }

  if (!Array.isArray(value)) throw new Error("Volunteer schedule returned an invalid result.");
  const assignments = value.map((rowValue) => {
    if (!isRecord(rowValue)) {
      issues.push("schedule row is invalid.");
      return null;
    }
    const scheduleKind = rowValue.schedule_kind;
    const responseStatus = rowValue.current_response_status;
    if (!scheduleKinds.includes(scheduleKind as VolunteerScheduleAssignment["scheduleKind"])) {
      issues.push("schedule_kind is invalid.");
    }
    if (
      !responseStatuses.includes(
        responseStatus as VolunteerScheduleAssignmentResponseStatus,
      )
    ) {
      issues.push("current_response_status is invalid.");
    }
    const assignment: VolunteerScheduleAssignment = {
      assignmentReference: nullableUuid(rowValue, "assignment_reference", issues) ?? "",
      taskTitle: text(rowValue, "task_title", issues),
      taskType: text(rowValue, "task_type", issues),
      scheduleKind: scheduleKind as VolunteerScheduleAssignment["scheduleKind"],
      startDate: text(rowValue, "start_date", issues),
      endDate: nullableText(rowValue, "end_date", issues),
      startTime: nullableText(rowValue, "start_time", issues),
      endTime: nullableText(rowValue, "end_time", issues),
      neededCount: numberValue(rowValue, "needed_count", issues),
      scheduleNotes: nullableText(rowValue, "schedule_notes", issues),
      currentResponseStatus: responseStatus as VolunteerScheduleAssignmentResponseStatus,
      responseNote: nullableText(rowValue, "response_note", issues),
      canConfirm: booleanValue(rowValue, "can_confirm", issues),
      canDecline: booleanValue(rowValue, "can_decline", issues),
      responseLocked: booleanValue(rowValue, "response_locked", issues),
      responseLockReason: nullableLockReason(rowValue, "response_lock_reason", issues),
      activeAssignedCount: numberValue(rowValue, "active_assigned_count", issues),
      confirmedCount: numberValue(rowValue, "confirmed_count", issues),
      declinedCount: numberValue(rowValue, "declined_count", issues),
      followUpContact: {
        displayName: nullableText(rowValue, "follow_up_contact_display_name", issues),
        email: nullableText(rowValue, "follow_up_contact_email", issues),
        phone: nullableText(rowValue, "follow_up_contact_phone", issues),
      },
    };
    return assignment.assignmentReference ? assignment : null;
  });

  if (issues.length > 0) throw new Error("Volunteer schedule returned an invalid result.");
  const now = new Date();
  const safeAssignments = assignments.filter(
    (assignment): assignment is VolunteerScheduleAssignment => Boolean(assignment),
  );
  return {
    kind: "ready",
    workspaceDisplayName,
    workspaceTimezone,
    volunteerDisplayName,
    upcomingAssignments: safeAssignments.filter(
      (assignment) => compareAssignmentDates(assignment, now) >= 0,
    ),
    pastAssignments: safeAssignments.filter(
      (assignment) => compareAssignmentDates(assignment, now) < 0,
    ),
  };
}

export function parseVolunteerScheduleResponseResult(
  value: unknown,
): VolunteerScheduleResponseResult {
  const row = firstRow(value);
  if (!row) throw new Error("Volunteer schedule response returned an invalid result.");
  const issues: string[] = [];
  const status = row.current_response_status;
  if (status !== "confirmed" && status !== "declined") {
    issues.push("current_response_status is invalid.");
  }
  const result: VolunteerScheduleResponseResult = {
    assignmentReference: uuid(row.assignment_reference, "assignment_reference", issues),
    status: status === "declined" ? "declined" : "confirmed",
    note: nullableText(row, "response_note", issues),
    respondedAt: text(row, "response_recorded_at", issues),
  };
  if (issues.length > 0) {
    throw new Error("Volunteer schedule response returned an invalid result.");
  }
  return result;
}

export function parseVolunteerScheduleConfirmAllResult(
  value: unknown,
): VolunteerScheduleConfirmAllResult {
  const row = firstRow(value);
  if (!row) throw new Error("Volunteer schedule confirmation returned an invalid result.");
  const issues: string[] = [];
  const result = {
    confirmedCount: numberValue(row, "confirmed_count", issues),
    respondedAt: text(row, "response_recorded_at", issues),
  };
  if (issues.length > 0) {
    throw new Error("Volunteer schedule confirmation returned an invalid result.");
  }
  return result;
}
