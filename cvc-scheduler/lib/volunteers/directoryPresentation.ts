import type { VolunteerProfile } from "./profile.ts";

/** Copy only: never participates in eligibility, filtering or skill authority. */
export function directoryResultCopy(query: string, activeCategories: number) {
  const search = query.trim();
  const filters = activeCategories > 0;
  if (search && filters) return {
    countContext: "your search and filters",
    emptyTitle: "No volunteers match this search and filter combination",
    explanation: "Try another search or remove a filter to see more volunteers.",
    resetLabel: "Reset search and filters",
  };
  if (search) return {
    countContext: "your search",
    emptyTitle: `No volunteers match “${search.slice(0, 100)}”`,
    explanation: "Try another name, contact detail, or recorded skill. Experience notes are searchable too.",
    resetLabel: "Clear search",
  };
  return {
    countContext: filters ? "your filters" : "",
    emptyTitle: "No volunteers match these filters",
    explanation: "Try removing a skill or choosing another congregation. Skills match only what is recorded in Project Local.",
    resetLabel: "Clear filters",
  };
}

export function experienceSearchExplanation(volunteer: VolunteerProfile, query: string, skills: readonly string[]) {
  const search = query.trim();
  const term = search.toLocaleLowerCase("en-US");
  if (!term || !volunteer.skillsExperience?.toLocaleLowerCase("en-US").includes(term)) return null;
  // Explain an experience-only match; prefer structured skill/identity matches
  // and never duplicate their explanation. Never return any note contents.
  const otherFields = [volunteer.fullName, volunteer.email, volunteer.phone, volunteer.congregation, volunteer.lifecycle, volunteer.readinessStatus, volunteer.profileNotes, volunteer.otherSupport, ...skills];
  if (otherFields.some(value => value?.toLocaleLowerCase("en-US").includes(term))) return null;
  return `Experience note matches “${search.slice(0, 80)}”`;
}
