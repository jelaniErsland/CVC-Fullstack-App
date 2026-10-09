import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { adminViewKey, defaultAdminViews, readAdminView, writeAdminView } from "../lib/adminViews/preferences.ts";
import { filterAttentionIssues, groupAttentionIssues } from "../lib/needsAttention/issues.ts";

const contactA = "11111111-1111-4111-8111-111111111111";
const contactB = "22222222-2222-4222-8222-222222222222";
const projectA = "33333333-3333-4333-8333-333333333333";
const projectB = "44444444-4444-4444-8444-444444444444";
const scope = { contactId: contactA, workspaceId: projectA };
const contents = new Map();
const storage = { getItem: key => contents.get(key) ?? null, setItem: (key, value) => contents.set(key, value) };

assert.notEqual(adminViewKey(scope, "attention"), adminViewKey({ ...scope, contactId: contactB }, "attention"));
assert.notEqual(adminViewKey(scope, "attention"), adminViewKey({ ...scope, workspaceId: projectB }, "attention"));
assert.notEqual(adminViewKey(scope, "attention"), adminViewKey(scope, "calendar"));
assert.equal(adminViewKey({ ...scope, contactId: "not-a-contact" }, "attention"), null);
writeAdminView(storage, scope, "attention", { supportTypes: ["security"], categories: ["declined"], horizon: "30", status: "reviewed", sort: "urgent" });
assert.deepEqual(readAdminView(storage, scope, "attention").supportTypes, ["security"]);
assert.deepEqual(readAdminView(storage, { ...scope, contactId: contactB }, "attention"), defaultAdminViews.attention);
assert.deepEqual(readAdminView(storage, { ...scope, workspaceId: projectB }, "attention"), defaultAdminViews.attention);
assert.deepEqual(readAdminView(storage, scope, "calendar"), defaultAdminViews.calendar);
contents.set(adminViewKey(scope, "attention"), JSON.stringify({ version: 99, surface: "attention", value: { supportTypes: ["security"] } }));
assert.deepEqual(readAdminView(storage, scope, "attention"), defaultAdminViews.attention);
contents.set(adminViewKey(scope, "attention"), "invalid-json");
assert.deepEqual(readAdminView(storage, scope, "attention"), defaultAdminViews.attention);
contents.set(adminViewKey(scope, "attention"), JSON.stringify({ version: 1, surface: "attention", value: { supportTypes: ["unknown", "food"], horizon: "nonsense", status: "active", sort: "urgent" } }));
assert.deepEqual(readAdminView(storage, scope, "attention"), { supportTypes: ["food"], categories: [], horizon: "14", status: "active", sort: "urgent" });
writeAdminView(storage, scope, "calendar", { ...defaultAdminViews.calendar, taskTypes: ["security"], view: "week", volunteerId: contactB });
assert.equal(readAdminView(storage, scope, "calendar").volunteerId, contactB);
writeAdminView(storage, scope, "communications", { ...defaultAdminViews.communications, tab: "history", historyState: "failed" });
assert.equal(readAdminView(storage, scope, "communications").historyState, "failed");
writeAdminView(storage, scope, "assignment-picker", { congregation: "East", availability: "away" });
assert.deepEqual(readAdminView(storage, scope, "assignment-picker"), { congregation: "East", availability: "away" });
assert(!JSON.stringify([...contents.values()]).includes("selectedVolunteers"));
assert(!JSON.stringify([...contents.values()]).includes("recipientIds"));
assert(!JSON.stringify([...contents.values()]).includes("resend"));

