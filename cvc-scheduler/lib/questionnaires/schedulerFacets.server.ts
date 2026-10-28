import "server-only";

import type { VerifiedAdminContext } from "../auth/verified-admin-context.server.ts";
import { selectOperationalWorkspace } from "../operations/projectDay.ts";
import {
  projectSchedulerFacetsFromProfile,
  type SchedulerFacetProfileSource,
} from "./schedulerFacets.ts";

const schedulerFacetColumns =
  "id,workspace_id,congregation,availability_snapshot,skills_help_snapshot,lifecycle";

function parseSchedulerFacetProfileSource(value: unknown): SchedulerFacetProfileSource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Scheduler facet source is invalid.");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    (row.congregation !== null && typeof row.congregation !== "string") ||
    typeof row.availability_snapshot !== "object" ||
    row.availability_snapshot === null ||
    Array.isArray(row.availability_snapshot) ||
    typeof row.skills_help_snapshot !== "object" ||
    row.skills_help_snapshot === null ||
    Array.isArray(row.skills_help_snapshot)
  ) {
    throw new Error("Scheduler facet source is invalid.");
  }
  return {
    volunteerProfileId: row.id,
    congregation: row.congregation as string | null,
    availabilitySnapshot: row.availability_snapshot,
    skillsHelpSnapshot: row.skills_help_snapshot,
  };
}

/**
 * Calendar receives only scheduler-approved profile snapshot facets. The raw
 * questionnaire submission table and unrelated snapshot text are never read.
 */
export async function readSchedulerFacetProjectionsWithVerifiedContext(
  context: VerifiedAdminContext,
) {
  const selection = selectOperationalWorkspace({
    projectContactId: context.projectContactId,
    ownGrants: context.ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "volunteers.view",
  });
  if (!selection.ok) throw new Error("Scheduler facets are unavailable.");
  const { data, error } = await context.supabase
    .from("volunteer_profiles")
    .select(schedulerFacetColumns)
    .eq("workspace_id", selection.workspace.id)
    .eq("lifecycle", "active")
    .order("id");
  if (error) throw new Error("Scheduler facets could not be read.", { cause: error });
  return (data ?? [])
    .map(parseSchedulerFacetProfileSource)
    .map(projectSchedulerFacetsFromProfile);
}
