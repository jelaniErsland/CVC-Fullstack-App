import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PROJECT_DAY_EXPECTED_ON_SITE_MAX,
  ProjectDayValidationError,
  selectOperationalWorkspace,
  validateSetProjectDayExpectedOnSiteInput,
} from "../lib/operations/projectDay.ts";
import {
  buildFoodOperationalProjection,
  buildQuickViewSafeProjection,
  operationalVisibilityContract,
  quickViewExplicitlyExcludedFields,
} from "../lib/operations/projections.ts";
import {
  projectSchedulerFacetsFromProfile,
  schedulerFacetContract,
  schedulerFacetDefinitionIsSupported,
  schedulerFacetDefinitions,
} from "../lib/questionnaires/schedulerFacets.ts";

const root = process.cwd();
const migration = await readFile(
  path.join(root, "supabase", "migrations", "20260829130000_project_day_operational_foundation.sql"),
  "utf8",
);
const projectDayServer = await readFile(
  path.join(root, "lib", "operations", "projectDay.server.ts"),
  "utf8",
);
const quickViewServer = await readFile(
  path.join(root, "lib", "operations", "projectQuickView.server.ts"),
  "utf8",
);
const facetsServer = await readFile(
  path.join(root, "lib", "questionnaires", "schedulerFacets.server.ts"),
  "utf8",
);

