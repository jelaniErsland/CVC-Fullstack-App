export type VolunteerProfile = Readonly<{
  id: string;
  workspaceId: string;
  sourceSubmissionId: string;
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

export function parseVolunteerProfile(value: unknown): VolunteerProfile {
  if (!isRecord(value)) {
    throw new Error("Volunteer profile read returned an invalid row.");
  }

  const lifecycle = value.lifecycle;
  const readinessStatus = value.readiness_status;
  const preferredContactMethod = value.preferred_contact_method;
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
    sourceSubmissionId: uuid(value, "source_submission_id"),
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
    createdAt: requiredString(value, "created_at"),
    updatedAt: requiredString(value, "updated_at"),
  };
}

function requiredStringOrEmpty(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`Volunteer profile has an invalid ${field}.`);
  }
  return value;
}
