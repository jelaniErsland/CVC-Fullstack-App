import assert from 'node:assert/strict';
import { calendarVolunteerDetail, calendarVolunteerFilterLabel, calendarVolunteerOptions, itemHasCalendarVolunteer, searchCalendarVolunteers } from '../lib/calendar/volunteerFilter.ts';

const id = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const volunteers = [
  { id: id(1), displayName: 'Halli Johnson', congregation: 'North' },
  { id: id(2), displayName: 'Hallie Johnson', congregation: 'South' },
  { id: id(3), displayName: 'Halli Johnson', congregation: 'East' },
  { id: id(4), displayName: 'José Rivera', congregation: null },
  { id: id(5), displayName: 'Avery Stone', congregation: null },
];
const assignment = (volunteerProfileId, responseStatus = 'confirmed') => ({ volunteerProfileId, responseStatus });
const options = calendarVolunteerOptions(volunteers, [{ volunteerProfileId: id(6), volunteerDisplayName: 'Morgan Reed', volunteerCongregation: null }]);
assert.equal(options.length, 6, 'assigned profiles outside the ready picker remain searchable');
assert.deepEqual(searchCalendarVolunteers(options, 'HALLI JOHN').map(v => v.id), [id(1), id(3), id(2)]);
assert.deepEqual(searchCalendarVolunteers(options, 'john halli').map(v => v.id), [id(1), id(3), id(2)]);
assert.deepEqual(searchCalendarVolunteers(options, 'Jose').map(v => v.id), [id(4)]);
assert.deepEqual(searchCalendarVolunteers(options, 'avery').map(v => v.id), [id(5)]);
assert.deepEqual(searchCalendarVolunteers(options, '').map(v => v.id), []);
assert.equal(calendarVolunteerFilterLabel(options.find(v => v.id === id(1)), options), 'Halli Johnson · North');
assert.equal(calendarVolunteerDetail(options.find(v => v.id === id(2)), options), 'South');
assert.equal(calendarVolunteerDetail({ id: id(9), name: 'Halli Johnson', congregation: 'North' }, [...options, { id: id(9), name: 'Halli Johnson', congregation: 'North' }]), 'North · profile 0009');

const ordinary = { assignments: [assignment(id(1)), assignment(id(2))] };
const overnight = { endDate: '2026-10-06', assignments: [assignment(id(1))] };
const declined = { assignments: [assignment(id(1), 'declined')] };
const unrelated = { assignments: [assignment(id(2))] };
const meal = { meal: { kind: 'lunch' }, assignments: [assignment(id(2))] };
const assignedMeal = { meal: { kind: 'lunch' }, assignments: [assignment(id(1))] };
const items = [ordinary, overnight, declined, unrelated, meal];
assert.deepEqual(items.filter(item => itemHasCalendarVolunteer(item, id(1))), [ordinary, overnight, declined]);
assert(!itemHasCalendarVolunteer(ordinary, id(5)), 'volunteer with no visible assignment has no item');
assert(!itemHasCalendarVolunteer(meal, id(1)), 'meal-only item is excluded');
assert(itemHasCalendarVolunteer(assignedMeal, id(1)), 'genuinely assigned meal item is included');
assert.equal(declined.assignments[0].responseStatus, 'declined', 'declined status is preserved');
assert.deepEqual(items.filter(item => !id(1) || itemHasCalendarVolunteer(item, id(1))), [ordinary, overnight, declined], 'selection filters existing items');
assert.deepEqual(items.filter(item => !null || itemHasCalendarVolunteer(item, null)), items, 'clearing restores original items');
assert(!options.some(v => v.id === id(7)), 'foreign-project volunteer is absent from authorized options');
console.log('PASS: 12.51A partial/similar names, identity, assignment selection, overnight, declined, meal exclusion, clear, no visible assignments, and scoped options');
