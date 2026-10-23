'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { readReminderPreview, readReminderStatus } from '@/lib/notifications/reminders.actions';
import { reminderLabel, type ReminderReport, type ReminderRow } from '@/lib/notifications/assignmentReminders';

function when(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
const responseLabel = (value: string | null) => ({ needs_response: 'Awaiting response', confirmed: 'Confirmed', declined: 'Declined' })[value ?? ''] ?? 'Response unavailable';
const statusLabel = (value: string) => ({ sent: 'Sent', failed: 'Failed', unknown: 'Delivery status unknown', sending: 'Sending', ready: 'Waiting to send', active: 'Scheduled', superseded: 'Schedule changed', canceled: 'Canceled', invalid_destination: 'Delivery address unavailable', expired: 'Delivery window passed', excluded: 'No longer eligible' })[value] ?? value.replaceAll('_', ' ');
const reasonLabel = (value: string) => ({
  'No future pending reminder before assignment start': 'Assignment begins before another reminder would be due.',
  'No remaining future confirmed threshold': 'No remaining reminder before this assignment.',
  'No valid delivery destination': 'No valid email address is available.',
  'No actionable response state': 'No response reminder is needed for the current response.',
  'Volunteer is inactive or not ready': 'Volunteer is inactive or not ready to serve.',
})[value] ?? value;
type RecordedReminder = Pick<ReminderRow, 'id' | 'volunteer' | 'assignment' | 'occurrence_key' | 'due_at' | 'attempt' | 'finalized_at' | 'failure_code' | 'events'> & { state: string };

function RecordedDelivery({ row, timezone }: { row: RecordedReminder; timezone: string }) {
  return <details className="rounded-xl border border-slate-200 p-3 text-sm">
    <summary className="min-h-11 cursor-pointer break-words py-1 font-medium">{row.volunteer} · {row.assignment}<span className="mt-1 block font-normal text-slate-600">{reminderLabel(row.occurrence_key)} · {statusLabel(row.state)}</span></summary>
    <dl className="mt-2 space-y-2 break-words"><div><dt className="font-medium">Scheduled for</dt><dd><time dateTime={row.due_at}>{when(row.due_at, timezone)}</time></dd></div>{row.finalized_at && <div><dt className="font-medium">{row.state === 'sent' ? 'Sent' : 'Last result'}</dt><dd><time dateTime={row.finalized_at}>{when(row.finalized_at, timezone)}</time></dd></div>}<div><dt className="inline font-medium">Delivery attempts: </dt><dd className="inline">{row.attempt ?? 0}</dd></div></dl>
    {(row.state === 'unknown' || row.state === 'sending') && <p className="mt-3 text-amber-800">Delivery needs review. Automatic retry is paused until the outcome is known.</p>}
    {row.failure_code && row.state === 'failed' && <p className="mt-3 text-rose-700">Delivery failed. Review the email address and delivery details.</p>}
    {!!row.events.length && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-slate-600">Delivery details</summary><ul className="space-y-2">{row.events.map(event => <li key={event.id}>{event.event === 'claimed' ? 'Processing started' : event.event === 'rescheduled' ? 'Rescheduled' : statusLabel(event.event)} · <time dateTime={event.happened_at}>{when(event.happened_at, timezone)}</time></li>)}</ul></details>}
  </details>;
}

export function AssignmentReminderHistory({ enabled, onEnabledChange }: { enabled: boolean | null; onEnabledChange: (enabled: boolean | null) => void }) {
  const [report, setReport] = useState<ReminderReport | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const request = useRef(0);
  const statusRequest = useRef(0);
  const statusObservation = useRef(0);
  const panelId = useId();
  useEffect(() => () => { request.current++; statusRequest.current++; }, []);
  async function retryStatus() {
    const id = ++statusRequest.current;
    const observation = ++statusObservation.current;
    setStatusPending(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([readReminderStatus(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15000); })]);
      if (statusRequest.current === id && statusObservation.current === observation) onEnabledChange(result.enabled);
    } catch {
      if (statusRequest.current === id && statusObservation.current === observation) onEnabledChange(null);
    } finally {
      if (timer) clearTimeout(timer);
      if (statusRequest.current === id) setStatusPending(false);
    }
  }
  async function load(after: string | null = null) {
    const id = ++request.current;
    const observation = ++statusObservation.current;
    setPending(true); setError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([readReminderPreview(after), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15000); })]);
      if (request.current !== id) return;
      if ('error' in result) setError('Reminders could not be loaded. Please try again.');
      else { setReport(result.report); setCursor(after); if (statusObservation.current === observation) onEnabledChange(result.report.enabled); }
    } catch {
      if (request.current === id) setError('Reminders could not be loaded. Please try again.');
    } finally {
      if (timer) clearTimeout(timer);
      if (request.current === id) setPending(false);
    }
  }
  const planned = report?.prospective.rows ?? [];
  const response = planned.filter(row => row.classification === 'would_enroll' && row.response === 'needs_response');
  const confirmed = planned.filter(row => row.classification === 'would_enroll' && row.response === 'confirmed');
  const excluded = planned.filter(row => row.classification === 'excluded');
  const existing = planned.filter(row => row.classification === 'existing');
  const groups = [['Response reminders', response], ['Upcoming assignment reminders', confirmed], ['Assignments with reminder history', existing], ['Excluded', excluded]] as const;
  const history = new Map<string, RecordedReminder>();
  for (const row of report?.rows ?? []) history.set(row.id, { ...row, state: row.state ?? row.scheduling_state });
  for (const row of planned) for (const reminder of row.reminders) {
    if (reminder.source === 'existing' && reminder.id) history.set(reminder.id, { ...reminder, id: reminder.id, volunteer: row.volunteer, assignment: row.assignment, attempt: reminder.attempt ?? null, finalized_at: reminder.finalized_at ?? null, failure_code: reminder.failure_code ?? null, events: reminder.events ?? [] });
  }
  return <section aria-label="Automatic reminders" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 className="sr-only">Automatic reminders</h2>
    <p className="max-w-2xl text-sm leading-relaxed text-slate-600" role={enabled === null ? 'status' : undefined}>{enabled === null ? 'Reminder status unavailable. Try again to check whether automatic reminders are being sent.' : enabled ? 'Project Local automatically reminds volunteers who still need to respond and reminds confirmed volunteers as their assignments approach.' : 'Automatic reminders are not currently being sent. Preview which volunteers would receive reminders if you turned them on.'}</p>
    {enabled === null && <button type="button" disabled={statusPending} onClick={() => void retryStatus()} className="mt-3 mr-2 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">{statusPending ? 'Checking reminder status…' : 'Retry reminder status'}</button>}
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(!open); if (!open && !report && !pending && !error) void load(); }} className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{enabled === null ? open ? 'Close reminder details' : 'View reminder details' : open ? enabled ? 'Close reminder schedule' : 'Close preview' : enabled ? 'View reminder schedule and history' : 'Preview reminders'}</button>
    <div id={panelId} hidden={!open} aria-busy={pending} className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{enabled === null ? 'Reminder details' : enabled ? 'Reminder schedule and history' : 'Preview reminders'}</h3><p className="mt-1 text-sm text-slate-600">{enabled === null ? 'Check the latest reminder status and schedule.' : enabled ? 'Upcoming reminders and recorded deliveries.' : 'If reminders were turned on now'}</p></div><button type="button" disabled={pending} onClick={() => void load(cursor)} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50">{pending ? 'Loading reminders…' : error ? 'Retry preview' : 'Refresh preview'}</button></div>
      {enabled === false && <p className="mt-3 text-sm text-slate-600">This preview does not schedule or send anything. It does not turn on reminders.</p>}
      {pending && <p role="status" className="mt-3 text-sm text-slate-600">Loading reminder preview…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}{report ? ' The previous preview is still shown below.' : ''}</p>}
      {report && <div className="mt-4 space-y-4">
        <p className="text-xs leading-relaxed text-slate-500">{report.prospective.inspected} assignments on this page · Times in {report.prospective.timezone}. Previewed <time dateTime={report.prospective.at}>{when(report.prospective.at, report.prospective.timezone)}</time>. Each page is checked separately.</p>
        {enabled === false && <div className="grid grid-cols-2 gap-3">{[['Still need to respond', response.length, 'assignments'], ['Confirmed assignments', confirmed.length, 'with upcoming reminders']].map(([title, count, text]) => <div key={title} className="rounded-xl bg-slate-50 p-3"><h4 className="text-sm font-medium text-slate-700">{title}</h4><p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{count}</p><p className="mt-1 text-xs text-slate-600">{text}</p></div>)}</div>}
        {!planned.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No upcoming assignments to preview.</p>}
        {groups.map(([title, rows]) => rows.length ? <details key={title} open={title === 'Response reminders'} className="rounded-xl border border-slate-200 p-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-semibold">{title} · {rows.length}</summary><ul className="divide-y divide-slate-100">{rows.map(row => <li key={row.assignment_id} className="break-words py-4 first:pt-2">
          <p className="font-semibold text-slate-950">{row.volunteer} <span className="font-normal text-slate-500">· {row.assignment}</span></p>
          {row.start_at && <p className="mt-1 text-slate-600">Assignment: <time dateTime={row.start_at}>{when(row.start_at, report.prospective.timezone)}</time></p>}
          <p className="mt-1 text-xs text-slate-500">{responseLabel(row.response)} · {row.destination}</p>
          {row.classification === 'excluded' && <p className="mt-2 text-slate-600">{reasonLabel(row.reason)}</p>}
          {!!row.reminders.filter(r => r.source === 'hypothetical').length && <div className="mt-3"><p className="text-xs font-medium text-slate-600">{row.response === 'needs_response' ? 'Would receive first response reminder' : 'Upcoming reminders'}</p><ul className="mt-1 space-y-1">{row.reminders.filter(r => r.source === 'hypothetical').map(reminder => <li key={reminder.occurrence_key}><time dateTime={reminder.due_at}>{when(reminder.due_at, report.prospective.timezone)}</time>{row.response === 'confirmed' && <span className="text-xs text-slate-500"> · {reminderLabel(reminder.occurrence_key)}</span>}</li>)}</ul></div>}
          {row.reminders.some(r => r.source === 'existing') && <p className="mt-2 text-xs text-slate-500">Previously recorded reminders appear in Reminder history below.</p>}
        </li>)}</ul></details> : null)}
        {(cursor || report.prospective.nextAfter) && <div className="flex flex-wrap gap-2">{cursor && <button type="button" disabled={pending} onClick={() => void load()} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50">First page</button>}{report.prospective.nextAfter && <button type="button" disabled={pending} onClick={() => void load(report.prospective.nextAfter)} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm disabled:opacity-50">Next assignments</button>}</div>}
        <details className="rounded-xl border border-slate-200 p-3 text-sm"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Reminder history{history.size ? ` · ${history.size}` : ''}</summary>{!history.size ? <p className="pb-2 text-slate-600">No reminders have been sent yet.</p> : <div className="space-y-2">{[...history.values()].sort((a, b) => b.due_at.localeCompare(a.due_at) || a.id.localeCompare(b.id)).map(row => <RecordedDelivery key={row.id} row={row} timezone={report.prospective.timezone} />)}</div>}<p className="mt-2 text-xs text-slate-500">Recent deliveries for this project. Previously sent reminders are not sent again.</p></details>
        <details className="text-sm text-slate-600"><summary className="min-h-11 cursor-pointer py-3 font-medium">Reminder timing</summary><dl className="space-y-3 pb-2"><div><dt className="font-medium text-slate-800">Response reminders</dt><dd className="mt-1">Every 3 days at 9:00 AM until the volunteer responds or the assignment begins.</dd></div><div><dt className="font-medium text-slate-800">Confirmed assignments</dt><dd className="mt-1">30 days, 2 weeks, 1 week and 3 days before at 9:00 AM, plus a final reminder at 5:00 PM the day before. All times use the project timezone.</dd></div></dl></details>
      </div>}
    </div>
  </section>;
}
