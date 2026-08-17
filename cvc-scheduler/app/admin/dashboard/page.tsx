import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Plus,
  Sparkles,
  UserRoundPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { GlassCard } from "@/components/GlassCard";
import {
  readOverviewRouteState,
  type OverviewQuickAction,
  type OverviewReadyRouteState,
  type OverviewReviewSignal,
  type OverviewUpcomingItem,
} from "@/lib/overview/routeRead.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const actionIcons: Record<OverviewQuickAction["kind"], LucideIcon> = {
  calendar: CalendarDays,
  tasks: ClipboardList,
  volunteers: UserRoundPlus,
};

const reviewStyles: Record<OverviewReviewSignal["kind"], string> = {
  denied: "bg-[var(--pl-coral-soft)] text-[#a44437]",
  unfilled: "bg-[var(--pl-amber-soft)] text-[#8b5a12]",
  waiting: "bg-[var(--pl-lavender-soft)] text-[#6254a3]",
};

function displayDate(date: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function displayTime(time: string | null) {
  if (!time) return "All day";
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function projectDateRange(state: OverviewReadyRouteState) {
  if (!state.workspaceStartsOn && !state.workspaceEndsOn) return null;
  if (state.workspaceStartsOn && state.workspaceEndsOn) {
    return `${displayDate(state.workspaceStartsOn, state.workspaceTimezone)} – ${displayDate(state.workspaceEndsOn, state.workspaceTimezone)}`;
  }
  return displayDate(
    state.workspaceStartsOn ?? state.workspaceEndsOn ?? state.today,
    state.workspaceTimezone,
  );
}

function OverviewHeader({ state }: { state: OverviewReadyRouteState }) {
  const dateRange = projectDateRange(state);
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--pl-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
          {state.workspaceName}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[var(--pl-ink)] sm:text-4xl">
          Overview
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--pl-text)]">
          Your next work, schedule follow-ups, and practical project actions in one place.
        </p>
      </div>
      {dateRange ? (
        <p className="w-fit rounded-lg border border-[var(--pl-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--pl-muted)] shadow-sm">
          {dateRange}
        </p>
      ) : null}
    </header>
  );
}

function SectionHeader({ eyebrow, title, href, action }: {
  eyebrow: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-[var(--pl-border)] px-4 py-4 sm:px-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--pl-muted)]">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-[var(--pl-ink)]">{title}</h2>
      </div>
      {href && action ? (
        <Link className="inline-flex min-h-9 items-center gap-1.5 text-xs font-bold text-[var(--pl-blue)] hover:text-blue-700" href={href}>
          {action}<ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function UpcomingRow({ item }: { item: OverviewUpcomingItem }) {
  return (
    <Link
      className="group grid min-h-[74px] grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-[var(--pl-blue-soft)] sm:grid-cols-[108px_minmax(0,1fr)_auto] sm:px-5"
      href={item.href}
    >
      <div className="rounded-lg bg-[var(--pl-blue-soft)] px-2 py-2 text-center sm:bg-transparent sm:p-0 sm:text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--pl-blue)] sm:text-xs sm:normal-case sm:tracking-normal">
          {displayDate(item.startDate, item.timezone)}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold text-[var(--pl-muted)] sm:text-xs">{displayTime(item.startTime)}</p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[var(--pl-ink)] group-hover:text-[var(--pl-blue)]">{item.title}</p>
        <p className="mt-1 text-xs font-medium text-[var(--pl-muted)]">{item.publicationState === "draft" ? "Draft schedule" : "Published"}</p>
      </div>
      <span className="shrink-0 rounded-full border border-[var(--pl-border)] bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--pl-text)] sm:text-xs">
        {item.assignedFractionLabel}
      </span>
    </Link>
  );
}

function NextUp({ state }: { state: OverviewReadyRouteState }) {
  if (!state.calendar) return null;
  if (state.calendar.kind === "unavailable") {
    return (
      <section className="overflow-hidden rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-card)]">
        <SectionHeader eyebrow="Next seven days" title="Next up" />
        <p className="px-5 py-5 text-sm text-[var(--pl-text)]">Calendar details are temporarily unavailable.</p>
      </section>
    );
  }
  const items = state.calendar.value.upcomingItems;
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-card)]">
      <SectionHeader action="Open Calendar" eyebrow="Next seven days" href={`/admin/calendar?view=week&date=${state.today}`} title="Next up" />
      {items.length > 0 ? (
        <div className="divide-y divide-[var(--pl-border)]">{items.map((item) => <UpcomingRow item={item} key={item.id} />)}</div>
      ) : (
        <div className="px-5 py-7">
          <p className="text-sm font-semibold text-[var(--pl-ink)]">The next seven days are clear.</p>
          <p className="mt-1 text-sm text-[var(--pl-muted)]">Open Calendar whenever you’re ready to schedule work.</p>
        </div>
      )}
    </section>
  );
}

