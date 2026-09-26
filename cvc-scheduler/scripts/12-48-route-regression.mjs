import assert from 'node:assert/strict';
import { calendarRouteHref, readCalendarRouteDay, readInspectorSection } from '../lib/calendar/routeHref.ts';
for (const routeBase of ['/admin/calendar', '/admin/quick-view', '/qv']) {
  for (const view of ['day','week','month','list']) {
    for (const selection of [{}, {item:'fixture-item',section:'volunteers'}, {day:'2026-10-02'}]) {
      const href=calendarRouteHref({routeBase,projectKey:'fixture-project',token:'must-not-copy'}, {view,date:'2026-10-01',...selection,token:'must-not-copy',redirect:'/admin/calendar',notice:'published'});
      const url=new URL(href,'https://fixture.invalid');
      assert.equal(url.pathname,routeBase); assert.equal(url.searchParams.get('view'),view);
      assert.equal(url.searchParams.get('project'),routeBase==='/admin/quick-view'?'fixture-project':null);
      assert(!href.includes('must-not-copy')); assert(!url.searchParams.has('notice')); assert(!url.searchParams.has('redirect'));
      assert.equal(url.searchParams.get('item'),selection.item??null);
      assert.equal(url.searchParams.get('day'),selection.day??null);
    }
  }
}
assert.throws(()=>calendarRouteHref({routeBase:'https://evil.invalid'}, {view:'week',date:'2026-10-01'}));
assert.equal(readInspectorSection('notification'),'notification');
assert.equal(readInspectorSection('secret'),'details');
assert.equal(readInspectorSection(['details']),'details');
for (const invalid of ['garbage', '2026-02-31', '', ['2026-10-05'], null]) assert.equal(readCalendarRouteDay(invalid),undefined);
assert.equal(readCalendarRouteDay('2026-10-05'),'2026-10-05');
console.log('PASS: 36 route/view/selection cases; allowlisted context and query isolation; inspector section validation.');
