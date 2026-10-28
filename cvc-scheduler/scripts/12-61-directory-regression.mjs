import assert from 'node:assert/strict';
import { newerVolunteerProfile } from '../lib/volunteers/profile.ts';
import { performance } from 'node:perf_hooks';
import { sortDirectory, directorySortOptions } from '../lib/volunteers/directorySort.ts';
import { indexDirectory, filterDirectory, emptyDirectoryFilters } from '../lib/volunteers/directoryFilters.ts';
import { directoryResultCopy, experienceSearchExplanation } from '../lib/volunteers/directoryPresentation.ts';

const profile=(id,patch={})=>({id,fullName:'Alex Morgan',congregation:'Belgrade',email:'household@example.invalid',phone:null,lifecycle:'active',readinessStatus:'ready',availableWorkDays:['Monday'],structuredSkills:['Electrical assist','Framing'],skillsHelpSnapshot:{skillsExperience:{categories:['Security']}},skillsExperience:'Forklift prose. PRIVATE DETAIL',profileNotes:'',otherSupport:null,createdAt:'2026-10-20T12:00:00Z',...patch});
const profiles=[profile('b'),profile('a'),profile('c',{fullName:'Casey Jordan',congregation:null,readinessStatus:'on_hold',createdAt:'2026-10-21T12:00:00Z'}),profile('d',{fullName:'Riley Chen',congregation:'Bozeman',lifecycle:'inactive',createdAt:'2026-10-19T12:00:00Z',structuredSkills:[]})];
const older=profile('version',{updatedAt:'2026-10-27T12:00:00.123001Z'}),newer=profile('version',{updatedAt:'2026-10-27T12:00:00.123002+00:00'});
assert.equal(newerVolunteerProfile(older,newer),newer);assert.equal(newerVolunteerProfile(newer,older),newer);
const index=indexDirectory(profiles),ids=rows=>rows.map(row=>row.volunteer.id);
const expected={name_asc:['a','b','c','d'],name_desc:['d','c','a','b'],congregation:['a','b','d','c'],newest:['c','a','b','d'],oldest:['d','a','b','c'],ready:['a','b','d','c'],active:['a','b','c','d']};
for(const sort of Object.keys(directorySortOptions)) {
  assert.deepEqual(ids(sortDirectory(index,sort)),expected[sort]);
  for(const [query,filters] of [['',emptyDirectoryFilters()],['Alex',emptyDirectoryFilters()],['',{...emptyDirectoryFilters(),skills:['Electrical assist','Framing']}],['Alex',{...emptyDirectoryFilters(),statuses:['active'],congregations:['Belgrade'],skills:['Framing']}]]) {
    const filtered=filterDirectory(index,query,filters),before=ids(filtered);
    const sorted=sortDirectory(filtered,sort);assert.equal(sorted.length,filtered.length);assert.deepEqual([...ids(sorted)].sort(),[...before].sort());assert.deepEqual(ids(filtered),before,'Sort cannot mutate original filter results');
  }
}
assert.equal(new Set(ids(sortDirectory(index,'ready'))).size,4,'Same-name and shared-household volunteers retain identity');
assert.deepEqual(filterDirectory(index,'',{...emptyDirectoryFilters(),skills:['Electrical assist','Painting']}),[]);
assert.equal(filterDirectory(index,'Security',emptyDirectoryFilters()).length,0,'Historical snapshot categories are not current search state');
assert.equal(directoryResultCopy('electric',0).resetLabel,'Clear search');assert.equal(directoryResultCopy('',2).resetLabel,'Clear filters');assert.equal(directoryResultCopy('electric',2).resetLabel,'Reset search and filters');
assert.equal(experienceSearchExplanation(profiles[0],'forklift',[]),'Experience note matches “forklift”');assert(!experienceSearchExplanation(profiles[0],'forklift',[]).includes('PRIVATE'));
const timings=[];
for(const size of [100,309,1000,5000]) {
  const roster=Array.from({length:size},(_,n)=>profile(String(n),{fullName:`Volunteer ${size-n}`}));const start=performance.now(),indexed=indexDirectory(roster),indexMs=performance.now()-start;const runs=[];
  for(let n=0;n<20;n++){const at=performance.now();assert.equal(sortDirectory(filterDirectory(indexed,'electrical',{...emptyDirectoryFilters(),skills:['Framing']}),'name_asc').length,size);runs.push(performance.now()-at);}
  timings.push({size,indexMs,filterSortMedianMs:runs.sort((a,b)=>a-b)[10],extraRequests:0});
}
console.log(JSON.stringify({sortCases:28,pass:true,identity:'PASS',authority:'current structured profile state only',timings},null,2));
