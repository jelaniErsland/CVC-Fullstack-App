import assert from 'node:assert/strict';
import { primaryAdminDestination, adminHandoffTimeoutMs } from '../lib/adminRouteHandoff.ts';

for (const [pathname,route] of [['dashboard','overview'],['calendar','calendar'],['volunteers','volunteers'],['needs-attention','needs-attention'],['announcements','announcements'],['tasks','tasks']]) {
  const href=`/admin/${pathname}?view=week&date=2026-10-21`;
  const destination=primaryAdminDestination(href);
  assert.equal(destination.route,route);
  assert.equal(destination.pathname,`/admin/${pathname}`);
  assert.equal(destination.href,href);
  assert.deepEqual(Object.keys(destination).sort(),['href','pathname','route','title']);
}
for(const value of ['https://other.invalid/admin/calendar','//other.invalid/admin/calendar','javascript:alert(1)','/admin/calendar/other','/admin/calendar\\other','/v/schedule','/admin/__proto__','/admin/quick-view','/admin/projects','/admin/%63alendar']) {
  assert.equal(primaryAdminDestination(value),null,`Unapproved destination ${value}`);
}
assert.equal(adminHandoffTimeoutMs,30_000);
console.log('Primary handoff identities are static, URL-bounded, presentation-only and finite; no private fields or authorization projection.');
