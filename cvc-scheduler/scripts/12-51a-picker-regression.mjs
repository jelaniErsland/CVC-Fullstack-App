import assert from 'node:assert/strict';
import { readCalendarAssignmentPickerWithClient } from '../lib/calendar/assignmentPicker.server.ts';

const id = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const workspaceId = id(9000), otherWorkspaceId = id(9001), volunteerId = id(9002);
const items = Array.from({ length: 121 }, (_, index) => id(index + 1));
const tables = {
  volunteer_profiles: [
    { id: volunteerId, workspace_id: workspaceId, full_name: 'Halli Johnson', email: null, phone: null, congregation: 'North', preferred_contact_method: null, profile_notes: null, lifecycle: 'active', readiness_status: 'ready' },
    { id: id(9003), workspace_id: otherWorkspaceId, full_name: 'Other Project Person', email: null, phone: null, congregation: null, preferred_contact_method: null, profile_notes: null, lifecycle: 'active', readiness_status: 'ready' },
  ],
  calendar_assignments: items.map((itemId, index) => ({ id: id(index + 200), workspace_id: workspaceId, calendar_item_id: itemId, volunteer_profile_id: volunteerId, lifecycle: 'active', created_at: '2026-10-01' })),
  assignment_responses: items.map((_, index) => ({ assignment_id: id(index + 200), workspace_id: workspaceId, response_status: index === 120 ? 'declined' : 'confirmed', updated_at: '2026-10-01' })),
};
const calls = [];
function query(table) {
  const predicates = [];
  const builder = {
    select() { return builder; },
    eq(column, value) { predicates.push(row => row[column] === value); return builder; },
    in(column, values) { calls.push({ table, column, count: values.length }); predicates.push(row => values.includes(row[column])); return builder; },
    order() { return builder; },
    then(resolve, reject) { return Promise.resolve({ data: tables[table].filter(row => predicates.every(predicate => predicate(row))), error: null }).then(resolve, reject); },
  };
  return builder;
}
const client = { from: query };
const result = await readCalendarAssignmentPickerWithClient({ client, workspaceId, calendarItemIds: items, canViewVolunteers: true });
assert.equal(result.kind, 'ready');
assert.equal(result.assignments.length, 121, 'items beyond the former 120-item truncation retain assignment identity');
assert.equal(result.assignments.find(a => a.calendarItemId === items[120]).responseStatus, 'declined');
assert.deepEqual(calls.filter(call => call.table === 'calendar_assignments').map(call => call.count), [120, 1]);
assert.deepEqual(calls.filter(call => call.table === 'assignment_responses').map(call => call.count), [120, 1]);
assert(!result.volunteers.some(volunteer => volunteer.displayName === 'Other Project Person'));
const denied = await readCalendarAssignmentPickerWithClient({ client, workspaceId, calendarItemIds: items, canViewVolunteers: false });
assert.equal(denied.kind, 'unavailable');
console.log('PASS: 12.51A assignment identity across 121 items, bounded reads, response status, project isolation, and view authorization');
