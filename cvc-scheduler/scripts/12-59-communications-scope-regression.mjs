import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const base='a42782a82ce867308f4083b3caef34d850504464';
const normalize=s=>s.replaceAll('\r','');
const before=file=>normalize(execFileSync('git',['show',`${base}:cvc-scheduler/${file}`],{encoding:'utf8',windowsHide:true}));
const protectedPaths=['supabase','lib/auth','lib/notifications','workers','app/internal','next.config.ts','package.json','package-lock.json','scripts/production-backup'];
for(const args of [['diff',base,'--name-only','--',...protectedPaths],['ls-files','--others','--exclude-standard','--',...protectedPaths]]){
 const files=execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim().split(/\r?\n/).filter(Boolean).map(file=>file.replace(/^cvc-scheduler\//,'')).filter(file=>file!=='lib/notifications/communicationPresentation.ts');
 assert.deepEqual(files,[],'No SQL, authority, read-model, engine, infrastructure, build-guard or dependency changes');
}
function syntax(text){const source=ts.createSourceFile('component.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const functions=new Map(),handlers=[];function visit(node){if(ts.isFunctionDeclaration(node)&&node.name)functions.set(node.name.text,node.getText(source));if(ts.isJsxAttribute(node)&&/^on(Click|Change|Submit|KeyDown)$/.test(node.name.getText(source)))handlers.push(node.getText(source));ts.forEachChild(node,visit);}visit(source);return{functions,handlers:handlers.sort()};}
for(const [file,names]of [['components/CommunicationsWorkspace.tsx',['run']],['components/AssignmentReminderHistory.tsx',['refreshSummary','load','changeView']]]){
 const old=syntax(before(file)),now=syntax(normalize(fs.readFileSync(file,'utf8')));
 for(const name of names)assert.equal(now.functions.get(name),old.functions.get(name),`${file} ${name} must remain exact`);
 assert.deepEqual(now.handlers,old.handlers,`${file} event/mutation handlers must remain exact`);
}
const current=normalize(fs.readFileSync('components/CommunicationsWorkspace.tsx','utf8'));
assert(!current.includes("activeTab === 'reminders' ? 'max-w-4xl'"));
assert(current.includes('timezone: string'));
console.log('PASS exact pre-existing event handlers, send/review/retry orchestration, reminder async reads, and protected backend/infrastructure/dependency paths; timezone is presentation-only.');
