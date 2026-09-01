"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Eye,
  FileQuestion,
  Home,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  Settings,
  Shield,
  Soup,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import type { AdminNavActive } from "@/components/AdminNav";
import { AdminNavigationPendingIndicator } from "@/components/AdminNavigationPendingIndicator";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { ProjectLocalBrand } from "@/components/ProjectLocalBrand";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import { demoProjectId, getProjectById } from "@/lib/mockData";

type AdminShellProps = {
  active: AdminNavActive;
  children: ReactNode;
  onMobileMoreClose?: () => void;
  onMobileMoreOpen?: () => void;
  projectId?: string;
  workspaceName?: string;
};

const closeMobileNavigationEvent = "cvc:close-admin-mobile-navigation";

function AdminBrand() {
  return (
    <Link
      aria-label="Project Local home"
      href="/"
      className="inline-flex rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <ProjectLocalBrand />
    </Link>
  );
}

type PrimaryMobileTab = {
  id: "overview" | "tasks" | "calendar" | "needs-attention";
  label: string;
  ariaLabel?: string;
  href: string;
  icon: LucideIcon;
};

const primaryMobileTabs: PrimaryMobileTab[] = [
  { id: "overview", label: "Overview", href: "/admin/dashboard", icon: Home },
  { id: "tasks", label: "Tasks", href: "/admin/tasks", icon: ClipboardList },
  { id: "calendar", label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
  {
    id: "needs-attention",
    label: "Attention",
    ariaLabel: "Open Needs Attention",
    href: "/admin/needs-attention",
    icon: Bell,
  },
];

type MoreLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  note?: string;
};

const moreGroups: Array<{
  title: string;
  links: MoreLink[];
}> = [
  {
    title: "Communications",
    links: [
      { label: "Communications", href: "/admin/announcements", icon: MessageSquare },
      {
        label: "Reminder templates",
        href: "/admin/announcements/templates",
        icon: Bell,
      },
    ],
  },
  {
    title: "People & follow-up",
    links: [
      { label: "Volunteers", href: "/admin/volunteers", icon: Users },
      { label: "Questionnaires", href: "/admin/questionnaires", icon: FileQuestion },
    ],
  },
  {
    title: "Workspace",
    links: [
      { label: "Project Quick View", href: "/admin/quick-view", icon: Eye },
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Project Workspaces", href: "/admin/projects", icon: LayoutGrid, note: "Preview" },
    ],
  },
  {
    title: "Prototype / legacy",
    links: [
      { label: "Legacy Schedule", href: "/admin/schedule", icon: CalendarDays, note: "Legacy" },
      { label: "Food prototype", href: "/admin/food", icon: Soup, note: "Prototype" },
      { label: "Security prototype", href: "/admin/security", icon: Shield, note: "Prototype" },
    ],
  },
];

const primaryMobileTabIds = new Set<AdminNavActive>([
  "overview",
  "tasks",
  "calendar",
  "needs-attention",
]);

function MobileBottomNav({
  active,
  isMoreOpen,
  moreButtonRef,
  onMoreClick,
}: {
  active: AdminNavActive;
  isMoreOpen: boolean;
  moreButtonRef: Ref<HTMLButtonElement>;
  onMoreClick: () => void;
}) {
  const isMoreActive = !primaryMobileTabIds.has(active);

  return (
    <nav
      aria-label="Primary admin navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--pl-border)] bg-white/96 px-2 pb-[calc(env(safe-area-inset-bottom)+5px)] pt-1.5 shadow-[0_-8px_24px_rgba(32,68,122,0.08)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-center gap-0.5">
        {primaryMobileTabs.slice(0, 2).map((tab) => (
          <MobileTabLink active={active === tab.id} key={tab.id} tab={tab} />
        ))}
        <MobileTabLink
          active={active === "calendar"}
          tab={primaryMobileTabs[2]}
        />
        <MobileTabLink
          active={active === "needs-attention"}
          tab={primaryMobileTabs[3]}
        />
        <button
          aria-controls="mobile-more-navigation"
          aria-expanded={isMoreOpen}
          aria-haspopup="dialog"
          aria-label="Open more admin navigation"
          className={[
            "flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            isMoreActive
              ? "text-[var(--pl-blue)]"
              : "text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]",
          ].join(" ")}
          onClick={onMoreClick}
          ref={moreButtonRef}
          type="button"
        >
          <span className={isMoreActive ? "flex size-7 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)]" : "flex size-7 items-center justify-center"}>
            <MoreHorizontal aria-hidden="true" className="h-[19px] w-[19px]" />
          </span>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

function MobileTabLink({
  active,
  tab,
}: {
  active: boolean;
  tab: PrimaryMobileTab;
}) {
  const Icon = tab.icon;

  return (
    <Link
      aria-label={tab.ariaLabel ?? `Open ${tab.label}`}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        active
          ? "text-[var(--pl-blue)]"
          : "text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]",
      ].join(" ")}
      href={tab.href}
    >
      <span className={active ? "flex size-7 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)]" : "flex size-7 items-center justify-center"}>
        <Icon aria-hidden="true" className="h-[19px] w-[19px]" />
      </span>
      <span>{tab.label}</span>
      <AdminNavigationPendingIndicator compact disabled={active} />
    </Link>
  );
}

