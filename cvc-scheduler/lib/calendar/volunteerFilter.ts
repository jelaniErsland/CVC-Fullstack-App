export type CalendarVolunteerOption = Readonly<{
  id: string;
  name: string;
  congregation: string | null;
}>;

type VolunteerSummary = Readonly<{ id: string; displayName: string; congregation: string | null }>;
type AssignmentSummary = Readonly<{
  volunteerProfileId: string;
  volunteerDisplayName: string;
  volunteerCongregation: string | null;
}>;

export function calendarVolunteerOptions(
  volunteers: readonly VolunteerSummary[],
  assignments: readonly AssignmentSummary[],
): CalendarVolunteerOption[] {
  const byId = new Map<string, CalendarVolunteerOption>();
  for (const volunteer of volunteers) {
    byId.set(volunteer.id, { id: volunteer.id, name: volunteer.displayName, congregation: volunteer.congregation });
  }
  for (const assignment of assignments) {
    if (!byId.has(assignment.volunteerProfileId)) {
      byId.set(assignment.volunteerProfileId, {
        id: assignment.volunteerProfileId,
        name: assignment.volunteerDisplayName,
        congregation: assignment.volunteerCongregation,
      });
    }
  }
  return [...byId.values()].sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));
}

function searchableName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function volunteerNameMatches(name: string, query: string) {
  const words = searchableName(query).split(/\s+/).filter(Boolean);
  const normalizedName = searchableName(name);
  return words.every((word) => normalizedName.includes(word));
}

export function searchCalendarVolunteers(options: readonly CalendarVolunteerOption[], query: string) {
  if (!query.trim()) return [];
  return options.filter((option) => volunteerNameMatches(option.name, query));
}

export function calendarVolunteerDetail(option: CalendarVolunteerOption, options: readonly CalendarVolunteerOption[]) {
  const identical = options.filter((candidate) => candidate.name === option.name && candidate.congregation === option.congregation);
  const congregation = option.congregation ?? "Volunteer";
  return identical.length > 1 ? `${congregation} · profile ${option.id.slice(-4)}` : congregation;
}

export function calendarVolunteerFilterLabel(option: CalendarVolunteerOption, options: readonly CalendarVolunteerOption[]) {
  const sameName = options.filter((candidate) => candidate.name === option.name);
  return sameName.length > 1 ? `${option.name} · ${calendarVolunteerDetail(option, options)}` : option.name;
}

export function itemHasCalendarVolunteer(
  item: Readonly<{ assignments?: readonly Readonly<{ volunteerProfileId: string; responseStatus: string }>[] }>,
  volunteerId: string,
) {
  // Declined assignments remain visible with their existing "Can't make it" status.
  // The Calendar's coverage calculation, which excludes them from staffing, is unchanged.
  return item.assignments?.some((assignment) => assignment.volunteerProfileId === volunteerId) ?? false;
}
