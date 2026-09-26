import { DisclosureSection } from "./DisclosureSection";
import { statusDisplay } from "@/lib/statusDisplay";

export type AssignmentVisibility = "hidden" | "unavailable" | "available";
export type CalendarVisibleAssignment = {
  assignmentId: string;
  calendarItemId: string;
  volunteerDisplayName: string;
  responseStatus: "confirmed" | "needs_response" | "declined";
};

const responseTone = {
  confirmed: "text-emerald-800",
  needs_response: "text-amber-900",
  declined: "text-red-800",
};

/** Display only the assignment projection supplied for this exact scheduled item. */
export function CalendarAssignedVolunteers({ itemId, assignments, visibility }: {
  itemId: string;
  assignments?: readonly CalendarVisibleAssignment[];
  visibility: AssignmentVisibility;
}) {
  if (visibility === "hidden") return null;
  if (visibility === "unavailable") return <p className="text-sm text-[var(--pl-muted)]">Assignment details unavailable</p>;
  const people = (assignments ?? []).filter(person => person.calendarItemId === itemId);
  if (!people.length) return <p className="text-sm text-[var(--pl-muted)]">No volunteers assigned</p>;
  const rows = (list: readonly CalendarVisibleAssignment[]) => <ul className="space-y-1.5" aria-label="Assigned volunteers">
    {list.map(person => <li key={person.assignmentId} className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm leading-5">
      <span className="min-w-0 max-w-full break-words font-medium text-[var(--pl-text)]">{person.volunteerDisplayName}</span>
      <span className={`text-xs ${responseTone[person.responseStatus]}`}>{statusDisplay[person.responseStatus].label}</span>
    </li>)}
  </ul>;
  return <div>
    {rows(people.slice(0, 3))}
    {people.length > 3 && <DisclosureSection summary={`+${people.length - 3} more volunteers`} className="mt-1 border-0 bg-transparent [&>summary]:px-0 [&>div]:border-0 [&>div]:px-0 [&>div]:pt-0">
      {rows(people.slice(3))}
    </DisclosureSection>}
  </div>;
}
