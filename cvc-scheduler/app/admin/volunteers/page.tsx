import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { VolunteerDirectory } from "@/components/VolunteerDirectory";
import { getCongregations, projectVolunteers } from "@/lib/mockData";

export default function AdminVolunteersPage() {
  const congregations = getCongregations();
  const totals = projectVolunteers.reduce(
    (sum, volunteer) => ({
      pending:
        sum.pending +
        (volunteer.status === "Submitted" || volunteer.status === "Needs Review" ? 1 : 0),
      approved: sum.approved + (volunteer.status === "Approved" ? 1 : 0),
      needsInfo: sum.needsInfo + (volunteer.status === "Needs Info" ? 1 : 0),
    }),
    { pending: 0, approved: 0, needsInfo: 0 },
  );
  const stats = [
    { label: "Questionnaires", value: projectVolunteers.length },
    { label: "Congregations", value: congregations.length },
    { label: "Approved", value: totals.approved },
    { label: "Needs review", value: totals.pending + totals.needsInfo },
  ];

  return (
    <AdminShell active="volunteers">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Current Project
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Project Volunteers
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Review submitted questionnaires, approve volunteers for scheduling,
            and enter paper questionnaires so every willing helper can be included.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="secondary">
            Send Questionnaire Link
          </Button>
          <Button type="button">Enter Paper Questionnaire</Button>
        </div>
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
          volunteers={projectVolunteers}
        />
      </section>
    </AdminShell>
  );
}
