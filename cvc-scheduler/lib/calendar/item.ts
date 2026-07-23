export const calendarScheduleKinds = [
  "timed",
  "date_based",
  "multi_day_window",
  "milestone",
] as const;
export const calendarTaskTypes = ["general", "food", "security", "custom"] as const;

export type CalendarScheduleKind = (typeof calendarScheduleKinds)[number];
export type CalendarTaskType = (typeof calendarTaskTypes)[number];
export type CalendarCustomValue = string | number | boolean | null;

export type CalendarTaskSource =
  | Readonly<{ kind: "preset"; taskPresetId: string }>
  | Readonly<{ kind: "one_off"; title: string; taskType: CalendarTaskType }>;

export type CalendarSchedule =
  | Readonly<{ kind: "timed"; date: string; startTime: string; endTime: string }>
  | Readonly<{ kind: "date_based"; date: string }>
  | Readonly<{ kind: "multi_day_window"; startDate: string; endDate: string }>
  | Readonly<{ kind: "milestone"; date: string }>;

export type CreateCalendarItemInput = Readonly<{
  workspaceId: string;
  source: CalendarTaskSource;
  schedule: CalendarSchedule;
  neededCount: number;
  notes?: string | null;
  customValues: Readonly<Record<string, CalendarCustomValue>>;
}>;

export type UpdateCalendarOneOffTimedItemInput = Readonly<{
  calendarItemId: string;
  source: Readonly<{ title: string; taskType: CalendarTaskType }>;
  schedule: Readonly<{ kind: "timed"; date: string; startTime: string; endTime: string }>;
  neededCount: number;
  notes?: string | null;
  customValues: Readonly<Record<string, CalendarCustomValue>>;
}>;

export type UpdateCalendarPresetTimedItemInput = Readonly<{
  calendarItemId: string;
  schedule: Readonly<{ kind: "timed"; date: string; startTime: string; endTime: string }>;
  neededCount: number;
  notes?: string | null;
  customValues: Readonly<Record<string, CalendarCustomValue>>;
}>;

export type PublishCalendarItemInput = Readonly<{
  calendarItemId: string;
}>;

export type CalendarItem = Readonly<{
  id: string;
  workspaceId: string;
  taskPresetId: string | null;
  title: string;
  taskType: CalendarTaskType;
  schedule: CalendarSchedule;
  timezone: string;
  neededCount: number;
  notes: string | null;
  customValues: Readonly<Record<string, CalendarCustomValue>>;
  lifecycle: "active" | "archived" | "canceled";
  publicationState: "draft" | "published";
  createdByProjectContactId: string | null;
  publishedAt: string | null;
  publishedByProjectContactId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export class CalendarItemValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Calendar item input is invalid.");
    this.name = "CalendarItemValidationError";
    this.issues = issues;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const customKeyPattern = /^[a-z][a-z0-9_]{0,39}$/;
const rootKeys = new Set([
  "workspaceId",
  "source",
  "schedule",
  "neededCount",
  "notes",
  "customValues",
]);
const updateOneOffTimedRootKeys = new Set([
  "calendarItemId",
  "source",
  "schedule",
  "neededCount",
  "notes",
  "customValues",
]);
const updatePresetTimedRootKeys = new Set([
  "calendarItemId",
  "schedule",
  "neededCount",
  "notes",
  "customValues",
]);
const publishRootKeys = new Set(["calendarItemId"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
  issues: string[],
) {
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) issues.push(`${label} contains unsupported fields: ${unknown.sort().join(", ")}.`);
}

function normalizeUuid(value: unknown, label: string, issues: string[]) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    issues.push(`${label} must be a UUID.`);
    return "";
  }
  return value.trim().toLowerCase();
}

function boundedText(
  value: unknown,
  label: string,
  issues: string[],
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "string") {
    issues.push(`${label} must be text.`);
    return "";
  }
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    issues.push(`${label} must be ${minimum}-${maximum} characters.`);
  }
  return normalized;
}

function normalizeDate(value: unknown, label: string, issues: string[]) {
  if (typeof value !== "string") {
    issues.push(`${label} must be an ISO date.`);
    return "";
  }
  const match = datePattern.exec(value);
  if (!match) {
    issues.push(`${label} must use YYYY-MM-DD.`);
    return "";
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    issues.push(`${label} is not a real calendar date.`);
  }
  return value;
}

function normalizeTime(value: unknown, label: string, issues: string[]) {
  if (typeof value !== "string" || !timePattern.test(value)) {
    issues.push(`${label} must use 24-hour HH:MM.`);
    return "";
  }
  return value;
}

function timeMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function parseCustomValues(value: unknown, issues: string[]) {
  if (!isRecord(value) || Object.keys(value).length > 20) {
    issues.push("customValues must be an object with at most 20 values.");
    return {};
  }
  const normalized: Record<string, CalendarCustomValue> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (!customKeyPattern.test(key)) issues.push(`customValues key ${key} is invalid.`);
    if (
      fieldValue !== null &&
      typeof fieldValue !== "string" &&
      typeof fieldValue !== "number" &&
      typeof fieldValue !== "boolean"
    ) {
      issues.push(`customValues.${key} must be a scalar value.`);
      continue;
    }
    if (typeof fieldValue === "string" && fieldValue.length > 2000) {
      issues.push(`customValues.${key} exceeds 2000 characters.`);
    }
    if (typeof fieldValue === "number" && !Number.isFinite(fieldValue)) {
      issues.push(`customValues.${key} must be finite.`);
    }
    normalized[key] = fieldValue;
  }
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > 16384) {
    issues.push("customValues exceeds 16384 bytes.");
  }
  return normalized;
}

function parseSource(value: unknown, issues: string[]): CalendarTaskSource {
  if (!isRecord(value)) {
    issues.push("source must be an object.");
    return { kind: "one_off", title: "Invalid", taskType: "custom" };
  }
  if (value.kind === "preset") {
    rejectUnknownKeys(value, ["kind", "taskPresetId"], "source", issues);
    return {
      kind: "preset",
      taskPresetId: normalizeUuid(value.taskPresetId, "source.taskPresetId", issues),
    };
  }
  if (value.kind === "one_off") {
    rejectUnknownKeys(value, ["kind", "title", "taskType"], "source", issues);
    const taskType = value.taskType;
    if (typeof taskType !== "string" || !calendarTaskTypes.includes(taskType as CalendarTaskType)) {
      issues.push("source.taskType is unsupported.");
    }
    return {
      kind: "one_off",
      title: boundedText(value.title, "source.title", issues, 1, 160),
      taskType: calendarTaskTypes.includes(taskType as CalendarTaskType)
        ? (taskType as CalendarTaskType)
        : "custom",
    };
  }
  issues.push("source.kind must be preset or one_off.");
  return { kind: "one_off", title: "Invalid", taskType: "custom" };
}

function parseSchedule(value: unknown, issues: string[]): CalendarSchedule {
  if (!isRecord(value)) {
    issues.push("schedule must be an object.");
    return { kind: "milestone", date: "" };
  }
  if (value.kind === "timed") {
    rejectUnknownKeys(value, ["kind", "date", "startTime", "endTime"], "schedule", issues);
    const startTime = normalizeTime(value.startTime, "schedule.startTime", issues);
    const endTime = normalizeTime(value.endTime, "schedule.endTime", issues);
    if (startTime && endTime && timeMinutes(endTime) <= timeMinutes(startTime)) {
      issues.push("schedule.endTime must be later than startTime; overnight work is deferred.");
    }
    return {
      kind: "timed",
      date: normalizeDate(value.date, "schedule.date", issues),
      startTime,
      endTime,
    };
  }
  if (value.kind === "date_based" || value.kind === "milestone") {
    rejectUnknownKeys(value, ["kind", "date"], "schedule", issues);
    return {
      kind: value.kind,
      date: normalizeDate(value.date, "schedule.date", issues),
    };
  }
  if (value.kind === "multi_day_window") {
    rejectUnknownKeys(value, ["kind", "startDate", "endDate"], "schedule", issues);
    const startDate = normalizeDate(value.startDate, "schedule.startDate", issues);
    const endDate = normalizeDate(value.endDate, "schedule.endDate", issues);
    if (startDate && endDate && endDate <= startDate) {
      issues.push("schedule.endDate must be later than startDate.");
    }
    return { kind: "multi_day_window", startDate, endDate };
  }
  issues.push("schedule.kind is unsupported.");
  return { kind: "milestone", date: "" };
}

function parseOneOffTimedUpdateSource(
  value: unknown,
  issues: string[],
): UpdateCalendarOneOffTimedItemInput["source"] {
  if (!isRecord(value)) {
    issues.push("source must be an object.");
    return { title: "Invalid", taskType: "custom" };
  }
  rejectUnknownKeys(value, ["title", "taskType"], "source", issues);
  const taskType = value.taskType;
  if (typeof taskType !== "string" || !calendarTaskTypes.includes(taskType as CalendarTaskType)) {
    issues.push("source.taskType is unsupported.");
  }
  return {
    title: boundedText(value.title, "source.title", issues, 1, 160),
    taskType: calendarTaskTypes.includes(taskType as CalendarTaskType)
      ? (taskType as CalendarTaskType)
      : "custom",
  };
}

