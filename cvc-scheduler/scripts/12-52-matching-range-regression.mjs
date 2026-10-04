import assert from 'node:assert/strict';
import { readMatchingAssignmentItemsWithClient } from '../lib/calendar/matchingAssignmentItems.server.ts';
import { assignmentPreviewCounts } from '../lib/calendar/bulkAssignments.ts';

const id = n => `99999999-9999-4999-8999-${String(n).padStart(12, '0')}`;
const workspaceId = id(1), otherWorkspace = id(2), presetId = id(3), sourceId = id(4);
const row = (n, date, overrides = {}) => ({
  id: id(n), workspace_id: workspaceId, task_preset_id: presetId,
  title_snapshot: 'Kitchen Attendant AM', start_date: date,
  end_date: null, start_time: '07:30:00', end_time: '17:00:00',
  lifecycle: 'active', publication_state: 'published', ...overrides,
});
const rows = [
  row(4, '2026-10-05'), row(5, '2026-10-31'), row(6, '2026-11-01'),
  row(7, '2026-12-03', { end_date: '2026-12-04', start_time: '17:00:00', end_time: '05:00:00' }),
  row(8, '2026-12-06'), row(9, '2026-11-02', { workspace_id: otherWorkspace }),
  row(10, '2026-11-03', { task_preset_id: id(88) }),
  row(11, '2026-11-04', { publication_state: 'draft' }),
  row(300, '2026-10-05', { task_preset_id: null, title_snapshot: 'General Help' }),
  row(301, '2026-11-05', { task_preset_id: null, title_snapshot: 'General Help' }),
  row(302, '2026-11-06', { task_preset_id: null, title_snapshot: 'Different Work' }),
  ...Array.from({ length: 130 }, (_, index) => row(100 + index, `2026-11-${String(index % 28 + 1).padStart(2, '0')}`)),
];
const queryLog = [];
function fakeClient(authorized = true) {
  return {
    rpc(name, args) {
      assert.equal(name, 'read_authorized_calendar_items');
      queryLog.push(args);
      const predicates = [record => record.start_date <= args.p_range_end && (record.end_date ?? record.start_date) >= args.p_range_start];
      const sorts = [];
      let from = 0, through = Infinity;
      const query = {
        select() { return query; },
        eq(column, value) { predicates.push(record => record[column] === value); return query; },
        neq(column, value) { predicates.push(record => record[column] !== value); return query; },
        is(column, value) { predicates.push(record => record[column] === value); return query; },
        gte(column, value) { predicates.push(record => record[column] >= value); return query; },
        lte(column, value) { predicates.push(record => record[column] <= value); return query; },
        order(column) { sorts.push(column); return query; },
        limit(count) { through = count - 1; return query; },
        range(start, end) { from = start; through = end; return query; },
        then(resolve, reject) {
          const data = rows.filter(record => predicates.every(predicate => predicate(record)))
            .sort((a, b) => { for (const key of sorts) { const compared = String(a[key] ?? '').localeCompare(String(b[key] ?? '')); if (compared) return compared; } return 0; })
            .slice(from, through + 1);
          return Promise.resolve(authorized ? { data, error: null } : { data: null, error: { code: '42501' } }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}
const input = { client: fakeClient(), workspaceId, sourceId, sourceDate: '2026-10-05', projectStartsOn: '2026-10-01', projectEndsOn: '2026-12-05' };
const october = await readMatchingAssignmentItemsWithClient({ ...input, cursor: { month: '2026-10', offset: 0 } });
assert.equal(october.kind, 'ready');
assert.deepEqual(october.items.map(item => item.date), ['2026-10-31']);
assert.deepEqual(october.nextCursor, { month: '2026-11', offset: 0 });
const november1 = await readMatchingAssignmentItemsWithClient({ ...input, cursor: october.nextCursor });
assert.equal(november1.kind, 'ready');
assert.equal(november1.items.length, 120, 'one bounded page, never all matching rows');
assert.deepEqual(november1.nextCursor, { month: '2026-11', offset: 120 });
const november2 = await readMatchingAssignmentItemsWithClient({ ...input, cursor: november1.nextCursor });
assert.equal(november2.kind, 'ready');
assert.equal(november2.items.length, 11);
assert.deepEqual(november2.nextCursor, { month: '2026-12', offset: 0 });
const december = await readMatchingAssignmentItemsWithClient({ ...input, cursor: november2.nextCursor });
assert.equal(december.kind, 'ready');
assert.deepEqual(december.items.map(item => item.date), ['2026-12-03']);
assert.equal(december.items[0].endDate, '2026-12-04', 'later overnight interval retained');
assert.equal(december.nextCursor, null, 'project end stops loading');
assert(queryLog.every(call => call.p_workspace_id === workspaceId));
assert(queryLog.every(call => Date.parse(call.p_range_end) - Date.parse(call.p_range_start) <= 31 * 86400000), 'every query is month bounded');
assert.equal((await readMatchingAssignmentItemsWithClient({ ...input, cursor: { month: '2027-01', offset: 0 } })).kind, 'unavailable', 'end-date boundary');
assert.equal((await readMatchingAssignmentItemsWithClient({ ...input, client: fakeClient(false), cursor: { month: '2026-10', offset: 0 } })).kind, 'unavailable', 'authorization failure');
assert.equal((await readMatchingAssignmentItemsWithClient({ ...input, workspaceId: otherWorkspace, cursor: { month: '2026-10', offset: 0 } })).kind, 'unavailable', 'cross-project source denied');
const oneOff = await readMatchingAssignmentItemsWithClient({ ...input, sourceId: id(300), cursor: { month: '2026-11', offset: 0 } });
assert.equal(oneOff.kind, 'ready');
assert.deepEqual(oneOff.items.map(item => item.id), [id(301)], 'one-off work keeps the existing exact-title matching rule');
const openEnded = await readMatchingAssignmentItemsWithClient({ ...input, projectEndsOn: null, cursor: { month: '2027-01', offset: 0 } });
assert.equal(openEnded.kind, 'ready');
assert.deepEqual(openEnded.nextCursor, { month: '2027-02', offset: 0 }, 'open-ended project can explicitly load farther ahead');
const preview = { items: [{ id: sourceId, date: '2026-10-05' }, { id: id(5), date: '2026-10-31' }], existingAssignments: [{ itemId: id(5), volunteerId: id(300), assignmentId: id(400) }] };
const counts = assignmentPreviewCounts(preview, { volunteers: [{ id: id(300), excludeDates: [] }] });
assert.equal(counts.existing, 1, 'duplicate assignment skipped by existing planner');
assert.equal(counts.added, 1);
console.log('PASS: current month, Oct/Nov/Dec crossing, 120-row pages, project boundary, project isolation, overnight, open-ended loading, and duplicate skipping');
