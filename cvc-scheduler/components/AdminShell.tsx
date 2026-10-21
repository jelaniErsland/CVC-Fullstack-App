"use client";

import Link from "next/link";
import {
  BookOpen,
  Bell,
  CalendarDays,
  ClipboardList,
  Eye,
  Home,
  Mail,
  MoreHorizontal,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { AdminCommands, AdminCommandTrigger } from "@/components/AdminCommands";
import type { AdminNavActive } from "@/components/AdminNav";
import { AdminNavigationPendingIndicator } from "@/components/AdminNavigationPendingIndicator";
import { AdminNavigationLink, AdminRouteCommit, AdminRouteCommitContext, AdminRouteHandoffContext, useAdminRouteHandoff } from "@/components/AdminRouteHandoff";
import { AdminRouteLoading } from "@/components/AdminRouteLoading";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { ProjectLocalBrand } from "@/components/ProjectLocalBrand";
import { NeedsAttentionBadgeProvider, NeedsAttentionUnseenBadge } from "@/components/NeedsAttentionUnseenBadge";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import { ldcProjectName } from "@/lib/projectIdentity";
import { useCalendarReturnHref } from "@/lib/adminViews/calendarReturn";

type AdminShellProps = {
  active: AdminNavActive;
  children: ReactNode;
  onMobileMoreClose?: () => void;
  onMobileMoreOpen?: () => void;
  projectId?: string;
  workspaceName?: string;
  destinations?: readonly string[];
  commandCapabilities?: readonly string[];
  calendarWorkspaceKey?: string | null;
  deriveActiveFromPathname?: boolean;
};

type PersistentShellCallbacks = Pick<AdminShellProps, "onMobileMoreOpen" | "onMobileMoreClose">;
const PersistentAdminShellContext = createContext<((callbacks: PersistentShellCallbacks | null) => void) | null>(null);

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
  id: "overview" | "volunteers" | "calendar" | "needs-attention";
  label: string;
  ariaLabel?: string;
  href: string;
  icon: LucideIcon;
};

const primaryMobileTabs: PrimaryMobileTab[] = [
  { id: "overview", label: "Overview", href: "/admin/dashboard", icon: Home },
  { id: "calendar", label: "Calendar", href: "/admin/calendar", icon: CalendarDays },
  { id: "volunteers", label: "Volunteers", href: "/admin/volunteers", icon: Users },
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
    title: "Project tools",
    links: [
      { label: "Project Quick View", href: "/admin/quick-view", icon: Eye },
      { label: "Task library", href: "/admin/tasks", icon: ClipboardList },
      { label: "Communications", href: "/admin/announcements", icon: Mail },
      { label: "Contact Guide", href: "/guide", icon: BookOpen },
    ],
  },
];

const primaryMobileTabIds = new Set<AdminNavActive>([
  "overview",
  "volunteers",
  "calendar",
  "needs-attention",
]);

