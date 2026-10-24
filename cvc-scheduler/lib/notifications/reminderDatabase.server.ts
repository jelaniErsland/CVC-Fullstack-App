import 'server-only';
import { Pool, type PoolConfig } from 'pg';
import type { ReminderRpc } from './assignmentReminders.ts';
import { SUPABASE_POOLER_CA } from './supabasePoolerCA.server.ts';
import { ReminderStageFailure, type ReminderStage } from './reminderDiagnostics.server.ts';

// Copied from the owner's hosted Connect / shared transaction-pooler panel.
// This transport is a system capability, never an admin/user database connection.
export const REMINDER_POOLER_HOST = 'aws-1-us-west-2.pooler.supabase.com';
export const REMINDER_DATABASE_USER = 'project_local_reminder_runner.wdlaauzknfggoqldolmx';

export function reminderDatabaseConfiguration(environment: NodeJS.ProcessEnv): PoolConfig {
  let url: URL;
  try { url = new URL(environment.REMINDER_DATABASE_URL ?? ''); }
  catch { throw new Error('Reminder database configuration unavailable'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== REMINDER_POOLER_HOST
    || url.port !== '6543' || decodeURIComponent(url.username) !== REMINDER_DATABASE_USER
    || !url.password || url.pathname !== '/postgres' || url.search || url.hash) {
    throw new Error('Invalid restricted reminder database configuration');
  }
  // Construct fields explicitly: URI sslmode/options must never override TLS or
  // smuggle startup/session state. All role/timeout settings below are LOCAL.
  return {
    host: url.hostname, port: 6543, user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: 'postgres',
    ssl: { rejectUnauthorized: true, servername: REMINDER_POOLER_HOST, ca: SUPABASE_POOLER_CA },
    max: 1, connectionTimeoutMillis: 5000, query_timeout: 10000,
    idleTimeoutMillis: 1000, maxLifetimeSeconds: 60, allowExitOnIdle: true,
    application_name: 'project-local-reminder-runner',
  };
}

// A single bounded connection pool, not a cache of user authorization or data.
// Configuration changes require a new deployment. Idle sockets close after 1s.
let processPool: Pool | undefined;
function databasePool(environment: NodeJS.ProcessEnv): Pool {
  if (!processPool) {
    processPool = new Pool(reminderDatabaseConfiguration(environment));
    // An idle socket error must not crash the process or log connection secrets.
    processPool.on('error', () => console.error(JSON.stringify({ event: 'reminder_database', failure: 'idle_connection_unavailable' })));
  }
  return processPool;
}

export function createReminderWorkerRpc(environment: NodeJS.ProcessEnv = process.env, injectedPool?: Pick<Pool, 'connect'>): ReminderRpc {
  // Validate even when a test injects a local pool. No connection occurs here.
  try { reminderDatabaseConfiguration(environment); }
  catch (error) { throw new ReminderStageFailure('database_config_failed', error); }
  return async (command, payload = {}) => {
    const client = await (injectedPool ?? databasePool(environment)).connect()
      .catch(error => { throw new ReminderStageFailure('connection_failed', error); });
    let discard = false;
    let stage: ReminderStage = 'transaction_begin_failed';
    try {
      await client.query('BEGIN');
      stage = 'role_assumption_failed';
      await client.query('SET LOCAL ROLE project_local_reminder_worker');
      stage = 'transaction_settings_failed';
      await client.query("SET LOCAL statement_timeout = '8s'");
      await client.query("SET LOCAL lock_timeout = '3s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '5s'");
      // Unnamed, parameterized query: no transaction-pooler prepared statements.
      stage = 'worker_command_failed';
      const result = await client.query('SELECT public.run_assignment_reminder_worker($1::text, $2::jsonb) AS result', [command, JSON.stringify(payload)]);
      stage = 'transaction_commit_failed';
      await client.query('COMMIT');
      return result.rows[0]?.result;
    } catch (error) {
      discard = true;
      try { await client.query('ROLLBACK'); } catch { /* Destroy the socket below. */ }
      // Never retry a command whose commit outcome might be unknown.
      throw new ReminderStageFailure(stage, error);
    } finally {
      client.release(discard);
    }
  };
}
