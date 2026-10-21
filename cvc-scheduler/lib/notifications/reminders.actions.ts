'use server';
import { readCommunicationsContext } from './communications.server';
import type { ReminderReport } from './assignmentReminders';
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
