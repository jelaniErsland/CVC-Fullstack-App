import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleCheck,
  ClipboardList,
  Clock3,
  KeyRound,
  ListChecks,
  MessageSquareText,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  getNextSecurityActionForItem,
  getProjectById,
  getRelatedSecurityItemsForSameDay,
  getSecurityCoverageStatusLabel,
  getSecurityCoverageStatusTone,
  getSecurityDetailHref,
  getSecurityItemById,
  getSecurityNotFoundHref,
  getSecurityServiceTypeLabel,
  securityCoordinationItems,
} from "@/lib/mockData";
import type {
  SecurityCoordinationItem,
  SecurityCoverageStatus,
  SecurityStatusTone,
} from "@/lib/mockData";

type SecurityDetailPageProps = {
  params: Promise<{
    securityItemId: string;
  }>;
};

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

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/50 px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        <p>{label}</p>
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-950">
      <Icon aria-hidden="true" className="h-5 w-5 text-slate-500" />
      {children}
    </h2>
  );
}

function PlaceholderActions({ item }: { item: SecurityCoordinationItem }) {
  const actions =
    item.status === "needsHelper"
      ? ["Review coverage", "Add helper later"]
      : item.status === "needsReview"
        ? ["Review notes", "Prepare reminder"]
        : ["Prepare reminder", "Open related follow-up"];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => (
        <Button
          className="min-h-12 cursor-not-allowed opacity-70"
          disabled
          key={action}
          type="button"
          variant="secondary"
        >
          {action}
        </Button>
      ))}
    </div>
  );
}

function RelatedLinks({ item }: { item: SecurityCoordinationItem }) {
  const links = [
    item.relatedScheduleId
      ? {
          href: "/admin/schedule",
          label: "Schedule",
        }
      : undefined,
    item.relatedAnnouncementId
      ? {
          href: `/admin/announcements/${item.relatedAnnouncementId}`,
          label: "Security note",
        }
      : undefined,
    item.relatedNeedsAttentionId
      ? {
          href: `/admin/needs-attention/${item.relatedNeedsAttentionId}`,
          label: "Follow-up",
        }
      : undefined,
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  if (links.length === 0) {
    return (
      <p className="text-sm leading-6 text-slate-500">
        No related schedule, announcement, or follow-up is linked in this mock data.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function SameDayItems({ items }: { items: SecurityCoordinationItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm leading-6 text-slate-500">
        No other security items are listed for this day.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Link
          className="rounded-lg border border-white/70 bg-white/50 px-4 py-3 transition hover:bg-white/74"
          href={getSecurityDetailHref(item)}
          key={item.id}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">{item.title}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/70 bg-white/58 px-2.5">
                  <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                  {getSecurityServiceTypeLabel(item.serviceType)}
                </span>
                {item.timeWindow ? (
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/70 bg-white/58 px-2.5">
                    <Clock3 aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                    {item.timeWindow}
                  </span>
                ) : null}
              </div>
            </div>
            <StatusLabel status={item.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function NotFoundState() {
  return (
    <EmptyState
      title="Security item not found"
      message="This is mock preview data, so the security item may have been renamed or removed. Return to Security to choose another site check or coverage note."
    />
  );
}

export function generateStaticParams() {
  return securityCoordinationItems.map((item) => ({
    securityItemId: item.id,
  }));
}

export default async function SecurityDetailPage({
  params,
}: SecurityDetailPageProps) {
  const { securityItemId } = await params;
  const item = getSecurityItemById(securityItemId);
  const project = getProjectById(item?.projectId ?? "");
  const relatedItems = item ? getRelatedSecurityItemsForSameDay(item) : [];
  const nextAction = item ? getNextSecurityActionForItem(item) : undefined;
  const helpers =
    item && item.assignedHelpers.length > 0
      ? item.assignedHelpers.join(", ")
      : "Helper to add";

  return (
    <AdminShell active="security">
      <Link
        className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-slate-600 transition hover:bg-white/56 hover:text-slate-950"
        href={getSecurityNotFoundHref()}
      >
        <ArrowLeft aria-hidden="true" className="mr-1.5 h-4 w-4" />
        Back to Security
      </Link>

      {!item ? (
        <div className="mt-4">
          <NotFoundState />
          <div className="mt-4">
            <Button href="/admin/security" variant="secondary">
              Return to Security
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.dayLabel}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  {item.title}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex min-h-8 items-center rounded-full border border-white/80 bg-white/62 px-3 py-1 text-xs font-semibold text-slate-600">
                  <ShieldCheck aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  {getSecurityServiceTypeLabel(item.serviceType)}
                </span>
                <StatusLabel status={item.status} />
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Review this security item, including time window, coverage,
              security contact, assigned helpers, and site/access notes.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Preview only. This page does not save changes, assign helpers,
              send reminders, create alerts, track location, or connect to
              security systems.
            </p>
          </header>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <GlassCard className="p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Coming next
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {nextAction?.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {nextAction?.detail}
              </p>
            </GlassCard>

            <GlassCard className="p-4 sm:p-5">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                Security details
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoTile icon={CalendarDays} label="Date" value={item.dayLabel} />
                <InfoTile
                  icon={Clock3}
                  label="Time"
                  value={item.timeWindow ?? "To confirm"}
                />
                <InfoTile
                  icon={UserRound}
                  label="Security contact"
                  value={item.assignedContact ?? "To confirm"}
                />
                <InfoTile icon={Users} label="Assigned helper" value={helpers} />
                <InfoTile
                  icon={Building2}
                  label="Congregation"
                  value={item.congregation ?? "To confirm"}
                />
                <InfoTile
                  icon={ClipboardList}
                  label="Project"
                  value={project?.name ?? "Active workspace"}
                />
              </div>
            </GlassCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <GlassCard className="overflow-hidden">
              <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                <SectionTitle icon={KeyRound}>Notes</SectionTitle>
              </div>
              <div className="space-y-4 p-4 text-sm leading-6 text-slate-600 sm:p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Site / access notes
                  </p>
                  <p className="mt-1">{item.siteNotes ?? "No site notes yet."}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Coverage
                  </p>
                  <p className="mt-1">
                    {item.coverageNotes ?? "No coverage note yet."}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Helpers
                  </p>
                  <p className="mt-1">{item.helperNotes ?? "No helper note yet."}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="overflow-hidden">
              <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                <SectionTitle icon={ListChecks}>Placeholder actions</SectionTitle>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  These show likely future actions and do not save changes.
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <PlaceholderActions item={item} />
              </div>
            </GlassCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <GlassCard className="p-4 sm:p-5">
              <SectionTitle icon={MessageSquareText}>Related items</SectionTitle>
              <div className="mt-4">
                <RelatedLinks item={item} />
              </div>
            </GlassCard>

            <GlassCard className="p-4 sm:p-5">
              <SectionTitle icon={CalendarDays}>Same-day security</SectionTitle>
              <div className="mt-4">
                <SameDayItems items={relatedItems} />
              </div>
            </GlassCard>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
