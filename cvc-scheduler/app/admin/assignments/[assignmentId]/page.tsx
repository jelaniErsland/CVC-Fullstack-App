import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Info,
  LockKeyhole,
  MapPin,
  UserRound,
  UsersRound,
} from "lucide-react";

import { AdminShell } from "@/components/AdminShell";
import { GlassCard } from "@/components/GlassCard";
import { readAssignmentDetailContext } from "@/lib/assignments/detailContext.server";
import type { AssignmentDetailContext } from "@/lib/assignments/detailContext.server";
import { readProjectContactSession } from "@/lib/auth/session";
import { createDisabledAssignmentResponseLinkServerAction } from "@/lib/responseTokens/productActionServerAction.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Assignment detail | Project Local",
  description: "Read-only persisted assignment detail for authorized project contacts.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type AssignmentDetailPageProps = Readonly<{
  params: Promise<{ assignmentId: string }>;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const scheduleKindLabels: Record<AssignmentDetailContext["scheduleKind"], string> = {
  timed: "Scheduled time",
  date_based: "Scheduled date",
  multi_day_window: "Project window",
  milestone: "Milestone",
};

const responseStatusLabels: Record<
  AssignmentDetailContext["currentResponseStatus"],
  string
> = {
  needs_response: "Needs response",
  confirmed: "Confirmed",
  declined: "Can’t make it",
};

const responseStatusStyles: Record<
  AssignmentDetailContext["currentResponseStatus"],
  string
> = {
  needs_response: "border-amber-200 bg-[var(--pl-amber-soft)] text-[#8b5a12]",
  confirmed: "border-emerald-200 bg-[var(--pl-teal-soft)] text-[#177b6f]",
  declined: "border-rose-200 bg-[var(--pl-coral-soft)] text-[#a44437]",
};

const responseSourceLabels: Record<
  AssignmentDetailContext["currentResponseSource"],
  string
> = {
  project_contact: "Project contact",
  public_token: "Volunteer response",
  volunteer_schedule: "Volunteer schedule",
};

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(value: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatSchedule(context: AssignmentDetailContext) {
  const startDate = formatDate(context.scheduledDate);
  if (context.scheduleKind === "timed") {
    const startTime = formatTime(context.startTime);
    const endTime = formatTime(context.endTime);
    return [startDate, [startTime, endTime].filter(Boolean).join("–")]
      .filter(Boolean)
      .join(" · ");
  }
  if (context.scheduleKind === "multi_day_window" && context.scheduledEndDate) {
    return `${startDate}–${formatDate(context.scheduledEndDate)}`;
  }
  return startDate;
}

function formatUpdatedAt(value: string, timezone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently updated";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(date);
  }
}

function getDisabledResponseLinkWiringState(disabledServerActionBinding: unknown) {
  void disabledServerActionBinding;
  return {
    reviewedDisabledServerActionImport: true,
    reviewedDisabledActionBinding: true,
    enabled: false,
  } as const;
}

function PageFrame({
  children,
  workspaceName,
}: Readonly<{ children: React.ReactNode; workspaceName?: string }>) {
  return (
    <AdminShell active="calendar" workspaceName={workspaceName ?? "Project workspace"}>
      <div className="mx-auto w-full max-w-5xl">
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[var(--pl-text)] transition hover:bg-white hover:text-[var(--pl-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-blue)]"
          href="/admin/calendar"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to Calendar
        </Link>
        {children}
      </div>
    </AdminShell>
  );
}

function UnavailableState({ signInHref }: Readonly<{ signInHref?: string }>) {
  return (
    <PageFrame>
      <GlassCard className="mt-3 p-6 sm:p-8">
        <div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
          Assignment
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
          Assignment unavailable
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
          {signInHref
            ? "Sign in with an authorized project-contact account to view assignment details."
            : "This assignment is not available from your current project-contact access. Return to the project workspace to continue."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {signInHref ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-lg bg-[var(--pl-blue)] px-5 text-sm font-bold text-white transition hover:bg-blue-700"
              href={signInHref}
            >
              Sign in as a project contact
            </Link>
          ) : null}
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--pl-border)] bg-white px-5 text-sm font-bold text-[var(--pl-text)] transition hover:text-[var(--pl-ink)]"
            href="/admin/dashboard"
          >
            Return to Overview
          </Link>
        </div>
      </GlassCard>
    </PageFrame>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}: Readonly<{
  icon: typeof CalendarDays;
  label: string;
  value: React.ReactNode;
}>) {
  return (
    <div className="flex gap-3 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-4">
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pl-muted)]">
          {label}
        </p>
        <div className="mt-1 break-words text-sm font-bold leading-6 text-[var(--pl-ink)]">
          {value}
        </div>
      </div>
    </div>
  );
}

