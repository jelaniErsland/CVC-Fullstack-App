import "server-only";

export type ProjectContactGrant = Readonly<{
  projectId: string;
  role: "main_contact" | "assistant_contact" | "on_site_contact";
  congregationIds: readonly string[];
  capabilities: readonly string[];
}>;

export type ProjectContactGrantState = Readonly<{
  status: "not_implemented";
  grants: readonly ProjectContactGrant[];
  reason: string;
}>;

/**
 * Authentication proves identity only. Project grants are intentionally empty
 * until the contacts/grants persistence slice establishes schema and RLS.
 */
export async function loadProjectContactGrants(
  authenticatedUserId: string,
): Promise<ProjectContactGrantState> {
  void authenticatedUserId;

  return {
    status: "not_implemented",
    grants: [],
    reason: "Project access grants are not connected in this auth-shell slice.",
  };
}
