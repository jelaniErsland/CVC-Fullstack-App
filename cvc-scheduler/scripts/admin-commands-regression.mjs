import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminCommands, matchAdminCommands, goSequenceTimeout } from '../lib/adminCommands.ts';
import { adminDestinations } from '../lib/adminNavigation.ts';

const capabilities = ['workspace.read','calendar.view','calendar.edit','assignments.view','assignments.edit','volunteers.view','volunteers.edit','tasks.view'];
const all = adminCommands(adminDestinations(capabilities), capabilities, '/admin/calendar?view=week&date=2026-10-23');
assert.equal(all.length, 12);
assert.deepEqual(all.filter(c => c.key).map(c => c.key), ['O','C','V','A','T','M','Q','H']);
assert.equal(all.find(c => c.id === 'calendar').href, '/admin/calendar?view=week&date=2026-10-23');
assert.equal(all.find(c => c.id === 'create').href, '/admin/calendar?view=week&date=2026-10-23&create=1');
for (const [query,id] of [['cal','calendar'],['clndr','calendar'],['vol','volunteers'],['vol','add'],['vol','assign'],['attention','attention'],['send','send'],['task','tasks']]) assert(matchAdminCommands(all, query).some(c => c.id === id));
assert.equal(matchAdminCommands(all,'zzzzqqq').length,0);
assert.deepEqual(matchAdminCommands(all,'create calendar').map(command=>command.id),['create']);
assert.deepEqual(matchAdminCommands(all,'   '),all);
assert(goSequenceTimeout >= 800 && goSequenceTimeout <= 1500);
for (const missing of capabilities) {
  const reduced = capabilities.filter(c => c !== missing);
  const commands = adminCommands(adminDestinations(reduced), reduced, '/admin/calendar');
  for (const command of commands) {
    assert(command.destination === 'guide' || adminDestinations(reduced).includes(command.destination));
    assert(!command.capability || reduced.includes(command.capability));
  }
  if (missing === 'calendar.edit') assert(!commands.some(c => c.id === 'create'));
  if (missing === 'assignments.edit') assert(!commands.some(c => c.id === 'assign' || c.id === 'send'));
  if (missing === 'volunteers.edit') assert(!commands.some(c => c.id === 'add'));
}
const client=readFileSync(new URL('../components/AdminCommands.tsx',import.meta.url),'utf8');
assert(!/router\.(push|replace)|localStorage|sessionStorage|fetch\(|\.submit\(|requestSubmit|supabase/.test(client));
assert(client.includes('AdminNavigationLink') && client.includes('prefetch={false}'));
const routes=readFileSync(new URL('../lib/adminRouteHandoff.ts',import.meta.url),'utf8');
assert(!routes.includes('/admin/quick-view'),'Quick View must remain outside primary handoff.');
console.log('Static commands, all capability combinations, remembered Calendar URL, forgiving local search, no storage/mutations/router fork, and unchanged Quick View boundary passed.');
