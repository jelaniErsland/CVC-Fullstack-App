import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import {
  getProjectById,
  getUpcomingVolunteerAssignments,
  getVolunteerById,
  getVolunteerAssignments,
  volunteers,
} from "@/lib/mockData";
import type { VolunteerAssignment } from "@/lib/mockData";

type AdminVolunteerProfilePageProps = {
  params: Promise<{
    volunteerId: string;
  }>;
};

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-white/80 bg-white/64 px-3 py-1 text-xs font-semibold text-slate-600"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function UpcomingAssignmentCard({
  assignment,
}: {
  assignment: VolunteerAssignment;
}) {
  const project = getProjectById(assignment.projectId);

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{assignment.date}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            {assignment.role}
          </h3>
        </div>
        <StatusPill status={assignment.status} />
      </div>
      <div className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
        <p>{assignment.time}</p>
        <p>{project?.name ?? "Project TBD"}</p>
        <p>
          {assignment.crew} - {assignment.location}
        </p>
      </div>
    </GlassCard>
  );
}

export function generateStaticParams() {
  return volunteers.map((volunteer) => ({
    volunteerId: volunteer.id,
  }));
}

export default async function AdminVolunteerProfilePage({
  params,
}: AdminVolunteerProfilePageProps) {
  const { volunteerId } = await params;
  const volunteer = getVolunteerById(volunteerId);

  if (!volunteer) {
    notFound();
  }

  const upcomingAssignments = getUpcomingVolunteerAssignments(volunteer.id);
  const assignmentTotal = getVolunteerAssignments(volunteer.id).length;
  const stats = [
    { label: "Confirmed", value: volunteer.assignmentCounts.confirmed },
    { label: "Pending", value: volunteer.assignmentCounts.pending },
    { label: "Denied", value: volunteer.assignmentCounts.denied },
    { label: "Records", value: assignmentTotal },
  ];

  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <AdminNav active="volunteers" />
          </GlassCard>
        </aside>

        <div className="py-4">
          <header>
            <Link
              href="/admin/volunteers"
              className="text-sm font-medium text-slate-500 hover:text-slate-950"
            >
              Volunteers
            </Link>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Volunteer Profile
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {volunteer.name}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              {volunteer.congregation} congregation volunteer with mock contact,
              skills, and assignment context.
            </p>
          </header>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <GlassCard key={stat.label} className="p-5">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                  {stat.value}
                </p>
              </GlassCard>
            ))}
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Contact Info
              </h2>
              <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
                <a className="break-words hover:text-slate-950" href={`mailto:${volunteer.email}`}>
                  {volunteer.email}
                </a>
                <a className="hover:text-slate-950" href={`tel:${volunteer.phone}`}>
                  {volunteer.phone}
                </a>
                <p>{volunteer.congregation} Congregation</p>
              </div>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Skills and Tags
              </h2>
              <div className="mt-5 grid gap-4">
                <TagList items={volunteer.roles} />
                <TagList items={volunteer.skills} />
                <TagList items={volunteer.tags} />
              </div>
            </GlassCard>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Upcoming Assignments
            </h2>
            {upcomingAssignments.length > 0 ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {upcomingAssignments.map((assignment) => (
                  <UpcomingAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="No upcoming assignments"
                  message="This volunteer has no upcoming mock assignments yet."
                />
              </div>
            )}
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-3">
            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Past and Denied History
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Placeholder for completed, declined, and denied assignment history.
              </p>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Notes
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Placeholder for private admin notes and volunteer preferences.
              </p>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Communication Log
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Placeholder for future calls, texts, emails, and reminder activity.
              </p>
            </GlassCard>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
