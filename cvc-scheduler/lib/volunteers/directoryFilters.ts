import { volunteerExperienceSources } from "./experience.ts";
import type { VolunteerProfile, VolunteerWeekday } from "./profile.ts";

export type DirectoryFilters = {
  statuses: VolunteerProfile["lifecycle"][];
  congregations: string[];
  days: VolunteerWeekday[];
  experienceTerms: string[];
  security: "all" | "yes" | "no" | "unknown";
  housing: "all" | "yes" | "no" | "unknown";
  twoPlusDays: "all" | "yes" | "no" | "unknown";
};
export const emptyDirectoryFilters = (): DirectoryFilters => ({ statuses: [], congregations: [], days: [], experienceTerms: [], security: "all", housing: "all", twoPlusDays: "all" });

export function indexDirectory(volunteers: readonly VolunteerProfile[]) {
  return volunteers.map(volunteer => {
    const sources = volunteerExperienceSources(volunteer);
    const experienceText = sources.map(source => source.text).join("\n").toLocaleLowerCase("en-US");
    const searchText = [volunteer.fullName, volunteer.email, volunteer.phone, volunteer.congregation, volunteer.lifecycle, volunteer.readinessStatus, volunteer.profileNotes, volunteer.otherSupport, experienceText].join(" ").toLocaleLowerCase("en-US");
    return { volunteer, sources, experienceText, searchText };
  });
}
export type IndexedDirectory = ReturnType<typeof indexDirectory>;
export function filterDirectory(index: IndexedDirectory, query: string, filters: DirectoryFilters) {
  const term = query.trim().toLocaleLowerCase("en-US");
  return index.filter(({ volunteer: v, experienceText, searchText }) =>
    (!term || searchText.includes(term)) &&
    (!filters.statuses.length || filters.statuses.includes(v.lifecycle)) &&
    (!filters.congregations.length || filters.congregations.includes(v.congregation ?? "")) &&
    (!filters.days.length || filters.days.some(day => v.availableWorkDays.includes(day))) &&
    filters.experienceTerms.every(term => experienceText.includes(term.trim().toLocaleLowerCase("en-US"))) &&
    (filters.security === "all" || filters.security === v.afterHoursSecurityAvailability) &&
    (filters.housing === "all" || filters.housing === v.housingOption) &&
    (filters.twoPlusDays === "all" || filters.twoPlusDays === v.availableTwoPlusDays)
  );
}
export function directoryCategoryCount(filters: DirectoryFilters) {
  return [filters.statuses.length, filters.congregations.length, filters.days.length, filters.experienceTerms.length, filters.security !== "all", filters.housing !== "all", filters.twoPlusDays !== "all"].filter(Boolean).length;
}