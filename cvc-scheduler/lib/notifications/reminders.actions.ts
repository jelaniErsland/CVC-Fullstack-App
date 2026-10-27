'use server';
import { readCommunicationsContext } from './communications.server';
import type { ReminderReport } from './assignmentReminders';
import { readReminderDeliveryStatus } from './reminderStatus.server';
import { withReadTimeout } from '../readTimeout';
import { readReminderWorkspaceResult } from './reminderWorkspace.server';
import type { ReminderCursor, ReminderWorkspaceView, ReminderWorkspaceResult } from './reminderWorkspace';
export async function readReminderWorkspace(view: ReminderWorkspaceView, search: string | null = null, cursor: ReminderCursor | null = null): Promise<{ data: ReminderWorkspaceResult } | { error: string }> {
  try {
    if (!['summary', 'upcoming', 'history', 'why_not'].includes(view) || (search !== null && (typeof search !== 'string' || search.length > 100))) throw new Error('Invalid reminder read');
    const context = await withReadTimeout(readCommunicationsContext(), 10_000);
    if (!context) return { error: 'Reminders unavailable for this account.' };
    return { data: await readReminderWorkspaceResult(context.supabase, context.workspace.id, view, search?.trim() || null, cursor) };
  } catch { return { error: 'Reminders could not be loaded. Please try again.' }; }
}
export async function readReminderStatus() {
  try {
    if (await withReadTimeout(readCommunicationsContext(), 10_000)) return await readReminderDeliveryStatus();
  } catch { /* No status or system read without an authorized context. */ }
  return { enabled: null, observedAt: new Date().toISOString() };
}
export async function readReminderPreview(after: string | null = null): Promise<{ report: ReminderReport } | { error: string }> {
  try {
    if (after !== null && (typeof after !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(after))) return { error: 'Invalid preview page. Refresh the preview.' };
    const context = await readCommunicationsContext();
    if (!context) return { error: 'Reminders unavailable for this account.' };
    const { data, error } = await context.supabase.rpc('read_assignment_reminders', { p_workspace_id: context.workspace.id, ...(after ? { p_after: after } : {}) });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('unavailable');
    return { report: data as unknown as ReminderReport };
  } catch { return { error: 'Reminder history is unavailable. Try again.' }; }
}
