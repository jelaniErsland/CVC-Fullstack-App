"use server";
import { revalidatePath } from "next/cache";
import { parseCommunicationPlan, type CommunicationActionState, type CommunicationPreview } from "./communications";
import { readCommunicationsContext, communicationHistory, dispatchCommunicationRecipients } from "./communications.server";
import { readInitialAssignmentEmailConfiguration } from "./initialAssignmentEmail.server";
import type { Json } from "../supabase/database.types";

export async function communicationsAction(form: FormData): Promise<CommunicationActionState> {
  try {
    const context = await readCommunicationsContext();
    if (!context) return { kind: "error", message: "Communications is unavailable for this account." };
    const command = form.get("command");
    if (command === "history") return { kind: "results", history: await communicationHistory(context.supabase, context.workspace.id) };
    if (command === "continue") {
      const history = await communicationHistory(context.supabase, context.workspace.id);
      const queued = history.filter(r => r.operation_id === form.get("operationId") && r.state === "ready");
      if (!queued.length || form.get("confirmedRecipients") !== String(queued.length)) return { kind: "error", message: "Pending recipients changed. Refresh history." };
      return { kind: "results", history: await dispatchCommunicationRecipients(context.supabase, context.workspace.id, queued.map(r => r.recipient_id), false) };
    }
    if (command === "retry") {
      if (form.get("confirmedRecipients") !== "1") throw new Error("Confirmation required");
      const history = await communicationHistory(context.supabase, context.workspace.id);
      const recipient = history.find(r => r.recipient_id === form.get("recipientId") && r.state === "failed");
      if (!recipient) return { kind: "error", message: "This message cannot be retried. Refresh delivery history." };
      return { kind: "results", history: await dispatchCommunicationRecipients(context.supabase, context.workspace.id, [recipient.recipient_id], true) };
    }
    const raw = form.get("plan");
    if (typeof raw !== "string" || raw.length > 20000) throw new Error("Invalid plan");
    const plan = parseCommunicationPlan(JSON.parse(raw));
    const reviewed = await context.supabase.rpc("review_communications", { p_workspace_id: context.workspace.id, p_plan: plan as Json });
    if (reviewed.error || !reviewed.data || typeof reviewed.data !== "object" || Array.isArray(reviewed.data)) throw new Error("Preview unavailable");
    const preview = reviewed.data as unknown as CommunicationPreview;
    if (command === "preview") return { kind: "preview", preview };
    if (command !== "send" || !readInitialAssignmentEmailConfiguration().ok) return { kind: "error", message: "Email transport is disabled or unavailable. Nothing was sent." };
    const expected = form.get("fingerprint"), operationId = form.get("operationId");
    if (expected !== preview.fingerprint || form.get("confirmedRecipients") !== String(preview.recipients.length)) return { kind: "error", message: "Recipients changed. Review the latest preview before sending." };
    if (typeof operationId !== "string" || !/^[0-9a-f-]{36}$/i.test(operationId)) throw new Error("Invalid operation");
    const saved = await context.supabase.rpc("confirm_communication_operation", { p_workspace_id: context.workspace.id, p_operation_id: operationId, p_plan: plan as Json, p_expected_preview: String(expected) });
    if (saved.error) return { kind: "error", message: "Recipients changed or another administrator started delivery. Refresh the preview and history." };
    const queued = (await communicationHistory(context.supabase, context.workspace.id)).filter(r => r.operation_id === operationId && r.state === "ready");
    const history = await dispatchCommunicationRecipients(context.supabase, context.workspace.id, queued.map(r => r.recipient_id), false);
    try { revalidatePath("/admin/announcements"); } catch { /* Delivery ledger remains the authority. */ }
    return { kind: "results", history };
  } catch {
    return { kind: "error", message: "The delivery result is unavailable. Refresh history before sending again; pending or unknown messages must not be retried." };
  }
}
