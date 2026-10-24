import 'server-only';
import { randomUUID } from 'node:crypto';
import { verifySchedulerRequest } from '../../workers/reminder-clock/src/protocol.mjs';
import { sweepAssignmentReminders, type ReminderDelivery, type ReminderRpc } from './assignmentReminders.ts';
import { readInitialAssignmentEmailConfiguration, type InitialAssignmentEmailConfiguration } from './initialAssignmentEmail.server.ts';
import { sendSingleRecipientMessage } from './singleRecipientTransport.server.ts';
import { createReminderWorkerRpc } from './reminderDatabase.server.ts';
import { ReminderStageFailure, reminderFailureMetadata, type ReminderStage } from './reminderDiagnostics.server.ts';
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
  const rpc = rpcFactory(environment);
  const stages: Record<string, ReminderStage> = { status: 'status_failed', sync: 'enrollment_sync_failed',
    due: 'due_query_failed', claim: 'claim_failed', revalidate: 'revalidation_failed', finalize: 'finalization_failed' };
  return sweepAssignmentReminders(async (command, payload) => {
    try {
      const result = await rpc(command, payload);
      const object = result && typeof result === 'object' ? result as Record<string, unknown> : null;
      const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
      if (command === 'status' && (!object || typeof object.enabled !== 'boolean'
        || !Array.isArray(object.workspaces) || object.workspaces.length > 20 || !object.workspaces.every(uuid))) {
        throw new Error('Invalid worker status');
      }
      if (command === 'sync' && (!object || !Number.isInteger(object.evaluated)
        || (object.evaluated as number) < 0 || (object.evaluated as number) > 200
        || !(object.after === null || uuid(object.after)))) throw new Error('Invalid worker sync result');
      if (command === 'due' && (!Array.isArray(result) || result.length > 20 || !result.every(uuid))) {
        throw new Error('Invalid worker due result');
      }
      return result;
    }
    catch (error) { throw new ReminderStageFailure(stages[command] ?? 'unexpected_worker_failure', error); }
  }, 'https://projectlocal.app', () => {
    let configuration: InitialAssignmentEmailConfiguration;
    try {
      configuration = readInitialAssignmentEmailConfiguration(environment);
      if (!configuration.ok) throw new Error('Unavailable configuration');
    } catch (error) { throw new ReminderStageFailure('provider_config_failed', error); }
    try {
      const delivery = createReminderDelivery(configuration, request);
      if (!delivery) throw new Error('Unavailable delivery');
      return delivery;
    } catch (error) { throw new ReminderStageFailure('provider_init_failed', error); }
  });
}

export async function handleReminderWorker(request: Request, environment: NodeJS.ProcessEnv = process.env, requestProvider: typeof fetch = fetch, rpcFactory: RpcFactory = createReminderWorkerRpc) {
  if (!await verifySchedulerRequest(request, environment.REMINDER_SCHEDULER_HMAC_SECRET)) {
    return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const runId = randomUUID();
  const started = performance.now();
  try {
    const stats = await runReminderWorker(environment, requestProvider, rpcFactory);
    console.info(JSON.stringify({ event: 'assignment_reminder_sweep', runId, ...stats }));
    return Response.json(stats, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'assignment_reminder_sweep', failure: 'worker_unavailable',
      runId, ...reminderFailureMetadata(error), elapsedMs: Math.round(performance.now() - started),
      httpStatus: 503, at: new Date().toISOString() }));
    return Response.json({ error: 'Reminder sweep unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
