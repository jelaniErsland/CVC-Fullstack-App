"use client";
import { useRef, useState, useTransition } from "react";
import { CalendarOff, ChevronLeft, ChevronRight, Utensils, X } from "lucide-react";
import { ProjectHero } from "./ProjectHero";
import { VolunteerScheduleClient } from "./VolunteerScheduleClient";
import { defaultPhoto } from "@/lib/projectPhoto/photo";
import type { VolunteerScheduleAssignment } from "@/lib/volunteerScheduleAccess/token";
import type { VolunteerHome } from "@/lib/volunteerScheduleAccess/home.server";
import { manageAwayAction, readMenuWeek, type AwayResult } from "@/app/v/schedule/home.actions";
import { confirmAllVolunteerScheduleAction, submitVolunteerScheduleResponseAction } from "@/app/v/schedule/actions";
import { formatScheduleClockRange } from "@/lib/scheduleFormatting";
const control = "min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50";
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00Z"));
export function VolunteerHomeDashboard({ name, projectName, assignments, upcoming, initialHome, today }: { name: string; projectName: string; assignments: readonly VolunteerScheduleAssignment[]; upcoming: readonly VolunteerScheduleAssignment[]; initialHome: VolunteerHome | null; today: string }) {
  const [home, setHome] = useState(initialHome), [result, setResult] = useState<AwayResult | null>(null);
  const [menuError, setMenuError] = useState(""), [awayError, setAwayError] = useState("");
  const [start, setStart] = useState(today), [end, setEnd] = useState(today);
  const [requestId, setRequestId] = useState(""), [removeId, setRemoveId] = useState<string | null>(null);
  const [pending, transition] = useTransition(); const dialog = useRef<HTMLDialogElement>(null);
  const menuDialog = useRef<HTMLDialogElement>(null), menuTrigger = useRef<HTMLButtonElement>(null);
  const next = upcoming.find(a => a.currentResponseStatus === "needs_response" && (a.canConfirm || a.canDecline)) ?? upcoming.find(a => a.currentResponseStatus !== "declined");
  const nextLunch = home?.meals.find(m => m.kind === "lunch" && m.date >= today);
  const week = home?.week ?? today;
  function away(command: string, id = requestId) {
    setAwayError("");
    const form = new FormData(); form.set("command", command); form.set("id", id); form.set("week", week); form.set("start", start); form.set("end", end);
    if (result?.kind === "preview") form.set("fingerprint", result.fingerprint);
    transition(async () => { const value = await manageAwayAction(form); setResult(value); if (command === "remove" && value.kind === "error") setAwayError(value.message); if (value.kind === "saved") { setHome(value.home); setRemoveId(null); dialog.current?.close(); } });
  }
  function changeWeek(days: number) {
    setMenuError("");
    const date = new Date(week + "T12:00Z"); date.setUTCDate(date.getUTCDate() + days);
    transition(async () => { const value = await readMenuWeek(date.toISOString().slice(0, 10)); if (value) setHome(value); else setMenuError("Menu unavailable. Refresh to try again."); });
  }
  return <>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px] lg:gap-7">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1"><ProjectHero photo={home?.photo ?? defaultPhoto} projectName={projectName} title={`Welcome, ${name.trim().split(/\s+/)[0]}.`} /></div>
      <section className="min-w-0 lg:col-start-1 lg:row-start-2" aria-label="Next assignment">
        {next ? <VolunteerScheduleClient assignments={[next]} showMeals={false} confirmAllAction={confirmAllVolunteerScheduleAction} submitResponseAction={submitVolunteerScheduleResponseAction} /> : <p className="mt-3 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No upcoming assignments yet. Your published work will appear here.</p>}
      </section>
      <aside className="grid min-w-0 gap-4 lg:col-start-2 lg:row-span-3 lg:row-start-1">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4" aria-label="Lunch and weekly menu">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-800 text-white"><Utensils aria-hidden className="size-5" /></span><div><h2 className="font-semibold text-emerald-950">Lunch</h2><p className="text-xs text-emerald-800">{nextLunch ? dateLabel(nextLunch.date) : "Posted project meals"}</p></div></div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm font-medium text-emerald-950">{nextLunch ? nextLunch.menu || "Menu not posted yet." : "No upcoming lunch posted for this week."}</p>
          {nextLunch?.startTime && <p className="mt-2 text-xs text-emerald-900">{formatScheduleClockRange(nextLunch.startTime, nextLunch.endTime)}</p>}
          {nextLunch?.provider && <p className="mt-1 break-words text-xs text-emerald-900">{nextLunch.provider}</p>}
          <button ref={menuTrigger} type="button" className={`${control} mt-3 w-full border-emerald-300 bg-white text-emerald-900`} onClick={() => menuDialog.current?.showModal()}>View weekly menu</button>
          {menuError && <p role="alert" className="mt-3 text-sm text-red-800">{menuError}</p>}
        </section>
        <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4" aria-label="Availability and away periods"><div className="flex items-center gap-2"><CalendarOff aria-hidden className="size-5 text-blue-700" /><h2 className="font-semibold text-blue-950">Availability</h2></div><p className="mt-2 text-sm text-blue-900">Let the team know when you’ll be away.</p>
          <div className="mt-3 space-y-2">{home?.away.map(a => <div key={a.id} className="rounded-lg bg-white p-3 text-sm"><p className="font-medium">{dateLabel(a.start)} – {dateLabel(a.end)}</p>{removeId === a.id ? <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={control} disabled={pending} onClick={() => away("remove", a.id)}>Confirm removal</button><button type="button" className={control} onClick={() => setRemoveId(null)}>Keep</button></div> : <button type="button" className="mt-1 text-xs font-semibold text-blue-700 underline" onClick={() => setRemoveId(a.id)}>Remove away period</button>}</div>)}</div>
          <button type="button" className={`${control} mt-3 w-full text-blue-800`} disabled={!home} onClick={() => { setResult(null); setRequestId(crypto.randomUUID()); dialog.current?.showModal(); }}>Add away period</button>
          {!home && <p className="mt-2 text-xs">Availability is temporarily unavailable.</p>}
          {awayError && <p role="alert" className="mt-3 text-sm text-red-800">{awayError}</p>}
        </section>
      </aside>
      <section className="min-w-0 lg:col-start-1 lg:row-start-3" aria-label="Upcoming agenda"><h2 className="text-lg font-semibold tracking-tight">Coming up</h2><div className="mt-3 divide-y divide-slate-200 border-y border-slate-200">{upcoming.filter(a => a !== next).slice(0, 3).map(a => <article className="flex items-start gap-4 py-3" key={a.assignmentReference}><span className="w-20 shrink-0 text-xs font-medium text-blue-800">{dateLabel(a.startDate)}</span><div className="min-w-0"><p className="break-words text-sm font-semibold">{a.taskTitle}</p><p className="mt-1 text-xs text-slate-600">{formatScheduleClockRange(a.startTime, a.endTime) ?? "No specific time"} · {a.currentResponseStatus === "confirmed" ? "Confirmed" : a.currentResponseStatus === "declined" ? "Can’t make it" : "Needs reply"}</p></div></article>)}</div>
        <details className="mt-4"><summary className="cursor-pointer rounded-lg py-2 text-sm font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">View full schedule ({assignments.length})</summary><VolunteerScheduleClient assignments={assignments} showMeals={false} confirmAllAction={confirmAllVolunteerScheduleAction} submitResponseAction={submitVolunteerScheduleResponseAction} /></details>
      </section>
    </div>
    <dialog ref={menuDialog} onClose={() => menuTrigger.current?.focus()} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl backdrop:bg-slate-950/30"><header className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-emerald-950">Weekly menu</h2><button type="button" aria-label="Close weekly menu" className={control} onClick={() => menuDialog.current?.close()}><X className="size-4" /></button></header><div className="mt-3 flex items-center justify-between gap-2"><button type="button" aria-label="Previous menu week" className={control} disabled={pending} onClick={() => changeWeek(-7)}><ChevronLeft className="size-4" /></button><p className="text-xs text-emerald-950">Week of {dateLabel(week)}</p><button type="button" aria-label="Next menu week" className={control} disabled={pending} onClick={() => changeWeek(7)}><ChevronRight className="size-4" /></button></div><div className="mt-3 divide-y divide-emerald-200">{home?.meals.length ? home.meals.map(m => <article key={`${m.date}-${m.kind}`} className="py-3 text-sm"><p className="font-semibold text-emerald-950">{dateLabel(m.date)} · {m.kind === "lunch" ? "Lunch" : "Breakfast"}</p><p className="mt-1 whitespace-pre-wrap break-words text-emerald-950">{m.menu || "Menu not posted yet."}</p>{m.startTime && <p className="mt-1 text-xs text-emerald-900">{formatScheduleClockRange(m.startTime, m.endTime)}</p>}{m.provider && <p className="mt-1 text-xs text-emerald-900">{m.provider}</p>}</article>) : <p className="py-3 text-sm text-emerald-900">No meals posted this week.</p>}</div>{menuError && <p role="alert" className="mt-3 text-sm text-red-800">{menuError}</p>}</dialog>
    <dialog ref={dialog} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl backdrop:bg-slate-950/30" onCancel={e => { if (pending) e.preventDefault(); }}><header className="flex items-center justify-between"><h2 className="text-xl font-semibold">Away period</h2><button type="button" aria-label="Close away period" className={control} disabled={pending} onClick={() => dialog.current?.close()}><X className="size-4" /></button></header><p className="mt-2 text-sm leading-6 text-slate-600">This records your availability. Existing assignments and responses remain unchanged.</p>
      <div className="mt-4 grid grid-cols-2 gap-3"><label className="grid min-w-0 gap-1 text-sm">From<input className={`${control} min-w-0 w-full`} type="date" min={today} value={start} onChange={e => { setStart(e.target.value); setResult(null); }} /></label><label className="grid min-w-0 gap-1 text-sm">Through<input className={`${control} min-w-0 w-full`} type="date" min={start} value={end} onChange={e => { setEnd(e.target.value); setResult(null); }} /></label></div>
      <button type="button" className={`${control} mt-4`} disabled={pending} onClick={() => away("preview")}>Review away period</button>
      {result?.kind === "preview" && <div className="mt-4 rounded-xl border border-blue-200 p-4"><p className="text-sm font-semibold">{result.conflicts.length ? `${result.conflicts.length} existing assignment conflicts` : "No published assignment conflicts"}</p>{result.conflicts.map(c => <p className="mt-2 text-sm" key={c.id}>{dateLabel(c.date)} · {c.title}</p>)}{result.conflicts.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-600">Use Can’t make it on your schedule or contact the project team about these assignments. Saving away dates does not change responses.</p>}<button type="button" className={`${control} mt-3 bg-blue-700 text-white`} disabled={pending} onClick={() => away("save")}>Save away period</button></div>}
      {result?.kind === "error" && <p role="alert" className="mt-3 text-sm text-red-800">{result.message}</p>}
    </dialog>
  </>;
}
