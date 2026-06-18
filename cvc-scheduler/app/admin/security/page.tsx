import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CircleCheck,
  Clock3,
  KeyRound,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  demoProjectId,
  getNextSecurityAction,
  getProjectById,
  getSecurityCoordinationCounts,
  getSecurityCoverageStatusLabel,
  getSecurityCoverageStatusTone,
  getSecurityDetailHref,
  getSecurityItemsForActiveWorkspace,
  getSecurityServiceTypeLabel,
  groupSecurityItemsByDate,
  projectHasModule,
} from "@/lib/mockData";
import type {
  SecurityCoordinationItem,
  SecurityCoverageStatus,
  SecurityStatusTone,
} from "@/lib/mockData";

const statusStyles: Record<SecurityStatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

function StatusLabel({ status }: { status: SecurityCoverageStatus }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[getSecurityCoverageStatusTone(status)]}`}
    >
      <CircleCheck aria-hidden="true" className="h-3.5 w-3.5" />
      {getSecurityCoverageStatusLabel(status)}
    </span>
  );
}

function MetaPill({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/70 bg-white/54 px-3 text-xs font-semibold text-slate-600">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
      {label}
    </span>
  );
}

function SummaryStrip() {
  const counts = getSecurityCoordinationCounts(demoProjectId);
  const items = [
    { label: "Upcoming", value: counts.upcoming, helper: "Security items" },
    { label: "Covered", value: counts.covered, helper: "Covered or reviewed" },
    { label: "Needs review", value: counts.needsReview, helper: "Coverage or access notes" },
    { label: "Helpers", value: counts.needsHelpers, helper: "Need assigned helpers" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="rounded-lg border border-white/72 bg-white/54 px-4 py-3"
          key={item.label}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">{item.label}</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {item.value}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
        </div>
      ))}
    </section>
  );
}

function SecurityRow({ item }: { item: SecurityCoordinationItem }) {
  const helpers =
    item.assignedHelpers.length > 0
      ? item.assignedHelpers.join(", ")
      : "Helper to add";

  return (
    <Link
      className="block border-b border-white/72 px-4 py-4 transition hover:bg-white/46 last:border-b-0 sm:px-5"
      href={getSecurityDetailHref(item)}
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-950">{item.title}</p>
            <StatusLabel status={item.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaPill icon={ShieldCheck} label={getSecurityServiceTypeLabel(item.serviceType)} />
            {item.timeWindow ? <MetaPill icon={Clock3} label={item.timeWindow} /> : null}
            {item.congregation ? (
              <MetaPill icon={Building2} label={item.congregation} />
            ) : null}
            <MetaPill icon={UserRound} label={item.assignedContact ?? "Contact to confirm"} />
            <MetaPill icon={Users} label={helpers} />
          </div>
        </div>
        <div className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
          Review
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </div>
      </div>

      {item.coverageNotes ? (
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {item.coverageNotes}
        </p>
      ) : null}
    </Link>
  );
}

function SecurityGroups({ items }: { items: SecurityCoordinationItem[] }) {
  const groups = groupSecurityItemsByDate(items);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <GlassCard className="overflow-hidden" key={group.date}>
          <div className="border-b border-white/72 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                {group.dayLabel}
              </h2>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                <CalendarDays aria-hidden="true" className="h-4 w-4" />
                {group.items.length} security item
                {group.items.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div>
            {group.items.map((item) => (
              <SecurityRow item={item} key={item.id} />
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export default function AdminSecurityPage() {
  const project = getProjectById(demoProjectId);
  const hasSecurityModule = projectHasModule(project, "security");
  const securityItems = hasSecurityModule ? getSecurityItemsForActiveWorkspace() : [];
  const nextAction = getNextSecurityAction(demoProjectId);

  return (
    <AdminShell active="security">
      <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Security contact preview
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Security
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          A discreet place to review night watch coverage, site checks, access notes,
          and assigned helpers before a full security workflow exists.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Preview only. This page does not save changes, assign helpers, send
          reminders, create alerts, track location, or connect to security systems.
        </p>
      </header>

      <section className="mt-6">
        {project && hasSecurityModule ? (
          <div className="space-y-4">
            <SummaryStrip />

            <GlassCard className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/58 text-slate-600">
                  <KeyRound aria-hidden="true" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Coming next
                  </p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                        {nextAction.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {nextAction.detail}
                      </p>
                    </div>
                    <Link
                      className="inline-flex min-h-10 w-fit items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                      href={nextAction.href}
                    >
                      Review
                    </Link>
                  </div>
                </div>
              </div>
            </GlassCard>

            <SecurityGroups items={securityItems} />
          </div>
        ) : (
          <EmptyState
            title="Security module is not enabled"
            message="This workspace is not using security coordination yet. If enabled later, night watch coverage and site check notes will appear here."
          />
        )}
      </section>
    </AdminShell>
  );
}
