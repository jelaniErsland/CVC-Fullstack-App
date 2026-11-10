import assert from 'node:assert/strict';
import { reminderDatabaseConfiguration } from '../lib/notifications/reminderDatabase.server.ts';

const original = 'wdlaauzknfggoqldolmx';
const recovery = 'lprregckczjgciryvhpy';
const connection = (ref, host) => `postgresql://project_local_reminder_runner.${ref}:synthetic-test-password@${host}:6543/postgres`;
const oldHost = 'aws-1-us-west-2.pooler.supabase.com';
const newHosts = ['aws-0-us-east-2.pooler.supabase.com', 'aws-1-us-east-2.pooler.supabase.com'];
const oldEnvironment = { NEXT_PUBLIC_SUPABASE_URL: `https://${original}.supabase.co`, REMINDER_DATABASE_URL: connection(original, oldHost) };
assert.equal(reminderDatabaseConfiguration(oldEnvironment).host, oldHost);
for (const host of newHosts) {
  const environment = { NEXT_PUBLIC_SUPABASE_URL: `https://${recovery}.supabase.co`, REMINDER_DATABASE_URL: connection(recovery, host) };
  const config = reminderDatabaseConfiguration(environment);
  assert.equal(config.host, host);
  assert.equal(config.user, `project_local_reminder_runner.${recovery}`);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.ssl.servername, host);
  assert.equal(config.max, 1);
  assert.throws(() => reminderDatabaseConfiguration({ ...environment, REMINDER_DATABASE_URL: connection(original, host) }));
  assert.throws(() => reminderDatabaseConfiguration({ ...environment, REMINDER_DATABASE_URL: connection(recovery, oldHost) }));
  for (const invalid of [connection(recovery, 'example.invalid'), connection(recovery, host) + '?sslmode=disable', connection(recovery, host).replace(':6543/', ':5432/'), connection(recovery, host).replace('project_local_reminder_runner.', 'postgres.')]) {
    assert.throws(() => reminderDatabaseConfiguration({ ...environment, REMINDER_DATABASE_URL: invalid }));
  }
  assert.throws(() => reminderDatabaseConfiguration({ ...environment, NEXT_PUBLIC_SUPABASE_URL: oldEnvironment.NEXT_PUBLIC_SUPABASE_URL }));
  assert.throws(() => reminderDatabaseConfiguration({ ...environment, NEXT_PUBLIC_SUPABASE_URL: 'https://unapproved.supabase.co' }));
}
console.log('PASS reminder recovery configuration: exact project/role pairing, approved pooler hosts, verified TLS, original compatibility and mismatched-project rejection; no network connections');