assert.match(migration, /create table public\.project_days/i);
assert.match(migration, /unique \(workspace_id, project_date\)/i);
assert.match(migration, /expected_on_site_count is null or expected_on_site_count >= 0/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /force row level security/i);
assert.match(migration, /revoke all privileges on table public\.project_days from anon, authenticated, PUBLIC/i);
assert.match(migration, /grant select on table public\.project_days to authenticated/i);
assert.match(migration, /capabilities @> array\['workspace\.read', 'calendar\.view'\]/i);
assert.match(migration, /capabilities @> array\['workspace\.read', 'calendar\.edit'\]/i);
assert.match(migration, /security definer[\s\S]*set search_path = ''/i);
assert.doesNotMatch(migration, /service_role/i);
assert.doesNotMatch(migration, /food_expected|security_expected|assignment.*count.*expected/i);
assert.doesNotMatch(
  migration,
  /set_current_project_day_expected_on_site\s*\([\s\S]*p_workspace_id/i,
  "The Project Day mutation must not accept browser-selected workspace authority.",
);

for (const expectedOnSiteCount of [null, 0, 1, 275]) {
  assert.deepEqual(
    validateSetProjectDayExpectedOnSiteInput({
      date: "2026-09-14",
      expectedOnSiteCount,
    }),
    { date: "2026-09-14", expectedOnSiteCount },
  );
}
for (const invalidCount of [-1, 1.5, PROJECT_DAY_EXPECTED_ON_SITE_MAX + 1, "4", undefined]) {
  assert.throws(
    () => validateSetProjectDayExpectedOnSiteInput({ date: "2026-09-14", expectedOnSiteCount: invalidCount }),
    ProjectDayValidationError,
  );
}
for (const invalidDate of ["", "2026-02-30", "09/14/2026", null]) {
  assert.throws(
    () => validateSetProjectDayExpectedOnSiteInput({ date: invalidDate, expectedOnSiteCount: 4 }),
    ProjectDayValidationError,
  );
}
assert.throws(
  () => validateSetProjectDayExpectedOnSiteInput({
    date: "2026-09-14",
    expectedOnSiteCount: 4,
    workspaceId: "browser-supplied",
  }),
  ProjectDayValidationError,
);

const workspace = {
  id: "10000000-0000-4000-8000-000000000001",
  key: "operational-one",
  displayName: "Operational One",
  lifecycle: "active",
  timezone: "America/Denver",
  startsOn: null,
  endsOn: null,
  publicIntakeEnabled: false,
  createdAt: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z",
};
const contactId = "20000000-0000-4000-8000-000000000001";
const activeGrant = {
  id: "30000000-0000-4000-8000-000000000001",
  workspaceId: workspace.id,
  projectContactId: contactId,
  role: "main_contact",
  capabilities: ["workspace.read", "calendar.view", "calendar.edit", "volunteers.view"],
  status: "active",
  validFrom: "2026-01-01T00:00:00Z",
  validUntil: null,
  revokedAt: null,
};
assert.equal(selectOperationalWorkspace({
  projectContactId: contactId,
  ownGrants: [activeGrant],
  workspaces: [workspace],
  requiredCapability: "calendar.view",
  at: new Date("2026-08-31T12:00:00Z"),
}).ok, true);
assert.deepEqual(selectOperationalWorkspace({
  projectContactId: contactId,
  ownGrants: [{ ...activeGrant, capabilities: ["workspace.read"] }],
  workspaces: [workspace],
  requiredCapability: "calendar.view",
  at: new Date("2026-08-31T12:00:00Z"),
}), { ok: false, reason: "missing_capability" });
assert.equal(selectOperationalWorkspace({
  projectContactId: contactId,
  ownGrants: [activeGrant, { ...activeGrant, id: "30000000-0000-4000-8000-000000000002", workspaceId: "10000000-0000-4000-8000-000000000002" }],
  workspaces: [workspace, { ...workspace, id: "10000000-0000-4000-8000-000000000002", key: "operational-two" }],
  requiredCapability: "calendar.view",
  at: new Date("2026-08-31T12:00:00Z"),
}).ok, false, "Ambiguous authorized project selection must fail closed.");

const projectDay = {
  date: "2026-09-14",
  expectedOnSiteCount: 275,
  createdAt: "2026-08-31T00:00:00Z",
  updatedAt: "2026-08-31T00:00:00Z",
};
const common = {
  startDate: "2026-09-14",
  endDate: null,
  startTime: "08:00:00",
  endTime: "12:00:00",
  neededCount: 3,
  lifecycle: "active",
  publicationState: "published",
};
const schedule = [
  { ...common, title: "General setup", taskType: "general", scheduleKind: "timed", volunteerEmail: "forbidden@example.invalid" },
  { ...common, title: "Lunch service", taskType: "food", scheduleKind: "date_based", startTime: null, endTime: null },
  { ...common, title: "Restricted gate detail", taskType: "security", scheduleKind: "timed", scheduleNotes: "forbidden" },
  { ...common, title: "Private draft", taskType: "general", scheduleKind: "timed", publicationState: "draft" },
];
const quickView = buildQuickViewSafeProjection({
  projectDisplayName: "Bozeman",
  date: "2026-09-14",
  projectDay,
  schedule,
});
assert.deepEqual(Object.keys(quickView).sort(), [
  "date",
  "expectedOnSiteCount",
  "projectDisplayName",
  "publishedSchedule",
]);
assert.deepEqual(quickView.publishedSchedule.map((item) => item.title), ["General setup", "Lunch service"]);
assert.deepEqual(Object.keys(quickView.publishedSchedule[0]).sort(), [
  "category",
  "plannedStaffingCount",
  "schedule",
  "title",
]);
assert.deepEqual(Object.keys(quickView.publishedSchedule[0].schedule).sort(), [
  "endTime",
  "kind",
  "startTime",
]);
const serializedQuickView = JSON.stringify(quickView);
for (const forbiddenValue of [
  "forbidden@example.invalid",
  "Restricted gate detail",
  "Private draft",
  "scheduleNotes",
  "workspaceId",
  "assignmentId",
  "questionnaire",
  "token",
]) assert.equal(serializedQuickView.includes(forbiddenValue), false, `Quick View leaked ${forbiddenValue}.`);
assert(quickViewExplicitlyExcludedFields.includes("security_category_work"));

const food = buildFoodOperationalProjection({ date: "2026-09-14", projectDay, schedule });
assert.equal(food.expectedOnSiteCount, 275);
assert.deepEqual(food.publishedFoodSchedule.map((item) => item.title), ["Lunch service"]);
assert.equal(operationalVisibilityContract.securityAuthorized.generalProjectionFallbackAllowed, false);
assert.equal(operationalVisibilityContract.adminProjectContact.broadModelMayBeUsedAsQuickViewOutput, false);

assert.equal(schedulerFacetDefinitions.length, 3);
assert(schedulerFacetDefinitions.every(schedulerFacetDefinitionIsSupported));
assert.equal(schedulerFacetDefinitionIsSupported({ valueType: "raw_json", sourceSnapshot: "skills_help_snapshot", sourcePath: [], allowedValues: [] }), false);
const facets = projectSchedulerFacetsFromProfile({
  volunteerProfileId: "40000000-0000-4000-8000-000000000001",
  congregation: "Bozeman North",
  availabilitySnapshot: {
    weekdays: ["Monday", "Saturday"],
    preferredTimes: ["Morning"],
    notes: "private availability note",
  },
  skillsHelpSnapshot: {
    skillsExperience: {
      categories: ["Electrical assist", "Food service"],
      details: "private free text",
      physicalWorkNotes: "private physical note",
    },
    otherWaysToHelp: { medicalSupport: true },
  },
});
assert.deepEqual(facets, {
  volunteerProfileId: "40000000-0000-4000-8000-000000000001",
  congregation: "Bozeman North",
  skillTags: ["Electrical assist", "Food service"],
  availability: { weekdays: ["Monday", "Saturday"], preferredTimes: ["Morning"] },
  keywordTerms: ["bozeman north", "electrical assist", "food service"],
});
const serializedFacets = JSON.stringify(facets);
for (const forbidden of ["private availability note", "private free text", "private physical note", "medicalSupport", "birthdate", "ageBand"])
  assert.equal(serializedFacets.includes(forbidden), false, `Scheduler facets leaked ${forbidden}.`);
assert.deepEqual(projectSchedulerFacetsFromProfile({
  volunteerProfileId: "40000000-0000-4000-8000-000000000002",
  congregation: null,
  availabilitySnapshot: { weekdays: ["Sunday"], preferredTimes: "Morning" },
  skillsHelpSnapshot: { skillsExperience: { categories: ["Unapproved skill"] } },
}), {
  volunteerProfileId: "40000000-0000-4000-8000-000000000002",
  congregation: null,
  skillTags: [],
  availability: { weekdays: [], preferredTimes: [] },
  keywordTerms: [],
});
assert.equal(schedulerFacetContract.rawQuestionnaireReadAllowed, false);
assert.equal(schedulerFacetContract.prototypeOrMockSourceAllowed, false);
assert.equal(schedulerFacetContract.explicitlyUnsupported.age, "not_collected");
assert.equal(schedulerFacetContract.extensionSeams.authorizationArchitectureChangeRequired, false);

assert.match(projectDayServer, /^import "server-only";/);
assert.match(quickViewServer, /^import "server-only";/);
assert.match(facetsServer, /^import "server-only";/);
assert.deepEqual([...quickViewServer.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]), ["project_days", "calendar_items"]);
assert.deepEqual([...facetsServer.matchAll(/\.from\("([^"]+)"\)/g)].map((match) => match[1]), ["volunteer_profiles"]);
for (const source of [projectDayServer, quickViewServer, facetsServer]) {
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
  assert.doesNotMatch(source, /select\(\s*["'`]\*["'`]\s*\)/i);
}
assert.doesNotMatch(facetsServer, /questionnaire_submissions|answers|emergency_contact/i);
assert.doesNotMatch(quickViewServer, /calendar_assignments|volunteer_profiles|questionnaire|token|delivery/i);

console.log("Operational data foundation contract regression checks passed.");
console.log("Project Day, safe Quick View, scheduler facets, and Food/Security separation are fail-closed.");
