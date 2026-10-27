'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { readReminderWorkspace } from '@/lib/notifications/reminders.actions';
import { reminderOutcomeLabel, reminderWorkspaceLabel, type ReminderCursor, type ReminderWorkspacePage, type ReminderWorkspaceRow, type ReminderWorkspaceSummary } from '@/lib/notifications/reminderWorkspace';
import { withReadTimeout } from '@/lib/readTimeout';
import { Bell, CalendarClock, History } from 'lucide-react';
import { observedProjectDay, projectDateLabel, projectTimeLabel, projectTimestampLabel } from '@/lib/notifications/communicationPresentation';
import { CommunicationIcon, CommunicationStatus } from './CommunicationsPresentation';
import styles from './CommunicationsWorkspace.module.css';

const button = styles.button;
function Time({ at, zone }: { at: string; zone: string }) { return <time dateTime={at}>{projectTimestampLabel(at, zone)}</time>; }
type ListView = ReminderWorkspacePage['view'];

function ReminderRow({ row, zone, view }: { row: ReminderWorkspaceRow; zone: string; view: ListView }) {
  return <li className={styles.reminderRow}>
    <div className={styles.rowTop}>
      <p className={styles.rowName}>{row.volunteer}</p>
      {row.state && <CommunicationStatus state={row.state}>{reminderOutcomeLabel(row.state)}</CommunicationStatus>}
    </div>
    <p className={styles.rowTask}>{row.assignment}</p>
    {row.occurrence_key && <p className={styles.reminderType}>{reminderWorkspaceLabel(row.occurrence_key)}</p>}
    {view === 'history' && row.activity_at && <p className={styles.historyDate}><Time at={row.activity_at} zone={zone} /></p>}
    {row.reason && <p className={`${styles.bodyCopy} mt-2`}>{row.reason}</p>}
    {(view !== 'upcoming' || row.retry_at) && <details className="mt-1">
      <summary className={styles.disclosure}>Reminder details<span className="sr-only"> for {row.volunteer} · {row.assignment}</span></summary>
      <div className={styles.detailsBody}><dl className="space-y-2">
        {row.start_at && <div><dt>Assignment starts</dt><dd><Time at={row.start_at} zone={zone} /></dd></div>}
        {view !== 'upcoming' && row.due_at && <div><dt>Reminder scheduled for</dt><dd><Time at={row.due_at} zone={zone} /></dd></div>}
        {row.attempt !== undefined && <div><dt className="inline">Processing attempts: </dt><dd className="inline">{row.attempt}</dd></div>}
        {row.retry_at && <div><dt className="text-xs font-medium text-slate-500">Automatic retry scheduled</dt><dd><Time at={row.retry_at} zone={zone} /></dd></div>}
      </dl>
      {row.state === 'sent' && <p className="pb-2">The email provider accepted this message. This does not confirm inbox receipt.</p>}
      {row.state === 'sending' && <p className="pb-2">Processing is in progress. A final outcome has not been recorded.</p>}
      {row.state === 'unknown' && <p className="pb-2 text-amber-800">The outcome needs review. Do not send it again while the result is unknown.</p>}
      {row.state === 'failed' && <p className="pb-2 text-rose-700">A definite failure was recorded. Review the volunteer’s email address. Existing automatic retry rules still apply.</p>}
      {row.state === 'excluded' && <p className="pb-2">Revalidation stopped this attempt before sending because eligibility changed.</p>}</div>
    </details>}
    {view === 'upcoming' && row.start_at && <p className={`${styles.metadata} mt-1`}>Assignment starts: <Time at={row.start_at} zone={zone} /></p>}
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
  return <section aria-label="Automatic reminders" className={styles.surface}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className={styles.sectionHeader}><CommunicationIcon icon={Bell} tone={enabled === true ? 'teal' : 'slate'} /><h2>Automatic reminders</h2></div>
      <span role="status"><CommunicationStatus state={enabled === true ? 'on' : 'off'}>{enabled === null ? 'Status unavailable' : enabled ? 'On' : 'Off'}</CommunicationStatus></span>
    </div>
    <p className={`${styles.bodyCopy} mt-3`}>Helpful reminders for volunteers who still need to respond and for confirmed assignments coming up.</p>
    {enabled === false && <p className={`${styles.bodyCopy} mt-2`}>Automatic reminders are not currently being sent. Recorded schedules and past activity remain available below.</p>}
    {summaryError ? <p role="alert" className="mt-4 text-sm text-amber-900">Reminder status and activity could not be refreshed. Try again to check the current state.</p> : summary && zone && <>
      <div className={styles.summaryGrid}><div className={styles.nextBatch}>
        <div className="flex items-center gap-2"><CalendarClock aria-hidden="true" className="size-4 text-blue-800" /><h3 className={styles.eyebrow}>Next reminder batch{!enabled ? ' · sending is off' : ''}</h3></div>
        {nextBatch ? <><time dateTime={nextBatch.dueAt} title={projectTimestampLabel(nextBatch.dueAt, zone)}><span className={`block ${styles.dueDay}`}>{observedProjectDay(nextBatch.dueAt, zone, summary.observedAt)}</span><span className={styles.dueTime}>{projectTimeLabel(nextBatch.dueAt, zone)}</span></time><p className={styles.dueCount}>{nextBatch.count} reminder{nextBatch.count === 1 ? '' : 's'} scheduled</p>{['Today','Tomorrow'].includes(observedProjectDay(nextBatch.dueAt, zone, summary.observedAt)) && <p className={`${styles.metadata} mt-1`}>{projectDateLabel(nextBatch.dueAt, zone)}</p>}</> : <p className={`${styles.bodyCopy} mt-3`}>No upcoming reminders are currently recorded.</p>}
      </div>
      <div className={styles.recentActivity}><div className="flex items-center gap-2"><History aria-hidden="true" className="size-4 text-slate-600" /><h3 className={styles.eyebrow}>Latest activity</h3></div>{summary.lastActivity ? <p><CommunicationStatus state={summary.lastActivity.state}>{reminderOutcomeLabel(summary.lastActivity.state)}</CommunicationStatus><strong>{summary.lastActivity.volunteer}</strong><span className={`block ${styles.bodyCopy}`}>{summary.lastActivity.assignment}</span><span className={`mt-1 block ${styles.metadata}`}><Time at={summary.lastActivity.activity_at} zone={zone} /></span></p> : <p className={styles.bodyCopy}>No reminder processing or delivery activity has been recorded yet.</p>}</div></div>
      {(summary.failedCount > 0 || summary.unknownCount > 0) && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p>{summary.failedCount > 0 && `${summary.failedCount} failed reminder${summary.failedCount === 1 ? '' : 's'}. `}{summary.unknownCount > 0 && `${summary.unknownCount} unknown outcome${summary.unknownCount === 1 ? '' : 's'} need review. `}Review History for details.</p><button type="button" className={`${button} mt-2 bg-white`} onClick={() => { setOpen(true); changeView('history'); }}>Review reminder history</button></div>}
      <p className={styles.checked}>Times in {zone}. Checked <Time at={summary.observedAt} zone={zone} />.</p>
    </>}
    <div className={styles.actions}><button type="button" className={`${button} ${open ? '' : styles.primary}`} aria-expanded={open} aria-controls={panelId} onClick={() => { setOpen(!open); if (!open && !page && !pending) void load(); }}>{open ? 'Close reminders' : 'View reminders'}</button><button type="button" className={`${button} ${styles.quiet}`} disabled={summaryPending} onClick={() => void refreshSummary()}>{summaryPending ? 'Checking…' : summaryError ? 'Retry reminder status' : 'Refresh summary'}</button></div>
    <details className="mt-2 text-sm text-slate-600"><summary className={styles.disclosure}>How reminders work</summary><div className={`${styles.bodyCopy} max-w-2xl space-y-3 pb-2 leading-relaxed`}><p><strong className="font-medium text-slate-800">Awaiting a response:</strong> Every 3 days at 9:00 AM until the volunteer responds or the assignment begins. Inside 48 hours, volunteers can still confirm; if plans change, they should contact their Follow-up Contact.</p><p><strong className="font-medium text-slate-800">Confirmed assignments:</strong> 30 days, 2 weeks, 1 week and 3 days before at 9:00 AM, plus 5:00 PM the day before. All times use the project timezone.</p><p>Past reminder times are not caught up. Canceled, declined and started assignments do not receive further reminders. This page is read-only; opening it never sends or schedules a reminder.</p></div></details>
    <div id={panelId} hidden={!open} className={styles.listPanel}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Reminder views">{([['upcoming','Upcoming'],['history','History'],['why_not','Find an assignment']] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={view === key} className={`${button} ${styles.viewButton}`} onClick={() => changeView(key)}>{label}</button>)}</div>
      <form className={styles.searchForm} onSubmit={event => { event.preventDefault(); setPage(null); setCursor(null); void load(view, null, search.trim()); }}>
        <div className="min-w-0 flex-1 basis-44"><label htmlFor={searchId}>Volunteer or assignment</label><input id={searchId} type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this project" className={styles.field} /></div><button type="submit" className={button}>Search</button><button type="button" className={`${button} ${styles.quiet}`} disabled={pending} onClick={() => void load(view, cursor)}>{pending ? 'Loading…' : 'Refresh list'}</button>
      </form>
      <h3 className="mt-5 font-semibold text-slate-950">{view === 'upcoming' ? 'Upcoming reminders' : view === 'history' ? 'Reminder history' : 'Assignment reminder context'}</h3>
      <p className="mt-1 text-sm text-slate-600">{view === 'upcoming' ? 'Recorded reminders, earliest first. Current assignment state is checked again before sending.' : view === 'history' ? 'Actual processing and delivery activity, newest first. Sent means accepted by the email provider.' : 'Search assigned work to understand its recorded reminder state. A missing reminder does not establish future eligibility.'}</p>
      {pending && <p role="status" className="mt-3 text-sm text-slate-600">Loading reminders…{currentPage ? ' Previous results remain below.' : ''}</p>}
      {error && <div role="alert" className="mt-3 text-sm text-rose-700"><p>{error}{currentPage ? ' Previous results remain below.' : ''}</p><button type="button" className={`${button} mt-2`} onClick={() => { const intent = listIntent.current; void load(intent.view, intent.cursor, intent.search); }}>Retry reminders</button></div>}
      <div aria-busy={pending} className="mt-3">
        {currentPage && <>{currentPage.rows.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{appliedSearch ? 'No matching reminders or assigned work in this project.' : view === 'history' ? 'No reminder processing or delivery activity has been recorded yet.' : view === 'upcoming' ? 'No upcoming reminders are currently recorded.' : 'No assigned work found.'}</p> : view === 'upcoming' ? [...new Set(currentPage.rows.map(row => row.due_at!))].map(due => <div key={due}><h4 className={styles.dateHeading}><time dateTime={due} title={projectTimestampLabel(due, currentPage.timezone)}>{observedProjectDay(due, currentPage.timezone, currentPage.observedAt)} · {projectTimeLabel(due, currentPage.timezone)}</time><span>{currentPage.rows.filter(row => row.due_at === due).length} shown on this page</span></h4><ul>{currentPage.rows.filter(row => row.due_at === due).map(row => <ReminderRow key={row.id} row={row} zone={currentPage.timezone} view={view} />)}</ul></div>) : <ul>{currentPage.rows.map(row => <ReminderRow key={row.id} row={row} zone={currentPage.timezone} view={view} />)}</ul>}
          {(cursor || currentPage.nextCursor) && <div className="mt-4 flex flex-wrap gap-2">{cursor && <button type="button" className={button} disabled={pending} onClick={() => void load(view, null)}>First page</button>}{currentPage.nextCursor && <button type="button" className={button} disabled={pending} onClick={() => void load(view, currentPage.nextCursor)}>Next page</button>}</div>}
          <p className="mt-4 text-xs text-slate-500">Up to 25 results per page. Each page is checked separately. <Time at={currentPage.observedAt} zone={currentPage.timezone} />.</p>
        </>}
      </div>
    </div>
  </section>;
}
