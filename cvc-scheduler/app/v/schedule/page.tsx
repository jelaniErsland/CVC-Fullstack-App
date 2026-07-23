import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Info, KeyRound, ShieldCheck } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { VolunteerScheduleAccessRefresh } from "@/components/VolunteerScheduleAccessRefresh";
import { VolunteerScheduleClient } from "@/components/VolunteerScheduleClient";
import {
  readVolunteerSchedule,
  volunteerScheduleAccessCookie,
} from "@/lib/volunteerScheduleAccess/server";

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
    <header className="flex items-center justify-between gap-4">
      <Link
        href="/"
        className="rounded-md text-lg font-semibold tracking-[-0.025em] text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-4"
      >
        Project Local
      </Link>
      <Link
        href="/admin/login"
        aria-label="Special access for project contacts"
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/80 bg-white/58 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
      >
        <KeyRound aria-hidden="true" className="size-4" strokeWidth={1.8} />
        <span className="hidden sm:inline">Special access</span>
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
      <article className="w-full max-w-xl rounded-[1.75rem] border border-white/80 bg-white/78 p-7 shadow-[0_28px_90px_rgba(15,23,42,0.11)] backdrop-blur-2xl sm:p-10">
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
    <PageShell className="px-5 py-5 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <PublicHeader />

        <main className="pb-12 pt-8 sm:pt-12">
          <section className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800"
              >
                {schedule.volunteerDisplayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  You&apos;re viewing
                </p>
                <p className="mt-0.5 font-semibold text-slate-950">
                  {schedule.volunteerDisplayName}
                </p>
                <p className="text-sm text-slate-500">{schedule.workspaceDisplayName}</p>
              </div>
            </div>
            <form action={leaveScheduleAction}>
              <button className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg text-sm font-medium text-slate-500 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:self-auto">
                Not you? Leave this schedule
              </button>
            </form>
          </section>

          <section className="py-8">
            <p className="text-sm font-semibold text-sky-700">
              Welcome, {firstName(schedule.volunteerDisplayName)}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-6xl">
              Your volunteer schedule
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              These are your current published assignments for {schedule.workspaceDisplayName}.
              This page is read-only for now.
            </p>
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
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)] lg:items-start">
              <section aria-labelledby="assignments-title">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Published schedule
                    </p>
                    <h2
                      id="assignments-title"
                      className="mt-1 text-xl font-semibold tracking-tight text-slate-950"
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
                  leaveAction={leaveScheduleAction}
                />
              </section>

              <aside className="rounded-[1.5rem] border border-white/80 bg-white/60 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                <div className="flex size-10 items-center justify-center rounded-full bg-sky-100 text-sky-800">
                  <ShieldCheck aria-hidden="true" className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-tight text-slate-950">
                  Secure schedule access
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This browser session is limited to your schedule. Closing the browser
                  ends this session; remembered-device access is not active yet.
                </p>
                <p className="mt-4 text-xs leading-5 text-slate-400">
                  Timezone: {schedule.workspaceTimezone}
                </p>
              </aside>
            </div>
          )}
        </main>
      </div>
    </PageShell>
  );
}
