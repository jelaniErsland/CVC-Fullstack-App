import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { StatusPill } from "@/components/StatusPill";
import {
  getAssignedProjectWorkspace,
  moduleLabels,
  projectHasModule,
} from "@/lib/mockData";
import type { ProjectModule } from "@/lib/mockData";

const workdays = [
  {
    date: "Mon, Jan 12",
    focus: "Interior framing and electrical rough-in",
    volunteers: "36 volunteers",
    href: "/admin/dashboard#schedule",
  },
  {
    date: "Wed, Jan 14",
    focus: "Material staging, food service, drywall prep",
    volunteers: "28 volunteers",
    href: "/admin/dashboard#schedule",
  },
  {
    date: "Fri, Jan 16",
    focus: "Evening site check and security coverage",
    volunteers: "12 volunteers",
    href: "/admin/dashboard#security",
  },
  {
    date: "Sat, Jan 17",
    focus: "Cleanup, touchups, inspection prep",
    volunteers: "44 volunteers",
    href: "/admin/dashboard#schedule",
  },
];

const attentionItems = [
  {
    title: "Saturday confirmations",
    detail: "5 volunteers still need a reply recorded.",
    href: "/admin/dashboard#needs-attention",
  },
  {
    title: "Lunch counts",
    detail: "2 congregation counts need a food contact review.",
    href: "/admin/dashboard#food",
  },
  {
    title: "Security coverage",
    detail: "Friday evening needs one more approved helper.",
    href: "/admin/dashboard#security",
  },
];

type ProjectAreaItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  module?: ProjectModule;
  always?: boolean;
};

const projectAreas: Array<{
  group: string;
  items: ProjectAreaItem[];
}> = [
  {
    group: "People",
    items: [
      {
        id: "volunteers",
        title: "Volunteers",
        description: "Review questionnaires and readiness.",
        href: "/admin/volunteers",
        always: true,
      },
      {
        id: "needs-attention",
        title: "Needs Attention",
        description: "Follow-ups that need a coordinator.",
        href: "/admin/dashboard#needs-attention",
        module: "needsAttention",
      },
    ],
  },
  {
    group: "Schedule",
    items: [
      {
        id: "schedule",
        title: "Schedule",
        description: "Daily volunteer assignments.",
        href: "/admin/dashboard#schedule",
        module: "scheduling",
      },
      {
        id: "conflicts",
        title: "Conflicts",
        description: "Coverage gaps and double-bookings.",
        href: "/admin/dashboard#conflicts",
        module: "conflicts",
      },
    ],
  },
  {
    group: "Support",
    items: [
      {
        id: "food",
        title: "Food",
        description: "Lunches and food-service helpers.",
        href: "/admin/dashboard#food",
        module: "food",
      },
      {
        id: "security",
        title: "Security",
        description: "After-hours coverage and contacts.",
        href: "/admin/dashboard#security",
        module: "security",
      },
      {
        id: "announcements",
        title: "Announcements",
        description: "Updates shown in the volunteer portal.",
        href: "/admin/dashboard#announcements",
        module: "announcements",
      },
    ],
  },
  {
    group: "Setup",
    items: [
      {
        id: "emails",
        title: "Emails",
        description: "Invitation and reminder templates.",
        href: "/admin/dashboard#emails",
        module: "emails",
      },
      {
        id: "settings",
        title: "Settings",
        description: "Project contacts, modules, and lookup.",
        href: "/admin/settings",
        always: true,
      },
    ],
  },
];

const recentUpdates = [
  "Alex R. confirmed Interior framing support.",
  "Mia T. asked about a Saturday shift swap.",
  "Lunch details were updated for Wednesday, Jan 14.",
];

