"use client";

import {
  CalendarDays,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
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
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type Ref,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import {
  deriveCalendarWeekRange,
  doesCalendarItemOccurOnDate,
  doesCalendarItemOverlapDateRange,
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
  getCalendarItemPreviewTimingKind,
  getCalendarItemTimeWindow,
  getCalendarStatusLabel,
  getCalendarStatusTone,
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
  TaskPresetCategory,
} from "@/lib/mockData";

type CalendarViewMode = "day" | "week" | "month" | "list";
type CalendarSurface = "none" | "filter" | "more" | "create" | "inspect";
type CreationMode = "preset" | "oneOff";
type CalendarMutationAction = (formData: FormData) => void | Promise<void>;
const closeMobileNavigationEvent = "cvc:close-admin-mobile-navigation";
const calmFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-1";

// Local preview state only; these types are not persistence contracts.
type CalendarCreationSlot = {
  date: string;
  label: string;
  contextLabel?: string;
  // Compatibility state for the current preview; not a future persisted kind.
  allDay?: boolean;
  suggestedStartTime?: string;
  suggestedEndTime?: string;
};

type CalendarCreationDraft = {
  slot: CalendarCreationSlot;
  date: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  mode: CreationMode;
  presetId: string;
  neededCount: number;
  notes: string;
  customName: string;
  customTaskType: CalendarHighLevelTaskType;
};

type CalendarTaskPresetCustomField = {
  id: string;
  name: string;
  label: string;
  type: "shortText" | "longText" | "number" | "select" | "checkbox";
  required?: boolean;
  options?: string[];
};

type CalendarTaskPresetOption = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  category: TaskPresetCategory;
  neededCount: number;
  visibility: "mainContacts" | "allContacts" | "volunteers";
  customFields: CalendarTaskPresetCustomField[];
  isSystemPreset?: boolean;
  sourcePresetId?: string;
};

type CalendarTaskPresetSelectorState =
  | Readonly<{ kind: "ready_with_presets"; presets: readonly CalendarTaskPresetOption[] }>
  | Readonly<{ kind: "ready_empty"; presets: readonly [] }>
  | Readonly<{ kind: "unavailable"; reason: "missing_tasks_view" }>
  | Readonly<{ kind: "error"; reason: "query_unavailable" | "invalid_projection" }>;

type WeekBandCalendarItem = CalendarItemWithPreset;

type WeekBandLayoutItem = {
  endIndex: number;
  item: WeekBandCalendarItem;
  lane: number;
  startIndex: number;
};

const viewModes: Array<{ id: CalendarViewMode; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "list", label: "List" },
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

const suggestedSlots = {
  morning: { start: "09:00", end: "10:00" },
  afternoon: { start: "13:00", end: "14:00" },
  evening: { start: "18:00", end: "19:00" },
};

const projectCalendarAnchor = "2026-01-13";

const categoryStyles: Record<TaskPresetCategory, string> = {
  general: "border-slate-200 bg-slate-50 text-slate-700",
  lunch: "border-emerald-200 bg-emerald-50 text-emerald-700",
  security: "border-sky-200 bg-sky-50 text-sky-700",
  cleanup: "border-amber-200 bg-amber-50 text-amber-700",
  construction: "border-violet-200 bg-violet-50 text-violet-700",
  custom: "border-rose-200 bg-rose-50 text-rose-700",
};

const calendarEventPalette = [
  "bg-sky-200/85 text-sky-950 hover:bg-sky-200",
  "bg-emerald-200/85 text-emerald-950 hover:bg-emerald-200",
  "bg-violet-200/85 text-violet-950 hover:bg-violet-200",
  "bg-amber-200/85 text-amber-950 hover:bg-amber-200",
  "bg-rose-200/85 text-rose-950 hover:bg-rose-200",
  "bg-cyan-200/85 text-cyan-950 hover:bg-cyan-200",
  "bg-indigo-200/85 text-indigo-950 hover:bg-indigo-200",
  "bg-orange-200/85 text-orange-950 hover:bg-orange-200",
] as const;

const dayTimelineSlots = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  label: formatHourLabel(hour),
  start: `${String(hour).padStart(2, "0")}:00`,
  end: `${String((hour + 1) % 24).padStart(2, "0")}:00`,
}));

const weekGridHeight = 720;
const weekEventMinHeight = 44;
const weekBandVisibleLaneCount = 2;
const weekTimeLabels = dayTimelineSlots.filter(({ hour }) => hour % 2 === 0);

function getCalendarEventStyle(item: CalendarItem) {
  const stableKey = item.taskPresetId ?? item.oneOffTask?.name ?? item.id;
  let hash = 0;

  for (let index = 0; index < stableKey.length; index += 1) {
    hash = (hash * 31 + stableKey.charCodeAt(index)) >>> 0;
  }

  return (
    calendarEventPalette[hash % calendarEventPalette.length] ??
    calendarEventPalette[0]
  );
}

function enrichCalendarClientItem(item: CalendarItem): CalendarItemWithPreset {
  const enriched = enrichCalendarItem(item);
  const persistedPreset = (item as CalendarItem & { taskPreset?: CalendarTaskPresetOption })
    .taskPreset;
  return persistedPreset ? { ...enriched, taskPreset: persistedPreset } : enriched;
}

function getCalendarItemAccessibleLabel(item: CalendarItemWithPreset) {
  if (isWeekBandCalendarItem(item)) {
    return getWeekBandItemAccessibleLabel(item);
  }

  return [
    getCalendarItemDisplayName(item),
    `${item.filledCount} of ${item.neededCount} volunteers`,
    getCalendarCompactDayLabel(item.date),
    getCalendarItemTimeWindow(item),
  ].join(", ");
}

function getWeekBandItemAccessibleLabel(item: WeekBandCalendarItem) {
  const startLabel = getCalendarCompactDayLabel(item.date);
  const endLabel = item.endDate
    ? getCalendarCompactDayLabel(item.endDate)
    : undefined;
  const dateLabel = endLabel && endLabel !== startLabel
    ? `project window ${startLabel} through ${endLabel}`
    : `no specific time ${startLabel}`;

  return [
    getCalendarItemDisplayName(item),
    `${item.filledCount} of ${item.neededCount} volunteers`,
    dateLabel,
  ].join(", ");
}

function getProjectContextItemAccessibleLabel(item: WeekBandCalendarItem) {
  const startLabel = getCalendarCompactDayLabel(item.date);
  const endLabel = item.endDate
    ? getCalendarCompactDayLabel(item.endDate)
    : undefined;
  const dateLabel = endLabel && endLabel !== startLabel
    ? `project context ${startLabel} through ${endLabel}`
    : `date-based project context ${startLabel}`;

  return [
    getCalendarItemDisplayName(item),
    `${item.filledCount} of ${item.neededCount} volunteers`,
    dateLabel,
  ].join(", ");
}

function getCalendarItemScheduleDisplay(item: CalendarItem) {
  if (!isWeekBandCalendarItem(item)) {
    return {
      heading: "Time",
      label: getCalendarItemTimeWindow(item),
    };
  }

  const startLabel = getCalendarCompactDayLabel(item.date);
  const endLabel = item.endDate
    ? getCalendarCompactDayLabel(item.endDate)
    : undefined;

  return endLabel && endLabel !== startLabel
    ? {
        heading: "Schedule",
        label: `Project window · ${startLabel} through ${endLabel}`,
      }
    : {
        heading: "Schedule",
        label: `No specific time · ${startLabel}`,
      };
}

function isWeekBandCalendarItem(item: CalendarItem) {
  return getCalendarItemPreviewTimingKind(item) !== "timed";
}

function getWeekBandLayout(items: WeekBandCalendarItem[], referenceDate: string) {
  const weekStart = new Date(
    `${deriveCalendarWeekRange(referenceDate).start}T00:00:00Z`,
  );
  const dayOffset = (date: string) =>
    Math.round(
      (new Date(`${date}T00:00:00Z`).getTime() - weekStart.getTime()) /
        (24 * 60 * 60 * 1000),
    );
  const ranges = items
    .map((item) => ({
      endIndex: Math.min(6, Math.max(0, dayOffset(item.endDate ?? item.date))),
      item,
      startIndex: Math.min(6, Math.max(0, dayOffset(item.date))),
    }))
    .filter(({ endIndex, startIndex }) => endIndex >= startIndex)
    .sort(
      (first, second) =>
        first.startIndex - second.startIndex ||
        second.endIndex - first.endIndex ||
        (first.item.id < second.item.id ? -1 : first.item.id > second.item.id ? 1 : 0),
    );
  const laneEnds: number[] = [];

  return ranges.map(({ endIndex, item, startIndex }): WeekBandLayoutItem => {
    const availableLane = laneEnds.findIndex((laneEnd) => laneEnd < startIndex);
    const lane = availableLane === -1 ? laneEnds.length : availableLane;

    laneEnds[lane] = endIndex;

    return { endIndex, item, lane, startIndex };
  });
}

function formatHourLabel(hour: number) {
  if (hour === 0) {
    return "12 AM";
  }

  if (hour === 12) {
    return "12 PM";
  }

  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function getCalendarAccessibleDayLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00Z`));
}

function getCreationTimeLabel(value: string) {
  const [hourText, minute = "00"] = value.split(":");
  const hour = Number(hourText);

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return "a time";
  }

  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}${minute === "00" ? "" : `:${minute}`} ${meridiem}`;
}

function shiftCalendarAnchor(
  date: string,
  amount: number,
  view: CalendarViewMode,
) {
  const nextDate = new Date(`${date}T00:00:00Z`);

  if (view === "month") {
    const day = nextDate.getUTCDate();

    nextDate.setUTCDate(1);
    nextDate.setUTCMonth(nextDate.getUTCMonth() + amount);

    const lastDay = new Date(Date.UTC(
      nextDate.getUTCFullYear(),
      nextDate.getUTCMonth() + 1,
      0,
    )).getUTCDate();

    nextDate.setUTCDate(Math.min(day, lastDay));
  } else {
    nextDate.setUTCDate(
      nextDate.getUTCDate() +
        amount * (view === "week" || view === "list" ? 7 : 1),
    );
  }

  return nextDate.toISOString().slice(0, 10);
}

function getCalendarPeriodLabel(date: string, view: CalendarViewMode) {
  if (view === "week" || view === "list") {
    return deriveCalendarWeekRange(date).label;
  }

  if (view === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    }).format(new Date(`${date}T00:00:00Z`));
  }

  return `${getCalendarCompactDayLabel(date)}, ${date.slice(0, 4)}`;
}

