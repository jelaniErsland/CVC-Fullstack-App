"use client";
import { useState, useTransition } from "react";
import { Mail, CalendarDays, History } from "lucide-react";
import { buildCommunicationMessage, type CommunicationPlan, type CommunicationHistory, type CommunicationActionState } from "@/lib/notifications/communications";
import { finishConfirmedCommunication } from "@/lib/notifications/communicationBatches";
const field = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm";
const button = "min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-50";
export function CommunicationsWorkspace({ action, history: initialHistory, pendingWelcomeCount, transportEnabled, initialVolunteerId, initialKind = "welcome", initialStartDate, initialEndDate, today }: {
  action: (form: FormData) => Promise<CommunicationActionState>; history: CommunicationHistory[]; pendingWelcomeCount: number;
  transportEnabled: boolean; initialVolunteerId?: string; initialKind?: "welcome" | "schedule"; initialStartDate?: string; initialEndDate?: string; today: string;
}) {
  const [kind, setKind] = useState<"welcome" | "schedule">(initialKind);
  const [activeTab, setActiveTab] = useState<"welcome" | "schedule" | "history">(initialKind);
  const [mode, setMode] = useState<CommunicationPlan["mode"]>(initialVolunteerId ? "resend" : "new");
  const [startDate, setStart] = useState(initialStartDate ?? today), [endDate, setEnd] = useState(() => { if (initialEndDate) return initialEndDate; const d = new Date(today + "T12:00Z"); d.setUTCDate(d.getUTCDate()+30); return d.toISOString().slice(0,10); });
  const [ids, setIds] = useState<string[]>(initialVolunteerId ? [initialVolunteerId] : []);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [result, setResult] = useState<{ plan: string; state: CommunicationActionState } | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [pending, transition] = useTransition();
  const [retryId, setRetryId] = useState<string | null>(null);
  const plan: CommunicationPlan = { kind, mode, volunteerIds: ids, ...(kind === "schedule" ? { startDate, endDate } : {}) };
  const serialized = JSON.stringify(plan);
  const state = result?.plan === serialized ? result.state : null;
  const preview = state?.kind === "preview" ? state.preview : null;
  const previousPreview = result?.state.kind === "preview" && JSON.parse(result.plan).kind === kind && JSON.parse(result.plan).mode === mode ? result.state.preview : null;
  const selectionPreview = preview ?? previousPreview;
  const selectionEmpty = selectionTouched && ids.length === 0;
  function run(command: string, continueOperation?: string) {
    const form = new FormData(); form.set("command",command); form.set("plan",serialized);
    if (command === "send" && preview) { form.set("operationId",operationId); form.set("fingerprint",preview.fingerprint); form.set("confirmedRecipients",String(preview.recipients.length)); }
    if (command === "retry" && retryId) { form.set("recipientId",retryId); form.set("confirmedRecipients","1"); }
    if (command === "continue" && continueOperation) { form.set("operationId",continueOperation); form.set("confirmedRecipients",String(history.filter(r=>r.operation_id===continueOperation && r.state==='ready').length)); }
    transition(async () => {
      try {
        let next = await action(form);
        const confirmedOperation = command === "send" ? operationId : command === "continue" ? continueOperation : undefined;
        if (confirmedOperation) next = await finishConfirmedCommunication(next, confirmedOperation, action, current => {
          if (current.kind === "results") setHistory(current.history);
        });
        setResult({plan:serialized,state:next}); setRetryId(null);
        if(next.kind === "results") {setHistory(next.history);setOperationId(crypto.randomUUID());setActiveTab("history");}
      } catch {
        setResult({plan:serialized,state:{kind:"error",message:"Delivery progress is unavailable. Refresh history before continuing. Pending or unknown messages must not be retried."}});
      }
    });
  }
  const previewMessage = preview?.recipients[0] ? buildCommunicationMessage({ kind, workspaceName:preview.workspaceName, name:preview.recipients[0].name, assignments:preview.recipients[0].assignments, url:kind === "welcome" ? "https://projectlocal.app" : "[Private schedule link for this volunteer]" }) : null;
  return <div className="mt-6 space-y-5">
    <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Communications sections">
      <button type="button" role="tab" aria-selected={activeTab==='welcome'} className={`${button} flex items-center gap-2 text-left ${activeTab==='welcome'?'border-blue-400 bg-blue-50':'bg-white'}`} onClick={()=>{setActiveTab('welcome');setKind('welcome');setMode('new');setIds([]);setSelectionTouched(false);}}><Mail className="size-4 text-blue-600" /><span>Welcome emails<span className="block text-xs font-normal text-slate-600">{pendingWelcomeCount} awaiting introduction</span></span></button>
      <button type="button" role="tab" aria-selected={activeTab==='schedule'} className={`${button} flex items-center gap-2 text-left ${activeTab==='schedule'?'border-blue-400 bg-blue-50':'bg-white'}`} onClick={()=>{setActiveTab('schedule');setKind('schedule');setMode('new');setIds([]);setSelectionTouched(false);}}><CalendarDays className="size-4 text-blue-600" /><span>Schedule deliveries</span></button>
      <button type="button" role="tab" aria-selected={activeTab==='history'} className={`${button} flex items-center gap-2 text-left ${activeTab==='history'?'border-blue-400 bg-blue-50':'bg-white'}`} onClick={()=>setActiveTab('history')}><History className="size-4 text-blue-600" />Delivery history</button>
    </div>
    {activeTab !== 'history' && <section role="tabpanel" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h2 className="text-xl font-semibold">{kind==='welcome'?'Welcome volunteers':'Send schedules'}</h2>
      <fieldset disabled={pending} className="mt-4 space-y-4">
        {kind==='schedule' && <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-sm">From<input className={field} type="date" value={startDate} onChange={e=>setStart(e.target.value)} /></label><label className="min-w-0 text-sm">Through<input className={field} type="date" value={endDate} onChange={e=>setEnd(e.target.value)} /></label></div>}
        <label className="block text-sm">Recipients<select className={field} value={mode} onChange={e=>setMode(e.target.value as CommunicationPlan['mode'])}><option value="new">{kind==='welcome'?'Not yet welcomed':'Volunteers with new, unsent assignments'}</option>{kind==='schedule' && <option value="all">Complete upcoming schedule for all selected volunteers</option>}<option value="resend">Intentional resend to selected volunteers</option></select></label>
        {(ids.length>0 || selectionTouched) && <p className="text-sm text-slate-600">{ids.length} selected {mode!=='resend' && <button type="button" className="underline" onClick={()=>{setIds([]);setSelectionTouched(false);}}>Clear selection</button>}</p>}
        <p className="text-xs leading-5 text-slate-600">{kind==='welcome' ? mode==='resend' ? 'Review this intentional resend. The earlier welcome delivery remains recorded.' : 'New volunteers appear here automatically. Nothing sends until you review and confirm.' : 'Only published upcoming work is included. Canceled and declined assignments are excluded. Responses are preserved.'}</p>
        {state?.kind==='error' && <p role="alert" className="text-sm text-rose-700">{state.message}</p>}
        <button className={button} type="button" onClick={()=>run('preview')} disabled={pending || selectionEmpty}>{pending?'Working…':'Review recipients'}</button>
        {selectionPreview && <section aria-label="Delivery preview" className="space-y-4 border-t border-slate-200 pt-4">
          <h3 className="font-semibold">Review {selectionPreview.recipients.length} recipients</h3>
          <p className="text-sm">{kind === 'welcome' ? `${selectionPreview.recipients.length} volunteers awaiting this introduction` : `${selectionPreview.recipients.reduce((n,r)=>n+r.assignments.length,0)} assignments · ${selectionPreview.recipients.reduce((n,r)=>n+r.newAssignments,0)} new · ${selectionPreview.recipients.reduce((n,r)=>n+r.previousAssignments,0)} previously delivered`}</p>
          <div className="max-h-64 space-y-2 overflow-y-auto">{selectionPreview.recipients.map(r=><label key={r.volunteerId} className="flex min-h-12 gap-3 rounded-lg bg-slate-50 p-3 text-sm"><input type="checkbox" checked={!selectionTouched && ids.length===0 || ids.includes(r.volunteerId)} onChange={e=>{const current=!selectionTouched && ids.length===0?selectionPreview.recipients.map(p=>p.volunteerId):ids;setSelectionTouched(true);setIds(e.target.checked?[...new Set([...current,r.volunteerId])]:current.filter(id=>id!==r.volunteerId));}} /><span className="min-w-0 break-words">{r.name}<span className="block text-xs text-slate-600">{r.email}{kind === 'schedule' ? ` · ${r.assignments.length} assignments` : mode === 'resend' ? ' · Intentional welcome resend' : ' · Introduction pending'}{r.emailChanged?' · Changed email — explicit review required':''}</span></span></label>)}</div>
          {selectionPreview.exclusions.length>0 && <details><summary className="cursor-pointer text-sm">{selectionPreview.exclusions.length} excluded volunteers / delivery warnings</summary><ul className="mt-2 space-y-2 text-sm text-slate-600">{selectionPreview.exclusions.map(e=><li key={e.volunteerId}>{e.name}: {e.reason.replaceAll('_',' ')}{e.excludedAssignments?` · ${e.excludedAssignments} excluded assignments`:''}</li>)}</ul></details>}
          {previewMessage && <details open><summary className="cursor-pointer font-medium">Message preview</summary><div className="mt-3 rounded-xl border border-slate-200 p-4"><p className="font-semibold">{previewMessage.subject}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{previewMessage.text}</p></div></details>}
          {!transportEnabled && <p className="text-sm text-amber-800">Email transport is disabled. Preview only; no email will be sent.</p>}
          {!preview && <p className="text-sm text-blue-800">Selection changed. Review recipients again before confirming.</p>}
          {preview && <><p className="text-xs text-slate-600">One individual email per recipient. Eligibility is checked again before sending.</p>
          <button type="button" className={`${button} bg-[var(--pl-blue)] text-white`} disabled={!transportEnabled || !preview.recipients.length || preview.recipients.length>200 || selectionEmpty || pending} onClick={()=>run('send')}>Confirm send to {preview.recipients.length} recipients</button></>}
          {selectionPreview.recipients.length>200 && <p className="text-sm text-amber-800">Choose up to 200 recipients for this operation.</p>}
        </section>}
      </fieldset>
    </section>}
    {activeTab === 'history' && <section role="tabpanel" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl font-semibold"><History className="size-5" />Delivery history</h2><button className={button} type="button" onClick={()=>run('history')} disabled={pending}>Refresh history</button></div>
      <p className="mt-2 text-xs leading-5 text-slate-600">Sent means accepted by the email provider, not proof of inbox receipt. Sending or unknown messages are blocked from retry until their outcome is resolved.</p>
      {!history.length && <p className="mt-5 text-sm text-slate-600">No deliveries yet.</p>}
      <div className="mt-4 flex flex-wrap gap-2">{[...new Set(history.filter(r=>r.state==='ready').map(r=>r.operation_id))].map(id=><button key={id} type="button" className={button} disabled={pending || !transportEnabled} onClick={()=>run('continue',id)}>Confirm delivery to {history.filter(r=>r.operation_id===id && r.state==='ready').length} pending recipients</button>)}</div>
      <div className="mt-4 space-y-4">{[...new Set(history.map(r=>r.operation_id))].map(id=><div key={id} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-600">{history.find(r=>r.operation_id===id)?.created_at.slice(0,10)} · {history.find(r=>r.operation_id===id)?.kind === 'welcome'?'Welcome':'Schedule'} · {history.filter(r=>r.operation_id===id).length} recipients</p><div className="mt-2 divide-y divide-slate-100">{history.filter(r=>r.operation_id===id).map(r=><article key={r.recipient_id} className="flex flex-wrap items-center justify-between gap-3 py-2"><div className="min-w-0 text-sm"><p className="font-semibold">{r.name} <span className="font-normal text-slate-600">· {r.state==='sending'?'Sending / outcome pending':r.state}</span></p><p className="text-xs text-slate-600">{r.kind==='welcome'?'Welcome email':'Schedule email'} · {new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(r.created_at))}{r.kind==='schedule'?` · ${r.assignment_count} assignments`:''}</p><details className="mt-1 text-xs text-slate-500"><summary className="cursor-pointer">Delivery details</summary><p className="break-all">{r.email}</p><p>Attempt {r.attempt} · {r.mode==='new'?'Initial delivery':'Explicit resend'}{r.failure_code?` · ${r.failure_code}`:''}</p></details></div><div className="flex gap-2">{r.state==='failed' && <button className={button} type="button" disabled={pending || !transportEnabled} onClick={()=>setRetryId(r.recipient_id)}>Retry failed message</button>}{r.state==='sent' && <button className={button} type="button" onClick={()=>{const next=r.kind==='welcome'?'welcome':'schedule';setKind(next);setActiveTab(next);setMode('resend');setIds([r.volunteer_id]);setResult(null);window.scrollTo({top:0,behavior:'smooth'});}}>Review resend</button>}</div></article>)}</div></div>)}</div>
      {retryId && <div role="group" aria-label="Confirm retry" className="mt-4 rounded-xl border border-blue-300 p-4"><p className="text-sm">Retry exactly one failed message? Successful recipients will not be emailed again.</p><div className="mt-3 flex gap-2"><button type="button" className={`${button} bg-blue-600 text-white`} onClick={()=>run('retry')} disabled={pending}>Confirm retry to 1 recipient</button><button className={button} type="button" onClick={()=>setRetryId(null)}>Cancel</button></div></div>}
    </section>}
  </div>;
}
