import "server-only";
import { readVerifiedAdminContext } from "../auth/verified-admin-context.server";
import { selectVolunteerManagementWorkspaceContext } from "../volunteers/routeRead.server";
import { communicationCapabilities, type CommunicationHistory } from "./communications";
import type { AppSupabaseClient } from "../supabase/types";

export async function readCommunicationsContext() {
  const context = await readVerifiedAdminContext();
  if (!context) return null;
  const selection = selectVolunteerManagementWorkspaceContext(context);
  if (!selection.ok || !communicationCapabilities.every(c => selection.capabilities.includes(c))) return null;
  return { ...context, workspace: selection.workspace };
}
export async function communicationHistory(client: AppSupabaseClient, workspaceId: string): Promise<CommunicationHistory[]> {
  const result = await client.rpc("read_communication_history", { p_workspace_id: workspaceId });
  if (result.error || !Array.isArray(result.data)) throw new Error("History unavailable");
  return result.data as unknown as CommunicationHistory[];
}

export { dispatchCommunicationRecipients } from "./communicationDispatch.server";
