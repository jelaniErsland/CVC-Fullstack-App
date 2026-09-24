import "server-only";
import { buildCommunicationMessage, type CommunicationAssignment, type CommunicationHistory } from "./communications.ts";
import { readInitialAssignmentEmailConfiguration, buildVolunteerScheduleAccessUrl, type InitialAssignmentEmailConfiguration } from "./initialAssignmentEmail.server.ts";
import { sendSingleRecipientMessage } from "./singleRecipientTransport.server.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
async function communicationHistory(client: AppSupabaseClient, workspaceId: string): Promise<CommunicationHistory[]> {
  const result = await client.rpc("read_communication_history", { p_workspace_id: workspaceId });
  if (result.error || !Array.isArray(result.data)) throw new Error("History unavailable");
  return result.data as unknown as CommunicationHistory[];
}
export async function dispatchCommunicationRecipients(client: AppSupabaseClient, workspaceId: string, recipientIds: string[], retry: boolean,
  configuration: InitialAssignmentEmailConfiguration = readInitialAssignmentEmailConfiguration(), runtime = { fetch: globalThis.fetch }) {
  if (!configuration.ok) throw new Error("Email transport is disabled or unavailable.");
  // The caller passes IDs only from a just-confirmed operation, or one explicit
  // failed-recipient retry. Each claim rechecks live permissions/eligibility.
  for (const id of recipientIds.slice(0, 5)) {
    const { data, error } = await client.rpc("claim_communication_recipient", { p_recipient_id: id, p_retry: retry });
    if (error) throw new Error("Claim unavailable");
    if (!data) continue;
    if (typeof data !== "object" || Array.isArray(data)) throw new Error("Claim invalid");
    const c = data as Record<string, unknown>;
    if (typeof c.recipientId !== "string" || typeof c.claimId !== "string" || typeof c.operationId !== "string" || typeof c.volunteerId !== "string" || typeof c.email !== "string" || typeof c.name !== "string" || typeof c.workspaceName !== "string" || typeof c.attempt !== "number" || !Array.isArray(c.assignments) || (c.kind !== "welcome" && c.kind !== "schedule")) throw new Error("Claim invalid");
    let tokenId: string | null = null;
    let url = configuration.origin;
    if (c.kind === "schedule") {
      const issued = await client.rpc("issue_volunteer_schedule_access", { p_volunteer_profile_id: c.volunteerId, p_ttl_hours: 720 });
      const token = issued.data?.[0];
      if (issued.error || !token || !/^[A-Za-z0-9_-]{43}$/.test(token.bearer_token)) {
        await client.rpc("finalize_communication_recipient", { p_recipient_id: id, p_claim_id: c.claimId, p_outcome: "failed", p_provider_id: null as unknown as string, p_failure_code: "schedule_access_unavailable" });
        continue;
      }
      tokenId = token.token_id;
      url = buildVolunteerScheduleAccessUrl({ origin: configuration.origin, token: token.bearer_token });
    }
    const message = buildCommunicationMessage({ kind: c.kind, workspaceName: c.workspaceName, name: c.name, assignments: c.assignments as CommunicationAssignment[], url });
    const outcome = await sendSingleRecipientMessage(configuration, { ...message, operationId: c.operationId, recipientId: id, attempt: c.attempt, email: c.email }, runtime);
    if (outcome.status === "rejected" && tokenId) await client.rpc("revoke_volunteer_schedule_access", { p_token_id: tokenId });
    const finalized = await client.rpc("finalize_communication_recipient", {
      p_recipient_id: id, p_claim_id: c.claimId,
      p_outcome: outcome.status === "accepted" ? "sent" : outcome.status === "rejected" ? "failed" : "unknown",
      p_provider_id: (outcome.status === "accepted" ? outcome.providerMessageId : null) as unknown as string,
      p_failure_code: (outcome.status === "accepted" ? null : outcome.status === "rejected" ? "provider_rejected" : "provider_outcome_unknown") as unknown as string,
    });
    // A lost finalization acknowledgement must leave the token valid and the
    // durable claim non-retryable. Never turn provider acceptance into failure.
    if (finalized.error) continue;
  }
  return communicationHistory(client, workspaceId);
}
