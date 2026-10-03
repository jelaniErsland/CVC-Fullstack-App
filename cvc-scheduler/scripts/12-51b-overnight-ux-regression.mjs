import assert from 'node:assert/strict';
import { initialTimedEndState, updateTimedEndState } from '../lib/calendar/timedEndChoice.ts';

const day = '2026-10-02';
const next = '2026-10-03';
const initial = initialTimedEndState({ date: day, startTime: '08:00', endTime: '17:00' });
assert.equal(initial.endDate, day, 'ordinary 8 AM–5 PM work stays on the same date');

const overnight = updateTimedEndState(initial, { startTime: '19:00', endTime: '05:00' });
assert.equal(overnight.endDate, next, '7 PM–5 AM automatically ends the next day');
assert.equal(overnight.endDayMode, 'automatic');
assert.equal(updateTimedEndState(initial, { startTime: '23:30', endTime: '00:30' }).endDate, next);

const daytimeAgain = updateTimedEndState(overnight, { endTime: '21:00' });
assert.equal(daytimeAgain.endDate, day, 'overnight-to-same-day clears the stale next-day date');
assert.equal(updateTimedEndState(daytimeAgain, { endTime: '05:00' }).endDate, next);
assert.equal(updateTimedEndState(overnight, { startTime: '04:00' }).endDate, day);
assert.equal(updateTimedEndState(overnight, { endTime: '06:00' }).endDate, next);

const explicitNext = updateTimedEndState(initial, { endDayMode: 'nextDay' });
assert.equal(explicitNext.endDate, next, 'the admin may explicitly select Next day');
assert.equal(updateTimedEndState(explicitNext, { endTime: '18:00' }).endDate, day,
  'changing an ordinary end time returns to automatic same-day interpretation');
assert.equal(updateTimedEndState(overnight, { endDayMode: 'sameDay' }).endDate, day,
  'the admin may choose Same day and then correct the invalid time');
assert.equal(updateTimedEndState(updateTimedEndState(overnight, { endDayMode: 'sameDay' }), { endTime: '06:00' }).endDate, day,
  'an explicit Same day choice remains in force while the admin corrects the time');

const equal = updateTimedEndState(initial, { endTime: '08:00' });
assert.equal(equal.endDate, day, 'equal times must not silently become a 24-hour shift');
const later = updateTimedEndState(initial, { endDayMode: 'laterDate' });
assert.equal(later.endDate, '2026-10-04');
const twoDay = updateTimedEndState(later, { endDate: '2026-10-05' });
assert.equal(updateTimedEndState(twoDay, { endTime: '09:00' }).endDate, '2026-10-05',
  'an explicit multi-day date survives time edits');
assert.equal(updateTimedEndState(twoDay, { date: '2026-10-06' }).endDate, '2026-10-09',
  'moving the start date preserves an explicit multi-day duration');
assert.equal(updateTimedEndState(overnight, { date: next }).endDate, '2026-10-04',
  'moving an overnight start date moves its end date');

assert.equal(initialTimedEndState({ date: day, endDate: next, startTime: '19:00', endTime: '05:00' }).endDayMode,
  'automatic', 'editing a stored overnight interval supports automatic reset');
assert.equal(initialTimedEndState({ date: day, endDate: next, startTime: '19:00', endTime: '21:00' }).endDayMode,
  'nextDay', 'editing a deliberately extended next-day interval preserves its explicit choice');
assert.equal(initialTimedEndState({ date: day, endDate: next, startTime: '19:00', endTime: '19:00' }).endDayMode,
  'nextDay', 'editing an existing explicitly dated 24-hour interval preserves its stored end date');
assert.equal(initialTimedEndState({ date: day, endDate: '2026-10-05', startTime: '19:00', endTime: '05:00' }).endDayMode,
  'laterDate', 'editing a multi-day interval preserves its explicit end date');

console.log('PASS: same-day, automatic overnight, late-night, transitions, explicit choices, equal-time guard, multi-day edits, and date shifts');
