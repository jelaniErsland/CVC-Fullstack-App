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
