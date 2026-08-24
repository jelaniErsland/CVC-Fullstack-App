import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MessageCircleQuestion,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { GlassCard } from "@/components/GlassCard";
import type {
  NeedsAttentionSignal,
  NeedsAttentionSignalGroup,
  NeedsAttentionUrgency,
} from "@/lib/needsAttention/derive.server";
import {
  readNeedsAttentionRouteState,
  type NeedsAttentionReadyRouteState,
} from "@/lib/needsAttention/routeRead.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const urgencyLabels: Record<NeedsAttentionUrgency, string> = {
  near: "Within 48 hours",
  soon: "Within 7 days",
  upcoming: "Upcoming",
};

const urgencyStyles: Record<NeedsAttentionUrgency, string> = {
  near: "border-rose-200 bg-[var(--pl-coral-soft)] text-[#a44437]",
  soon: "border-amber-200 bg-[var(--pl-amber-soft)] text-[#8b5a12]",
  upcoming: "border-violet-200 bg-[var(--pl-lavender-soft)] text-[#6254a3]",
};

const urgencyTextStyles: Record<NeedsAttentionUrgency, string> = {
  near: "text-[#a44437]",
  soon: "text-[#8b5a12]",
  upcoming: "text-[#6254a3]",
};

const groupMeta: Record<
  NeedsAttentionSignalGroup,
  Readonly<{ label: string; description: string; icon: LucideIcon; iconClass: string }>
> = {
  staffing: {
    label: "Staffing",
    description: "Published work that still needs volunteers.",
    icon: UsersRound,
    iconClass: "bg-[var(--pl-amber-soft)] text-[#8b5a12]",
  },
  responses: {
    label: "Responses",
    description: "Assignments waiting for a response or a replacement plan.",
    icon: MessageCircleQuestion,
    iconClass: "bg-[var(--pl-lavender-soft)] text-[#6254a3]",
  },
};

function displayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00.000Z`));
}

function displayTime(time: string | null) {
  if (!time) return "All day";
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${minuteText} ${suffix}`;
}

function scheduleLabel(signal: NeedsAttentionSignal) {
  const start = displayTime(signal.startTime);
  if (!signal.endTime || !signal.startTime) return `${displayDate(signal.startDate)} · ${start}`;
  return `${displayDate(signal.startDate)} · ${start}–${displayTime(signal.endTime)}`;
}

