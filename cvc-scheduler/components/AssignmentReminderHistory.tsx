'use client';
import { useEffect, useRef, useState } from 'react';
import { readReminderPreview } from '@/lib/notifications/reminders.actions';
import { reminderLabel, type ReminderReport } from '@/lib/notifications/assignmentReminders';
export function AssignmentReminderHistory() {
  const [report, setReport] = useState<ReminderReport | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  async function load() {
    const id = ++request.current;
    setPending(true); setError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([readReminderPreview(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 15000); })]);
      if (request.current !== id) return;
      if ('error' in result) setError(result.error); else setReport(result.report);
    } catch { if (request.current === id) { request.current++; setError('Reminder history could not be loaded. Try again.'); } }
    finally { if (timer) clearTimeout(timer); setPending(false); }
  }
  return <details className="rounded-2xl border border-slate-200 bg-white p-4" onToggle={event => { if (event.currentTarget.open && !report && !pending && !error) void load(); }}>
    <summary className="cursor-pointer py-2 font-semibold">Automatic reminders <span className="ml-2 text-xs font-normal text-slate-600">Delivery disabled · Phase A</span></summary>
    <p className="mt-2 text-sm text-slate-600">Response reminders every 3 days; confirmed work at 30, 14, 7, 3 and 1 day. Previewing never sends, claims or changes a delivery.</p>
    <button type="button" disabled={pending} onClick={() => void load()} className="mt-3 min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold disabled:opacity-50">{pending ? 'Loading reminders…' : 'Refresh reminder preview'}</button>
    {pending && <p role="status" className="mt-2 text-sm">Loading reminder history and preview…</p>}
    {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
    {report && <div className="mt-4 space-y-3"><h2 className="font-semibold">Reminders that would send now · {report.rows.filter(r => r.eligible).length}</h2>
      {!report.baselineAt && <p className="text-sm text-slate-600">The prospective activation baseline has not been established. Nothing is enrolled or enabled by this preview.</p>}
      {!report.rows.length && <p className="text-sm text-slate-600">No reminder occurrences to show.</p>}
      {report.rows.map(row => <details key={row.id} className="rounded-xl bg-slate-50 p-3 text-sm"><summary className="cursor-pointer break-words"><strong>{row.volunteer}</strong> · {row.assignment}<span className="mt-1 block text-slate-600">{reminderLabel(row.occurrence_key)} · {row.state ?? row.scheduling_state} · {row.eligible ? 'Eligible in preview' : row.reason}</span></summary>
        <dl className="mt-3 space-y-1 break-words"><div><dt className="inline font-medium">Occurrence: </dt><dd className="inline">{row.occurrence_key}</dd></div><div><dt className="inline font-medium">Due: </dt><dd className="inline"><time dateTime={row.due_at}>{new Date(row.due_at).toISOString()}</time></dd></div><div><dt className="inline font-medium">Response: </dt><dd className="inline">{row.response}</dd></div><div><dt className="inline font-medium">Destination: </dt><dd className="inline">{row.destination}</dd></div><div><dt className="inline font-medium">Attempts: </dt><dd className="inline">{row.attempt ?? 0}</dd></div>{row.finalized_at && <div><dt className="inline font-medium">Last outcome: </dt><dd className="inline"><time dateTime={row.finalized_at}>{row.finalized_at}</time></dd></div>}{row.failure_code && <div><dt className="inline font-medium">Failure: </dt><dd className="inline">{row.reason}. {row.failure_code === 'provider_outcome_unknown' ? 'Automatic retry blocked; reconcile provider outcome.' : 'Review the delivery destination and provider configuration.'}</dd></div>}</dl>
        <ul className="mt-3 space-y-1">{row.events.map(event => <li key={event.id}>{event.event} · attempt {event.attempt} · <time dateTime={event.happened_at}>{event.happened_at}</time></li>)}</ul>
      </details>)}<p className="text-xs text-slate-600">Showing at most 200 recent occurrences. No manual reminder send is available.</p></div>}
  </details>;
}
