import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
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
 * session. RLS remains authoritative: in 11.4 it returns no rows because no
 * contact-grant policy exists yet.
 */
export async function readWorkspaceIdentityWithClient(
  supabase: SupabaseClient,
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

