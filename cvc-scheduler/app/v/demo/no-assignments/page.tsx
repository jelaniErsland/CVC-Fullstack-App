import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, KeyRound } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { VolunteerProjectInfo } from "@/components/VolunteerProjectInfo";
import {
  volunteerPreviewContext,
  volunteerPreviewProjectInfo,
} from "@/lib/volunteerPreview";

export const metadata: Metadata = {
  title: "No assignments yet | Project Local",
  description: "A calm Project Local volunteer schedule preview with no assignments yet.",
};

export default function NoAssignmentsPage() {
  const context = volunteerPreviewContext;

  return (
    <PageShell className="px-5 py-5 sm:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
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

        <main className="pb-14 pt-8 sm:pt-12">
          <section aria-label="Remembered volunteer" className="flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">{context.initials}</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">You&apos;re viewing</p>
                <p className="mt-0.5 font-semibold text-slate-950">{context.volunteerName}</p>
                <p className="text-sm text-slate-500">{context.projectName}</p>
              </div>
            </div>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg text-sm font-medium text-slate-500 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 sm:self-auto"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Not you? Use a different name or email
            </Link>
          </section>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)] lg:items-start">
            <section aria-labelledby="empty-schedule-title" className="max-w-2xl py-4 sm:py-8">
              <p className="text-sm font-semibold text-sky-700">Your volunteer schedule</p>
              <h1 id="empty-schedule-title" className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-6xl">
                Nothing scheduled for you yet.
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                The project contact may still be reviewing your availability. This does not mean you were overlooked or cannot help.
              </p>
              <p className="mt-3 text-base leading-7 text-slate-500">
                Check back later using the same project link. No account or password is needed.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={volunteerPreviewProjectInfo.questionnaire.href}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  <ClipboardCheck aria-hidden="true" className="size-4" />
                  Open volunteer questionnaire
                </Link>
                <Link
                  href="/"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white/70 px-5 text-sm font-semibold text-slate-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                >
                  Back to project lookup
                </Link>
              </div>

              <p className="mt-7 border-l-2 border-sky-200 pl-4 text-sm leading-6 text-slate-500">
                There is nothing to refresh right now. New assignments would appear here after a project contact finishes the schedule.
              </p>
            </section>

            <VolunteerProjectInfo showQuestionnaire={false} showLunch={false} />
          </div>
        </main>
      </div>
    </PageShell>
  );
}
