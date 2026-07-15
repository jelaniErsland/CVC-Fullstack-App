import "server-only";

import type { AppSupabaseClient } from "../supabase/types.ts";
import { parseVolunteerProfile, type VolunteerProfile } from "./profile.ts";
import { normalizeWorkspaceReference } from "../workspaces/identity.ts";

export type VolunteerProfileConversionResult = Readonly<{
  profileId: string;
}>;

const volunteerProfileColumns = [
  "id",
  "workspace_id",
  "source_submission_id",
  "profile_source",
  "manual_created_by_project_contact_id",
  "manual_created_at",
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

const editableKeys = new Set([
  "fullName",
  "email",
  "phone",
  "congregation",
  "preferredContactMethod",
  "lifecycle",
  "readinessStatus",
  "profileNotes",
]);

export type ManualVolunteerProfileInput = Readonly<{
  fullName: string;
  email: string | null;
  phone: string | null;
  congregation: string | null;
  preferredContactMethod: "Text" | "Phone" | "Email" | null;
  lifecycle: "active" | "inactive" | "archived";
  readinessStatus: "ready" | "on_hold";
  profileNotes: string;
}>;

export async function convertQuestionnaireSubmissionWithClient(
  supabase: AppSupabaseClient,
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

function normalizeNullableString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeRequiredString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function normalizeNotes(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function assertOnlyEditableKeys(value: Record<string, unknown>) {
  for (const key of Object.keys(value)) {
    if (!editableKeys.has(key)) {
      throw new Error("Volunteer profile input contains unsupported fields.");
    }
  }
}

export function normalizeManualVolunteerProfileInput(
  value: Record<string, unknown>,
): ManualVolunteerProfileInput {
  assertOnlyEditableKeys(value);

  const fullName = normalizeRequiredString(value.fullName);
  const email = normalizeNullableString(value.email);
  const phone = normalizeNullableString(value.phone);
  const congregation = normalizeNullableString(value.congregation);
  const preferredContactMethod = normalizeNullableString(value.preferredContactMethod);
  const lifecycle = value.lifecycle ?? "active";
  const readinessStatus = value.readinessStatus ?? "ready";
  const profileNotes = normalizeNotes(value.profileNotes);

  if (fullName.length < 1 || fullName.length > 160) {
    throw new Error("Volunteer name is required.");
  }
  if (
    email !== null &&
    (email.length < 3 ||
      email.length > 254 ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
  ) {
    throw new Error("Volunteer email is invalid.");
  }
  if (
    phone !== null &&
    (phone.length < 7 ||
      phone.length > 40 ||
      !/^[0-9A-Za-z()+.\-\s]+$/.test(phone))
  ) {
    throw new Error("Volunteer phone is invalid.");
  }
  if (email === null && phone === null) {
    throw new Error("Volunteer email or phone is required.");
  }
  if (congregation !== null && (congregation.length < 1 || congregation.length > 160)) {
    throw new Error("Volunteer congregation is invalid.");
  }
  if (
    preferredContactMethod !== null &&
    preferredContactMethod !== "Text" &&
    preferredContactMethod !== "Phone" &&
    preferredContactMethod !== "Email"
  ) {
    throw new Error("Volunteer preferred contact method is invalid.");
  }
  if (lifecycle !== "active" && lifecycle !== "inactive" && lifecycle !== "archived") {
    throw new Error("Volunteer lifecycle is invalid.");
  }
  if (readinessStatus !== "ready" && readinessStatus !== "on_hold") {
    throw new Error("Volunteer readiness status is invalid.");
  }
  if (profileNotes.length > 4000) {
    throw new Error("Volunteer notes are too long.");
  }

  return {
    fullName,
    email,
    phone,
    congregation,
    preferredContactMethod,
    lifecycle,
    readinessStatus,
    profileNotes,
  };
}

export function manualVolunteerInputFromFormData(formData: FormData) {
  return normalizeManualVolunteerProfileInput({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    congregation: formData.get("congregation"),
    preferredContactMethod: formData.get("preferredContactMethod"),
    lifecycle: formData.get("lifecycle") ?? "active",
    readinessStatus: formData.get("readinessStatus") ?? "ready",
    profileNotes: formData.get("profileNotes"),
  });
}

export async function createManualVolunteerProfileWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
  input: ManualVolunteerProfileInput,
) {
  const normalizedWorkspaceId = normalizeWorkspaceReference({ id: workspaceId }).value;
  const { data, error } = await supabase.rpc("create_manual_volunteer_profile", {
    p_workspace_id: normalizedWorkspaceId,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone,
    p_congregation: input.congregation,
    p_preferred_contact_method: input.preferredContactMethod,
    p_readiness_status: input.readinessStatus,
    p_profile_notes: input.profileNotes,
  });

  if (error || typeof data !== "string") {
    throw new Error("Volunteer profile could not be created.", { cause: error });
  }

  return normalizeWorkspaceReference({ id: data }).value;
}

export async function updateVolunteerProfileManualFieldsWithClient(
  supabase: AppSupabaseClient,
  profileId: string,
  input: ManualVolunteerProfileInput,
) {
  const normalizedProfileId = normalizeWorkspaceReference({ id: profileId }).value;
  const { data, error } = await supabase.rpc("update_volunteer_profile_manual_fields", {
    p_profile_id: normalizedProfileId,
    p_full_name: input.fullName,
    p_email: input.email,
    p_phone: input.phone,
    p_congregation: input.congregation,
    p_preferred_contact_method: input.preferredContactMethod,
    p_lifecycle: input.lifecycle,
    p_readiness_status: input.readinessStatus,
    p_profile_notes: input.profileNotes,
  });

  if (error || typeof data !== "string") {
    throw new Error("Volunteer profile could not be updated.", { cause: error });
  }

  return normalizeWorkspaceReference({ id: data }).value;
}

export async function convertQuestionnaireSubmissionToVolunteerProfile(
  submissionId: string,
) {
  const { createServerSupabaseClient } = await import("../supabase/server.ts");
  const supabase = await createServerSupabaseClient();
  return convertQuestionnaireSubmissionWithClient(supabase, submissionId);
}

export async function readVolunteerProfilesWithClient(
  supabase: AppSupabaseClient,
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
  const { createServerSupabaseClient } = await import("../supabase/server.ts");
  const supabase = await createServerSupabaseClient();
  return readVolunteerProfilesWithClient(supabase, workspaceId);
}
