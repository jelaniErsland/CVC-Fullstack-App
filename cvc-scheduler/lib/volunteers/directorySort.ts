import type { IndexedDirectory } from "./directoryFilters.ts";

export const directorySortOptions = {
  name_asc: "Name A–Z", name_desc: "Name Z–A", congregation: "Congregation A–Z",
  newest: "Recently added", oldest: "Oldest added", ready: "Schedule-ready first", active: "Active first",
} as const;
export type DirectorySort = keyof typeof directorySortOptions;
const collator = new Intl.Collator("en-US", { sensitivity: "base", numeric: true });
export function sortDirectory(entries: IndexedDirectory, sort: DirectorySort): IndexedDirectory {
  return [...entries].sort(({ volunteer: a }, { volunteer: b }) => {
    const name = collator.compare(a.fullName, b.fullName);
    let primary = 0;
    if (sort === "name_asc") primary = name;
    if (sort === "name_desc") primary = -name;
    // Unrecorded congregations sort last, never under a fabricated label.
    if (sort === "congregation") primary = Number(!a.congregation) - Number(!b.congregation) || collator.compare(a.congregation ?? "", b.congregation ?? "");
    if (sort === "newest" || sort === "oldest") primary = (Date.parse(a.createdAt) - Date.parse(b.createdAt)) * (sort === "newest" ? -1 : 1);
    if (sort === "ready") primary = Number(b.readinessStatus === "ready") - Number(a.readinessStatus === "ready");
    if (sort === "active") primary = Number(b.lifecycle === "active") - Number(a.lifecycle === "active");
    return primary || name || a.id.localeCompare(b.id);
  });
}
