import "server-only";

import {
  isEffectiveWorkspaceReadGrant,
  type ProjectContactGrant,
} from "../auth/grant.ts";
import type { WorkspaceIdentity } from "../workspaces/identity.ts";
import {
  readVolunteerProfilesWithClient,
  type ManualVolunteerProfileInput,
} from "./server.ts";
import type { VolunteerProfile } from "./profile.ts";

export type VolunteerManagementReadyRouteState = Readonly<{
  kind: "ready_with_profiles" | "ready_empty";
  workspaceName: string;
  canEdit: boolean;
  profiles: readonly VolunteerProfile[];
  notice: VolunteerManagementNotice | null;
}>;

export type VolunteerManagementRouteState =
  | VolunteerManagementReadyRouteState
  | Readonly<{
      kind: "unavailable" | "error";
      title: string;
      message: string;
      notice: VolunteerManagementNotice | null;
    }>;

export type VolunteerManagementNotice =
  | "created"
  | "updated"
  | "validation"
  | "unavailable"
  | "error";

type VolunteerRouteWorkspaceSelection =
  | Readonly<{
      ok: true;
      workspace: WorkspaceIdentity;
      projectContactId: string;
      canEdit: boolean;
      capabilities: readonly string[];
    }>
  | Readonly<{
      ok: false;
      reason:
        | "unauthorized"
        | "missing_volunteers_view"
        | "workspace_unavailable";
    }>;

export const VOLUNTEER_PROFILE_MANAGEMENT_ROUTE_CUTOVER_IMPLEMENTED = true;
export const VOLUNTEER_PROFILE_MANAGEMENT_PERSISTED_TRUTH_SOURCE = true;
export const VOLUNTEER_PROFILE_MANAGEMENT_MOCK_FALLBACK_ALLOWED = false;
export const VOLUNTEER_PROFILE_MANAGEMENT_SERVICE_ROLE_AVAILABLE = false;
export const VOLUNTEER_PROFILE_MANAGEMENT_MANUAL_CREATE_AVAILABLE = true;
export const VOLUNTEER_PROFILE_MANAGEMENT_MANUAL_EDIT_AVAILABLE = true;
export const VOLUNTEER_PROFILE_MANAGEMENT_BROWSER_PROVENANCE_INPUT_ALLOWED = false;
export const VOLUNTEER_PROFILE_MANAGEMENT_RESPONSE_LINK_REOPENED = false;

export function selectVolunteerManagementWorkspaceContext(input: {
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
}): VolunteerRouteWorkspaceSelection {
  if (input.ownGrants.length === 0) return { ok: false, reason: "unauthorized" };

  const activeWorkspaces = new Map(
    input.workspaces
      .filter((workspace) => workspace.lifecycle === "active")
      .map((workspace) => [workspace.id, workspace]),
  );
  const workspaceCapabilities = new Map<
    string,
    { workspace: WorkspaceIdentity; capabilities: Set<string> }
  >();

  for (const grant of input.ownGrants) {
    if (grant.projectContactId !== input.projectContactId) continue;
    if (!isEffectiveWorkspaceReadGrant(grant)) continue;
    const workspace = activeWorkspaces.get(grant.workspaceId);
    if (!workspace) continue;
    const existing = workspaceCapabilities.get(workspace.id) ?? {
      workspace,
      capabilities: new Set<string>(),
    };
    for (const capability of grant.capabilities) existing.capabilities.add(capability);
    workspaceCapabilities.set(workspace.id, existing);
  }

  if (workspaceCapabilities.size === 0) {
    return { ok: false, reason: "workspace_unavailable" };
  }

  const eligible = [...workspaceCapabilities.values()].filter(({ capabilities }) =>
    capabilities.has("volunteers.view"),
  );

  if (eligible.length === 1) {
    return {
      ok: true,
      workspace: eligible[0].workspace,
      projectContactId: input.projectContactId,
      canEdit: eligible[0].capabilities.has("volunteers.edit"),
      capabilities: [...eligible[0].capabilities].sort(),
    };
  }

  if (eligible.length > 1) {
    return { ok: false, reason: "workspace_unavailable" };
  }

  return { ok: false, reason: "missing_volunteers_view" };
}