function MobileMoreSheet({
  active,
  closeButtonRef,
  dialogRef,
  isOpen,
  onClose,
}: {
  active: AdminNavActive;
  closeButtonRef: Ref<HTMLButtonElement>;
  dialogRef: Ref<HTMLElement>;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-30 lg:hidden"
    >
      <button
        aria-label="Close more navigation backdrop"
        className="absolute inset-0 h-full w-full bg-slate-950/22"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-describedby="mobile-more-navigation-description"
        aria-label="More admin navigation"
        aria-modal="true"
        className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] px-3 pb-2"
        id="mobile-more-navigation"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <GlassCard className="mx-auto flex max-h-[70dvh] max-w-md flex-col overflow-hidden rounded-2xl p-0 shadow-[0_-20px_80px_rgba(15,23,42,0.24)]">
          <p className="sr-only" id="mobile-more-navigation-description">
            Additional admin destinations for communications, follow-up, workspace,
            and prototype tools.
          </p>
          <div className="shrink-0 px-4 pb-3 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                More
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                Admin places
              </h2>
            </div>
            <button
              aria-label="Close more admin navigation"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/80 bg-white/72 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4"
            data-overlay-scroll="mobile-more"
          >
            <div className="grid gap-4">
            {moreGroups.map((group) => (
              <div key={group.title}>
                <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {group.title}
                </p>
                <div className="mt-2 grid gap-2">
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    const isActive =
                      active === getActiveIdForMoreHref(link.href) ||
                      (active === "announcements" &&
                        link.href === "/admin/announcements");

                    return (
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          isActive
                            ? "border-slate-200 bg-white text-slate-950 shadow-sm"
                            : "border-white/70 bg-white/48 text-slate-600 hover:bg-white/76 hover:text-slate-950",
                        ].join(" ")}
                        href={link.href}
                        key={link.href}
                        onClick={onClose}
                      >
                        <Icon
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-slate-400"
                        />
                        <span className="min-w-0 flex-1">{link.label}</span>
                        <AdminNavigationPendingIndicator disabled={isActive} />
                        {link.note ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
                            {link.note}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          </div>
        </GlassCard>
      </section>
    </div>
  );
}

function getActiveIdForMoreHref(href: string): AdminNavActive | undefined {
  const hrefToActive: Record<string, AdminNavActive> = {
    "/admin/announcements": "announcements",
    "/admin/announcements/templates": "announcements",
    "/admin/settings": "settings",
    "/admin/projects": "projects",
    "/admin/quick-view": "quick-view",
    "/admin/questionnaires": "questionnaires",
    "/admin/needs-attention": "needs-attention",
    "/admin/volunteers": "volunteers",
    "/admin/schedule": "schedule",
    "/admin/food": "food",
    "/admin/security": "security",
  };

  return hrefToActive[href];
}

export function AdminShell({
  active,
  children,
  onMobileMoreClose,
  onMobileMoreOpen,
  projectId = demoProjectId,
  workspaceName,
}: AdminShellProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreDialogRef = useRef<HTMLElement>(null);
  const project = getProjectById(projectId);
  const visibleWorkspaceName = workspaceName ?? project?.name ?? "Admin workspace";

  useFocusContainment(isMoreOpen, mobileMoreDialogRef);
  useBodyScrollLock(isMoreOpen, "(max-width: 1023px)");

  useEffect(() => {
    const closeMobileNavigation = () => {
      setIsMoreOpen(false);
    };

    window.addEventListener(closeMobileNavigationEvent, closeMobileNavigation);

    return () => {
      window.removeEventListener(closeMobileNavigationEvent, closeMobileNavigation);
    };
  }, []);

  const closeMobileMore = useCallback(() => {
    setIsMoreOpen(false);
    onMobileMoreClose?.();

    window.requestAnimationFrame(() => {
      mobileMoreButtonRef.current?.focus();
    });
  }, [onMobileMoreClose]);

  const toggleMobileMore = () => {
    if (isMoreOpen) {
      closeMobileMore();
      return;
    }

    onMobileMoreOpen?.();
    setIsMoreOpen(true);
  };

  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      mobileMoreCloseButtonRef.current?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileMore();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileMore, isMoreOpen]);

  return (
    <PageShell className="bg-[var(--pl-canvas)]">
      <div className="sticky top-0 z-30 border-b border-[var(--pl-border)] bg-white/96 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex min-w-0 max-w-2xl items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectLocalBrand compact />
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[-0.01em] text-[var(--pl-ink)]">
                Project Local
              </p>
              <p className="truncate text-xs font-medium text-[var(--pl-muted)]">
                {visibleWorkspaceName}
              </p>
            </div>
            </div>
          </div>
      </div>

      <div className="grid min-h-screen w-full lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden border-r border-[var(--pl-border)] bg-white lg:block">
            <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-5 py-6">
              <AdminBrand />
              <AdminNav active={active} projectId={projectId} workspaceName={visibleWorkspaceName} />
            </div>
          </aside>

          <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-7 lg:py-6 xl:px-8">
            {children}
            <div aria-hidden="true" className="h-20 lg:hidden" />
          </main>
      </div>

      <MobileBottomNav
        active={active}
        isMoreOpen={isMoreOpen}
        moreButtonRef={mobileMoreButtonRef}
        onMoreClick={toggleMobileMore}
      />
      <MobileMoreSheet
        active={active}
        closeButtonRef={mobileMoreCloseButtonRef}
        dialogRef={mobileMoreDialogRef}
        isOpen={isMoreOpen}
        onClose={closeMobileMore}
      />
    </PageShell>
  );
}
