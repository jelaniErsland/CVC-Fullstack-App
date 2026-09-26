import { PageHeader } from "@/components/PageHeader";
import { adminDestinations } from "@/lib/adminNavigation";
import { selectVolunteerManagementWorkspaceContext } from "@/lib/volunteers/routeRead.server";
import { AdminShell } from "@/components/AdminShell";
import { CommunicationsWorkspace } from "@/components/CommunicationsWorkspace";
import { readCommunicationsContext, communicationHistory } from "@/lib/notifications/communications.server";
import { communicationsAction } from "@/lib/notifications/communications.actions";
import { readInitialAssignmentEmailConfiguration } from "@/lib/notifications/initialAssignmentEmail.server";
export const dynamic = "force-dynamic";
export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await readCommunicationsContext();
  if (!context) return <AdminShell active="announcements"><h1 className="text-3xl font-bold">Communications</h1><p className="mt-4 text-slate-600">Communications is unavailable for this account.</p></AdminShell>;
  const selection = selectVolunteerManagementWorkspaceContext(context);
  const destinations = selection.ok ? adminDestinations(selection.capabilities) : ["overview"];
  const params = await searchParams;
  const dateParam = (value: string | string[] | undefined) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
  const from = dateParam(params.from);
  const through = dateParam(params.through);
  const loaded = await Promise.all([
      communicationHistory(context.supabase, context.workspace.id),
      context.supabase.rpc("review_communications", { p_workspace_id:context.workspace.id, p_plan:{kind:"welcome",mode:"new",volunteerIds:[]} }),
    ]).catch(() => null);
  if (!loaded || loaded[1].error) return <AdminShell active="announcements" workspaceName={context.workspace.displayName} destinations={destinations}><h1 className="text-3xl font-bold">Communications</h1><p className="mt-4 text-slate-600">Delivery history is temporarily unavailable. Refresh before sending anything.</p></AdminShell>;
  const [history, pending] = loaded;
    const count = pending.data && typeof pending.data === "object" && !Array.isArray(pending.data) && Array.isArray(pending.data.recipients) ? pending.data.recipients.length : 0;
    const today = new Intl.DateTimeFormat("en-CA",{timeZone:context.workspace.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    return <AdminShell active="announcements" workspaceName={context.workspace.displayName} destinations={destinations}>
      <PageHeader title="Communications" />
      <CommunicationsWorkspace action={communicationsAction} history={history} pendingWelcomeCount={count} transportEnabled={readInitialAssignmentEmailConfiguration().ok} today={today} initialKind={params.kind === "schedule" ? "schedule" : "welcome"} initialStartDate={from && through && from <= through ? from : undefined} initialEndDate={from && through && from <= through ? through : undefined} initialVolunteerId={typeof params.volunteer === "string" && /^[0-9a-f-]{36}$/i.test(params.volunteer) ? params.volunteer : undefined} />
    </AdminShell>;
}
