"use client";

import { createContext, useContext } from "react";
import type { CalendarMeal } from "@/lib/calendar/meals";

type Action = (formData: FormData) => void | Promise<void>;
export const CalendarOperations = createContext<{
  readOnly: boolean;
  saveMealAction?: Action;
  duplicateAction?: Action;
}>({ readOnly: false });
export const useCalendarOperations = () => useContext(CalendarOperations);
const inputClass = "mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";

export function MealForm({ date, view, item }: {
  date: string; view: string;
  item?: { id: string; updatedAt?: string; date: string; startTimeValue?: string; endTimeValue?: string; scheduleNotes?: string; meal?: CalendarMeal | null };
}) {
  const { saveMealAction, readOnly } = useCalendarOperations();
  if (readOnly || !saveMealAction) return null;
  return <form action={saveMealAction} className="space-y-3">
    <input type="hidden" name="calendarItemId" value={item?.id ?? ""} />
    <input type="hidden" name="expectedUpdatedAt" value={item?.updatedAt ?? ""} />
    <input type="hidden" name="redirectView" value={view} />
    <input type="hidden" name="redirectDate" value={date} />
    <label className="block text-sm font-semibold">Meal<select className={inputClass} name="mealKind" defaultValue={item?.meal?.kind ?? "breakfast"}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option></select></label>
    <label className="block text-sm font-semibold">Date<input className={inputClass} name="date" type="date" required defaultValue={item?.date ?? date} /></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="min-w-0 text-sm font-semibold">Start (optional)<input className={inputClass} name="startTime" type="time" defaultValue={item?.startTimeValue ?? ""} /></label>
      <label className="min-w-0 text-sm font-semibold">End (optional)<input className={inputClass} name="endTime" type="time" defaultValue={item?.endTimeValue ?? ""} /></label>
    </div>
    <label className="block text-sm font-semibold">Provider / congregation / group<input className={inputClass} name="provider" maxLength={300} defaultValue={item?.meal?.provider ?? ""} /></label>
    <label className="block text-sm font-semibold">Contact person<input className={inputClass} name="contact" maxLength={500} defaultValue={item?.meal?.contact ?? ""} /></label>
    <label className="block text-sm font-semibold">Menu<textarea className={inputClass} name="menu" maxLength={2000} defaultValue={item?.meal?.menu ?? ""} /></label>
    <label className="block text-sm font-semibold">Meal total<input className={inputClass} name="total" type="number" min={0} max={100000} step={1} defaultValue={item?.meal?.total ?? ""} /></label>
    <label className="block text-sm font-semibold">Schedule notes<textarea className={inputClass} name="notes" maxLength={4000} defaultValue={item?.scheduleNotes ?? ""} /></label>
    <button type="submit" className="min-h-11 w-full rounded-lg bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white">Save meal</button>
  </form>;
}

export function DuplicateItem({ item, date, view }: { item: { id: string; allDay?: boolean; startTimeValue?: string; endTimeValue?: string; meal?: CalendarMeal | null }; date: string; view: string }) {
  const { readOnly, duplicateAction } = useCalendarOperations();
  if (readOnly || !duplicateAction) return null;
  return <details className="order-3 mt-4 border-t border-slate-200 pt-4">
    <summary className="min-h-11 cursor-pointer font-semibold text-[var(--pl-blue)]">Duplicate</summary>
    <form action={duplicateAction} className="space-y-3 pb-3">
      <p className="text-sm text-slate-500">{item.meal ? "Creates an independent meal, visible when saved, with no assigned volunteers." : "Creates an independent private draft with no assigned volunteers."}</p>
      <input type="hidden" name="calendarItemId" value={item.id} />
      <input type="hidden" name="redirectView" value={view} />
      <input type="hidden" name="redirectDate" value={date} />
      <label className="block text-sm font-semibold">Target date<input className={inputClass} name="targetDate" type="date" required defaultValue={date} /></label>
      {!item.allDay ? <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 text-sm font-semibold">Start<input className={inputClass} name="startTime" type="time" required defaultValue={item.startTimeValue} /></label>
        <label className="min-w-0 text-sm font-semibold">End<input className={inputClass} name="endTime" type="time" required defaultValue={item.endTimeValue} /></label>
      </div> : null}
      <button type="submit" className="min-h-11 rounded-lg bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white">Create duplicate</button>
    </form>
  </details>;
}
