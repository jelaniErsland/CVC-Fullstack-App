import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BellRing, Clock3, KeyRound, MapPin, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { VolunteerConfirmationPreview } from "@/components/VolunteerConfirmationPreview";
import {
  getAssignmentDetailHref,
  getVolunteerPreviewAssignment,
  volunteerPreviewAssignments,
  volunteerPreviewContext,
} from "@/lib/volunteerPreview";

type ReminderPageProps = {
  params: Promise<{ assignmentId: string }>;
};

export function generateStaticParams() {
  return volunteerPreviewAssignments.map((assignment) => ({
    assignmentId: assignment.slug,
  }));
}

export async function generateMetadata({ params }: ReminderPageProps): Promise<Metadata> {
  const { assignmentId } = await params;
  const assignment = getVolunteerPreviewAssignment(assignmentId);

  return {
    title: assignment
      ? `${assignment.title} reminder | Project Local`
      : "Reminder unavailable | Project Local",
    description: "A deterministic Project Local assignment reminder preview.",
  };
}

function ReminderHeader() {
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

function UnavailableReminder() {
  return (
    <PageShell className="px-5 py-5 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <ReminderHeader />
        <main className="py-16 sm:py-24">
          <p className="text-sm font-semibold text-sky-700">Reminder unavailable</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
            We could not find that reminder.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            This preview link may not match an assignment in Alex&apos;s sample schedule.
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

export default async function ReminderPage({ params }: ReminderPageProps) {
  const { assignmentId } = await params;
  const assignment = getVolunteerPreviewAssignment(assignmentId);
  const context = volunteerPreviewContext;

  if (!assignment) {
    return <UnavailableReminder />;
  }

  return (
    <PageShell className="px-5 py-5 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <ReminderHeader />
        <main className="pb-14 pt-8 sm:pt-12">
          <Link
            href="/v/demo"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to my schedule
          </Link>

          <div className="mt-5 flex items-center gap-3 border-b border-slate-200/80 pb-6">
            <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">{context.initials}</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">You&apos;re viewing</p>
              <p className="mt-0.5 font-semibold text-slate-950">{context.volunteerName}</p>
              <p className="text-sm text-slate-500">{context.projectName}</p>
            </div>
          </div>

          <article className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/72 shadow-[0_28px_90px_rgba(15,23,42,0.11)] backdrop-blur-2xl">
            <header className="p-6 sm:p-9">
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-700">
                <BellRing aria-hidden="true" className="size-4" />
                Assignment reminder
              </div>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-5xl">{assignment.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                This is the kind of page a future email or text reminder could open. No account or password is needed in this preview.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                This is not a secure production link, and no reminder was sent.
              </p>
            </header>

            <dl className="grid border-y border-slate-200/70 sm:grid-cols-3">
              <div className="flex gap-3 border-b border-slate-200/70 p-5 sm:border-b-0 sm:border-r sm:p-6">
                <Clock3 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" />
                <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Date and time</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{assignment.date}<br />{assignment.time}</dd></div>
              </div>
              <div className="flex gap-3 border-b border-slate-200/70 p-5 sm:border-b-0 sm:border-r sm:p-6">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" />
                <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Where</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{assignment.location}<br />{assignment.checkIn}</dd></div>
              </div>
              <div className="flex gap-3 p-5 sm:p-6">
                <Users aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" />
                <div><dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Crew</dt><dd className="mt-1 text-sm leading-6 text-slate-800">{assignment.crew}<br />{assignment.helperCoverage}.</dd></div>
              </div>
            </dl>

            <section aria-labelledby="reminder-response-title">
              <div className="px-6 pt-6 sm:px-9 sm:pt-8">
                <h2 id="reminder-response-title" className="text-xl font-semibold tracking-tight text-slate-950">Can you make it?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Choose a response to preview this reminder flow.</p>
              </div>
              <VolunteerConfirmationPreview initialStatus={assignment.response} />
            </section>

            <footer className="flex flex-col gap-2 border-t border-slate-200/70 p-6 sm:flex-row sm:items-center sm:justify-between sm:px-9">
              <Link
                href={getAssignmentDetailHref(assignment.slug)}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-sky-700 hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                View full assignment details
              </Link>
              <span className="text-xs leading-5 text-slate-400">Reminder-link preview only</span>
            </footer>
          </article>
        </main>
      </div>
    </PageShell>
  );
}
