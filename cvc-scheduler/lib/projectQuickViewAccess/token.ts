import { normalizeProjectDate } from "../operations/projectDay.ts";
import {
  buildQuickViewSafeProjection,
  type OperationalScheduleSource,
  type QuickViewSafeProjection,
} from "../operations/projections.ts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;

export class ProjectQuickViewAccessValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Project Quick View access input is invalid.");
    this.name = "ProjectQuickViewAccessValidationError";
    this.issues = issues;
  }
}

export type IssuedProjectQuickViewAccess = Readonly<{
  tokenId: string;
  token: string;
  expiresAt: string;
}>;

export type ProjectQuickViewShareState = Readonly<{
  enabled: boolean;
  activeLinkCount: number;
  expiresAt: string | null;
}>;

export type SharedProjectQuickView =
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{
      kind: "ready";
      workspaceTimezone: string;
      projectStartsOn: string | null;
      projectEndsOn: string;
      expiresAt: string;
      projection: QuickViewSafeProjection;
    }>;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function validateWorkspaceId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    throw new ProjectQuickViewAccessValidationError(["workspace must be valid."]);
  }
  return value.trim().toLowerCase();
}

export function validateQuickViewBearer(value: unknown) {
  if (typeof value !== "string" || !bearerPattern.test(value)) {
    throw new ProjectQuickViewAccessValidationError(["access link is invalid."]);
  }
  return value;
}

export function validateOptionalProjectDate(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  try {
    return normalizeProjectDate(value);
  } catch {
    throw new ProjectQuickViewAccessValidationError(["project date is invalid."]);
  }
}

export function parseIssuedProjectQuickViewAccess(value: unknown): IssuedProjectQuickViewAccess {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("Project Quick View access issuance returned an invalid result.");
  }
  const row = record(value[0]);
  if (
    !row ||
    typeof row.token_id !== "string" ||
    !uuidPattern.test(row.token_id) ||
    typeof row.bearer_token !== "string" ||
    !bearerPattern.test(row.bearer_token) ||
    !validTimestamp(row.token_expires_at)
  ) {
    throw new Error("Project Quick View access issuance returned an invalid result.");
  }
  return {
    tokenId: row.token_id,
    token: row.bearer_token,
    expiresAt: new Date(row.token_expires_at as string).toISOString(),
  };
}

export function parseProjectQuickViewShareState(value: unknown): ProjectQuickViewShareState {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("Project Quick View sharing state is invalid.");
  }
  const row = record(value[0]);
  if (
    !row ||
    typeof row.shared_access_enabled !== "boolean" ||
    !Number.isInteger(row.active_link_count) ||
    (row.latest_expires_at !== null && !validTimestamp(row.latest_expires_at))
  ) {
    throw new Error("Project Quick View sharing state is invalid.");
  }
  return {
    enabled: row.shared_access_enabled,
    activeLinkCount: row.active_link_count as number,
    expiresAt: row.latest_expires_at === null
      ? null
      : new Date(row.latest_expires_at as string).toISOString(),
  };
}

function parseScheduleSources(value: unknown): readonly OperationalScheduleSource[] {
  if (!Array.isArray(value)) throw new Error("Shared Quick View schedule is invalid.");
  return value.map((entry) => {
    const row = record(entry);
    if (
      !row ||
      typeof row.title !== "string" ||
      !["general", "food", "security", "custom"].includes(String(row.taskType)) ||
      !["timed", "date_based", "multi_day_window", "milestone"].includes(String(row.scheduleKind)) ||
      typeof row.startDate !== "string" ||
      (row.endDate !== null && typeof row.endDate !== "string") ||
      (row.startTime !== null && typeof row.startTime !== "string") ||
      (row.endTime !== null && typeof row.endTime !== "string") ||
      !Number.isInteger(row.neededCount) ||
      !["active", "archived", "canceled"].includes(String(row.lifecycle)) ||
      !["draft", "published"].includes(String(row.publicationState))
    ) {
      throw new Error("Shared Quick View schedule is invalid.");
    }
    return {
      title: row.title,
      taskType: row.taskType,
      scheduleKind: row.scheduleKind,
      startDate: row.startDate,
      endDate: row.endDate,
      startTime: row.startTime,
      endTime: row.endTime,
      neededCount: row.neededCount,
      lifecycle: row.lifecycle,
      publicationState: row.publicationState,
    } as OperationalScheduleSource;
  });
}

export function parseSharedProjectQuickView(value: unknown): SharedProjectQuickView {
  if (!Array.isArray(value) || value.length !== 1) return { kind: "unavailable" };
  const row = record(value[0]);
  if (!row || row.access_state !== "ready") return { kind: "unavailable" };
  if (
    typeof row.workspace_display_name !== "string" ||
    typeof row.workspace_timezone !== "string" ||
    typeof row.project_date !== "string" ||
    (row.project_starts_on !== null && typeof row.project_starts_on !== "string") ||
    typeof row.project_ends_on !== "string" ||
    !validTimestamp(row.token_expires_at) ||
    (row.expected_on_site_count !== null && !Number.isInteger(row.expected_on_site_count))
  ) {
    return { kind: "unavailable" };
  }
  const schedule = parseScheduleSources(row.schedule_sources);
  const projection = buildQuickViewSafeProjection({
    projectDisplayName: row.workspace_display_name,
    date: row.project_date,
    projectDay: row.expected_on_site_count === null
      ? null
      : {
          date: row.project_date,
          expectedOnSiteCount: row.expected_on_site_count as number,
          createdAt: "shared-safe-projection",
          updatedAt: "shared-safe-projection",
        },
    schedule,
  });
  return {
    kind: "ready",
    workspaceTimezone: row.workspace_timezone,
    projectStartsOn: row.project_starts_on as string | null,
    projectEndsOn: row.project_ends_on,
    expiresAt: new Date(row.token_expires_at as string).toISOString(),
    projection,
  };
}
