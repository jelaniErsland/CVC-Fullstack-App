import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { directoryCategoryCount, emptyDirectoryFilters, filterDirectory, indexDirectory, prioritizedSkills, recordedVolunteerSkills } from '../lib/volunteers/directoryFilters.ts';

const profile=(id,patch={})=>({id,workspaceId:'project-a',fullName:'John Smith',email:'household@example.invalid',phone:null,congregation:'Belgrade',lifecycle:'active',readinessStatus:'ready',profileNotes:'',skillsExperience:null,otherSupport:null,availableWorkDays:['Monday'],afterHoursSecurityAvailability:'yes',housingOption:'no',availableTwoPlusDays:'yes',availabilitySnapshot:{},structuredSkills:['Electrical assist','Framing'],skillsHelpSnapshot:{},...patch});
const roster=[profile('a'),profile('b',{congregation:'Bozeman',availableWorkDays:['Wednesday']}),profile('c',{lifecycle:'inactive',structuredSkills:['Electrical assist']}),profile('d',{fullName:'Maria Lane',congregation:'Helena',availableWorkDays:['Friday'],structuredSkills:[],skillsHelpSnapshot:{},skillsExperience:'Electrical experience, not a structured skill record'})];
const index=indexDirectory(roster),find=(query='',patch={})=>filterDirectory(index,query,{...emptyDirectoryFilters(),...patch}).map(x=>x.volunteer.id);
assert.deepEqual(find('john'),['a','b','c']);
assert.deepEqual(find('elec'),['a','b','c','d']);
assert.deepEqual(find('ELECTRICAL'),find('electrical'));
assert.deepEqual(find('',{congregations:['Belgrade','Bozeman']}),['a','b','c']);
assert.deepEqual(find('',{statuses:['active','inactive']}),['a','b','c','d']);
assert.deepEqual(find('',{days:['Monday','Wednesday']}),['a','b','c']);
assert.deepEqual(find('',{skills:['Electrical assist','Framing']}),['a','b']);
const combined={statuses:['active'],congregations:['Belgrade','Bozeman'],days:['Monday','Wednesday'],skills:['Electrical assist','Framing']};
assert.deepEqual(find('',combined),['a','b']);assert.deepEqual(find('john',combined),['a','b']);assert.deepEqual(find('maria',combined),[]);
assert.equal(directoryCategoryCount({...emptyDirectoryFilters(),congregations:['Belgrade','Bozeman'],days:['Monday','Wednesday','Saturday'],skills:['Electrical assist','Framing']}),3);
assert.deepEqual(find('',{...combined,skills:['Plumbing assist']}),[]);
assert.deepEqual(find('household@example.invalid'),['a','b','c','d'],'Household contacts never collapse volunteer identities');
assert.deepEqual(find('John Smith'),['a','b','c'],'Same names remain separate');
assert.throws(()=>recordedVolunteerSkills(profile('e',{structuredSkills:['Forklift','Electrical','Electrical assist']})),/invalid/,'Malformed current choices fail closed');
assert.deepEqual(recordedVolunteerSkills(profile('history',{structuredSkills:[],skillsHelpSnapshot:{skillsExperience:{categories:['Painting']}}})),[],'Historical snapshots never override current profile skills');
assert.deepEqual(recordedVolunteerSkills(roster[3]),[],'Free prose stays searchable without becoming qualifications');
assert.deepEqual(prioritizedSkills(['Framing','Electrical assist'],'elec',[]),['Electrical assist','Framing']);
assert.deepEqual(find('',{security:'no'}),[]);assert.deepEqual(find('',{housing:'no'}),['a','b','c','d']);assert.deepEqual(find('',{twoPlusDays:'yes'}),['a','b','c','d']);
const timings=[];for(const size of [100,300,1000,5000]){const list=Array.from({length:size},(_,i)=>profile(String(i)));const start=performance.now();const indexed=indexDirectory(list);const indexMs=performance.now()-start;const trials=[];for(let i=0;i<20;i++){const at=performance.now();assert.equal(filterDirectory(indexed,'elec',{...emptyDirectoryFilters(),...combined}).length,size);trials.push(performance.now()-at);}timings.push({size,indexMs,filterMedianMs:trials.sort((a,b)=>a-b)[10],extraFilterRequests:0});}
console.log(JSON.stringify({pass:true,semantics:'OR status/congregation/day; ALL selected skills; AND categories',timings},null,2));
