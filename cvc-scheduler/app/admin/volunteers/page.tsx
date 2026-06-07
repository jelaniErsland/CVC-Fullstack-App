import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { VolunteerDirectory } from "@/components/VolunteerDirectory";
import { getCongregations, volunteers } from "@/lib/mockData";

export default function AdminVolunteersPage() {
  const congregations = getCongregations();
  const totals = volunteers.reduce(
    (sum, volunteer) => ({
      confirmed: sum.confirmed + volunteer.assignmentCounts.confirmed,
      pending: sum.pending + volunteer.assignmentCounts.pending,
      denied: sum.denied + volunteer.assignmentCounts.denied,
    }),
    { confirmed: 0, pending: 0, denied: 0 },
  );
  const stats = [
    { label: "Volunteers", value: volunteers.length },
    { label: "Congregations", value: congregations.length },
    { label: "Confirmed", value: totals.confirmed },
    { label: "Pending", value: totals.pending },
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Volunteer Management
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Volunteers
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Search the mock roster by contact details or congregation, review skills,
              and open each profile for assignment context.
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

          <section className="mt-6">
            <VolunteerDirectory
              congregations={congregations}
              volunteers={volunteers}
            />
          </section>
        </div>
      </div>
    </PageShell>
  );
}
