"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { BulkAssignmentPlan } from "@/lib/calendar/bulkAssignments";
import { awayOccurrences, pickerAvailability, pickerContextPlan, type PickerContextAction, type PickerContextState, type PickerOccurrence, type PickerVolunteerContext } from "@/lib/calendar/assignmentPickerContext";
import { calendarVolunteerFilterLabel, volunteerNameMatches } from "@/lib/calendar/volunteerFilter";
import { useAdminViewScope } from "@/lib/adminViews/scopeContext";
import { useRememberedView } from "@/lib/adminViews/useRememberedView";
import type { BulkVolunteerOption } from "./BulkAssignmentPlanner";

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
function shortTime(value: string | null) {
  if (!value) return "all day";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(`2026-01-01T${value.slice(0, 5)}:00Z`));
}

export function PickerVolunteerList({ volunteers, selected, dates, occurrences, plan, contextAction, onToggle }: Readonly<{
  volunteers: readonly BulkVolunteerOption[];
  selected: BulkAssignmentPlan["volunteers"];
  dates: readonly string[];
  occurrences: readonly PickerOccurrence[];
  plan: BulkAssignmentPlan;
  contextAction?: PickerContextAction;
  onToggle: (id: string, checked: boolean) => void;
}>) {
  const [search, setSearch] = useState("");
  const scope = useAdminViewScope();
  const [remembered, setRemembered, resetRemembered, preferenceHydrated] = useRememberedView("assignment-picker", scope);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ key: string; state: PickerContextState } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previewReturnRef = useRef<HTMLElement | null>(null);
  const readyVolunteers = useMemo(() => volunteers.filter(volunteer => volunteer.lifecycle === "active" && volunteer.readinessStatus === "ready"), [volunteers]);
  const congregationOptions = useMemo(() => [...new Set(readyVolunteers.map(volunteer => volunteer.congregation?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [readyVolunteers]);
  const congregation = congregationOptions.includes(remembered.congregation) ? remembered.congregation : "";
  const availability = remembered.availability;
  useEffect(() => { if (preferenceHydrated && remembered.congregation && !congregationOptions.includes(remembered.congregation)) setRemembered(current => ({ ...current, congregation: "" })); }, [preferenceHydrated, remembered.congregation, congregationOptions, setRemembered]);
  const candidateIds = useMemo(() => readyVolunteers.map(volunteer => volunteer.id), [readyVolunteers]);
  const candidateKey = candidateIds.join(",");
  const contextPlan = JSON.stringify(pickerContextPlan(plan));
  const contextKey = `${contextPlan}:${candidateKey}`;
  const context = loaded?.key === contextKey && loaded.state.kind === "ready" ? loaded.state : null;
  const contextById = useMemo(() => new Map(context?.volunteers.map(row => [row.volunteerId, row]) ?? []), [context]);
  useEffect(() => {
    if (!contextAction || !dates.length || !candidateIds.length) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const form = new FormData();
      form.set("plan", contextPlan);
      form.set("volunteerIds", JSON.stringify(candidateIds));
      try {
        const state = await contextAction(form);
        if (active) setLoaded({ key: contextKey, state });
      } catch {
        if (active) setLoaded({ key: contextKey, state: { kind: "unavailable" } });
      }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [candidateIds, contextAction, contextKey, contextPlan, dates.length]);
  useLayoutEffect(() => {
    if (!previewId) { previewReturnRef.current?.focus(); previewReturnRef.current = null; return; }
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewId(null);
      if (event.key === "Tab") { event.preventDefault(); closeRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewId]);
  const selectedIds = useMemo(() => new Set(selected.map(person => person.id)), [selected]);
  const filtered = readyVolunteers.filter(volunteer => {
    if (!volunteerNameMatches(volunteer.displayName, search)) return false;
    if (congregation && volunteer.congregation !== congregation) return false;
    if (availability !== "all") {
      const state = pickerAvailability(contextById.get(volunteer.id), dates, volunteer.availableWorkDays, occurrences);
      if (availability === "available" && state.kind !== "available") return false;
      if (availability === "conflict" && !contextById.get(volunteer.id)?.conflicts.length) return false;
      if (availability === "away" && !awayOccurrences(contextById.get(volunteer.id)?.awayPeriods ?? [], occurrences).length) return false;
      if (availability === "limited" && state.kind !== "limited") return false;
    }
    return true;
  });
  const visibleIds = new Set(filtered.map(volunteer => volunteer.id));
  const hiddenSelected = selected.filter(person => !visibleIds.has(person.id)).length;
  const filterCount = Number(Boolean(congregation)) + Number(availability !== "all");
  const previewVolunteer = readyVolunteers.find(volunteer => volunteer.id === previewId);
  const previewContext: PickerVolunteerContext | undefined = previewId ? contextById.get(previewId) : undefined;
  const labels = readyVolunteers.map(volunteer => ({ id: volunteer.id, name: volunteer.displayName, congregation: volunteer.congregation ?? null }));
  const selectionLabel = (id: string) => {
    const volunteer = readyVolunteers.find(value => value.id === id);
    return volunteer ? calendarVolunteerFilterLabel({ id, name: volunteer.displayName, congregation: volunteer.congregation ?? null }, labels) : "Volunteer";
  };
  const clearFilters = () => { setSearch(""); resetRemembered(); };
  return <div className="mt-3 min-w-0">
    <p className="text-xs font-semibold text-slate-700">Ready volunteers · {selected.length} selected</p>
    <label className="mt-2 flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 focus-within:ring-2 focus-within:ring-slate-900/30 focus-within:ring-offset-1">
      <Search aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
      <input aria-label="Search volunteers to assign" className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none" inputMode="search" onChange={event => setSearch(event.target.value)} placeholder="Search volunteers…" role="searchbox" type="text" value={search} />
      {search ? <button className={`shrink-0 text-xs font-semibold text-[var(--pl-blue)] ${focus}`} onClick={() => setSearch("")} type="button">Clear search</button> : null}
    </label>
    <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs">
      <summary className={`min-h-7 cursor-pointer font-semibold text-slate-700 ${focus}`}>Filters{filterCount ? ` (${filterCount})` : ""}</summary>
      <div className="grid min-w-0 gap-2 pb-2 pt-1 sm:grid-cols-2">
        <label className="min-w-0 font-medium text-slate-600">Availability
          <select aria-label="Availability filter" className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800" disabled={!context} onChange={event => setRemembered(current => ({ ...current, availability: event.target.value as typeof current.availability }))} value={availability}>
            <option value="all">All</option><option value="available">Available / no known conflict</option><option value="conflict">Has conflict</option><option value="away">Away</option><option value="limited">Outside usual work days</option>
          </select>
        </label>
        <label className="min-w-0 font-medium text-slate-600">Congregation
          <select aria-label="Congregation filter" className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800" onChange={event => setRemembered(current => ({ ...current, congregation: event.target.value }))} value={congregation}>
            <option value="">All congregations</option>{congregationOptions.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button className={`min-h-9 justify-self-start text-xs font-semibold text-[var(--pl-blue)] ${focus}`} onClick={clearFilters} type="button">Clear all filters</button>
      </div>
    </details>
    {filterCount ? <p className="mt-1 text-xs font-medium text-blue-800">Filtered by: {[availability !== "all" ? ({ available: "Available", conflict: "Has conflict", away: "Away", limited: "Outside usual days" } as Record<string, string>)[availability] : null, congregation].filter(Boolean).join(" · ")}</p> : null}
    {loaded?.key === contextKey && loaded.state.kind === "unavailable" ? <p className="mt-1 text-xs text-amber-800">Availability details are unavailable. You can still assign volunteers.</p> : !context && contextAction ? <p className="mt-1 text-xs text-slate-500">Checking availability for this schedule…</p> : null}
    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto" data-picker-scroll="bulk-volunteer-candidates">
      {filtered.length ? filtered.map(volunteer => {
        const status = pickerAvailability(contextById.get(volunteer.id), dates, volunteer.availableWorkDays, occurrences);
        const firstConflict = contextById.get(volunteer.id)?.conflicts[0];
        const detail = status.kind === "conflict" && firstConflict && dates.length === 1
          ? firstConflict.startTime ? `Already scheduled ${shortTime(firstConflict.startTime)}–${shortTime(firstConflict.endTime)}` : "Already scheduled all day" : status.label;
        return <div key={volunteer.id} className="flex min-h-12 min-w-0 items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-slate-50">
          <input aria-label={`Select ${volunteer.displayName}${volunteer.congregation ? ` from ${volunteer.congregation}` : ""}`} checked={selectedIds.has(volunteer.id)} className="mt-1" disabled={selected.length >= 25 && !selectedIds.has(volunteer.id)} onChange={event => onToggle(volunteer.id, event.target.checked)} type="checkbox" />
          <div className="min-w-0 flex-1"><button aria-label={`Preview ${volunteer.displayName}${volunteer.congregation ? ` from ${volunteer.congregation}` : ""}`} className={`block max-w-full truncate text-left font-medium text-slate-900 hover:text-blue-700 ${focus}`} onClick={event => { previewReturnRef.current = event.currentTarget; setPreviewId(volunteer.id); }} type="button">{volunteer.displayName}</button><p className="break-words text-xs text-slate-500">{volunteer.congregation ? `${volunteer.congregation} · ` : ""}<span className={status.kind === "away" ? "text-blue-800" : status.kind === "conflict" ? "text-amber-800" : ""}>{detail}</span></p></div>
        </div>;
      }) : <p className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">{search.trim() && !filterCount ? "No volunteers match this search." : filterCount || search.trim() ? "No volunteers match these filters." : "No ready volunteers are available for this project."}</p>}
    </div>
    {selected.length ? <details className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 px-2.5 py-1.5 text-xs"><summary className={`min-h-7 cursor-pointer font-semibold text-blue-900 ${focus}`}>Selected ({selected.length}): {selected.slice(0, 2).map(person => selectionLabel(person.id)).join(", ")}{selected.length > 2 ? ` +${selected.length - 2}` : ""}{hiddenSelected ? ` · ${hiddenSelected} hidden by current search or filters` : ""}</summary><div className="flex flex-wrap gap-1.5 pb-2 pt-1">{selected.map(person => {
      const volunteer = readyVolunteers.find(value => value.id === person.id);
      if (!volunteer) return null;
      const label = selectionLabel(person.id);
      return <button aria-label={`Remove ${label} from selection`} className={`inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-blue-200 bg-white px-2 text-blue-900 ${focus}`} key={person.id} onClick={() => onToggle(person.id, false)} type="button"><span className="truncate">{label}</span><X aria-hidden="true" className="size-3 shrink-0" /></button>;
    })}</div></details> : null}
    {previewVolunteer ? <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/45 sm:items-center sm:justify-center" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewId(null); }}>
      <section aria-label={`Scheduling preview for ${previewVolunteer.displayName}`} aria-modal="true" className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl sm:max-w-md sm:rounded-2xl" role="dialog">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words text-lg font-semibold text-slate-900">{previewVolunteer.displayName}</h4><p className="text-sm text-slate-600">{previewVolunteer.congregation || "Congregation not listed"}</p></div><button aria-label="Close volunteer preview" className={`shrink-0 rounded-lg p-2 ${focus}`} onClick={() => setPreviewId(null)} ref={closeRef} type="button"><X aria-hidden="true" className="size-5" /></button></div>
        <p className="mt-3 text-sm font-medium text-slate-800">{pickerAvailability(previewContext, dates, previewVolunteer.availableWorkDays, occurrences).label}</p>
        <p className="mt-1 text-xs text-slate-600">{selectedIds.has(previewVolunteer.id) ? "Selected for this assignment" : "Not selected for this assignment"} · {dates.length} scheduled {dates.length === 1 ? "day" : "days"}</p>
        {previewContext?.conflicts.length ? <div className="mt-4"><h5 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Overlapping work</h5><ul className="mt-1 space-y-2">{previewContext.conflicts.map(conflict => <li className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-800" key={conflict.assignmentId}>{conflict.title} · {shortDate(conflict.date)} {shortTime(conflict.startTime)}–{conflict.endDate && conflict.endDate !== conflict.date ? `${shortDate(conflict.endDate)} ` : ""}{shortTime(conflict.endTime)}</li>)}</ul></div> : null}
        {previewContext?.awayPeriods.length ? <div className="mt-4"><h5 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Away dates</h5><ul className="mt-1 space-y-1 text-sm text-slate-700">{previewContext.awayPeriods.map(period => <li key={`${period.start}:${period.end}`}>{shortDate(period.start)}{period.end !== period.start ? ` – ${shortDate(period.end)}` : ""}</li>)}</ul></div> : null}
        <p className="mt-4 text-xs text-slate-600">These are scheduling indicators. An authorized admin can still assign this volunteer.</p>
      </section>
    </div> : null}
  </div>;
}
