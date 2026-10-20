"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ComponentProps } from "react";
import { createAdminHandoffStore, primaryAdminDestination } from "@/lib/adminRouteHandoff";

export const AdminRouteHandoffContext = createContext<((href: string) => void) | null>(null);
export const AdminRouteCommitContext = createContext<((route: string) => () => void) | null>(null);
const serverSnapshot = () => null;

/** Mounted by real route content/loading/error only, never a client handoff. */
export function AdminRouteCommit({ route }: { route: string }) {
  const commit = useContext(AdminRouteCommitContext);
  useLayoutEffect(() => commit?.(route), [commit, route]);
  return null;
}

/** Presentation ownership only. Native Next routing owns every actual click. */
export function useAdminRouteHandoff(enabled: boolean) {
  const pathname = usePathname();
  const router = useRouter();
  const [store] = useState(createAdminHandoffStore);
  const pending = useSyncExternalStore(store.subscribe, store.snapshot, serverSnapshot);
  const contentRoute = useSyncExternalStore(store.subscribe, store.contentSnapshot, serverSnapshot);
  const begin = useCallback((href: string) => { if (enabled) store.mark(href); }, [enabled, store]);
  const committed = pending?.destination.pathname === pathname && pending.destination.route === contentRoute;
  const departed = pending && !primaryAdminDestination(pathname);
  useLayoutEffect(() => {
    // ID check makes a completed older render inert after a newer click/history
    // event. Arrival ends presentation pending, not Next's route ownership.
    if (!pending) return;
    if (departed || (committed && pending.failed)) store.clear(pending.id);
    else store.settle(pending.id, committed);
  }, [committed, departed, pending, store]);

  useEffect(() => {
    if (!pending || pending.failed) return;
    const id = pending.id;
    const timer = window.setTimeout(() => {
      if (store.snapshot()?.id !== id) return;
      if (store.snapshot()?.settled) store.clear(id);
      else store.fail(id);
    }, Math.max(0, pending.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [pending, store]);

  useEffect(() => {
    if (!enabled) return;
    // History supersedes a sidebar click BEFORE Next restores the pathname.
    // Never push/replace history or replay a click in response to popstate.
    const onHistory = () => store.mark(window.location.pathname + window.location.search, "history");
    const onLink = (event: MouseEvent) => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (anchor && !anchor.hasAttribute("data-admin-navigation-link") && !anchor.download && (!anchor.target || anchor.target === "_self")) store.release();
    };
    window.addEventListener("popstate", onHistory, true);
    document.addEventListener("click", onLink, true);
    document.addEventListener("submit", store.release, true);
    return () => {
      window.removeEventListener("popstate", onHistory, true);
      document.removeEventListener("click", onLink, true);
      document.removeEventListener("submit", store.release, true);
    };
  }, [enabled, store]);

  const visible = pending && !departed && !committed ? pending : null;
  const retry = () => {
    if (!visible || store.snapshot()?.id !== visible.id) return;
    store.mark(visible.destination.href);
    router.push(visible.destination.href);
  };
  return { begin, visible, retry, commit: store.commit };
}

/** Do not cancel Link's navigation: this callback only acknowledges intent. */
export function AdminNavigationLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string }) {
  const begin = useContext(AdminRouteHandoffContext);
  return <Link {...props} href={href} data-admin-navigation-link onNavigate={() => begin?.(href)} />;
}