function AttentionRow({ signal }: { signal: NeedsAttentionSignal }) {
  const assignmentLinks = signal.group === "responses" ? signal.affectedAssignments : [];
  return (
    <details
      className="group border-t border-[var(--pl-border)] first:border-t-0"
      data-signal-kind={signal.kind}
      data-signal-row
    >
      <summary className="grid min-h-[78px] cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--pl-blue)] sm:grid-cols-[132px_minmax(0,1fr)_auto_auto] sm:px-5 [&::-webkit-details-marker]:hidden">
        <p className="hidden text-xs font-semibold leading-5 text-[var(--pl-muted)] sm:block">
          {scheduleLabel(signal)}
        </p>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--pl-ink)]">{signal.title}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--pl-text)]">{signal.problem}</p>
          <p className="mt-1 text-[11px] font-medium text-[var(--pl-muted)] sm:hidden">
            {scheduleLabel(signal)}
            <span aria-hidden="true"> · </span>
            <span className={`font-bold ${urgencyTextStyles[signal.urgency]}`}>
              {urgencyLabels[signal.urgency]}
            </span>
          </p>
        </div>
        <span
          className={`hidden rounded-lg border px-2.5 py-1 text-[10px] font-bold sm:inline-flex ${urgencyStyles[signal.urgency]}`}
        >
          {urgencyLabels[signal.urgency]}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-[var(--pl-muted)] transition group-open:rotate-180"
        />
      </summary>

      <div className="border-t border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] px-4 py-4 sm:px-5 sm:pl-[152px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <dl className="flex flex-wrap gap-x-7 gap-y-2">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pl-muted)]">
                  Coverage
                </dt>
                <dd className="mt-1 text-sm font-bold text-[var(--pl-ink)]">
                  {signal.assignedFractionLabel}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pl-muted)]">
                  {signal.kind === "coverage" ? "Open places" : "Affected"}
                </dt>
                <dd className="mt-1 text-sm font-bold text-[var(--pl-ink)]">
                  {signal.affectedCount}
                </dd>
              </div>
            </dl>
            <p className="mt-3 max-w-xl text-xs leading-5 text-[var(--pl-muted)]">
              This follow-up reflects the current published schedule and assignment responses.
              It clears automatically when the underlying schedule changes.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--pl-border)] bg-white px-4 text-sm font-bold text-[var(--pl-text)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              href={signal.href}
            >
              Open in Calendar
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            {assignmentLinks.length === 1 ? (
              <Link
                aria-label={`View assignment for ${signal.title}`}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--pl-blue)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                href={`/admin/assignments/${encodeURIComponent(assignmentLinks[0].assignmentId)}`}
              >
                View assignment
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>
        {assignmentLinks.length > 1 ? (
          <div className="mt-4 border-t border-[var(--pl-border)] pt-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pl-muted)]">
              Affected assignments
            </p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {assignmentLinks.map((assignment, index) => (
                <li
                  className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-[var(--pl-border)] bg-white px-3 py-2"
                  key={assignment.assignmentId}
                >
                  <span className="text-xs font-semibold text-[var(--pl-text)]">
                    {signal.kind === "pending" ? "Pending response" : "Can’t make it"} {index + 1}
                  </span>
                  <Link
                    aria-label={`View affected assignment ${index + 1} for ${signal.title}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-[var(--pl-blue)] transition hover:bg-[var(--pl-blue-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    href={`/admin/assignments/${encodeURIComponent(assignment.assignmentId)}`}
                  >
                    View assignment
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function AttentionGroup({
  group,
  signals,
}: {
  group: NeedsAttentionSignalGroup;
  signals: readonly NeedsAttentionSignal[];
}) {
  if (signals.length === 0) return null;
  const meta = groupMeta[group];
  const Icon = meta.icon;

  return (
    <section aria-labelledby={`${group}-heading`}>
      <div className="flex items-center gap-3 border-b border-[var(--pl-border)] bg-white px-4 py-4 sm:px-5">
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}>
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold tracking-[-0.02em] text-[var(--pl-ink)]" id={`${group}-heading`}>
            {meta.label}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--pl-muted)]">{meta.description}</p>
        </div>
        <span className="rounded-lg bg-[var(--pl-surface-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--pl-text)]">
          {signals.length}
        </span>
      </div>
      <div>
        {signals.map((signal) => (
          <AttentionRow key={signal.id} signal={signal} />
        ))}
      </div>
    </section>
  );
}

function InboxHeader({ state }: { state: NeedsAttentionReadyRouteState }) {
  const count = state.summary.totalSignalCount;
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--pl-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
          {state.workspaceName}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[var(--pl-ink)] sm:text-4xl">
          Needs Attention
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--pl-text)]">
          Upcoming staffing and response follow-ups.
        </p>
      </div>
      {count > 0 ? (
        <div className="flex w-fit items-center gap-2 rounded-xl border border-[var(--pl-border)] bg-white px-3 py-2 shadow-sm">
          <Clock3 aria-hidden="true" className="size-4 text-[var(--pl-blue)]" />
          <p className="text-xs font-semibold text-[var(--pl-muted)]">
            <strong className="text-sm text-[var(--pl-ink)]">{count}</strong>{" "}
            open {count === 1 ? "follow-up" : "follow-ups"}
          </p>
        </div>
      ) : null}
    </header>
  );
}

function AllCaughtUp({ today }: { today: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white px-5 py-9 shadow-[var(--pl-shadow-card)] sm:px-8 sm:py-10">
      <div aria-hidden="true" className="absolute right-0 top-0 size-40 -translate-y-1/3 translate-x-1/3 rounded-full bg-[var(--pl-blue-soft)]" />
      <div className="relative max-w-xl">
        <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--pl-teal-soft)] text-[#177b6f]">
          <CheckCircle2 aria-hidden="true" className="size-5" />
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[var(--pl-ink)]">
          You&apos;re all caught up
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--pl-text)]">
          No upcoming staffing or response follow-ups need your attention.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--pl-blue)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          href={`/admin/calendar?view=week&date=${today}`}
        >
          <CalendarDays aria-hidden="true" className="size-4" />
          Open Calendar
        </Link>
      </div>
    </section>
  );
}

export default async function AdminNeedsAttentionPage() {
  const state = await readNeedsAttentionRouteState();
  if (state.kind !== "ready") {
    return (
      <AdminShell active="needs-attention">
        <header className="border-b border-[var(--pl-border)] pb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
            Project follow-up
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[var(--pl-ink)] sm:text-4xl">
            Needs Attention
          </h1>
        </header>
        <GlassCard className="mt-5 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--pl-ink)]">{state.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pl-text)]">
            {state.message}
          </p>
        </GlassCard>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="needs-attention" workspaceName={state.workspaceName}>
      <div className="space-y-5">
        <InboxHeader state={state} />
        {state.summary.totalSignalCount === 0 ? (
          <AllCaughtUp today={state.today} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-card)]">
            <AttentionGroup group="staffing" signals={state.summary.staffing} />
            <div className="border-t-4 border-[var(--pl-canvas)]">
              <AttentionGroup group="responses" signals={state.summary.responses} />
            </div>
            {state.summary.truncated ? (
              <p className="border-t border-[var(--pl-border)] px-5 py-3 text-xs font-medium text-[var(--pl-muted)]">
                Showing the first {state.summary.totalSignalCount} follow-ups in schedule order.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
