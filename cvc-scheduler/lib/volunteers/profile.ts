export const volunteerWeekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type VolunteerWeekday = (typeof volunteerWeekdays)[number];
export type VolunteerTriState = "yes" | "no" | "unknown";

export type VolunteerProfile = Readonly<{
  id: string;
  workspaceId: string;
  sourceSubmissionId: string | null;
  profileSource: "questionnaire" | "manual";
  manualCreatedByProjectContactId: string | null;
  manualCreatedAt: string | null;
  lifecycle: "active" | "inactive" | "archived";
  readinessStatus: "ready" | "on_hold";
  fullName: string;
  email: string | null;
  phone: string | null;
  congregation: string | null;
  preferredContactMethod: "Text" | "Phone" | "Email" | null;
  availabilitySnapshot: Readonly<Record<string, unknown>>;
  skillsHelpSnapshot: Readonly<Record<string, unknown>>;
  profileNotes: string;
  dateOfBirth: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  housingOption: VolunteerTriState;
  afterHoursSecurityAvailability: VolunteerTriState;
  builderAssistantCommunication: VolunteerTriState;
  availableWorkDays: readonly VolunteerWeekday[];
  availableTwoPlusDays: VolunteerTriState;
  skillsExperience: string | null;
  otherSupport: string | null;
  createdAt: string;
  updatedAt: string;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return value;
}

function nullableString(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (value !== null && typeof value !== "string") {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return value;
}

function snapshot(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (!isRecord(value)) {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return value;
}

function uuid(record: Record<string, unknown>, field: string) {
  const value = requiredString(record, field).toLowerCase();
  if (!uuidPattern.test(value)) {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return value;
}

function nullableUuid(record: Record<string, unknown>, field: string) {
  const value = nullableString(record, field);
  if (value === null) return null;
  const normalizedValue = value.toLowerCase();
  if (!uuidPattern.test(normalizedValue)) {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return normalizedValue;
}

function triState(record: Record<string, unknown>, field: string): VolunteerTriState {
  const value = record[field];
  if (value !== "yes" && value !== "no" && value !== "unknown") {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return value;
}

function weekdayList(record: Record<string, unknown>, field: string): readonly VolunteerWeekday[] {
  const value = record[field];
  if (!Array.isArray(value) || value.some((day) => !volunteerWeekdays.includes(day as VolunteerWeekday))) {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return value as VolunteerWeekday[];
}

export function parseVolunteerProfile(value: unknown): VolunteerProfile {
  if (!isRecord(value)) {
    throw new Error("Volunteer profile read returned an invalid row.");
  }

  const profileSource = value.profile_source;
  const lifecycle = value.lifecycle;
  const readinessStatus = value.readiness_status;
  const preferredContactMethod = value.preferred_contact_method;
  if (profileSource !== "questionnaire" && profileSource !== "manual") {
    throw new Error("Volunteer profile has an invalid profile source.");
  }
  if (lifecycle !== "active" && lifecycle !== "inactive" && lifecycle !== "archived") {
    throw new Error("Volunteer profile has an invalid lifecycle.");
  }
  if (readinessStatus !== "ready" && readinessStatus !== "on_hold") {
    throw new Error("Volunteer profile has an invalid readiness status.");
  }
  if (
    preferredContactMethod !== null &&
    preferredContactMethod !== "Text" &&
    preferredContactMethod !== "Phone" &&
    preferredContactMethod !== "Email"
  ) {
    throw new Error("Volunteer profile has an invalid preferred contact method.");
  }

  return {
    id: uuid(value, "id"),
    workspaceId: uuid(value, "workspace_id"),
    sourceSubmissionId: nullableUuid(value, "source_submission_id"),
    profileSource,
    manualCreatedByProjectContactId: nullableUuid(
      value,
      "manual_created_by_project_contact_id",
    ),
    manualCreatedAt: nullableString(value, "manual_created_at"),
    lifecycle,
    readinessStatus,
    fullName: requiredString(value, "full_name"),
    email: nullableString(value, "email"),
    phone: nullableString(value, "phone"),
    congregation: nullableString(value, "congregation"),
    preferredContactMethod,
    availabilitySnapshot: snapshot(value, "availability_snapshot"),
    skillsHelpSnapshot: snapshot(value, "skills_help_snapshot"),
    profileNotes: requiredStringOrEmpty(value, "profile_notes"),
    dateOfBirth: nullableString(value, "date_of_birth"),
    emergencyContactName: nullableString(value, "emergency_contact_name"),
    emergencyContactPhone: nullableString(value, "emergency_contact_phone"),
    emergencyContactRelationship: nullableString(value, "emergency_contact_relationship"),
    housingOption: triState(value, "housing_option"),
    afterHoursSecurityAvailability: triState(value, "after_hours_security_availability"),
    builderAssistantCommunication: triState(value, "builder_assistant_communication"),
    availableWorkDays: weekdayList(value, "available_work_days"),
    availableTwoPlusDays: triState(value, "available_two_plus_days"),
    skillsExperience: nullableString(value, "skills_experience"),
    otherSupport: nullableString(value, "other_support"),
    createdAt: requiredString(value, "created_at"),
    updatedAt: requiredString(value, "updated_at"),
  };
}

export function volunteerAge(dateOfBirth: string | null, today = new Date()): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  return today.getFullYear() - year - (today < birthdayThisYear ? 1 : 0);
}

export function volunteerOperationalSummary(volunteer: VolunteerProfile): string | null {
  const parts: string[] = [];
  if (volunteer.availableWorkDays.length) {
    const labels = volunteer.availableWorkDays.map((day) => day.slice(0, 3));
    parts.push(labels.length > 1 ? `${labels[0]}–${labels.at(-1)}` : labels[0]);
  }
  if (volunteer.availableTwoPlusDays === "yes") parts.push("2+ days/week");
  if (volunteer.afterHoursSecurityAvailability === "yes") parts.push("Security");
  if (volunteer.housingOption === "yes") parts.push("Housing possible");
  return parts.length ? parts.join(" · ") : null;
}

function requiredStringOrEmpty(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return value;
}
