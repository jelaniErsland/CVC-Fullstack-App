"use server";

import { readCalendarAssignmentMutationRouteContext } from "./routeRead.server";
import { readMatchingAssignmentItemsWithClient, type MatchingAssignmentItemsState } from "./matchingAssignmentItems.server";

export async function readMatchingAssignmentItemsAction(form: FormData): Promise<MatchingAssignmentItemsState> {
  try {
    const context = await readCalendarAssignmentMutationRouteContext();
    if (!context) return { kind: "unavailable" };
    const sourceId = form.get("sourceId");
    const sourceDate = form.get("sourceDate");
    const month = form.get("month");
    const offset = Number(form.get("offset"));
    if (typeof sourceId !== "string" || typeof sourceDate !== "string" || typeof month !== "string"
      || sourceId.length > 40 || sourceDate.length > 10 || month.length > 7) return { kind: "unavailable" };
    return readMatchingAssignmentItemsWithClient({
      client: context.supabase, workspaceId: context.workspace.id,
      sourceId, sourceDate, cursor: { month, offset },
      projectStartsOn: context.workspace.startsOn, projectEndsOn: context.workspace.endsOn,
    });
  } catch {
    return { kind: "unavailable" };
  }
}
