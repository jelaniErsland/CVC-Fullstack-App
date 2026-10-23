import 'server-only';
import { verifySchedulerRequest } from '../../workers/reminder-clock/src/protocol.mjs';
import { sweepAssignmentReminders, type ReminderDelivery, type ReminderRpc } from './assignmentReminders.ts';
import { readInitialAssignmentEmailConfiguration, type InitialAssignmentEmailConfiguration } from './initialAssignmentEmail.server.ts';
import { sendSingleRecipientMessage } from './singleRecipientTransport.server.ts';

export function createReminderWorkerRpc(environment: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch): ReminderRpc {
  const root = environment.NEXT_PUBLIC_SUPABASE_URL;
  const credential = environment.REMINDER_DATABASE_JWT;
  const apiKey = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!root || !credential || !apiKey) throw new Error('Reminder worker configuration unavailable');
  // Reject accidental use of an ordinary service-role/admin token. Server verifies signature;
  // this local check additionally catches wrong provisioning before making any request.
  let claims: { role?: string; exp?: number };
  try { claims = JSON.parse(Buffer.from(credential.split('.')[1], 'base64url').toString()); } catch { throw new Error('Invalid reminder worker credential'); }
  if (claims.role !== 'project_local_reminder_worker' || !Number.isFinite(claims.exp) || !claims.exp || claims.exp * 1000 <= Date.now()) throw new Error('Wrong reminder worker credential');
  const url = new URL('/rest/v1/rpc/run_assignment_reminder_worker', root);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) throw new Error('Invalid worker database origin');
  return async (command, payload = {}) => {
    const response = await request(url, { method: 'POST', headers: { apikey: apiKey, Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_command: command, p_payload: payload }), signal: AbortSignal.timeout(10000), cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error('Reminder database operation unavailable');
    return response.json();
  };
}
export function createReminderDelivery(configuration: InitialAssignmentEmailConfiguration, request: typeof fetch = fetch): ReminderDelivery | undefined {
  if (!configuration.ok) return undefined;
  return {
    kind: 'provider',
    send: (context, message) => sendSingleRecipientMessage(configuration, {
      operationId: context.operationId, recipientId: context.recipientId, attempt: context.attempt,
      email: context.email, ...message,
    }, { fetch: request }),
  };
}

export async function runReminderWorker(environment: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch) {
  return sweepAssignmentReminders(createReminderWorkerRpc(environment, request), 'https://projectlocal.app', () => {
    const delivery = createReminderDelivery(readInitialAssignmentEmailConfiguration(environment), request);
    if (!delivery) throw new Error('Reminder provider configuration unavailable');
    return delivery;
  });
}

export async function handleReminderWorker(request: Request, environment: NodeJS.ProcessEnv = process.env, requestProvider: typeof fetch = fetch) {
  if (!await verifySchedulerRequest(request, environment.REMINDER_SCHEDULER_HMAC_SECRET)) {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const stats = await runReminderWorker(environment, requestProvider);
    console.info(JSON.stringify({ event: 'assignment_reminder_sweep', ...stats }));
    return Response.json(stats, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error(JSON.stringify({ event: 'assignment_reminder_sweep', failure: 'worker_unavailable', at: new Date().toISOString() }));
    return Response.json({ error: 'Reminder sweep unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
