import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppSupabaseClient } from "@/lib/supabase/types";
import {
  normalizeWorkspaceReference,
  parseWorkspaceIdentity,
  type WorkspaceIdentity,
  type WorkspaceReference,
} from "@/lib/workspaces/identity";

const workspaceIdentityColumns = [
  "id",
  "workspace_key",
  "display_name",
  "lifecycle",
  "timezone",
  "starts_on",
  "ends_on",
  "public_intake_enabled",
  "created_at",
  "updated_at",
].join(",");

/**
 * Executes the narrow workspace-identity read with the caller's Supabase
 * session. RLS remains authoritative: the row is visible only when the current
 * Auth user has an active project contact and workspace.read grant.
 */
export async function readWorkspaceIdentityWithClient(
  supabase: AppSupabaseClient,
  reference: WorkspaceReference,
): Promise<WorkspaceIdentity | null> {
  const { column, value } = normalizeWorkspaceReference(reference);
  const { data, error } = await supabase
    .from("workspaces")
    .select(workspaceIdentityColumns)
    .eq(column, value)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Workspace identity read failed.", { cause: error });
  }

  return data === null ? null : parseWorkspaceIdentity(data);
}

/**
 * Server-owned entry point for a future authorized workspace lookup. It is not
 * imported by any application route in this slice.
 */
export async function readWorkspaceIdentity(
  reference: WorkspaceReference,
): Promise<WorkspaceIdentity | null> {
  const supabase = await createServerSupabaseClient();

  return readWorkspaceIdentityWithClient(supabase, reference);
}
