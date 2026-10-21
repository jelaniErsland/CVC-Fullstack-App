'use client';
import { useEffect, useRef, useState } from 'react';
import { readReminderPreview } from '@/lib/notifications/reminders.actions';
import { reminderLabel, type ReminderReport } from '@/lib/notifications/assignmentReminders';

function when(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
const responseLabel = (value: string | null) => value === 'needs_response' ? 'Awaiting response' : value ?? 'Response unavailable';

export function AssignmentReminderHistory() {
  const [report, setReport] = useState<ReminderReport | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function load(after: string | null = null) {
    const id = ++request.current;
    setPending(true); setError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([readReminderPreview(after), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15000); })]);
      if (request.current !== id) return;
      if ('error' in result) setError(result.error);
      else { setReport(result.report); setCursor(after); }
    } catch {
      if (request.current === id) setError('Reminder preview could not be loaded. Try again.');
    } finally {
      if (timer) clearTimeout(timer);
      if (request.current === id) setPending(false);
    }
  }
  return <details aria-busy={pending} className="rounded-2xl border border-slate-200 bg-white p-4" onToggle={event => { if (event.currentTarget.open && !report && !pending && !error) void load(); }}>
    <summary className="cursor-pointer py-2 font-semibold">Automatic reminders <span className="ml-2 text-xs font-normal text-slate-600">Delivery disabled · Phase A</span></summary>
    <p className="mt-2 text-sm text-slate-600">Response reminders every 3 days; confirmed work at 30, 14, 7, 3 and 1 day. This preview does not schedule or send anything.</p>
    <button type="button" disabled={pending} onClick={() => void load()} className="mt-3 min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50">{pending ? 'Loading reminders…' : error ? 'Retry preview' : 'Refresh reminder preview'}</button>
    {pending && <p role="status" className="mt-2 text-sm">Loading reminder history and preview…</p>}
    {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    {report && <div className="mt-4 space-y-3">
      <h2 className="font-semibold">Preview if activated now</h2>
      <p className="text-sm text-slate-600">Hypothetical planning at <time dateTime={report.prospective.at}>{when(report.prospective.at, report.prospective.timezone)}</time> ({report.prospective.timezone}). {report.baselineAt ? 'Existing enrollment and delivery records are shown as recorded.' : 'No activation baseline exists. These results are not enrolled.'}</p>
      <p className="text-xs text-slate-600">{report.prospective.scope}. {report.prospective.inspected} assignments inspected on this page; up to {report.prospective.limit} per read. Each page uses fresh server time.</p>
      {!report.prospective.rows.length && <p className="text-sm text-slate-600">No assignments in this preview page.</p>}
      {(['would_enroll', 'existing', 'excluded'] as const).map(group => {
        const rows = report.prospective.rows.filter(row => row.classification === group);
        if (!rows.length) return null;
        const label = group === 'would_enroll' ? 'Would enroll' : group === 'existing' ? 'Existing occurrences' : 'Excluded';
        return <details key={group} open={group === 'would_enroll'} className="rounded-xl bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer py-1 font-semibold">{label} · {rows.length}</summary>
          <ul className="mt-3 space-y-3">{rows.map(row => <li key={row.assignment_id} className="break-words border-t border-slate-200 pt-3">
            <p><strong>{row.volunteer}</strong> · {row.assignment}</p>
            <p className="mt-1 text-slate-600">{responseLabel(row.response)} · {row.destination}</p>
            <p className="mt-1 text-slate-600">{row.reason}</p>
            <ul className="mt-2 space-y-1">{row.reminders.map(reminder => <li key={reminder.occurrence_key}>
              {reminder.source === 'hypothetical' ? <span>{reminderLabel(reminder.occurrence_key)} · <time dateTime={reminder.due_at}>{when(reminder.due_at, report.prospective.timezone)}</time> · Would enroll</span> : <details>
                <summary className="cursor-pointer py-1">{reminderLabel(reminder.occurrence_key)} · <time dateTime={reminder.due_at}>{when(reminder.due_at, report.prospective.timezone)}</time> · Recorded: {reminder.state.replaceAll('_', ' ')}{reminder.scheduling_state !== reminder.state ? ` (${reminder.scheduling_state})` : ''}</summary>
                <p className="mt-1 text-slate-600">Attempts: {reminder.attempt ?? 0}{reminder.finalized_at ? ` · Last outcome: ${when(reminder.finalized_at, report.prospective.timezone)}` : ''}</p>
                {reminder.failure_code && <p className="mt-1 text-slate-600">{reminder.state === 'unknown' ? 'Automatic retry blocked; reconcile provider outcome.' : 'Review delivery destination and provider configuration.'}</p>}
                <ul className="mt-2 space-y-1">{reminder.events?.map(event => <li key={event.id}>{event.event} · attempt {event.attempt} · <time dateTime={event.happened_at}>{when(event.happened_at, report.prospective.timezone)}</time></li>)}</ul>
              </details>}
            </li>)}</ul>
          </li>)}</ul>
        </details>;
      })}
      {(cursor || report.prospective.nextAfter) && <div className="flex flex-wrap gap-2">
        {cursor && <button type="button" disabled={pending} onClick={() => void load()} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm">First page</button>}
        {report.prospective.nextAfter && <button type="button" disabled={pending} onClick={() => void load(report.prospective.nextAfter)} className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm">Next assignments</button>}
      </div>}
      <details className="rounded-xl border border-slate-200 p-3 text-sm">
        <summary className="cursor-pointer py-1 font-semibold">Recorded reminder history · {report.rows.length}</summary>
        {!report.rows.length && <p className="mt-2 text-slate-600">No additional reminder history to show.</p>}
        {report.rows.map(row => <details key={row.id} className="mt-3 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer break-words"><strong>{row.volunteer}</strong> · {row.assignment}<span className="mt-1 block text-slate-600">{reminderLabel(row.occurrence_key)} · {row.state ?? row.scheduling_state} · {row.reason}</span></summary>
          <dl className="mt-3 space-y-1 break-words"><div><dt className="inline font-medium">Occurrence: </dt><dd className="inline">{row.occurrence_key}</dd></div><div><dt className="inline font-medium">Due: </dt><dd className="inline"><time dateTime={row.due_at}>{when(row.due_at, report.prospective.timezone)}</time></dd></div><div><dt className="inline font-medium">Response: </dt><dd className="inline">{responseLabel(row.response)}</dd></div><div><dt className="inline font-medium">Destination: </dt><dd className="inline">{row.destination}</dd></div><div><dt className="inline font-medium">Attempts: </dt><dd className="inline">{row.attempt ?? 0}</dd></div>{row.finalized_at && <div><dt className="inline font-medium">Last outcome: </dt><dd className="inline"><time dateTime={row.finalized_at}>{when(row.finalized_at, report.prospective.timezone)}</time></dd></div>}{row.failure_code && <div><dt className="inline font-medium">Failure: </dt><dd className="inline">{row.failure_code === 'provider_outcome_unknown' ? 'Automatic retry blocked; reconcile provider outcome.' : 'Review the delivery destination and provider configuration.'}</dd></div>}</dl>
          <ul className="mt-3 space-y-1">{row.events.map(event => <li key={event.id}>{event.event} · attempt {event.attempt} · <time dateTime={event.happened_at}>{when(event.happened_at, report.prospective.timezone)}</time></li>)}</ul>
        </details>)}
        <p className="mt-3 text-xs text-slate-600">Up to 200 recent occurrences, excluding identities already shown above; 25 events per occurrence. No manual reminder send is available.</p>
      </details>
    </div>}
  </details>;
}
