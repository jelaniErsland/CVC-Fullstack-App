import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isEffectiveWorkspaceReadGrant,
  parseProjectContactGrant,
  type ProjectContactGrant,
} from "@/lib/auth/grant";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type { ProjectContactGrant } from "@/lib/auth/grant";

export type ProjectContactGrantState = Readonly<{
  status: "authorized" | "no_active_grants" | "unavailable";
  grants: readonly ProjectContactGrant[];
  reason: string;
}>;

/**
 * Loads only active workspace-read grants visible through the caller's RLS
 * session. The explicit user id must match the verified session identity.
 */
export async function loadProjectContactGrantsWithClient(
  supabase: SupabaseClient,
  authenticatedUserId: string,
): Promise<ProjectContactGrantState> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || user.id !== authenticatedUserId) {
    return {
      status: "unavailable",
      grants: [],
      reason: "The authenticated identity could not be matched to this grant request.",
    };
  }

  const { data, error } = await supabase
    .from("workspace_contact_grants")
    .select(
      "id,workspace_id,project_contact_id,role,capabilities,status,valid_from,valid_until,revoked_at",
    )
    .order("workspace_id");

  if (error) {
    return {
      status: "unavailable",
      grants: [],
      reason: "Project access grants could not be verified.",
    };
  }

  const grants = (data ?? [])
    .map(parseProjectContactGrant)
    .filter((grant) => isEffectiveWorkspaceReadGrant(grant));

  if (grants.length === 0) {
    return {
      status: "no_active_grants",
      grants: [],
      reason: "Identity confirmed, but no active workspace grant was found.",
    };
  }

  return {
    status: "authorized",
    grants,
    reason: `Identity confirmed with access to ${grants.length} workspace${grants.length === 1 ? "" : "s"}.`,
  };
}

export async function loadProjectContactGrants(
  authenticatedUserId: string,
): Promise<ProjectContactGrantState> {
  try {
    const supabase = await createServerSupabaseClient();

    return await loadProjectContactGrantsWithClient(supabase, authenticatedUserId);
  } catch {
    return {
      status: "unavailable",
      grants: [],
      reason: "Project access grants could not be verified.",
    };
  }
}
