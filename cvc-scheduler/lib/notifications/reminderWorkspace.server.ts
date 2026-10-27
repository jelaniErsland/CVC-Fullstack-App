import 'server-only';
import type { AppSupabaseClient } from '../supabase/types';
import type { Json } from '../supabase/database.types';
import { withReadTimeout } from '../readTimeout';
import { isReminderWorkspaceResult, type ReminderCursor, type ReminderWorkspaceView } from './reminderWorkspace';

// Only an already-authorized Communications context may use this helper.
// The RPC repeats the authoritative actor/capability check, including revocation.
export async function readReminderWorkspaceResult(client: AppSupabaseClient, workspace: string, view: ReminderWorkspaceView, search: string | null = null, cursor: ReminderCursor | null = null, limit = 25) {
  const { data, error } = await withReadTimeout(client.rpc('read_assignment_reminder_workspace', {
    p_workspace_id: workspace, p_view: view, p_limit: limit,
    ...(search ? { p_search: search } : {}), ...(cursor ? { p_cursor: cursor as Json } : {}),
  }), 12_000);
  if (error || !isReminderWorkspaceResult(data, view)) throw new Error('Reminder read unavailable');
  return data;
}
