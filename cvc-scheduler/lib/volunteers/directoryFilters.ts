import { validateStructuredSkills } from "./skills.ts";
import type { VolunteerProfile, VolunteerWeekday } from "./profile.ts";

export type DirectoryFilters = {
  statuses: VolunteerProfile["lifecycle"][];
  congregations: string[];
  days: VolunteerWeekday[];
  skills: string[];
  security: "all" | "yes" | "no" | "unknown";
  housing: "all" | "yes" | "no" | "unknown";
  twoPlusDays: "all" | "yes" | "no" | "unknown";
};
export const emptyDirectoryFilters = (): DirectoryFilters => ({ statuses: [], congregations: [], days: [], skills: [], security: "all", housing: "all", twoPlusDays: "all" });

// Only explicitly recorded current profile categories are skill tags. Free prose
// remains searchable, but never becomes an inferred qualification or a chip.
export function recordedVolunteerSkills(volunteer: VolunteerProfile): readonly string[] {
  return validateStructuredSkills(volunteer.structuredSkills);
}

export function indexDirectory(volunteers: readonly VolunteerProfile[]) {
  return volunteers.map(volunteer => {
    const skills = recordedVolunteerSkills(volunteer);
    const searchText = [volunteer.fullName, volunteer.email, volunteer.phone, volunteer.congregation, volunteer.lifecycle, volunteer.readinessStatus, volunteer.profileNotes, volunteer.skillsExperience, volunteer.otherSupport, ...skills].join(" ").toLocaleLowerCase("en-US");
    return { volunteer, skills, searchText };
  });
}
export type IndexedDirectory = ReturnType<typeof indexDirectory>;
export function filterDirectory(index: IndexedDirectory, query: string, filters: DirectoryFilters) {
  const term = query.trim().toLocaleLowerCase("en-US");
  return index.filter(({ volunteer: v, skills, searchText }) =>
    (!term || searchText.includes(term)) &&
    (!filters.statuses.length || filters.statuses.includes(v.lifecycle)) &&
    (!filters.congregations.length || filters.congregations.includes(v.congregation ?? "")) &&
    (!filters.days.length || filters.days.some(day => v.availableWorkDays.includes(day))) &&
    filters.skills.every(skill => skills.includes(skill)) &&
    (filters.security === "all" || filters.security === v.afterHoursSecurityAvailability) &&
    (filters.housing === "all" || filters.housing === v.housingOption) &&
    (filters.twoPlusDays === "all" || filters.twoPlusDays === v.availableTwoPlusDays)
  );
}
export function directoryCategoryCount(filters: DirectoryFilters) {
  return [filters.statuses.length, filters.congregations.length, filters.days.length, filters.skills.length, filters.security !== "all", filters.housing !== "all", filters.twoPlusDays !== "all"].filter(Boolean).length;
}
export function prioritizedSkills(skills: readonly string[], query: string, selected: readonly string[]) {
  const term = query.trim().toLocaleLowerCase("en-US");
  return [...skills].sort((a, b) => {
    const priority = (skill: string) => selected.includes(skill) || (!!term && skill.toLocaleLowerCase("en-US").includes(term)) ? 0 : 1;
    return priority(a) - priority(b) || a.localeCompare(b);
  });
}
