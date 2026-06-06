import Link from "next/link";
import { AssignmentCard } from "@/components/AssignmentCard";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";

const assignments = [
  {
    date: "Monday, Jan 12",
    time: "7:30 AM - 3:30 PM",
    role: "Interior framing support",
    crew: "Crew B with Marcus L.",
    location: "Main hall, north wing",
    status: "Confirmed" as const,
  },
  {
    date: "Wednesday, Jan 14",
    time: "8:00 AM - 2:00 PM",
    role: "Material staging",
    crew: "Logistics team",
    location: "West entrance",
    status: "Pending" as const,
  },
  {
    date: "Saturday, Jan 17",
    time: "9:00 AM - 1:00 PM",
    role: "Final cleanup",
    crew: "Family volunteer group",
    location: "Fellowship area",
    status: "Needs reply" as const,
  },
];

export default function VolunteerDemoPage() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-950">
            CVC Scheduler
          </Link>
          <Button variant="secondary">Add all to calendar</Button>
        </header>

        <section className="py-8 sm:py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Belgrade Major Remodel 2026
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                Hi, Alex.
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Here is your upcoming volunteer schedule and the latest project
                notes from the coordination team.
              </p>
            </div>
            <StatusPill status="Confirmed" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {assignments.map((assignment) => (
            <AssignmentCard key={`${assignment.date}-${assignment.role}`} {...assignment} />
          ))}
        </section>

        <section className="grid gap-4 py-6 lg:grid-cols-3">
          <GlassCard className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Lunch Schedule
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
              <p>Monday: Sandwich bar at 12:00 PM in the break area.</p>
              <p>Wednesday: Soup and salad from 11:45 AM to 12:30 PM.</p>
              <p>Saturday: Light lunch after cleanup for all volunteers.</p>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Announcements
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
              <p>Parking has moved to the east lot for weekday crews.</p>
              <p>Please bring gloves and closed-toe shoes for staging shifts.</p>
              <p>Check in with the front desk before entering work areas.</p>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Project Info
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
              <p>Coordinator: Jordan M.</p>
              <p>Site address: 1290 Frontage Road, Belgrade, MT</p>
              <p>Emergency contact: posted at the volunteer check-in desk.</p>
            </div>
          </GlassCard>
        </section>
      </div>
    </PageShell>
  );
}