function parseCalendarTimeMinutes(value?: string) {
  const match = value?.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

  if (!match) {
    return undefined;
  }

  const [, hourText, minuteText, meridiem] = match;
  let hour = Number(hourText);

  if (meridiem.toUpperCase() === "PM" && hour !== 12) {
    hour += 12;
  }

  if (meridiem.toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  return hour * 60 + Number(minuteText);
}

function getCalendarItemStartMinutes(item: CalendarItem) {
  return parseCalendarTimeMinutes(item.startTime) ?? 9 * 60;
}

function getCalendarItemEndMinutes(item: CalendarItem) {
  const start = getCalendarItemStartMinutes(item);
  const parsedEnd = parseCalendarTimeMinutes(item.endTime);

  if (parsedEnd === undefined) {
    return Math.min(start + 60, 24 * 60);
  }

  return parsedEnd <= start ? 24 * 60 : parsedEnd;
}

function getCalendarItemStartHour(item: CalendarItem) {
  return Math.floor(getCalendarItemStartMinutes(item) / 60);
}

function layoutWeekItems(items: CalendarItemWithPreset[]) {
  const timedItems = [...items]
    .sort(
      (first, second) =>
        getCalendarItemStartMinutes(first) - getCalendarItemStartMinutes(second) ||
        getCalendarItemEndMinutes(first) - getCalendarItemEndMinutes(second) ||
        (first.id < second.id ? -1 : first.id > second.id ? 1 : 0),
    )
    .map((item) => ({
      end: getCalendarItemEndMinutes(item),
      item,
      start: getCalendarItemStartMinutes(item),
    }));
  const clusters: (typeof timedItems)[] = [];
  let activeCluster: typeof timedItems = [];
  let activeClusterEnd = -1;

  timedItems.forEach((timedItem) => {
    if (activeCluster.length > 0 && timedItem.start >= activeClusterEnd) {
      clusters.push(activeCluster);
      activeCluster = [];
      activeClusterEnd = -1;
    }

    activeCluster.push(timedItem);
    activeClusterEnd = Math.max(activeClusterEnd, timedItem.end);
  });

  if (activeCluster.length > 0) {
    clusters.push(activeCluster);
  }

  return clusters.flatMap((cluster) => {
    const laneEndTimes: number[] = [];
    const assignedItems = cluster.map((timedItem) => {
      const availableLane = laneEndTimes.findIndex(
        (laneEnd) => laneEnd <= timedItem.start,
      );
      const lane = availableLane === -1 ? laneEndTimes.length : availableLane;

      laneEndTimes[lane] = timedItem.end;

      return { ...timedItem, lane };
    });
    const laneCount = laneEndTimes.length;

    return assignedItems.map(({ end, item, lane, start }) => {
      const rawTop = (start / (24 * 60)) * weekGridHeight;
      const top = Math.min(rawTop, weekGridHeight - weekEventMinHeight);
      const durationHeight = ((end - start) / (24 * 60)) * weekGridHeight;
      const height = Math.min(
        Math.max(durationHeight, weekEventMinHeight),
        weekGridHeight - top,
      );

      return { height, item, lane, laneCount, top };
    });
  });
}

function getTimelineSlotFromPointer(event: MouseEvent<HTMLButtonElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const offset = bounds.height > 0 ? event.clientY - bounds.top : 0;
  const hour = Math.min(23, Math.max(0, Math.floor((offset / bounds.height) * 24)));

  return dayTimelineSlots[hour] ?? dayTimelineSlots[13];
}

function mapHighLevelTaskTypeToCalendarTaskType(taskType: CalendarHighLevelTaskType) {
  if (taskType === "food") return "food";
  if (taskType === "security") return "security";
  return "general";
}

function mapCategoryToCalendarTaskType(category: TaskPresetCategory) {
  if (category === "lunch") return "food";
  if (category === "security") return "security";
  if (category === "custom") return "custom";
  return "general";
}

function handleCalendarGridArrowKey(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  currentIndex: number,
  columnCount: number,
) {
  const group = event.currentTarget.closest("[data-calendar-arrow-group]");
  const targets = Array.from(
    group?.querySelectorAll<HTMLButtonElement>("[data-calendar-arrow-target]") ?? [],
  );
  let nextIndex: number | undefined;

  switch (event.key) {
    case "ArrowDown":
      nextIndex = currentIndex + columnCount;
      break;
    case "ArrowUp":
      nextIndex = currentIndex - columnCount;
      break;
    case "ArrowRight":
      if (columnCount > 1) {
        nextIndex = currentIndex + 1;
      }
      break;
    case "ArrowLeft":
      if (columnCount > 1) {
        nextIndex = currentIndex - 1;
      }
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = targets.length - 1;
      break;
    default:
      return;
  }

  const nextTarget = nextIndex === undefined ? undefined : targets[nextIndex];

  if (!nextTarget) {
    return;
  }

  event.preventDefault();
  nextTarget.focus();
}

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

function ViewToggle({
  activeView,
  onChange,
}: {
  activeView: CalendarViewMode;
  onChange: (view: CalendarViewMode) => void;
}) {
  return (
    <div
      aria-label="Calendar view"
      className="inline-flex min-w-0 flex-1 rounded-full border border-slate-200/80 bg-white/58 p-1 text-sm font-semibold text-slate-500 sm:w-auto sm:flex-none"
      role="group"
    >
      {viewModes.map((view) => (
        <button
          aria-controls="calendar-view-content"
          aria-pressed={activeView === view.id}
          className={[
            `min-h-11 min-w-0 flex-1 rounded-full px-2 transition sm:flex-none sm:px-4 ${calmFocusRing}`,
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
  onNavigateNext,
  onNavigatePrevious,
  onNavigateReset,
  onViewChange,
  periodLabel,
  resetDisabled,
}: {
  activeFilterCount: number;
  activeFilterSummary: string;
  activeView: CalendarViewMode;
  filteredItemCount: number;
  onFilterOpen: () => void;
  onNavigateNext: () => void;
  onNavigatePrevious: () => void;
  onNavigateReset: () => void;
  onViewChange: (view: CalendarViewMode) => void;
  periodLabel: string;
  resetDisabled: boolean;
}) {
  const navigationUnit =
    activeView === "day" ? "day" : activeView === "list" ? "week" : activeView;

  return (
    <section
      className="border-b border-slate-200/80 pb-3"
      data-testid="calendar-workspace-header"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {periodLabel}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {filteredItemCount} visible item{filteredItemCount === 1 ? "" : "s"} -{" "}
            {activeFilterSummary}
          </p>
        </div>

        <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <div className="inline-flex rounded-full border border-slate-200/80 bg-white/58 p-1">
            <button
              aria-label={`Previous ${navigationUnit}`}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition hover:bg-white ${calmFocusRing}`}
              onClick={onNavigatePrevious}
              title={`Previous ${navigationUnit}`}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              aria-label={`Next ${navigationUnit}`}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition hover:bg-white ${calmFocusRing}`}
              onClick={onNavigateNext}
              title={`Next ${navigationUnit}`}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <button
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200/80 bg-white/58 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-default disabled:opacity-45 sm:px-4 ${calmFocusRing}`}
            disabled={resetDisabled}
            onClick={onNavigateReset}
            type="button"
          >
            <CalendarRange aria-hidden="true" className="h-4 w-4" />
            Project week
          </button>
        </div>
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-2 sm:justify-between">
        <ViewToggle activeView={activeView} onChange={onViewChange} />
        <button
          aria-label="Open calendar filters"
          className={[
            `inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition sm:px-4 ${calmFocusRing}`,
            activeFilterCount > 0
              ? "border-slate-950 bg-slate-950 text-white shadow-sm"
              : "border-slate-200/80 bg-white/58 text-slate-700 hover:bg-white",
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
    </section>
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
      aria-pressed={active}
      className={[
        `inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${calmFocusRing}`,
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
  const desktopCloseButtonRef = useRef<HTMLButtonElement>(null);
  const desktopDialogRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLElement>(null);
  const descriptionId = useId();

  useFocusContainment(isOpen, desktopDialogRef, mobileDialogRef);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const closeButton = window.matchMedia("(min-width: 1024px)").matches
        ? desktopCloseButtonRef.current
        : mobileCloseButtonRef.current;

      closeButton?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

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
      aria-hidden={!isOpen}
      className={[
        "fixed inset-0 z-[60] transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      inert={!isOpen}
    >
      <button
        aria-label="Close calendar filters backdrop"
        className={[
          "absolute inset-0 bg-slate-950/16 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />

      <aside
        aria-describedby={`${descriptionId}-desktop`}
        aria-label="Calendar filters"
        aria-modal="true"
        className={[
          "absolute right-0 top-0 hidden h-full w-[min(400px,calc(100vw-28px))] px-3 py-3 transition-transform duration-200 ease-out lg:block",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        ref={desktopDialogRef}
        tabIndex={-1}
      >
        <GlassCard className="flex h-full flex-col overflow-hidden rounded-2xl p-0 shadow-[0_24px_90px_rgba(15,23,42,0.22)]">
          <FilterPanelContent
            activeFilterCount={activeFilterCount}
            closeButtonRef={desktopCloseButtonRef}
            descriptionId={`${descriptionId}-desktop`}
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
          aria-describedby={`${descriptionId}-mobile`}
          aria-label="Calendar filters"
          aria-modal="true"
          className={[
            "relative max-h-[82vh] overflow-hidden rounded-t-3xl border border-white/72 bg-white/94 shadow-[0_-20px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl transition-transform duration-200 ease-out",
            isOpen ? "translate-y-0" : "translate-y-[calc(100%+48px)]",
          ].join(" ")}
          role="dialog"
          ref={mobileDialogRef}
          tabIndex={-1}
        >
          <FilterPanelContent
            activeFilterCount={activeFilterCount}
            closeButtonRef={mobileCloseButtonRef}
            descriptionId={`${descriptionId}-mobile`}
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
  closeButtonRef,
  descriptionId,
  filters,
  onChange,
  onClear,
  onClose,
  toggleCoverage,
  toggleTaskType,
}: {
  activeFilterCount: number;
  closeButtonRef?: Ref<HTMLButtonElement>;
  descriptionId: string;
  filters: CalendarFilterOptions;
  onChange: (filters: CalendarFilterOptions) => void;
  onClear: () => void;
  onClose: () => void;
  toggleCoverage: (state: CalendarCoverageFilterState) => void;
  toggleTaskType: (taskType: CalendarHighLevelTaskType) => void;
}) {
  return (
    <>
      <p className="sr-only" id={descriptionId}>
        Filter visible Calendar items by task name, coverage, or task type. Changes
        remain local to this preview.
      </p>
      <div className="shrink-0 border-b border-slate-200/70 px-4 py-4 sm:px-5">
        <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Calendar filters
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Find project work
            </h2>
          </div>
          <button
            aria-label="Close calendar filters"
            className={`inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-white hover:text-slate-950 ${calmFocusRing}`}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Task name</span>
          <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/72 px-3 focus-within:ring-2 focus-within:ring-slate-900/30 focus-within:ring-offset-1">
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
            These filters are local UI controls. They do not save preferences or change
            any scheduling data.
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200/70 px-4 py-4 sm:px-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            className={`min-h-11 rounded-full border border-slate-200 bg-white/78 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white ${calmFocusRing}`}
            onClick={onClear}
            type="button"
          >
            Clear filters
          </button>
          <button
            className={`min-h-11 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm ${calmFocusRing}`}
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
        className={`inline-flex min-h-10 items-center justify-center rounded-full border border-white/80 bg-white/72 px-4 text-sm font-semibold text-slate-600 transition hover:bg-white ${calmFocusRing}`}
        onClick={onClear}
        type="button"
      >
        Reset
      </button>
    </div>
  );
}

function CalendarBlock({
  fillHeight,
  item,
  isSelected,
  onSelect,
}: {
  fillHeight?: boolean;
  item: CalendarItemWithPreset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-label={getCalendarItemAccessibleLabel(item)}
      className={[
        `w-full overflow-hidden rounded text-left shadow-none transition ${calmFocusRing}`,
        fillHeight ? "h-full min-h-11 px-2 py-1.5" : "min-h-[54px] px-2.5 py-2",
        getCalendarEventStyle(item),
        isSelected ? "ring-2 ring-slate-900/30 ring-offset-1" : "",
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <span className="mt-px shrink-0 text-[11px] font-semibold leading-4 opacity-70">
          {getCalendarFilledLabel(item)}
        </span>
        <p className="line-clamp-2 min-w-0 text-xs font-semibold leading-4">
          {getCalendarItemDisplayName(item)}
        </p>
      </div>
    </button>
  );
}

function WeekGrid({
  items,
  onCreateFromSlot,
  onFocusDate,
  referenceDate,
  selectedId,
  onSelect,
}: {
  items: CalendarItem[];
  onCreateFromSlot: (slot: CalendarCreationSlot) => void;
  onFocusDate: (date: string) => void;
  referenceDate: string;
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
}) {
  const groups = groupCalendarItemsByDay(items, referenceDate);
  const timedGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !isWeekBandCalendarItem(item)),
  }));
  const bandItems = items
    .filter(isWeekBandCalendarItem)
    .map((item) => enrichCalendarClientItem(item) as WeekBandCalendarItem);
  const bandLayout = getWeekBandLayout(bandItems, referenceDate);
  const visibleBandItems = bandLayout.filter(
    ({ lane }) => lane < weekBandVisibleLaneCount,
  );
  const visibleBandLaneCount = Math.min(
    weekBandVisibleLaneCount,
    bandLayout.reduce((highestLane, item) => Math.max(highestLane, item.lane + 1), 0),
  );
  const overflowCounts = groups.map((_, dayIndex) =>
    bandLayout.filter(
      ({ endIndex, lane, startIndex }) =>
        lane >= weekBandVisibleLaneCount && startIndex <= dayIndex && endIndex >= dayIndex,
    ).length,
  );
  const hasBandOverflow = overflowCounts.some((count) => count > 0);
  const bandHeight =
    visibleBandLaneCount === 0
      ? 36
      : 8 + visibleBandLaneCount * 24 + (hasBandOverflow ? 18 : 0);
  const bandRowCount = Math.max(
    1,
    visibleBandLaneCount + (hasBandOverflow ? 1 : 0),
  );

  return (
    <section className="hidden overflow-x-auto rounded-xl border border-slate-200/80 bg-white/52 lg:block">
      <div className="grid min-w-[956px] grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-200/80 bg-white/62">
        <div aria-hidden="true" className="border-r border-slate-200/80" />
        {groups.map((group) => (
          <div className="border-r border-slate-200/80 px-3 py-3 last:border-r-0" key={group.date}>
            <p className="text-sm font-semibold text-slate-950">{group.dayLabel}</p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {group.items.length} item{group.items.length === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
      <div
        aria-label="Project context and date-based work"
        className="grid min-w-[956px] grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-slate-200/80 bg-white/42"
        role="region"
      >
        <div className="border-r border-slate-200/80 px-2 pt-2 text-right text-[10px] font-semibold text-slate-400">
          Project context
        </div>
        <div className="relative col-span-7" style={{ height: bandHeight }}>
          <div
            className="absolute inset-0 z-0 grid grid-cols-7"
            data-calendar-arrow-group="week-context"
          >
            {groups.map((group, dayIndex) => (
              <button
                aria-label={`Plan project work with no specific time on ${getCalendarAccessibleDayLabel(group.date)}`}
                className={`border-r border-slate-200/80 transition hover:bg-slate-50/55 last:border-r-0 focus-visible:ring-inset ${calmFocusRing}`}
                data-calendar-arrow-target="week-context-day"
                key={group.date}
                onClick={() =>
                  onCreateFromSlot({
                    allDay: true,
                    date: group.date,
                    label: `${group.dayLabel}, no specific time`,
                    contextLabel: "Suggested from project context",
                  })
                }
                onKeyDown={(event) =>
                  handleCalendarGridArrowKey(event, dayIndex, 7)
                }
                type="button"
              />
            ))}
          </div>
          <div
            className="pointer-events-none relative z-10 grid h-full grid-cols-7 gap-x-1 gap-y-1 p-1.5"
            style={{ gridTemplateRows: `repeat(${bandRowCount}, minmax(0, 1fr))` }}
          >
            {visibleBandItems.map(({ endIndex, item, lane, startIndex }) => (
              <button
                aria-label={getWeekBandItemAccessibleLabel(item)}
                className={[
                  `pointer-events-auto flex min-w-0 items-center gap-1 overflow-hidden rounded px-1.5 text-left text-[10px] font-semibold leading-4 transition ${calmFocusRing}`,
                  getCalendarEventStyle(item),
                  selectedId === item.id
                    ? "ring-2 ring-slate-900/30 ring-offset-1"
                    : "",
                ].join(" ")}
                key={item.id}
                onClick={() => onSelect(item)}
                style={{
                  gridColumn: `${startIndex + 1} / ${endIndex + 2}`,
                  gridRow: lane + 1,
                }}
                type="button"
              >
                <span className="shrink-0 opacity-70">
                  {getCalendarFilledLabel(item)}
                </span>
                <span className="min-w-0 truncate">
                  {getCalendarItemDisplayName(item)}
                </span>
              </button>
            ))}
            {overflowCounts.map((count, dayIndex) =>
              count > 0 ? (
                <button
                  aria-label={`Switch to Day view for ${groups[dayIndex]?.dayLabel} to show ${count} more project context item${count === 1 ? "" : "s"}`}
                  className={`pointer-events-auto self-center justify-self-start px-1 text-[10px] font-semibold text-slate-500 transition hover:text-slate-950 ${calmFocusRing}`}
                  key={groups[dayIndex]?.date}
                  onClick={() => onFocusDate(groups[dayIndex]?.date ?? referenceDate)}
                  style={{
                    gridColumn: dayIndex + 1,
                    gridRow: visibleBandLaneCount + 1,
                  }}
                  type="button"
                >
                  +{count}
                </button>
              ) : null,
            )}
          </div>
        </div>
      </div>
      <div
        className="grid h-[720px] min-w-[956px] grid-cols-[56px_repeat(7,minmax(0,1fr))]"
        data-calendar-arrow-group="week-timed"
      >
        <div
          aria-hidden="true"
          className="relative border-r border-slate-200/80 bg-white/42"
        >
          {weekTimeLabels.map((slot) => (
            <span
              className="absolute right-2 text-[10px] font-semibold text-slate-400"
              key={slot.hour}
              style={{
                top: slot.hour === 0 ? 5 : slot.hour * 30,
                transform: slot.hour === 0 ? undefined : "translateY(-50%)",
              }}
            >
              {slot.label}
            </span>
          ))}
        </div>
        {timedGroups.map((group, dayIndex) => (
          <div
            className="relative min-w-0 border-r border-slate-200/80 bg-white/28 bg-[linear-gradient(to_bottom,rgba(148,163,184,0.14)_1px,transparent_1px)] last:border-r-0"
            key={group.date}
            style={{ backgroundSize: "100% 30px" }}
          >
            <button
              aria-label={`Plan project work on ${group.dayLabel} in the Week time grid; keyboard default 9 AM`}
              className={`absolute inset-0 cursor-pointer rounded-none transition hover:bg-slate-50/45 focus-visible:ring-inset ${calmFocusRing}`}
              data-calendar-arrow-target="week-timed-day"
              onClick={(event) => {
                const slot =
                  event.detail === 0
                    ? dayTimelineSlots[9]
                    : getTimelineSlotFromPointer(event);

                onCreateFromSlot({
                  date: group.date,
                  label: `${group.dayLabel} at ${slot.label}`,
                  contextLabel: "Suggested from calendar grid",
                  suggestedStartTime: slot.start,
                  suggestedEndTime: slot.end,
                });
              }}
              onKeyDown={(event) =>
                handleCalendarGridArrowKey(event, dayIndex, 7)
              }
              type="button"
            />
            {layoutWeekItems(group.items).map(
              ({ height, item, lane, laneCount, top }) => {
                const laneWidth = 100 / laneCount;

                return (
                  <div
                    className="absolute z-10"
                    data-week-event-id={item.id}
                    data-week-lane={`${lane + 1}/${laneCount}`}
                    key={item.id}
                    style={{
                      height,
                      left: `calc(${lane * laneWidth}% + ${lane === 0 ? 8 : 4}px)`,
                      top,
                      width: `calc(${laneWidth}% - ${laneCount === 1 ? 16 : 12}px)`,
                    }}
                  >
                    <CalendarBlock
                      fillHeight
                      isSelected={selectedId === item.id}
                      item={item}
                      onSelect={() => onSelect(item)}
                    />
                  </div>
                );
              },
            )}
          </div>
        ))}
      </div>
    </section>
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
      aria-label={label}
      className={[
        `group relative w-full cursor-pointer overflow-hidden rounded-md border border-transparent bg-transparent text-left transition hover:border-slate-200/70 hover:bg-white/32 ${calmFocusRing}`,
        compact ? "min-h-9" : "min-h-[72px]",
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      <span className="sr-only">{label}</span>
      <span className="absolute inset-x-3 top-1/2 border-t border-dashed border-transparent transition group-hover:border-slate-300/70 group-focus-visible:border-slate-400" />
      <span className="absolute left-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/84 text-slate-400 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
      </span>
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
  onCreateFromSlot: (slot: CalendarCreationSlot) => void;
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
}) {
  const dayItems = items
    .filter((item) => doesCalendarItemOccurOnDate(item, date))
    .map(enrichCalendarClientItem);
  const contextItems = dayItems.filter(isWeekBandCalendarItem);
  const timedItems = dayItems.filter((item) => !isWeekBandCalendarItem(item));
  const visibleContextItem = contextItems[0];
  const contextOverflowCount = Math.max(contextItems.length - 1, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/52">
      {visibleContextItem ? (
        <div
          aria-label={`Project context for ${getCalendarCompactDayLabel(date)}`}
          className="grid min-h-8 grid-cols-[58px_1fr] border-b border-slate-200/80 bg-white/32 sm:grid-cols-[80px_1fr]"
          role="region"
        >
          <div className="flex items-center justify-end border-r border-slate-200/80 px-2 text-right text-[9px] font-semibold text-slate-400 sm:px-3 sm:text-[10px]">
            Project context
          </div>
          <div className="flex min-w-0 items-center gap-1.5 px-1.5 py-1 sm:px-2">
            <button
              aria-label={getProjectContextItemAccessibleLabel(visibleContextItem)}
              className={[
                `flex h-6 min-w-0 max-w-full items-center gap-1 overflow-hidden rounded px-1.5 text-left text-[10px] font-semibold leading-3 transition sm:max-w-[min(28rem,75%)] ${calmFocusRing}`,
                getCalendarEventStyle(visibleContextItem),
                selectedId === visibleContextItem.id
                  ? "ring-2 ring-slate-900/30 ring-offset-1"
                  : "",
              ].join(" ")}
              onClick={() => onSelect(visibleContextItem)}
              type="button"
            >
              <span className="hidden shrink-0 opacity-70 sm:inline">
                {getCalendarFilledLabel(visibleContextItem)}
              </span>
              <span className="min-w-0 truncate">
                {getCalendarItemDisplayName(visibleContextItem)}
              </span>
            </button>
            {contextOverflowCount > 0 ? (
              <span
                aria-label={`${contextOverflowCount} more project context item${contextOverflowCount === 1 ? "" : "s"} available in Week and Month views`}
                className="shrink-0 text-[10px] font-semibold text-slate-400"
                title="Additional project context is available in Week and Month views"
              >
                +{contextOverflowCount}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div data-calendar-arrow-group="day-hours">
        {dayTimelineSlots.map((slot) => {
          const slotItems = timedItems.filter(
            (item) => getCalendarItemStartHour(item) === slot.hour,
          );

          return (
            <div
              className="grid min-h-[58px] grid-cols-[58px_1fr] border-b border-slate-200/80 bg-white/20 sm:min-h-[64px] sm:grid-cols-[80px_1fr]"
              key={slot.hour}
            >
              <div className="border-r border-slate-200/80 bg-white/42 px-2 py-2 text-right text-[11px] font-semibold text-slate-400 sm:px-4 sm:py-3 sm:text-xs">
                {slot.label}
              </div>
              <div className="relative min-w-0">
                <button
                  aria-label={`Plan project work on ${getCalendarCompactDayLabel(date)} at ${slot.label}`}
                  className={`absolute inset-0 cursor-pointer transition hover:bg-slate-50/45 focus-visible:ring-inset ${calmFocusRing}`}
                  data-calendar-arrow-target="day-hour"
                  onClick={() =>
                    onCreateFromSlot({
                      date,
                      label: `${getCalendarCompactDayLabel(date)} at ${slot.label}`,
                      contextLabel: "Suggested from calendar time row",
                      suggestedStartTime: slot.start,
                      suggestedEndTime: slot.end,
                    })
                  }
                  onKeyDown={(event) =>
                    handleCalendarGridArrowKey(event, slot.hour, 1)
                  }
                  type="button"
                />
                {slotItems.length > 0 ? (
                  <div className="pointer-events-none relative z-10 grid gap-1.5 p-1.5 sm:p-2 xl:grid-cols-2">
                    {slotItems.map((item) => (
                      <div className="pointer-events-auto" key={item.id}>
                        <CalendarBlock
                          isSelected={selectedId === item.id}
                          item={item}
                          onSelect={() => onSelect(item)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function deriveCalendarMonthDates(referenceDate: string) {
  const reference = new Date(`${referenceDate}T00:00:00Z`);
  const firstOfMonth = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );
  const start = new Date(firstOfMonth);
  start.setUTCDate(firstOfMonth.getUTCDate() - firstOfMonth.getUTCDay());

  const daysInMonth = new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  const dateCount = firstOfMonth.getUTCDay() + daysInMonth > 35 ? 42 : 35;

  return Array.from({ length: dateCount }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

const monthMobileVisibleItemLimit = 3;
const monthDesktopVisibleItemLimit = 6;

function MonthView({
  items,
  onCreateFromSlot,
  onFocusDate,
  selectedId,
  onSelect,
  referenceDate,
}: {
  items: CalendarItem[];
  onCreateFromSlot: (slot: CalendarCreationSlot) => void;
  onFocusDate: (date: string) => void;
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
  referenceDate: string;
}) {
  const dates = deriveCalendarMonthDates(referenceDate);
  const reference = new Date(`${referenceDate}T00:00:00Z`);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/52">
      <div className="grid grid-cols-7 border-b border-slate-200/80 bg-white/62">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div className="px-2 py-2 text-center text-xs font-semibold text-slate-500" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" data-calendar-arrow-group="month-dates">
        {dates.map((date, dateIndex) => {
          const dateItems = items
            .filter((item) => doesCalendarItemOccurOnDate(item, date))
            .map(enrichCalendarClientItem);
          const mobileOverflowCount = Math.max(
            dateItems.length - monthMobileVisibleItemLimit,
            0,
          );
          const desktopOverflowCount = Math.max(
            dateItems.length - monthDesktopVisibleItemLimit,
            0,
          );
          const inMonth =
            new Date(`${date}T00:00:00Z`).getUTCMonth() === reference.getUTCMonth();

          return (
            <div
              className={[
                "relative min-h-24 border-r border-b border-slate-200/80 last:border-r-0 sm:min-h-36",
                inMonth ? "bg-white/24" : "bg-slate-50/42 opacity-45",
              ].join(" ")}
              data-calendar-month-cell={date}
              key={date}
            >
              <button
                aria-label={`Plan project work on ${getCalendarCompactDayLabel(date)}`}
                className={`absolute inset-0 z-0 cursor-pointer transition hover:bg-slate-50/55 focus-visible:ring-inset ${calmFocusRing}`}
                data-calendar-arrow-target="month-date"
                onClick={() =>
                  onCreateFromSlot({
                    date,
                    label: getCalendarCompactDayLabel(date),
                    contextLabel: "Suggested from calendar day",
                    suggestedStartTime: suggestedSlots.morning.start,
                    suggestedEndTime: suggestedSlots.morning.end,
                  })
                }
                onKeyDown={(event) =>
                  handleCalendarGridArrowKey(event, dateIndex, 7)
                }
                type="button"
              />
              <div className="pointer-events-none relative z-10 flex min-h-24 flex-col p-1 sm:min-h-36 sm:p-1.5">
                <span className="text-[10px] font-semibold leading-3 text-slate-500 sm:text-xs sm:leading-4">
                  {Number(date.slice(-2))}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dateItems.slice(0, monthDesktopVisibleItemLimit).map((item, index) => (
                    <button
                      aria-label={getCalendarItemAccessibleLabel(item)}
                      className={[
                        `pointer-events-auto h-4 w-full rounded px-1 text-left text-[10px] font-semibold leading-3 transition ${calmFocusRing}`,
                        index >= monthMobileVisibleItemLimit ? "hidden sm:block" : "",
                        getCalendarEventStyle(item),
                        selectedId === item.id
                          ? "ring-2 ring-slate-900/30 ring-offset-1"
                          : "",
                      ].join(" ")}
                      key={item.id}
                      onClick={() => onSelect(item)}
                      type="button"
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="hidden shrink-0 opacity-70 sm:inline">
                          {getCalendarFilledLabel(item)}
                        </span>
                        <span className="min-w-0 truncate">
                          {getCalendarItemDisplayName(item)}
                        </span>
                      </span>
                    </button>
                  ))}
                  {mobileOverflowCount > 0 ? (
                    <button
                      aria-label={`Switch to Day view for ${getCalendarCompactDayLabel(date)} to show ${mobileOverflowCount} more calendar item${mobileOverflowCount === 1 ? "" : "s"}`}
                      className={`pointer-events-auto text-[10px] font-semibold text-slate-400 transition hover:text-slate-700 sm:hidden ${calmFocusRing}`}
                      onClick={() => onFocusDate(date)}
                      type="button"
                    >
                      +{mobileOverflowCount}
                    </button>
                  ) : null}
                  {desktopOverflowCount > 0 ? (
                    <button
                      aria-label={`Switch to Day view for ${getCalendarCompactDayLabel(date)} to show ${desktopOverflowCount} more calendar item${desktopOverflowCount === 1 ? "" : "s"}`}
                      className={`pointer-events-auto hidden text-[11px] font-semibold text-slate-400 transition hover:text-slate-700 sm:inline-flex ${calmFocusRing}`}
                      onClick={() => onFocusDate(date)}
                      type="button"
                    >
                      +{desktopOverflowCount}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getCalendarListItemScheduleLabel(item: CalendarItem) {
  return getCalendarItemScheduleDisplay(item).label;
}

function getCalendarListItemAccessibleLabel(item: CalendarItemWithPreset) {
  return [
    getCalendarItemDisplayName(item),
    getCalendarListItemScheduleLabel(item),
    `${item.filledCount} of ${item.neededCount} helpers`,
    getCalendarHighLevelTaskTypeLabel(getCalendarHighLevelTaskType(item)),
  ].join(", ");
}

function CalendarListView({
  items,
  onSelect,
  referenceDate,
  selectedId,
}: {
  items: CalendarItem[];
  onSelect: (item: CalendarItemWithPreset) => void;
  referenceDate: string;
  selectedId?: string;
}) {
  const weekRange = deriveCalendarWeekRange(referenceDate);
  const groups = Array.from(
    items.reduce<Map<string, CalendarItemWithPreset[]>>((grouped, item) => {
      const groupDate = item.date < weekRange.start ? weekRange.start : item.date;
      const currentItems = grouped.get(groupDate) ?? [];

      grouped.set(groupDate, [...currentItems, enrichCalendarClientItem(item)]);
      return grouped;
    }, new Map()),
  )
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, groupItems]) => ({
      date,
      items: [...groupItems].sort((first, second) => {
        const firstIsTimed = getCalendarItemPreviewTimingKind(first) === "timed";
        const secondIsTimed = getCalendarItemPreviewTimingKind(second) === "timed";

        if (firstIsTimed !== secondIsTimed) {
          return firstIsTimed ? 1 : -1;
        }

        if (firstIsTimed && secondIsTimed) {
          const timeDifference =
            getCalendarItemStartMinutes(first) - getCalendarItemStartMinutes(second);

          if (timeDifference !== 0) {
            return timeDifference;
          }
        }

        return getCalendarItemDisplayName(first).localeCompare(
          getCalendarItemDisplayName(second),
        );
      }),
    }));

  if (groups.length === 0) {
    return (
      <section className="border-y border-slate-200/80 bg-white/24 px-3 py-6 text-center">
        <p className="text-sm font-medium text-slate-500">
          No project work to show this week.
        </p>
      </section>
    );
  }

  return (
    <div
      className="overflow-hidden border-y border-slate-200/90 bg-white/24"
      data-testid="calendar-list-view"
    >
      {groups.map((group) => {
        const headingId = `calendar-list-${group.date}`;

        return (
          <section
            aria-labelledby={headingId}
            className="border-b border-slate-200/70 last:border-b-0"
            key={group.date}
          >
            <header className="flex min-h-9 items-center justify-between gap-3 bg-slate-100/38 px-3 py-1.5">
              <h3
                className="text-[13px] font-semibold tracking-tight text-slate-900"
                id={headingId}
              >
                <time dateTime={group.date}>
                  {getCalendarAccessibleDayLabel(group.date)}
                </time>
              </h3>
              <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                {group.items.length} item{group.items.length === 1 ? "" : "s"}
              </span>
            </header>

            <div aria-label={`Project work for ${getCalendarAccessibleDayLabel(group.date)}`} role="list">
              {group.items.map((item) => {
                const scheduleLabel = getCalendarListItemScheduleLabel(item);
                const typeLabel = getCalendarHighLevelTaskTypeLabel(
                  getCalendarHighLevelTaskType(item),
                );

                return (
                  <div
                    className="border-t border-slate-200/60 first:border-t-0"
                    key={item.id}
                    role="listitem"
                  >
                    <button
                      aria-label={getCalendarListItemAccessibleLabel(item)}
                      className={[
                        `grid min-h-[72px] w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 text-left transition hover:bg-white/44 sm:min-h-14 sm:grid-cols-[minmax(0,1.15fr)_minmax(11rem,0.9fr)_auto] sm:gap-x-5 sm:px-4 sm:py-2 ${calmFocusRing}`,
                        selectedId === item.id
                          ? "bg-white/64 ring-2 ring-inset ring-slate-900/25"
                          : "",
                      ].join(" ")}
                      onClick={() => onSelect(item)}
                      type="button"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold leading-5 tracking-[-0.01em] text-slate-950 sm:text-sm">
                          {getCalendarItemDisplayName(item)}
                        </p>
                        <p className="mt-1 hidden truncate text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-slate-400 sm:block">
                          {typeLabel}
                        </p>
                      </div>

                      <p className="hidden min-w-0 text-xs font-medium leading-5 text-slate-500 sm:block">
                        {scheduleLabel}
                      </p>
                      <span className="mt-0.5 inline-flex min-h-7 shrink-0 self-start items-center justify-center whitespace-nowrap rounded-full border border-slate-200/80 bg-white/58 px-2.5 text-[11px] font-semibold text-slate-700 sm:mt-0 sm:self-center">
                        {getCalendarFilledLabel(item)} helpers
                      </span>
                      <p className="col-span-2 mt-0.5 text-[11px] font-medium leading-4 text-slate-500 sm:hidden">
                        {scheduleLabel}
                      </p>
                      <p className="col-span-2 truncate text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-slate-400 sm:hidden">
                        {typeLabel}
                      </p>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function MobileDayGroups({
  items,
  onCreateFromSlot,
  referenceDate,
  selectedId,
  onSelect,
}: {
  items: CalendarItem[];
  onCreateFromSlot: (slot: CalendarCreationSlot) => void;
  referenceDate: string;
  selectedId?: string;
  onSelect: (item: CalendarItemWithPreset) => void;
}) {
  const groups = groupCalendarItemsByDay(items, referenceDate);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/52 lg:hidden">
      {groups.map((group) => (
        <section
          className="border-b border-slate-200/80 p-3.5 last:border-b-0"
          key={group.date}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">
              {getCalendarCompactDayLabel(group.date)}
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {group.items.length} item{group.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-3 space-y-2.5">
            {group.items.map((item) => (
                <CalendarBlock
                  isSelected={selectedId === item.id}
                  item={item}
                  key={item.id}
                  onSelect={() => onSelect(item)}
                />
              ))}
            <EmptySlotAffordance
              compact={group.items.length > 0}
              label={`Plan project work on ${getCalendarCompactDayLabel(group.date)}`}
              onSelect={() =>
                onCreateFromSlot({
                  date: group.date,
                  label: getCalendarCompactDayLabel(group.date),
                  contextLabel: "Suggested from calendar day",
                  suggestedStartTime: suggestedSlots.afternoon.start,
                  suggestedEndTime: suggestedSlots.afternoon.end,
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
  canEdit,
  createAction,
  creationDraft,
  currentDate,
  currentView,
  isOpen,
  onClose,
  onDraftChange,
  presets,
}: {
  canEdit: boolean;
  createAction?: CalendarMutationAction;
  creationDraft?: CalendarCreationDraft;
  currentDate: string;
  currentView: CalendarViewMode;
  isOpen: boolean;
  onClose: () => void;
  onDraftChange: (draft: CalendarCreationDraft) => void;
  presets: readonly CalendarTaskPresetOption[];
}) {
  const desktopCloseButtonRef = useRef<HTMLButtonElement>(null);
  const desktopDialogRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLElement>(null);
  const descriptionId = useId();

  useFocusContainment(isOpen, desktopDialogRef, mobileDialogRef);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const closeButton = window.matchMedia("(min-width: 1024px)").matches
        ? desktopCloseButtonRef.current
        : mobileCloseButtonRef.current;

      closeButton?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

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

  const updateDraft = (changes: Partial<CalendarCreationDraft>) => {
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
      aria-hidden={!isOpen}
      className={[
        "fixed inset-0 z-[55] transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      inert={!isOpen}
    >
      <button
        aria-label="Close project work planner backdrop"
        className={[
          "absolute inset-0 bg-slate-950/8 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />

      <aside
        aria-describedby={`${descriptionId}-desktop`}
        aria-label="Plan project work"
        aria-modal="true"
        className={[
          "absolute right-0 top-0 hidden h-full w-[min(420px,calc(100vw-28px))] px-3 py-3 transition-transform duration-200 ease-out lg:block",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        ref={desktopDialogRef}
        tabIndex={-1}
      >
        <GlassCard className="flex h-full flex-col overflow-hidden rounded-2xl p-0 shadow-[0_20px_72px_rgba(15,23,42,0.18)]">
          <CreatePanelContent
            canEdit={canEdit}
            closeButtonRef={desktopCloseButtonRef}
            createAction={createAction}
            creationDraft={creationDraft}
            currentDate={currentDate}
            currentView={currentView}
            descriptionId={`${descriptionId}-desktop`}
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
          aria-describedby={`${descriptionId}-mobile`}
          aria-label="Plan project work"
          aria-modal="true"
          className={[
            "relative max-h-[84vh] overflow-hidden rounded-t-3xl border border-white/72 bg-white/94 shadow-[0_-20px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl transition-transform duration-200 ease-out",
            isOpen ? "translate-y-0" : "translate-y-[calc(100%+48px)]",
          ].join(" ")}
          role="dialog"
          ref={mobileDialogRef}
          tabIndex={-1}
        >
          <CreatePanelContent
            canEdit={canEdit}
            closeButtonRef={mobileCloseButtonRef}
            createAction={createAction}
            creationDraft={creationDraft}
            currentDate={currentDate}
            currentView={currentView}
            descriptionId={`${descriptionId}-mobile`}
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
  canEdit,
  closeButtonRef,
  createAction,
  creationDraft,
  currentDate,
  currentView,
  descriptionId,
  onClose,
  onPresetChange,
  onUpdate,
  presets,
  selectedPreset,
  selectedTaskType,
}: {
  canEdit: boolean;
  closeButtonRef?: Ref<HTMLButtonElement>;
  createAction?: CalendarMutationAction;
  creationDraft: CalendarCreationDraft;
  currentDate: string;
  currentView: CalendarViewMode;
  descriptionId: string;
  onClose: () => void;
  onPresetChange: (presetId: string) => void;
  onUpdate: (changes: Partial<CalendarCreationDraft>) => void;
  presets: readonly CalendarTaskPresetOption[];
  selectedPreset?: CalendarTaskPresetOption;
  selectedTaskType: CalendarHighLevelTaskType;
}) {
  const validationId = useId();
  const isOneOff = creationDraft.mode === "oneOff";
  const hasPresetChoices = presets.length > 0;
  const presetMissing = !isOneOff && (!hasPresetChoices || !selectedPreset);
  const customNameInvalid = isOneOff && creationDraft.customName.trim().length === 0;
  const dateMissing = creationDraft.date.length === 0;
  const allDayEndMissing = creationDraft.allDay && creationDraft.endDate.length === 0;
  const allDayRangeInvalid =
    creationDraft.allDay &&
    !dateMissing &&
    !allDayEndMissing &&
    creationDraft.endDate < creationDraft.date;
  const timedTimeMissing =
    !creationDraft.allDay &&
    (creationDraft.startTime.length === 0 || creationDraft.endTime.length === 0);
  const timedRangeInvalid =
    !creationDraft.allDay &&
    !timedTimeMissing &&
    creationDraft.endTime <= creationDraft.startTime;
  const neededCountInvalid =
    creationDraft.neededCount < 0 || creationDraft.neededCount > 99;
  const unsupportedAllDay = creationDraft.allDay;
  const customNameErrorId = `${validationId}-custom-task-name-error`;
  const dateErrorId = `${validationId}-creation-date-error`;
  const timeErrorId = `${validationId}-creation-time-error`;
  const actionStatusId = `${validationId}-creation-action-status`;
  const dateValidationMessage = dateMissing
    ? "Choose a date."
    : allDayEndMissing
      ? "Choose an end date."
      : allDayRangeInvalid
        ? "End date must be on or after Date."
        : undefined;
  const timeValidationMessage = timedTimeMissing
    ? "Choose both a start and end time."
    : timedRangeInvalid
      ? "End time must be later than Start."
      : undefined;
  const actionStatus =
    (customNameInvalid && "Add a custom task name.") ||
    dateValidationMessage ||
    timeValidationMessage ||
    (neededCountInvalid && "Needed must be between 0 and 99.") ||
    (presetMissing && "Choose an available persisted task preset, or use Custom one-off.") ||
    (unsupportedAllDay && "No-specific-time items are still read-only; create a timed item for now.") ||
    (!canEdit && "Calendar editing is unavailable for this signed-in project contact.") ||
    (isOneOff
      ? "Ready to save this custom one-off timed item to the persisted Calendar."
      : "Ready to save this task-preset timed item to the persisted Calendar.");
  const canSubmitPersisted =
    canEdit &&
    Boolean(createAction) &&
    !presetMissing &&
    !unsupportedAllDay &&
    !customNameInvalid &&
    !dateValidationMessage &&
    !timeValidationMessage &&
    !neededCountInvalid;
  const creationContextCopy = dateMissing
    ? "Choose a date below."
    : creationDraft.allDay
      ? creationDraft.endDate && creationDraft.endDate !== creationDraft.date
        ? `Suggested project window from ${getCalendarAccessibleDayLabel(creationDraft.date)} through ${getCalendarAccessibleDayLabel(creationDraft.endDate)}. Adjust below.`
        : `Suggested ${getCalendarAccessibleDayLabel(creationDraft.date)}, with no specific time. Adjust below.`
      : creationDraft.startTime && creationDraft.endTime
        ? `Suggested ${getCalendarAccessibleDayLabel(creationDraft.date)}, ${getCreationTimeLabel(creationDraft.startTime)} to ${getCreationTimeLabel(creationDraft.endTime)}. Adjust below.`
        : `Suggested ${getCalendarAccessibleDayLabel(creationDraft.date)}. Add a start and end time below.`;

  return (
    <>
      <p className="sr-only" id={descriptionId}>
        Create a persisted timed Calendar item from a task preset or custom one-off source.
        Drafts, publishing, and helper assignment remain unavailable.
      </p>
      <div className="shrink-0 border-b border-slate-200/70 px-4 py-4 sm:px-5">
        <div className="mx-auto mb-2 h-1.5 w-11 rounded-full bg-slate-200 lg:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Calendar item
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Plan project work
            </h2>
          </div>
          <button
            aria-label="Close project work planner"
            className={`inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-white hover:text-slate-950 ${calmFocusRing}`}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <section className="rounded-xl border border-slate-200/70 bg-white/72 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            Calendar context
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {creationDraft.slot.contextLabel ?? "Suggested from calendar"}
          </p>
          <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
            {creationContextCopy}
          </p>
        </section>

        <section className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Task
          </p>
          <div
            aria-label="Task source"
            className="mt-2 grid grid-cols-2 gap-2"
            role="group"
          >
            <button
              aria-pressed={!isOneOff}
              className={[
                `min-h-11 rounded-full border px-3 text-sm font-semibold transition ${calmFocusRing}`,
                !isOneOff
                  ? "border-slate-950 bg-slate-950 text-white"
                  : hasPresetChoices
                    ? "border-slate-200 bg-white/72 text-slate-600 hover:bg-white"
                    : "cursor-not-allowed border-slate-200 bg-white/72 text-slate-500 opacity-70",
              ].join(" ")}
              disabled={!hasPresetChoices}
              onClick={() => {
                if (!hasPresetChoices) return;
                const nextPreset = selectedPreset ?? presets[0];
                onUpdate({
                  mode: "preset",
                  presetId: nextPreset.id,
                  neededCount: nextPreset.neededCount,
                });
              }}
              type="button"
            >
              Task preset
            </button>
            <button
              aria-pressed={isOneOff}
              className={[
                `min-h-11 rounded-full border px-3 text-sm font-semibold transition ${calmFocusRing}`,
                isOneOff
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white/72 text-slate-600 hover:bg-white",
              ].join(" ")}
                onClick={() => onUpdate({ mode: "oneOff", neededCount: creationDraft.neededCount })}
              type="button"
            >
              Custom one-off
            </button>
          </div>

          {!hasPresetChoices ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              No persisted task presets are available to this Calendar context yet.
              Custom one-off scheduling remains available.
            </p>
          ) : null}

          {!isOneOff ? (
            <label className="mt-3 block">
              <span className="text-sm font-semibold text-slate-700">Task preset</span>
              <select
                aria-label="Task preset"
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
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
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Custom task name</span>
                <input
                  aria-describedby={customNameInvalid ? customNameErrorId : undefined}
                  aria-invalid={customNameInvalid}
                  className={[
                    "mt-2 min-h-11 w-full rounded-xl border bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1",
                    customNameInvalid ? "border-rose-300" : "border-slate-200",
                  ].join(" ")}
                  onChange={(event) => onUpdate({ customName: event.target.value })}
                  value={creationDraft.customName}
                />
              </label>
              {customNameInvalid ? (
                <span
                  className="text-xs font-semibold text-rose-600"
                  id={customNameErrorId}
                >
                  Add a custom task name.
                </span>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Task type</span>
                <select
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
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
              <p className="text-sm leading-6 text-slate-500">
                One-off work stays with this calendar item and does not create a reusable task
                preset.
              </p>
            </div>
          )}
        </section>

        <section className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Timing
          </p>
          <label className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/72 px-3 text-sm font-semibold text-slate-700">
            <input
              checked={creationDraft.allDay}
              className="h-4 w-4 accent-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-2"
              onChange={(event) =>
                onUpdate(
                  event.target.checked
                    ? {
                        allDay: true,
                        endDate:
                          creationDraft.endDate < creationDraft.date
                            ? creationDraft.date
                            : creationDraft.endDate,
                        endTime: "",
                        startTime: "",
                      }
                    : {
                        allDay: false,
                        endDate: creationDraft.date,
                        endTime:
                          creationDraft.slot.suggestedEndTime ??
                          suggestedSlots.morning.end,
                        startTime:
                          creationDraft.slot.suggestedStartTime ??
                          suggestedSlots.morning.start,
                      },
                )
              }
              type="checkbox"
            />
            No specific time
          </label>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label
              className={[
                "block min-w-0",
                creationDraft.allDay ? "" : "sm:col-span-2",
              ].join(" ")}
            >
              <span className="text-sm font-semibold text-slate-700">Date</span>
              <input
                aria-describedby={dateValidationMessage ? dateErrorId : undefined}
                aria-invalid={Boolean(dateValidationMessage)}
                className={[
                  "mt-2 min-h-11 w-full rounded-xl border bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1",
                  dateValidationMessage ? "border-rose-300" : "border-slate-200",
                ].join(" ")}
                onChange={(event) => {
                  const date = event.target.value;

                  onUpdate({
                    date,
                    ...(creationDraft.allDay && creationDraft.endDate < date
                      ? { endDate: date }
                      : {}),
                  });
                }}
                type="date"
                value={creationDraft.date}
              />
            </label>
            {creationDraft.allDay ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">End date</span>
                <input
                  aria-describedby={dateValidationMessage ? dateErrorId : undefined}
                  aria-invalid={Boolean(dateValidationMessage)}
                  className={[
                    "mt-2 min-h-11 w-full rounded-xl border bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1",
                    dateValidationMessage ? "border-rose-300" : "border-slate-200",
                  ].join(" ")}
                  min={creationDraft.date}
                  onChange={(event) =>
                    onUpdate({
                      endDate:
                        event.target.value < creationDraft.date
                          ? creationDraft.date
                          : event.target.value,
                    })
                  }
                  type="date"
                  value={creationDraft.endDate}
                />
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Start</span>
                  <input
                    aria-describedby={timeValidationMessage ? timeErrorId : undefined}
                    aria-invalid={Boolean(timeValidationMessage)}
                    className={[
                      "mt-2 min-h-11 w-full rounded-xl border bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1",
                      timeValidationMessage ? "border-rose-300" : "border-slate-200",
                    ].join(" ")}
                    onChange={(event) => onUpdate({ startTime: event.target.value })}
                    type="time"
                    value={creationDraft.startTime}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">End</span>
                  <input
                    aria-describedby={timeValidationMessage ? timeErrorId : undefined}
                    aria-invalid={Boolean(timeValidationMessage)}
                    className={[
                      "mt-2 min-h-11 w-full rounded-xl border bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1",
                      timeValidationMessage ? "border-rose-300" : "border-slate-200",
                    ].join(" ")}
                    onChange={(event) => onUpdate({ endTime: event.target.value })}
                    type="time"
                    value={creationDraft.endTime}
                  />
                </label>
              </>
            )}
            {dateValidationMessage ? (
              <p
                className="text-xs font-semibold text-rose-600 sm:col-span-2"
                id={dateErrorId}
              >
                {dateValidationMessage}
              </p>
            ) : null}
            {timeValidationMessage ? (
              <p
                className="text-xs font-semibold text-rose-600 sm:col-span-2"
                id={timeErrorId}
              >
                {timeValidationMessage}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-[1fr_132px]">
          <div className="rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Preset defaults
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-950">
              {isOneOff
                ? creationDraft.customName || "Custom one-off task"
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
            {!isOneOff && selectedPreset?.description ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {selectedPreset.description}
              </p>
            ) : null}
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
            {isOneOff ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                This schedules a persisted one-off item without creating a reusable task preset.
              </p>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Needed</span>
            <input
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
              max={99}
              min={0}
              onChange={(event) =>
                onUpdate({
                  neededCount: Math.min(
                    99,
                    Math.max(0, Number(event.target.value) || 0),
                  ),
                })
              }
              type="number"
              value={creationDraft.neededCount}
            />
            {!isOneOff && selectedPreset ? (
              <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">
                Preset default: {selectedPreset.neededCount} · 0-99
              </span>
            ) : (
              <span className="mt-2 block text-xs font-medium leading-5 text-slate-500">
                0-99 helpers
              </span>
            )}
          </label>
        </section>

        <section className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <Users aria-hidden="true" className="h-3.5 w-3.5" />
            Helpers and notes
          </p>
          <label className="mt-2 block">
            <span className="text-sm font-semibold text-slate-700">Schedule notes</span>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-3 text-sm font-medium leading-6 text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
              onChange={(event) => onUpdate({ notes: event.target.value })}
              placeholder="Add planning notes for this work..."
              value={creationDraft.notes}
            />
          </label>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <p className="text-sm leading-6 text-slate-600">
              Helper assignment, draft/publish controls, and notifications stay later.
              The Follow-up Contact defaults safely to the signed-in scheduler.
            </p>
          </div>
        </section>

      </div>

      <div className="shrink-0 border-t border-slate-200/70 px-4 py-4 sm:px-5">
        <form action={createAction} className="grid gap-2">
          <input name="redirectView" type="hidden" value={currentView} />
          <input name="redirectDate" type="hidden" value={currentDate} />
          <input name="sourceMode" type="hidden" value={creationDraft.mode === "preset" ? "preset" : "oneOff"} />
          <input name="taskPresetId" type="hidden" value={creationDraft.mode === "preset" ? creationDraft.presetId : ""} />
          <input name="title" type="hidden" value={creationDraft.customName} />
          <input
            name="taskType"
            type="hidden"
            value={mapHighLevelTaskTypeToCalendarTaskType(creationDraft.customTaskType)}
          />
          <input name="date" type="hidden" value={creationDraft.date} />
          <input name="startTime" type="hidden" value={creationDraft.startTime} />
          <input name="endTime" type="hidden" value={creationDraft.endTime} />
          <input name="neededCount" type="hidden" value={String(creationDraft.neededCount)} />
          <input name="notes" type="hidden" value={creationDraft.notes} />
          <p
            aria-live="polite"
            className={[
              "mb-1 text-xs font-semibold leading-5",
              canSubmitPersisted ? "text-slate-500" : "text-rose-600",
            ].join(" ")}
            id={actionStatusId}
          >
            {actionStatus}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              aria-describedby={actionStatusId}
              className={[
                "min-h-11 rounded-full border px-3 text-sm font-semibold transition",
                canSubmitPersisted
                  ? "border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
                  : "cursor-not-allowed border-slate-200 bg-white/72 text-slate-500 opacity-75",
              ].join(" ")}
              disabled={!canSubmitPersisted}
              type="submit"
            >
              Schedule
            </button>
            {["Save draft", "Assign helpers"].map((label) => (
              <button
                aria-describedby={actionStatusId}
                className="min-h-11 cursor-not-allowed rounded-full border border-slate-200 bg-white/72 px-3 text-sm font-semibold text-slate-500 opacity-75"
                disabled
                key={label}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </form>
      </div>
    </>
  );
}

function CalendarInspector({
  canEdit,
  item,
  isOpen,
  onClose,
  updateAction,
  currentDate,
  currentView,
}: {
  canEdit: boolean;
  item?: CalendarItemWithPreset;
  isOpen: boolean;
  onClose: () => void;
  updateAction?: CalendarMutationAction;
  currentDate: string;
  currentView: CalendarViewMode;
}) {
  const desktopCloseButtonRef = useRef<HTMLButtonElement>(null);
  const desktopDialogRef = useRef<HTMLElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLElement>(null);
  const descriptionId = useId();

  useFocusContainment(isOpen, desktopDialogRef, mobileDialogRef);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const closeButton = window.matchMedia("(min-width: 1024px)").matches
        ? desktopCloseButtonRef.current
        : mobileCloseButtonRef.current;

      closeButton?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  if (!item) {
    return null;
  }

  const tone = getCalendarStatusTone(item.status);

  return (
    <div
      aria-hidden={!isOpen}
      className={[
        "fixed inset-0 z-50 transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      inert={!isOpen}
    >
      <button
        aria-label="Close calendar item inspector backdrop"
        className={[
          "absolute inset-0 hidden bg-slate-950/12 transition-opacity lg:block",
          isOpen ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <aside
        aria-describedby={`${descriptionId}-desktop`}
        aria-label="Calendar item inspector"
        aria-modal="true"
        className={[
          "absolute right-0 top-0 hidden h-full w-[min(420px,calc(100vw-28px))] px-3 py-3 transition-transform duration-200 ease-out lg:block",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        ref={desktopDialogRef}
        tabIndex={-1}
      >
        <div
          className={`flex h-full flex-col overflow-hidden rounded-2xl border border-white/72 border-l-4 bg-white/88 shadow-[0_24px_90px_rgba(15,23,42,0.22)] backdrop-blur-2xl ${detailAccentStyles[item.category]}`}
        >
          <InspectorContent
            canEdit={canEdit}
            closeButtonRef={desktopCloseButtonRef}
            currentDate={currentDate}
            currentView={currentView}
            descriptionId={`${descriptionId}-desktop`}
            item={item}
            onClose={onClose}
            tone={tone}
            updateAction={updateAction}
          />
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
          tabIndex={-1}
          type="button"
        />
        <section
          aria-describedby={`${descriptionId}-mobile`}
          aria-label="Calendar item inspector"
          aria-modal="true"
          className={[
            `relative max-h-[82vh] overflow-hidden rounded-t-3xl border border-white/72 border-t-4 bg-white/92 shadow-[0_-20px_80px_rgba(15,23,42,0.24)] backdrop-blur-2xl transition-transform duration-200 ease-out ${detailAccentStyles[item.category].replace("border-l", "border-t")}`,
            isOpen ? "translate-y-0" : "translate-y-[calc(100%+48px)]",
          ].join(" ")}
          role="dialog"
          ref={mobileDialogRef}
          tabIndex={-1}
        >
          <InspectorContent
            canEdit={canEdit}
            closeButtonRef={mobileCloseButtonRef}
            currentDate={currentDate}
            currentView={currentView}
            descriptionId={`${descriptionId}-mobile`}
            item={item}
            onClose={onClose}
            tone={tone}
            updateAction={updateAction}
          />
        </section>
      </div>
    </div>
  );
}

function InspectorContent({
  canEdit,
  closeButtonRef,
  currentDate,
  currentView,
  descriptionId,
  item,
  tone,
  onClose,
  updateAction,
}: {
  canEdit: boolean;
  closeButtonRef?: Ref<HTMLButtonElement>;
  currentDate: string;
  currentView: CalendarViewMode;
  descriptionId: string;
  item: CalendarItemWithPreset;
  tone: CalendarStatusTone;
  onClose: () => void;
  updateAction?: CalendarMutationAction;
}) {
  const scheduleDisplay = getCalendarItemScheduleDisplay(item);
  const isOneOffItem = isOneOffCalendarItem(item);
  const isPresetBackedItem = Boolean(item.taskPresetId) && !isOneOffItem;
  const canEditSelectedItem =
    canEdit &&
    Boolean(updateAction) &&
    (isOneOffItem || isPresetBackedItem) &&
    !item.allDay &&
    Boolean(item.startTimeValue) &&
    Boolean(item.endTimeValue);
  const placeholderActions = [
    { label: "Add to calendar", icon: Plus },
    { label: "Edit placement", icon: Pencil },
    { label: "Assign helpers later", icon: UserPlus },
    { label: "Repeat later", icon: Repeat },
    { label: "Copy later", icon: Copy },
  ];

  return (
    <>
      <p className="sr-only" id={descriptionId}>
        {getCalendarItemAccessibleLabel(item)}. Review schedule, helper, status, and
        source details for this Calendar item.
      </p>
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
            className={`inline-flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-white hover:text-slate-950 ${calmFocusRing}`}
            onClick={onClose}
            ref={closeButtonRef}
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
            {scheduleDisplay.heading}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {scheduleDisplay.label}
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
                Helper names are not shown in this read-only Calendar view.
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

        {canEditSelectedItem ? (
          <form action={updateAction} className="mt-5 rounded-xl border border-slate-200/70 bg-white/70 px-4 py-4">
            <input name="calendarItemId" type="hidden" value={item.id} />
            <input name="redirectView" type="hidden" value={currentView} />
            <input name="redirectDate" type="hidden" value={currentDate} />
            <input name="sourceMode" type="hidden" value={isPresetBackedItem ? "preset" : "oneOff"} />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {isPresetBackedItem ? "Edit persisted preset item" : "Edit persisted one-off item"}
            </p>
            <div className="mt-3 grid gap-3">
              {isOneOffItem ? (
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Task name</span>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
                    defaultValue={getCalendarItemDisplayName(item)}
                    maxLength={160}
                    name="title"
                    required
                  />
                </label>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Task preset
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">
                    {item.taskPreset?.name ?? getCalendarItemDisplayName(item)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    This edit changes only this scheduled occurrence. Preset selection
                    and reusable task editing remain separate.
                  </p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Date</span>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
                    defaultValue={item.date}
                    name="date"
                    required
                    type="date"
                  />
                </label>
                {isOneOffItem ? (
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Task type</span>
                    <select
                      className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
                      defaultValue={mapCategoryToCalendarTaskType(item.category)}
                      name="taskType"
                    >
                      <option value="general">General</option>
                      <option value="food">Food</option>
                      <option value="security">Security</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                ) : null}
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Start</span>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
                    defaultValue={item.startTimeValue}
                    name="startTime"
                    required
                    type="time"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">End</span>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
                    defaultValue={item.endTimeValue}
                    name="endTime"
                    required
                    type="time"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700">Needed</span>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
                    defaultValue={item.neededCount}
                    max={99}
                    min={0}
                    name="neededCount"
                    required
                    type="number"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Schedule notes</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-3 text-sm font-medium leading-6 text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1"
                  defaultValue={item.scheduleNotes ?? ""}
                  maxLength={4000}
                  name="notes"
                />
              </label>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                Follow-up Contact stays with the original scheduled item. Assignment,
                publication, copy, and delivery changes stay unavailable.
              </p>
              <button
                className="min-h-11 rounded-full border border-slate-950 bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                type="submit"
              >
                Save item changes
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 rounded-xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-500">
            This item is read-only here unless it is a persisted timed one-off or
            task-preset occurrence and the signed-in contact has Calendar edit access.
          </div>
        )}

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

export type CalendarClientState =
  | Readonly<{
      kind: "ready_with_items" | "ready_empty";
      items: Array<CalendarItem & { taskPreset?: CalendarTaskPresetOption }>;
      canEdit: boolean;
      canViewTaskPresets: boolean;
      taskPresetSelector: CalendarTaskPresetSelectorState;
      view: CalendarViewMode;
      anchorDate: string;
      queriedRange: CalendarClientQueriedRange;
    }>
  | Readonly<{
      kind: "unavailable" | "error";
      title: string;
      message: string;
      view: CalendarViewMode;
      anchorDate: string;
      queriedRange: CalendarClientQueriedRange;
    }>;

type CalendarClientQueriedRange = Readonly<{
  rangeStart: string;
  rangeEnd: string;
  periodKind: CalendarViewMode;
  anchorDate: string;
  bounded: true;
  rangeSemantics: "server_derived_start_inclusive_end_exclusive";
}>;

function CalendarNotice({ notice }: { notice?: string }) {
  if (!notice) return null;
  const copy: Record<string, { title: string; message: string }> = {
    created: {
      title: "Calendar item scheduled",
      message: "The timed item was saved to the persisted Calendar.",
    },
    updated: {
      title: "Calendar item updated",
      message: "The edited item was saved and will remain after reload.",
    },
    validation: {
      title: "Check the Calendar details",
      message: "Use a timed item with a real date, ordered start/end times, 0-99 helpers, and bounded notes.",
    },
    unavailable: {
      title: "Calendar editing is unavailable",
      message: "This signed-in project contact cannot safely change Calendar items right now.",
    },
    error: {
      title: "Calendar change was not saved",
      message: "Something went wrong while saving. No mock Calendar fallback was used.",
    },
  };
  const selected = copy[notice];
  if (!selected) return null;
  return (
    <GlassCard className="border-slate-200/80 bg-white/64 p-4">
      <p className="text-sm font-semibold text-slate-950">{selected.title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{selected.message}</p>
    </GlassCard>
  );
}

function buildCalendarRouteHref(view: CalendarViewMode, date: string) {
  const params = new URLSearchParams();
  params.set("view", view);
  params.set("date", date);
  return `/admin/calendar?${params.toString()}`;
}

export default function CalendarClient({
  createAction,
  notice,
  state,
  updateAction,
}: Readonly<{
  createAction?: CalendarMutationAction;
  notice?: string;
  state: CalendarClientState;
  updateAction?: CalendarMutationAction;
}>) {
  const router = useRouter();
  const isReady = state.kind === "ready_with_items" || state.kind === "ready_empty";
  const isReadyEmpty = state.kind === "ready_empty";
  const allItems = useMemo(() => (isReady ? state.items : []), [isReady, state]);
  const creationPresets = useMemo(() => {
    if (
      state.kind !== "ready_with_items" &&
      state.kind !== "ready_empty"
    ) {
      return [];
    }

    if (state.taskPresetSelector.kind !== "ready_with_presets") {
      return [];
    }

    return state.taskPresetSelector.presets;
  }, [state]);
  const activeView = state.view;
  const calendarAnchor = state.anchorDate;
  const [filters, setFilters] = useState<CalendarFilterOptions>({});
  const [activeSurface, setActiveSurface] = useState<CalendarSurface>("none");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [creationDraft, setCreationDraft] = useState<
    CalendarCreationDraft | undefined
  >();
  const surfaceTriggerRef = useRef<HTMLElement | null>(null);

  const filteredItems = useMemo(
    () => filterCalendarItems(allItems, filters),
    [allItems, filters],
  );
  const weekRange = deriveCalendarWeekRange(calendarAnchor);
  const visibleItems = useMemo(() => {
    if (activeView === "day") {
      return filteredItems.filter((item) =>
        doesCalendarItemOccurOnDate(item, calendarAnchor),
      );
    }

    if (activeView === "month") {
      const month = calendarAnchor.slice(0, 7);

      return filteredItems.filter((item) => item.date.startsWith(month));
    }

    return filteredItems.filter((item) =>
      doesCalendarItemOverlapDateRange(item, weekRange.start, weekRange.end),
    );
  }, [activeView, calendarAnchor, filteredItems, weekRange.end, weekRange.start]);

  const activeFilterCount = getCalendarActiveFilterCount(filters);
  const activeFilterSummary = getCalendarActiveFilterSummary(filters);

  const selectedItem = selectedId
    ? filteredItems.map(enrichCalendarClientItem).find((item) => item.id === selectedId)
    : undefined;

  const rememberSurfaceTrigger = () => {
    if (document.activeElement instanceof HTMLElement) {
      surfaceTriggerRef.current = document.activeElement;
    }
  };

  const closeCalendarSurface = () => {
    const shouldRestoreFocus = activeSurface !== "none";
    const trigger = surfaceTriggerRef.current;

    setActiveSurface("none");
    setSelectedId(undefined);
    setCreationDraft(undefined);

    if (shouldRestoreFocus) {
      surfaceTriggerRef.current = null;
      window.requestAnimationFrame(() => {
        if (trigger?.isConnected) {
          trigger.focus();
        }
      });
    }
  };

  const closeMobileNavigation = () => {
    window.dispatchEvent(new Event(closeMobileNavigationEvent));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        activeSurface !== "none" &&
        activeSurface !== "more"
      ) {
        const trigger = surfaceTriggerRef.current;

        setActiveSurface("none");
        setSelectedId(undefined);
        setCreationDraft(undefined);
        surfaceTriggerRef.current = null;
        window.requestAnimationFrame(() => {
          if (trigger?.isConnected) {
            trigger.focus();
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeSurface]);

  const handleSelectCalendarItem = (item: CalendarItemWithPreset) => {
    rememberSurfaceTrigger();
    closeMobileNavigation();
    setCreationDraft(undefined);
    setSelectedId(item.id);
    setActiveSurface("inspect");
  };

  const handleOpenFilters = () => {
    rememberSurfaceTrigger();
    closeMobileNavigation();
    setSelectedId(undefined);
    setCreationDraft(undefined);
    setActiveSurface("filter");
  };

  const handleCreateFromSlot = (slot: CalendarCreationSlot) => {
    if (!isReady || !state.canEdit) {
      return;
    }
    const defaultPreset = creationPresets[0];

    rememberSurfaceTrigger();
    closeMobileNavigation();
    setSelectedId(undefined);
    setCreationDraft({
      slot,
      date: slot.date,
      endDate: slot.date,
      allDay: slot.allDay ?? false,
      startTime: slot.allDay
        ? ""
        : slot.suggestedStartTime ?? suggestedSlots.morning.start,
      endTime: slot.allDay
        ? ""
        : slot.suggestedEndTime ?? suggestedSlots.morning.end,
      mode: "oneOff",
      presetId: defaultPreset?.id ?? "",
      neededCount: defaultPreset?.neededCount ?? 2,
      notes: "",
      customName: "Custom one-off task",
      customTaskType: "generalVolunteers",
    });
    setActiveSurface("create");
  };

  const clearFilters = () => {
    setFilters({});
  };

  const handleViewChange = (view: CalendarViewMode) => {
    closeCalendarSurface();
    router.push(buildCalendarRouteHref(view, calendarAnchor));
  };

  const handleNavigateCalendar = (amount: number) => {
    closeCalendarSurface();
    router.push(
      buildCalendarRouteHref(
        activeView,
        shiftCalendarAnchor(calendarAnchor, amount, activeView),
      ),
    );
  };

  const handleResetCalendar = () => {
    closeCalendarSurface();
    router.push(buildCalendarRouteHref(activeView, projectCalendarAnchor));
  };

  const handleFocusCalendarDate = (date: string) => {
    closeCalendarSurface();
    router.push(buildCalendarRouteHref("day", date));
  };

  return (
    <AdminShell
      active="calendar"
      onMobileMoreClose={closeCalendarSurface}
      onMobileMoreOpen={() => {
        rememberSurfaceTrigger();
        setSelectedId(undefined);
        setCreationDraft(undefined);
        setActiveSurface("more");
      }}
    >
      <header className="px-1 sm:px-0">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <CalendarDays aria-hidden="true" className="h-4 w-4" />
          Belgrade Remodel
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Calendar
        </h1>
      </header>

      <section className="mt-4 space-y-3">
        {isReady ? (
          <>
            <CalendarWorkspaceHeader
              activeFilterCount={activeFilterCount}
              activeFilterSummary={activeFilterSummary}
              activeView={activeView}
              filteredItemCount={visibleItems.length}
              onFilterOpen={handleOpenFilters}
              onNavigateNext={() => handleNavigateCalendar(1)}
              onNavigatePrevious={() => handleNavigateCalendar(-1)}
              onNavigateReset={handleResetCalendar}
              onViewChange={handleViewChange}
              periodLabel={getCalendarPeriodLabel(calendarAnchor, activeView)}
              resetDisabled={calendarAnchor === projectCalendarAnchor}
            />

            <CalendarNotice notice={notice} />

            <ActiveFilterBar filters={filters} onClear={clearFilters} />

            {isReadyEmpty && filteredItems.length === 0 ? (
              <GlassCard className="border-slate-200/80 bg-white/60 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  No scheduled items in this range
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  This Calendar view is ready, but there is no project work scheduled
                  for the selected range yet.
                </p>
              </GlassCard>
            ) : null}

            <div className="space-y-3" id="calendar-view-content">
              {activeView === "day" ? (
                <DayView
                  date={calendarAnchor}
                  items={visibleItems}
                  onCreateFromSlot={handleCreateFromSlot}
                  onSelect={handleSelectCalendarItem}
                  selectedId={selectedItem?.id}
                />
              ) : null}
              {activeView === "week" ? (
                <>
                  <WeekGrid
                    items={visibleItems}
                    onCreateFromSlot={handleCreateFromSlot}
                    onFocusDate={handleFocusCalendarDate}
                    onSelect={handleSelectCalendarItem}
                    referenceDate={weekRange.start}
                    selectedId={selectedItem?.id}
                  />
                  <MobileDayGroups
                    items={visibleItems}
                    onCreateFromSlot={handleCreateFromSlot}
                    onSelect={handleSelectCalendarItem}
                    referenceDate={weekRange.start}
                    selectedId={selectedItem?.id}
                  />
                </>
              ) : null}
              {activeView === "month" ? (
                <MonthView
                  items={visibleItems}
                  onCreateFromSlot={handleCreateFromSlot}
                  onFocusDate={handleFocusCalendarDate}
                  onSelect={handleSelectCalendarItem}
                  referenceDate={calendarAnchor}
                  selectedId={selectedItem?.id}
                />
              ) : null}
              {activeView === "list" ? (
                <CalendarListView
                  items={visibleItems}
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
              canEdit={state.canEdit}
              createAction={createAction}
              creationDraft={creationDraft}
              currentDate={calendarAnchor}
              currentView={activeView}
              isOpen={activeSurface === "create"}
              onClose={closeCalendarSurface}
              onDraftChange={setCreationDraft}
              presets={creationPresets}
            />
            <CalendarInspector
              canEdit={state.canEdit}
              currentDate={calendarAnchor}
              currentView={activeView}
              isOpen={activeSurface === "inspect"}
              item={selectedItem}
              onClose={closeCalendarSurface}
              updateAction={updateAction}
            />
          </>
        ) : state.kind === "unavailable" || state.kind === "error" ? (
          <EmptyState
            title={state.title}
            message={state.message}
          />
        ) : null}
      </section>
    </AdminShell>
  );
}
