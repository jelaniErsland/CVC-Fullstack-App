"use client";

import {
  CalendarDays,
  ChevronDown,
  Clock,
  Copy,
  Pencil,
  Plus,
  Repeat,
  Soup,
  UserPlus,
  Users,
  X,
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
          {getCalendarCategoryLabel(item.category)}
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
  selectedId,
  onSelect,
}: {
  items: CalendarItem[];
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
                <div className="rounded-lg border border-dashed border-white/80 px-3 py-8 text-center text-xs font-medium text-slate-400">
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
          </div>
        </section>
      ))}
    </div>
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
            isOpen ? "translate-y-0" : "translate-y-[calc(100%+24px)]",
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
  const weekRange = deriveCalendarWeekRange("2026-01-12");
  const [activeFilter, setActiveFilter] = useState<CalendarFilter>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") {
      return allItems;
    }

    return allItems.filter((item) => item.category === activeFilter);
  }, [activeFilter, allItems]);

  const groupedItems = groupCalendarItemsByDay(filteredItems, weekRange.start).flatMap(
    (group) => group.items,
  );
  const selectedItem = selectedId
    ? groupedItems.find((item) => item.id === selectedId)
    : undefined;

  const handleSelectCalendarItem = (item: CalendarItemWithPreset) => {
    setSelectedId(item.id);
    setIsInspectorOpen(true);
  };

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
              Schedule task presets into project days, times, helper counts,
              and notes.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Preview only. Task preset editing stays on Tasks.
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

            <div className="space-y-4">
              <WeekGrid
                items={filteredItems}
                onSelect={handleSelectCalendarItem}
                selectedId={selectedItem?.id}
              />
              <MobileDayGroups
                items={filteredItems}
                onSelect={handleSelectCalendarItem}
                selectedId={selectedItem?.id}
              />
            </div>
            <CalendarInspector
              isOpen={isInspectorOpen}
              item={selectedItem}
              onClose={() => setIsInspectorOpen(false)}
            />
            {selectedItem && !isInspectorOpen ? (
              <button
                className="fixed bottom-4 right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/80 bg-white/88 px-4 text-sm font-semibold text-slate-700 shadow-[0_16px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl transition hover:bg-white"
                onClick={() => setIsInspectorOpen(true)}
                type="button"
              >
                <ChevronDown aria-hidden="true" className="h-4 w-4 rotate-180" />
                Open inspector
              </button>
            ) : null}
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
