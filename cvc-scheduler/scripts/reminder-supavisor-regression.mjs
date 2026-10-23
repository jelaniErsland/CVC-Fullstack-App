import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sql,q} from './12-47-local-fixtures.mjs';
import {withLocalSupavisor} from './reminder-supavisor-local-fixture.mjs';
import {withLocalReminderRunner} from './reminder-database-local-fixture.mjs';
import {createReminderWorkerRpc} from '../lib/notifications/reminderDatabase.server.ts';
await withLocalReminderRunner(async({password,environment})=>{
 await withLocalSupavisor(async({poolerConfig,Pool})=>{
  const pool=new Pool(poolerConfig(password));
  try {
   const rpc=createReminderWorkerRpc(environment,pool);
   for(let i=0;i<3;i++){
    assert.equal((await rpc('status')).enabled,false);
    const client=await pool.connect();try{assert.equal((await client.query('select current_user')).rows[0].current_user,'project_local_reminder_runner');}finally{client.release();}
   }
   const both=await Promise.all([rpc('status'),rpc('status')]);assert(both.every(s=>s.enabled===false));
   await pool.end();
   const replacement=randomBytes(32).toString('hex');sql(`alter role project_local_reminder_runner password ${q(replacement)}`);
   const fresh=new Pool(poolerConfig(replacement));let immediate;
   try {await fresh.query('select current_user');immediate='accepted';}catch(error){immediate=error.code??'connection_failure';}finally{await fresh.end();}
   if(immediate!=='accepted')await new Promise(resolve=>setTimeout(resolve,17000));
   const rotated=new Pool(poolerConfig(replacement));try{assert.equal((await rotated.query('select current_user')).rows[0].current_user,'project_local_reminder_runner');}finally{await rotated.end();}
   console.log(JSON.stringify({localPasswordRotation:true,immediateResult:immediate,acceptedAfterBoundedWait:true}));
   console.log('PASS actual LOCAL Supavisor2.9.13 custom LOGIN auth-query / transaction port / SET LOCAL ROLE / COMMIT reset / overlapping Off calls. Pool max1; no hosted connection or provider.');
  }finally{if(!pool.ended)await pool.end();}
 });
});
