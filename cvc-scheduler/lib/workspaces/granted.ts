import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  parseWorkspaceIdentity,
  type WorkspaceIdentity,
} from "@/lib/workspaces/identity";

const grantedWorkspaceColumns = [
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
 * RLS, not a client-supplied workspace id, determines the returned set.
 */
export async function readGrantedWorkspacesWithClient(
  supabase: SupabaseClient,
): Promise<readonly WorkspaceIdentity[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select(grantedWorkspaceColumns)
    .order("display_name");

  if (error) {
    throw new Error("Granted workspace read failed.", { cause: error });
  }

  return (data ?? []).map(parseWorkspaceIdentity);
}

export async function readCurrentUserGrantedWorkspaces() {
  const supabase = await createServerSupabaseClient();

  return readGrantedWorkspacesWithClient(supabase);
}