function MobileBottomNav({
  active,
  isMoreOpen,
  moreButtonRef,
  onMoreClick,
  destinations,
  compact,
  onLayoutChange,
  calendarHref,
}: {
  active: AdminNavActive;
  isMoreOpen: boolean;
  moreButtonRef: Ref<HTMLButtonElement>;
  onMoreClick: () => void;
  destinations?: readonly string[];
  compact: boolean;
  onLayoutChange: () => void;
  calendarHref: string;
}) {
  const isMoreActive = !primaryMobileTabIds.has(active) || (compact && (active === "volunteers" || active === "needs-attention"));
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--admin-mobile-nav-height", `${nav.getBoundingClientRect().height}px`);
      onLayoutChange();
    });
    observer.observe(nav);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--admin-mobile-nav-height"); };
  }, [onLayoutChange]);

  return (
    <nav
      ref={navRef}
      aria-label="Primary admin navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--pl-border)] bg-white px-2 pb-[calc(env(safe-area-inset-bottom)+5px)] pt-1.5   lg:hidden"
    >
      <div className={`mx-auto grid max-w-md items-center gap-0.5 ${compact ? "grid-cols-3" : "grid-cols-[repeat(auto-fit,minmax(3.6rem,1fr))]"}`}>
        {primaryMobileTabs.filter(tab => !compact || tab.id === "overview" || tab.id === "calendar").map(tab => !destinations || destinations.includes(tab.id) ? <MobileTabLink active={active === tab.id} compact={compact} key={tab.id} tab={tab} href={tab.id === "calendar" ? calendarHref : tab.href} /> : <span key={tab.id} />)}
        <button
          aria-controls="mobile-more-navigation"
          aria-expanded={isMoreOpen}
          aria-haspopup="dialog"
          aria-current={isMoreActive ? "page" : undefined}
          aria-label="Open more admin navigation"
          className={[
            "flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            isMoreActive || isMoreOpen
              ? "text-[var(--pl-blue)]"
              : "text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]",
          ].join(" ")}
          onClick={onMoreClick}
          ref={moreButtonRef}
          type="button"
        >
          <span className={isMoreActive || isMoreOpen ? "flex size-7 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)]" : "flex size-7 items-center justify-center"}>
            <MoreHorizontal aria-hidden="true" className="h-[19px] w-[19px]" />
          </span>
          <span className="pl-nav-label text-xs font-semibold leading-none" style={compact ? {fontSize:"0.625rem"} : undefined}>More</span>
        </button>
      </div>
    </nav>
  );
}

function MobileTabLink({
  active,
  compact,
  tab,
  href,
}: {
  active: boolean;
  compact: boolean;
  tab: PrimaryMobileTab;
  href: string;
}) {
  const Icon = tab.icon;

  return (
    <AdminNavigationLink
      aria-label={tab.ariaLabel ?? `Open ${tab.label}`}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        active
          ? "text-[var(--pl-blue)]"
          : "text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]",
      ].join(" ")}
      href={href}
    >
      <span className={active ? "flex size-7 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)]" : "flex size-7 items-center justify-center"}>
        <Icon aria-hidden="true" className="h-[19px] w-[19px]" />
      </span>
      <span className="pl-nav-label text-xs font-semibold leading-none" style={compact ? {fontSize:"0.625rem"} : undefined}>{tab.label}</span>
      {tab.id === "needs-attention" ? <span className="absolute right-1.5 top-1"><NeedsAttentionUnseenBadge /></span> : null}
      <AdminNavigationPendingIndicator compact disabled={active} />
    </AdminNavigationLink>
  );
}

