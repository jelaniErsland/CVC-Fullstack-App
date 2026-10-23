import { PageHeader } from "@/components/PageHeader";
import { adminDestinations } from "@/lib/adminNavigation";
import { selectVolunteerManagementWorkspaceContext } from "@/lib/volunteers/routeRead.server";
import { AdminShell } from "@/components/AdminShell";
import { CommunicationsWorkspace } from "@/components/CommunicationsWorkspace";
import { readCommunicationsContext, communicationHistory } from "@/lib/notifications/communications.server";
import { communicationsAction } from "@/lib/notifications/communications.actions";
import { readInitialAssignmentEmailConfiguration } from "@/lib/notifications/initialAssignmentEmail.server";
import { withReadTimeout } from "@/lib/readTimeout";
import { readReminderDeliveryStatus } from "@/lib/notifications/reminderStatus.server";
export const dynamic = "force-dynamic";
export default async function CommunicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await withReadTimeout(readCommunicationsContext()).catch(() => null);
  if (!context) return <AdminShell active="announcements"><h1 className="text-3xl font-bold">Communications</h1><p className="mt-4 text-slate-600">Communications is unavailable for this account.</p></AdminShell>;
  const selection = selectVolunteerManagementWorkspaceContext(context);
  const destinations = selection.ok ? adminDestinations(selection.capabilities) : ["overview"];
  const params = await searchParams;
  const dateParam = (value: string | string[] | undefined) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
  const from = dateParam(params.from);
  const through = dateParam(params.through);
  const historyRead = withReadTimeout(communicationHistory(context.supabase, context.workspace.id)).catch(() => null);
  const reminderStatus = await readReminderDeliveryStatus();
  const initialTab = params.kind === "reminders" || params.kind === "history" ? params.kind : undefined;
    const today = new Intl.DateTimeFormat("en-CA",{timeZone:context.workspace.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    return <AdminShell active="announcements" workspaceName={context.workspace.displayName} destinations={destinations} calendarWorkspaceKey={context.workspace.key}>
      <PageHeader title="Communications" />
      <CommunicationsWorkspace key={`${context.projectContactId}:${context.workspace.id}`} action={communicationsAction} history={[]} historyRead={historyRead} initialReminderStatus={reminderStatus} transportEnabled={readInitialAssignmentEmailConfiguration().ok} today={today} preferenceScope={{ contactId: context.projectContactId, workspaceId: context.workspace.id }} explicitKind={params.kind === "schedule" || initialTab !== undefined} initialKind={params.kind === "schedule" ? "schedule" : "welcome"} initialTab={initialTab} initialStartDate={from && through && from <= through ? from : undefined} initialEndDate={from && through && from <= through ? through : undefined} initialVolunteerId={typeof params.volunteer === "string" && /^[0-9a-f-]{36}$/i.test(params.volunteer) ? params.volunteer : undefined} />
    </AdminShell>;
}
