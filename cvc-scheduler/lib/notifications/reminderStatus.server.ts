import 'server-only';
import { withReadTimeout } from '../readTimeout.ts';
import { createReminderWorkerRpc } from './reminderDatabase.server.ts';
import type { ReminderDeliveryStatus } from './assignmentReminders.ts';

// Call only after Communications authorization. This existing system operation
// reads the singleton; it never synchronizes, enrolls, claims or loads a provider.
export async function readReminderDeliveryStatus(
  read: () => Promise<unknown> = () => createReminderWorkerRpc()('status'),
): Promise<ReminderDeliveryStatus> {
  let enabled: boolean | null = null;
  try {
    const result = await withReadTimeout(read(), 10_000);
    if (result && typeof result === 'object' && 'enabled' in result && typeof result.enabled === 'boolean') {
      enabled = result.enabled;
    }
  } catch { /* Unavailable is distinct from authoritative Off. */ }
  return { enabled, observedAt: new Date().toISOString() };
}
