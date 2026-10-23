import { formatScheduleClockRange, formatScheduleDate } from "../scheduleFormatting.ts";

export const reminderLabel = (key: string) => ({ "shift:30": "1-month reminder", "shift:14": "2-week reminder", "shift:7": "1-week reminder", "shift:3": "3-day reminder", "shift:1": "1-day reminder" })[key] ?? "Response reminder";
export type ReminderDeliveryStatus = { enabled: boolean | null; observedAt: string };
export type ReminderContext = {
  name: string; email: string; project: string; title: string; date: string; endDate: string | null;
  startTime: string | null; endTime: string | null; timezone: string; kind: "response" | "shift";
  occurrenceKey: string; insideCutoff: boolean;
  followUp: { name: string; email: string | null; phone: string | null } | null;
  recipientId: string; operationId: string; claimId: string; occurrenceId: string; attempt: number;
};
export type ReminderRow = {
  id: string; assignment_id: string; kind: string; occurrence_key: string; due_at: string;
  scheduling_state: string; volunteer: string; assignment: string; response: string; destination: string;
  state: string | null; attempt: number | null; claimed_at: string | null; finalized_at: string | null;
  failure_code: string | null; eligible: boolean; reason: string;
  events: { id: number; event: string; happened_at: string; due_at: string; attempt: number }[];
};
export type ProspectiveReminder = {
  id: string | null; source: 'hypothetical' | 'existing'; occurrence_key: string;
  due_at: string; state: string; scheduling_state?: string;
  attempt?: number | null; claimed_at?: string | null; finalized_at?: string | null; failure_code?: string | null;
  events?: ReminderRow['events'];
};
export type ProspectiveAssignment = {
  assignment_id: string; volunteer: string; assignment: string; response: string | null;
  start_at: string | null; destination: string; classification: 'would_enroll' | 'existing' | 'excluded';
  reason: string; reminders: ProspectiveReminder[];
};
export type ReminderReport = {
  enabled: boolean; baselineAt: string | null; rows: ReminderRow[];
  prospective: { at: string; timezone: string; scope: string; inspected: number; limit: number; nextAfter: string | null; rows: ProspectiveAssignment[] };
};
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildReminderMessage(c: ReminderContext, origin: string) {
  const url = new URL(origin);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid schedule lookup origin');
  const when = ({ "shift:30": "in one month", "shift:14": "in two weeks", "shift:7": "in one week", "shift:3": "in three days", "shift:1": "tomorrow" })[c.occurrenceKey];
  const subject = c.kind === "response" ? `Response needed · ${c.title} · ${c.project}` : `Reminder: ${c.title} ${when ?? "is approaching"}`;
  const date = formatScheduleDate(c.date) + (c.endDate && c.endDate !== c.date ? ` – ${formatScheduleDate(c.endDate)}` : "");
  const lines = [
    `Hi ${c.name},`, c.project, c.title, `${date} · ${formatScheduleClockRange(c.startTime, c.endTime) ?? "Time not specified"} (${c.timezone})`,
    c.kind === 'response' ? 'Your assignment still needs a response.' : `Your confirmed assignment is ${when ?? 'approaching'}. No need to confirm again.`,
    ...(c.kind === 'response' ? [c.insideCutoff
      ? "This assignment begins within 48 hours. You can still Confirm in your schedule. Can't make it is no longer available. If your plans changed, contact your Follow-up Contact as soon as possible."
      : "Review your assignment in your schedule and choose Confirm or Can't make it."] : []),
    ...(c.followUp ? [`Follow-up Contact: ${[c.followUp.name, c.followUp.email, c.followUp.phone].filter(Boolean).join(' · ')}`] : []),
    ...(!c.followUp && c.kind === 'response' && c.insideCutoff ? ["No Follow-up Contact is listed for this assignment. For help, speak with your local elders or the project's congregation volunteer contact."] : []),
    "Find your schedule using the contact information you shared with the project team. If that contact is shared, follow the existing volunteer/project selection steps.",
    `View assignment: ${url.origin}/`,
  ];
  return { subject, text: lines.join('\n\n'), html: `<!doctype html><html lang="en"><body style="margin:0;background:#f5f8fc;color:#10233f;font-family:Arial,sans-serif"><main style="max-width:560px;margin:auto;padding:24px"><p style="color:#246bfd;font-weight:bold">PROJECT LOCAL</p><h1 style="font-size:24px">${escape(c.kind === 'response' ? 'Please review your assignment' : 'Your upcoming assignment')}</h1>${lines.slice(0, -1).map(l => `<p style="line-height:1.6;overflow-wrap:anywhere">${escape(l)}</p>`).join('')}<a href="${escape(url.origin)}/" style="display:inline-block;background:#246bfd;color:white;text-decoration:none;padding:14px 20px;border-radius:10px">View assignment</a></main></body></html>` };
}

