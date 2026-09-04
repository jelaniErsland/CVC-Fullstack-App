import assert from "node:assert/strict";

import {
  CalendarItemValidationError,
  validateUpdateCalendarOneOffTimedItemInput,
} from "../lib/calendar/item.ts";
import { normalizeCalendarEditTimeValue } from "../lib/calendar/routeRead.server.ts";

const calendarItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function validEdit(overrides = {}) {
  return {
    calendarItemId,
    source: { title: "Calendar edit regression", taskType: "general" },
    schedule: {
      kind: "timed",
      date: "2026-09-28",
      startTime: "07:30",
      endTime: "17:00",
    },
    neededCount: 1,
    notes: null,
    customValues: {},
    ...overrides,
  };
}

function expectInvalid(input, issuePattern) {
  assert.throws(
    () => validateUpdateCalendarOneOffTimedItemInput(input),
    (error) =>
      error instanceof CalendarItemValidationError &&
      error.issues.some((issue) => issuePattern.test(issue)),
  );
}

assert.equal(normalizeCalendarEditTimeValue("07:30:00"), "07:30");
assert.equal(normalizeCalendarEditTimeValue("17:00:00.000000"), "17:00");
assert.equal(normalizeCalendarEditTimeValue("07:30"), "07:30");
assert.equal(normalizeCalendarEditTimeValue(null), undefined);
assert.equal(normalizeCalendarEditTimeValue("7:30:00"), undefined);
assert.equal(normalizeCalendarEditTimeValue("24:00:00"), undefined);
assert.equal(normalizeCalendarEditTimeValue("07:60:00"), undefined);

const projectedEdit = validEdit({
  schedule: {
    kind: "timed",
    date: "2026-09-28",
    startTime: normalizeCalendarEditTimeValue("07:30:00"),
    endTime: normalizeCalendarEditTimeValue("17:00:00"),
  },
});
assert.deepEqual(validateUpdateCalendarOneOffTimedItemInput(projectedEdit), projectedEdit);

expectInvalid(
  validEdit({
    schedule: {
      kind: "timed",
      date: "2026-09-28",
      startTime: "07:30:00",
      endTime: "17:00:00",
    },
  }),
  /schedule\.startTime must use 24-hour HH:MM/,
);
expectInvalid(
  validEdit({
    schedule: {
      kind: "timed",
      date: "not-a-date",
      startTime: "07:30",
      endTime: "17:00",
    },
  }),
  /schedule\.date must use YYYY-MM-DD/,
);
expectInvalid(
  validEdit({
    schedule: {
      kind: "timed",
      date: "2026-09-28",
      startTime: "17:00",
      endTime: "07:30",
    },
  }),
  /schedule\.endTime must be later than startTime/,
);
expectInvalid(validEdit({ neededCount: 100 }), /neededCount must be an integer from 0 to 99/);
expectInvalid(validEdit({ calendarItemId: "not-an-id" }), /calendarItemId must be a UUID/);

assert.equal(validateUpdateCalendarOneOffTimedItemInput(validEdit({ neededCount: 0 })).neededCount, 0);
assert.equal(validateUpdateCalendarOneOffTimedItemInput(validEdit({ notes: null })).notes, null);
assert.equal(
  validateUpdateCalendarOneOffTimedItemInput(validEdit({ notes: "Updated safely" })).notes,
  "Updated safely",
);

console.log("Calendar edit validation regression passed.");
console.log("Confirmed persisted database times are projected as HH:MM while malformed edit payloads remain denied.");
