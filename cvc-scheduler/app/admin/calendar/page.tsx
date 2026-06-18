"use client";

import {
  CalendarDays,
  Check,
  Clock,
  Copy,
  Pencil,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  Soup,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  demoProjectId,
  deriveCalendarWeekRange,
  enrichCalendarItem,
  filterCalendarItems,
  getCalendarActiveFilterCount,
  getCalendarActiveFilterSummary,
  getCalendarCategoryLabel,
  getCalendarCompactDayLabel,
  getCalendarCoverageFilterStateLabel,
  getCalendarFilledLabel,
  getCalendarHighLevelTaskType,
  getCalendarHighLevelTaskTypeLabel,
  getCalendarItemDisplayName,
  getCalendarItemTimeWindow,
  getCalendarItemsByWeek,
  getCalendarStatusLabel,
  getCalendarStatusTone,
  getCalendarSummaryCounts,
  getTaskPresetsForActiveWorkspace,
  groupCalendarItemsByDay,
  isLunchCalendarItem,
  isOneOffCalendarItem,
} from "@/lib/mockData";
import type {
  CalendarItem,
  CalendarItemWithPreset,
  CalendarCoverageFilterState,
  CalendarFilterOptions,
  CalendarHighLevelTaskType,
  CalendarStatusTone,
  TaskPreset,
  TaskPresetCategory,
} from "@/lib/mockData";

type CalendarViewMode = "day" | "week" | "month";
type CalendarSurface = "none" | "filter" | "more" | "create" | "inspect";
type CreationMode = "preset" | "oneOff";
const closeMobileNavigationEvent = "cvc:close-admin-mobile-navigation";

type CreationSlot = {
  date: string;
  label: string;
  timeWindow: string;
};

type CreationDraft = {
  slot: CreationSlot;
  mode: CreationMode;
  presetId: string;
  neededCount: number;
  notes: string;
  customName: string;
  customTaskType: CalendarHighLevelTaskType;
};

