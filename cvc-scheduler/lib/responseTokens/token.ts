export const publicAssignmentResponseStatuses = ["confirmed", "declined"] as const;
export type PublicAssignmentResponseStatus =
  (typeof publicAssignmentResponseStatuses)[number];

export type IssueAssignmentResponseTokenInput = Readonly<{
  assignmentId: string;
  expiresInHours?: number;
  internalNote?: string | null;
}>;

export type RevokeAssignmentResponseTokenInput = Readonly<{
  tokenId: string;
}>;

export type ReadAssignmentResponseByTokenInput = Readonly<{
  token: string;
}>;

export type SubmitAssignmentResponseByTokenInput = Readonly<{
  token: string;
  status: PublicAssignmentResponseStatus;
  note?: string | null;
}>;

export type IssuedAssignmentResponseToken = Readonly<{
  tokenId: string;
  token: string;
  expiresAt: string;
}>;

export type PublicAssignmentResponseContext = Readonly<{
  workspaceDisplayName: string;
  assignmentReference: string;
  taskTitle: string;
  scheduleKind: "timed" | "date_based" | "multi_day_window" | "milestone";
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  currentResponseStatus: "needs_response" | "confirmed" | "declined";
}>;

export type PublicAssignmentResponseResult = Readonly<{
  assignmentReference: string;
  status: PublicAssignmentResponseStatus;
  respondedAt: string;
}>;

export class ResponseTokenValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Assignment response token input is invalid.");
    this.name = "ResponseTokenValidationError";
    this.issues = issues;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;
const scheduleKinds = ["timed", "date_based", "multi_day_window", "milestone"] as const;
const responseStatuses = ["needs_response", "confirmed", "declined"] as const;

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

function optionalNote(
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
  if (normalized.length < 1 || normalized.length > maximum) {
    issues.push(`${label} must be 1-${maximum} characters when supplied.`);
  }
  return normalized;
}

function requireInput(input: unknown) {
  if (!isRecord(input)) throw new ResponseTokenValidationError(["input must be an object."]);
  return input;
}

export function validateIssueAssignmentResponseTokenInput(
  input: unknown,
): Required<Pick<IssueAssignmentResponseTokenInput, "assignmentId" | "expiresInHours">> &
  Readonly<{ internalNote: string | null }> {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["assignmentId", "expiresInHours", "internalNote"], issues);
  const expiresInHours = value.expiresInHours === undefined ? 168 : value.expiresInHours;
  if (
    typeof expiresInHours !== "number" ||
    !Number.isInteger(expiresInHours) ||
    expiresInHours < 1 ||
    expiresInHours > 720
  ) {
    issues.push("expiresInHours must be an integer from 1 to 720.");
  }
  const normalized = {
    assignmentId: uuid(value.assignmentId, "assignmentId", issues),
    expiresInHours: typeof expiresInHours === "number" ? expiresInHours : 168,
    internalNote: optionalNote(value.internalNote, "internalNote", 500, issues),
  };
  if (issues.length > 0) throw new ResponseTokenValidationError(issues);
  return normalized;
}

export function validateRevokeAssignmentResponseTokenInput(input: unknown) {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["tokenId"], issues);
  const normalized = { tokenId: uuid(value.tokenId, "tokenId", issues) };
  if (issues.length > 0) throw new ResponseTokenValidationError(issues);
  return normalized;
}

export function validateReadAssignmentResponseByTokenInput(input: unknown) {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["token"], issues);
  const normalized = { token: bearer(value.token, issues) };
  if (issues.length > 0) throw new ResponseTokenValidationError(issues);
  return normalized;
}

export function validateSubmitAssignmentResponseByTokenInput(input: unknown) {
  const value = requireInput(input);
  const issues: string[] = [];
  rejectUnknownKeys(value, ["token", "status", "note"], issues);
  const status = value.status;
  if (
    typeof status !== "string" ||
    !publicAssignmentResponseStatuses.includes(status as PublicAssignmentResponseStatus)
  ) {
    issues.push("status must be confirmed or declined.");
  }
  const normalized: SubmitAssignmentResponseByTokenInput = {
    token: bearer(value.token, issues),
    status: publicAssignmentResponseStatuses.includes(status as PublicAssignmentResponseStatus)
      ? (status as PublicAssignmentResponseStatus)
      : "declined",
    note: optionalNote(value.note, "note", 1000, issues),
  };
  if (issues.length > 0) throw new ResponseTokenValidationError(issues);
  return normalized;
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

function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return isRecord(value[0]) ? value[0] : null;
}

export function parseIssuedAssignmentResponseToken(value: unknown): IssuedAssignmentResponseToken {
  const row = firstRow(value);
  if (!row) throw new Error("Token issuance returned an invalid result.");
  const issues: string[] = [];
  const token = text(row, "bearer_token", issues);
  if (!bearerPattern.test(token)) issues.push("bearer_token is invalid.");
  const result = {
    tokenId: uuid(row.token_id, "token_id", issues),
    token,
    expiresAt: text(row, "token_expires_at", issues),
  };
  if (issues.length > 0) throw new Error("Token issuance returned an invalid result.");
  return result;
}

export function parsePublicAssignmentResponseContext(
  value: unknown,
): PublicAssignmentResponseContext | null {
  if (Array.isArray(value) && value.length === 0) return null;
  const row = firstRow(value);
  if (!row) throw new Error("Token verification returned an invalid result.");
  const issues: string[] = [];
  const scheduleKind = row.schedule_kind;
  const responseStatus = row.current_response_status;
  if (!scheduleKinds.includes(scheduleKind as PublicAssignmentResponseContext["scheduleKind"])) {
    issues.push("schedule_kind is invalid.");
  }
  if (!responseStatuses.includes(responseStatus as PublicAssignmentResponseContext["currentResponseStatus"])) {
    issues.push("current_response_status is invalid.");
  }
  const result: PublicAssignmentResponseContext = {
    workspaceDisplayName: text(row, "workspace_display_name", issues),
    assignmentReference: uuid(row.assignment_reference, "assignment_reference", issues),
    taskTitle: text(row, "task_title", issues),
    scheduleKind: scheduleKind as PublicAssignmentResponseContext["scheduleKind"],
    startDate: text(row, "start_date", issues),
    endDate: nullableText(row, "end_date", issues),
    startTime: nullableText(row, "start_time", issues),
    endTime: nullableText(row, "end_time", issues),
    timezone: text(row, "schedule_timezone", issues),
    currentResponseStatus:
      responseStatus as PublicAssignmentResponseContext["currentResponseStatus"],
  };
  if (issues.length > 0) throw new Error("Token verification returned an invalid result.");
  return result;
}

export function parsePublicAssignmentResponseResult(
  value: unknown,
): PublicAssignmentResponseResult {
  const row = firstRow(value);
  if (!row) throw new Error("Public response returned an invalid result.");
  const issues: string[] = [];
  const status = row.current_response_status;
  if (!publicAssignmentResponseStatuses.includes(status as PublicAssignmentResponseStatus)) {
    issues.push("current_response_status is invalid.");
  }
  const result: PublicAssignmentResponseResult = {
    assignmentReference: uuid(row.assignment_reference, "assignment_reference", issues),
    status: status as PublicAssignmentResponseStatus,
    respondedAt: text(row, "response_recorded_at", issues),
  };
  if (issues.length > 0) throw new Error("Public response returned an invalid result.");
  return result;
}
