import { AdminShell } from "@/components/AdminShell";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Suspense } from "react";
import { OverviewContent, OverviewProjectIdentity } from "@/components/OverviewContent";
import { readAdminProjectPhoto } from "@/lib/projectPhoto/server";
import { defaultPhoto } from "@/lib/projectPhoto/photo";
import { readOverviewRouteState } from "@/lib/overview/routeRead.server";
import { withReadTimeout } from "@/lib/readTimeout";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
async function ProjectIdentity({ photoRead, workspaceName }: { photoRead: Promise<Awaited<ReturnType<typeof readAdminProjectPhoto>>>; workspaceName: string }) {
  const photo = await photoRead;
  return <OverviewProjectIdentity workspaceName={workspaceName} photo={photo?.photo ?? defaultPhoto} canEditPhoto={photo?.canEdit ?? false} />;
}

export default async function AdminDashboardPage() {
  const photoRead = withReadTimeout(readAdminProjectPhoto()).catch(() => null);
  const state = await withReadTimeout(readOverviewRouteState());
  if (state.kind !== "ready") return <AdminShell active="overview" destinations={["overview"]}><PageHeader title="Overview" /><div className="mt-6"><EmptyState title={state.title} message={state.message} kind={state.kind === "error" ? "error" : "unavailable"} /></div></AdminShell>;
  return <AdminShell active="overview" workspaceName={state.workspaceName} destinations={state.navigationDestinations} calendarWorkspaceKey={state.workspaceKey}>
    <OverviewContent state={state} projectIdentity={<Suspense fallback={<OverviewProjectIdentity workspaceName={state.workspaceName} photo={defaultPhoto} canEditPhoto={false} />}><ProjectIdentity photoRead={photoRead} workspaceName={state.workspaceName} /></Suspense>} />
  </AdminShell>;
}