export type ReminderRpc = (command: string, payload?: Record<string, unknown>) => Promise<unknown>;
type Outcome = { status: "accepted"; providerMessageId: string } | { status: "rejected" } | { status: "unknown" };
export type ReminderDelivery = { kind: 'simulated' | 'provider'; send: (context: ReminderContext, message: ReturnType<typeof buildReminderMessage>) => Promise<Outcome> };
export type ReminderSimulator = ReminderDelivery & { kind: 'simulated' };
export async function sweepAssignmentReminders(rpc: ReminderRpc, origin: string, deliverySource?: ReminderDelivery | (() => ReminderDelivery | undefined)) {
  const stats = { startedAt: new Date().toISOString(), endedAt: '', phase: 'disabled', evaluated: 0, eligible: 0, claimed: 0, sent: 0, definiteFailures: 0, unknown: 0, skipped: { disabled: 0, changed: 0, claimedElsewhere: 0 }, continuation: false };
  const status = await rpc('status') as { enabled: boolean; workspaces: string[] };
  if (!status || typeof status.enabled !== 'boolean' || !Array.isArray(status.workspaces)
    || status.workspaces.length > 20 || status.workspaces.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
    throw new Error('Invalid reminder worker status');
  }
  // Disabled runs are SELECT-only: do not sync cursors, enroll, claim or resolve
  // recipients. A configured transport never overrides this database decision.
  if (status.enabled !== true) {
    stats.skipped.disabled = 1;
    stats.endedAt = new Date().toISOString();
    return stats;
  }
  // Neither provider configuration nor adapter initialization is reachable while Off.
  const delivery = typeof deliverySource === 'function' ? deliverySource() : deliverySource;
  if (!delivery) {
    stats.skipped.disabled = 1;
    stats.endedAt = new Date().toISOString();
    return stats;
  }
  stats.phase = delivery.kind === 'simulated' ? 'simulation' : 'delivery';
  for (const workspaceId of status.workspaces.slice(0, 20)) {
    // Sync only schedules. Preview itself is a separate read-only RPC and never calls sync.
    let after: string | null = null;
    for (let page = 0; page < 10; page++) {
      const sync = await rpc('sync', { workspaceId, after }) as { evaluated: number; after: string | null };
      stats.evaluated += sync.evaluated; after = sync.after;
      if (!after) break;
      if (page === 9) stats.continuation = true;
    }
    const due = await rpc('due', { workspaceId }) as string[];
    stats.eligible += due.length;
    for (const occurrenceId of due.slice(0, 20)) {
      const claim = await rpc('claim', { occurrenceId }) as ReminderContext | null;
      if (!claim) { stats.skipped.claimedElsewhere++; continue; }
      stats.claimed++;
      const context = await rpc('revalidate', { recipientId: claim.recipientId, claimId: claim.claimId }) as ReminderContext | null;
      if (!context) { stats.skipped.changed++; continue; }
      let result: Outcome;
      try { result = await delivery.send(context, buildReminderMessage(context, origin)); }
      catch { result = { status: 'unknown' }; }
      const outcome = result.status === 'accepted' ? 'sent' : result.status === 'rejected' ? 'failed' : 'unknown';
      if (outcome === 'sent') stats.sent++; else if (outcome === 'failed') stats.definiteFailures++; else stats.unknown++;
      // A lost finalization is NOT converted to retryable failure. Sending stays reserved.
      await rpc('finalize', { recipientId: context.recipientId, claimId: context.claimId, outcome, providerId: result.status === 'accepted' ? result.providerMessageId : null });
    }
  }
  stats.endedAt = new Date().toISOString();
  return stats;
}
