import type { AttentionCategory, AttentionView, SupportType } from "../adminViews/preferences";
import type { NeedsAttentionSignal } from "./derive.server";

export type AttentionIssue = Readonly<{
  id: string;
  signalIds: string[];
  supportType: SupportType;
  title: string;
  date: string;
  startsAt: number;
  time: string | null;
  endDate: string | null;
  endTime: string | null;
  href: string;
  calendarItemId: string;
  categories: AttentionCategory[];
  problems: string[];
  assignedFractionLabel: string;
  affectedAssignments: readonly (NeedsAttentionSignal["affectedAssignments"][number] & { name?: string; congregation?: string })[];
  reviewed: boolean;
  urgencyRank: number;
  searchText: string;
}>;

const categoryFor = (kind: NeedsAttentionSignal["kind"]): AttentionCategory =>
  kind === "coverage" ? "staffing" : kind === "denied" ? "declined" : "awaiting";

export function groupAttentionIssues(signals: readonly NeedsAttentionSignal[], reviewedSignalIds: ReadonlySet<string>, searchByItem: ReadonlyMap<string, string> = new Map(), peopleByAssignment: ReadonlyMap<string, { name: string; congregation: string | null }> = new Map()): AttentionIssue[] {
  const groups = new Map<string, NeedsAttentionSignal[]>();
  for (const signal of signals) groups.set(signal.calendarItemId, [...(groups.get(signal.calendarItemId) ?? []), signal]);
  return [...groups.entries()].map(([id, entries]) => {
    const first = entries[0];
    const categories = [...new Set(entries.map(entry => categoryFor(entry.kind)))].sort((a, b) => ["declined", "staffing", "awaiting"].indexOf(a) - ["declined", "staffing", "awaiting"].indexOf(b));
    const ordered = [...entries].sort((a, b) => ["denied", "coverage", "pending"].indexOf(a.kind) - ["denied", "coverage", "pending"].indexOf(b.kind));
    return {
      id, calendarItemId: id, signalIds: entries.map(entry => entry.id), supportType: first.supportType,
      title: first.title, date: first.startDate, startsAt: first.startsAt, time: first.startTime,
      endDate: first.endDate, endTime: first.endTime, href: first.href, categories,
      problems: ordered.map(entry => entry.problem), assignedFractionLabel: first.assignedFractionLabel,
      affectedAssignments: entries.flatMap(entry => entry.affectedAssignments.map(assignment => ({ ...assignment, name: peopleByAssignment.get(assignment.assignmentId)?.name, congregation: peopleByAssignment.get(assignment.assignmentId)?.congregation ?? undefined }))),
      reviewed: entries.every(entry => reviewedSignalIds.has(entry.id)),
      urgencyRank: categories.includes("declined") ? 0 : categories.includes("staffing") ? 1 : 2,
      searchText: `${first.title} ${first.startDate} ${searchByItem.get(id) ?? ""}`.toLocaleLowerCase(),
    };
  }).sort((a, b) => a.startsAt - b.startsAt || a.id.localeCompare(b.id));
}

export function filterAttentionIssues(issues: readonly AttentionIssue[], view: AttentionView, today: string, search = "") {
  const days = view.horizon === "today" ? 0 : view.horizon === "project" ? null : Number(view.horizon);
  const through = days === null ? null : new Date(Date.parse(`${today}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const q = search.trim().toLocaleLowerCase();
  const selected = issues.filter(issue =>
    (view.supportTypes.length === 0 || view.supportTypes.includes(issue.supportType)) &&
    (view.categories.length === 0 || view.categories.some(category => issue.categories.includes(category))) &&
    (view.status === "all" || issue.reviewed === (view.status === "reviewed")) &&
    (!through || issue.date <= through) &&
    (!q || issue.searchText.includes(q)));
  return view.sort === "urgent"
    ? selected.sort((a, b) => a.urgencyRank - b.urgencyRank || a.startsAt - b.startsAt || a.id.localeCompare(b.id))
    : selected;
}
