import 'server-only';

export type ReminderStage =
  | 'database_config_failed' | 'connection_failed' | 'transaction_begin_failed'
  | 'role_assumption_failed' | 'transaction_settings_failed' | 'worker_command_failed'
  | 'transaction_commit_failed' | 'status_failed' | 'enrollment_sync_failed'
  | 'due_query_failed' | 'claim_failed' | 'revalidation_failed' | 'finalization_failed'
  | 'provider_config_failed' | 'provider_init_failed' | 'unexpected_worker_failure';

// Only fixed classifications escape the driver. Never retain/log error messages,
// SQL, payloads, addresses, connection options, provider responses or stacks.
const safeCodes = new Set([
  '08000', '08001', '08003', '08006', '08P01', '28000', '28P01', '42501',
  '55000', '57014', '55P03', '25P02', '40001', '40P01', '53300', '57P01',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN',
]);

export class ReminderStageFailure extends Error {
  readonly errorCode: string;
  readonly databaseStage?: ReminderStage;
  readonly stage: ReminderStage;
  constructor(stage: ReminderStage, error?: unknown) {
    super('Reminder operation unavailable');
    this.stage = stage;
    this.name = 'ReminderStageFailure';
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    this.errorCode = error instanceof ReminderStageFailure ? error.errorCode
      : typeof code === 'string' && safeCodes.has(code) ? code : 'unclassified';
    this.databaseStage = error instanceof ReminderStageFailure ? error.databaseStage ?? error.stage : undefined;
  }
}

export function reminderFailureMetadata(error: unknown) {
  const failure = error instanceof ReminderStageFailure ? error : new ReminderStageFailure('unexpected_worker_failure');
  return { stage: failure.stage, errorCode: failure.errorCode,
    ...(failure.databaseStage ? { databaseStage: failure.databaseStage } : {}),
    errorClass: failure.databaseStage || failure.stage === 'database_config_failed' ? 'database'
      : failure.stage === 'provider_config_failed' || failure.stage === 'provider_init_failed' ? 'configuration' : 'worker' };
}
