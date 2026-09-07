import {
  CalendarItemValidationError,
  type CalendarCustomValue,
  type CalendarTaskSource,
  validateCreateCalendarItemInput,
} from "./item.ts";

export const CALENDAR_REPEAT_MAX_ITEMS = 100;

export type CalendarRepeatMeal = Readonly<{
  kind: "breakfast" | "lunch";
  provider: string | null;
  contact: string | null;
  menu: string | null;
  total: number | null;
}>;

export type CreateRepeatedCalendarItemsInput = Readonly<{
  requestKey: string;
  workspaceId: string;
  source: CalendarTaskSource;
  startDate: string;
  endDate: string;
  weekdays: readonly number[];
  startTime: string;
  endTime: string;
  neededCount: number;
  notes: string | null;
  customValues: Readonly<Record<string, CalendarCustomValue>>;
  meal: CalendarRepeatMeal | null;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeWeekdays(value: unknown, issues: string[]) {
  if (!Array.isArray(value)) {
    issues.push("Choose at least one weekday.");
    return [] as number[];
  }
  const weekdays = [...new Set(value.filter((day): day is number =>
    typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
  ))].sort((left, right) => left - right);
  if (weekdays.length !== value.length || weekdays.length === 0) {
    issues.push("Choose at least one valid weekday.");
  }
  return weekdays;
}

function normalizeOptionalText(value: unknown, maximum: number, field: string, issues: string[]) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    issues.push(`${field} is invalid.`);
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > maximum) issues.push(`${field} is too long.`);
  return normalized;
}

function normalizeMeal(value: unknown, source: CalendarTaskSource | undefined, issues: string[]) {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) {
    issues.push("meal details are invalid.");
    return null;
  }
  const allowed = new Set(["kind", "provider", "contact", "menu", "total"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) issues.push("meal details contain unsupported fields.");
  if (value.kind !== "breakfast" && value.kind !== "lunch") issues.push("meal kind is invalid.");
  if (source?.kind !== "preset") issues.push("meal repeats require a system task preset.");
  const provider = normalizeOptionalText(value.provider, 300, "meal provider", issues);
  const contact = normalizeOptionalText(value.contact, 500, "meal contact", issues);
  const menu = normalizeOptionalText(value.menu, 2000, "meal menu", issues);
  const total = value.total === null || value.total === undefined || value.total === "" ? null : value.total;
  if (total !== null && (!Number.isInteger(total) || Number(total) < 0 || Number(total) > 100000)) {
    issues.push("meal total is invalid.");
  }
  return {
    kind: value.kind as "breakfast" | "lunch",
    provider,
    contact,
    menu,
    total: total as number | null,
  };
}

export function expandRepeatDates(startDate: string, endDate: string, weekdays: readonly number[]) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    if (weekdays.includes(cursor.getUTCDay())) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function validateCreateRepeatedCalendarItemsInput(input: unknown): CreateRepeatedCalendarItemsInput {
  if (!isRecord(input)) throw new CalendarItemValidationError(["input must be an object."]);
  const issues: string[] = [];
  const allowed = new Set([
    "requestKey", "workspaceId", "source", "startDate", "endDate", "weekdays",
    "startTime", "endTime", "neededCount", "notes", "customValues", "meal",
  ]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length) issues.push(`unsupported fields: ${unknown.sort().join(", ")}.`);
  if (typeof input.requestKey !== "string" || !uuidPattern.test(input.requestKey)) {
    issues.push("requestKey is invalid.");
  }
  const weekdays = normalizeWeekdays(input.weekdays, issues);
  let normalizedBase: ReturnType<typeof validateCreateCalendarItemInput> | undefined;
  try {
    normalizedBase = validateCreateCalendarItemInput({
      workspaceId: input.workspaceId,
      source: input.source,
      schedule: {
        kind: "timed",
        date: input.startDate,
        startTime: input.startTime,
        endTime: input.endTime,
      },
      neededCount: input.neededCount,
      notes: input.notes,
      customValues: input.customValues,
    });
  } catch (error) {
    if (error instanceof CalendarItemValidationError) issues.push(...error.issues);
    else throw error;
  }
  let endDate = "";
  try {
    validateCreateCalendarItemInput({
      workspaceId: input.workspaceId,
      source: input.source,
      schedule: { kind: "timed", date: input.endDate, startTime: input.startTime, endTime: input.endTime },
      neededCount: input.neededCount,
      notes: input.notes,
      customValues: input.customValues,
    });
    endDate = input.endDate as string;
  } catch {
    issues.push("endDate must be a real calendar date.");
  }
  const startDate = normalizedBase?.schedule.kind === "timed" ? normalizedBase.schedule.date : "";
  if (startDate && endDate && endDate < startDate) issues.push("endDate must not be before startDate.");
  const dates = startDate && endDate ? expandRepeatDates(startDate, endDate, weekdays) : [];
  if (dates.length === 0) issues.push("Choose a date range and weekday that creates work.");
  if (dates.length > CALENDAR_REPEAT_MAX_ITEMS) {
    issues.push(`Repeat scheduling is limited to ${CALENDAR_REPEAT_MAX_ITEMS} items at a time.`);
  }
  const meal = normalizeMeal(input.meal, normalizedBase?.source, issues);
  if (issues.length) throw new CalendarItemValidationError(issues);
  return {
    requestKey: input.requestKey as string,
    workspaceId: normalizedBase!.workspaceId,
    source: normalizedBase!.source,
    startDate,
    endDate,
    weekdays,
    startTime: (normalizedBase!.schedule as { startTime: string }).startTime,
    endTime: (normalizedBase!.schedule as { endTime: string }).endTime,
    neededCount: normalizedBase!.neededCount,
    notes: normalizedBase!.notes ?? null,
    customValues: normalizedBase!.customValues,
    meal,
  };
}

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function repeatedCalendarItemsInputFromFormData(formData: FormData, workspaceId: string) {
  const source = formText(formData, "sourceMode") === "preset"
    ? { kind: "preset" as const, taskPresetId: formText(formData, "taskPresetId") }
    : {
        kind: "one_off" as const,
        title: formText(formData, "title"),
        taskType: formText(formData, "taskType"),
      };
  const mealKind = formText(formData, "mealKind");
  const totalText = formText(formData, "total");
  return validateCreateRepeatedCalendarItemsInput({
    requestKey: formText(formData, "repeatRequestKey"),
    workspaceId,
    source,
    startDate: formText(formData, "repeatStartDate"),
    endDate: formText(formData, "repeatEndDate"),
    weekdays: formData.getAll("repeatWeekdays").map((value) => Number(value)),
    startTime: formText(formData, "startTime"),
    endTime: formText(formData, "endTime"),
    neededCount: Number(formText(formData, "neededCount")),
    notes: formText(formData, "notes").trim() || null,
    customValues: {},
    meal: mealKind === "breakfast" || mealKind === "lunch"
      ? {
          kind: mealKind,
          provider: formText(formData, "provider") || null,
          contact: formText(formData, "contact") || null,
          menu: formText(formData, "menu") || null,
          total: totalText === "" ? null : Number(totalText),
        }
      : null,
  });
}
