"use client";

import {
  CalendarDays,
  Clock,
  Copy,
  Pencil,
  Plus,
  Repeat,
  Soup,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  demoProjectId,
  deriveCalendarWeekRange,
  getCalendarCategoryLabel,
  getCalendarCompactDayLabel,
  getCalendarFilledLabel,
  getCalendarItemDisplayName,
  getCalendarItemTimeWindow,
  getCalendarItemsByWeek,
  getCalendarStatusLabel,
  getCalendarStatusTone,
  getCalendarSummaryCounts,
  groupCalendarItemsByDay,
  isLunchCalendarItem,
  isOneOffCalendarItem,
} from "@/lib/mockData";
import type {
  CalendarItem,
  CalendarItemWithPreset,
  CalendarStatusTone,
  TaskPresetCategory,
} from "@/lib/mockData";

type CalendarFilter = "all" | TaskPresetCategory;

const filters: Array<{ id: CalendarFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "lunch", label: "Lunch" },
  { id: "security", label: "Security" },
  { id: "construction", label: "Construction" },
  { id: "cleanup", label: "Cleanup" },
  { id: "custom", label: "Custom" },
];

const categoryStyles: Record<TaskPresetCategory, string> = {
  general: "border-slate-200 bg-slate-50 text-slate-700",
  lunch: "border-emerald-200 bg-emerald-50 text-emerald-700",
  security: "border-sky-200 bg-sky-50 text-sky-700",
  cleanup: "border-amber-200 bg-amber-50 text-amber-700",
  construction: "border-violet-200 bg-violet-50 text-violet-700",
  custom: "border-rose-200 bg-rose-50 text-rose-700",
};

const blockStyles: Record<TaskPresetCategory, string> = {
  general: "border-l-slate-400 bg-slate-50/92",
  lunch: "border-l-emerald-500 bg-emerald-50/92",
  security: "border-l-sky-500 bg-sky-50/92",
  cleanup: "border-l-amber-500 bg-amber-50/92",
  construction: "border-l-violet-500 bg-violet-50/92",
  custom: "border-l-rose-500 bg-rose-50/92",
};

const toneStyles: Record<CalendarStatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  attention: "border-rose-200 bg-rose-50 text-rose-700",
};

function SummaryStrip({ items }: { items: CalendarItem[] }) {
  const counts = getCalendarSummaryCounts(items);
  const summary = [
    { label: "Scheduled", value: counts.scheduledItems, helper: "Calendar items" },
    { label: "Open spots", value: counts.openNeeds, helper: "Helpers still needed" },
    { label: "Filled", value: counts.filledItems, helper: "Covered items" },
    { label: "Lunch", value: counts.lunchItems, helper: "Menu-aware items" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summary.map((item) => (
        <div
          className="rounded-lg border border-white/72 bg-white/58 px-4 py-3"
          key={item.label}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">{item.label}</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {item.value}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
        </div>
      ))}
    </section>
  );
}

