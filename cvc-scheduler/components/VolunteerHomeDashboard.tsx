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
  const awayTrigger = useRef<HTMLButtonElement>(null);
  const seenAssignments = new Set<string>();
  const visibleUpcoming = upcoming.filter(assignment => {
    if (seenAssignments.has(assignment.assignmentReference)) return false;
    seenAssignments.add(assignment.assignmentReference);
    return true;
  });
  const week = home?.week ?? today;
  const hasPostedMenu = home?.meals.some(meal => Boolean(meal.menu?.trim())) ?? false;
  function away(command: string, id = requestId) {
    setAwayError("");
    const form = new FormData(); form.set("command", command); form.set("id", id); form.set("week", week); form.set("start", start); form.set("end", end);
    if (result?.kind === "preview") form.set("fingerprint", result.fingerprint);
    transition(async () => { try { const value = await manageAwayAction(form); setResult(value); if (command === "remove" && value.kind === "error") setAwayError(value.message); if (value.kind === "saved") { setHome(value.home); setRemoveId(null); if (command !== "remove") dialog.current?.close(); } } catch { setAwayError("Availability could not be updated. Please try again."); } });
  }
  function changeWeek(days: number) {
    setMenuError("");
    const date = new Date(week + "T12:00Z"); date.setUTCDate(date.getUTCDate() + days);
    transition(async () => { try { const value = await readMenuWeek(date.toISOString().slice(0, 10)); if (value) setHome(value); else setMenuError("Menu unavailable. Refresh to try again."); } catch { setMenuError("Menu unavailable. Please try again."); } });
  }
  return <>
    <div className="grid items-start gap-2 sm:gap-5">
      <div className="min-w-0"><ProjectHero volunteerHome photo={home?.photo ?? defaultPhoto} projectName={projectName} title={`Welcome, ${name.trim().split(/\s+/)[0]}.`} /></div>
      <nav aria-label="Volunteer shortcuts" className="grid grid-cols-2 gap-2 sm:max-w-sm">
        <button ref={menuTrigger} type="button" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700" onClick={() => menuDialog.current?.showModal()}><Utensils aria-hidden className="size-5" />Lunch</button>
        <button ref={awayTrigger} type="button" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-950 transition hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-blue-700" onClick={() => { setResult(null); setRequestId(crypto.randomUUID()); dialog.current?.showModal(); }}><CalendarOff aria-hidden className="size-5" />Away</button>
      </nav>
      <section className="min-w-0" aria-label="Upcoming schedule">
        <VolunteerScheduleClient presentation="home" assignments={visibleUpcoming} confirmAllAssignments={assignments} showMeals={false} confirmAllAction={confirmAllVolunteerScheduleAction} submitResponseAction={submitVolunteerScheduleResponseAction} />
      </section>
    </div>
    <dialog ref={menuDialog} aria-labelledby="volunteer-lunch-title" onClose={() => menuTrigger.current?.focus()} className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl backdrop:bg-slate-950/30"><header className="flex items-center justify-between gap-3"><h2 id="volunteer-lunch-title" className="text-xl font-semibold text-emerald-950">Weekly menu</h2><button type="button" aria-label="Close weekly menu" className={control} onClick={() => menuDialog.current?.close()}><X className="size-4" /></button></header><div className="mt-3 flex items-center justify-between gap-2"><button type="button" aria-label="Previous menu week" className={control} disabled={pending} onClick={() => changeWeek(-7)}><ChevronLeft className="size-4" /></button><p className="text-xs text-emerald-950">Week of {dateLabel(week)}</p><button type="button" aria-label="Next menu week" className={control} disabled={pending} onClick={() => changeWeek(7)}><ChevronRight className="size-4" /></button></div><div className="mt-3 divide-y divide-emerald-200">{home?.meals.length && hasPostedMenu ? home.meals.map(m => <article key={`${m.date}-${m.kind}`} className="py-3 text-sm"><p className="font-semibold text-emerald-950">{dateLabel(m.date)} · {m.kind === "lunch" ? "Lunch" : "Breakfast"}</p><p className="mt-1 whitespace-pre-wrap break-words text-emerald-950">{m.menu || "Menu not posted yet."}</p>{m.startTime && <p className="mt-1 text-xs text-emerald-900">{formatScheduleClockRange(m.startTime, m.endTime)}</p>}{m.provider && <p className="mt-1 text-xs text-emerald-900">{m.provider}</p>}</article>) : <p className="rounded-xl bg-emerald-50 px-4 py-5 text-sm leading-6 text-emerald-950">The menu for this week hasn’t been posted yet.</p>}</div>{menuError && <p role="alert" className="mt-3 text-sm text-red-800">{menuError}</p>}</dialog>
    <dialog ref={dialog} aria-labelledby="volunteer-away-title" onClose={() => awayTrigger.current?.focus()} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl backdrop:bg-slate-950/30" onCancel={e => { if (pending) e.preventDefault(); }}><header className="flex items-center justify-between"><h2 id="volunteer-away-title" className="text-xl font-semibold">Availability</h2><button type="button" aria-label="Close availability" className={control} disabled={pending} onClick={() => dialog.current?.close()}><X className="size-4" /></button></header><p className="mt-2 text-sm leading-6 text-slate-600">Let the team know when you’ll be away. Existing assignments and responses remain unchanged.</p>
      <div className="mt-3 space-y-2">{home?.away.map(a => <div key={a.id} className="rounded-lg bg-slate-50 p-3 text-sm"><p className="font-medium">{dateLabel(a.start)} – {dateLabel(a.end)}</p>{removeId === a.id ? <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={control} disabled={pending} onClick={() => away("remove", a.id)}>Confirm removal</button><button type="button" className={control} onClick={() => setRemoveId(null)}>Keep</button></div> : <button type="button" className="mt-1 min-h-10 text-xs font-semibold text-blue-700 underline" onClick={() => setRemoveId(a.id)}>Remove away period</button>}</div>)}</div>
      {!home && <p role="alert" className="mt-3 text-sm text-red-800">Availability is temporarily unavailable. Refresh to try again.</p>}
      {awayError && <p role="alert" className="mt-3 text-sm text-red-800">{awayError}</p>}
      <h3 className="mt-4 text-sm font-semibold">Add away period</h3>
      <div className="mt-4 grid grid-cols-2 gap-3"><label className="grid min-w-0 gap-1 text-sm">From<input className={`${control} min-w-0 w-full`} type="date" min={today} value={start} onChange={e => { setStart(e.target.value); setResult(null); }} /></label><label className="grid min-w-0 gap-1 text-sm">Through<input className={`${control} min-w-0 w-full`} type="date" min={start} value={end} onChange={e => { setEnd(e.target.value); setResult(null); }} /></label></div>
      <button type="button" className={`${control} mt-4`} disabled={pending} onClick={() => away("preview")}>Review away period</button>
      {result?.kind === "preview" && <div className="mt-4 rounded-xl border border-blue-200 p-4"><p className="text-sm font-semibold">{result.conflicts.length ? `${result.conflicts.length} existing assignment conflicts` : "No published assignment conflicts"}</p>{result.conflicts.map(c => <p className="mt-2 text-sm" key={c.id}>{dateLabel(c.date)} · {c.title}</p>)}{result.conflicts.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-600">Use Can’t make it on your schedule or contact the project team about these assignments. Saving away dates does not change responses.</p>}<button type="button" className={`${control} mt-3 bg-blue-700 text-white`} disabled={pending} onClick={() => away("save")}>Save away period</button></div>}
      {result?.kind === "error" && <p role="alert" className="mt-3 text-sm text-red-800">{result.message}</p>}
    </dialog>
  </>;
}
