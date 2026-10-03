"use server";

import { readCalendarAssignmentMutationRouteContext } from "./routeRead.server";
import { readAssignmentPickerContextWithClient } from "./assignmentPickerContext.server";
import type { PickerContextState } from "./assignmentPickerContext";
import type { BulkAssignmentPlan } from "./bulkAssignments";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readAssignmentPickerContextAction(form: FormData): Promise<PickerContextState> {
  try {
    const context = await readCalendarAssignmentMutationRouteContext();
    if (!context) return { kind: "unavailable" };
    const rawPlan = form.get("plan");
    const rawIds = form.get("volunteerIds");
    if (typeof rawPlan !== "string" || rawPlan.length > 100000 || typeof rawIds !== "string" || rawIds.length > 50000) return { kind: "unavailable" };
    const candidateIds: unknown = JSON.parse(rawIds);
    if (!Array.isArray(candidateIds) || candidateIds.length > 1000 || candidateIds.some(id => typeof id !== "string" || !uuid.test(id)) || new Set(candidateIds).size !== candidateIds.length) return { kind: "unavailable" };
    if (!candidateIds.length) return { kind: "ready", volunteers: [] };
    const plan: unknown = JSON.parse(rawPlan);
    if (typeof plan !== "object" || !plan || Array.isArray(plan)) return { kind: "unavailable" };
    return readAssignmentPickerContextWithClient({ client: context.supabase, workspaceId: context.workspace.id, plan: plan as BulkAssignmentPlan, candidateIds: candidateIds as string[] });
  } catch {
    return { kind: "unavailable" };
  }
}
