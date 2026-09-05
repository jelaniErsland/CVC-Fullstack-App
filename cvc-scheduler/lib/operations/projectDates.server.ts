import "server-only";

import type { VerifiedAdminContext } from "../auth/verified-admin-context.server.ts";
import type { AppSupabaseClient, PublicRpcArgs } from "../supabase/types.ts";
import { selectOperationalWorkspace } from "./projectDay.ts";
import { validateProjectDates, type ProjectDates } from "./projectDates.ts";

export async function updateCurrentWorkspaceProjectDatesWithClient(
  supabase: AppSupabaseClient,
  input: ProjectDates | unknown,
): Promise<ProjectDates> {
  const value = validateProjectDates(input);
  const { data, error } = await supabase.rpc(
    "update_current_workspace_project_dates",
    {
      p_starts_on: value.startsOn,
      p_ends_on: value.endsOn,
    } as PublicRpcArgs<"update_current_workspace_project_dates">,
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error("Project dates could not be updated.", { cause: error });
  }
  return validateProjectDates({
    startsOn: data[0].starts_on,
    endsOn: data[0].ends_on,
  });
}

export async function updateCurrentWorkspaceProjectDatesWithVerifiedContext(
  context: VerifiedAdminContext,
  input: ProjectDates | unknown,
) {
  const selection = selectOperationalWorkspace({
    projectContactId: context.projectContactId,
    ownGrants: context.ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "calendar.edit",
  });
  if (!selection.ok) throw new Error("Project dates are unavailable.");
  return updateCurrentWorkspaceProjectDatesWithClient(context.supabase, input);
}