const viewModes: Array<{ id: CalendarViewMode; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const taskTypeOptions: CalendarHighLevelTaskType[] = [
  "generalVolunteers",
  "food",
  "security",
];

const coverageOptions: CalendarCoverageFilterState[] = [
  "unfilled",
  "filled",
  "waitingConfirmations",
  "allConfirmed",
  "someDenied",
];

const preferredCreationPresetIds = [
  "task-belgrade-lunch",
  "task-belgrade-night-watch",
  "task-belgrade-gate-attendant",
  "task-belgrade-drywall-crew",
  "task-belgrade-cleanup-help",
  "task-belgrade-water-coffee",
  "task-belgrade-morning-unlock",
  "task-belgrade-custom-special",
];

const suggestedSlots = {
  morning: "8:00 AM - 11:00 AM",
  afternoon: "1:00 PM - 3:30 PM",
  evening: "6:30 PM - 8:30 PM",
};

const categoryStyles: Record<TaskPresetCategory, string> = {
  general: "border-slate-200 bg-slate-50 text-slate-700",
  lunch: "border-emerald-200 bg-emerald-50 text-emerald-700",
  security: "border-sky-200 bg-sky-50 text-sky-700",
  cleanup: "border-amber-200 bg-amber-50 text-amber-700",
  construction: "border-violet-200 bg-violet-50 text-violet-700",
  custom: "border-rose-200 bg-rose-50 text-rose-700",
};

const blockStyles: Record<TaskPresetCategory, string> = {
  general: "border-l-slate-400 bg-slate-50/88",
  lunch: "border-l-emerald-500 bg-emerald-50/88",
  security: "border-l-sky-500 bg-sky-50/88",
  cleanup: "border-l-amber-500 bg-amber-50/88",
  construction: "border-l-violet-500 bg-violet-50/88",
  custom: "border-l-rose-500 bg-rose-50/88",
};

const detailAccentStyles: Record<TaskPresetCategory, string> = {
  general: "border-l-slate-400",
  lunch: "border-l-emerald-500",
  security: "border-l-sky-500",
  cleanup: "border-l-amber-500",
  construction: "border-l-violet-500",
  custom: "border-l-rose-500",
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

function ViewToggle({
  activeView,
  onChange,
}: {
  activeView: CalendarViewMode;
  onChange: (view: CalendarViewMode) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-full border border-white/80 bg-white/60 p-1 text-sm font-semibold text-slate-500 sm:w-auto">
      {viewModes.map((view) => (
        <button
          className={[
            "min-h-10 flex-1 rounded-full px-4 transition sm:flex-none",
            activeView === view.id
              ? "bg-slate-950 text-white shadow-sm"
              : "hover:bg-white/70",
          ].join(" ")}
          key={view.id}
          onClick={() => onChange(view.id)}
          type="button"
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

function CalendarWorkspaceHeader({
  activeFilterCount,
  activeFilterSummary,
  activeView,
  filteredItemCount,
  onFilterOpen,
  onViewChange,
  weekLabel,
}: {
  activeFilterCount: number;
  activeFilterSummary: string;
  activeView: CalendarViewMode;
  filteredItemCount: number;
  onFilterOpen: () => void;
  onViewChange: (view: CalendarViewMode) => void;
  weekLabel: string;
}) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
            Calendar workspace
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {weekLabel}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {filteredItemCount} visible item{filteredItemCount === 1 ? "" : "s"} -{" "}
            {activeFilterSummary}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ViewToggle activeView={activeView} onChange={onViewChange} />
          <button
            aria-label="Open calendar filters"
            className={[
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
              activeFilterCount > 0
                ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                : "border-white/80 bg-white/70 text-slate-700 hover:bg-white",
            ].join(" ")}
            onClick={onFilterOpen}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-white/18 px-2 py-0.5 text-xs">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function FilterToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition",
        active
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white/72 text-slate-600 hover:bg-white hover:text-slate-950",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {active ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
      {label}
    </button>
  );
}

function CalendarFilterPanel({
  filters,
  isOpen,
  onChange,
  onClear,
  onClose,
}: {
  filters: CalendarFilterOptions;
  isOpen: boolean;
  onChange: (filters: CalendarFilterOptions) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const activeFilterCount = getCalendarActiveFilterCount(filters);

  const toggleTaskType = (taskType: CalendarHighLevelTaskType) => {
    const taskTypes = filters.taskTypes ?? [];
    const nextTaskTypes = taskTypes.includes(taskType)
      ? taskTypes.filter((value) => value !== taskType)
      : [...taskTypes, taskType];

    onChange({ ...filters, taskTypes: nextTaskTypes });
  };

  const toggleCoverage = (state: CalendarCoverageFilterState) => {
    const coverageStates = filters.coverageStates ?? [];
    const nextCoverageStates = coverageStates.includes(state)
      ? coverageStates.filter((value) => value !== state)
      : [...coverageStates, state];

    onChange({ ...filters, coverageStates: nextCoverageStates });
  };

  return (
    <div
      className={[
        "fixed inset-0 z-[60] transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <button
        aria-label="Close calendar filters backdrop"
        className={[
          "absolute inset-0 bg-slate-950/16 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
        type="button"
      />

      <aside
        aria-label="Calendar filters"
        className={[
          "absolute right-0 top-0 hidden h-full w-[min(400px,calc(100vw-28px))] px-3 py-3 transition-transform duration-200 ease-out lg:block",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <GlassCard className="flex h-full flex-col overflow-hidden rounded-2xl p-0 shadow-[0_24px_90px_rgba(15,23,42,0.22)]">
          <FilterPanelContent
            activeFilterCount={activeFilterCount}
            filters={filters}
            onChange={onChange}
            onClear={onClear}
            onClose={onClose}
            toggleCoverage={toggleCoverage}
            toggleTaskType={toggleTaskType}
          />
        </GlassCard>
      </aside>

      <div className="absolute inset-x-0 bottom-0 px-3 pb-3 lg:hidden">
        <section
          aria-label="Calendar filters"
          className={[
            "relative max-h-[82vh] overflow-hidden rounded-t-3xl border border-white/72 bg-white/94 shadow-[0_-20px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl transition-transform duration-200 ease-out",
            isOpen ? "translate-y-0" : "translate-y-[calc(100%+48px)]",
          ].join(" ")}
        >
          <FilterPanelContent
            activeFilterCount={activeFilterCount}
            filters={filters}
            onChange={onChange}
            onClear={onClear}
            onClose={onClose}
            toggleCoverage={toggleCoverage}
            toggleTaskType={toggleTaskType}
          />
        </section>
      </div>
    </div>
  );
}

function FilterPanelContent({
  activeFilterCount,
  filters,
  onChange,
  onClear,
  onClose,
  toggleCoverage,
  toggleTaskType,
}: {
  activeFilterCount: number;
  filters: CalendarFilterOptions;
  onChange: (filters: CalendarFilterOptions) => void;
  onClear: () => void;
  onClose: () => void;
  toggleCoverage: (state: CalendarCoverageFilterState) => void;
  toggleTaskType: (taskType: CalendarHighLevelTaskType) => void;
}) {
  return (
    <>
      <div className="shrink-0 border-b border-slate-200/70 px-4 py-4 sm:px-5">
        <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Calendar filters
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Find scheduled work
            </h2>
          </div>
          <button
            aria-label="Close calendar filters"
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-white hover:text-slate-950"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Task name</span>
          <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/72 px-3">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              onChange={(event) => onChange({ ...filters, search: event.target.value })}
              placeholder="Search Lunch, drywall, night watch..."
              type="search"
              value={filters.search ?? ""}
            />
          </span>
        </label>

        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-700">Coverage</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {coverageOptions.map((state) => (
              <FilterToggleButton
                active={(filters.coverageStates ?? []).includes(state)}
                key={state}
                label={getCalendarCoverageFilterStateLabel(state)}
                onClick={() => toggleCoverage(state)}
              />
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-700">Task type</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Construction, cleanup, gate, drywall, concrete, signage, and similar work
            roll up under General Volunteers.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {taskTypeOptions.map((taskType) => (
              <FilterToggleButton
                active={(filters.taskTypes ?? []).includes(taskType)}
                key={taskType}
                label={getCalendarHighLevelTaskTypeLabel(taskType)}
                onClick={() => toggleTaskType(taskType)}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Preview only
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            These filters are local mock UI. They do not save preferences or change
            any scheduling data.
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/70 px-4 py-4 sm:px-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className="min-h-11 rounded-full border border-slate-200 bg-white/78 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
            onClick={onClear}
            type="button"
          >
            Clear filters
          </button>
          <button
            className="min-h-11 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm"
            onClick={onClose}
            type="button"
          >
            Show results{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>
      </div>
    </>
  );
}

function ActiveFilterBar({
  filters,
  onClear,
}: {
  filters: CalendarFilterOptions;
  onClear: () => void;
}) {
  const activeFilterCount = getCalendarActiveFilterCount(filters);

  if (activeFilterCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/72 bg-white/48 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-700">
        {getCalendarActiveFilterSummary(filters)}
      </p>
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/80 bg-white/72 px-4 text-sm font-semibold text-slate-600 transition hover:bg-white"
        onClick={onClear}
        type="button"
      >
        Reset
      </button>
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
  const taskType = getCalendarHighLevelTaskType(item);

  return (
    <button
      className={[
        "min-h-[112px] w-full rounded-lg border border-white/80 border-l-4 px-3.5 py-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white",
        blockStyles[item.category],
        isSelected ? "bg-white ring-2 ring-slate-900/20 shadow-md" : "",
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="line-clamp-2 min-w-0 text-[15px] font-semibold leading-5 text-slate-950">
          {getCalendarItemDisplayName(item)}
        </p>
        <span className="shrink-0 rounded-full bg-white/88 px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm">
          {getCalendarFilledLabel(item)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="truncate">{getCalendarItemTimeWindow(item)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${categoryStyles[item.category]}`}
        >
          {getCalendarHighLevelTaskTypeLabel(taskType)}
        </span>
        <span
          className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${toneStyles[tone]}`}
        >
          {getCalendarStatusLabel(item.status)}
        </span>
      </div>
    </button>
  );
}

function WeekGrid({
  items,
  onCreateFromSlot,
  selectedId,
  onSelect,
}: {
  items: CalendarItem[];
  onCreateFromSlot: (slot: CreationSlot) => void;
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
}) {
  const groups = groupCalendarItemsByDay(items);

  return (
    <GlassCard className="hidden overflow-x-auto lg:block">
      <div className="grid min-w-[900px] grid-cols-7 border-b border-white/72 bg-white/44">
        {groups.map((group) => (
          <div className="border-r border-white/72 px-4 py-3.5 last:border-r-0" key={group.date}>
            <p className="text-sm font-semibold text-slate-950">{group.dayLabel}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {group.items.length} item{group.items.length === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
      <div className="grid min-h-[540px] min-w-[900px] grid-cols-7">
        {groups.map((group) => (
          <div
            className="min-w-0 border-r border-white/72 bg-white/22 p-3 last:border-r-0"
            key={group.date}
          >
            <div className="space-y-2.5">
              {group.items.map((item) => (
                <CalendarBlock
                  isSelected={selectedId === item.id}
                  item={item}
                  key={item.id}
                  onSelect={() => onSelect(item)}
                />
              ))}
              {group.items.length === 0 ? (
                <EmptySlotAffordance
                  label="Add scheduled task"
                  onSelect={() =>
                    onCreateFromSlot({
                      date: group.date,
                      label: `${group.dayLabel} morning`,
                      timeWindow: suggestedSlots.morning,
                    })
                  }
                />
              ) : null}
              {group.items.length > 0 ? (
                <EmptySlotAffordance
                  compact
                  label="Add scheduled task"
                  onSelect={() =>
                    onCreateFromSlot({
                      date: group.date,
                      label: `${group.dayLabel} afternoon`,
                      timeWindow: suggestedSlots.afternoon,
                    })
                  }
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function EmptySlotAffordance({
  compact,
  label,
  onSelect,
}: {
  compact?: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      className={[
        "group w-full rounded-lg border border-dashed border-slate-200/80 bg-white/28 px-3 text-left text-xs font-semibold text-slate-400 transition hover:border-slate-300 hover:bg-white/54 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-900/15",
        compact ? "min-h-12 py-2.5" : "min-h-16 py-3",
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      <span className="inline-flex items-center gap-1.5">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </span>
      {!compact ? (
        <span className="mt-1 block font-medium leading-5 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
          Choose preset, time, count, notes, and helpers later.
        </span>
      ) : null}
    </button>
  );
}

function DayView({
  date,
  items,
  onCreateFromSlot,
  selectedId,
  onSelect,
}: {
  date: string;
  items: CalendarItem[];
  onCreateFromSlot: (slot: CreationSlot) => void;
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
}) {
  const dayItems = items.filter((item) => item.date === date).map(enrichCalendarItem);

  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-white/72 bg-white/44 px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
          Day preview
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          {getCalendarCompactDayLabel(date)}
        </h2>
      </div>
      <div className="grid gap-0 lg:grid-cols-[96px_1fr]">
        {["7 AM", "9 AM", "11 AM", "1 PM", "3 PM", "5 PM", "7 PM"].map((time, index) => (
          <div className="contents" key={time}>
            <div className="hidden border-b border-white/72 bg-white/26 px-4 py-5 text-xs font-semibold text-slate-400 lg:block">
              {time}
            </div>
            <div className="border-b border-white/72 bg-white/16 p-3">
              {index === 1 ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  {dayItems.map((item) => (
                    <CalendarBlock
                      isSelected={selectedId === item.id}
                      item={item}
                      key={item.id}
                      onSelect={() => onSelect(item)}
                    />
                  ))}
                  {dayItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/80 px-3 py-5 text-center text-sm font-medium text-slate-400">
                      No scheduled items for this mock day
                    </p>
                  ) : null}
                </div>
              ) : (
                <EmptySlotAffordance
                  label={`Add scheduled task near ${time}`}
                  onSelect={() =>
                    onCreateFromSlot({
                      date,
                      label: `${getCalendarCompactDayLabel(date)} near ${time}`,
                      timeWindow:
                        index >= 5
                          ? suggestedSlots.evening
                          : index >= 3
                            ? suggestedSlots.afternoon
                            : suggestedSlots.morning,
                    })
                  }
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function deriveMockMonthDates(referenceDate: string) {
  const reference = new Date(`${referenceDate}T00:00:00`);
  const firstOfMonth = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function MonthView({
  items,
  onCreateFromSlot,
  selectedId,
  onSelect,
  referenceDate,
}: {
  items: CalendarItem[];
  onCreateFromSlot: (slot: CreationSlot) => void;
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
  referenceDate: string;
}) {
  const dates = deriveMockMonthDates(referenceDate);
  const reference = new Date(`${referenceDate}T00:00:00`);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(reference);

  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-white/72 bg-white/44 px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
          Month preview
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          {monthLabel}
        </h2>
      </div>
      <div className="grid grid-cols-7 border-b border-white/72 bg-white/40">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div className="px-2 py-2 text-center text-xs font-semibold text-slate-500" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const dateItems = items.filter((item) => item.date === date).map(enrichCalendarItem);
          const inMonth = new Date(`${date}T00:00:00`).getMonth() === reference.getMonth();

          return (
            <div
              className={[
                "min-h-28 border-r border-b border-white/72 p-2 last:border-r-0",
                inMonth ? "bg-white/18" : "bg-white/8 opacity-45",
              ].join(" ")}
              key={date}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  {Number(date.slice(-2))}
                </span>
                {dateItems.length > 0 ? (
                  <span className="rounded-full bg-white/74 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {dateItems.length}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 space-y-1.5">
                {dateItems.slice(0, 2).map((item) => (
                  <button
                    className={[
                      "w-full truncate rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold transition hover:bg-white",
                      categoryStyles[item.category],
                      selectedId === item.id ? "ring-2 ring-slate-900/20" : "",
                    ].join(" ")}
                    key={item.id}
                    onClick={() => onSelect(item)}
                    type="button"
                  >
                    {getCalendarItemDisplayName(item)} - {getCalendarFilledLabel(item)}
                  </button>
                ))}
                {dateItems.length > 2 ? (
                  <p className="text-[11px] font-semibold text-slate-400">
                    +{dateItems.length - 2} more
                  </p>
                ) : null}
                {dateItems.length === 0 && inMonth ? (
                  <button
                    className="block min-h-10 w-full rounded-md border border-dashed border-white/80 py-2 text-center text-[11px] font-semibold text-slate-300 transition hover:bg-white/56 hover:text-slate-500"
                    onClick={() =>
                      onCreateFromSlot({
                        date,
                        label: `${getCalendarCompactDayLabel(date)} morning`,
                        timeWindow: suggestedSlots.morning,
                      })
                    }
                    type="button"
                  >
                    Add
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function MobileDayGroups({
  items,
  onCreateFromSlot,
  selectedId,
  onSelect,
}: {
  items: CalendarItem[];
  onCreateFromSlot: (slot: CreationSlot) => void;
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
}) {
  const groups = groupCalendarItemsByDay(items);

  return (
    <div className="space-y-4 lg:hidden">
      {groups.map((group) => (
        <section
          className="rounded-xl border border-white/72 bg-white/46 p-3.5"
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
          <div className="mt-3 space-y-2.5">
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
            <EmptySlotAffordance
              compact={group.items.length > 0}
              label="Add scheduled task"
              onSelect={() =>
                onCreateFromSlot({
                  date: group.date,
                  label: `${getCalendarCompactDayLabel(group.date)} afternoon`,
                  timeWindow: suggestedSlots.afternoon,
                })
              }
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function CalendarCreatePanel({
  creationDraft,
  isOpen,
  onClose,
  onDraftChange,
  presets,
}: {
  creationDraft?: CreationDraft;
  isOpen: boolean;
  onClose: () => void;
  onDraftChange: (draft: CreationDraft) => void;
  presets: TaskPreset[];
}) {
  if (!creationDraft) {
    return null;
  }

  const selectedPreset = presets.find((preset) => preset.id === creationDraft.presetId);
  const selectedTaskType =
    creationDraft.mode === "oneOff"
      ? creationDraft.customTaskType
      : selectedPreset
        ? getCalendarHighLevelTaskType({
            id: "preview",
            projectId: selectedPreset.projectId,
            taskPresetId: selectedPreset.id,
            date: creationDraft.slot.date,
            category: selectedPreset.category,
            assignedVolunteerIds: [],
            filledCount: 0,
            neededCount: selectedPreset.neededCount,
            status: "draftMock",
          })
        : "generalVolunteers";

  const updateDraft = (changes: Partial<CreationDraft>) => {
    onDraftChange({ ...creationDraft, ...changes });
  };

  const handlePresetChange = (presetId: string) => {
    const preset = presets.find((option) => option.id === presetId);
    updateDraft({
      presetId,
      mode: "preset",
      neededCount: preset?.neededCount ?? creationDraft.neededCount,
    });
  };

  return (
    <div
      className={[
        "fixed inset-0 z-[55] transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <button
        aria-label="Close scheduled task creator backdrop"
        className={[
          "absolute inset-0 bg-slate-950/14 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
        type="button"
      />

      <aside
        aria-label="New scheduled task"
        className={[
          "absolute right-0 top-0 hidden h-full w-[min(440px,calc(100vw-28px))] px-3 py-3 transition-transform duration-200 ease-out lg:block",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <GlassCard className="flex h-full flex-col overflow-hidden rounded-2xl p-0 shadow-[0_24px_90px_rgba(15,23,42,0.22)]">
          <CreatePanelContent
            creationDraft={creationDraft}
            onClose={onClose}
            onPresetChange={handlePresetChange}
            onUpdate={updateDraft}
            presets={presets}
            selectedPreset={selectedPreset}
            selectedTaskType={selectedTaskType}
          />
        </GlassCard>
      </aside>

      <div className="absolute inset-x-0 bottom-0 px-3 pb-3 lg:hidden">
        <section
          aria-label="New scheduled task"
          className={[
            "relative max-h-[84vh] overflow-hidden rounded-t-3xl border border-white/72 bg-white/94 shadow-[0_-20px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl transition-transform duration-200 ease-out",
            isOpen ? "translate-y-0" : "translate-y-[calc(100%+48px)]",
          ].join(" ")}
        >
          <CreatePanelContent
            creationDraft={creationDraft}
            onClose={onClose}
            onPresetChange={handlePresetChange}
            onUpdate={updateDraft}
            presets={presets}
            selectedPreset={selectedPreset}
            selectedTaskType={selectedTaskType}
          />
        </section>
      </div>
    </div>
  );
}

function CreatePanelContent({
  creationDraft,
  onClose,
  onPresetChange,
  onUpdate,
  presets,
  selectedPreset,
  selectedTaskType,
}: {
  creationDraft: CreationDraft;
  onClose: () => void;
  onPresetChange: (presetId: string) => void;
  onUpdate: (changes: Partial<CreationDraft>) => void;
  presets: TaskPreset[];
  selectedPreset?: TaskPreset;
  selectedTaskType: CalendarHighLevelTaskType;
}) {
  const isOneOff = creationDraft.mode === "oneOff";

  return (
    <>
      <div className="shrink-0 border-b border-slate-200/70 px-4 py-4 sm:px-5">
        <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Preview creator
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              New scheduled task
            </h2>
          </div>
          <button
            aria-label="Close scheduled task creator"
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-white hover:text-slate-950"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="rounded-xl border border-slate-200/70 bg-slate-50/78 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            Selected slot
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {creationDraft.slot.label}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {creationDraft.slot.timeWindow}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className={[
              "min-h-11 rounded-full border px-3 text-sm font-semibold transition",
              !isOneOff
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white/72 text-slate-600 hover:bg-white",
            ].join(" ")}
            onClick={() =>
              onUpdate({
                mode: "preset",
                neededCount: selectedPreset?.neededCount ?? creationDraft.neededCount,
              })
            }
            type="button"
          >
            Task preset
          </button>
          <button
            className={[
              "min-h-11 rounded-full border px-3 text-sm font-semibold transition",
              isOneOff
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white/72 text-slate-600 hover:bg-white",
            ].join(" ")}
            onClick={() => onUpdate({ mode: "oneOff", neededCount: creationDraft.neededCount })}
            type="button"
          >
            Custom one-day
          </button>
        </div>

        {!isOneOff ? (
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-700">Task preset</span>
            <select
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none"
              onChange={(event) => onPresetChange(event.target.value)}
              value={creationDraft.presetId}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Custom task name</span>
              <input
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none"
                onChange={(event) => onUpdate({ customName: event.target.value })}
                value={creationDraft.customName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Task type</span>
              <select
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none"
                onChange={(event) =>
                  onUpdate({
                    customTaskType: event.target.value as CalendarHighLevelTaskType,
                  })
                }
                value={creationDraft.customTaskType}
              >
                {taskTypeOptions.map((taskType) => (
                  <option key={taskType} value={taskType}>
                    {getCalendarHighLevelTaskTypeLabel(taskType)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_132px]">
          <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Preview
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              {isOneOff
                ? creationDraft.customName || "Custom one-day task"
                : selectedPreset?.name ?? "Task preset"}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {getCalendarHighLevelTaskTypeLabel(selectedTaskType)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                0/{creationDraft.neededCount} filled
              </span>
            </div>
            {!isOneOff && selectedPreset?.customFields.length ? (
              <div className="mt-3 grid gap-1 text-xs font-semibold text-slate-500">
                {selectedPreset.customFields.slice(0, 3).map((field) => (
                  <span key={field.id}>
                    {field.label}
                    {field.required ? " required" : ""}
                  </span>
                ))}
              </div>
            ) : null}
            {!isOneOff && selectedPreset?.name === "Lunch" ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Lunch menu field will travel with this scheduled item later.
              </div>
            ) : null}
            {isOneOff ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                This would schedule a one-off item without creating a reusable task preset.
              </p>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Needed</span>
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none"
              min={1}
              onChange={(event) =>
                onUpdate({ neededCount: Math.max(1, Number(event.target.value) || 1) })
              }
              type="number"
              value={creationDraft.neededCount}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-slate-700">Schedule notes</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-3 text-sm font-medium leading-6 text-slate-800 outline-none"
            onChange={(event) => onUpdate({ notes: event.target.value })}
            placeholder="Add notes for the future scheduled item..."
            value={creationDraft.notes}
          />
        </label>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            Helpers
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Helper assignment stays later. This mock keeps the slot ready for assigning
            volunteers after the scheduled item exists.
          </p>
        </div>

        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
          Preview only. This does not create a calendar item yet.
        </p>
      </div>

      <div className="shrink-0 border-t border-slate-200/70 px-4 py-4 sm:px-5">
        <div className="grid gap-2 sm:grid-cols-3">
          {["Add to calendar later", "Save draft later", "Assign helpers later"].map(
            (label) => (
              <button
                className="min-h-11 cursor-not-allowed rounded-full border border-slate-200 bg-white/72 px-3 text-sm font-semibold text-slate-500 opacity-75"
                disabled
                key={label}
                type="button"
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>
    </>
  );
}

function CalendarInspector({
  item,
  isOpen,
  onClose,
}: {
  item?: CalendarItemWithPreset;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!item) {
    return null;
  }

  const tone = getCalendarStatusTone(item.status);

  return (
    <div
      className={[
        "fixed inset-0 z-50 transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <button
        aria-label="Close calendar item inspector backdrop"
        className={[
          "absolute inset-0 hidden bg-slate-950/12 transition-opacity lg:block",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
        type="button"
      />
      <aside
        aria-label="Calendar item inspector"
        className={[
          "absolute right-0 top-0 hidden h-full w-[min(420px,calc(100vw-28px))] px-3 py-3 transition-transform duration-200 ease-out lg:block",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div
          className={`flex h-full flex-col overflow-hidden rounded-2xl border border-white/72 border-l-4 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.22)] backdrop-blur-2xl ${detailAccentStyles[item.category]}`}
        >
          <InspectorContent item={item} onClose={onClose} tone={tone} />
        </div>
      </aside>

      <div className="absolute inset-x-0 bottom-0 px-3 pb-3 lg:hidden">
        <button
          aria-label="Close calendar item inspector backdrop"
          className={[
            "fixed inset-0 bg-slate-950/18 transition-opacity",
            isOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={onClose}
          type="button"
        />
        <section
          aria-label="Calendar item inspector"
          className={[
            `relative max-h-[82vh] overflow-hidden rounded-t-3xl border border-white/72 border-t-4 bg-white/92 shadow-[0_-20px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl transition-transform duration-200 ease-out ${detailAccentStyles[item.category].replace("border-l", "border-t")}`,
            isOpen ? "translate-y-0" : "translate-y-[calc(100%+48px)]",
          ].join(" ")}
        >
          <InspectorContent item={item} onClose={onClose} tone={tone} />
        </section>
      </div>
    </div>
  );
}

function InspectorContent({
  item,
  tone,
  onClose,
}: {
  item: CalendarItemWithPreset;
  tone: CalendarStatusTone;
  onClose: () => void;
}) {
  const placeholderActions = [
    { label: "Add to calendar", icon: Plus },
    { label: "Edit placement", icon: Pencil },
    { label: "Assign helpers later", icon: UserPlus },
    { label: "Repeat later", icon: Repeat },
    { label: "Copy later", icon: Copy },
  ];

  return (
    <>
      <div className="shrink-0 border-b border-slate-200/60 px-4 py-4 sm:px-5">
        <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Selected item
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {getCalendarItemDisplayName(item)}
            </h2>
          </div>
          <button
            aria-label="Close calendar item inspector"
            className="inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-white hover:text-slate-950"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-white/78 px-3 text-sm font-semibold text-slate-800">
            {getCalendarFilledLabel(item)} filled
          </span>
          <span
            className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${categoryStyles[item.category]}`}
          >
            {getCalendarCategoryLabel(item.category)}
          </span>
          <span
            className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${toneStyles[tone]}`}
          >
            {getCalendarStatusLabel(item.status)}
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200/70 bg-white/70 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            Time
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {getCalendarItemTimeWindow(item)}
          </p>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200/70 bg-white/70 px-4 py-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            Helpers
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.assignedVolunteers.length > 0 ? (
              item.assignedVolunteers.map((volunteer) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  key={volunteer.id}
                >
                  {volunteer.name}
                </span>
              ))
            ) : (
              <span className="text-sm font-medium leading-6 text-slate-500">
                No helpers assigned in this mock item.
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-slate-200/70 bg-white/70 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Schedule notes
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {item.scheduleNotes ?? "No schedule-specific notes."}
          </p>
        </div>

        {isLunchCalendarItem(item) ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
            <div className="flex items-center gap-2 font-semibold">
              <Soup aria-hidden="true" className="h-4 w-4" />
              Lunch menu
            </div>
            <p className="mt-1">{item.menuSummary ?? "Menu not added yet."}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              Future volunteer-facing lunch schedule source.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500">
          <span>
            Source:{" "}
            {isOneOffCalendarItem(item)
              ? "One-off custom task, no reusable preset"
              : item.taskPreset?.name ?? "Preset reference missing"}
          </span>
          {item.repeatLabel ? <span>Repeat: {item.repeatLabel}</span> : null}
          {item.copyLabel ? <span>Copy: {item.copyLabel}</span> : null}
        </div>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Preview actions
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
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
        </div>
      </div>
    </>
  );
}

export default function AdminCalendarPage() {
  const allItems = getCalendarItemsByWeek("2026-01-12", demoProjectId);
  const creationPresets = useMemo(() => {
    const presets = getTaskPresetsForActiveWorkspace();
    const preferred = preferredCreationPresetIds
      .map((presetId) => presets.find((preset) => preset.id === presetId))
      .filter((preset): preset is TaskPreset => Boolean(preset));

    return preferred.length > 0 ? preferred : presets;
  }, []);
  const weekRange = deriveCalendarWeekRange("2026-01-12");
  const [activeView, setActiveView] = useState<CalendarViewMode>("week");
  const [filters, setFilters] = useState<CalendarFilterOptions>({});
  const [activeSurface, setActiveSurface] = useState<CalendarSurface>("none");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [creationDraft, setCreationDraft] = useState<CreationDraft | undefined>();

  const filteredItems = useMemo(
    () => filterCalendarItems(allItems, filters),
    [allItems, filters],
  );

  const activeFilterCount = getCalendarActiveFilterCount(filters);
  const activeFilterSummary = getCalendarActiveFilterSummary(filters);

  const groupedItems = groupCalendarItemsByDay(filteredItems, weekRange.start).flatMap(
    (group) => group.items,
  );
  const selectedItem = selectedId
    ? groupedItems.find((item) => item.id === selectedId)
    : undefined;

  const closeCalendarSurface = () => {
    setActiveSurface("none");
    setSelectedId(undefined);
    setCreationDraft(undefined);
  };

  const closeMobileNavigation = () => {
    window.dispatchEvent(new Event(closeMobileNavigationEvent));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeSurface !== "none") {
        setActiveSurface("none");
        setSelectedId(undefined);
        setCreationDraft(undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSurface]);

  const handleSelectCalendarItem = (item: CalendarItemWithPreset) => {
    closeMobileNavigation();
    setCreationDraft(undefined);
    setSelectedId(item.id);
    setActiveSurface("inspect");
  };

  const handleOpenFilters = () => {
    closeMobileNavigation();
    setSelectedId(undefined);
    setCreationDraft(undefined);
    setActiveSurface("filter");
  };

  const handleCreateFromSlot = (slot: CreationSlot) => {
    const defaultPreset = creationPresets[0];

    closeMobileNavigation();
    setSelectedId(undefined);
    setCreationDraft({
      slot,
      mode: "preset",
      presetId: defaultPreset?.id ?? "",
      neededCount: defaultPreset?.neededCount ?? 2,
      notes: "",
      customName: "Custom one-day task",
      customTaskType: "generalVolunteers",
    });
    setActiveSurface("create");
  };

  const clearFilters = () => {
    setFilters({});
  };

  return (
    <AdminShell
      active="calendar"
      onMobileMoreClose={closeCalendarSurface}
      onMobileMoreOpen={() => {
        setSelectedId(undefined);
        setCreationDraft(undefined);
        setActiveSurface("more");
      }}
    >
      <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            <CalendarDays aria-hidden="true" className="h-4 w-4" />
            Belgrade Remodel
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Calendar
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Schedule task presets into project days, times, helper counts,
            and notes.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            Preview only. Task preset editing stays on Tasks.
          </p>
        </div>
      </header>

      <section className="mt-6 space-y-4">
        {allItems.length > 0 ? (
          <>
            <SummaryStrip items={filteredItems} />

            <CalendarWorkspaceHeader
              activeFilterCount={activeFilterCount}
              activeFilterSummary={activeFilterSummary}
              activeView={activeView}
              filteredItemCount={filteredItems.length}
              onFilterOpen={handleOpenFilters}
              onViewChange={setActiveView}
              weekLabel={weekRange.label}
            />

            <ActiveFilterBar filters={filters} onClear={clearFilters} />

            <div className="space-y-4">
              {activeView === "day" ? (
                <DayView
                  date={weekRange.dates[1]}
                  items={filteredItems}
                  onCreateFromSlot={handleCreateFromSlot}
                  onSelect={handleSelectCalendarItem}
                  selectedId={selectedItem?.id}
                />
              ) : null}
              {activeView === "week" ? (
                <>
                  <WeekGrid
                    items={filteredItems}
                    onCreateFromSlot={handleCreateFromSlot}
                    onSelect={handleSelectCalendarItem}
                    selectedId={selectedItem?.id}
                  />
                  <MobileDayGroups
                    items={filteredItems}
                    onCreateFromSlot={handleCreateFromSlot}
                    onSelect={handleSelectCalendarItem}
                    selectedId={selectedItem?.id}
                  />
                </>
              ) : null}
              {activeView === "month" ? (
                <MonthView
                  items={filteredItems}
                  onCreateFromSlot={handleCreateFromSlot}
                  onSelect={handleSelectCalendarItem}
                  referenceDate={weekRange.start}
                  selectedId={selectedItem?.id}
                />
              ) : null}
            </div>
            <CalendarFilterPanel
              filters={filters}
              isOpen={activeSurface === "filter"}
              onChange={setFilters}
              onClear={clearFilters}
              onClose={closeCalendarSurface}
            />
            <CalendarCreatePanel
              creationDraft={creationDraft}
              isOpen={activeSurface === "create"}
              onClose={closeCalendarSurface}
              onDraftChange={setCreationDraft}
              presets={creationPresets}
            />
            <CalendarInspector
              isOpen={activeSurface === "inspect"}
              item={selectedItem}
              onClose={closeCalendarSurface}
            />
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
