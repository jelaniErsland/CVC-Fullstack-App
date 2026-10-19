export type DatedAssignment = Readonly<{
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
}>;

export function groupScheduleByStartDate<T extends DatedAssignment>(assignments: readonly T[]) {
  const groups: { date: string; assignments: T[] }[] = [];
  for (const assignment of assignments) {
    const last = groups.at(-1);
    if (last?.date === assignment.startDate) last.assignments.push(assignment);
    else groups.push({ date: assignment.startDate, assignments: [assignment] });
  }
  return groups;
}

function minutes(value: string | null) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function sameDayShiftLabel(assignment: DatedAssignment, sameDayCount: number) {
  if (sameDayCount < 2) return null;
  const start = minutes(assignment.startTime);
  const end = minutes(assignment.endTime);
  if (start === null || end === null) return null;
  if (assignment.endDate && assignment.endDate !== assignment.startDate) return "Overnight";
  if (end <= start) return null;
  if (start < 12 * 60 && end <= 12 * 60) return "Morning";
  if (start >= 12 * 60 && end <= 17 * 60) return "Afternoon";
  if (start >= 17 * 60) return "Evening";
  return null;
}
