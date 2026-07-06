import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  MapPin,
  UserRound,
  UsersRound,
} from "lucide-react";

import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { readAssignmentDetailContext } from "@/lib/assignments/detailContext.server";
import type { AssignmentDetailContext } from "@/lib/assignments/detailContext.server";
import { readProjectContactSession } from "@/lib/auth/session";

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

const responseSourceLabels: Record<
  AssignmentDetailContext["currentResponseSource"],
  string
> = {
  project_contact: "Project contact",
  public_token: "Volunteer response",
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
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(date);
  }
}

function PageFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <PageShell className="px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-slate-600 transition hover:bg-white/60 hover:text-slate-950"
          href="/admin/calendar"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to Calendar
        </Link>
        {children}
      </div>
    </PageShell>
  );
}

function UnavailableState({ signInHref }: Readonly<{ signInHref?: string }>) {
  return (
    <PageFrame>
      <GlassCard className="mt-4 p-6 sm:p-8">
        <div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </div>
        <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
          Project contact access
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">
          Assignment unavailable
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
          Sign in with an authorized project-contact account, or return to the project workspace. This assignment may no longer be available.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {signInHref ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              href={signInHref}
            >
              Sign in as a project contact
            </Link>
          ) : null}
          <Link
            className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white/70 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
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
    <div className="flex gap-3 rounded-xl border border-white/80 bg-white/52 p-4">
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <div className="mt-1 text-sm font-semibold leading-6 text-slate-800">{value}</div>
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

  if (!context) {
    return <UnavailableState />;
  }

  return (
    <PageFrame>
      <div className="mt-4 space-y-5">
        <header className="rounded-2xl border border-white/70 bg-white/35 px-5 py-6 backdrop-blur-xl sm:px-7 sm:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sky-700">{context.workspaceDisplayName}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
                {context.taskTitle}
              </h1>
              <p className="mt-3 break-all font-mono text-xs text-slate-400">
                Assignment {context.assignmentId}
              </p>
            </div>
            <span className="inline-flex min-h-8 w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
              Active assignment
            </span>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <GlassCard className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Schedule and volunteer
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailItem
                icon={CalendarDays}
                label={scheduleKindLabels[context.scheduleKind]}
                value={formatSchedule(context)}
              />
              <DetailItem icon={Clock3} label="Project timezone" value={context.timezone} />
              <DetailItem
                icon={UserRound}
                label="Assigned volunteer"
                value={context.volunteerDisplayName}
              />
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
              <DetailItem
                icon={CheckCircle2}
                label="Current response"
                value={responseStatusLabels[context.currentResponseStatus]}
              />
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                Response status
              </h2>
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
                <div>
                  <dt className="font-medium text-slate-500">Assignment editing</dt>
                  <dd className="mt-1 font-semibold text-slate-800">
                    {context.canEditAssignment
                      ? "Permission available"
                      : "Read-only permission"}
                  </dd>
                </div>
              </dl>
            </GlassCard>

            <GlassCard className="border-slate-200/80 bg-slate-50/72 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Future assignment tools
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                Response-link actions are not available
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This page is read-only. Link generation and delivery require a separate reviewed product action and interface.
              </p>
            </GlassCard>
          </div>
        </section>
      </div>
    </PageFrame>
  );
}
