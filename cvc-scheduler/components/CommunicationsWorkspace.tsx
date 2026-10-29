"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Mail, CalendarDays, Bell, History } from "lucide-react";
import { buildCommunicationMessage, type CommunicationPlan, type CommunicationHistory, type CommunicationActionState } from "@/lib/notifications/communications";
import { finishConfirmedCommunication } from "@/lib/notifications/communicationBatches";
import { AssignmentReminderHistory } from "@/components/AssignmentReminderHistory";
import type { ReminderDeliveryStatus } from "@/lib/notifications/assignmentReminders";
import type { ReminderWorkspaceSummary } from "@/lib/notifications/reminderWorkspace";
import { useRememberedView } from "@/lib/adminViews/useRememberedView";
import type { AdminViewScope, CommunicationsView } from "@/lib/adminViews/preferences";
import { communicationStatusLabel, projectDateKey, projectDateLabel, projectTimestampLabel } from "@/lib/notifications/communicationPresentation";
import { CommunicationIcon, CommunicationStatus } from "./CommunicationsPresentation";
import styles from "./CommunicationsWorkspace.module.css";
const field = styles.field;
const button = styles.button;
const recipientCountLabel = (count: number, qualifier = "") => `${count} ${qualifier ? `${qualifier} ` : ""}recipient${count === 1 ? "" : "s"}`;
const exclusionMessage: Record<string,string> = {
  missing_email: "Add a valid email address to this volunteer's profile.",
  shared_email_requires_review: "This email is shared. Use an individually verified contact or an administrator-assisted schedule link; a shared inbox cannot privately deliver a personal link.",
  pending_or_unknown_delivery: "A previous delivery is pending or its outcome is unknown. Review delivery history before retrying.",
  already_welcomed: "The welcome message was already sent. Choose an intentional resend if another is needed.",
  email_changed_requires_resend_review: "The email changed after the welcome message. Review an intentional resend.",
  no_eligible_assignments: "No upcoming active assignments are eligible in this date range. Check the item’s date, draft state, and response status.",
  already_delivered: "These assignments were already delivered. Choose an intentional resend if another message is needed.",
  existing_delivery_requires_review: "An earlier assignment delivery has an unresolved outcome. Review history before sending again.",
};
export function CommunicationsWorkspace({ action, history: initialHistory, historyRead, pendingWelcomeCount, transportEnabled, initialVolunteerId, initialKind = "welcome", initialTab, initialReminderStatus, initialReminderSummary, initialStartDate, initialEndDate, today, timezone, preferenceScope, explicitKind = false }: {
  action: (form: FormData) => Promise<CommunicationActionState>; history: CommunicationHistory[]; pendingWelcomeCount?: number;
  historyRead?: Promise<CommunicationHistory[] | null>;
  initialReminderSummary?: ReminderWorkspaceSummary | null;
  transportEnabled: boolean; initialVolunteerId?: string; initialKind?: "welcome" | "schedule"; initialTab?: CommunicationsView["tab"]; initialReminderStatus: ReminderDeliveryStatus; initialStartDate?: string; initialEndDate?: string; today: string; timezone: string; preferenceScope?: AdminViewScope; explicitKind?: boolean;
}) {
  const [remembered, setRemembered, resetRemembered, preferenceHydrated] = useRememberedView("communications", preferenceScope ?? null);
  const restoredTab = preferenceHydrated && !explicitKind && !initialVolunteerId ? remembered.tab : initialVolunteerId ? initialKind : initialTab ?? initialKind;
  const [kindOverride, setKind] = useState<"welcome" | "schedule" | null>(null);
  const kind = kindOverride ?? (restoredTab === "welcome" || restoredTab === "schedule" ? restoredTab : initialKind);
  const [tabOverride, setTabOverride] = useState<CommunicationsView["tab"] | null>(null);
  const activeTab = tabOverride ?? restoredTab;
  const setActiveTab = (tab: CommunicationsView["tab"]) => { setTabOverride(tab); setRemembered(current => ({ ...current, tab })); };
  const [reminderObservation, setReminderObservation] = useState<ReminderDeliveryStatus | null>(null);
  // A fresh server observation supersedes any older preview/retry response.
  const reminderEnabled = reminderObservation?.observedAt === initialReminderStatus.observedAt ? reminderObservation.enabled : initialReminderStatus.enabled;
  const setReminderEnabled = (enabled: boolean | null) => setReminderObservation({ enabled, observedAt: initialReminderStatus.observedAt });
  const sectionId = useId();
  const [mode, setMode] = useState<CommunicationPlan["mode"]>(initialVolunteerId ? "resend" : "new");
  const [startDate, setStart] = useState(initialStartDate ?? today), [endDate, setEnd] = useState(() => { if (initialEndDate) return initialEndDate; const d = new Date(today + "T12:00Z"); d.setUTCDate(d.getUTCDate()+30); return d.toISOString().slice(0,10); });
  const [ids, setIds] = useState<string[]>(initialVolunteerId ? [initialVolunteerId] : []);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [result, setResult] = useState<{ plan: string; state: CommunicationActionState } | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [historyStatus, setHistoryStatus] = useState<"loading" | "ready" | "error">(historyRead ? "loading" : "ready");
  const historyThrough = remembered.historyHorizon === "all" ? null : new Date(Date.parse(`${today}T12:00:00Z`) - Number(remembered.historyHorizon) * 86_400_000).toISOString().slice(0, 10);
  const visibleHistory = history.filter(row => (remembered.historyKind === "all" || row.kind === remembered.historyKind) && (remembered.historyState === "all" || (remembered.historyState === "pending" ? ["ready", "sending", "unknown"].includes(row.state) : row.state === remembered.historyState)) && (!historyThrough || row.created_at.slice(0, 10) >= historyThrough));
  const historyFiltered = remembered.historyKind !== "all" || remembered.historyState !== "all" || remembered.historyHorizon !== "30";
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [pending, transition] = useTransition();
  const busyRef = useRef(false);
  const requestRef = useRef(0);
  useEffect(() => {
    if (!historyRead) return;
    let active = true;
    const request = requestRef.current;
    void Promise.resolve(historyRead).then(rows => {
      if (!active || requestRef.current !== request) return;
      if (rows) setHistory(rows);
      setHistoryStatus(rows ? "ready" : "error");
    }).catch(() => {
      if (active && requestRef.current === request) setHistoryStatus("error");
    });
    return () => { active = false; };
  }, [historyRead]);
  const currentPlanRef = useRef("");
  const [uncertain, setUncertain] = useState(false);
  const [retryId, setRetryId] = useState<string | null>(null);
  const plan: CommunicationPlan = { kind, mode, volunteerIds: ids, ...(kind === "schedule" ? { startDate, endDate } : {}) };
  const serialized = JSON.stringify(plan);
  useEffect(() => { currentPlanRef.current = serialized; }, [serialized]);
  const state = result?.plan === serialized ? result.state : null;
  const preview = state?.kind === "preview" ? state.preview : null;
  const previousPreview = result?.state.kind === "preview" && JSON.parse(result.plan).kind === kind && JSON.parse(result.plan).mode === mode ? result.state.preview : null;
  const selectionPreview = preview ?? previousPreview;
  const alreadyReceivedCount = selectionPreview?.exclusions.filter(e => e.reason === "already_delivered" || e.reason === "already_welcomed").length ?? 0;
  const selectionEmpty = selectionTouched && ids.length === 0;
  const resendNeedsSelection = mode === "resend" && ids.length === 0;
  function run(command: string, continueOperation?: string) {
    if (busyRef.current || (uncertain && command === "send") || (historyStatus !== "ready" && command !== "history")) return;
    busyRef.current = true;
    const request = ++requestRef.current;
    const form = new FormData(); form.set("command",command); form.set("plan",serialized);
    if (command === "send" && preview) { form.set("operationId",operationId); form.set("fingerprint",preview.fingerprint); form.set("confirmedRecipients",String(preview.recipients.length)); }
    if (command === "retry" && retryId) { form.set("recipientId",retryId); form.set("confirmedRecipients","1"); }
    if (command === "continue" && continueOperation) { form.set("operationId",continueOperation); form.set("confirmedRecipients",String(history.filter(r=>r.operation_id===continueOperation && r.state==='ready').length)); }
    transition(async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const work = async () => {
          let next = await action(form);
          const confirmedOperation = command === "send" ? operationId : command === "continue" ? continueOperation : undefined;
          if (confirmedOperation) next = await finishConfirmedCommunication(next, confirmedOperation, action, current => {
            if (request === requestRef.current && current.kind === "results") setHistory(current.history);
          }, () => request === requestRef.current);
          return next;
        };
        const next = await Promise.race([work(), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), 120000);
        })]);
        if (request !== requestRef.current) return;
        if (command !== "preview" || currentPlanRef.current === serialized) setResult({plan:serialized,state:next});
        setRetryId(null);
        if(next.kind === "results") {setHistory(next.history);setHistoryStatus("ready");setUncertain(false);setOperationId(crypto.randomUUID());setActiveTab("history");}
        else if (command === "history") setHistoryStatus("error");
      } catch {
        requestRef.current++;
        if (command === "send" || command === "continue" || command === "retry") setUncertain(true);
        if (command === "history") setHistoryStatus("error");
        setResult({plan:serialized,state:{kind:"error",message:"The request timed out or failed. Refresh delivery history before continuing. Pending or unknown messages must not be retried."}});
      } finally {
        if (timer) clearTimeout(timer);
        busyRef.current = false;
      }
    });
  }
  const previewMessage = preview?.recipients[0] ? buildCommunicationMessage({ kind, workspaceName:preview.workspaceName, name:preview.recipients[0].name, assignments:preview.recipients[0].assignments, url:kind === "welcome" ? "https://projectlocal.app" : "[Private schedule link for this volunteer]" }) : null;
  return <div className={styles.workspace} data-communication-history-state={historyStatus}>
    <div className={styles.tabs} role="tablist" aria-label="Communications sections" onKeyDown={event=>{
      if(event.altKey||event.ctrlKey||event.metaKey)return;
      const tabs=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const index=tabs.indexOf(event.target as HTMLButtonElement);
      if(index<0)return;
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%tabs.length:['ArrowLeft','ArrowUp'].includes(event.key)?(index+tabs.length-1)%tabs.length:null;
      if(next!==null){event.preventDefault();tabs[next].focus();tabs[next].click();}
    }}>
      <button id={`${sectionId}-welcome`} aria-controls={`${sectionId}-composer`} tabIndex={activeTab==='welcome'?0:-1} type="button" role="tab" aria-selected={activeTab==='welcome'} className={styles.tab} onClick={()=>{setActiveTab('welcome');setKind('welcome');setMode('new');setIds([]);setSelectionTouched(false);}}><CommunicationIcon icon={Mail} /><span className={styles.tabLabel}>Welcome emails</span></button>
      <button id={`${sectionId}-schedule`} aria-controls={`${sectionId}-composer`} tabIndex={activeTab==='schedule'?0:-1} type="button" role="tab" aria-selected={activeTab==='schedule'} className={styles.tab} onClick={()=>{setActiveTab('schedule');setKind('schedule');setMode('new');setIds([]);setSelectionTouched(false);}}><CommunicationIcon icon={CalendarDays} tone="lavender" /><span className={styles.tabLabel}>Schedule deliveries</span></button>
      <button id={`${sectionId}-reminders`} aria-controls={`${sectionId}-reminder-panel`} tabIndex={activeTab==='reminders'?0:-1} type="button" role="tab" aria-selected={activeTab==='reminders'} className={styles.tab} onClick={()=>setActiveTab('reminders')}><CommunicationIcon icon={Bell} tone="teal" /><span className={styles.tabLabel}>Automatic reminders</span></button>
      <button id={`${sectionId}-history`} aria-controls={`${sectionId}-history-panel`} tabIndex={activeTab==='history'?0:-1} type="button" role="tab" data-admin-shortcut={activeTab !== 'history' ? 'filters' : undefined} aria-selected={activeTab==='history'} className={styles.tab} onClick={()=>setActiveTab('history')}><CommunicationIcon icon={History} tone="slate" /><span className={styles.tabLabel}>Delivery history</span></button>
    </div>
    <div id={`${sectionId}-reminder-panel`} role="tabpanel" aria-labelledby={`${sectionId}-reminders`} hidden={activeTab!=='reminders'}><AssignmentReminderHistory key={initialReminderStatus.observedAt} enabled={reminderEnabled} onEnabledChange={setReminderEnabled} initialSummary={initialReminderSummary} /></div>
    {activeTab!=='reminders' && historyStatus === "loading" && <p role="status" className="text-sm text-slate-600">Loading delivery history… You can choose a section while it loads.</p>}
    {activeTab!=='reminders' && historyStatus === "error" && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p>Delivery history is temporarily unavailable. Refresh it before reviewing recipients or sending.</p><button type="button" className={`${button} mt-2`} disabled={pending} onClick={() => run("history")}>Retry delivery history</button></div>}
    {(activeTab==='welcome'||activeTab==='schedule') && <section id={`${sectionId}-composer`} role="tabpanel" aria-labelledby={`${sectionId}-${activeTab}`} className={styles.surface}><div className={styles.formColumn}><div className={styles.sectionHeader}><CommunicationIcon icon={kind==='welcome'?Mail:CalendarDays} tone={kind==='welcome'?'blue':'lavender'} /><div><h2>{kind==='welcome'?'Welcome volunteers':'Send schedules'}</h2><p>{kind==='welcome' ? pendingWelcomeCount === undefined ? 'Review new volunteers when ready.' : `${pendingWelcomeCount} awaiting introduction` : 'Review upcoming work before sending schedules.'}</p></div></div>
      <fieldset disabled={pending} className="mt-4 space-y-4">
        {kind==='schedule' && <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-sm">From<input className={field} type="date" value={startDate} onChange={e=>setStart(e.target.value)} /></label><label className="min-w-0 text-sm">Through<input className={field} type="date" value={endDate} onChange={e=>setEnd(e.target.value)} /></label></div>}
        <label className="block text-sm">Recipients<select className={field} value={mode} onChange={e=>setMode(e.target.value as CommunicationPlan['mode'])}><option value="new">{kind==='welcome'?'Not yet welcomed':'Volunteers with new, unsent assignments'}</option>{kind==='schedule' && <option value="all">Complete upcoming schedule for all selected volunteers</option>}<option value="resend">Intentional resend to selected volunteers</option></select></label>
        {(ids.length>0 || selectionTouched) && <p className="text-sm text-slate-600">{ids.length} selected {mode!=='resend' && <button type="button" className="underline" onClick={()=>{setIds([]);setSelectionTouched(false);}}>Clear selection</button>}</p>}
        <p className={styles.bodyCopy}>{kind==='welcome' ? mode==='resend' ? 'Review this intentional resend. The earlier welcome delivery remains recorded.' : 'New volunteers appear here automatically. Nothing sends until you review and confirm.' : 'Only active upcoming work is included. Saving or assigning does not send email. Canceled and declined assignments are excluded; responses are preserved.'}</p>
        {resendNeedsSelection && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">Choose a previous delivery in Delivery history and select Review resend. An intentional resend needs at least one volunteer.</p>}
        {selectionEmpty && mode !== "resend" && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">No volunteers are selected. Select at least one from the recipient preview, or clear the selection to review everyone eligible.</p>}
        {state?.kind==='error' && <p role="alert" className="text-sm text-rose-700">{state.message}</p>}
        <button className={`${button} ${preview ? '' : styles.primary}`} type="button" onClick={()=>run('preview')} disabled={historyStatus !== "ready" || pending || selectionEmpty || resendNeedsSelection}>{pending?'Working…':'Review recipients'}</button>
        {selectionPreview && <section aria-label="Delivery preview" className="space-y-4 border-t border-slate-200 pt-4">
          <h3 className="font-semibold">{selectionPreview.recipients.length} will receive · {selectionPreview.exclusions.length} will not receive</h3>
          {mode !== 'resend' && <p className="text-xs text-slate-600"><span className="mr-1">{alreadyReceivedCount}</span>{" "}already received this communication. Delivery history shows each accepted send.</p>}
          <p className="text-sm">{kind === 'welcome' ? `${selectionPreview.recipients.length} volunteers selected for this introduction${mode==='resend'?' (intentional resend)':''}` : `${selectionPreview.recipients.reduce((n,r)=>n+r.assignments.length,0)} active assignments · ${selectionPreview.recipients.reduce((n,r)=>n+r.newAssignments,0)} not previously delivered · ${selectionPreview.recipients.reduce((n,r)=>n+r.previousAssignments,0)} previously delivered`}</p>
          {kind === 'schedule' && <p className="text-xs text-slate-600">{selectionPreview.recipients.reduce((n,r)=>n+(r.changedSinceLastSend ?? 0),0)} added or edited since the last schedule send · {selectionPreview.recipients.reduce((n,r)=>n+(r.removedSinceLastSend ?? 0),0)} removed. First-time recipients have no previous schedule to compare.</p>}
          <div className="max-h-64 space-y-2 overflow-y-auto">{selectionPreview.recipients.map(r=><label key={r.volunteerId} className="flex min-h-12 gap-3 rounded-lg bg-slate-50 p-3 text-sm"><input type="checkbox" checked={!selectionTouched && ids.length===0 || ids.includes(r.volunteerId)} onChange={e=>{const current=!selectionTouched && ids.length===0?selectionPreview.recipients.map(p=>p.volunteerId):ids;setSelectionTouched(true);setIds(e.target.checked?[...new Set([...current,r.volunteerId])]:current.filter(id=>id!==r.volunteerId));}} /><span className="min-w-0 break-words">{r.name}<span className="block text-xs text-slate-600">{r.email}{kind === 'schedule' ? ` · ${r.assignments.length} assignments` : mode === 'resend' ? ' · Intentional welcome resend' : ' · Introduction pending'}{r.emailChanged?' · Changed email — explicit review required':''}{r.sharedContact?' · Shared contact':''}</span></span></label>)}</div>
          {selectionPreview.recipients.length===0 && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">No eligible recipients for this selection. {selectionPreview.exclusions.length ? 'Open the reasons below, then change the selection or choose an intentional resend where allowed.' : 'No active volunteers match the selection. Check the date range or recipient choice.'}</p>}
          {selectionPreview.exclusions.length>0 && <details open={selectionPreview.recipients.length===0}><summary className="cursor-pointer text-sm">{selectionPreview.exclusions.length} excluded volunteers / delivery warnings</summary><ul className="mt-2 space-y-2 text-sm text-slate-600">{selectionPreview.exclusions.map(e=><li key={e.volunteerId}>{e.name}: {exclusionMessage[e.reason] ?? 'This volunteer is currently ineligible. Review their profile and delivery history.'}{e.excludedAssignments?` · ${e.excludedAssignments} excluded assignments`:''}</li>)}</ul></details>}
          {previewMessage && <details open><summary className="cursor-pointer font-medium">Message preview</summary><div className="mt-3 rounded-xl border border-slate-200 p-4"><p className="font-semibold">{previewMessage.subject}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{previewMessage.text}</p></div></details>}
          {!transportEnabled && <p className="text-sm text-amber-800">Email transport is disabled. Preview only; no email will be sent.</p>}
          {!preview && <p className="text-sm text-blue-800">Selection changed. Review recipients again before confirming.</p>}
          {preview && <><p className="text-xs text-slate-600">One individual email per recipient. Eligibility is checked again before sending.</p>
          <button type="button" className={`${button} ${styles.primary}`} disabled={!transportEnabled || !preview.recipients.length || preview.recipients.length>200 || selectionEmpty || pending || uncertain} onClick={()=>run('send')}>{mode==='resend'?'Confirm intentional resend':'Confirm send'} to {recipientCountLabel(preview.recipients.length)}</button></>}
          {uncertain && <p role="alert" className="text-sm text-amber-900">Delivery outcome is uncertain. Refresh history before starting another send.</p>}
          {selectionPreview.recipients.length>200 && <p className="text-sm text-amber-800">Choose up to 200 recipients for this operation.</p>}
        </section>}
      </fieldset>
    </div></section>}
    {activeTab === 'history' && <section id={`${sectionId}-history-panel`} role="tabpanel" aria-labelledby={`${sectionId}-history`} className={styles.surface}><div className="flex flex-wrap items-center justify-between gap-3"><div className={styles.sectionHeader}><CommunicationIcon icon={History} tone="slate" /><h2>Delivery history</h2></div><button className={`${button} ${styles.quiet}`} type="button" onClick={()=>run('history')} disabled={pending}>Refresh history</button></div>
      <p className={`${styles.bodyCopy} mt-3`}>Sent means accepted by the email provider, not proof of inbox receipt. Sending or unknown messages are blocked from retry until their outcome is resolved.</p>
      <p className={`${styles.metadata} mt-2`}>Times in {timezone}.</p>
      <div className={styles.filterGroup} aria-label="Delivery history filters">
        <label>Type<select data-admin-shortcut="filters" className={field} value={remembered.historyKind} onChange={event => setRemembered(current => ({ ...current, historyKind: event.target.value as CommunicationsView["historyKind"] }))}><option value="all">All types</option><option value="welcome">Welcome</option><option value="schedule">Schedule</option></select></label>
        <label>Delivery<select className={field} value={remembered.historyState} onChange={event => setRemembered(current => ({ ...current, historyState: event.target.value as CommunicationsView["historyState"] }))}><option value="all">All states</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="pending">Pending / unknown</option></select></label>
        <label>When<select className={field} value={remembered.historyHorizon} onChange={event => setRemembered(current => ({ ...current, historyHorizon: event.target.value as CommunicationsView["historyHorizon"] }))}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All loaded history</option></select></label>
      </div>
      <div className={`mt-2 flex flex-wrap items-center gap-2 ${styles.metadata}`}><span>Showing: {remembered.historyKind === "all" ? "All types" : remembered.historyKind === "welcome" ? "Welcome" : "Schedule"} · {remembered.historyState === "all" ? "All states" : remembered.historyState === "pending" ? "Pending / unknown" : remembered.historyState} · {remembered.historyHorizon === "all" ? "All loaded history" : `Last ${remembered.historyHorizon} days`}</span><button className={`ml-auto ${button} ${styles.quiet}`} type="button" onClick={resetRemembered}>{historyFiltered ? "Reset view" : "Default view"}</button></div>
      {historyStatus === "ready" && !visibleHistory.length && <p className="mt-5 text-sm text-slate-600">{history.length ? "No deliveries match this view." : "No deliveries yet."}</p>}
      {history.some(r=>r.state==='ready') && <div className="mt-4 flex flex-wrap gap-2">{[...new Set(history.filter(r=>r.state==='ready').map(r=>r.operation_id))].map(id=><button key={id} type="button" className={button} disabled={pending || !transportEnabled} onClick={()=>run('continue',id)}>Confirm delivery to {recipientCountLabel(history.filter(r=>r.operation_id===id && r.state==='ready').length, "pending")}</button>)}</div>}
      <div className="mt-4">{[...new Set(visibleHistory.map(r=>r.operation_id))].map(id=>{
        const rows=visibleHistory.filter(r=>r.operation_id===id),first=rows[0];
        return <div key={id} className={styles.historyGroup}><div className={styles.historyGroupHeader} data-communication-operation-date={projectDateKey(first.created_at,timezone)}><time dateTime={first.created_at}>{projectDateLabel(first.created_at,timezone)}</time><small>{first.kind==='welcome'?'Welcome':'Schedule'} · {recipientCountLabel(rows.length)}</small></div>
          <div>{rows.map(r=><article key={r.recipient_id} className={styles.deliveryRow}><div className="min-w-0 flex-1 basis-64"><div className={styles.rowTop}><p className={styles.rowName}>{r.name}</p><CommunicationStatus state={r.state}>{communicationStatusLabel(r.state)}</CommunicationStatus></div><p className={`${styles.rowTask} mt-1`}>{r.kind==='welcome'?'Welcome email':'Schedule email'}{r.kind==='schedule'?` · ${r.assignment_count} assignment${r.assignment_count===1?'':'s'}`:''}</p><p className={styles.metadata}><time dateTime={r.created_at} data-communication-delivery-time data-project-date={projectDateKey(r.created_at,timezone)}>{projectTimestampLabel(r.created_at,timezone)}</time></p><details className="mt-1"><summary className={styles.disclosure}>Delivery details</summary><div className={styles.detailsBody}><p className="break-all">{r.email ?? "Recipient contact removed"}</p><p>Attempt {r.attempt} · {r.mode==='new'?'Initial delivery':'Explicit resend'}{r.failure_code?` · ${r.failure_code}`:''}</p></div></details></div><div className={styles.deliveryActions}>{r.email !== null && r.state==='failed' && <button className={button} type="button" disabled={pending || !transportEnabled} onClick={()=>setRetryId(r.recipient_id)}>Retry failed message</button>}{r.email !== null && r.state==='sent' && <button className={`${button} ${styles.quiet}`} type="button" onClick={()=>{const next=r.kind==='welcome'?'welcome':'schedule';setKind(next);setActiveTab(next);setMode('resend');setIds([r.volunteer_id]);setResult(null);window.scrollTo({top:0,behavior:'smooth'});}}>Review resend</button>}</div></article>)}</div></div>;
      })}</div>
      {retryId && <div role="group" aria-label="Confirm retry" className="mt-4 rounded-xl border border-blue-300 p-4"><p className="text-sm">Retry exactly one failed message? Successful recipients will not be emailed again.</p><div className="mt-3 flex gap-2"><button type="button" className={`${button} bg-blue-600 text-white`} onClick={()=>run('retry')} disabled={pending}>Confirm retry to {recipientCountLabel(1)}</button><button className={button} type="button" onClick={()=>setRetryId(null)}>Cancel</button></div></div>}
    </section>}
  </div>;
}
