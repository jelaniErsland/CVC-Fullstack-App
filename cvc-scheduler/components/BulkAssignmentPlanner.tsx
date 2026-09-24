"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { assignmentPreviewCounts, type BulkAssignmentActionState, type BulkAssignmentPlan } from "@/lib/calendar/bulkAssignments";
import { expandRepeatDates } from "@/lib/calendar/repeat";

export type BulkAssignmentAction = (form: FormData) => Promise<BulkAssignmentActionState>;
export type BulkVolunteerOption = { id: string; displayName: string; lifecycle: string; readinessStatus: string };
export type AssignmentItemOption = { id: string; date: string; title: string; startTime: string | null; endTime: string | null };
export type AssignmentComposerHandle = { save: () => Promise<boolean> };
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";
function readableDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export const BulkAssignmentPlanner = forwardRef<AssignmentComposerHandle, {
  action: BulkAssignmentAction; volunteers: readonly BulkVolunteerOption[];
  primaryItem?: AssignmentItemOption; otherItems?: readonly AssignmentItemOption[];
  create?: BulkAssignmentPlan["create"]; onSelectionChange?: (hasSelection: boolean) => void; onReadyChange?: (ready: boolean) => void;
}>(function BulkAssignmentPlanner({ action, volunteers, primaryItem, otherItems = [], create, onSelectionChange, onReadyChange }, ref) {
  const router = useRouter();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [selectedOtherIds, setSelectedOtherIds] = useState<string[]>([]);
  const [showOtherDates, setShowOtherDates] = useState(false);
  const [selected, setSelected] = useState<BulkAssignmentPlan["volunteers"]>([]);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ plan: string; state: BulkAssignmentActionState } | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<number | null>(null);
  const selectedItems = useMemo(() => primaryItem ? [primaryItem, ...otherItems.filter(item => selectedOtherIds.includes(item.id))] : [], [primaryItem, otherItems, selectedOtherIds]);
  const dates = useMemo(() => create ? expandRepeatDates(create.startDate, create.endDate, create.weekdays) : [...new Set(selectedItems.map(item => item.date))].sort(), [create, selectedItems]);
  const plan = useMemo((): BulkAssignmentPlan => ({ itemIds: create ? [] : selectedItems.map(item => item.id), volunteers: selected, note: note.trim() || null, ...(create ? { create } : {}) }), [create, selectedItems, selected, note]);
  const serialized = JSON.stringify(plan);
  const current = result?.plan === serialized ? result.state : null;
  const preview = current?.kind === "preview" ? current.preview : null;
  const counts = preview ? assignmentPreviewCounts(preview, plan) : null;
  const readyVolunteers = volunteers.filter(volunteer => volunteer.lifecycle === "active" && volunteer.readinessStatus === "ready");
  const selectedNames = selected.map(person => readyVolunteers.find(volunteer => volunteer.id === person.id)?.displayName).filter(Boolean).join(", ");
  const daySummary = dates.length ? `${dates.length} scheduled ${dates.length === 1 ? "day" : "days"}: ${readableDate(dates[0])}${dates.length > 1 ? ` – ${readableDate(dates[dates.length - 1])}` : ""}` : "No scheduled days";
  useEffect(() => { onReadyChange?.(Boolean(preview && counts?.added && !previewPending && !saving)); }, [onReadyChange, preview, counts?.added, previewPending, saving]);
  useEffect(() => {
    if (!selected.length || !dates.length) { setPreviewPending(false); return; }
    let active = true;
    const timer = window.setTimeout(async () => {
      setPreviewPending(true);
      const form = new FormData(); form.set("requestId", requestId); form.set("plan", serialized);
      try { const state = await action(form); if (active) setResult({ plan: serialized, state }); }
      catch { if (active) setResult({ plan: serialized, state: { kind: "error", message: "Assignment preview is unavailable. Try again before saving." } }); }
      finally { if (active) setPreviewPending(false); }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [action, dates.length, requestId, selected.length, serialized]);
  async function save() {
    if (!preview || saving || !counts?.added) return false;
    setSaving(true);
    const form = new FormData(); form.set("requestId", requestId); form.set("plan", serialized); form.set("fingerprint", preview.fingerprint);
    try {
      const state = await action(form); setResult({ plan: serialized, state });
      if (state.kind === "saved") { setSavedNotice(state.count); setSelected([]); onSelectionChange?.(false); setRequestId(crypto.randomUUID()); router.refresh(); return true; }
    } catch { setResult({ plan: serialized, state: { kind: "error", message: "The save result is unavailable. Refresh Calendar and check before trying again." } }); }
    finally { setSaving(false); }
    return false;
  }
  useImperativeHandle(ref, () => ({ save }));
  function toggleVolunteer(id: string, checked: boolean) {
    setSavedNotice(null);
    const next = checked ? [...selected, { id, excludeDates: [] }] : selected.filter(volunteer => volunteer.id !== id);
    setSelected(next); onSelectionChange?.(next.length > 0);
  }
  function toggleException(id: string, date: string, checked: boolean) {
    setSelected(currentVolunteers => currentVolunteers.map(volunteer => volunteer.id === id
      ? { ...volunteer, excludeDates: checked ? [...volunteer.excludeDates, date].sort() : volunteer.excludeDates.filter(value => value !== date) }
      : volunteer));
  }
  return <section aria-label="Assign volunteers" className="mt-4 min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
    <h3 className="text-sm font-semibold text-slate-900">Assign volunteers</h3>
    <p className="mt-1 text-sm font-semibold text-slate-800">{create ? daySummary : `${selectedItems.length} selected ${selectedItems.length === 1 ? "item" : "items"} · ${daySummary}`}</p>
    {create && dates.length > 1 && <details className="mt-2 text-xs"><summary className="cursor-pointer font-semibold text-blue-700">View {dates.length} scheduled days</summary><div className="mt-2 flex flex-wrap gap-1">{dates.map(date => <span key={date} className="rounded-md bg-slate-100 px-2 py-1">{readableDate(date)}</span>)}</div></details>}
    {!create && primaryItem && <div className="mt-3 space-y-2 text-sm"><p className="font-medium text-slate-800">This item · {readableDate(primaryItem.date)} · {primaryItem.title}</p><label className="flex min-h-10 items-center gap-2 font-medium text-blue-700"><input type="checkbox" checked={showOtherDates} onChange={event => { setShowOtherDates(event.target.checked); if (!event.target.checked) setSelectedOtherIds([]); }} />Also assign on other dates</label>
      {showOtherDates && <div className="rounded-lg border border-slate-200 p-2"><p className="text-xs font-semibold text-slate-700">Matching Calendar items in this period</p><button type="button" className={`min-h-9 text-xs font-semibold text-blue-700 ${focus}`} onClick={() => setSelectedOtherIds(otherItems.map(item => item.id))}>Select all</button><div className="max-h-48 space-y-1 overflow-y-auto">{otherItems.length ? otherItems.map(item => <label key={item.id} className="flex min-h-10 items-center gap-2 rounded-md px-1 text-xs hover:bg-slate-50"><input type="checkbox" checked={selectedOtherIds.includes(item.id)} onChange={event => setSelectedOtherIds(event.target.checked ? [...selectedOtherIds, item.id] : selectedOtherIds.filter(id => id !== item.id))} /><span>{readableDate(item.date)} · {item.title} · {item.startTime?.slice(0,5) ?? "All day"}{item.endTime ? `–${item.endTime.slice(0,5)}` : ""}</span></label>) : <p className="py-2 text-xs text-slate-600">No matching items are loaded in this Calendar period.</p>}</div></div>}
    </div>}
    <div className="mt-3"><p className="text-xs font-semibold text-slate-700">Ready volunteers · {selected.length} selected</p><div className="mt-1 max-h-48 space-y-1 overflow-y-auto">{readyVolunteers.map(volunteer => <label key={volunteer.id} className="flex min-h-10 items-center gap-2 rounded-md px-1 text-sm hover:bg-slate-50"><input type="checkbox" aria-label={`Select ${volunteer.displayName}`} checked={selected.some(value => value.id === volunteer.id)} disabled={selected.length >= 25 && !selected.some(value => value.id === volunteer.id)} onChange={event => toggleVolunteer(volunteer.id, event.target.checked)} />{volunteer.displayName}</label>)}</div></div>
    {selected.length > 0 && <p className="mt-1 break-words text-xs text-slate-600">Selected: {selectedNames}</p>}
    {selected.length > 0 && dates.length > 1 && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-blue-700">Adjust individual days (optional)</summary><div className="mt-2 space-y-2">{selected.map(volunteer => <fieldset key={volunteer.id} className="rounded-lg border border-slate-200 p-2"><legend className="px-1 text-xs font-semibold">{readyVolunteers.find(value => value.id === volunteer.id)?.displayName}</legend><div className="flex flex-wrap gap-2">{dates.map(date => <label key={date} className="flex min-h-9 items-center gap-1 text-xs"><input type="checkbox" checked={volunteer.excludeDates.includes(date)} onChange={event => toggleException(volunteer.id, date, event.target.checked)} />Skip {readableDate(date)}</label>)}</div></fieldset>)}</div></details>}
    {selected.length > 0 && <label className="mt-3 block text-xs font-semibold text-slate-700">Assignment note (optional)<textarea className={`mt-1 min-h-16 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal ${focus}`} maxLength={2000} value={note} onChange={event => setNote(event.target.value)} /></label>}
    <div aria-live="polite" className="mt-3 text-xs font-semibold text-slate-700">{selected.length === 0 ? `${create ? dates.length : selectedItems.length} ${create ? "Calendar items" : "selected items"} · Select volunteers to see assignments and conflicts. No email is sent.` : previewPending || !current ? "Checking assignments and conflicts…" : preview && counts ? `${preview.items.length} ${preview.items.length === 1 ? "item" : "items"} · ${selected.length} ${selected.length === 1 ? "volunteer" : "volunteers"} · ${counts.added} new ${counts.added === 1 ? "assignment" : "assignments"} · ${counts.existing} already assigned · ${counts.exceptions} skipped by day · No email` : null}</div>
    {current?.kind === "error" && <p role="alert" className="mt-2 text-xs text-rose-700">{current.message}</p>}
    {preview && counts && (preview.items.some(item => item.neededCount > 0 && item.assignedCount + selected.filter(volunteer => !volunteer.excludeDates.includes(item.date) && !preview.existingAssignments.some(existing => existing.itemId === item.id && existing.volunteerId === volunteer.id)).length > item.neededCount) || preview.sameDayWork.length > 0 || Boolean(preview.awayPeriods?.length)) && <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{preview.items.some(item => item.neededCount > 0 && item.assignedCount + selected.filter(volunteer => !volunteer.excludeDates.includes(item.date) && !preview.existingAssignments.some(existing => existing.itemId === item.id && existing.volunteerId === volunteer.id)).length > item.neededCount) && <p className="font-semibold text-amber-800">Selection exceeds a needed count on at least one day.</p>}{preview.sameDayWork.length > 0 && <p className="font-semibold text-amber-800">{preview.sameDayWork.length} other same-day assignments need review.</p>}{Boolean(preview.awayPeriods?.length) && <p className="font-semibold text-blue-800">{preview.awayPeriods?.length} away periods overlap. Adjust individual days if needed.</p>}</div>}
    {!create && <button type="button" className={`mt-3 min-h-10 w-full rounded-lg bg-[var(--pl-blue)] px-3 text-sm font-semibold text-white disabled:opacity-50 ${focus}`} disabled={!preview || !counts?.added || saving || previewPending} onClick={() => void save()}>{saving ? "Saving…" : "Save assignments"}</button>}
    {savedNotice !== null && <p role="status" className="mt-2 text-xs font-semibold text-emerald-800">Saved {savedNotice} {savedNotice === 1 ? "assignment" : "assignments"}. Existing responses were preserved. No email was sent.</p>}
  </section>;
});
