// Presentation contract only. No policy calculation or delivery capability.
export type ReminderWorkspaceView = 'summary' | 'upcoming' | 'history' | 'why_not';
export type ReminderCursor = { id: string; at?: string };
export type ReminderWorkspaceRow = {
  id: string; assignment_id: string; volunteer_id: string; volunteer: string; assignment: string;
  start_at: string | null; due_at?: string; occurrence_key?: string; response?: string | null;
  state?: string; retry_at?: string | null; activity_at?: string; attempt?: number; reason?: string;
};
export type ReminderWorkspaceSummary = {
  view: 'summary'; observedAt: string; timezone: string; enabled: boolean;
  nextBatch: { dueAt: string; count: number } | null;
  lastActivity: { id: string; volunteer: string; assignment: string; occurrence_key: string; state: string; activity_at: string } | null;
  failedCount: number; unknownCount: number;
};
export type ReminderWorkspacePage = {
  view: Exclude<ReminderWorkspaceView, 'summary'>; observedAt: string; timezone: string;
  rows: ReminderWorkspaceRow[]; nextCursor: ReminderCursor | null;
};
export type ReminderWorkspaceResult = ReminderWorkspaceSummary | ReminderWorkspacePage;
export const reminderWorkspaceLabel = (key: string) => ({
  'shift:30': '30-day reminder', 'shift:14': '14-day reminder', 'shift:7': '7-day reminder',
  'shift:3': '3-day reminder', 'shift:1': 'Day-before reminder',
})[key] ?? 'Awaiting response reminder';
export const reminderOutcomeLabel = (state: string) => ({
  sent: 'Sent', failed: 'Failed', unknown: 'Unknown — needs review', sending: 'Sending',
  excluded: 'Not sent — eligibility changed', scheduled: 'Scheduled', retry_scheduled: 'Automatic retry scheduled',
})[state] ?? 'Status unavailable';

// The network boundary must reject a mismatched result rather than publishing
// the wrong tab or a false Off/empty state. Never infer missing summary values.
export function isReminderWorkspaceResult(value: unknown, view: ReminderWorkspaceView): value is ReminderWorkspaceResult {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  if (r.view !== view || typeof r.timezone !== 'string' || typeof r.observedAt !== 'string' || !Number.isFinite(Date.parse(r.observedAt))) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: r.timezone }).format(); } catch { return false; }
  const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  if (view === 'summary') {
    if (typeof r.enabled !== 'boolean' || !count(r.failedCount) || !count(r.unknownCount)) return false;
    const batch = r.nextBatch as ReminderWorkspaceSummary['nextBatch'];
    const activity = r.lastActivity as ReminderWorkspaceSummary['lastActivity'];
    return (batch === null || !!batch && count(batch.count) && batch.count > 0 && Number.isFinite(Date.parse(batch.dueAt))) &&
      (activity === null || !!activity && typeof activity.volunteer === 'string' && typeof activity.assignment === 'string' && typeof activity.state === 'string' && Number.isFinite(Date.parse(activity.activity_at)));
  }
  return Array.isArray(r.rows) && r.rows.length <= 50 && r.rows.every(row => row && typeof row.id === 'string' && typeof row.volunteer === 'string' && typeof row.assignment === 'string' &&
    (view !== 'upcoming' || Number.isFinite(Date.parse(row.due_at))) && (view !== 'history' || Number.isFinite(Date.parse(row.activity_at)))) &&
    (r.nextCursor === null || !!r.nextCursor && typeof r.nextCursor === 'object' && typeof (r.nextCursor as ReminderCursor).id === 'string');
}
