import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { ProjectLocalBrand } from "@/components/ProjectLocalBrand";
import { VolunteerScheduleAccessRefresh } from "@/components/VolunteerScheduleAccessRefresh";
import { VolunteerHomeDashboard } from "@/components/VolunteerHomeDashboard";
import { readVolunteerHome } from "@/lib/volunteerScheduleAccess/home.server";
import { emitOperationalEvent } from "@/lib/observability/server";
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

async function leaveScheduleAction() {
  "use server";
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  cookieStore.delete(volunteerScheduleAccessCookie.name);
  cookieStore.set(volunteerScheduleAccessCookie.name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: forwardedProtocol === "https",
    path: volunteerScheduleAccessCookie.path,
    maxAge: 0,
  });
  redirect("/v/schedule?left=1");
}

function PublicHeader() {
  return (
    <header className="flex items-center border-b border-[var(--pl-border)] pb-3">
      <Link
        href="/"
        aria-label="Project Local home"
        className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4"
      >
        <ProjectLocalBrand />
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
        <Link href="/" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">Find your schedule</Link>
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
    const leftSchedule = resolvedSearchParams.left === "1";
    return (
      <StateCard
        eyebrow="Volunteer schedule"
        title={leftSchedule ? "You’ve left this schedule" : "This schedule link is unavailable"}
        message={
          leftSchedule
            ? "Find your schedule using your name and registered email or phone."
            : "Find your schedule below, or open your latest schedule link."
        }
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
        message="Find your schedule below, or open your latest schedule link."
      />
    );
  }

  const assignments = [
    ...schedule.upcomingAssignments,
    ...schedule.pastAssignments,
  ];

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: schedule.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const home = await readVolunteerHome(schedule.upcomingAssignments[0]?.startDate ?? today);
  return (
    <PageShell className="bg-[var(--pl-canvas)] px-4 py-4 sm:px-7 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <PublicHeader />
        <div className="flex items-center justify-between gap-3 py-3 text-xs text-slate-600">
          <p>Times in {schedule.workspaceTimezone}</p>
          <form action={leaveScheduleAction}><button className="min-h-10 rounded-lg px-2 font-medium focus-visible:outline-2 focus-visible:outline-blue-600" aria-label="Not you? Leave this schedule">Not you?</button></form>
        </div>
        <div className="pb-10"><VolunteerHomeDashboard name={schedule.volunteerDisplayName} projectName={schedule.workspaceDisplayName} assignments={assignments} upcoming={schedule.upcomingAssignments} initialHome={home} today={today} /></div>
      </div>
    </PageShell>
  );
}
