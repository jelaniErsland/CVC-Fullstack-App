import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseVolunteerProfile, type VolunteerProfile } from "@/lib/volunteers/profile";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";

export type VolunteerProfileConversionResult = Readonly<{
  profileId: string;
}>;

const volunteerProfileColumns = [
  "id",
  "workspace_id",
  "source_submission_id",
  "lifecycle",
  "readiness_status",
  "full_name",
  "email",
  "phone",
  "congregation",
  "preferred_contact_method",
  "availability_snapshot",
  "skills_help_snapshot",
  "profile_notes",
  "created_at",
  "updated_at",
].join(",");

export async function convertQuestionnaireSubmissionWithClient(
  supabase: SupabaseClient,
  submissionId: string,
): Promise<VolunteerProfileConversionResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Volunteer profile conversion requires an authenticated contact.");
  }

  const normalizedSubmissionId = normalizeWorkspaceReference({ id: submissionId }).value;
  const { data, error } = await supabase.rpc(
    "convert_questionnaire_submission_to_volunteer_profile",
    { p_submission_id: normalizedSubmissionId },
  );

  if (error || typeof data !== "string") {
    throw new Error("Volunteer profile conversion could not be completed.", {
      cause: error,
    });
  }

  return {
    profileId: normalizeWorkspaceReference({ id: data }).value,
  };
}

export async function convertQuestionnaireSubmissionToVolunteerProfile(
  submissionId: string,
) {
  const supabase = await createServerSupabaseClient();
  return convertQuestionnaireSubmissionWithClient(supabase, submissionId);
}

export async function readVolunteerProfilesWithClient(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<readonly VolunteerProfile[]> {
  const normalizedWorkspaceId = normalizeWorkspaceReference({ id: workspaceId }).value;
  const { data, error } = await supabase
    .from("volunteer_profiles")
    .select(volunteerProfileColumns)
    .eq("workspace_id", normalizedWorkspaceId)
    .order("full_name");

  if (error) {
    throw new Error("Volunteer profiles could not be read.", { cause: error });
  }

  return (data ?? []).map(parseVolunteerProfile);
}

export async function readCurrentContactVolunteerProfiles(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  return readVolunteerProfilesWithClient(supabase, workspaceId);
}

