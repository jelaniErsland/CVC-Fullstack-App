import CalendarClient from "@/components/CalendarClient";
import { ProjectQuickViewShareControl } from "@/components/ProjectQuickViewShareControl";
import { readVerifiedAdminContext } from "@/lib/auth/verified-admin-context.server";
import { readCalendarRouteState, selectCalendarRouteWorkspaceContext } from "@/lib/calendar/routeRead.server";
import { asReadOnlyCalendar } from "@/lib/calendar/quickView.server";
import { readProjectQuickViewShareState } from "@/lib/projectQuickViewAccess/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminQuickViewPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = await readVerifiedAdminContext();
  const projects = context ? context.workspaces.filter(workspace => {
    const selected = selectCalendarRouteWorkspaceContext({ projectContactId: context.projectContactId, ownGrants: context.ownGrants, workspaces: [workspace] });
    return selected.ok && selected.canViewVolunteers && selected.canViewTaskPresets;
  }) : [];
  const key = typeof params?.project === "string" ? params.project : projects[0]?.key;
  const selected = projects.find(project => project.key === key);
  if (!selected) return <main className="mx-auto max-w-2xl p-6"><h1 className="text-2xl font-bold">Quick View unavailable</h1><p className="mt-3">An active project grant with Calendar, task, assignment and volunteer viewing is required.</p></main>;
  const state = asReadOnlyCalendar(await readCalendarRouteState(params, { trustedReadOnly: true, workspaceKey: selected.key }));
  const share = await readProjectQuickViewShareState(selected.key).catch(() => null);
  return <>
    {projects.length > 1 ? <form className="mx-auto max-w-[1600px] px-3 pt-4 sm:px-6" action="/admin/quick-view">
      <label className="text-sm font-semibold">Project<select className="mx-3 min-h-11 rounded-lg border px-3" name="project" defaultValue={selected.key}>{projects.map(project => <option key={project.key} value={project.key}>{project.displayName}</option>)}</select></label>
      <button className="min-h-11 rounded-lg border px-3" type="submit">Open project</button>
    </form> : null}
    <CalendarClient readOnly routeBase="/admin/quick-view" projectKey={selected.key} state={state} initialInspectorItemId={typeof params?.item === "string" ? params.item : undefined} />
    {share ? <div className="mx-auto max-w-3xl px-3 pb-6"><ProjectQuickViewShareControl projectKey={selected.key} initialState={{ status: "idle", enabled: share.enabled, activeLinkCount: share.activeLinkCount, expiresAt: share.expiresAt, accessPath: null, message: "" }} /></div> : null}
  </>;
}
