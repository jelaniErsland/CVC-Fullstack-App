"use client";

import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Home,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { demoProjectId, getProjectById } from "@/lib/mockData";

export type AdminNavActive =
  | "projects"
  | "overview"
  | "calendar"
  | "tasks"
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
  onNavigate?: () => void;
};

const navItems: Array<{
  id: AdminNavActive;
  icon: LucideIcon;
  label: string;
  href: string;
}> = [
  { id: "overview", icon: Home, label: "Overview", href: "/admin/dashboard" },
  {
    id: "calendar",
    icon: CalendarDays,
    label: "Calendar",
    href: "/admin/calendar",
  },
  { id: "tasks", icon: ClipboardList, label: "Tasks", href: "/admin/tasks" },
  { id: "volunteers", icon: Users, label: "Volunteers", href: "/admin/volunteers" },
  {
    id: "announcements",
    icon: MessageSquare,
    label: "Communications",
    href: "/admin/announcements",
  },
  { id: "settings", icon: Settings, label: "Settings", href: "/admin/settings" },
];

export function AdminNav({
  active = "overview",
  projectId = demoProjectId,
  onNavigate,
}: AdminNavProps) {
  const project = getProjectById(projectId);

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
              onClick={onNavigate}
            >
              Switch
            </Link>
          </div>
        </div>
      ) : null}

      <nav className="mt-3 grid gap-1 text-sm font-medium text-slate-600">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              className={[
                "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 transition hover:border-white/80 hover:bg-white/58 hover:text-slate-950",
                active === item.id
                  ? "border-white/85 bg-white/72 text-slate-950 shadow-sm"
                  : "border-transparent",
              ].join(" ")}
              href={item.href}
              onClick={onNavigate}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
