import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeManualVolunteerProfileInput } from "../lib/volunteers/server.ts";
import { validateQuestionnaireSubmissionPayload } from "../lib/questionnaires/payload.ts";

const root = process.cwd();
async function source(file) { return readFile(path.join(root, file), "utf8"); }

const completeProfile = {
  fullName: "Complete Volunteer", email: "complete@example.invalid", phone: "406-555-1212",
  congregation: "Bozeman", preferredContactMethod: "Email", lifecycle: "active", readinessStatus: "ready", profileNotes: "",
  dateOfBirth: "1994-06-10", emergencyContactName: "Emergency Person", emergencyContactPhone: "406-555-2323", emergencyContactRelationship: "Friend",
  housingOption: "yes", afterHoursSecurityAvailability: "yes", builderAssistantCommunication: "unknown",
  availableWorkDays: ["Tuesday", "Wednesday", "Thursday"], availableTwoPlusDays: "yes", skillsExperience: "Painting", otherSupport: "Housing support",
};

const validQuestionnaire = {
  aboutYou: { name: "Questionnaire Volunteer", email: "q@example.invalid", phone: "406-555-1212", congregation: "Bozeman", preferredContactMethod: "Email", dateOfBirth: "1994-06-10", builderAssistantCommunication: "yes" },
  availability: { weekdays: ["Tuesday", "Wednesday"], preferredTimes: ["Morning"], notes: "", availableTwoPlusDays: "yes", afterHoursSecurityAvailability: "yes" },
  skillsExperience: { categories: ["Painting"], maintenanceTaskCards: false, details: "Paint", physicalWorkNotes: "" },
  emergencyContact: { name: "Emergency Person", relationship: "Friend", phone: "406-555-2323" },
  otherWaysToHelp: { selected: { housing: false, transportation: false, laundryDryCleaning: false, housekeeping: false, hairCare: false, medicalSupport: false, foodService: false }, other: "", notes: "", housingOption: "unknown" },
};

async function run() {
  const migration = await source("supabase/migrations/20260908120000_volunteer_profile_questionnaire_expansion.sql");
  const profile = await source("lib/volunteers/profile.ts");
  const server = await source("lib/volunteers/server.ts");
  const directory = await source("components/VolunteerDirectory.tsx");
  const card = await source("components/VolunteerCard.tsx");
  const quickView = await source("app/admin/quick-view/page.tsx");
  const schedule = await source("lib/volunteerScheduleAccess/server.ts");
  assert.match(migration, /add column date_of_birth date/);
  assert.match(migration, /add column emergency_contact_name text/);
  assert.match(migration, /'unknown'/);
  assert.match(migration, /drop function public\.create_manual_volunteer_profile\(uuid,text/);
  assert.match(migration, /create_manual_volunteer_profile\(p_workspace_id uuid, p_profile jsonb\)/);
  assert.match(migration, /update_volunteer_profile_manual_fields\(p_profile_id uuid, p_profile jsonb\)/);
  assert.match(migration, /grant execute on function public\.create_manual_volunteer_profile\(uuid,jsonb\) to authenticated/);
  assert.doesNotMatch(migration, /grant execute.*to anon/i);
  assert.deepEqual(normalizeManualVolunteerProfileInput(completeProfile).availableWorkDays, ["Tuesday", "Wednesday", "Thursday"]);
  assert.equal(normalizeManualVolunteerProfileInput({ ...completeProfile, housingOption: "unknown" }).housingOption, "unknown");
  assert.throws(() => normalizeManualVolunteerProfileInput({ ...completeProfile, availableWorkDays: ["Monday", "Invalid"] }));
  assert.deepEqual(validateQuestionnaireSubmissionPayload(validQuestionnaire).availability.weekdays, ["Tuesday", "Wednesday"]);
  assert.deepEqual(validateQuestionnaireSubmissionPayload({ ...validQuestionnaire, aboutYou: { ...validQuestionnaire.aboutYou, dateOfBirth: undefined } }).aboutYou.name, "Questionnaire Volunteer");
  assert.match(profile, /volunteerOperationalSummary/);
  assert.match(server, /availableWorkDays: formData\.getAll/);
  assert.match(directory, /Advanced filters/);
  assert.match(directory, /skillsExperience/);
  assert.match(card, /Private info/);
  for (const sensitive of ["date_of_birth", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship"]) {
    assert.doesNotMatch(`${quickView}\n${schedule}`, new RegExp(sensitive));
  }
  console.log("Volunteer profile expansion regression: PASS");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
