"use client";

import { shiftCalendarDate, type TimedEndMode, type TimedEndState } from "@/lib/calendar/timedEndChoice";

function displayTime(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value || "End time";
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}

export function CalendarTimedEndChoice({
  value,
  onModeChange,
  onLaterDateChange,
}: {
  value: TimedEndState;
  onModeChange: (mode: TimedEndMode) => void;
  onLaterDateChange: (date: string) => void;
}) {
  const selected = value.endDayMode === "automatic"
    ? value.endDate === value.date ? "sameDay" : "nextDay"
    : value.endDayMode;
  const dayLabel = selected === "sameDay"
    ? "Same day"
    : selected === "nextDay"
      ? "Next day"
      : value.endDate || "Choose a later date";

  return (
    <div className="min-w-0 sm:col-span-2">
      <p className="text-sm font-semibold text-slate-700">End day</p>
      <div aria-label="End day" className="mt-2 grid grid-cols-3 gap-1.5" role="group">
        {([
          ["sameDay", "Same day"],
          ["nextDay", "Next day"],
          ["laterDate", "Later date"],
        ] as const).map(([mode, label]) => (
          <button
            aria-pressed={selected === mode}
            className={`min-h-10 min-w-0 rounded-lg border px-1.5 text-xs font-semibold transition ${selected === mode ? "border-[var(--pl-blue)] bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            key={mode}
            onClick={() => onModeChange(mode)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {selected === "laterDate" ? (
        <label className="mt-2 block">
          <span className="text-xs font-semibold text-slate-600">Specific end date</span>
          <input
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
            min={shiftCalendarDate(value.date, 1)}
            onChange={(event) => onLaterDateChange(event.target.value)}
            type="date"
            value={value.endDate}
          />
        </label>
      ) : null}
      <p aria-live="polite" className="mt-1.5 text-xs font-medium text-slate-600">
        {displayTime(value.endTime)} · {dayLabel}
      </p>
    </div>
  );
}
