"use client";

import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Eye,
  FolderKanban,
  Home,
  Mail,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminNavigationPendingIndicator } from "@/components/AdminNavigationPendingIndicator";
import { NeedsAttentionUnseenBadge } from "@/components/NeedsAttentionUnseenBadge";
import { ldcProjectName } from "@/lib/projectIdentity";

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
  destinations?: readonly string[];
};

const navItems: Array<{
  id: AdminNavActive;
  icon: LucideIcon;
  label: string;
  href: string;
}> = [
  { id: "overview", icon: Home, label: "Overview", href: "/admin/dashboard" },
  { id: "calendar", icon: CalendarDays, label: "Calendar", href: "/admin/calendar" },
  { id: "volunteers", icon: Users, label: "Volunteers", href: "/admin/volunteers" },
  { id: "needs-attention", icon: Bell, label: "Attention", href: "/admin/needs-attention" },
  { id: "tasks", icon: ClipboardList, label: "Task library", href: "/admin/tasks" },
  { id: "announcements", icon: Mail, label: "Communications", href: "/admin/announcements" },
  { id: "quick-view", icon: Eye, label: "Quick View", href: "/admin/quick-view" },
];

export function AdminNav({
  active = "overview",
  workspaceName,
  onNavigate,
  destinations,
}: AdminNavProps) {
  const visibleWorkspaceName = ldcProjectName(workspaceName);

  return (
    <div className="mt-6 flex min-h-0 flex-1 flex-col">
      <div
        aria-label={`Current project: ${visibleWorkspaceName}`}
        className="flex min-h-[58px] min-w-0 shrink-0 items-start gap-2 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] px-2 py-2.5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--pl-blue)] shadow-sm ring-1 ring-[var(--pl-border)]">
          <FolderKanban aria-hidden="true" className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-[var(--pl-muted)]">
            Current project
          </span>
          <span className="mt-0.5 block break-words [overflow-wrap:anywhere] text-sm font-semibold leading-tight text-[var(--pl-ink)]">
            {visibleWorkspaceName}
          </span>
        </span>
      </div>

      <nav aria-label="Workspace navigation" className="mt-6 grid min-w-0 gap-1 text-sm font-medium text-[var(--pl-text)]">
        {navItems.filter(item => !destinations || destinations.includes(item.id)).map((item) => {
          const Icon = item.icon;

          return (
            <Link
              aria-current={active === item.id ? "page" : undefined}
              key={item.id}
              className={[
                `${["tasks"].includes(item.id) ? "mt-5" : ""} flex min-h-11 min-w-0 items-center gap-2 rounded-[0.7rem] border border-transparent px-3 py-2 transition`,
                active === item.id
                  ? "border-blue-100 bg-[var(--pl-blue-soft)] font-semibold text-[var(--pl-blue)]"
                  : "hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]",
              ].join(" ")}
              href={item.href}
              onClick={onNavigate}
            >
              <span className={[
                "flex size-5 shrink-0 items-center justify-center rounded-lg",
                active === item.id ? "text-[var(--pl-blue)]" : "text-[var(--pl-muted)]",
              ].join(" ")}>
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="min-w-0 flex-1 break-words">{item.label}</span>
              {item.id === "needs-attention" ? <NeedsAttentionUnseenBadge /> : null}
              <AdminNavigationPendingIndicator disabled={active === item.id} />
            </Link>
          );
        })}
      </nav>
      <Link
        className="mt-5 flex min-h-[42px] items-center gap-2 rounded-[0.7rem] border border-transparent px-3 text-sm font-medium text-[var(--pl-muted)] transition hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]"
        href="/guide"
        onClick={onNavigate}
      >
        <span className="flex size-5 shrink-0 items-center justify-center"><BookOpen aria-hidden="true" className="size-[18px]" /></span>
        Contact Guide
      </Link>
    </div>
  );
}
