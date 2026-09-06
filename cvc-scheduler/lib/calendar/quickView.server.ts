import "server-only";
import { mapCalendarReadModelItem } from "./readModel.server.ts";
import { toItemRow } from "./readModelQuery.server.ts";
import { deriveCalendarRouteReadRange, mapPersistedItemToCalendarItem, normalizeCalendarRouteSearchParams, type CalendarClientState } from "./routeRead.server.ts";

export function asReadOnlyCalendar(state: CalendarClientState): CalendarClientState {
  if (state.kind !== "ready_empty" && state.kind !== "ready_with_items") return state;
  const items = state.items.filter(item => item.publicationState === "published").map(item => ({
    ...item, canPublish: false,
    initialAssignmentNotification: { kind: "unavailable" as const, emailConfigured: false },
    followUpContactSelfEdit: { kind: "not_current_contact" as const },
    assignments: item.assignments.map(assignment => ({ ...assignment,
      volunteerCongregation: null, volunteerLifecycle: "active", volunteerReadinessStatus: "ready",
      volunteerEmailAvailable: false, volunteerPhoneAvailable: false,
      volunteerPreferredContactMethod: null, volunteerProfileNotes: null,
    })),
  }));
  return { ...state, items, kind: items.length ? "ready_with_items" : "ready_empty",
    canEdit: false, canEditAssignments: false, canViewVolunteers: true, canViewTaskPresets: false,
    assignmentPicker: { kind: "ready", volunteers: [], assignments: items.flatMap(item => item.assignments) },
    taskPresetSelector: { kind: "ready_empty", presets: [] },
    projectDayDetails: state.projectDayDetails,
  };
}

// The token RPC supplies a bounded, explicitly selected set of Calendar source rows.
// Both access mechanisms use the same row mapper and renderer; no mock data is read.
export function sharedCalendarState(value: unknown, params?: Record<string, string | string[] | undefined>): CalendarClientState | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const row = value[0];
  if (!row || row.access_state !== "ready" || !Array.isArray(row.schedule_sources)) return null;
  const request = normalizeCalendarRouteSearchParams({ ...params, date: row.project_date });
  if (!request.ok) return null;
  const range = deriveCalendarRouteReadRange({ view: request.view, anchorDate: request.anchorDate, workspaceTimezone: row.workspace_timezone });
  if (!range || typeof row.workspace_display_name !== "string") return null;
  try {
    const items = row.schedule_sources.map((source: Record<string, unknown>) => {
      const presets = new Map<string, Record<string, unknown>>();
      if (typeof source.task_preset_id === "string") presets.set(source.task_preset_id, { name: source.task_preset_label, task_type: source.task_type_snapshot, description: source.task_description });
      const item = toItemRow(source, presets);
      if (!item || item.publicationState !== "published" || item.lifecycle !== "active" || !Array.isArray(source.assignments)) throw new Error("Invalid Calendar projection");
      const assignments = source.assignments.map((assignment: Record<string, unknown>) => {
        if (typeof assignment.assignmentId !== "string" || assignment.calendarItemId !== item.id || typeof assignment.volunteerProfileId !== "string" || typeof assignment.volunteerDisplayName !== "string" || !["needs_response", "confirmed", "declined"].includes(String(assignment.responseStatus))) throw new Error("Invalid assignment projection");
        return {
          assignmentId: assignment.assignmentId, calendarItemId: item.id,
          volunteerProfileId: assignment.volunteerProfileId, volunteerDisplayName: assignment.volunteerDisplayName,
          volunteerCongregation: null, volunteerLifecycle: "active", volunteerReadinessStatus: "ready",
          volunteerEmailAvailable: false, volunteerPhoneAvailable: false,
          volunteerPreferredContactMethod: null, volunteerProfileNotes: null,
          responseStatus: assignment.responseStatus as "needs_response" | "confirmed" | "declined",
        };
      });
      return mapPersistedItemToCalendarItem(mapCalendarReadModelItem(item, assignments.map(a => ({
        assignmentId: a.assignmentId, calendarItemId: item.id, workspaceId: item.workspaceId,
        assignmentLifecycle: "active", currentResponseStatus: a.responseStatus,
      }))), assignments);
    }).filter((item: { date: string; endDate?: string }) => item.date < range.rangeEnd && (item.endDate ?? item.date) >= range.rangeStart);
    const day = typeof params?.day === "string" ? params.day : null;
    return asReadOnlyCalendar({
      kind: items.length ? "ready_with_items" : "ready_empty", items,
      workspaceName: row.workspace_display_name, projectStartsOn: row.project_starts_on, projectEndsOn: row.project_ends_on,
      canEdit: false, canEditAssignments: false, canViewVolunteers: true, canViewTaskPresets: false,
      taskPresetSelector: { kind: "ready_empty", presets: [] }, assignmentPicker: { kind: "ready", volunteers: [], assignments: [] },
      projectDayDetails: day ? { date: day, publishedScheduleCount: items.filter((item: { date: string }) => item.date === day).length } : null,
      view: range.periodKind, anchorDate: range.anchorDate, queriedRange: range,
    });
  } catch { return null; }
}