function ViewToggle() {
  return (
    <div className="inline-flex w-full rounded-full border border-white/80 bg-white/60 p-1 text-sm font-semibold text-slate-500 sm:w-auto">
      {["Day", "Week", "Month"].map((label) => (
        <button
          className={[
            "min-h-10 flex-1 rounded-full px-4 transition sm:flex-none",
            label === "Week" ? "bg-slate-950 text-white shadow-sm" : "hover:bg-white/70",
          ].join(" ")}
          key={label}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FilterChips({
  activeFilter,
  onChange,
}: {
  activeFilter: CalendarFilter;
  onChange: (filter: CalendarFilter) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {filters.map((filter) => (
        <button
          className={[
            "min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition",
            activeFilter === filter.id
              ? "border-slate-900 bg-slate-950 text-white"
              : "border-white/80 bg-white/62 text-slate-600 hover:bg-white",
          ].join(" ")}
          key={filter.id}
          onClick={() => onChange(filter.id)}
          type="button"
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function CalendarBlock({
  item,
  isSelected,
  onSelect,
}: {
  item: CalendarItemWithPreset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const tone = getCalendarStatusTone(item.status);

  return (
    <button
      className={[
        "w-full rounded-lg border border-white/80 border-l-4 px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white",
        blockStyles[item.category],
        isSelected ? "ring-2 ring-slate-900/20" : "",
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold leading-5 text-slate-950">
          {getCalendarItemDisplayName(item)}
        </p>
        <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-slate-700">
          {getCalendarFilledLabel(item)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{getCalendarItemTimeWindow(item)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${categoryStyles[item.category]}`}
        >
          {getCalendarCategoryLabel(item.category)}
        </span>
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${toneStyles[tone]}`}
        >
          {getCalendarStatusLabel(item.status)}
        </span>
      </div>
      {isLunchCalendarItem(item) && item.menuSummary ? (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-emerald-800">
          Menu: {item.menuSummary}
        </p>
      ) : null}
    </button>
  );
}

function WeekGrid({
  items,
  selectedId,
  onSelect,
}: {
  items: CalendarItem[];
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
}) {
  const groups = groupCalendarItemsByDay(items);

  return (
    <GlassCard className="hidden overflow-hidden lg:block">
      <div className="grid grid-cols-7 border-b border-white/72 bg-white/44">
        {groups.map((group) => (
          <div className="border-r border-white/72 px-3 py-3 last:border-r-0" key={group.date}>
            <p className="text-sm font-semibold text-slate-950">
              {getCalendarCompactDayLabel(group.date)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {group.items.length} item{group.items.length === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
      <div className="grid min-h-[520px] grid-cols-7">
        {groups.map((group) => (
          <div
            className="min-w-0 border-r border-white/72 bg-white/24 p-2 last:border-r-0"
            key={group.date}
          >
            <div className="space-y-2">
              {group.items.map((item) => (
                <CalendarBlock
                  isSelected={selectedId === item.id}
                  item={item}
                  key={item.id}
                  onSelect={() => onSelect(item)}
                />
              ))}
              {group.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/80 px-3 py-6 text-center text-xs font-medium text-slate-400">
                  Open day
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function MobileDayGroups({
  items,
  selectedId,
  onSelect,
}: {
  items: CalendarItem[];
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
}) {
  const groups = groupCalendarItemsByDay(items);

  return (
    <div className="space-y-3 lg:hidden">
      {groups.map((group) => (
        <section
          className="rounded-xl border border-white/72 bg-white/42 p-3"
          key={group.date}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">
              {getCalendarCompactDayLabel(group.date)}
            </h2>
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-500">
              {group.items.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {group.items.length > 0 ? (
              group.items.map((item) => (
                <CalendarBlock
                  isSelected={selectedId === item.id}
                  item={item}
                  key={item.id}
                  onSelect={() => onSelect(item)}
                />
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-white/80 px-3 py-5 text-center text-sm font-medium text-slate-400">
                No scheduled items
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function DetailPanel({ item }: { item?: CalendarItemWithPreset }) {
  if (!item) {
    return (
      <GlassCard className="p-4 sm:p-5">
        <p className="text-sm leading-6 text-slate-600">
          Select a calendar item to review the scheduled instance. Task preset
          editing stays on the Tasks page.
        </p>
      </GlassCard>
    );
  }

  const volunteers =
    item.assignedVolunteers.length > 0
      ? item.assignedVolunteers.map((volunteer) => volunteer.name).join(", ")
      : "No helpers assigned in this mock item";

  const placeholderActions = [
    { label: "Add to calendar", icon: Plus },
    { label: "Edit placement", icon: Pencil },
    { label: "Assign helpers later", icon: UserPlus },
    { label: "Repeat later", icon: Repeat },
    { label: "Copy later", icon: Copy },
  ];

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Selected item
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {getCalendarItemDisplayName(item)}
          </h2>
        </div>
        <span
          className={`inline-flex min-h-8 w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${categoryStyles[item.category]}`}
        >
          {getCalendarCategoryLabel(item.category)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/70 bg-white/52 px-3 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            Time
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {getCalendarItemTimeWindow(item)}
          </p>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/52 px-3 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            Filled
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {getCalendarFilledLabel(item)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/70 bg-white/52 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Helpers
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">{volunteers}</p>
      </div>

      {isLunchCalendarItem(item) ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-800">
          <div className="flex items-center gap-2 font-semibold">
            <Soup aria-hidden="true" className="h-4 w-4" />
            Lunch menu-aware item
          </div>
          <p className="mt-1">
            {item.menuSummary ?? "Menu can appear here when the scheduled lunch has one."}
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-700">
            Later this can feed a volunteer-facing lunch schedule/menu view.
          </p>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-white/70 bg-white/52 px-3 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Schedule notes
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {item.scheduleNotes ?? "No schedule-specific notes."}
        </p>
      </div>

      <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500">
        <span>
          Source:{" "}
          {isOneOffCalendarItem(item)
            ? "One-off custom task, no reusable preset"
            : item.taskPreset?.name ?? "Preset reference missing"}
        </span>
        {item.repeatLabel ? <span>Repeat metadata: {item.repeatLabel}</span> : null}
        {item.copyLabel ? <span>Copy metadata: {item.copyLabel}</span> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {placeholderActions.map(({ label, icon: Icon }) => (
          <button
            className="inline-flex min-h-10 cursor-not-allowed items-center gap-1.5 rounded-full border border-slate-200 bg-white/72 px-3 text-sm font-semibold text-slate-500 opacity-75"
            disabled
            key={label}
            type="button"
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

export default function AdminCalendarPage() {
  const allItems = getCalendarItemsByWeek("2026-01-12", demoProjectId);
  const weekRange = deriveCalendarWeekRange("2026-01-12");
  const [activeFilter, setActiveFilter] = useState<CalendarFilter>("all");
  const [selectedId, setSelectedId] = useState(allItems[0]?.id);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") {
      return allItems;
    }

    return allItems.filter((item) => item.category === activeFilter);
  }, [activeFilter, allItems]);

  const groupedItems = groupCalendarItemsByDay(filteredItems, weekRange.start).flatMap(
    (group) => group.items,
  );
  const selectedItem =
    groupedItems.find((item) => item.id === selectedId) ?? groupedItems[0];

  return (
    <AdminShell active="calendar">
      <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
              Belgrade Remodel
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Calendar
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Calendar is where task presets become scheduled work with dates,
              times, helpers, filled counts, and schedule notes.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Preview only. This page does not save changes, create calendar
              items, assign helpers, or edit task presets.
            </p>
          </div>
          <ViewToggle />
        </div>
      </header>

      <section className="mt-6 space-y-4">
        {allItems.length > 0 ? (
          <>
            <SummaryStrip items={filteredItems} />

            <GlassCard className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Project week
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {weekRange.label}
                  </h2>
                </div>
                <FilterChips activeFilter={activeFilter} onChange={setActiveFilter} />
              </div>
            </GlassCard>

            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <div className="min-w-0">
                <WeekGrid
                  items={filteredItems}
                  onSelect={(item) => setSelectedId(item.id)}
                  selectedId={selectedItem?.id}
                />
                <MobileDayGroups
                  items={filteredItems}
                  onSelect={(item) => setSelectedId(item.id)}
                  selectedId={selectedItem?.id}
                />
              </div>
              <div className="min-w-0">
                <DetailPanel item={selectedItem} />
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No calendar items yet"
            message="Scheduled task instances for the active project week will appear here."
          />
        )}
      </section>
    </AdminShell>
  );
}
