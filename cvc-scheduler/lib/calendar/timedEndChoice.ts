export type TimedEndMode = "automatic" | "sameDay" | "nextDay" | "laterDate";

export type TimedEndState = Readonly<{
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  endDayMode: TimedEndMode;
}>;

export function shiftCalendarDate(date: string, days: number): string {
  const start = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(start)
    ? new Date(start + days * 86_400_000).toISOString().slice(0, 10)
    : date;
}

export function calendarDayOffset(startDate: string, endDate: string): number {
  return Math.round(
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
  );
}

export function initialTimedEndState(input: {
  date: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
}): TimedEndState {
  const endDate = input.endDate ?? input.date;
  const offset = calendarDayOffset(input.date, endDate);
  const endDayMode: TimedEndMode = offset > 1
    ? "laterDate"
    : offset === 1 && input.endTime >= input.startTime
      ? "nextDay"
      : "automatic";
  return updateTimedEndState({ ...input, endDate, endDayMode }, {});
}

export function updateTimedEndState(
  current: TimedEndState,
  changes: Partial<TimedEndState>,
): TimedEndState {
  const date = changes.date ?? current.date;
  const startTime = changes.startTime ?? current.startTime;
  const endTime = changes.endTime ?? current.endTime;
  const timeChanged = changes.startTime !== undefined || changes.endTime !== undefined;
  const endDayMode = changes.endDayMode ?? (
    timeChanged && current.endDayMode === "nextDay" ? "automatic" : current.endDayMode
  );
  let endDate = changes.endDate ?? current.endDate;

  if (endDayMode === "laterDate") {
    if (changes.endDayMode === "laterDate" && current.endDayMode !== "laterDate") {
      endDate = shiftCalendarDate(date, 2);
    } else if (changes.date !== undefined && changes.endDate === undefined) {
      const offset = calendarDayOffset(current.date, current.endDate);
      endDate = shiftCalendarDate(date, Number.isFinite(offset) ? Math.max(2, offset) : 2);
    }
  } else if (endDayMode === "nextDay" || (
    endDayMode === "automatic" && startTime !== "" && endTime !== "" && endTime < startTime
  )) {
    endDate = shiftCalendarDate(date, 1);
  } else {
    endDate = date;
  }

  return { date, endDate, startTime, endTime, endDayMode };
}
