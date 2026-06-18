import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { AdminSectionCard } from "@/components/AdminSectionCard";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import {
  demoProjectId,
  getCurrentAdminRolesForProject,
  getModuleLabel,
  getProjectById,
  projects,
} from "@/lib/mockData";

type AdminProjectDetailPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

const moduleDescriptions = {
  volunteers: "Questionnaires, approvals, congregation details, skills, and availability.",
  scheduling: "Workdays, crews, assignments, and confirmation tools.",
  food: "Food contacts, meal counts, lunch notes, and serving windows.",
  security: "After-hours coverage, security contacts, and site-watch notes.",
  announcements: "Project updates for volunteer portals and future reminders.",
  emails: "Invitation, confirmation, reminder, and direct-link templates.",
  needsAttention: "Follow-ups that need a coordinator's review.",
  conflicts: "Coverage gaps, double-bookings, and unresolved assignment concerns.",
};

export function generateStaticParams() {
  return projects.map((project) => ({
    projectId: project.id,
  }));
}

export default async function AdminProjectDetailPage({
  params,
}: AdminProjectDetailPageProps) {
  const { projectId } = await params;
  const project = getProjectById(projectId);

  if (!project) {
    notFound();
  }

  const roles = getCurrentAdminRolesForProject(project.id);
  const canOpenWorkspace = project.status === "active" && project.id === demoProjectId;

  return (
    <AdminShell active="projects" projectId={project.id}>
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Link
                href="/admin/projects"
                className="text-sm font-medium text-slate-500 hover:text-slate-950"
              >
                Workspaces
              </Link>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  {project.name}
                </h1>
                <StatusPill status={project.status} />
              </div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                {project.location} - {project.projectType}. {project.description}
              </p>
            </div>
            {canOpenWorkspace ? (
              <Button href="/admin/dashboard" className="w-full sm:w-auto">
                Open Workspace
              </Button>
            ) : project.status === "draft" ? (
              <Button href="/admin/projects/new" className="w-full sm:w-auto">
                Continue Setup
              </Button>
            ) : null}
          </header>

          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <GlassCard className="p-5">
              <p className="text-sm font-medium text-slate-500">Date range</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {project.dateRange}
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-sm font-medium text-slate-500">Working days</p>
              <p className="mt-3 text-lg font-semibold leading-7 text-slate-950">
                {project.workingDays.join(", ")}
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-sm font-medium text-slate-500">Your role</p>
              <p className="mt-3 text-lg font-semibold leading-7 text-slate-950">
                {roles.join(", ") || "Viewer"}
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-sm font-medium text-slate-500">Last used</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {project.lastUsedAt}
              </p>
            </GlassCard>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {project.enabledModules.map((module) => (
              <AdminSectionCard
                key={module}
                title={getModuleLabel(module)}
                description={moduleDescriptions[module]}
              />
            ))}
          </section>
    </AdminShell>
  );
}
