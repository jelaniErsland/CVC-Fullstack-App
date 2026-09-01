import "server-only";

import type { VerifiedAdminContext } from "../auth/verified-admin-context.server.ts";
import type { AppSupabaseClient, PublicRpcArgs } from "../supabase/types.ts";
import {
  normalizeProjectDate,
  parseProjectDay,
  selectOperationalWorkspace,
  validateSetProjectDayExpectedOnSiteInput,
  type ProjectDay,
  type SetProjectDayExpectedOnSiteInput,
} from "./projectDay.ts";

const projectDayColumns =
  "project_date,expected_on_site_count,created_at,updated_at";

export async function readProjectDayWithVerifiedContext(
  context: VerifiedAdminContext,
  dateInput: unknown,
): Promise<ProjectDay | null> {
  const date = normalizeProjectDate(dateInput);
  const selection = selectOperationalWorkspace({
    projectContactId: context.projectContactId,
    ownGrants: context.ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "calendar.view",
  });
  if (!selection.ok) throw new Error("Project Day read is unavailable.");
  const { data, error } = await context.supabase
    .from("project_days")
    .select(projectDayColumns)
    .eq("workspace_id", selection.workspace.id)
    .eq("project_date", date)
    .maybeSingle();
  if (error) throw new Error("Project Day could not be read.", { cause: error });
  return data === null ? null : parseProjectDay(data);
}

export async function setProjectDayExpectedOnSiteWithClient(
  supabase: AppSupabaseClient,
  input: SetProjectDayExpectedOnSiteInput | unknown,
): Promise<ProjectDay> {
  const value = validateSetProjectDayExpectedOnSiteInput(input);
  const { data, error } = await supabase.rpc(
    "set_current_project_day_expected_on_site",
    {
      p_project_date: value.date,
      p_expected_on_site_count: value.expectedOnSiteCount,
    } as PublicRpcArgs<"set_current_project_day_expected_on_site">,
  );
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error("Project Day could not be updated.", { cause: error });
  }
  return parseProjectDay(data[0]);
}

export async function setProjectDayExpectedOnSiteWithVerifiedContext(
  context: VerifiedAdminContext,
  input: SetProjectDayExpectedOnSiteInput | unknown,
) {
  const selection = selectOperationalWorkspace({
    projectContactId: context.projectContactId,
    ownGrants: context.ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "calendar.edit",
  });
  if (!selection.ok) throw new Error("Project Day update is unavailable.");
  return setProjectDayExpectedOnSiteWithClient(context.supabase, input);
}
