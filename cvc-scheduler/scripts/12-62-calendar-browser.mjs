// Existing full Calendar suite on the local production-mode fixture server.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const server=spawn(process.execPath,['scripts/reminder-workspace-browser.mjs','--fixture-server'],{env:{...process.env,NODE_ENV:'production',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled',REMINDER_DATABASE_URL:'',RESEND_API_KEY:'',REMINDER_SCHEDULER_HMAC_SECRET:''},windowsHide:true,stdio:['pipe','pipe','pipe']});
let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
try{
 await new Promise((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{if(log.includes('REMINDER_UI_READY')){clearInterval(timer);resolve();}else if(server.exitCode!==null||Date.now()-start>30000){clearInterval(timer);reject(Error(log.slice(-2500)));}},50);});
 const test=spawn(process.execPath,['scripts/calendar-regression.mjs'],{env:{...process.env,PREVIEW_BASE_URL:'http://localhost:3000',ASSIGNMENT_NOTIFICATION_EMAIL_TRANSPORT:'disabled'},windowsHide:true,stdio:'inherit'});
 const code=await new Promise(resolve=>test.once('exit',resolve));assert.equal(code,0);
}finally{
 if(server.exitCode===null){const done=new Promise(resolve=>server.once('exit',resolve));server.stdin.end('stop');await done;}
}
