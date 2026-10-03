import assert from 'node:assert/strict';
import { classifyVolunteerCreatePersistenceFailure } from '../lib/volunteers/createFailure.ts';
import { normalizeManualVolunteerProfileInput } from '../lib/volunteers/server.ts';
import { normalizeVolunteerManagementNotice } from '../lib/volunteers/routeRead.server.ts';
import { createOperationalEvent } from '../lib/observability/server.ts';

const categories = [
  ['42501', 'permission', 'permission_denied'],
  ['PGRST301', 'permission', 'permission_denied'],
  ['23505', 'duplicate', 'duplicate_identity'],
  ['22023', 'validation', 'validation_failed'],
  ['23514', 'validation', 'validation_failed'],
  ['UNKNOWN', 'error', 'persistence_failed'],
];
for (const [code, notice, failureCode] of categories) {
  const classified = classifyVolunteerCreatePersistenceFailure(new Error('Private database detail', {
    cause: { code, message: 'Private database detail' },
  }));
  assert.deepEqual(classified, { notice, failureCode });
  assert.equal(normalizeVolunteerManagementNotice(notice), notice);
  const event = createOperationalEvent({ event: 'volunteer.create_failure', failureCode });
  assert(event);
  assert.equal(event.stage, 'create');
  assert.equal(event.category, 'volunteer');
  assert.equal(event.failureCode, failureCode);
  assert.deepEqual(Object.keys(event).sort(),
    ['schemaVersion','event','severity','category','stage','outcome','timestamp','failureCode'].sort(),
    'the logged event contains only safe schema fields');
  assert.equal(createOperationalEvent({ event: 'volunteer.create_failure', failureCode,
    volunteerEmail: 'private@example.invalid', token: 'private-token' }), null,
  'PII and secrets must not be accepted as event fields');
  assert(!JSON.stringify(classified).includes('Private database detail'));
}

const valid = normalizeManualVolunteerProfileInput({
  fullName: 'Household Volunteer', email: 'shared@example.invalid', phone: '+12025550100',
});
assert.equal(valid.fullName, 'Household Volunteer');
assert.equal(valid.email, 'shared@example.invalid', 'shared household contacts stay accepted');
assert.throws(() => normalizeManualVolunteerProfileInput({ fullName: '', email: 'valid@example.invalid' }));
assert.throws(() => normalizeManualVolunteerProfileInput({ fullName: 'Volunteer', email: 'invalid' }));
assert.throws(() => normalizeManualVolunteerProfileInput({ fullName: 'Volunteer' }));
console.log('PASS: safe create failure categories, notices, diagnostic events, validation, and shared-contact input');
