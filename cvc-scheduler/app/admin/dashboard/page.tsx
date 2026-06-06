import Link from "next/link";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";

const workdays = [
  ["Mon, Jan 12", "36 volunteers", "Framing and electrical rough-in"],
  ["Wed, Jan 14", "28 volunteers", "Material staging and drywall prep"],
  ["Sat, Jan 17", "44 volunteers", "Cleanup and inspection prep"],
];

const activity = [
  "Alex R. confirmed Interior framing support",
  "Mia T. requested a Saturday shift swap",
  "Lunch schedule updated for Jan 14",
  "Three reminder emails queued as placeholders",
];

export default function AdminDashboardPage() {
  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <nav className="mt-6 grid gap-2 text-sm font-medium text-slate-600">
              <Link className="rounded-lg bg-white/58 px-3 py-2 text-slate-950" href="/admin/dashboard">
                Dashboard
              </Link>
              <span className="rounded-lg px-3 py-2">Projects</span>
              <span className="rounded-lg px-3 py-2">Volunteers</span>
              <span className="rounded-lg px-3 py-2">Messages</span>
            </nav>
          </GlassCard>
        </aside>

        <div className="py-4">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Admin Dashboard
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Belgrade Major Remodel
              </h1>
            </div>
            <StatusPill status="Open" />
          </header>

          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <GlassCard className="p-5">
              <p className="text-sm font-medium text-slate-500">Upcoming workdays</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">3</p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-sm font-medium text-slate-500">Needs attention</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">7</p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-sm font-medium text-slate-500">Confirmation percentage</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">82%</p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-sm font-medium text-slate-500">Pending confirmations</p>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">19</p>
            </GlassCard>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Upcoming Workdays
              </h2>
              <div className="mt-5 grid gap-3">
                {workdays.map(([date, count, focus]) => (
                  <GlassCard key={date} className="p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold text-slate-950">{date}</p>
                      <p className="text-sm font-medium text-slate-500">{count}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{focus}</p>
                  </GlassCard>
                ))}
              </div>
            </div>

            <GlassCard className="p-5">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Needs Attention
              </h2>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                <p>5 volunteers have not confirmed Saturday assignments.</p>
                <p>2 lunch counts need coordinator review.</p>
                <p>One workday is close to the requested crew limit.</p>
              </div>
            </GlassCard>
          </section>

          <section className="mt-4">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Recent Activity
            </h2>
            <div className="mt-5 grid gap-3">
              {activity.map((item) => (
                <GlassCard key={item} className="px-4 py-3">
                  <p className="text-sm text-slate-600">{item}</p>
                </GlassCard>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
