// Real Supavisor transaction-mode fixture. Fixed LOCAL database/container only.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import {sql,value} from './12-47-local-fixtures.mjs';
const container='pl-1257c-supavisor-fixture',database='pl_1257c_supavisor_fixture';
const run=(args)=>spawnSync('docker',args,{encoding:'utf8',windowsHide:true,timeout:120000});
export async function withLocalSupavisor(test) {
 assert.equal(value(`select count(*) from pg_database where datname='${database}'`),'0','Refuse existing metadata DB');
 assert.notEqual(run(['inspect',container]).status,0,'Refuse existing container');
 const status=spawnSync('C:\\Users\\mtfis\\scoop\\shims\\supabase.exe',['status','--output','json'],{encoding:'utf8',windowsHide:true});assert.equal(status.status,0);
 const local=JSON.parse(status.stdout.slice(status.stdout.indexOf('{'))),url=new URL(local.DB_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'54322');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pl-reminder-supavisor-')),config=path.join(directory,'pooler.exs');
 // Same auth-query/custom-role contract as the official self-hosted deployment.
 fs.writeFileSync(config,`{:ok, _} = Application.ensure_all_started(:supavisor)
params = %{"external_id" => "local-reminder-fixture", "db_host" => "host.docker.internal", "db_port" => 54322, "db_database" => "postgres", "require_user" => false, "auth_query" => "SELECT * FROM pgbouncer.get_auth($1)", "default_max_clients" => 4, "default_pool_size" => 1, "default_parameter_status" => %{"server_version" => "17.6"}, "users" => [%{"db_user" => "pgbouncer", "db_password" => System.get_env("LOCAL_DATABASE_PASSWORD"), "mode_type" => "transaction", "pool_size" => 1, "is_manager" => true}]}
{:ok, _} = Supavisor.Tenants.create_tenant(params)
`);
 let created=false;
 try {
  sql(`create database ${database};`);
  const settings={DATABASE_URL:`ecto://postgres:${url.password}@host.docker.internal:54322/${database}`,LOCAL_DATABASE_PASSWORD:decodeURIComponent(url.password),SECRET_KEY_BASE:randomBytes(64).toString('hex'),VAULT_ENC_KEY:randomBytes(16).toString('hex'),API_JWT_SECRET:randomBytes(32).toString('hex'),METRICS_JWT_SECRET:randomBytes(32).toString('hex'),CLUSTER_POSTGRES:'true',REGION:'local',DB_POOL_SIZE:'1',ERL_AFLAGS:'-proto_dist inet_tcp'};
  const args=['run','-d','--name',container,'--label','project-local.fixture=reminder-supavisor','-p','127.0.0.1:56543:6543','-v',`${config}:/etc/pooler/pooler.exs:ro`];
  for(const [key,val]of Object.entries(settings))args.push('-e',`${key}=${val}`);
  args.push('supabase/supavisor:2.9.13','/bin/sh','-c','/app/bin/migrate && /app/bin/supavisor eval "$(cat /etc/pooler/pooler.exs)" && /app/bin/server');
  const start=run(args);assert.equal(start.status,0,'Local Supavisor failed to start');created=true;
  let ready=false;
  for(let attempt=0;attempt<40;attempt++){
   const health=run(['exec',container,'curl','-sf','http://127.0.0.1:4000/api/health']);if(health.status===0){ready=true;break;}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!ready){const logs=run(['logs','--tail','20',container]).stdout;throw new Error('Local Supavisor readiness failed: '+logs.replaceAll(url.password,'[local credential redacted]'));}
  await test({poolerConfig:password=>({host:'127.0.0.1',port:56543,user:'project_local_reminder_runner.local-reminder-fixture',password,database:'postgres',ssl:false,max:1,connectionTimeoutMillis:5000,idleTimeoutMillis:100,allowExitOnIdle:true}),Pool:pg.Pool});
 }finally{
  if(created){assert.equal(run(['inspect',container,'--format','{{index .Config.Labels "project-local.fixture"}}']).stdout.trim(),'reminder-supavisor');assert.equal(run(['rm','-f',container]).status,0,'Remove only the owned local fixture container');}
  sql(`drop database if exists ${database} with (force);`);
  fs.unlinkSync(config);fs.rmdirSync(directory);
 }
}
