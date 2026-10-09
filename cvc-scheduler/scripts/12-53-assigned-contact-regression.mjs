import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readAssignedContactWithClient } from "../lib/calendar/assignedContact.server.ts";

const workspace = "11111111-1111-4111-8111-111111111111";
const otherWorkspace = "22222222-2222-4222-8222-222222222222";
const assignmentId = "33333333-3333-4333-8333-333333333333";
const profileId = "44444444-4444-4444-8444-444444444444";
const itemId = "55555555-5555-4555-8555-555555555555";
const nextAssignmentId = "66666666-6666-4666-8666-666666666666";
const nextItemId = "77777777-7777-4777-8777-777777777777";
const privateFields = { profile_notes: "private", emergency_contact: "private", date_of_birth: "private" };
const rows = {
  calendar_assignments: [
    { id: assignmentId, workspace_id: workspace, lifecycle: "active", calendar_item_id: itemId, volunteer_profile_id: profileId },
    { id: nextAssignmentId, workspace_id: workspace, lifecycle: "active", calendar_item_id: nextItemId, volunteer_profile_id: profileId },
  ],
  volunteer_profiles: [{ id: profileId, workspace_id: workspace, full_name: "Fixture Volunteer", phone: "406-555-0100", email: "fixture@example.invalid", congregation: "North", ...privateFields }],
  assignment_responses: [{ assignment_id: assignmentId, workspace_id: workspace, response_status: "confirmed" }],
  read_authorized_calendar_items: [
    { id: itemId, workspace_id: workspace, lifecycle: "active", publication_state: "published", start_date: "2026-10-09", end_date: null, title_snapshot: "Gate Attendant", start_time: "09:00", end_time: "12:00", timezone: "America/Denver" },
    { id: nextItemId, workspace_id: workspace, lifecycle: "active", publication_state: "published", start_date: "2026-10-10", end_date: null, title_snapshot: "Kitchen Attendant", start_time: "09:00", end_time: "12:00", timezone: "America/Denver" },
  ],
};

function clientFor(overrides = {}) {
  const tables = { ...rows, ...overrides };
  const reads = [];
  const query = (table) => {
    const filters = [];
    const builder = {
      select(fields) { reads.push({ table, fields }); return builder; },
      eq(field, value) { filters.push([field, value]); return builder; },
      in(field, values) { filters.push([field, values]); return builder; },
      limit() { return builder; },
      order() { return builder; },
      async maybeSingle() { return { data: (tables[table] ?? []).find(row => filters.every(([field, value]) => row[field] === value)) ?? null, error: null }; },
      async single() { return builder.maybeSingle(); },
      then(resolve) { return Promise.resolve({ data: (tables[table] ?? []).filter(row => filters.every(([field, value]) => Array.isArray(value) ? value.includes(row[field]) : row[field] === value)), error: null }).then(resolve); },
    };
    return builder;
  };
  return { client: { from: query, rpc: (name) => query(name) }, reads };
}

const quick = clientFor();
const quickResult = await readAssignedContactWithClient({ client: quick.client, workspaceId: workspace, assignmentId, quickView: true });
assert.deepEqual(quickResult, { kind: "ready", contact: { name: "Fixture Volunteer", phone: "406-555-0100", email: "fixture@example.invalid", congregation: "North" } });
assert(!JSON.stringify(quickResult).includes("private"));
assert(!quick.reads.some(read => read.table === "volunteer_profiles" && /profile_notes|emergency|birth/i.test(read.fields)));
assert(!quick.reads.some(read => read.table === "assignment_responses"), "Quick View must not read or return admin context.");

const crossProject = clientFor();
assert.deepEqual(await readAssignedContactWithClient({ client: crossProject.client, workspaceId: otherWorkspace, assignmentId, quickView: true }), { kind: "unavailable" });
assert(!crossProject.reads.some(read => read.table === "volunteer_profiles"), "An assignment from another project must stop before contact read.");

const hiddenItem = clientFor({ read_authorized_calendar_items: [] });
assert.deepEqual(await readAssignedContactWithClient({ client: hiddenItem.client, workspaceId: workspace, assignmentId, quickView: true }), { kind: "unavailable" });
assert(!hiddenItem.reads.some(read => read.table === "volunteer_profiles"));

const draft = clientFor({ read_authorized_calendar_items: [{ ...rows.read_authorized_calendar_items[0], publication_state: "draft" }] });
assert.deepEqual(await readAssignedContactWithClient({ client: draft.client, workspaceId: workspace, assignmentId, quickView: true }), { kind: "unavailable" });

const inactive = clientFor({ calendar_assignments: [{ ...rows.calendar_assignments[0], lifecycle: "canceled" }] });
assert.deepEqual(await readAssignedContactWithClient({ client: inactive.client, workspaceId: workspace, assignmentId, quickView: true }), { kind: "unavailable" });

const calendar = clientFor();
const calendarResult = await readAssignedContactWithClient({ client: calendar.client, workspaceId: workspace, assignmentId, quickView: false });
assert.equal(calendarResult.kind, "ready");
assert.equal(calendarResult.responseStatus, "confirmed");
assert.deepEqual(calendarResult.upcoming, [{ date: "2026-10-10", title: "Kitchen Attendant", responseStatus: "needs_response" }]);
assert(!JSON.stringify(calendarResult).includes("private"));

const picker = await readFile("components/CalendarAssignmentPicker.tsx", "utf8");
const rowsUi = await readFile("components/CalendarAssignedVolunteers.tsx", "utf8");
const surface = await readFile("components/AssignedContactSurface.tsx", "utf8");
const action = await readFile("app/admin/calendar/assigned-contact-actions.ts", "utf8");
assert.match(picker, /openAssignedContact\(assignment\.assignmentId\)/);
assert.match(rowsUi, /openAssignedContact\(person\.assignmentId\)/);
assert.match(surface, /MobileOverlaySheet/);
assert.match(surface, /tel:/);
assert.match(surface, /sms:/);
assert.match(surface, /mailto:/);
assert.doesNotMatch(surface, /emergency|birth|profileNotes|Edit volunteer/i);
assert.match(action, /selection\.canViewVolunteers/);
assert.match(action, /readVerifiedAdminContext/);
console.log("Assigned contact authorization, privacy, and UI wiring regression passed.");