export default async function AssignmentDetailPage({ params }: AssignmentDetailPageProps) {
  const { assignmentId } = await params;
  const normalizedAssignmentId = uuidPattern.test(assignmentId)
    ? assignmentId.toLowerCase()
    : null;
  const returnPath = normalizedAssignmentId
    ? `/admin/assignments/${encodeURIComponent(normalizedAssignmentId)}`
    : "/admin/dashboard";
  const signInHref = `/admin/login?next=${encodeURIComponent(returnPath)}`;
  const session = await readProjectContactSession();

  if (session.status !== "authenticated") {
    return <UnavailableState signInHref={signInHref} />;
  }

  let context: AssignmentDetailContext | null = null;
  if (normalizedAssignmentId) {
    try {
      context = await readAssignmentDetailContext({
        assignmentId: normalizedAssignmentId,
      });
    } catch {
      context = null;
    }
  }

  if (!normalizedAssignmentId || !context) {
    return <UnavailableState />;
  }

  const disabledResponseLinkAction =
    createDisabledAssignmentResponseLinkServerAction.bind(null, normalizedAssignmentId);
  const responseLinkWiringState = getDisabledResponseLinkWiringState(
    disabledResponseLinkAction,
  );
  void responseLinkWiringState;

  return (
    <PageFrame workspaceName={context.workspaceDisplayName}>
      <div className="mt-3 space-y-5">
        <header className="rounded-2xl border border-[var(--pl-border)] bg-white px-5 py-6 shadow-[var(--pl-shadow-card)] sm:px-7 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
                {context.workspaceDisplayName}
              </p>
              <h1 className="mt-1 break-words text-3xl font-bold tracking-[-0.04em] text-[var(--pl-ink)] sm:text-4xl">
                Assignment
              </h1>
              <p className="mt-2 break-words text-base font-semibold text-[var(--pl-text)] sm:text-lg">
                {context.taskTitle}
              </p>
            </div>
            <span
              className={`inline-flex min-h-9 w-fit items-center rounded-lg border px-3 text-xs font-bold ${responseStatusStyles[context.currentResponseStatus]}`}
            >
              {responseStatusLabels[context.currentResponseStatus]}
            </span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="p-5 sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pl-muted)]">
              Assigned volunteer
            </p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]">
                <UserRound aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold tracking-[-0.02em] text-[var(--pl-ink)]">
                  {context.volunteerDisplayName}
                </h2>
                <p className="mt-0.5 text-sm font-medium text-[var(--pl-muted)]">
                  {context.volunteerCongregation ?? "Project volunteer"}
                </p>
              </div>
            </div>
            <h2 className="mt-6 text-lg font-bold tracking-tight text-[var(--pl-ink)]">
              Schedule
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailItem
                icon={CalendarDays}
                label={scheduleKindLabels[context.scheduleKind]}
                value={formatSchedule(context)}
              />
              <DetailItem icon={Clock3} label="Project timezone" value={context.timezone} />
              <DetailItem
                icon={MapPin}
                label="Congregation"
                value={context.volunteerCongregation ?? "Not listed"}
              />
              <DetailItem
                icon={UsersRound}
                label="Planned volunteers"
                value={context.plannedNeededCount}
              />
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-lg font-bold tracking-tight text-[var(--pl-ink)]">
                Response status
              </h2>
              <div className={`mt-4 rounded-xl border p-4 ${responseStatusStyles[context.currentResponseStatus]}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-75">
                  Current response
                </p>
                <p className="mt-1 text-lg font-bold">
                  {responseStatusLabels[context.currentResponseStatus]}
                </p>
              </div>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-slate-500">Recorded by</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {responseSourceLabels[context.currentResponseSource]}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">Last updated</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {formatUpdatedAt(context.currentResponseUpdatedAt, context.timezone)}
                  </dd>
                </div>
              </dl>
            </GlassCard>

            <GlassCard
              className="border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--pl-muted)]" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--pl-muted)]">
                    Response link
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--pl-text)]">
                    Manual response-link tools are not enabled for this beta.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-[var(--pl-border)] pt-4">
          <Link
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--pl-blue)] px-4 text-sm font-bold text-white transition hover:bg-blue-700"
            href={`/admin/calendar?view=day&date=${encodeURIComponent(context.scheduledDate)}`}
          >
            Open scheduled day
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            className="inline-flex min-h-10 items-center rounded-lg border border-[var(--pl-border)] bg-white px-4 text-sm font-bold text-[var(--pl-text)] transition hover:text-[var(--pl-ink)]"
            href="/admin/needs-attention"
          >
            Needs Attention
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}
