import 'server-only';
import { verifySchedulerRequest } from '../../workers/reminder-clock/src/protocol.mjs';
import { sweepAssignmentReminders, type ReminderDelivery, type ReminderRpc } from './assignmentReminders.ts';
import { readInitialAssignmentEmailConfiguration, type InitialAssignmentEmailConfiguration } from './initialAssignmentEmail.server.ts';
import { sendSingleRecipientMessage } from './singleRecipientTransport.server.ts';
import { createReminderWorkerRpc } from './reminderDatabase.server.ts';
type RpcFactory = (environment: NodeJS.ProcessEnv) => ReminderRpc;
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

export async function runReminderWorker(environment: NodeJS.ProcessEnv = process.env, request: typeof fetch = fetch, rpcFactory: RpcFactory = createReminderWorkerRpc) {
  return sweepAssignmentReminders(rpcFactory(environment), 'https://projectlocal.app', () => {
    const delivery = createReminderDelivery(readInitialAssignmentEmailConfiguration(environment), request);
    if (!delivery) throw new Error('Reminder provider configuration unavailable');
    return delivery;
  });
}

export async function handleReminderWorker(request: Request, environment: NodeJS.ProcessEnv = process.env, requestProvider: typeof fetch = fetch, rpcFactory: RpcFactory = createReminderWorkerRpc) {
  if (!await verifySchedulerRequest(request, environment.REMINDER_SCHEDULER_HMAC_SECRET)) {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const stats = await runReminderWorker(environment, requestProvider, rpcFactory);
    console.info(JSON.stringify({ event: 'assignment_reminder_sweep', ...stats }));
    return Response.json(stats, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error(JSON.stringify({ event: 'assignment_reminder_sweep', failure: 'worker_unavailable', at: new Date().toISOString() }));
    return Response.json({ error: 'Reminder sweep unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
