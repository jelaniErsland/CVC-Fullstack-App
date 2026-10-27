// Emits paths/kinds only. Never print matched secrets or environment values.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const root=path.resolve('..');
const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(r.status,0);return r.stdout.trim().split(/\r?\n/).filter(Boolean);};
const changed=new Set([...git('diff','--name-only','HEAD'),...git('ls-files','--others','--exclude-standard')]);
const patterns=[['private_key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['jwt',/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],['provider_key',/\b(?:re_|sbp_|sb_secret_)[A-Za-z0-9_-]{12,}\b/g],['connection_uri',/postgres(?:ql)?:\/\/[^\s/@:]+:[^\s/@]+@[^\s/]+/g]];
const findings=[];let scanned=0;
for(const file of changed){
 if(!/\.(?:[cm]?[jt]sx?|json|md|sql|ps1|ya?ml|toml|sh)$/.test(file)||!fs.existsSync(path.join(root,file)))continue;
 const text=fs.readFileSync(path.join(root,file),'utf8');scanned++;
 for(const[kind,re]of patterns)for(const m of text.matchAll(re)){
  if(/^re_local_(?:fixture_only|simulation_only|simulated_only)$/.test(m[0]))continue;
  findings.push({file,kind,line:text.slice(0,m.index).split('\n').length});
 }
}
const clientRoot=path.resolve(process.argv[2]??'.next/static');let chunks=0;const clientFindings=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(js|map)$/.test(f)){chunks++;const text=fs.readFileSync(f,'utf8');if(/REMINDER_DATABASE_URL|REMINDER_SCHEDULER_HMAC_SECRET|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|BEGIN (?:RSA |EC )?PRIVATE KEY|postgres(?:ql)?:\/\//.test(text))clientFindings.push(path.relative(clientRoot,f));}}}
walk(clientRoot);assert(chunks>0);
const result={sourceFilesScanned:scanned,sourceFindings:findings,compiledClientFiles:chunks,compiledClientFindings:clientFindings};
console.log(JSON.stringify(result,null,2));assert.equal(findings.length,0,'Credential-pattern review required');assert.equal(clientFindings.length,0,'Server secret boundary in compiled client');