function parseTimedScheduleForUpdate(
  value: unknown,
  issues: string[],
): UpdateCalendarOneOffTimedItemInput["schedule"] {
  const schedule = parseSchedule(value, issues);
  if (schedule.kind !== "timed") {
    issues.push("schedule.kind must be timed for this Calendar edit.");
    return { kind: "timed", date: "", startTime: "", endTime: "" };
  }
  return schedule;
}

function normalizeUpdateTimedSharedFields(input: Record<string, unknown>, issues: string[]) {
  const schedule = parseTimedScheduleForUpdate(input.schedule, issues);
  const neededCount = input.neededCount;
  if (
    typeof neededCount !== "number" ||
    !Number.isInteger(neededCount) ||
    neededCount < 0 ||
    neededCount > 99
  ) {
    issues.push("neededCount must be an integer from 0 to 99 for assignable work.");
  }
  const notes =
    input.notes === null || input.notes === undefined
      ? null
      : boundedText(input.notes, "notes", issues, 1, 4000);
  return {
    schedule,
    neededCount: typeof neededCount === "number" ? neededCount : 0,
    notes,
    customValues: parseCustomValues(input.customValues, issues),
  };
}

export function validateCreateCalendarItemInput(input: unknown): CreateCalendarItemInput {
  if (!isRecord(input)) {
    throw new CalendarItemValidationError(["input must be an object."]);
  }
  const issues: string[] = [];
  const unknown = Object.keys(input).filter((key) => !rootKeys.has(key));
  if (unknown.length > 0) issues.push(`unsupported fields: ${unknown.sort().join(", ")}.`);
  const source = parseSource(input.source, issues);
  const schedule = parseSchedule(input.schedule, issues);
  const neededCount = input.neededCount;
  const requiresHelpers = schedule.kind === "timed" || schedule.kind === "date_based";
  if (
    typeof neededCount !== "number" ||
    !Number.isInteger(neededCount) ||
    (requiresHelpers ? neededCount < 0 || neededCount > 99 : neededCount !== 0)
  ) {
    issues.push(
      requiresHelpers
        ? "neededCount must be an integer from 0 to 99 for assignable work."
        : "neededCount must be 0 for project windows and milestones.",
    );
  }
  const notes =
    input.notes === null || input.notes === undefined
      ? null
      : boundedText(input.notes, "notes", issues, 1, 4000);
  const normalized: CreateCalendarItemInput = {
    workspaceId: normalizeUuid(input.workspaceId, "workspaceId", issues),
    source,
    schedule,
    neededCount: typeof neededCount === "number" ? neededCount : 0,
    notes,
    customValues: parseCustomValues(input.customValues, issues),
  };
  if (issues.length > 0) throw new CalendarItemValidationError(issues);
  return normalized;
}

export function validateUpdateCalendarOneOffTimedItemInput(
  input: unknown,
): UpdateCalendarOneOffTimedItemInput {
  if (!isRecord(input)) {
    throw new CalendarItemValidationError(["input must be an object."]);
  }
  const issues: string[] = [];
  const unknown = Object.keys(input).filter((key) => !updateOneOffTimedRootKeys.has(key));
  if (unknown.length > 0) issues.push(`unsupported fields: ${unknown.sort().join(", ")}.`);
  const source = parseOneOffTimedUpdateSource(input.source, issues);
  const shared = normalizeUpdateTimedSharedFields(input, issues);
  const normalized: UpdateCalendarOneOffTimedItemInput = {
    calendarItemId: normalizeUuid(input.calendarItemId, "calendarItemId", issues),
    source,
    ...shared,
  };
  if (issues.length > 0) throw new CalendarItemValidationError(issues);
  return normalized;
}

export function validateUpdateCalendarPresetTimedItemInput(
  input: unknown,
): UpdateCalendarPresetTimedItemInput {
  if (!isRecord(input)) {
    throw new CalendarItemValidationError(["input must be an object."]);
  }
  const issues: string[] = [];
  const unknown = Object.keys(input).filter((key) => !updatePresetTimedRootKeys.has(key));
  if (unknown.length > 0) issues.push(`unsupported fields: ${unknown.sort().join(", ")}.`);
  const shared = normalizeUpdateTimedSharedFields(input, issues);
  const normalized: UpdateCalendarPresetTimedItemInput = {
    calendarItemId: normalizeUuid(input.calendarItemId, "calendarItemId", issues),
    ...shared,
  };
  if (issues.length > 0) throw new CalendarItemValidationError(issues);
  return normalized;
}

