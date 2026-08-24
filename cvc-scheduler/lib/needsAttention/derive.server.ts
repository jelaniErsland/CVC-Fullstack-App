import "server-only";

import type { CalendarReadModelItem } from "../calendar/readModel.server.ts";

export const NEEDS_ATTENTION_COVERAGE_WINDOW_DAYS = 14;
export const NEEDS_ATTENTION_RESPONSE_WINDOW_DAYS = 21;
export const NEEDS_ATTENTION_SOON_WINDOW_DAYS = 7;
export const NEEDS_ATTENTION_NEAR_WINDOW_HOURS = 48;
export const NEEDS_ATTENTION_SIGNAL_LIMIT = 100;

export type NeedsAttentionSignalKind = "coverage" | "pending" | "denied";
export type NeedsAttentionSignalGroup = "staffing" | "responses";
export type NeedsAttentionUrgency = "near" | "soon" | "upcoming";

export type NeedsAttentionSignal = Readonly<{
  id: string;
  kind: NeedsAttentionSignalKind;
  group: NeedsAttentionSignalGroup;
  title: string;
  problem: string;
  startDate: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  startsAt: number;
  urgency: NeedsAttentionUrgency;
  affectedCount: number;
  neededCount: number;
  assignedCount: number;
  assignedFractionLabel: string;
  affectedAssignments: readonly Readonly<{
    assignmentId: string;
    responseStatus: "needs_response" | "declined";
  }>[];
  href: string;
}>;

export type NeedsAttentionSummary = Readonly<{
  signals: readonly NeedsAttentionSignal[];
  staffing: readonly NeedsAttentionSignal[];
  responses: readonly NeedsAttentionSignal[];
  totalSignalCount: number;
  totalCandidateCount: number;
  truncated: boolean;
}>;

const hourMs = 60 * 60 * 1_000;
const dayMs = 24 * hourMs;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const signalKindOrder: Record<NeedsAttentionSignalKind, number> = {
  coverage: 0,
  pending: 1,
  denied: 2,
};

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function addNeedsAttentionDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function localPartsAt(epoch: number, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(epoch));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

/** Converts a trusted workspace-local date/time to an epoch without using the host timezone. */
export function calendarStartEpoch(
  item: Pick<CalendarReadModelItem, "scheduleKind" | "startDate" | "startTime">,
  workspaceTimezone: string,
) {
  const dateMatch = datePattern.exec(item.startDate);
  const startTime = item.scheduleKind === "date_based" ? "00:00:00" : item.startTime;
  const timeMatch = startTime ? timePattern.exec(startTime) : null;
  if (!dateMatch || !timeMatch) return null;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: workspaceTimezone }).format(new Date());
  } catch {
    return null;
  }

  const target = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? "0"),
  };
  const targetAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );
  let candidate = targetAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = localPartsAt(candidate, workspaceTimezone);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    candidate += targetAsUtc - localAsUtc;
  }

  const normalized = localPartsAt(candidate, workspaceTimezone);
  return Object.entries(target).every(
    ([key, value]) => normalized[key as keyof typeof normalized] === value,
  )
    ? candidate
    : null;
}

function urgencyFor(startsAt: number, at: number): NeedsAttentionUrgency {
  const remaining = startsAt - at;
  if (remaining <= NEEDS_ATTENTION_NEAR_WINDOW_HOURS * hourMs) return "near";
  if (remaining <= NEEDS_ATTENTION_SOON_WINDOW_DAYS * dayMs) return "soon";
  return "upcoming";
}

function calendarHref(startDate: string) {
  const params = new URLSearchParams({ view: "day", date: startDate });
  return `/admin/calendar?${params.toString()}`;
}

