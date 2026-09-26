import Link from "next/link";
import { ArrowRight, Clock3, CircleAlert } from "lucide-react";
import { Button } from "./Button";
import { PageHeader } from "./PageHeader";
import { Panel, SectionHeader } from "./Panel";
import { EmptyState } from "./EmptyState";
import { ProjectPhotoEditor } from "./ProjectPhotoEditor";
import { StatusBadge } from "./StatusBadge";
import { ldcProjectName } from "@/lib/projectIdentity";
import type { ProjectPhoto } from "@/lib/projectPhoto/photo";
import type { OverviewReadyRouteState, OverviewUpcomingItem } from "@/lib/overview/routeRead.server";

function displayDate(date: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00.000Z`));
}
function time(time: string | null) {
  if (!time) return "All day";
  const [h, m] = time.split(":"); const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}
function Timing({ item }: { item: Pick<OverviewUpcomingItem, "startDate" | "endDate" | "startTime" | "endTime" | "timezone"> }) {
  return <span className="flex flex-wrap gap-x-2 gap-y-0.5">
    <span>{displayDate(item.startDate, item.timezone)}{item.endDate && item.endDate !== item.startDate ? ` – ${displayDate(item.endDate, item.timezone)}` : ""}</span>
    <span>{time(item.startTime)}{item.startTime && item.endTime ? ` – ${time(item.endTime)}` : ""}</span>
  </span>;
}
const sectionLink = "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--pl-blue)] hover:underline";

export function OverviewContent({ state, photo, canEditPhoto, attentionCount, attentionTruncated }: {
  state: OverviewReadyRouteState; photo: ProjectPhoto; canEditPhoto: boolean; attentionCount?: number; attentionTruncated?: boolean;
}) {
  const calendar = state.calendar?.kind === "ready" ? state.calendar.value : null;
  const dates = [state.workspaceStartsOn, state.workspaceEndsOn].filter((d): d is string => !!d);
  const range = dates.map(d => displayDate(d, state.workspaceTimezone)).join(" – ");
  return <div className="mx-auto max-w-[1280px] space-y-4 sm:space-y-6">
    <PageHeader title="Overview" context={range ? <span>Project dates · {range}</span> : undefined} primaryAction={state.createTask ? <Button href="/admin/tasks?create=1">New task</Button> : undefined} />
    {photo.asset_id && <ProjectPhotoEditor key={photo.version} initialPhoto={photo} projectName={state.workspaceName} canEdit={canEditPhoto} compact />}
    {!photo.asset_id && <section aria-label="Project identity" className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--pl-border)] bg-white px-4 py-3"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[var(--pl-muted)]">Current project</p><h2 className="break-words text-base font-semibold text-[var(--pl-ink)] sm:text-lg">{ldcProjectName(state.workspaceName)}</h2></div>{canEditPhoto && <ProjectPhotoEditor key={photo.version} initialPhoto={photo} projectName={state.workspaceName} canEdit compact />}</section>}
    {state.isEmpty && state.calendar?.kind !== "unavailable" && state.tasks?.kind !== "unavailable" && state.volunteers?.kind !== "unavailable" ? <EmptyState title="No project work to show yet" message="Use the task library and Calendar to plan the next work." /> : null}
    <div className="grid items-start gap-4 sm:gap-6 [grid-template-columns:repeat(auto-fit,minmax(min(100%,26rem),1fr))]">
      {state.calendar && <Panel aria-label="Review summary">
        <SectionHeader title="To review" description="Next seven days" action={<Link className={sectionLink} href={`/admin/calendar?view=week&date=${state.today}`}>Review week<ArrowRight aria-hidden className="size-4" /></Link>} />
        {!!attentionCount && <Link className="flex min-h-14 items-center justify-between gap-3 border-b border-blue-100 bg-blue-50/60 px-4 py-3 text-sm font-semibold text-blue-800 sm:px-6" href="/admin/needs-attention">
          <span>{attentionTruncated ? "Follow-ups need review" : `${attentionCount} ${attentionCount === 1 ? "follow-up needs" : "follow-ups need"} review`}</span><ArrowRight aria-hidden className="size-4 shrink-0" />
        </Link>}
        {!calendar ? <p className="p-4 text-sm leading-6 text-[var(--pl-muted)] sm:p-6">Review information is temporarily unavailable. Try refreshing the page.</p> : calendar.reviewSignals.length ? <div className="divide-y divide-[var(--pl-border)]">
          {calendar.reviewSignals.map((signal, index) => <Link key={signal.id} href={signal.href} className={`${index >= 2 ? "hidden sm:flex" : "flex"} items-start gap-3 px-4 py-3 hover:bg-[var(--pl-surface-subtle)] sm:px-6 sm:py-4`}>
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${signal.kind === "denied" ? "bg-red-50 text-red-800" : signal.kind === "unfilled" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-800"}`}>
              {signal.kind === "denied" ? <CircleAlert aria-hidden className="size-[18px]" /> : <Clock3 aria-hidden className="size-[18px]" />}
            </span>
            <span className="min-w-0 flex-1"><span className="pl-row-title block break-words">{signal.title}</span>
              {signal.startDate && <span className="pl-metadata mt-1 block"><Timing item={{ startDate: signal.startDate, endDate: signal.endDate ?? null, startTime: signal.startTime ?? null, endTime: signal.endTime ?? null, timezone: signal.timezone ?? state.workspaceTimezone }} /></span>}
              <span className="mt-1 block text-sm text-[var(--pl-text)]">{signal.message}{signal.itemCount && signal.itemCount > 1 ? ` · ${signal.itemCount} matching items` : ""}</span>
            </span><ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-[var(--pl-muted)]" />
          </Link>)}
        </div> : <p className="p-4 text-sm leading-6 text-[var(--pl-muted)] sm:p-6">No schedule review items in the next seven days.</p>}
        {calendar && calendar.reviewSignals.length > 2 && <Link href="/admin/needs-attention" className="flex min-h-11 items-center gap-1.5 border-t border-[var(--pl-border)] px-4 text-sm font-semibold text-[var(--pl-blue)] sm:hidden">View all follow-ups<ArrowRight aria-hidden className="size-4" /></Link>}
      </Panel>}
      {state.calendar && <Panel aria-label="Upcoming work">
        <SectionHeader title="Next up" description="Next seven days" action={<Link href={`/admin/calendar?view=week&date=${state.today}`} className={sectionLink}>Open Calendar<ArrowRight aria-hidden className="size-4" /></Link>} />
        {!calendar ? <p className="p-4 text-sm leading-6 text-[var(--pl-muted)] sm:p-6">Calendar details are temporarily unavailable. Try refreshing the page.</p> : calendar.upcomingItems.length ? <div className="divide-y divide-[var(--pl-border)]">
          {calendar.upcomingItems.map(item => <Link key={item.id} href={item.href} className="block px-4 py-4 hover:bg-[var(--pl-surface-subtle)] sm:px-6">
            <div className="pl-metadata"><Timing item={item} /></div>
            <div className="mt-1 flex items-start justify-between gap-3"><p className="pl-row-title min-w-0 break-words">{item.title}{item.itemCount && item.itemCount > 1 ? ` · ${item.itemCount} items` : ""}</p><ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-[var(--pl-muted)]" /></div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2"><StatusBadge status={item.publicationState} /><span className="text-sm text-[var(--pl-text)]">{item.mealSummary ?? item.assignedFractionLabel}</span></div>
          </Link>)}
        </div> : <p className="p-4 text-sm leading-6 text-[var(--pl-muted)] sm:p-6">No Calendar items are scheduled in the next seven days.</p>}
      </Panel>}
    </div>
  </div>;
}