function ScheduleReview({ state }: { state: OverviewReadyRouteState }) {
  if (!state.calendar || state.calendar.kind !== "ready") return null;
  const signals = state.calendar.value.reviewSignals;
  if (signals.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--pl-border)] bg-white p-5 shadow-[var(--pl-shadow-card)]">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--pl-teal-soft)] text-[#177b6f]"><CheckCircle2 aria-hidden="true" className="size-[18px]" /></span>
        <h2 className="mt-4 text-lg font-bold tracking-[-0.02em] text-[var(--pl-ink)]">Schedule looks ready</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--pl-text)]">No upcoming coverage or response follow-ups need your attention.</p>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-card)]">
      <SectionHeader action="Review week" eyebrow="Schedule" href={`/admin/calendar?view=week&date=${state.today}`} title="To review" />
      <div className="divide-y divide-[var(--pl-border)]">
        {signals.map((signal) => (
          <Link className="flex min-h-[68px] items-center gap-3 px-4 py-3 transition hover:bg-[var(--pl-surface-subtle)] sm:px-5" href={signal.href} key={signal.id}>
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${reviewStyles[signal.kind]}`}><Clock3 aria-hidden="true" className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[var(--pl-ink)]">{signal.title}</span>
              <span className="mt-0.5 block text-xs font-semibold text-[var(--pl-text)]">{signal.message}</span>
            </span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-[var(--pl-muted)]" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function Snapshot({ state }: { state: OverviewReadyRouteState }) {
  const values = [
    state.calendar?.kind === "ready" ? { label: "scheduled this week", value: state.calendar.value.scheduledCount, icon: CalendarDays } : null,
    state.tasks?.kind === "ready" ? { label: "active reusable tasks", value: state.tasks.value.activeCount, icon: ClipboardList } : null,
    state.volunteers?.kind === "ready" ? { label: "ready volunteers", value: state.volunteers.value.readyActiveCount, icon: Users } : null,
  ].filter((item): item is { label: string; value: number; icon: LucideIcon } => Boolean(item));
  if (values.length === 0 || state.isEmpty) return null;
  return (
    <section aria-label="Project snapshot" className="grid divide-y divide-[var(--pl-border)] overflow-hidden rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-card)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {values.map(({ label, value, icon: Icon }) => (
        <div className="flex items-center gap-3 px-4 py-3.5" key={label}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]"><Icon aria-hidden="true" className="size-4" /></span>
          <p className="min-w-0 text-xs font-semibold text-[var(--pl-muted)]"><strong className="mr-1 text-base text-[var(--pl-ink)]">{value}</strong>{" "}{label}</p>
        </div>
      ))}
    </section>
  );
}

function QuickActions({ actions }: { actions: readonly OverviewQuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <section>
      <div className="mb-3 flex items-center gap-2"><Sparkles aria-hidden="true" className="size-4 text-[var(--pl-blue)]" /><h2 className="text-sm font-bold text-[var(--pl-ink)]">Quick actions</h2></div>
      <div className="grid gap-2 sm:grid-cols-3">
        {actions.map((action) => {
          const Icon = actionIcons[action.kind];
          return (
            <Link className="group flex min-h-[70px] items-center gap-3 rounded-xl border border-[var(--pl-border)] bg-white px-3.5 py-3 shadow-sm transition hover:border-blue-200 hover:bg-[var(--pl-blue-soft)]" href={action.href} key={action.kind}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)] text-[var(--pl-blue)] group-hover:bg-white"><Icon aria-hidden="true" className="size-[18px]" /></span>
              <span className="min-w-0"><span className="block text-sm font-bold text-[var(--pl-ink)]">{action.label}</span><span className="mt-0.5 block text-xs text-[var(--pl-muted)]">{action.note}</span></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function EmptyProject({ state }: { state: OverviewReadyRouteState }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white px-5 py-8 shadow-[var(--pl-shadow-card)] sm:px-8 sm:py-10">
      <div aria-hidden="true" className="absolute right-0 top-0 size-40 -translate-y-1/3 translate-x-1/3 rounded-full bg-[var(--pl-blue-soft)]" />
      <div className="relative max-w-xl">
        <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]"><CheckCircle2 aria-hidden="true" className="size-5" /></span>
        <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[var(--pl-ink)]">Your project is ready</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--pl-text)]">Start with reusable tasks and volunteers, then bring the work together on Calendar. Only tools available to you are shown here.</p>
        {state.actions.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {state.actions.map((action, index) => (
              <Link className={index === 0 ? "inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--pl-blue)] px-4 text-sm font-bold text-white shadow-sm hover:bg-blue-700" : "inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--pl-border)] bg-white px-4 text-sm font-bold text-[var(--pl-ink)] hover:bg-[var(--pl-surface-subtle)]"} href={action.href} key={action.kind}>
                {index === 0 ? <Plus aria-hidden="true" className="size-4" /> : null}{action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default async function AdminDashboardPage() {
  const state = await readOverviewRouteState();
  if (state.kind !== "ready") {
    return (
      <AdminShell active="overview">
        <header className="border-b border-[var(--pl-border)] pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">Project home</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[var(--pl-ink)] sm:text-4xl">Overview</h1>
        </header>
        <GlassCard className="mt-5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--pl-ink)]">{state.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pl-text)]">{state.message}</p>
        </GlassCard>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="overview" workspaceName={state.workspaceName}>
      <div className="space-y-5">
        <OverviewHeader state={state} />
        {state.isEmpty ? <EmptyProject state={state} /> : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.42fr)_minmax(310px,0.78fr)] xl:items-start">
              <NextUp state={state} />
              <ScheduleReview state={state} />
            </div>
            <Snapshot state={state} />
          </>
        )}
        {!state.isEmpty ? <QuickActions actions={state.actions} /> : null}
      </div>
    </AdminShell>
  );
}
