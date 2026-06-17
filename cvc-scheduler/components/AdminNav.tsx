import Link from "next/link";
import { demoProjectId, getProjectById, projectHasModule } from "@/lib/mockData";
import type { ProjectModule } from "@/lib/mockData";

type AdminNavActive =
  | "projects"
  | "overview"
  | "volunteers"
  | "questionnaires"
  | "schedule"
  | "food"
  | "security"
  | "announcements"
  | "emails"
  | "needs-attention"
  | "conflicts"
  | "settings";

type AdminNavProps = {
  active?: AdminNavActive;
  projectId?: string;
};

const navItems: Array<{
  id: AdminNavActive;
  label: string;
  href: string;
  module?: ProjectModule;
  always?: boolean;
}> = [
  { id: "overview", label: "Overview", href: "/admin/dashboard", always: true },
  { id: "volunteers", label: "Volunteers", href: "/admin/volunteers", always: true },
  {
    id: "questionnaires",
    label: "Questionnaires",
    href: "/admin/questionnaires",
    always: true,
  },
  {
    id: "schedule",
    label: "Schedule",
    href: "/admin/schedule",
    module: "scheduling",
  },
  { id: "food", label: "Food", href: "/admin/dashboard#food", module: "food" },
  {
    id: "security",
    label: "Security",
    href: "/admin/dashboard#security",
    module: "security",
  },
  {
    id: "announcements",
    label: "Announcements",
    href: "/admin/dashboard#announcements",
    module: "announcements",
  },
  { id: "emails", label: "Emails", href: "/admin/dashboard#emails", module: "emails" },
  {
    id: "needs-attention",
    label: "Needs Attention",
    href: "/admin/needs-attention",
    module: "needsAttention",
  },
  {
    id: "conflicts",
    label: "Conflicts",
    href: "/admin/dashboard#conflicts",
    module: "conflicts",
  },
  { id: "settings", label: "Settings", href: "/admin/settings", always: true },
];

export function AdminNav({ active = "overview", projectId = demoProjectId }: AdminNavProps) {
  const project = getProjectById(projectId);
  const visibleItems = navItems.filter(
    (item) => item.always || (item.module ? projectHasModule(project, item.module) : false),
  );

  return (
    <div className="mt-5">
      {project ? (
        <div className="rounded-lg border border-white/70 bg-white/54 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Workspace
          </p>
          <p className="mt-2 text-sm font-semibold leading-5 text-slate-950">
            {project.name}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
            <span className="capitalize">{project.status}</span>
            <Link
              href="/admin/projects"
              className="inline-flex min-h-10 items-center rounded-full px-3 py-1.5 hover:bg-white/56 hover:text-slate-950"
            >
              Switch
            </Link>
          </div>
        </div>
      ) : null}

      <Link
        href="/admin/projects"
        className={[
          "mt-3 flex min-h-11 items-center rounded-lg border px-3 py-2 text-sm font-medium transition hover:border-white/80 hover:bg-white/58 hover:text-slate-950",
          active === "projects"
            ? "border-white/85 bg-white/72 text-slate-950 shadow-sm"
            : "border-transparent text-slate-600",
        ].join(" ")}
      >
        Switch Workspace
      </Link>

      <nav className="mt-2 grid gap-1 text-sm font-medium text-slate-600">
        {visibleItems.map((item) => (
          <Link
            key={item.id}
            className={[
              "flex min-h-11 items-center rounded-lg border px-3 py-2 transition hover:border-white/80 hover:bg-white/58 hover:text-slate-950",
              active === item.id
                ? "border-white/85 bg-white/72 text-slate-950 shadow-sm"
                : "border-transparent",
            ].join(" ")}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
