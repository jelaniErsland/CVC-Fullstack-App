import Link from "next/link";
import { AssignmentCard } from "@/components/AssignmentCard";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { getVolunteerSchedule } from "@/lib/mockData";

export default function VolunteerDemoPage() {
  const schedule = getVolunteerSchedule();
  const projectName = schedule.project?.name ?? "Volunteer Schedule";

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">
              CVC Scheduler
            </Link>
            <Link href="/q/demo" className="text-sm font-medium text-slate-500 hover:text-slate-950">
              Sample volunteer questionnaire
            </Link>
          </div>
          <Button variant="secondary">Add all to calendar</Button>
        </header>

        <section className="py-8 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-sm">
            {projectName}
          </p>
          <div className="mt-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Hi, Alex.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
                Here is your upcoming volunteer schedule and the latest project
                notes from the coordination team.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {schedule.assignments.length > 0 ? (
            schedule.assignments.map((assignment) => (
              <AssignmentCard key={assignment.id} {...assignment} />
            ))
          ) : (
            <div className="md:col-span-3">
              <EmptyState
                title="No assignments yet"
                message="When the coordination team publishes assignments, they will appear here."
              />
            </div>
          )}
        </section>

        <section className="grid gap-4 py-6 lg:grid-cols-3">
          <GlassCard className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Lunch Schedule
            </h2>
            {schedule.lunches.length > 0 ? (
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                {schedule.lunches.map((lunch) => (
                  <p key={lunch.id}>
                    <span className="font-medium text-slate-700">{lunch.day}:</span>{" "}
                    {lunch.details}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Lunch details have not been posted yet.
              </p>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Announcements
            </h2>
            {schedule.announcements.length > 0 ? (
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                {schedule.announcements.map((announcement) => (
                  <p key={announcement.id}>
                    <span className="font-medium text-slate-700">
                      {announcement.title}:
                    </span>{" "}
                    {announcement.bodyPreview}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-500">
                There are no announcements right now.
              </p>
            )}
          </GlassCard>

          <GlassCard className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Project Info
            </h2>
            {schedule.projectInfo ? (
              <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
                <p>Coordinator: {schedule.projectInfo.coordinator}</p>
                <p>Site address: {schedule.projectInfo.address}</p>
                <p>Emergency contact: {schedule.projectInfo.emergencyContact}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-500">
                Project details will be added soon.
              </p>
            )}
          </GlassCard>
        </section>
      </div>
    </PageShell>
  );
}
