"use server";

import { readVerifiedAdminContext } from "@/lib/auth/verified-admin-context.server";
import { readAssignedContactWithClient, type AssignedContactResult } from "@/lib/calendar/assignedContact.server";
import { selectCalendarRouteWorkspaceContext } from "@/lib/calendar/routeRead.server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readAssignedContactAction(
  assignmentId: string,
  projectReference: string,
  quickView: boolean,
): Promise<AssignedContactResult> {
  if (!uuid.test(assignmentId) || !(uuid.test(projectReference) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectReference))) return { kind: "unavailable" };
  const context = await readVerifiedAdminContext();
  if (!context) return { kind: "unavailable" };
  const selection = selectCalendarRouteWorkspaceContext({
    projectContactId: context.projectContactId,
    ownGrants: context.ownGrants,
    workspaces: context.workspaces.filter(workspace => workspace.key === projectReference || workspace.id === projectReference),
  });
  if (!selection.ok || !selection.canViewVolunteers) return { kind: "unavailable" };
  try {
    return await readAssignedContactWithClient({
      client: context.supabase,
      workspaceId: selection.workspace.id,
      assignmentId,
      quickView,
    });
  } catch {
    return { kind: "unavailable" };
  }
}
