import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import {
  getAssignedProjectWorkspace,
  getCurrentAdminRoleHome,
  getRoleHomeOptions,
} from "@/lib/mockData";
import type { RoleHomeData, RoleHomeFocus, RoleHomeUpdate } from "@/lib/mockData";

function RoleHomeHeader({ home }: { home: RoleHomeData }) {
  return (
    <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            {home.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            {home.title}
          </h1>
        </div>
        <span className="inline-flex w-fit rounded-full border border-white/80 bg-white/62 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {home.role}
        </span>
      </div>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
        {home.subtitle}
      </p>
      {home.congregationScope ? (
        <p className="mt-3 text-sm font-medium text-slate-500">
          Mock scope: {home.congregationScope} congregation
        </p>
      ) : null}
    </header>
  );
}

function MetricStrip({ home }: { home: RoleHomeData }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {home.metrics.map((metric) => (
        <div
          className="rounded-lg border border-white/72 bg-white/54 px-4 py-3"
          key={metric.label}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">{metric.label}</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {metric.value}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{metric.helper}</p>
        </div>
      ))}
    </section>
  );
}

function NextBestAction({ action }: { action: RoleHomeFocus }) {
  const content = (
    <div className="rounded-lg border border-white/72 bg-white/58 px-4 py-4 transition hover:bg-white/78">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {action.label}
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {action.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{action.detail}</p>
        </div>
        {action.href ? (
          <span className="shrink-0 text-sm font-semibold text-slate-700">Open</span>
        ) : null}
      </div>
    </div>
  );

  return action.href ? <Link href={action.href}>{content}</Link> : content;
}

function CompactUpdateList({
  title,
  items,
}: {
  title: string;
  items: RoleHomeUpdate[];
}) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-white/72 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
      </div>
      <div>
        {items.map((item) => {
          const row = (
            <div className="grid gap-1 border-b border-white/72 px-4 py-3 last:border-b-0 transition hover:bg-white/46 sm:grid-cols-[120px_1fr] sm:px-5">
              <p className="text-sm font-semibold text-slate-700">{item.label}</p>
              <p className="text-sm leading-6 text-slate-600">{item.detail}</p>
            </div>
          );

          return item.href ? (
            <Link href={item.href} key={item.id}>
              {row}
            </Link>
          ) : (
            <div key={item.id}>{row}</div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function FocusList({ items }: { items: RoleHomeFocus[] }) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-white/72 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          Coordinator Focus
        </h2>
      </div>
      <div>
        {items.map((item) => {
          const row = (
            <div className="border-b border-white/72 px-4 py-3 last:border-b-0 transition hover:bg-white/46 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {item.label}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
                {item.href ? (
                  <span className="text-sm font-semibold text-slate-600">Open</span>
                ) : null}
              </div>
            </div>
          );

          return item.href ? (
            <Link href={item.href} key={item.title}>
              {row}
            </Link>
          ) : (
            <div key={item.title}>{row}</div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function RolePatternPreview({ homes }: { homes: RoleHomeData[] }) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-white/72 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Role homes
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
              Preview patterns
            </h2>
          </div>
          <p className="text-sm text-slate-500">Mock-only, no permissions yet</p>
        </div>
      </div>
      <div className="divide-y divide-white/72">
        {homes.map((home) => (
          <details className="group" key={home.role}>
            <summary className="grid cursor-pointer list-none gap-2 px-4 py-3 transition hover:bg-white/46 sm:grid-cols-[180px_1fr_auto] sm:items-center sm:px-5">
              <p className="text-sm font-semibold text-slate-950">{home.role}</p>
              <p className="text-sm leading-6 text-slate-600">{home.nextBestAction.title}</p>
              <span className="text-xs font-semibold text-slate-400 group-open:hidden">
                Details
              </span>
              <span className="hidden text-xs font-semibold text-slate-400 group-open:inline">
                Hide
              </span>
            </summary>
            <div className="grid gap-3 bg-white/34 px-4 pb-4 text-sm leading-6 text-slate-600 sm:grid-cols-3 sm:px-5">
              {home.metrics.slice(0, 3).map((metric) => (
                <div
                  className="rounded-lg border border-white/70 bg-white/52 px-3 py-2"
                  key={metric.label}
                >
                  <p className="font-semibold text-slate-950">
                    {metric.value} {metric.label}
                  </p>
                  <p className="text-xs text-slate-500">{metric.helper}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </GlassCard>
  );
}

export default function AdminDashboardPage() {
  const workspace = getAssignedProjectWorkspace();
  const project = workspace.project;
  const roles = workspace.roles;
  const activeHome = getCurrentAdminRoleHome(project?.id);
  const roleHomes = project
    ? getRoleHomeOptions(project.id).filter((home) => home.role !== activeHome?.role)
    : [];

  if (!project || !activeHome) {
    return (
      <PageShell className="flex items-center justify-center">
        <GlassCard className="w-full max-w-lg p-6 text-center sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            No Workspace
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Create your project workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            New CVC admins start by creating a workspace. The real-world project is then attached
            to them as the Project CVC / Owner.
          </p>
          <Button href="/admin/projects/new" className="mt-6">
            Start New Workspace
          </Button>
        </GlassCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <AdminNav active="overview" />
          </GlassCard>
        </aside>

        <main className="py-4">
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <RoleHomeHeader home={activeHome} />
              <MetricStrip home={activeHome} />
            </div>

            <GlassCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Workspace
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                    {project.location}
                  </h2>
                </div>
                <StatusPill status={project.status} />
              </div>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">Dates:</span>{" "}
                  {project.dateRange}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Your roles:</span>{" "}
                  {roles.join(", ")}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Model:</span> Role-aware mock
                  home, no real permissions yet.
                </p>
              </div>
            </GlassCard>
          </div>

          <section className="mt-4">
            <NextBestAction action={activeHome.nextBestAction} />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <CompactUpdateList title="This Week" items={activeHome.weekSnapshot} />
            <FocusList items={activeHome.focusItems} />
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <CompactUpdateList title="Recent Updates" items={activeHome.recentUpdates} />
            <RolePatternPreview homes={roleHomes} />
          </section>
        </main>
      </div>
    </PageShell>
  );
}
