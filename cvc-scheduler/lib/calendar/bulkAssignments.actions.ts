"use server";
import { revalidatePath } from "next/cache";
import { readCalendarAssignmentMutationRouteContext } from "./routeRead.server";
import { validateBulkAssignmentPlan, type BulkAssignmentActionState, type BulkAssignmentPreview } from "./bulkAssignments";
import type { Json } from "../supabase/database.types";

export async function planCalendarAssignmentsAction(form: FormData): Promise<BulkAssignmentActionState> {
  try {
    const context = await readCalendarAssignmentMutationRouteContext();
    if (!context) return { kind: "error", message: "Assignment management is unavailable." };
    const raw = form.get("plan"), requestId = form.get("requestId"), fingerprint = form.get("fingerprint");
    if (typeof raw !== "string" || raw.length > 100000 || typeof requestId !== "string") throw new Error("Invalid selection.");
    if (fingerprint !== null && (typeof fingerprint !== "string" || !/^[a-f0-9]{32}$/.test(fingerprint))) throw new Error("Invalid preview.");
    const plan = validateBulkAssignmentPlan(JSON.parse(raw), context.workspace.id, requestId);
    const { data, error } = await context.supabase.rpc("plan_calendar_assignments", {
      p_workspace_id: context.workspace.id, p_request_id: requestId,
      p_plan: plan as Json, p_expected_preview: fingerprint as string,
    });
    if (error) return { kind: "error", message: error.code === "40001"
      ? "This item changed while you were editing it. Review the latest version."
      : "Save could not be confirmed. Refresh Calendar and check the result before trying again." };
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Unavailable");
    if (data.saved === true && typeof data.createdAssignmentCount === "number") {
      for (const path of ["/admin/calendar", "/admin/volunteers", "/admin/needs-attention", "/admin/quick-view", "/v/schedule"]) {
        try { revalidatePath(path); } catch { /* Persistence succeeded; refresh must not report a failed save. */ }
      }
      return { kind: "saved", count: data.createdAssignmentCount };
    }
    if (data.saved !== false || typeof data.fingerprint !== "string" || !Array.isArray(data.items) || !Array.isArray(data.volunteers) || !Array.isArray(data.existingAssignments) || !Array.isArray(data.sameDayWork)) throw new Error("Unavailable");
    return { kind: "preview", preview: data as unknown as BulkAssignmentPreview };
  } catch {
    return { kind: "error", message: "Unable to complete this operation. Refresh Calendar and check the result before trying again." };
  }
}
