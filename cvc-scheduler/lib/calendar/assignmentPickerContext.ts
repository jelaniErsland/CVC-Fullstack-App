import type { BulkAssignmentPlan } from "./bulkAssignments.ts";

export type PickerConflict = Readonly<{
  assignmentId: string;
  date: string;
  endDate: string | null;
  title: string;
  startTime: string | null;
  endTime: string | null;
}>;
export type PickerAwayPeriod = Readonly<{ start: string; end: string }>;
export type PickerOccurrence = Readonly<{ date: string; endDate: string | null; endTime: string | null }>;
export type PickerVolunteerContext = Readonly<{
  volunteerId: string;
  conflicts: readonly PickerConflict[];
  awayPeriods: readonly PickerAwayPeriod[];
}>;
export type PickerContextState =
  | Readonly<{ kind: "ready"; volunteers: readonly PickerVolunteerContext[] }>
  | Readonly<{ kind: "unavailable" }>;
export type PickerContextAction = (form: FormData) => Promise<PickerContextState>;

export function pickerContextPlan(plan: BulkAssignmentPlan): BulkAssignmentPlan {
  return { itemIds: plan.itemIds, volunteers: [], note: null, ...(plan.create ? { create: { ...plan.create, notes: null, customValues: {}, meal: null } } : {}) };
}

export function awayDates(periods: readonly PickerAwayPeriod[], dates: readonly string[]) {
  return dates.filter(date => periods.some(period => period.start <= date && date <= period.end));
}

export function awayOccurrences(periods: readonly PickerAwayPeriod[], occurrences: readonly PickerOccurrence[]) {
  return occurrences.filter(occurrence => {
    const end = occurrence.endDate && occurrence.endTime?.slice(0, 5) !== "00:00" ? occurrence.endDate : occurrence.date;
    return periods.some(period => period.start <= end && period.end >= occurrence.date);
  });
}

export function outsideUsualWorkDays(usualDays: readonly string[], dates: readonly string[]) {
  if (!usualDays.length) return [];
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return dates.filter(date => !usualDays.includes(names[new Date(`${date}T12:00:00Z`).getUTCDay()]));
}

export function pickerAvailability(context: PickerVolunteerContext | undefined, dates: readonly string[], usualDays: readonly string[] = [], occurrences: readonly PickerOccurrence[] = dates.map(date => ({ date, endDate: null, endTime: null }))) {
  if (!context) return { kind: "unknown" as const, label: "Checking availability…" };
  const away = awayOccurrences(context.awayPeriods, occurrences);
  const conflicts = context.conflicts;
  if (away.length) return { kind: "away" as const, label: dates.length === 1 ? occurrences.some(item => item.endDate && item.endDate !== item.date) ? "Away during this shift" : "Away that day" : `Away ${away.length} of ${occurrences.length} shifts` };
  if (conflicts.length) return { kind: "conflict" as const, label: dates.length === 1 ? "Has overlapping work" : `${conflicts.length} overlapping ${conflicts.length === 1 ? "assignment" : "assignments"} across ${dates.length} days` };
  const outside = outsideUsualWorkDays(usualDays, dates);
  if (outside.length) return { kind: "limited" as const, label: dates.length === 1 ? "Outside usual work days" : `Usual work days: ${dates.length - outside.length} of ${dates.length} selected days` };
  return { kind: "available" as const, label: dates.length > 1 ? `Available all ${dates.length} days · No known conflicts` : "Available · No known conflicts" };
}
