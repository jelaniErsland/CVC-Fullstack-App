"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Eye,
  FolderKanban,
  Home,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminNavigationPendingIndicator } from "@/components/AdminNavigationPendingIndicator";

export type AdminNavActive =
  | "projects"
  | "overview"
  | "calendar"
  | "quick-view"
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
  workspaceName?: string;
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
  {
    id: "needs-attention",
    icon: Bell,
    label: "Needs Attention",
    href: "/admin/needs-attention",
  },
  { id: "quick-view", icon: Eye, label: "Quick View", href: "/admin/quick-view" },
  { id: "volunteers", icon: Users, label: "Volunteers", href: "/admin/volunteers" },
];

export function AdminNav({
  active = "overview",
  workspaceName,
  onNavigate,
}: AdminNavProps) {
  const visibleWorkspaceName = workspaceName ?? "Project workspace";

  return (
    <div className="mt-7 flex min-h-0 flex-1 flex-col">
      <div
        aria-label={`Current project: ${visibleWorkspaceName}`}
        className="flex min-h-[58px] items-center gap-3 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] px-3 py-2.5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--pl-blue)] shadow-sm ring-1 ring-[var(--pl-border)]">
          <FolderKanban aria-hidden="true" className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--pl-muted)]">
            Current project
          </span>
          <span className="mt-0.5 block line-clamp-2 text-[12px] font-semibold leading-4 text-[var(--pl-ink)]">
            {visibleWorkspaceName}
          </span>
        </span>
      </div>

      <nav className="mt-6 grid gap-1 text-sm font-medium text-[var(--pl-text)]">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              aria-current={active === item.id ? "page" : undefined}
              key={item.id}
              className={[
                "flex min-h-[42px] items-center gap-3 rounded-[0.7rem] border border-transparent px-3 py-2 transition",
                active === item.id
                  ? "border-blue-100 bg-[var(--pl-blue-soft)] font-semibold text-[var(--pl-blue)]"
                  : "hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]",
              ].join(" ")}
              href={item.href}
              onClick={onNavigate}
            >
              <span className={[
                "flex size-7 shrink-0 items-center justify-center rounded-lg",
                active === item.id ? "bg-white text-[var(--pl-blue)] shadow-sm" : "text-[var(--pl-muted)]",
              ].join(" ")}>
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span>{item.label}</span>
              <AdminNavigationPendingIndicator disabled={active === item.id} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
