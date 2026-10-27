import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
const base='551d786b07476bf3b132b5ee4ba85ef4457b43eb';
const git=(...args)=>{const r=spawnSync('git',args,{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;};
const printer=ts.createPrinter({removeComments:true});
const functions=text=>{const source=ts.createSourceFile('source.ts',text,ts.ScriptTarget.Latest,true);return new Map(source.statements.filter(ts.isFunctionDeclaration).map(n=>[n.name.text,printer.printNode(ts.EmitHint.Unspecified,n,source)]));};
const filename='lib/volunteers/server.ts';
const old=functions(git('show',`${base}:cvc-scheduler/${filename}`)),current=functions(fs.readFileSync(filename,'utf8'));
assert.equal(old.size,current.size);for(const[name,text]of old)if(name!=='readVolunteerProfilesWithClient')assert.equal(current.get(name),text,`${name} mutation/validation/privacy contract changed`);
const files=new Set([...git('diff','--name-only',base).trim().split(/\r?\n/),...git('ls-files','--others','--exclude-standard').trim().split(/\r?\n/)]);
for(const file of files){const p=file.replace(/^cvc-scheduler\//,'');assert(!/^(supabase\/|lib\/(?:auth|notifications|security|supabase|assignmentReminders|projectQuickViewAccess)\/|app\/internal\/|workers\/)/.test(p),`Protected path changed: ${file}`);assert(!/(?:package(?:-lock)?\.json|next\.config|vercel\.json|wrangler|production-backup)/.test(p),`Infrastructure/dependency path changed: ${file}`);}
assert.equal(git('diff',base,'--','lib/volunteers/profile.ts','lib/volunteers/schedule.server.ts','lib/questionnaires/schedulerFacets.ts').trim(),'','No profile projection, schedule or skill-authority change');
console.log('PASS exact existing volunteer mutation/validation functions; unchanged profile/skill authority; no migration, auth, RLS, notification, reminder, infrastructure or dependency changes.');
