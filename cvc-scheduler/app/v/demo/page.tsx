import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  KeyRound,
  MapPin,
  Megaphone,
  Utensils,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import { getVolunteerSchedule } from "@/lib/mockData";

export const metadata: Metadata = {
  title: "Alex's volunteer home | Project Local",
  description: "A preview of the simple Project Local volunteer home.",
};

export default function VolunteerDemoPage() {
  const schedule = getVolunteerSchedule();
  const projectName = schedule.project?.name ?? "Volunteer project";
  const nextAssignment = schedule.assignments[0];
  const laterAssignments = schedule.assignments.slice(1, 3);
  const nextLunch = schedule.lunches[0];
  const projectUpdate = schedule.announcements.find(
    (announcement) => announcement.title === "Gloves and closed-toe shoes reminder",
  );

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

        <main className="pb-12 pt-10 sm:pt-14">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Find another project
          </Link>

          <section className="mt-6 border-b border-slate-200/80 pb-8">
            <p className="text-sm font-semibold text-sky-700">{projectName}</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-6xl">
              Hi, Alex.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Here is what is next for your volunteer week. You can return on this device
              without creating an account.
            </p>
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.7fr)] lg:items-start">
            <div className="space-y-8">
              <section aria-labelledby="next-assignment-title">
                <div className="flex items-center justify-between gap-4">
                  <h2 id="next-assignment-title" className="text-xl font-semibold tracking-tight text-slate-950">
                    Next assignment
                  </h2>
                  <span className="text-xs font-medium text-slate-400">Schedule preview</span>
                </div>

                {nextAssignment ? (
                  <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/80 bg-white/72 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl">
                    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
                      <div>
                        <p className="text-sm font-semibold text-sky-700">{nextAssignment.date}</p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                          {nextAssignment.role}
                        </h3>
                      </div>
                      <StatusPill status={nextAssignment.status} />
                    </div>
                    <dl className="grid border-t border-slate-200/70 sm:grid-cols-3">
                      <div className="flex gap-3 border-b border-slate-200/70 p-5 sm:border-b-0 sm:border-r">
                        <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                        <div><dt className="sr-only">Time</dt><dd className="text-sm leading-6 text-slate-700">{nextAssignment.time}</dd></div>
                      </div>
                      <div className="flex gap-3 border-b border-slate-200/70 p-5 sm:border-b-0 sm:border-r">
                        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                        <div><dt className="sr-only">Location</dt><dd className="text-sm leading-6 text-slate-700">{nextAssignment.location}</dd></div>
                      </div>
                      <div className="flex gap-3 p-5">
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
                        <div><dt className="sr-only">Crew</dt><dd className="text-sm leading-6 text-slate-700">{nextAssignment.crew}</dd></div>
                      </div>
                    </dl>
                  </div>
                ) : null}
              </section>

              <section aria-labelledby="later-title">
                <h2 id="later-title" className="text-xl font-semibold tracking-tight text-slate-950">Later this week</h2>
                <div className="mt-3 divide-y divide-slate-200/80 border-y border-slate-200/80">
                  {laterAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex min-h-20 items-center gap-4 py-4">
                      <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-slate-400" strokeWidth={1.7} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{assignment.role}</p>
                        <p className="mt-1 text-sm leading-5 text-slate-500">{assignment.date} · {assignment.time}</p>
                      </div>
                      <StatusPill status={assignment.status} />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Confirmation actions are shown as status previews only in this foundation.
                </p>
              </section>
            </div>

            <aside className="space-y-3" aria-label="Volunteer project details">
              <section className="rounded-2xl border border-white/80 bg-white/58 p-5">
                <div className="flex items-center gap-3">
                  <ClipboardCheck aria-hidden="true" className="size-5 text-sky-700" strokeWidth={1.8} />
                  <h2 className="font-semibold text-slate-950">Questionnaire</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Your sample questionnaire is ready to review or finish.
                </p>
                <Link href="/questionnaire/belgrade-remodel-2026" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-sky-700 hover:text-sky-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                  Open questionnaire
                </Link>
              </section>

              <section className="rounded-2xl border border-white/80 bg-white/58 p-5">
                <div className="flex items-center gap-3">
                  <Utensils aria-hidden="true" className="size-5 text-sky-700" strokeWidth={1.8} />
                  <h2 className="font-semibold text-slate-950">Lunch</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {nextLunch ? `${nextLunch.day}: ${nextLunch.details}` : "Lunch details will appear here."}
                </p>
              </section>

              <section className="rounded-2xl border border-white/80 bg-white/58 p-5">
                <div className="flex items-center gap-3">
                  <Megaphone aria-hidden="true" className="size-5 text-sky-700" strokeWidth={1.8} />
                  <h2 className="font-semibold text-slate-950">Project update</h2>
                </div>
                <p className="mt-3 text-sm font-medium text-slate-800">{projectUpdate?.title ?? "Latest update"}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {projectUpdate?.bodyPreview ?? "New project notes will appear here."}
                </p>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </PageShell>
  );
}