function MobileMoreSheet({
  active,
  closeButtonRef,
  dialogRef,
  isOpen,
  onClose,
  destinations,
  compact,
}: {
  destinations?: readonly string[];
  compact: boolean;
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
        className="absolute inset-x-0 bottom-[var(--admin-mobile-nav-height,80px)] px-3 pb-2"
        id="mobile-more-navigation"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <GlassCard className="mx-auto flex max-h-[min(70dvh,calc(100dvh-var(--admin-mobile-nav-height,80px)-24px))] max-w-md flex-col overflow-hidden rounded-2xl p-0 shadow-[0_-20px_80px_rgba(15,23,42,0.24)]">
          <p className="sr-only" id="mobile-more-navigation-description">
            Supporting workspace destinations and help.
          </p>
          <div className="min-w-0 shrink-0 px-[16px] pb-3 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-200" />
            <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="break-words text-xl font-semibold tracking-tight text-slate-950">
                More
              </h2>
            </div>
            <button
              aria-label="Close more admin navigation"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--pl-border)] bg-white text-[var(--pl-text)]"
              onClick={onClose}
              ref={closeButtonRef}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
            </div>
          </div>

          <div
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-[16px] pb-4"
            data-overlay-scroll="mobile-more"
          >
            <div className="grid min-w-0 gap-4">
            {(compact ? [{title: "Primary destinations", links: [
              {label: "Volunteers", href: "/admin/volunteers", icon: Users},
              {label: "Attention", href: "/admin/needs-attention", icon: Bell},
            ]}, ...moreGroups] : moreGroups).map((group) => (
              <div className="min-w-0" key={group.title}>
                <div className="grid min-w-0 gap-2">
                  {group.links.filter(link => link.href === "/guide" || !destinations || destinations.includes(getActiveIdForMoreHref(link.href) ?? "")).map((link) => {
                    const Icon = link.icon;
                    const isActive =
                      active === getActiveIdForMoreHref(link.href) ||
                      (active === "announcements" &&
                        link.href === "/admin/announcements");

                    return (
                      <AdminNavigationLink
                        aria-current={isActive ? "page" : undefined}
                        className={[
                          "relative flex min-h-12 min-w-0 items-center gap-2 rounded-xl border px-[12px] py-2 text-sm font-semibold transition",
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
                          className="size-[20px] shrink-0 text-[var(--pl-muted)]"
                        />
                        <span className="min-w-0 flex-1 break-words">{link.label}</span>
                        <AdminNavigationPendingIndicator compact disabled={isActive} />
                        {link.note ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
                            {link.note}
                          </span>
                        ) : null}
                      </AdminNavigationLink>
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
    "/admin/quick-view": "quick-view",
    "/admin/tasks": "tasks",
    "/admin/announcements": "announcements",
    "/admin/volunteers": "volunteers",
    "/admin/needs-attention": "needs-attention",
  };

  return hrefToActive[href];
}

function AdminShellFrame({
  active,
  children,
  onMobileMoreClose,
  onMobileMoreOpen,
  workspaceName,
  destinations = ["overview"],
  commandCapabilities = [],
  calendarWorkspaceKey = null,
  deriveActiveFromPathname = false,
}: AdminShellProps) {
  const pathname = usePathname();
  const handoff = useAdminRouteHandoff(deriveActiveFromPathname);
  const committedActive: AdminNavActive = deriveActiveFromPathname
    ? pathname.startsWith("/admin/calendar") ? "calendar"
      : pathname.startsWith("/admin/needs-attention") ? "needs-attention"
      : pathname.startsWith("/admin/announcements") ? "announcements"
      : pathname.startsWith("/admin/volunteers") ? "volunteers"
      : pathname.startsWith("/admin/tasks") ? "tasks"
      : "overview"
    : active;
  const visibleActive = handoff.visible && !handoff.visible.failed ? handoff.visible.destination.route : committedActive;
  const calendarHref = useCalendarReturnHref(calendarWorkspaceKey);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const mobileMoreButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMoreDialogRef = useRef<HTMLElement>(null);
  const visibleWorkspaceName = ldcProjectName(workspaceName);
  const [compactMobileNav, setCompactMobileNav] = useState(false);
  const measureCompactMobileNav = useCallback(() => setCompactMobileNav(window.innerWidth / parseFloat(getComputedStyle(document.documentElement).fontSize) < 14), []);
  useEffect(() => {
    const frame = window.requestAnimationFrame(measureCompactMobileNav);
    window.addEventListener("resize", measureCompactMobileNav);
    const observer = new ResizeObserver(measureCompactMobileNav);
    observer.observe(document.documentElement);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", measureCompactMobileNav); observer.disconnect(); };
  }, [measureCompactMobileNav]);

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

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = () => { if (media.matches && isMoreOpen) closeMobileMore(); };
    media.addEventListener("change", closeAtDesktop);
    return () => media.removeEventListener("change", closeAtDesktop);
  }, [closeMobileMore, isMoreOpen]);

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
    <AdminRouteCommitContext.Provider value={handoff.commit}>
    <AdminRouteHandoffContext.Provider value={deriveActiveFromPathname ? handoff.begin : null}>
    <AdminCommands destinations={destinations} capabilities={commandCapabilities} calendarHref={calendarHref}>
    <NeedsAttentionBadgeProvider enabled={destinations.includes("needs-attention")}>
    <PageShell as="div" className="bg-[var(--pl-canvas)]">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="sticky top-0 z-30 border-b border-[var(--pl-border)] bg-white/96 px-4 py-2.5  lg:hidden">
        <div className="mx-auto flex min-w-0 max-w-2xl items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ProjectLocalBrand compact />
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[-0.01em] text-[var(--pl-ink)]">
                Project Local
              </p>
              <p className="break-words text-xs font-medium text-[var(--pl-muted)]">
                {visibleWorkspaceName}
              </p>
            </div>
            </div>
            <AdminCommandTrigger compact />
          </div>
      </div>

      <div className="grid min-h-screen w-full lg:grid-cols-[14rem_minmax(0,1fr)]">
          <aside className="hidden border-r border-[var(--pl-border)] bg-white lg:block">
            <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-4 py-6">
              <AdminBrand />
              <AdminCommandTrigger />
              <AdminNav active={visibleActive} workspaceName={visibleWorkspaceName} destinations={destinations} calendarHref={calendarHref} />
            </div>
          </aside>

          <main id="main-content" tabIndex={-1} className="min-w-0 px-4 pt-5 pb-[calc(var(--admin-mobile-nav-height,80px)+24px)] sm:px-6 lg:px-7 lg:py-6 xl:px-8">
            <p role="status" aria-atomic="true" className="sr-only">{handoff.visible ? `${handoff.visible.failed ? "Could not open" : "Opening"} ${handoff.visible.destination.title}…` : ""}</p>
            {handoff.visible && <div data-admin-client-handoff={handoff.visible.destination.route}>
              {handoff.visible.failed ? <section role="alert" className="rounded-xl border border-[var(--pl-border)] bg-white p-5">
                <h1 className="pl-page-title">{handoff.visible.destination.title}</h1>
                <p className="mt-3 text-sm text-[var(--pl-muted)]">This page is taking too long to open. Please try again or choose another page.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={handoff.retry} className="min-h-11 rounded-lg border border-[var(--pl-border)] px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Retry navigation</button>
                </div>
              </section> : <AdminRouteLoading route={handoff.visible.destination.route} announce={false} />}
            </div>}
            <div data-admin-route-content hidden={Boolean(handoff.visible)} inert={Boolean(handoff.visible)} aria-hidden={handoff.visible ? true : undefined}>{children}</div>
          </main>
      </div>

      <MobileBottomNav
        calendarHref={calendarHref}
        destinations={destinations}
        compact={compactMobileNav}
        onLayoutChange={measureCompactMobileNav}
        active={visibleActive}
        isMoreOpen={isMoreOpen}
        moreButtonRef={mobileMoreButtonRef}
        onMoreClick={toggleMobileMore}
      />
      <MobileMoreSheet
        destinations={destinations}
        compact={compactMobileNav}
        active={visibleActive}
        closeButtonRef={mobileMoreCloseButtonRef}
        dialogRef={mobileMoreDialogRef}
        isOpen={isMoreOpen}
        onClose={closeMobileMore}
      />
    </PageShell>
    </NeedsAttentionBadgeProvider>
    </AdminCommands>
    </AdminRouteHandoffContext.Provider>
    </AdminRouteCommitContext.Provider>
  );
}

export function AdminShell(props: AdminShellProps) {
  const registerCallbacks = useContext(PersistentAdminShellContext);
  useEffect(() => {
    if (!registerCallbacks) return;
    registerCallbacks({ onMobileMoreOpen: props.onMobileMoreOpen, onMobileMoreClose: props.onMobileMoreClose });
    return () => registerCallbacks(null);
  }, [registerCallbacks, props.onMobileMoreOpen, props.onMobileMoreClose]);
  return registerCallbacks ? <><AdminRouteCommit route={props.active ?? "overview"} />{props.children}</> : <AdminShellFrame {...props} />;
}

export function PersistentAdminShell(props: Omit<AdminShellProps, "deriveActiveFromPathname">) {
  const routeCallbacks = useRef<PersistentShellCallbacks | null>(null);
  const registerCallbacks = useCallback((callbacks: PersistentShellCallbacks | null) => {
    routeCallbacks.current = callbacks;
  }, []);
  return (
    <AdminShellFrame
      {...props}
      deriveActiveFromPathname
      onMobileMoreOpen={() => routeCallbacks.current?.onMobileMoreOpen?.()}
      onMobileMoreClose={() => routeCallbacks.current?.onMobileMoreClose?.()}
    >
      <PersistentAdminShellContext.Provider value={registerCallbacks}>{props.children}</PersistentAdminShellContext.Provider>
    </AdminShellFrame>
  );
}
