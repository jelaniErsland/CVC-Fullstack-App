import { PageHeader } from "@/components/PageHeader";

type Route = "overview" | "calendar" | "needs-attention" | "announcements" | "volunteers" | "tasks";
const titles: Record<Route, string> = { overview: "Overview", calendar: "Calendar", "needs-attention": "Needs Attention", announcements: "Communications", volunteers: "Volunteers", tasks: "Tasks" };

/**
 * Public presentation only: no project, permissions, counts, or private rows.
 * Next can prefetch this frame while the destination still authorizes its read.
 * Calendar deliberately has no selected view/date until its real state arrives.
 */
export function AdminRouteLoading({ route, announce = true }: { route: Route; announce?: boolean }) {
  const title = titles[route];
  const controls = route === "calendar" ? ["Day", "Week", "Month", "List"]
    : route === "announcements" ? ["Welcome emails", "Schedule deliveries", "Delivery history"]
    : route === "needs-attention" ? ["General", "Food", "Security", "When", "Status"]
    : [];
  return (
    <section aria-busy="true" aria-label={`${title} loading`} data-admin-route-loading={route} className="min-w-0 space-y-5">
      <PageHeader title={title} />
      {controls.length > 0 && <div aria-hidden="true" className="flex flex-wrap gap-2">
        {controls.map(label => <span key={label} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--pl-border)] bg-white px-3 text-sm text-[var(--pl-muted)]">{label}</span>)}
      </div>}
      {(route === "volunteers" || route === "needs-attention" || route === "tasks") && <div aria-hidden="true" className="flex min-h-11 items-center rounded-xl border border-[var(--pl-border)] bg-white px-3 text-sm text-[var(--pl-muted)]">
        {route === "volunteers" ? "Search volunteers" : route === "tasks" ? "Search tasks" : "Search attention issues"}
      </div>}
      <div className="rounded-xl border border-[var(--pl-border)] bg-white p-5">
        <p role={announce ? "status" : undefined} className="text-sm text-[var(--pl-muted)]">Loading {title === "Needs Attention" ? "follow-ups" : title.toLowerCase()}…</p>
        <div aria-hidden="true" className="mt-5 space-y-4">
          {[0, 1, 2].map(row => <div key={row} className="space-y-2">
            <div className="h-3 w-1/3 max-w-64 rounded bg-[var(--pl-surface-subtle)]" />
            <div className="h-2 w-2/3 max-w-96 rounded bg-[var(--pl-surface-subtle)]" />
          </div>)}
        </div>
      </div>
    </section>
  );
}
