import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { sweepAssignmentReminders, type ReminderRpc } from './assignmentReminders.ts';

export function authorizeReminderWorker(authorization: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || secret.length > 256 || !authorization || authorization.length > 300) return false;
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function createReminderWorkerRpc(environment: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch): ReminderRpc {
  const root = environment.NEXT_PUBLIC_SUPABASE_URL;
  const credential = environment.REMINDER_DATABASE_JWT;
  const apiKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!root || !credential || !apiKey) throw new Error('Reminder worker configuration unavailable');
  // Reject accidental use of an ordinary service-role/admin token. Server verifies signature;
  // this local check additionally catches wrong provisioning before making any request.
  let claims: { role?: string; exp?: number };
  try { claims = JSON.parse(Buffer.from(credential.split('.')[1], 'base64url').toString()); } catch { throw new Error('Invalid reminder worker credential'); }
  if (claims.role !== 'project_local_reminder_worker' || !claims.exp || claims.exp * 1000 <= Date.now()) throw new Error('Wrong reminder worker credential');
  const url = new URL('/rest/v1/rpc/run_assignment_reminder_worker', root);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('Invalid worker database origin');
  return async (command, payload = {}) => {
    const response = await request(url, { method: 'POST', headers: { apikey: apiKey, Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_command: command, p_payload: payload }), signal: AbortSignal.timeout(10000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('Reminder database operation unavailable');
    return response.json();
  };
}
export async function runDisabledReminderWorker() {
  return sweepAssignmentReminders(createReminderWorkerRpc(), 'https://projectlocal.app');
}
