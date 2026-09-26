import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const gitRoot=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8'}).trim();
const prefix=path.relative(gitRoot,root).replaceAll('\\','/');
const paths=['app','components','lib','scripts/overview-persisted-regression.mjs','scripts/admin-navigation-pending-regression.mjs','scripts/volunteer-home-photo-regression.mjs','scripts/project-quick-view-share-access-browser-regression.mjs',...fs.readdirSync(path.join(root,'scripts')).filter(file=>file.startsWith('12-48-')&&file.endsWith('.mjs')).map(file=>`scripts/${file}`)];
const baseline=process.argv[2]??'5bb1cf6a0609285c7c4c53d4e3516727b67adbac';
let patch=execFileSync('git',['diff',baseline,'--',...paths],{cwd:root,encoding:'utf8'});
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','--',...paths],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
for(const file of untracked){
  const lines=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n').replace(/\n$/,'').split('\n');
  const repoFile=prefix?`${prefix}/${file}`:file;
  patch+=`diff --git a/${repoFile} b/${repoFile}\nnew file mode 100644\n--- /dev/null\n+++ b/${repoFile}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line=>'+'+line).join('\n')}\n`;
}
const out=path.resolve('..','previews','12.48-batch-1','source-diff.patch');
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,patch);
console.log(`Wrote ${path.relative(root,out)} (${patch.length} characters, ${untracked.length} new source files).`);