function unavailableState(
  notice: VolunteerManagementNotice | null = null,
): VolunteerManagementRouteState {
  return {
    kind: "unavailable",
    title: "Volunteer profiles are unavailable",
    message:
      "We could not safely open volunteer profiles for this workspace. Check that the signed-in project contact has the right workspace access.",
    notice,
  };
}

function errorState(
  notice: VolunteerManagementNotice | null = null,
): VolunteerManagementRouteState {
  return {
    kind: "error",
    title: "Volunteer profiles could not be loaded",
    message:
      "Something went wrong while loading volunteer profiles. Please try again in a moment.",
    notice,
  };
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeVolunteerManagementNotice(
  value: string | string[] | undefined,
): VolunteerManagementNotice | null {
  const notice = firstSearchParam(value);
  if (
    notice === "created" ||
    notice === "updated" ||
    notice === "validation" ||
    notice === "unavailable" ||
    notice === "error"
  ) {
    return notice;
  }
  return null;
}

export async function readVolunteerManagementRouteContext() {
  const { createServerSupabaseClient } = await import("../supabase/server.ts");
  const {
    loadProjectContactGrantsWithClient,
    readAuthenticatedProjectContactIdWithClient,
  } = await import("../auth/project-contact-grants.ts");
  const { readGrantedWorkspacesWithClient } = await import("../workspaces/granted.ts");

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const grantState = await loadProjectContactGrantsWithClient(supabase, user.id);
  if (grantState.status !== "authorized") return null;
  const projectContactId = await readAuthenticatedProjectContactIdWithClient(
    supabase,
    user.id,
  );
  if (!projectContactId) return null;
  const ownGrants = grantState.grants.filter(
    (grant) => grant.projectContactId === projectContactId,
  );
  if (ownGrants.length === 0) return null;

  const workspaces = await readGrantedWorkspacesWithClient(supabase);
  const workspaceSelection = selectVolunteerManagementWorkspaceContext({
    projectContactId,
    ownGrants,
    workspaces,
  });

  if (!workspaceSelection.ok) return null;

  return {
    supabase,
    user,
    ...workspaceSelection,
  };
}

export async function readVolunteerManagementRouteState(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<VolunteerManagementRouteState> {
  const notice = normalizeVolunteerManagementNotice(searchParams?.notice);

  try {
    const routeContext = await readVolunteerManagementRouteContext();
    if (!routeContext) return unavailableState(notice);

    const profiles = await readVolunteerProfilesWithClient(
      routeContext.supabase,
      routeContext.workspace.id,
    );

    return {
      kind: profiles.length > 0 ? "ready_with_profiles" : "ready_empty",
      workspaceName: routeContext.workspace.displayName,
      canEdit: routeContext.canEdit,
      profiles,
      notice,
    };
  } catch {
    return errorState(notice);
  }
}

export function describeVolunteerProfileManagementCutover() {
  return {
    routeCutoverImplemented: VOLUNTEER_PROFILE_MANAGEMENT_ROUTE_CUTOVER_IMPLEMENTED,
    persistedTruthSource:
      VOLUNTEER_PROFILE_MANAGEMENT_PERSISTED_TRUTH_SOURCE,
    mockFallbackAllowed: VOLUNTEER_PROFILE_MANAGEMENT_MOCK_FALLBACK_ALLOWED,
    serviceRoleAvailable: VOLUNTEER_PROFILE_MANAGEMENT_SERVICE_ROLE_AVAILABLE,
    manualCreateAvailable: VOLUNTEER_PROFILE_MANAGEMENT_MANUAL_CREATE_AVAILABLE,
    manualEditAvailable: VOLUNTEER_PROFILE_MANAGEMENT_MANUAL_EDIT_AVAILABLE,
    browserProvenanceInputAllowed:
      VOLUNTEER_PROFILE_MANAGEMENT_BROWSER_PROVENANCE_INPUT_ALLOWED,
    responseLinkReopened: VOLUNTEER_PROFILE_MANAGEMENT_RESPONSE_LINK_REOPENED,
    routeStates: ["ready_with_profiles", "ready_empty", "unavailable", "error"],
    readCapability: "volunteers.view",
    editCapability: "volunteers.edit",
    mutationBoundary:
      "authenticated_project_contact_plus_trusted_workspace_plus_create_manual_volunteer_profile_or_update_volunteer_profile_manual_fields",
  } as const;
}

export type { ManualVolunteerProfileInput };
