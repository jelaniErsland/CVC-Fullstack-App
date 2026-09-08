import "server-only";

import type { AppSupabaseClient, PublicRpcArgs } from "../supabase/types.ts";
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
  "date_of_birth",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relationship",
  "housing_option",
  "after_hours_security_availability",
  "builder_assistant_communication",
  "available_work_days",
  "available_two_plus_days",
  "skills_experience",
  "other_support",
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
  "dateOfBirth", "emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship",
  "housingOption", "afterHoursSecurityAvailability", "builderAssistantCommunication",
  "availableWorkDays", "availableTwoPlusDays", "skillsExperience", "otherSupport",
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
  dateOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  housingOption: "yes" | "no" | "unknown";
  afterHoursSecurityAvailability: "yes" | "no" | "unknown";
  builderAssistantCommunication: "yes" | "no" | "unknown";
  availableWorkDays: readonly string[];
  availableTwoPlusDays: "yes" | "no" | "unknown";
  skillsExperience: string | null;
  otherSupport: string | null;
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

const weekdays = new Set(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
function normalizeTriState(value: unknown) {
  if (value === undefined || value === null || value === "") return "unknown";
  if (value === "yes" || value === "no" || value === "unknown") return value;
  throw new Error("Volunteer availability choice is invalid.");
}
function normalizeDays(value: unknown) {
  if (!Array.isArray(value) || value.some((day) => typeof day !== "string" || !weekdays.has(day))) {
    throw new Error("Volunteer availability days are invalid.");
  }
  return [...new Set(value)];
}
function normalizeDateOfBirth(value: unknown) {
  const date = normalizeNullableString(value);
  if (date === null) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || parsed > new Date()) {
    throw new Error("Volunteer date of birth is invalid.");
  }
  return date;
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
  const dateOfBirth = normalizeDateOfBirth(value.dateOfBirth);
  const emergencyContactName = normalizeNullableString(value.emergencyContactName);
  const emergencyContactPhone = normalizeNullableString(value.emergencyContactPhone);
  const emergencyContactRelationship = normalizeNullableString(value.emergencyContactRelationship);
  const housingOption = normalizeTriState(value.housingOption);
  const afterHoursSecurityAvailability = normalizeTriState(value.afterHoursSecurityAvailability);
  const builderAssistantCommunication = normalizeTriState(value.builderAssistantCommunication);
  const availableWorkDays = normalizeDays(value.availableWorkDays ?? []);
  const availableTwoPlusDays = normalizeTriState(value.availableTwoPlusDays);
  const skillsExperience = normalizeNullableString(value.skillsExperience);
  const otherSupport = normalizeNullableString(value.otherSupport);

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
  for (const field of [emergencyContactName, emergencyContactRelationship]) if (field !== null && field.length > 160) throw new Error("Volunteer private contact is invalid.");
  if (emergencyContactPhone !== null && (emergencyContactPhone.length < 7 || emergencyContactPhone.length > 40 || !/^[0-9A-Za-z()+.\-\s]+$/.test(emergencyContactPhone))) throw new Error("Volunteer private phone is invalid.");
  if ((skillsExperience?.length ?? 0) > 4000 || (otherSupport?.length ?? 0) > 4000) throw new Error("Volunteer support details are too long.");

  return {
    fullName,
    email,
    phone,
    congregation,
    preferredContactMethod,
    lifecycle,
    readinessStatus,
    profileNotes,
    dateOfBirth, emergencyContactName, emergencyContactPhone, emergencyContactRelationship,
    housingOption, afterHoursSecurityAvailability, builderAssistantCommunication,
    availableWorkDays, availableTwoPlusDays, skillsExperience, otherSupport,
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
    dateOfBirth: formData.get("dateOfBirth"),
    emergencyContactName: formData.get("emergencyContactName"),
    emergencyContactPhone: formData.get("emergencyContactPhone"),
    emergencyContactRelationship: formData.get("emergencyContactRelationship"),
    housingOption: formData.get("housingOption"),
    afterHoursSecurityAvailability: formData.get("afterHoursSecurityAvailability"),
    builderAssistantCommunication: formData.get("builderAssistantCommunication"),
    availableWorkDays: formData.getAll("availableWorkDays"),
    availableTwoPlusDays: formData.get("availableTwoPlusDays"),
    skillsExperience: formData.get("skillsExperience"),
    otherSupport: formData.get("otherSupport"),
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
    p_profile: { ...input, availableWorkDays: [...input.availableWorkDays] },
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
    p_profile: { ...input, availableWorkDays: [...input.availableWorkDays] },
  });

  if (error || typeof data !== "string") {
    throw new Error("Volunteer profile could not be updated.", { cause: error });
  }

  return normalizeWorkspaceReference({ id: data }).value;
}

export type VolunteerDeletionResult = "deleted" | "has_history";

export async function deleteHistoryFreeVolunteerProfileWithClient(
  supabase: AppSupabaseClient,
  profileId: string,
): Promise<VolunteerDeletionResult> {
  const normalizedProfileId = normalizeWorkspaceReference({ id: profileId }).value;
  const { data, error } = await supabase.rpc("delete_history_free_volunteer_profile", {
    p_profile_id: normalizedProfileId,
  } as PublicRpcArgs<"delete_history_free_volunteer_profile">);
  if (error || (data !== "deleted" && data !== "has_history")) {
    throw new Error("Volunteer profile could not be deleted.", { cause: error });
  }
  return data;
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