export function validatePublishCalendarItemInput(input: unknown): PublishCalendarItemInput {
  if (!isRecord(input)) {
    throw new CalendarItemValidationError(["input must be an object."]);
  }
  const issues: string[] = [];
  const unknown = Object.keys(input).filter((key) => !publishRootKeys.has(key));
  if (unknown.length > 0) issues.push(`unsupported fields: ${unknown.sort().join(", ")}.`);
  const normalized = {
    calendarItemId: normalizeUuid(input.calendarItemId, "calendarItemId", issues),
  };
  if (issues.length > 0) throw new CalendarItemValidationError(issues);
  return normalized;
}

export function parseCalendarItem(value: unknown): CalendarItem {
  if (!isRecord(value)) throw new Error("Calendar item read returned an invalid row.");
  const issues: string[] = [];
  const taskPresetId =
    value.task_preset_id === null
      ? null
      : normalizeUuid(value.task_preset_id, "task_preset_id", issues);
  const schedule = parseSchedule(
    value.schedule_kind === "timed"
      ? {
          kind: "timed",
          date: value.start_date,
          startTime: typeof value.start_time === "string" ? value.start_time.slice(0, 5) : value.start_time,
          endTime: typeof value.end_time === "string" ? value.end_time.slice(0, 5) : value.end_time,
        }
      : value.schedule_kind === "multi_day_window"
        ? { kind: "multi_day_window", startDate: value.start_date, endDate: value.end_date }
        : { kind: value.schedule_kind, date: value.start_date },
    issues,
  );
  const taskType = value.task_type_snapshot;
  const lifecycle = value.lifecycle;
  const publicationState = value.publication_state;
  if (typeof taskType !== "string" || !calendarTaskTypes.includes(taskType as CalendarTaskType)) {
    issues.push("task_type_snapshot is invalid.");
  }
  if (lifecycle !== "active" && lifecycle !== "archived" && lifecycle !== "canceled") {
    issues.push("lifecycle is invalid.");
  }
  if (publicationState !== "draft" && publicationState !== "published") {
    issues.push("publication_state is invalid.");
  }
  if (typeof value.needed_count !== "number" || !Number.isInteger(value.needed_count)) {
    issues.push("needed_count is invalid.");
  } else {
    const requiresHelpers = schedule.kind === "timed" || schedule.kind === "date_based";
    if (
      (requiresHelpers && (value.needed_count < 0 || value.needed_count > 99)) ||
      (!requiresHelpers && value.needed_count !== 0)
    ) {
      issues.push("needed_count does not match the schedule kind.");
    }
  }
  const customValues = parseCustomValues(value.custom_values, issues);
  const requiredText = (field: string) => {
    const fieldValue = value[field];
    if (typeof fieldValue !== "string" || fieldValue.length === 0) {
      issues.push(`${field} is invalid.`);
      return "";
    }
    return fieldValue;
  };
  const notes = value.schedule_notes;
  if (notes !== null && typeof notes !== "string") issues.push("schedule_notes is invalid.");
  const id = normalizeUuid(value.id, "id", issues);
  const workspaceId = normalizeUuid(value.workspace_id, "workspace_id", issues);
  const createdByProjectContactId =
    value.created_by_project_contact_id === null
      ? null
      : normalizeUuid(
          value.created_by_project_contact_id,
          "created_by_project_contact_id",
          issues,
        );
  const publishedByProjectContactId =
    value.published_by_project_contact_id === null
      ? null
      : normalizeUuid(
          value.published_by_project_contact_id,
          "published_by_project_contact_id",
          issues,
        );
  const title = requiredText("title_snapshot");
  const timezone = requiredText("timezone");
  const createdAt = requiredText("created_at");
  const updatedAt = requiredText("updated_at");
  if (issues.length > 0) throw new Error("Calendar item row is invalid.");
  return {
    id,
    workspaceId,
    taskPresetId,
    title,
    taskType: taskType as CalendarTaskType,
    schedule,
    timezone,
    neededCount: value.needed_count as number,
    notes: notes as string | null,
    customValues,
    lifecycle: lifecycle as CalendarItem["lifecycle"],
    publicationState: publicationState as CalendarItem["publicationState"],
    createdByProjectContactId,
    publishedAt: value.published_at as string | null,
    publishedByProjectContactId,
    createdAt,
    updatedAt,
  };
}
