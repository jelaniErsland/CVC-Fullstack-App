'use server';
import { readCommunicationsContext } from './communications.server';
import type { ReminderReport } from './assignmentReminders';
export async function readReminderPreview(): Promise<{ report: ReminderReport } | { error: string }> {
  try {
    const context = await readCommunicationsContext();
    if (!context) return { error: 'Reminders unavailable for this account.' };
    const { data, error } = await context.supabase.rpc('read_assignment_reminders', { p_workspace_id: context.workspace.id });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new Error('unavailable');
    return { report: data as unknown as ReminderReport };
  } catch { return { error: 'Reminder history is unavailable. Try again.' }; }
}
