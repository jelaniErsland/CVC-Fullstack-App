import "server-only";

import { isEffectiveWorkspaceReadGrant } from "@/lib/auth/grant";
import { resolveVerifiedAdminContext } from "@/lib/auth/verified-admin-context.server";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";
import {
  normalizeVolunteerFacingContactDetailsInput,
  type VolunteerFacingContactDetails,
  type VolunteerFacingContactDetailsInput,
} from "./volunteerFacingDetails";

export {
  normalizeVolunteerFacingContactDetailsInput,
  VolunteerFacingContactDetailsValidationError,
} from "./volunteerFacingDetails";

export async function readCurrentVolunteerFacingContactDetailsWithClient(
  supabase: AppSupabaseClient,
  projectContactId: string,
): Promise<VolunteerFacingContactDetails | null> {
  const { data, error } = await supabase
    .from("project_contacts")
    .select("volunteer_facing_display_name,volunteer_facing_email,volunteer_facing_phone")
    .eq("id", projectContactId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return {
    displayName:
      typeof data.volunteer_facing_display_name === "string"
        ? data.volunteer_facing_display_name
        : null,
    email:
      typeof data.volunteer_facing_email === "string" ? data.volunteer_facing_email : null,
    phone:
      typeof data.volunteer_facing_phone === "string" ? data.volunteer_facing_phone : null,
  };
}

export async function updateCurrentVolunteerFacingContactDetailsWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
  input: VolunteerFacingContactDetailsInput | unknown,
) {
  const details = normalizeVolunteerFacingContactDetailsInput(input);
  const { data, error } = await supabase.rpc(
    "update_current_project_contact_volunteer_facing_details",
    {
      p_workspace_id: workspaceId,
      p_display_name: details.displayName,
      p_email: details.email,
      p_phone: details.phone ?? "",
    } as PublicRpcArgs<"update_current_project_contact_volunteer_facing_details">,
  );
  if (error || data !== true) {
    throw new Error("Follow-up Contact details could not be saved.", { cause: error });
  }
  return details;
}

export async function updateCurrentVolunteerFacingContactDetails(
  input: VolunteerFacingContactDetailsInput | unknown,
) {
  const verifiedResult = await resolveVerifiedAdminContext();
  if (verifiedResult.kind !== "ready") return null;
  const verified = verifiedResult.context;
  const activeWorkspaceIds = new Set(
    verified.workspaces
      .filter((workspace) => workspace.lifecycle === "active")
      .map((workspace) => workspace.id),
  );
  const trustedWorkspaceIds = [
    ...new Set(
      verified.ownGrants
        .filter(
          (grant) =>
            grant.projectContactId === verified.projectContactId &&
            isEffectiveWorkspaceReadGrant(grant) &&
            activeWorkspaceIds.has(grant.workspaceId),
        )
        .map((grant) => grant.workspaceId),
    ),
  ];
  if (trustedWorkspaceIds.length !== 1) return null;
  return updateCurrentVolunteerFacingContactDetailsWithClient(
    verified.supabase,
    trustedWorkspaceIds[0],
    input,
  );
}
