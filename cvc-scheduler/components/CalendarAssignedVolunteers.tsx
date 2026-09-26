import { DisclosureSection } from "./DisclosureSection";
import { CircleCheck, CircleX, Clock3 } from "lucide-react";

export type AssignmentVisibility = "hidden" | "unavailable" | "available";
export type CalendarVisibleAssignment = {
  assignmentId: string;
  calendarItemId: string;
  volunteerDisplayName: string;
  responseStatus: "confirmed" | "needs_response" | "declined";
};

const responseDisplay = {
  confirmed: { label: "Confirmed", tone: "text-emerald-700", Icon: CircleCheck },
  needs_response: { label: "Awaiting reply", tone: "text-amber-700", Icon: Clock3 },
  declined: { label: "Can't make it", tone: "text-red-700", Icon: CircleX },
} as const;

function AssignmentResponseIcon({ status }: { status: CalendarVisibleAssignment["responseStatus"] }) {
  const { label, tone, Icon } = responseDisplay[status];
  return <span aria-label={label} className={`inline-flex shrink-0 items-center ${tone}`} role="img" title={label}>
    <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
  </span>;
}

export function CalendarAssignmentLegend() {
  return <div aria-label="Assignment response legend" className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--pl-border)] bg-[var(--pl-surface-subtle)]/60 px-3 py-1.5 text-[11px] text-[var(--pl-text)] sm:gap-x-3 sm:px-4 sm:py-2 sm:text-xs">
    <span className="hidden font-semibold sm:inline">Responses</span>
    {(["confirmed", "needs_response", "declined"] as const).map(status => <span className="inline-flex items-center gap-1" key={status}>
      <AssignmentResponseIcon status={status} />{responseDisplay[status].label}
    </span>)}
  </div>;
}

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
  const rows = (list: readonly CalendarVisibleAssignment[]) => <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5" aria-label="Assigned volunteers">
    {list.map(person => <li key={person.assignmentId} className="inline-flex min-w-0 max-w-full items-center gap-1 text-sm leading-5">
      <span className="min-w-0 max-w-full break-words font-medium text-[var(--pl-text)]">{person.volunteerDisplayName}</span>
      <AssignmentResponseIcon status={person.responseStatus} />
    </li>)}
  </ul>;
  return <div>
    {rows(people.slice(0, 3))}
    {people.length > 3 && <DisclosureSection summary={`+${people.length - 3} more volunteers`} className="mt-1 border-0 bg-transparent [&>summary]:px-0 [&>div]:border-0 [&>div]:px-0 [&>div]:pt-0">
      {rows(people.slice(3))}
    </DisclosureSection>}
  </div>;
}
