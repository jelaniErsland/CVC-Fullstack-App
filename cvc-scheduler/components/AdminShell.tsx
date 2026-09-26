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
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import type { AdminNavActive } from "@/components/AdminNav";
import { AdminNavigationPendingIndicator } from "@/components/AdminNavigationPendingIndicator";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { ProjectLocalBrand } from "@/components/ProjectLocalBrand";
import { NeedsAttentionUnseenBadge } from "@/components/NeedsAttentionUnseenBadge";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import { ldcProjectName } from "@/lib/projectIdentity";

type AdminShellProps = {
  active: AdminNavActive;
  children: ReactNode;
  onMobileMoreClose?: () => void;
  onMobileMoreOpen?: () => void;
  projectId?: string;
  workspaceName?: string;
  destinations?: readonly string[];
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
}: {
  active: AdminNavActive;
  isMoreOpen: boolean;
  moreButtonRef: Ref<HTMLButtonElement>;
  onMoreClick: () => void;
  destinations?: readonly string[];
  compact: boolean;
  onLayoutChange: () => void;
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
        {primaryMobileTabs.filter(tab => !compact || tab.id === "overview" || tab.id === "calendar").map(tab => !destinations || destinations.includes(tab.id) ? <MobileTabLink active={active === tab.id} compact={compact} key={tab.id} tab={tab} /> : <span key={tab.id} />)}
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
}: {
  active: boolean;
  compact: boolean;
  tab: PrimaryMobileTab;
}) {
  const Icon = tab.icon;

  return (
    <Link
      aria-label={tab.ariaLabel ?? `Open ${tab.label}`}
      aria-current={active ? "page" : undefined}
      className={[
        "relative flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        active
          ? "text-[var(--pl-blue)]"
          : "text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]",
      ].join(" ")}
      href={tab.href}
    >
      <span className={active ? "flex size-7 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)]" : "flex size-7 items-center justify-center"}>
        <Icon aria-hidden="true" className="h-[19px] w-[19px]" />
      </span>
      <span className="pl-nav-label text-xs font-semibold leading-none" style={compact ? {fontSize:"0.625rem"} : undefined}>{tab.label}</span>
      {tab.id === "needs-attention" ? <span className="absolute right-1.5 top-1"><NeedsAttentionUnseenBadge /></span> : null}
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
                      <Link
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
    "/admin/quick-view": "quick-view",
    "/admin/tasks": "tasks",
    "/admin/announcements": "announcements",
    "/admin/volunteers": "volunteers",
    "/admin/needs-attention": "needs-attention",
  };

  return hrefToActive[href];
}

export function AdminShell({
  active,
  children,
  onMobileMoreClose,
  onMobileMoreOpen,
  workspaceName,
  destinations = ["overview"],
}: AdminShellProps) {
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
          </div>
      </div>

      <div className="grid min-h-screen w-full lg:grid-cols-[14rem_minmax(0,1fr)]">
          <aside className="hidden border-r border-[var(--pl-border)] bg-white lg:block">
            <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-4 py-6">
              <AdminBrand />
              <AdminNav active={active} workspaceName={visibleWorkspaceName} destinations={destinations} />
            </div>
          </aside>

          <main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-5 sm:px-6 lg:px-7 lg:py-6 xl:px-8">
            {children}
            <div aria-hidden="true" className="h-[calc(var(--admin-mobile-nav-height,80px)+24px)] lg:hidden" />
          </main>
      </div>

      <MobileBottomNav
        destinations={destinations}
        compact={compactMobileNav}
        onLayoutChange={measureCompactMobileNav}
        active={active}
        isMoreOpen={isMoreOpen}
        moreButtonRef={mobileMoreButtonRef}
        onMoreClick={toggleMobileMore}
      />
      <MobileMoreSheet
        destinations={destinations}
        compact={compactMobileNav}
        active={active}
        closeButtonRef={mobileMoreCloseButtonRef}
        dialogRef={mobileMoreDialogRef}
        isOpen={isMoreOpen}
        onClose={closeMobileMore}
      />
    </PageShell>
  );
}
