'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { readReminderWorkspace } from '@/lib/notifications/reminders.actions';
import { reminderOutcomeLabel, reminderWorkspaceLabel, type ReminderCursor, type ReminderWorkspacePage, type ReminderWorkspaceRow, type ReminderWorkspaceSummary } from '@/lib/notifications/reminderWorkspace';
import { withReadTimeout } from '@/lib/readTimeout';

const button = 'min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50';
function when(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
function Time({ at, zone }: { at: string; zone: string }) { return <time dateTime={at}>{when(at, zone)}</time>; }
type ListView = ReminderWorkspacePage['view'];

function ReminderRow({ row, zone, view }: { row: ReminderWorkspaceRow; zone: string; view: ListView }) {
  return <li className="min-w-0 border-b border-slate-100 py-4 last:border-0">
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <p className="min-w-0 break-words font-semibold text-slate-950">{row.volunteer}</p>
      {row.state && <span className={`text-xs font-medium ${row.state === 'unknown' ? 'text-amber-800' : row.state === 'failed' ? 'text-rose-700' : 'text-slate-600'}`}>{reminderOutcomeLabel(row.state)}</span>}
    </div>
    <p className="mt-1 break-words text-sm text-slate-700">{row.assignment}</p>
    {row.occurrence_key && <p className="mt-1 text-sm text-slate-600">{reminderWorkspaceLabel(row.occurrence_key)}</p>}
    {view === 'history' && row.activity_at && <p className="mt-1 text-sm font-medium text-slate-800"><Time at={row.activity_at} zone={zone} /></p>}
    {row.reason && <p className="mt-2 text-sm text-slate-600">{row.reason}</p>}
    {(view !== 'upcoming' || row.retry_at) && <details className="mt-1 text-sm text-slate-600">
      <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-blue-600">Reminder details<span className="sr-only"> for {row.volunteer} · {row.assignment}</span></summary>
      <dl className="space-y-2 pb-2">
        {row.start_at && <div><dt className="text-xs font-medium text-slate-500">Assignment starts</dt><dd><Time at={row.start_at} zone={zone} /></dd></div>}
        {view !== 'upcoming' && row.due_at && <div><dt className="text-xs font-medium text-slate-500">Reminder scheduled for</dt><dd><Time at={row.due_at} zone={zone} /></dd></div>}
        {row.attempt !== undefined && <div><dt className="inline">Processing attempts: </dt><dd className="inline">{row.attempt}</dd></div>}
        {row.retry_at && <div><dt className="text-xs font-medium text-slate-500">Automatic retry scheduled</dt><dd><Time at={row.retry_at} zone={zone} /></dd></div>}
      </dl>
      {row.state === 'sent' && <p className="pb-2">The email provider accepted this message. This does not confirm inbox receipt.</p>}
      {row.state === 'sending' && <p className="pb-2">Processing is in progress. A final outcome has not been recorded.</p>}
      {row.state === 'unknown' && <p className="pb-2 text-amber-800">The outcome needs review. Do not send it again while the result is unknown.</p>}
      {row.state === 'failed' && <p className="pb-2 text-rose-700">A definite failure was recorded. Review the volunteer’s email address. Existing automatic retry rules still apply.</p>}
      {row.state === 'excluded' && <p className="pb-2">Revalidation stopped this attempt before sending because eligibility changed.</p>}
    </details>}
    {view === 'upcoming' && row.start_at && <p className="text-xs text-slate-500">Assignment: <Time at={row.start_at} zone={zone} /></p>}
  </li>;
}

export function AssignmentReminderHistory({ enabled, onEnabledChange, initialSummary = null }: { enabled: boolean | null; onEnabledChange: (enabled: boolean | null) => void; initialSummary?: ReminderWorkspaceSummary | null }) {
  const [summary, setSummary] = useState(initialSummary);
  const [summaryError, setSummaryError] = useState(!initialSummary);
  const [summaryPending, setSummaryPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ListView>('upcoming');
  const [page, setPage] = useState<ReminderWorkspacePage | null>(null);
  const [cursor, setCursor] = useState<ReminderCursor | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const listIntent = useRef<{ view: ListView; cursor: ReminderCursor | null; search: string }>({ view: 'upcoming', cursor: null, search: '' });
  const request = useRef(0), summaryRequest = useRef(0);
  const panelId = useId(), searchId = useId();
  useEffect(() => () => { request.current++; summaryRequest.current++; }, []);
  async function refreshSummary() {
    const id = ++summaryRequest.current;
    setSummaryPending(true);
    try {
      const result = await withReadTimeout(readReminderWorkspace('summary'), 15_000);
      if (summaryRequest.current !== id) return;
      if ('error' in result || result.data.view !== 'summary') throw new Error('unavailable');
      setSummary(result.data); setSummaryError(false); onEnabledChange(result.data.enabled);
    } catch {
      if (summaryRequest.current === id) { setSummaryError(true); onEnabledChange(null); }
    } finally { if (summaryRequest.current === id) setSummaryPending(false); }
  }
  async function load(nextView: ListView = view, nextCursor: ReminderCursor | null = null, term = appliedSearch) {
    const id = ++request.current;
    listIntent.current = { view: nextView, cursor: nextCursor, search: term };
    setPending(true); setError('');
    try {
      const result = await withReadTimeout(readReminderWorkspace(nextView, term || null, nextCursor), 15_000);
      if (request.current !== id) return;
      if ('error' in result || result.data.view === 'summary' || result.data.view !== nextView) throw new Error('unavailable');
      setPage(result.data); setCursor(nextCursor); setAppliedSearch(term);
    } catch { if (request.current === id) setError('Reminders could not be loaded. Please try again.'); }
    finally { if (request.current === id) setPending(false); }
  }
  function changeView(next: ListView) { setView(next); setPage(null); setCursor(null); void load(next, null, listIntent.current.search); }
  const currentPage = page?.view === view ? page : null;
  const zone = summary?.timezone ?? currentPage?.timezone;
  const nextBatch = summary?.nextBatch;
  return <section aria-label="Automatic reminders" className="max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-slate-950">Automatic reminders</h2>
      <span role="status" className={`rounded-full px-3 py-1 text-sm font-medium ${enabled === true ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{enabled === null ? 'Status unavailable' : enabled ? 'On' : 'Off'}</span>
    </div>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Helpful reminders for volunteers who still need to respond and for confirmed assignments coming up.</p>
    {enabled === false && <p className="mt-2 text-sm text-slate-600">Automatic reminders are not currently being sent. Recorded schedules and past activity remain available below.</p>}
    {summaryError ? <p role="alert" className="mt-4 text-sm text-amber-900">Reminder status and activity could not be refreshed. Try again to check the current state.</p> : summary && zone && <div className="mt-5 space-y-4">
      <div><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next reminder batch{!enabled ? ' · sending is off' : ''}</h3>
        {nextBatch ? <p className="mt-1 font-semibold text-slate-950"><Time at={nextBatch.dueAt} zone={zone} /><span className="mt-1 block text-sm font-normal text-slate-600">{nextBatch.count} reminder{nextBatch.count === 1 ? '' : 's'} scheduled</span></p> : <p className="mt-1 text-sm text-slate-600">No upcoming reminders are currently recorded.</p>}
      </div>
      <div><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest activity</h3>{summary.lastActivity ? <p className="mt-1 text-sm text-slate-700">{reminderOutcomeLabel(summary.lastActivity.state)} · {summary.lastActivity.volunteer}<span className="mt-1 block text-slate-500">{summary.lastActivity.assignment} · <Time at={summary.lastActivity.activity_at} zone={zone} /></span></p> : <p className="mt-1 text-sm text-slate-600">No reminder processing or delivery activity has been recorded yet.</p>}</div>
      {(summary.failedCount > 0 || summary.unknownCount > 0) && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p>{summary.failedCount > 0 && `${summary.failedCount} failed reminder${summary.failedCount === 1 ? '' : 's'}. `}{summary.unknownCount > 0 && `${summary.unknownCount} unknown outcome${summary.unknownCount === 1 ? '' : 's'} need review. `}Review History for details.</p><button type="button" className={`${button} mt-2 bg-white`} onClick={() => { setOpen(true); changeView('history'); }}>Review reminder history</button></div>}
      <p className="text-xs text-slate-500">Times in {zone}. Checked <Time at={summary.observedAt} zone={zone} />.</p>
    </div>}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" className={button} aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(!open); if (!open && !page && !pending) void load(); }}>{open ? 'Close reminders' : 'View reminders'}</button><button type="button" className={button} disabled={summaryPending} onClick={() => void refreshSummary()}>{summaryPending ? 'Checking…' : summaryError ? 'Retry reminder status' : 'Refresh summary'}</button></div>
    <details className="mt-2 text-sm text-slate-600"><summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2 focus-visible:outline-blue-600">How reminders work</summary><div className="max-w-2xl space-y-3 pb-2 leading-relaxed"><p><strong className="font-medium text-slate-800">Awaiting a response:</strong> Every 3 days at 9:00 AM until the volunteer responds or the assignment begins. Inside 48 hours, volunteers can still confirm; if plans change, they should contact their Follow-up Contact.</p><p><strong className="font-medium text-slate-800">Confirmed assignments:</strong> 30 days, 2 weeks, 1 week and 3 days before at 9:00 AM, plus 5:00 PM the day before. All times use the project timezone.</p><p>Past reminder times are not caught up. Canceled, declined and started assignments do not receive further reminders. This page is read-only; opening it never sends or schedules a reminder.</p></div></details>
    <div id={panelId} hidden={!open} className="mt-3 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Reminder views">{([['upcoming','Upcoming'],['history','History'],['why_not','Find an assignment']] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={view === key} className={`${button} ${view === key ? 'border-blue-300 bg-blue-50 text-blue-900' : ''}`} onClick={() => changeView(key)}>{label}</button>)}</div>
      <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); setPage(null); setCursor(null); void load(view, null, search.trim()); }}>
        <div className="min-w-0 flex-1 basis-44"><label htmlFor={searchId} className="block text-xs font-medium text-slate-600">Volunteer or assignment</label><input id={searchId} type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this project" className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-sm focus-visible:outline-blue-600" /></div><button type="submit" className={button}>Search</button><button type="button" className={button} disabled={pending} onClick={() => void load(view, cursor)}>{pending ? 'Loading…' : 'Refresh list'}</button>
      </form>
      <h3 className="mt-5 font-semibold text-slate-950">{view === 'upcoming' ? 'Upcoming reminders' : view === 'history' ? 'Reminder history' : 'Assignment reminder context'}</h3>
      <p className="mt-1 text-sm text-slate-600">{view === 'upcoming' ? 'Recorded reminders, earliest first. Current assignment state is checked again before sending.' : view === 'history' ? 'Actual processing and delivery activity, newest first. Sent means accepted by the email provider.' : 'Search assigned work to understand its recorded reminder state. A missing reminder does not establish future eligibility.'}</p>
      {pending && <p role="status" className="mt-3 text-sm text-slate-600">Loading reminders…{currentPage ? ' Previous results remain below.' : ''}</p>}
      {error && <div role="alert" className="mt-3 text-sm text-rose-700"><p>{error}{currentPage ? ' Previous results remain below.' : ''}</p><button type="button" className={`${button} mt-2`} onClick={() => { const intent = listIntent.current; void load(intent.view, intent.cursor, intent.search); }}>Retry reminders</button></div>}
      <div aria-busy={pending} className="mt-3">
        {currentPage && <>{currentPage.rows.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{appliedSearch ? 'No matching reminders or assigned work in this project.' : view === 'history' ? 'No reminder processing or delivery activity has been recorded yet.' : view === 'upcoming' ? 'No upcoming reminders are currently recorded.' : 'No assigned work found.'}</p> : view === 'upcoming' ? [...new Set(currentPage.rows.map(row => row.due_at!))].map(due => <div key={due} className="mt-4 first:mt-0"><h4 className="border-b border-slate-200 py-3 text-sm font-semibold text-slate-950"><Time at={due} zone={currentPage.timezone} /><span className="ml-2 font-normal text-slate-500">{currentPage.rows.filter(row => row.due_at === due).length} shown</span></h4><ul>{currentPage.rows.filter(row => row.due_at === due).map(row => <ReminderRow key={row.id} row={row} zone={currentPage.timezone} view={view} />)}</ul></div>) : <ul>{currentPage.rows.map(row => <ReminderRow key={row.id} row={row} zone={currentPage.timezone} view={view} />)}</ul>}
          {(cursor || currentPage.nextCursor) && <div className="mt-4 flex flex-wrap gap-2">{cursor && <button type="button" className={button} disabled={pending} onClick={() => void load(view, null)}>First page</button>}{currentPage.nextCursor && <button type="button" className={button} disabled={pending} onClick={() => void load(view, currentPage.nextCursor)}>Next page</button>}</div>}
          <p className="mt-4 text-xs text-slate-500">Up to 25 results per page. Each page is checked separately. <Time at={currentPage.observedAt} zone={currentPage.timezone} />.</p>
        </>}
      </div>
    </div>
  </section>;
}
