"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileQuestion,
  Home,
  LayoutGrid,
  Menu,
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
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import { demoProjectId, getProjectById } from "@/lib/mockData";

type AdminShellProps = {
  active: AdminNavActive;
  children: ReactNode;
  onMobileMoreClose?: () => void;
  onMobileMoreOpen?: () => void;
  projectId?: string;
};

const closeMobileNavigationEvent = "cvc:close-admin-mobile-navigation";

function AdminBrand() {
  return (
    <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
      CVC Scheduler
    </Link>
  );
}

type PrimaryMobileTab = {
  id: "overview" | "tasks" | "calendar" | "volunteers";
  label: string;
  href: string;
  icon: LucideIcon;
};

const primaryMobileTabs: PrimaryMobileTab[] = [
  { id: "overview", label: "Overview", href: "/admin/dashboard", icon: Home },
  { id: "tasks", label: "Tasks", href: "/admin/tasks", icon: ClipboardList },
  { id: "calendar", label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
  { id: "volunteers", label: "Volunteers", href: "/admin/volunteers", icon: Users },
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
    title: "Follow-up",
    links: [
      { label: "Needs Attention", href: "/admin/needs-attention", icon: Bell },
      { label: "Questionnaires", href: "/admin/questionnaires", icon: FileQuestion },
    ],
  },
  {
    title: "Workspace",
    links: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "Project Workspaces", href: "/admin/projects", icon: LayoutGrid },
    ],
  },
  {
    title: "Prototype / legacy",
    links: [
      { label: "Legacy Schedule", href: "/admin/schedule", icon: CalendarDays },
      { label: "Food prototype", href: "/admin/food", icon: Soup, note: "Prototype" },
      { label: "Security prototype", href: "/admin/security", icon: Shield, note: "Prototype" },
    ],
  },
];

const primaryMobileTabIds = new Set<AdminNavActive>([
  "overview",
  "tasks",
  "calendar",
  "volunteers",
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
  const isMoreActive = isMoreOpen || !primaryMobileTabIds.has(active);

  return (
    <nav
      aria-label="Primary admin navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/80 bg-white/86 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-18px_60px_rgba(15,23,42,0.14)] backdrop-blur-2xl lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">
        {primaryMobileTabs.slice(0, 2).map((tab) => (
          <MobileTabLink active={active === tab.id} key={tab.id} tab={tab} />
        ))}
        <MobileTabLink
          active={active === "calendar"}
          emphasized
          tab={primaryMobileTabs[2]}
        />
        <MobileTabLink
          active={active === "volunteers"}
          tab={primaryMobileTabs[3]}
        />
        <button
          aria-controls="mobile-more-navigation"
          aria-expanded={isMoreOpen}
          aria-haspopup="dialog"
          aria-label="Open more admin navigation"
          className={[
            "flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2",
            isMoreActive
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:bg-white/80 hover:text-slate-950",
          ].join(" ")}
          onClick={onMoreClick}
          ref={moreButtonRef}
          type="button"
        >
          <MoreHorizontal aria-hidden="true" className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

function MobileTabLink({
  active,
  emphasized,
  tab,
}: {
  active: boolean;
  emphasized?: boolean;
  tab: PrimaryMobileTab;
}) {
  const Icon = tab.icon;

  return (
    <Link
      aria-label={`Open ${tab.label}`}
      aria-current={active ? "page" : undefined}
      className={[
        "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2",
        emphasized ? "min-h-[68px] -translate-y-2" : "min-h-[58px]",
        active
          ? emphasized
            ? "bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.22)]"
            : "bg-slate-950 text-white shadow-sm"
          : emphasized
            ? "border border-white/80 bg-white text-slate-900 shadow-[0_10px_26px_rgba(15,23,42,0.16)] hover:bg-white"
            : "text-slate-500 hover:bg-white/80 hover:text-slate-950",
      ].join(" ")}
      href={tab.href}
    >
      <Icon aria-hidden="true" className={emphasized ? "h-6 w-6" : "h-5 w-5"} />
      <span>{tab.label}</span>
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
      className="fixed inset-0 z-50 lg:hidden"
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
        className="absolute inset-x-0 bottom-0 px-3 pb-[calc(env(safe-area-inset-bottom)+96px)]"
        id="mobile-more-navigation"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <GlassCard className="mx-auto max-h-[calc(100vh-126px)] max-w-md overflow-y-auto rounded-2xl p-4 shadow-[0_-20px_80px_rgba(15,23,42,0.24)]">
          <p className="sr-only" id="mobile-more-navigation-description">
            Additional admin destinations for communications, follow-up, workspace,
            and prototype tools.
          </p>
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

          <div className="mt-4 grid gap-4">
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
    "/admin/questionnaires": "questionnaires",
    "/admin/needs-attention": "needs-attention",
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
}: AdminShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreDialogRef = useRef<HTMLElement>(null);
  const project = getProjectById(projectId);

  useFocusContainment(isMoreOpen, mobileMoreDialogRef);

  useEffect(() => {
    const closeMobileNavigation = () => {
      setIsDrawerOpen(false);
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

  const openMobileMore = () => {
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
    <PageShell>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-4 lg:hidden">
          <GlassCard className="p-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Workspace
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                  {project?.name ?? "Admin workspace"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden rounded-full border border-white/80 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-500 xs:inline-flex">
                  Bottom tabs
                </span>
                <button
                  aria-label="Open navigation menu"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/80 bg-white/72 text-slate-700 shadow-sm transition hover:bg-white"
                  onClick={() => setIsDrawerOpen(true)}
                  type="button"
                >
                  <Menu aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="grid min-h-[calc(100vh-40px)] w-full gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block lg:py-4">
            <GlassCard className="p-4 lg:sticky lg:top-6">
              <AdminBrand />
              <AdminNav active={active} projectId={projectId} />
            </GlassCard>
          </aside>

          <main className="min-w-0 py-4 lg:py-4">
            {children}
            <div aria-hidden="true" className="h-28 lg:hidden" />
          </main>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation drawer backdrop"
            className="absolute inset-0 h-full w-full bg-slate-950/24"
            onClick={() => setIsDrawerOpen(false)}
            type="button"
          />
          <div className="absolute inset-y-0 left-0 w-[min(320px,calc(100vw-28px))] p-3">
            <GlassCard className="flex h-full flex-col overflow-y-auto p-4 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <AdminBrand />
                <button
                  aria-label="Close admin navigation"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 text-sm font-semibold text-slate-700"
                  onClick={() => setIsDrawerOpen(false)}
                  type="button"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                  Close
                </button>
              </div>
              <AdminNav
                active={active}
                onNavigate={() => setIsDrawerOpen(false)}
                projectId={projectId}
              />
            </GlassCard>
          </div>
        </div>
      ) : null}

      <MobileBottomNav
        active={active}
        isMoreOpen={isMoreOpen}
        moreButtonRef={mobileMoreButtonRef}
        onMoreClick={openMobileMore}
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
