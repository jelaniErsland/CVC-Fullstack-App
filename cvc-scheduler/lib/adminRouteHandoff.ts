// Presentation identities only. Never put project data or permissions here.
const primaryRoutes = {
  "/admin/dashboard": { route: "overview", title: "Overview" },
  "/admin/calendar": { route: "calendar", title: "Calendar" },
  "/admin/volunteers": { route: "volunteers", title: "Volunteers" },
  "/admin/needs-attention": { route: "needs-attention", title: "Needs Attention" },
  "/admin/announcements": { route: "announcements", title: "Communications" },
  "/admin/tasks": { route: "tasks", title: "Tasks" },
} as const;

export function primaryAdminDestination(href: string) {
  if (!href.startsWith("/admin/")) return null;
  const pathname = href.split(/[?#]/, 1)[0];
  if (!Object.hasOwn(primaryRoutes, pathname)) return null;
  return { ...primaryRoutes[pathname as keyof typeof primaryRoutes], pathname, href };
}

export type AdminHandoffDestination = NonNullable<ReturnType<typeof primaryAdminDestination>>;
export const adminHandoffTimeoutMs = 30_000;

export type AdminHandoffIntent = {
  id: number;
  destination: AdminHandoffDestination;
  kind: "click" | "history";
  failed: boolean;
  settled: boolean;
  expiresAt: number;
};

/** One mounted shell only. Synchronous intent cannot be rebased by a router's
 * older React transition. Contains public route metadata, never private data. */
export function createAdminHandoffStore() {
  let sequence = 0;
  let current: AdminHandoffIntent | null = null;
  let contentRoute: string | null = null;
  let contentSequence = 0;
  let contentOwner = 0;
  const listeners = new Set<() => void>();
  const publish = (next: AdminHandoffIntent | null) => { current = next; listeners.forEach(listener => listener()); };
  return {
    snapshot: () => current,
    contentSnapshot: () => contentRoute,
    commit(route: string) {
      const id = ++contentSequence;
      contentOwner = id;
      if (contentRoute !== route) { contentRoute = route; listeners.forEach(listener => listener()); }
      // Suspense/Activity can hide an old subtree while keeping its state. A
      // hidden/unmounted marker is no longer proof of visible route content.
      return () => {
        if (contentOwner !== id) return;
        contentOwner = 0; contentRoute = null; listeners.forEach(listener => listener());
      };
    },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    mark(href: string, kind: "click" | "history" = "click") {
      const destination = primaryAdminDestination(href);
      const id = ++sequence;
      publish(destination ? { id, destination, kind, failed: false, settled: false, expiresAt: Date.now() + adminHandoffTimeoutMs } : null);
    },
    clear(id: number) { if (current?.id === id) publish(null); },
    settle(id: number, settled: boolean) { if (current?.id === id && current.settled !== settled) publish({ ...current, settled }); },
    release() { ++sequence; publish(null); },
    fail(id: number) { if (current?.id === id) publish({ ...current, failed: true }); },
  };
}