const signal = (calendarItemId, kind, supportType, date, problem, assignmentId = null) => ({
  id: `${calendarItemId}:${kind}`, calendarItemId, kind, group: kind === "coverage" ? "staffing" : "responses", supportType,
  title: calendarItemId === "gate" ? "Gate Attendant" : calendarItemId === "meal" ? "Kitchen Attendant" : "Night Watch",
  startDate: date, endDate: null, startTime: "08:00:00", endTime: "09:00:00", timezone: "America/Denver",
  startsAt: Date.parse(`${date}T14:00:00Z`), urgency: "soon", problem, affectedCount: 1, neededCount: 2,
  assignedCount: 1, assignedFractionLabel: "1/2", affectedAssignments: assignmentId ? [{ assignmentId, responseStatus: kind === "denied" ? "declined" : "needs_response" }] : [],
  href: `/admin/calendar?view=day&date=${date}&item=${calendarItemId}&section=volunteers`,
});
const signals = [
  signal("gate", "coverage", "general", "2026-10-05", "1 volunteer still needed"),
  signal("gate", "denied", "general", "2026-10-05", "1 volunteer can’t make it", "assignment-gate"),
  signal("meal", "pending", "food", "2026-10-09", "1 response pending"),
  signal("night", "coverage", "security", "2026-11-01", "1 volunteer still needed"),
];
const people = new Map([["assignment-gate", { name: "Halli Johnson", congregation: "North" }]]);
const search = new Map([["gate", "Halli Johnson North"]]);
const issues = groupAttentionIssues(signals, new Set(), search, people);
assert.equal(issues.length, 3, "A decline and staffing gap on one item form one issue.");
assert.deepEqual(issues.find(issue => issue.id === "gate").categories, ["declined", "staffing"]);
assert.match(issues.find(issue => issue.id === "gate").href, /item=gate&section=volunteers/);
assert.equal(issues.find(issue => issue.id === "gate").affectedAssignments[0].name, "Halli Johnson");
const filtered = view => filterAttentionIssues(issues, { ...defaultAdminViews.attention, ...view }, "2026-10-04");
assert.deepEqual(filtered({ supportTypes: ["general", "food"] }).map(issue => issue.id), ["gate", "meal"]);
assert.deepEqual(filtered({ supportTypes: ["security"], horizon: "project" }).map(issue => issue.id), ["night"]);
assert.deepEqual(filtered({ categories: ["declined", "staffing"] }).map(issue => issue.id), ["gate"]);
assert.deepEqual(filtered({ horizon: "7" }).map(issue => issue.id), ["gate", "meal"]);
assert.deepEqual(filtered({ status: "reviewed" }).map(issue => issue.id), []);
assert.deepEqual(filterAttentionIssues(issues, defaultAdminViews.attention, "2026-10-04", "halli").map(issue => issue.id), ["gate"]);
assert.deepEqual(filterAttentionIssues(issues, defaultAdminViews.attention, "2026-10-04", "north").map(issue => issue.id), ["gate"]);
assert.deepEqual(filterAttentionIssues(issues, defaultAdminViews.attention, "2026-10-04", "no match"), []);
const partlyReviewed = groupAttentionIssues(signals, new Set(["gate:coverage"]));
assert.equal(partlyReviewed.find(issue => issue.id === "gate").reviewed, false);
const reviewed = groupAttentionIssues(signals, new Set(["gate:coverage", "gate:denied"]));
assert.equal(reviewed.find(issue => issue.id === "gate").reviewed, true);
assert.deepEqual(filterAttentionIssues(reviewed, { ...defaultAdminViews.attention, status: "reviewed" }, "2026-10-04").map(issue => issue.id), ["gate"]);

const root = process.cwd();
const [picker, communications, calendar, volunteer] = await Promise.all([
  readFile(path.join(root, "components/PickerVolunteerList.tsx"), "utf8"),
  readFile(path.join(root, "components/CommunicationsWorkspace.tsx"), "utf8"),
  readFile(path.join(root, "components/CalendarClient.tsx"), "utf8"),
  readFile(path.join(root, "components/VolunteerHomeDashboard.tsx"), "utf8"),
]);
assert.match(picker, /useRememberedView\("assignment-picker"/);
assert.doesNotMatch(picker, /setRemembered\(.*selected/);
assert.match(communications, /useRememberedView\("communications"/);
assert.doesNotMatch(communications, /setRemembered\(.*volunteerIds|setRemembered\(.*resend/);
assert.match(calendar, /useRememberedView\("calendar"/);
assert.match(volunteer, /Weekly lunch menu/);
console.log("12.53 admin workspace preference and issue regression passed.");
