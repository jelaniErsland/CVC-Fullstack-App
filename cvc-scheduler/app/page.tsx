import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  KeyRound,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Project Local | Volunteer project access",
  description: "Find your project, volunteer schedule, and project updates.",
};

const questionnaireHref = "/questionnaire/belgrade-remodel-2026";

export default function Home() {
  return (
    <PageShell className="flex flex-col px-5 py-5 sm:px-8 lg:px-10">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-md text-lg font-semibold tracking-[-0.025em] text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-4"
        >
          Project Local
        </Link>
        <Link
          href="/admin/login"
          aria-label="Special access for project contacts"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/80 bg-white/58 px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white/90 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <KeyRound aria-hidden="true" className="size-4" strokeWidth={1.8} />
          <span className="hidden sm:inline">Special access</span>
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)] lg:gap-16 lg:py-20">
        <section aria-labelledby="public-home-title" className="max-w-2xl">
          <p className="text-sm font-semibold text-sky-700">Volunteer project access</p>
          <h1
            id="public-home-title"
            className="mt-4 text-[2.75rem] font-semibold leading-[0.98] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl"
          >
            Your project, all in one place.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl sm:leading-9">
            Coordinate volunteers, tasks, schedules, and updates in one place.
          </p>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-500">
            Find the project you are helping with, check your schedule, or fill out
            the volunteer questionnaire. No account is required.
          </p>
          <p className="mt-8 max-w-md border-l-2 border-sky-200 pl-4 text-sm leading-6 text-slate-500">
            Project Local remembers the volunteer you find on this device in the future.
            For now, this guided preview opens Alex Rivera&apos;s sample schedule.
          </p>
        </section>

        <section
          aria-labelledby="find-project-title"
          className="rounded-[1.75rem] border border-white/80 bg-white/70 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.11)] backdrop-blur-2xl sm:p-7"
        >
          <h2 id="find-project-title" className="text-2xl font-semibold tracking-tight text-slate-950">
            Find your project
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use the name or email you shared with the project contact.
          </p>

          <form action="/v/demo" method="get" className="mt-6 space-y-4">
            <div role="group" aria-labelledby="volunteer-project-label">
              <p id="volunteer-project-label" className="mb-2 text-sm font-medium text-slate-700">Project</p>
              <span className="flex min-h-[58px] items-center rounded-xl border border-slate-200 bg-slate-50/80 px-4">
                <span>
                  <span className="block text-base font-semibold text-slate-900">
                    Belgrade Major Remodel 2026
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Belgrade, Montana · Jan 12–24, 2026
                  </span>
                </span>
              </span>
              <input
                name="project"
                value="belgrade-remodel-2026"
                type="hidden"
                readOnly
              />
            </div>
            <label className="block" htmlFor="volunteer-identity">
              <span className="mb-2 block text-sm font-medium text-slate-700">Name or email</span>
              <input
                id="volunteer-identity"
                name="identity"
                autoComplete="name"
                defaultValue="Alex Rivera"
                required
                aria-describedby="identity-hint lookup-note"
                className="h-[52px] w-full rounded-xl border border-slate-200 bg-white/80 px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/70"
              />
              <span id="identity-hint" className="mt-2 block text-xs leading-5 text-slate-500">
                Use Alex Rivera for this sample lookup.
              </span>
            </label>
            <button
              type="submit"
              aria-describedby="lookup-note"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              Find my volunteer info
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
            <p id="lookup-note" className="text-center text-xs leading-5 text-slate-500">
              Preview only. This does not create an account or search real volunteer information.
            </p>
          </form>

          <div className="mt-5 border-t border-slate-200/80 pt-4">
            <Link
              href={questionnaireHref}
              className="group flex min-h-12 items-center gap-3 rounded-xl px-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <ClipboardCheck aria-hidden="true" className="size-5 text-sky-700" strokeWidth={1.8} />
              <span className="flex-1">Open volunteer questionnaire</span>
              <ArrowRight aria-hidden="true" className="size-4 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-1 border-t border-slate-200/70 py-5 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>Project Local keeps volunteer access simple and account-free.</p>
        <p>Special access is reserved for project contacts.</p>
      </footer>
    </PageShell>
  );
}