function signal(
  item: CalendarReadModelItem,
  kind: NeedsAttentionSignalKind,
  startsAt: number,
  at: number,
  workspaceTimezone: string,
  affectedCount: number,
): NeedsAttentionSignal {
  const affectedAssignments = (item.assignments ?? [])
    .filter(
      (assignment) =>
        assignment.assignmentLifecycle === "active" &&
        (kind === "pending"
          ? assignment.currentResponseStatus === "needs_response"
          : kind === "denied"
            ? assignment.currentResponseStatus === "declined" ||
              assignment.currentResponseStatus === "denied"
            : false),
    )
    .map((assignment) => ({
      assignmentId: assignment.assignmentId,
      responseStatus: (kind === "pending" ? "needs_response" : "declined") as
        | "needs_response"
        | "declined",
    }));
  const problem =
    kind === "coverage"
      ? `${countLabel(affectedCount, "volunteer")} still needed`
      : kind === "pending"
        ? `${countLabel(affectedCount, "response")} pending`
        : `${countLabel(affectedCount, "volunteer")} can’t make it`;

  return {
    id: `${item.calendarItemId}:${kind}`,
    kind,
    group: kind === "coverage" ? "staffing" : "responses",
    title: item.taskSourceLabel,
    problem,
    startDate: item.startDate,
    startTime: item.startTime,
    endTime: item.endTime,
    timezone: workspaceTimezone,
    startsAt,
    urgency: urgencyFor(startsAt, at),
    affectedCount,
    neededCount: item.neededCount,
    assignedCount: item.coverage.assignedCount,
    assignedFractionLabel: item.assignedFractionLabel,
    affectedAssignments,
    href: calendarHref(item.startDate),
  };
}

/**
 * Derives the canonical MVP staffing/response inbox from an already-authorized
 * Calendar projection. No issue state is persisted and no mutations occur.
 */
export function deriveNeedsAttentionSignals(
  items: readonly CalendarReadModelItem[],
  input: Readonly<{
    at: Date;
    workspaceTimezone: string;
    limit?: number;
  }>,
): NeedsAttentionSummary {
  const at = input.at.getTime();
  const limit = Math.min(
    Math.max(Number.isInteger(input.limit) ? input.limit! : NEEDS_ATTENTION_SIGNAL_LIMIT, 0),
    NEEDS_ATTENTION_SIGNAL_LIMIT,
  );
  if (!Number.isFinite(at) || limit === 0) {
    return {
      signals: [],
      staffing: [],
      responses: [],
      totalSignalCount: 0,
      totalCandidateCount: 0,
      truncated: false,
    };
  }

  const candidates: NeedsAttentionSignal[] = [];
  for (const item of items) {
    if (
      item.lifecycle !== "active" ||
      item.publicationState !== "published" ||
      (item.scheduleKind !== "timed" && item.scheduleKind !== "date_based")
    ) {
      continue;
    }

    const startsAt = calendarStartEpoch(item, input.workspaceTimezone);
    if (startsAt === null || startsAt <= at) continue;
    const remaining = startsAt - at;

    if (
      remaining <= NEEDS_ATTENTION_COVERAGE_WINDOW_DAYS * dayMs &&
      item.neededCount > 0 &&
      item.coverage.unassignedCount > 0
    ) {
      candidates.push(
        signal(
          item,
          "coverage",
          startsAt,
          at,
          input.workspaceTimezone,
          item.coverage.unassignedCount,
        ),
      );
    }
    if (
      remaining <= NEEDS_ATTENTION_RESPONSE_WINDOW_DAYS * dayMs &&
      item.coverage.waitingOnConfirmationCount > 0
    ) {
      candidates.push(
        signal(
          item,
          "pending",
          startsAt,
          at,
          input.workspaceTimezone,
          item.coverage.waitingOnConfirmationCount,
        ),
      );
    }
    if (
      remaining <= NEEDS_ATTENTION_RESPONSE_WINDOW_DAYS * dayMs &&
      item.coverage.deniedCount > 0
    ) {
      candidates.push(
        signal(
          item,
          "denied",
          startsAt,
          at,
          input.workspaceTimezone,
          item.coverage.deniedCount,
        ),
      );
    }
  }

  candidates.sort(
    (left, right) =>
      left.startsAt - right.startsAt ||
      signalKindOrder[left.kind] - signalKindOrder[right.kind] ||
      left.id.localeCompare(right.id),
  );
  const signals = candidates.slice(0, limit);

  return {
    signals,
    staffing: signals.filter((entry) => entry.group === "staffing"),
    responses: signals.filter((entry) => entry.group === "responses"),
    totalSignalCount: signals.length,
    totalCandidateCount: candidates.length,
    truncated: candidates.length > signals.length,
  };
}
