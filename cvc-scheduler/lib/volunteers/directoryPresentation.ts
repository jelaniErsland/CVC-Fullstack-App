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
    explanation: "Try removing an experience term or choosing another congregation. Terms match recorded text, not qualifications.",
    resetLabel: "Clear filters",
  };
}
