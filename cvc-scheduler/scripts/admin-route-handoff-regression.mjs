import assert from 'node:assert/strict';
import { primaryAdminDestination, adminHandoffTimeoutMs, createAdminHandoffStore } from '../lib/adminRouteHandoff.ts';

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
const store=createAdminHandoffStore(), other=createAdminHandoffStore();
store.mark('/admin/calendar');const first=store.snapshot();
store.mark('/admin/dashboard','history');const latest=store.snapshot();
assert(latest.id>first.id);assert.equal(latest.kind,'history');
store.commit('calendar');assert.equal(store.snapshot(),latest,'An older content commit must not clear a newer intent.');
const oldContent=store.commit('calendar'), newContent=store.commit('overview');
oldContent();assert.equal(store.contentSnapshot(),'overview','Old cleanup must not invalidate newer content.');
newContent();assert.equal(store.contentSnapshot(),null,'Hidden/unmounted content must not certify arrival.');
assert.equal(other.contentSnapshot(),null,'Content commits must remain scoped to their mounted shell.');
store.clear(first.id);store.fail(first.id);assert.equal(store.snapshot(),latest,'Old callbacks must be inert.');
store.clear(latest.id);store.fail(latest.id);assert.equal(store.snapshot(),null,'Late failure must not revive a completed intent.');
store.mark('/admin/calendar');const returnId=store.snapshot().id;
store.mark('/admin/calendar');assert(store.snapshot().id>returnId,'Current-page return is a new intent.');
assert.equal(other.snapshot(),null,'Mounted shells must not share ownership.');
store.mark('/admin/projects');assert.equal(store.snapshot(),null,'Other destinations release primary presentation ownership.');
console.log('Primary handoff identities are static, URL-bounded, presentation-only and finite; no private fields or authorization projection.');
