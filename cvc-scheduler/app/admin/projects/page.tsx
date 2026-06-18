import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import {
  currentMockUser,
  demoProjectId,
  getCurrentAdminProjectAssignments,
  summarizeModules,
} from "@/lib/mockData";
import type { Project } from "@/lib/mockData";

function ProjectCard({
  project,
  roles,
}: {
  project: Project;
  roles: string[];
}) {
  const isArchived = project.status === "archived";
  const openHref =
    project.status === "active" && project.id === demoProjectId
      ? "/admin/dashboard"
      : `/admin/projects/${project.id}`;

  return (
    <GlassCard
      className={[
        "flex h-full flex-col p-5 transition duration-200 sm:p-6",
        isArchived ? "opacity-72" : "hover:-translate-y-0.5 hover:bg-white/72",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{project.location}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {project.name}
          </h2>
        </div>
        <StatusPill status={project.status} />
      </div>

      <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
        <p>
          <span className="font-medium text-slate-800">Your role:</span>{" "}
          {roles.join(", ")}
        </p>
        <p>
          <span className="font-medium text-slate-800">Dates:</span> {project.dateRange}
        </p>
        <p>
          <span className="font-medium text-slate-800">Modules:</span>{" "}
          {summarizeModules(project.enabledModules)}
        </p>
        <p>
          <span className="font-medium text-slate-800">Updated:</span>{" "}
          {project.lastUpdatedAt}
        </p>
        <p>
          <span className="font-medium text-slate-800">Last used:</span>{" "}
          {project.lastUsedAt}
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button href={openHref} className="w-full">
          Open Workspace
        </Button>
        {project.status === "draft" ? (
          <Button href="/admin/projects/new" variant="secondary" className="w-full">
            Continue Setup
          </Button>
        ) : null}
      </div>
    </GlassCard>
  );
}

export default function AdminProjectsPage() {
  const assignments = getCurrentAdminProjectAssignments();

  return (
    <AdminShell active="projects">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Assigned Workspaces
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Project Workspaces
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            These are the workspaces assigned to {currentMockUser.name}. Each one
            centers one real-world CVC project. Drafts stay visible to their owner,
            while archived workspaces remain
            readable without cluttering the active work.
          </p>
        </div>
        <Button href="/admin/projects/new" className="w-full sm:w-auto">
          Start New Workspace
        </Button>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assignments.map((assignment) => (
          <ProjectCard
            key={assignment.project.id}
            project={assignment.project}
            roles={assignment.roles}
          />
        ))}
      </section>
    </AdminShell>
  );
}
