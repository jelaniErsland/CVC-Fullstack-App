import { Eye } from "lucide-react";

import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { ProjectQuickView } from "@/components/ProjectQuickView";
import { readProjectQuickViewRouteState } from "@/lib/operations/projectQuickViewRoute.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type QuickViewPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function AdminQuickViewPage({ searchParams }: QuickViewPageProps) {
  const state = await readProjectQuickViewRouteState(await searchParams);
  const workspaceName = state.kind === "ready"
    ? state.projection.projectDisplayName
    : "Project workspace";

  return (
    <AdminShell active="quick-view" workspaceName={workspaceName}>
      <header className="mx-auto flex w-full max-w-3xl items-end justify-between gap-4 border-b border-[var(--pl-border)] pb-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
            <Eye aria-hidden="true" className="size-3.5" />
            Authorized project view
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-[var(--pl-ink)] sm:text-4xl">
            Project Quick View
          </h1>
        </div>
        <p className="hidden max-w-xs text-right text-xs leading-5 text-[var(--pl-muted)] sm:block">
          A focused daily view of expected attendance and published work.
        </p>
      </header>

      <div className="mt-4">
        {state.kind === "ready" ? (
          <ProjectQuickView
            date={state.date}
            projects={state.projects}
            projection={state.projection}
            selectedProjectKey={state.selectedProjectKey}
            today={state.today}
          />
        ) : (
          <div className="mx-auto max-w-3xl">
            <EmptyState
              message="This project view is not available for the current signed-in contact and date."
              title="Quick View unavailable"
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}
