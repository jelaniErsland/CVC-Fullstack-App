"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import type { ComponentProps } from "react";
import { adminHandoffTimeoutMs, primaryAdminDestination } from "@/lib/adminRouteHandoff";
import type { AdminHandoffDestination } from "@/lib/adminRouteHandoff";

export const AdminRouteHandoffContext = createContext<((href: string) => boolean) | null>(null);
type Handoff = { id: number; destination: AdminHandoffDestination; originPathname: string; failed: boolean };

/** Volatile intent, not a router, data cache, or authorization decision. */
export function useAdminRouteHandoff(enabled: boolean) {
  const pathname = usePathname();
  const router = useRouter();
  const sequence = useRef(0);
  const [pending, setPending] = useState<Handoff | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const markIntent = useCallback((href: string) => {
    const destination = primaryAdminDestination(href);
    setPending(enabled && destination && (destination.pathname !== pathname || pending)
      ? { id: ++sequence.current, destination, originPathname: pathname, failed: false }
      : null);
    return enabled ? destination : null;
  }, [enabled, pathname, pending]);
  const begin = useCallback((href: string) => {
    if (!markIntent(href)) return false;
    // Intent is urgent; only the real router work belongs in a transition.
    // Owning this transition also handles "return to current page" while an
    // older destination is in flight, rather than treating that click as a no-op.
    startNavigation(() => router.push(href));
    return true;
  }, [markIntent, router]);

  // Pathname and the route segment commit together. A superseded segment may
  // never release the latest intent's mask: only its matching destination can.
  // Reconcile this component's own state before rendering children, avoiding
  // an extra effect/paint that could briefly revive a completed intent.
  const committed = pending?.destination.pathname === pathname && (pending.originPathname !== pathname || !isNavigating);
  if (committed) setPending(null);

  useEffect(() => {
    if (!pending || pending.failed) return;
    const id = pending.id;
    const timer = window.setTimeout(() => {
      setPending(current => current?.id === id ? { ...current, failed: true } : current);
    }, adminHandoffTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    if (!enabled) return;
    // Observe native history; never push/replace history for presentation state.
    const onHistory = () => markIntent(window.location.pathname + window.location.search);
    window.addEventListener("popstate", onHistory);
    return () => window.removeEventListener("popstate", onHistory);
  }, [markIntent, enabled]);

  const visible = pending && !committed ? pending : null;
  const retry = () => {
    if (!visible) return;
    begin(visible.destination.href);
  };
  return { begin, visible, retry };
}

/** Keep Next Link's prefetch, native/modifier clicks, keyboard and history. */
export function AdminNavigationLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string }) {
  const begin = useContext(AdminRouteHandoffContext);
  // onNavigate excludes modified/external/download clicks. Only handled primary
  // routes use our single router push; Link still owns safe automatic prefetch.
  return <Link {...props} href={href} onNavigate={event => { if (begin?.(href)) event.preventDefault(); }} />;
}
