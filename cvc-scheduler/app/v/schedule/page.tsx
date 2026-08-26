import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Info, KeyRound, ShieldCheck } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { ProjectLocalBrand } from "@/components/ProjectLocalBrand";
import { VolunteerScheduleAccessRefresh } from "@/components/VolunteerScheduleAccessRefresh";
import { VolunteerScheduleClient } from "@/components/VolunteerScheduleClient";
import { emitOperationalEvent } from "@/lib/observability/server";
import {
  readVolunteerSchedule,
  volunteerScheduleAccessCookie,
} from "@/lib/volunteerScheduleAccess/server";
import {
  confirmAllVolunteerScheduleAction,
  submitVolunteerScheduleResponseAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Your volunteer schedule | Project Local",
  description: "Secure Project Local volunteer schedule access.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

async function leaveScheduleAction() {
  "use server";
  const cookieStore = await cookies();
  cookieStore.delete(volunteerScheduleAccessCookie.name);
  cookieStore.set(volunteerScheduleAccessCookie.name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: volunteerScheduleAccessCookie.path,
    maxAge: 0,
  });
  redirect("/v/schedule");
}

function PublicHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--pl-border)] pb-3">
      <Link
        href="/"
        aria-label="Project Local home"
        className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4"
      >
        <ProjectLocalBrand />
      </Link>
      <Link
        href="/admin/login"
        aria-label="Special access for project contacts"
        className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--pl-border)] bg-white text-[var(--pl-text)] shadow-sm transition hover:bg-[var(--pl-surface-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:w-auto sm:px-3"
      >
        <KeyRound aria-hidden="true" className="size-4" strokeWidth={1.8} />
        <span className="hidden text-xs sm:inline">Project contact</span>
      </Link>
    </header>
  );
}

function StateCard({
  eyebrow,
  title,
  message,
}: Readonly<{ eyebrow: string; title: string; message: string }>) {
  return (
    <PageShell className="flex items-center justify-center px-5 py-12">
      <article className="w-full max-w-xl rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white p-7 shadow-[var(--pl-shadow-raised)] sm:p-10">
        <div className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-800">
          <Info aria-hidden="true" className="size-5" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">{message}</p>
        <p className="mt-6 text-sm leading-6 text-slate-500">
          No account or password is needed when you have a current schedule link.
        </p>
      </article>
    </PageShell>
  );
}

type VolunteerSchedulePageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function VolunteerSchedulePage({
  searchParams,
}: VolunteerSchedulePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  if (resolvedSearchParams.access === "linked") {
    return (
      <PageShell className="flex items-center justify-center px-5 py-12">
        <VolunteerScheduleAccessRefresh />
      </PageShell>
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(volunteerScheduleAccessCookie.name)?.value;

  if (!token) {
    return (
      <StateCard
        eyebrow="Volunteer schedule"
        title="This schedule link is unavailable"
        message="Open your latest secure schedule link from the project team. If you need help, contact the project team for a current link."
      />
    );
  }

  let schedule;
  try {
    schedule = await readVolunteerSchedule({ token });
  } catch {
    emitOperationalEvent({
      event: "schedule_access.exchange_failure",
      failureCode: "unexpected_failure",
    });
    schedule = { kind: "unavailable" } as const;
  }

  if (schedule.kind === "unavailable") {
    return (
      <StateCard
        eyebrow="Volunteer schedule"
        title="This schedule link is unavailable"
        message="Open your latest secure schedule link from the project team. If you need help, contact the project team for a current link."
      />
    );
  }

  const assignments = [
    ...schedule.upcomingAssignments,
    ...schedule.pastAssignments,
  ];

  return (
    <PageShell className="bg-[radial-gradient(circle_at_72%_0%,rgba(219,234,254,.72),transparent_25rem),var(--pl-canvas)] px-4 py-4 sm:px-7 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <PublicHeader />

        <main className="pb-10 pt-4 sm:pt-6">
          <section className="relative overflow-hidden rounded-[var(--pl-radius-panel)] border border-blue-100 bg-white p-4 shadow-[var(--pl-shadow-panel)] sm:p-5">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-blue-500 to-violet-500" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--pl-blue-soft)] text-sm font-bold text-[var(--pl-blue)]"
              >
                {schedule.volunteerDisplayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--pl-muted)]">
                  {schedule.workspaceDisplayName}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-[var(--pl-ink)]">
                  {schedule.volunteerDisplayName}
                </p>
              </div>
            </div>
            <form action={leaveScheduleAction}>
              <button aria-label="Not you? Leave this schedule" className="inline-flex min-h-9 shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                Not you?
              </button>
            </form>
            </div>

            <div className="mt-3 sm:ml-[52px] sm:mt-4">
              <p className="text-xs font-semibold text-[var(--pl-blue)]">
                Welcome, {firstName(schedule.volunteerDisplayName)}.
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.045em] text-[var(--pl-ink)] sm:text-4xl">
                Here’s your schedule
              </h1>
              <p className="mt-1.5 text-sm leading-6 text-[var(--pl-text)]">
                Review your project work and let the team know what you can make.
              </p>
            </div>
          </section>

          {schedule.kind === "ready_empty" ? (
            <section className="rounded-[1.5rem] border border-white/80 bg-white/72 p-7 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
              <div className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sky-800">
                <CalendarDays aria-hidden="true" className="size-5" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
                No published assignments yet
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Your secure link is active, but there are no published assignments for you
                in this workspace right now.
              </p>
              <form action={leaveScheduleAction} className="mt-6">
                <button className="inline-flex min-h-11 items-center rounded-full border border-slate-200 bg-white/70 px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2">
                  Not you? Leave this schedule
                </button>
              </form>
            </section>
          ) : (
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_280px] lg:items-start">
              <section aria-labelledby="assignments-title">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2
                      id="assignments-title"
                      className="text-lg font-semibold tracking-tight text-[var(--pl-ink)]"
                    >
                      Your assignments
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">
                    {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
                  </span>
                </div>
                <VolunteerScheduleClient
                  assignments={assignments}
                  confirmAllAction={confirmAllVolunteerScheduleAction}
                  submitResponseAction={submitVolunteerScheduleResponseAction}
                />
              </section>

              <aside className="rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white/70 p-4 lg:border-blue-100 lg:bg-[var(--pl-blue-soft)]/70 lg:p-5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)] text-[var(--pl-blue)] lg:size-9 lg:bg-white lg:shadow-sm">
                  <ShieldCheck aria-hidden="true" className="size-4 lg:size-5" />
                </div>
                <h2 className="mt-3 text-base font-semibold tracking-tight text-[var(--pl-ink)]">
                  Need help?
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--pl-text)]">
                  Open any assignment to see notes and your Follow-up Contact. They can
                  help with arrival details or a last-minute change.
                </p>
                <p className="mt-3 text-xs leading-5 text-[var(--pl-muted)]">
                  Times shown in {schedule.workspaceTimezone}
                </p>
              </aside>
            </div>
          )}
        </main>
      </div>
    </PageShell>
  );
}
