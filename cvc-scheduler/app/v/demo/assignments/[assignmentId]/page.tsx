import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  HardHat,
  KeyRound,
  MapPin,
  Shirt,
  UserRound,
  Users,
  Utensils,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { VolunteerConfirmationPreview } from "@/components/VolunteerConfirmationPreview";
import { assignments, getVolunteerSchedule } from "@/lib/mockData";

type AssignmentDetailPageProps = {
  params: Promise<{ assignmentId: string }>;
};

const detailSlug = "material-staging";

export function generateStaticParams() {
  return [{ assignmentId: detailSlug }];
}

export async function generateMetadata({ params }: AssignmentDetailPageProps): Promise<Metadata> {
  const { assignmentId } = await params;

  return {
    title:
      assignmentId === detailSlug
        ? "Material staging | Project Local"
        : "Assignment unavailable | Project Local",
    description: "Review a volunteer assignment and preview a response.",
  };
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

function UnavailableAssignment() {
  return (
    <PageShell className="px-5 py-5 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <PublicHeader />
        <main className="py-16 sm:py-24">
          <p className="text-sm font-semibold text-sky-700">Assignment unavailable</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            We could not find that assignment.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            It may have changed, or this preview link may no longer match the sample schedule.
          </p>
          <Link
            href="/v/demo"
            className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to my schedule
          </Link>
        </main>
      </div>
    </PageShell>
  );
}

export default async function AssignmentDetailPage({ params }: AssignmentDetailPageProps) {
  const { assignmentId } = await params;

  if (assignmentId !== detailSlug) {
    return <UnavailableAssignment />;
  }

  const schedule = getVolunteerSchedule();
  const assignment = assignments.find((item) => item.id === "stage-jan-14");
  const projectName = schedule.project?.name ?? "Belgrade Major Remodel 2026";
  const coordinator = schedule.projectInfo?.coordinator ?? "Your project contact";

  if (!assignment) {
    return <UnavailableAssignment />;
  }

  return (
    <PageShell className="px-5 py-5 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-5xl">
        <PublicHeader />

        <main className="pb-14 pt-8 sm:pt-12">
          <Link
            href="/v/demo"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to my schedule
          </Link>

          <div className="mt-5 flex items-center gap-3 border-b border-slate-200/80 pb-6">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
              AR
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">You&apos;re viewing</p>
              <p className="mt-0.5 font-semibold text-slate-950">Alex Rivera</p>
              <p className="text-sm text-slate-500">{projectName}</p>
            </div>
          </div>

          <article className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/72 shadow-[0_28px_90px_rgba(15,23,42,0.11)] backdrop-blur-2xl">
            <header className="p-6 sm:p-9">
              <p className="text-sm font-semibold text-sky-700">Your next assignment</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">
                {assignment.role}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Help the logistics team receive, sort, and place materials so the next crew can start safely and on time.
              </p>
            </header>

            <dl className="grid border-y border-slate-200/70 sm:grid-cols-2">
              <div className="flex gap-3 border-b border-slate-200/70 p-5 sm:border-r sm:p-6">
                <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" strokeWidth={1.8} />
                <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Date and time</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{assignment.date}<br />{assignment.time}</dd></div>
              </div>
              <div className="flex gap-3 border-b border-slate-200/70 p-5 sm:p-6">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" strokeWidth={1.8} />
                <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Where</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{assignment.location}<br />Check in at the front desk first.</dd></div>
              </div>
              <div className="flex gap-3 border-b border-slate-200/70 p-5 sm:border-b-0 sm:border-r sm:p-6">
                <Users aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" strokeWidth={1.8} />
                <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Your crew</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{assignment.crew}<br />1 of 2 helpers confirmed.</dd></div>
              </div>
              <div className="flex gap-3 p-5 sm:p-6">
                <UserRound aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" strokeWidth={1.8} />
                <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Project contact</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{coordinator}<br />Ask at volunteer check-in if you need help.</dd></div>
              </div>
            </dl>

            <section aria-labelledby="prepare-title" className="p-6 sm:p-9">
              <h2 id="prepare-title" className="text-xl font-semibold tracking-tight text-slate-950">Before you arrive</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                <div className="flex gap-3">
                  <HardHat aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" strokeWidth={1.7} />
                  <p className="text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-800">Check in</span><br />Use the front desk before entering the work area.</p>
                </div>
                <div className="flex gap-3">
                  <Shirt aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" strokeWidth={1.7} />
                  <p className="text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-800">What to bring</span><br />Work gloves and closed-toe shoes.</p>
                </div>
                <div className="flex gap-3">
                  <Utensils aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-400" strokeWidth={1.7} />
                  <p className="text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-800">Lunch</span><br />Soup and salad begins at 11:45 AM.</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="response-title" className="border-t border-slate-200/70">
              <div className="px-6 pt-6 sm:px-9 sm:pt-8">
                <h2 id="response-title" className="text-xl font-semibold tracking-tight text-slate-950">Can you make it?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Choose a response to preview what this future flow will feel like.</p>
              </div>
              <VolunteerConfirmationPreview />
            </section>
          </article>
        </main>
      </div>
    </PageShell>
  );
}
