import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { directoryResultCopy } from '../lib/volunteers/directoryPresentation.ts';

assert.equal(directoryResultCopy('electric',0).countContext,'your search');
assert.equal(directoryResultCopy('electric',0).emptyTitle,'No volunteers match “electric”');
assert.equal(directoryResultCopy('electric',0).resetLabel,'Clear search');
assert.equal(directoryResultCopy('',2).countContext,'your filters');
assert.equal(directoryResultCopy('',2).emptyTitle,'No volunteers match these filters');
assert.equal(directoryResultCopy('',2).resetLabel,'Clear filters');
assert.equal(directoryResultCopy('electric',2).countContext,'your search and filters');
assert.equal(directoryResultCopy('electric',2).resetLabel,'Reset search and filters');
assert.equal(directoryResultCopy(' ',0).countContext,'');
const protectedPaths=['components/VolunteerCsvTools.tsx','supabase','lib/auth','lib/notifications','lib/security','lib/supabase/server.ts','lib/supabase/client.ts','app/internal','workers','package.json','package-lock.json'];
const diff=spawnSync('git',['diff','87df898725e6ce909810c263d67ac732909bafd6','--',...protectedPaths],{encoding:'utf8',windowsHide:true});assert.equal(diff.status,0);assert.equal(diff.stdout,'','Amendment preserves approved semantics, read/write authority, APIs, CSV workflow, schema, infrastructure and dependencies');
console.log('PASS contextual copy, blank search, app-only schema/infrastructure/security boundary. Experience-context behavior covered by 12-61-experience-regression.');
