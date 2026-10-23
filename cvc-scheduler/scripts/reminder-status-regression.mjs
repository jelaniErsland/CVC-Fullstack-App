import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readReminderDeliveryStatus } from '../lib/notifications/reminderStatus.server.ts';

for (const enabled of [false, true]) {
  let reads = 0;
  const status = await readReminderDeliveryStatus(async () => { reads++; return { enabled, workspaces: ['private-system-context'] }; });
  assert.equal(status.enabled, enabled);
  assert.equal(reads, 1);
  assert.deepEqual(Object.keys(status).sort(), ['enabled', 'observedAt']);
  assert(Number.isFinite(Date.parse(status.observedAt)));
}
for (const invalid of [null, {}, { enabled: 'false' }, { enabled: 0 }]) {
  assert.equal((await readReminderDeliveryStatus(async () => invalid)).enabled, null);
}
assert.equal((await readReminderDeliveryStatus(async () => { throw new Error('simulated database failure'); })).enabled, null);
assert.equal((await readReminderDeliveryStatus(() => new Promise(() => {}))).enabled, null, 'Finite status timeout must never become Off');
const page = fs.readFileSync(new URL('../app/admin/(workspace)/announcements/page.tsx', import.meta.url), 'utf8');
assert(page.indexOf('if (!context)') < page.indexOf('await readReminderDeliveryStatus()'));
assert(page.includes('initialReminderStatus={reminderStatus}'));
assert(!page.includes('readReminderPreview'));
const action = fs.readFileSync(new URL('../lib/notifications/reminders.actions.ts', import.meta.url), 'utf8');
assert(action.indexOf('withReadTimeout(readCommunicationsContext()') < action.indexOf('return await readReminderDeliveryStatus()'));
console.log('PASS authoritative true/false, malformed/error/finite-timeout unavailable, minimum projection, authorization before status, no initial preview');
