import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { OverviewContent } from "@/components/OverviewContent";
import { readAdminProjectPhoto } from "@/lib/projectPhoto/server";
import { defaultPhoto } from "@/lib/projectPhoto/photo";
import { readOverviewRouteState } from "@/lib/overview/routeRead.server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export default async function AdminDashboardPage() {
  const state = await readOverviewRouteState();
  const photo = await readAdminProjectPhoto().catch(() => null);
  if (state.kind !== "ready") return <AdminShell active="overview" destinations={["overview"]}><PageHeader title="Overview" /><div className="mt-6"><EmptyState title={state.title} message={state.message} kind={state.kind === "error" ? "error" : "unavailable"} /></div></AdminShell>;
  return <AdminShell active="overview" workspaceName={state.workspaceName} destinations={state.navigationDestinations}>
    <OverviewContent state={state} photo={photo?.photo ?? defaultPhoto} canEditPhoto={photo?.canEdit ?? false} />
  </AdminShell>;
}