export default function AdminDashboardPage() {
  const workspace = getAssignedProjectWorkspace();
  const project = workspace.project;
  const contacts = workspace.contacts;
  const roles = workspace.roles;

  if (!project) {
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

  const stats = [
    { label: "Volunteers", value: project.stats.volunteers },
    { label: "Assignments", value: project.stats.assignments },
    { label: "Confirmed", value: `${project.stats.confirmedPercent}%` },
    { label: "Pending", value: project.stats.pending },
  ];

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
            <div>
              <header
                id="overview"
                className="flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Project Workspace
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                      {project.name}
                    </h1>
                  </div>
                  <StatusPill status={project.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-sm font-medium text-slate-600">
                  <span>{project.location}</span>
                  <span aria-hidden="true">-</span>
                  <span>{project.dateRange}</span>
                  <span aria-hidden="true">-</span>
                  <span>{project.timezone}</span>
                  <span aria-hidden="true">-</span>
                  <span>{roles.join(", ")}</span>
                </div>
              </header>

              <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat) => (
                  <GlassCard key={stat.label} className="p-4 sm:p-5">
                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                      {stat.value}
                    </p>
                  </GlassCard>
                ))}
              </section>
            </div>

            <GlassCard className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  Project Contacts
                </h2>
                <Link
                  href="/admin/settings"
                  className="text-sm font-semibold text-slate-600 hover:text-slate-950"
                >
                  Edit
                </Link>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                {[
                  ["Owner", contacts?.owner.name],
                  ["Primary CVC", contacts?.primaryCvc],
                  ["CVC Assistant", contacts?.cvcAssistants.join(", ")],
                  ["Food Contact", contacts?.foodContact],
                  ["Security Contact", contacts?.securityContact],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-white/52 px-3 py-3">
                    <p className="font-medium text-slate-500">{label}</p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {value || "Not assigned"}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <GlassCard id="schedule" className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Upcoming Workdays
                </h2>
                <Link
                  href="/admin/dashboard#schedule"
                  className="text-sm font-semibold text-slate-600 hover:text-slate-950"
                >
                  View schedule
                </Link>
              </div>
              <div className="mt-4 grid gap-3">
                {workdays.map((workday) => (
                  <Link
                    key={workday.date}
                    href={workday.href}
                    className="group rounded-lg border border-white/70 bg-white/48 px-4 py-4 transition hover:bg-white/76 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-semibold text-slate-950">{workday.date}</p>
                      <p className="text-sm font-semibold text-slate-500">
                        {workday.volunteers}
                      </p>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <p className="text-sm leading-6 text-slate-600">{workday.focus}</p>
                      <span
                        aria-hidden="true"
                        className="text-lg leading-none text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700"
                      >
                        -&gt;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </GlassCard>

            <GlassCard id="needs-attention" className="p-5">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Needs Attention
              </h2>
              <div className="mt-4 grid gap-3">
                {attentionItems.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="rounded-lg border border-amber-200/70 bg-amber-50/72 px-4 py-4 transition hover:bg-amber-50"
                  >
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{item.detail}</p>
                  </Link>
                ))}
              </div>
            </GlassCard>
          </section>

          <section className="mt-4">
            <GlassCard className="p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Manage Workspace
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                    Workspace Areas
                  </h2>
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  Choose the part of the workspace you need next.
                </p>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {projectAreas.map((group) => (
                  <div key={group.group}>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {group.group}
                    </h3>
                    <div className="mt-3 grid gap-2">
                      {group.items
                        .filter(
                          (item) =>
                            item.always ||
                            (item.module ? projectHasModule(project, item.module) : false),
                        )
                        .map((item) => (
                          <Link
                            key={item.id}
                            id={
                              item.id === "schedule" || item.id === "needs-attention"
                                ? undefined
                                : item.id
                            }
                            href={item.href}
                            className="rounded-lg border border-white/70 bg-white/48 px-4 py-3 transition hover:bg-white/76 hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-950">{item.title}</p>
                                <p className="mt-1 text-sm leading-6 text-slate-600">
                                  {item.description}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
            <GlassCard className="p-5">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Modules
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {project.enabledModules.map((module) => (
                  <span
                    key={module}
                    className="rounded-full border border-white/80 bg-white/58 px-3 py-1.5 text-sm font-medium text-slate-700"
                  >
                    {moduleLabels[module]}
                  </span>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Recent Updates
              </h2>
              <div className="mt-4 grid gap-2">
                {recentUpdates.map((item) => (
                  <p
                    key={item}
                    className="rounded-lg bg-white/42 px-4 py-3 text-sm leading-6 text-slate-600"
                  >
                    {item}
                  </p>
                ))}
              </div>
            </GlassCard>
          </section>
        </main>
      </div>
    </PageShell>
  );
}
