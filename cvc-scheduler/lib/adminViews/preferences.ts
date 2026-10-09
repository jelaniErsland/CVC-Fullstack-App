/** Presentation preferences only. No authorization, recipient, or assignment state belongs here. */
export const ADMIN_VIEW_VERSION = 1;
export type AdminViewScope = Readonly<{ contactId: string; workspaceId: string }>;
export type SupportType = "general" | "food" | "security";
export type AttentionCategory = "declined" | "staffing" | "awaiting";
export type AttentionView = Readonly<{
  supportTypes: SupportType[];
  categories: AttentionCategory[];
  horizon: "today" | "7" | "14" | "30" | "project";
  status: "active" | "reviewed" | "all";
  sort: "soonest" | "urgent";
}>;
export type CalendarViewPreference = Readonly<{
  taskTypes: ("generalVolunteers" | "food" | "security")[];
  coverageStates: ("unfilled" | "filled" | "waitingConfirmations" | "allConfirmed" | "someDenied")[];
  volunteerId: string | null;
  view: "day" | "week" | "month" | "list" | null;
}>;
export type CommunicationsView = Readonly<{
  tab: "welcome" | "schedule" | "history";
  historyKind: "all" | "welcome" | "schedule";
  historyState: "all" | "sent" | "failed" | "pending";
  historyHorizon: "30" | "90" | "all";
}>;
export type AssignmentPickerView = Readonly<{
  congregation: string;
  availability: "all" | "available" | "conflict" | "away" | "limited";
}>;
export type AdminViewMap = {
  attention: AttentionView;
  calendar: CalendarViewPreference;
  communications: CommunicationsView;
  "assignment-picker": AssignmentPickerView;
};
export type AdminViewSurface = keyof AdminViewMap;

export const defaultAdminViews: AdminViewMap = {
  attention: { supportTypes: [], categories: [], horizon: "14", status: "active", sort: "soonest" },
  calendar: { taskTypes: [], coverageStates: [], volunteerId: null, view: null },
  communications: { tab: "welcome", historyKind: "all", historyState: "all", historyHorizon: "30" },
  "assignment-picker": { congregation: "", availability: "all" },
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
const subset = <T extends string>(value: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(value) ? [...new Set(value.filter((entry): entry is T => typeof entry === "string" && allowed.includes(entry as T)))].slice(0, allowed.length) : [];
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function adminViewKey(scope: AdminViewScope, surface: AdminViewSurface) {
  if (!uuid.test(scope.contactId) || !uuid.test(scope.workspaceId)) return null;
  return `project-local:admin-view:v${ADMIN_VIEW_VERSION}:${scope.contactId.toLowerCase()}:${scope.workspaceId.toLowerCase()}:${surface}`;
}

export function validateAdminView<S extends AdminViewSurface>(surface: S, input: unknown): AdminViewMap[S] {
  const value = record(input);
  if (surface === "attention") return {
    supportTypes: subset(value.supportTypes, ["general", "food", "security"]),
    categories: subset(value.categories, ["declined", "staffing", "awaiting"]),
    horizon: oneOf(value.horizon, ["today", "7", "14", "30", "project"], "14"),
    status: oneOf(value.status, ["active", "reviewed", "all"], "active"),
    sort: oneOf(value.sort, ["soonest", "urgent"], "soonest"),
  } as AdminViewMap[S];
  if (surface === "calendar") return {
    taskTypes: subset(value.taskTypes, ["generalVolunteers", "food", "security"]),
    coverageStates: subset(value.coverageStates, ["unfilled", "filled", "waitingConfirmations", "allConfirmed", "someDenied"]),
    volunteerId: typeof value.volunteerId === "string" && uuid.test(value.volunteerId) ? value.volunteerId.toLowerCase() : null,
    view: value.view === null || value.view === undefined ? null : oneOf(value.view, ["day", "week", "month", "list"], "month"),
  } as AdminViewMap[S];
  if (surface === "communications") return {
    tab: oneOf(value.tab, ["welcome", "schedule", "history"], "welcome"),
    historyKind: oneOf(value.historyKind, ["all", "welcome", "schedule"], "all"),
    historyState: oneOf(value.historyState, ["all", "sent", "failed", "pending"], "all"),
    historyHorizon: oneOf(value.historyHorizon, ["30", "90", "all"], "30"),
  } as AdminViewMap[S];
  return {
    congregation: typeof value.congregation === "string" && value.congregation.length <= 100 ? value.congregation : "",
    availability: oneOf(value.availability, ["all", "available", "conflict", "away", "limited"], "all"),
  } as AdminViewMap[S];
}

export function readAdminView<S extends AdminViewSurface>(storage: Pick<Storage, "getItem">, scope: AdminViewScope, surface: S): AdminViewMap[S] {
  const key = adminViewKey(scope, surface);
  if (!key) return defaultAdminViews[surface];
  try {
    const raw = storage.getItem(key);
    if (!raw) return defaultAdminViews[surface];
    const envelope = record(JSON.parse(raw));
    return envelope.version === ADMIN_VIEW_VERSION && envelope.surface === surface
      ? validateAdminView(surface, envelope.value)
      : defaultAdminViews[surface];
  } catch { return defaultAdminViews[surface]; }
}

export function writeAdminView<S extends AdminViewSurface>(storage: Pick<Storage, "setItem">, scope: AdminViewScope, surface: S, value: AdminViewMap[S]) {
  const key = adminViewKey(scope, surface);
  if (!key) return;
  try { storage.setItem(key, JSON.stringify({ version: ADMIN_VIEW_VERSION, surface, value: validateAdminView(surface, value) })); }
  catch { /* Storage can be disabled or full; the current view still works. */ }
}
