import "server-only";
import { adminDestinations } from "../adminNavigation.ts";

import type { ProjectContactGrant } from "../auth/grant.ts";
import {
  readCalendarReadModelWithClient,
  type CalendarReadModelQueryClient,
} from "../calendar/readModelQuery.server.ts";
import type { CalendarReadModelItem } from "../calendar/readModel.server.ts";
import { dateInWorkspaceTimezone, selectOverviewWorkspaceContext } from "../overview/routeRead.server.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
import type { WorkspaceIdentity } from "../workspaces/identity.ts";
import {
  addNeedsAttentionDays,
  deriveNeedsAttentionSignals,
  type NeedsAttentionSummary,
} from "./derive.server.ts";
import { groupAttentionIssues, type AttentionIssue } from "./issues.ts";

type NeedsAttentionSeenReader = {
  from: (table: "needs_attention_seen_states") => {
    select: (columns: "signal_id") => {
      eq: (column: "workspace_id", value: string) => {
        eq: (column: "project_contact_id", value: string) => Promise<{ data: Array<{ signal_id: string }> | null }>;
      };
    };
  };
};
function chunks<T>(values: readonly T[], size: number) { const result: T[][] = []; for (let start = 0; start < values.length; start += size) result.push(values.slice(start, start + size)); return result; }
async function readIssueVolunteerSearch(client: AppSupabaseClient, workspaceId: string, itemIds: readonly string[], allowed: boolean) {
  const searchByItem = new Map<string, string>();
  const peopleByAssignment = new Map<string, { name: string; congregation: string | null }>();
  if (!allowed || itemIds.length === 0) return { searchByItem, peopleByAssignment, available: allowed };
  try {
    const assignmentResults = await Promise.all(chunks(itemIds, 100).map(ids => client.from("calendar_assignments")
      .select("id,calendar_item_id,volunteer_profile_id")
      .eq("workspace_id", workspaceId).eq("lifecycle", "active").in("calendar_item_id", ids)));
    if (assignmentResults.some(result => result.error)) return { searchByItem, peopleByAssignment, available: false };
    const assignments = assignmentResults.flatMap(result => result.data ?? []);
    const volunteerIds = [...new Set(assignments.map(row => row.volunteer_profile_id).filter((id): id is string => typeof id === "string"))];
    const volunteerResults = await Promise.all(chunks(volunteerIds, 100).map(ids => client.from("volunteer_profiles")
      .select("id,full_name,congregation").eq("workspace_id", workspaceId).in("id", ids)));
    if (volunteerResults.some(result => result.error)) return { searchByItem, peopleByAssignment, available: false };
    const volunteers = new Map(volunteerResults.flatMap(result => result.data ?? []).map(row => [row.id, { name: row.full_name, congregation: row.congregation }]));
    for (const row of assignments) {
      const person = volunteers.get(row.volunteer_profile_id);
      if (!person || typeof person.name !== "string") continue;
      peopleByAssignment.set(row.id, { name: person.name, congregation: typeof person.congregation === "string" ? person.congregation : null });
      searchByItem.set(row.calendar_item_id, `${searchByItem.get(row.calendar_item_id) ?? ""} ${person.name} ${person.congregation ?? ""}`);
    }
  } catch { return { searchByItem, peopleByAssignment, available: false }; }
  return { searchByItem, peopleByAssignment, available: true };
}

export const NEEDS_ATTENTION_PERSISTED_CUTOVER_IMPLEMENTED = true;
export const NEEDS_ATTENTION_MOCK_FALLBACK_ALLOWED = false;
export const NEEDS_ATTENTION_SERVICE_ROLE_AVAILABLE = false;
export const NEEDS_ATTENTION_BROWSER_SCOPE_INPUT_TRUSTED = false;
export const NEEDS_ATTENTION_GET_MUTATION_AVAILABLE = false;
export const NEEDS_ATTENTION_PERSISTENCE_AVAILABLE = false;
export const NEEDS_ATTENTION_REQUIRED_CAPABILITIES = [
  "workspace.read",
  "calendar.view",
  "assignments.view",
] as const;

export type NeedsAttentionReadyRouteState = Readonly<{
  kind: "ready";
  workspaceName: string;
  navigationDestinations?: readonly string[];
  workspaceTimezone: string;
  today: string;
  summary: NeedsAttentionSummary;
  workspaceId: string;
  projectContactId: string;
  workspaceEndsOn: string | null;
  unseenSignalIds: readonly string[];
  unseenSignalCount: number;
  reviewedSignalIds: readonly string[];
  issues: readonly AttentionIssue[];
  issueCount: number;
  canSearchVolunteers: boolean;
}>;

export type NeedsAttentionRouteState =
  | NeedsAttentionReadyRouteState
  | Readonly<{ kind: "unavailable" | "error"; title: string; message: string }>;

type NeedsAttentionWorkspaceSelection =
  | Readonly<{
      ok: true;
      workspace: WorkspaceIdentity;
      projectContactId: string;
      capabilities: readonly string[];
    }>
  | Readonly<{ ok: false; reason: "unauthorized" | "workspace_unavailable" }>;

export function selectNeedsAttentionWorkspaceContext(input: {
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
  at?: Date;
}): NeedsAttentionWorkspaceSelection {
  const base = selectOverviewWorkspaceContext(input);
  if (!base.ok) return base;
  const capabilities = new Set(base.capabilities);
  if (
    NEEDS_ATTENTION_REQUIRED_CAPABILITIES.some(
      (capability) => !capabilities.has(capability),
    )
  ) {
    return { ok: false, reason: "unauthorized" };
  }
  return base;
}

async function readNeedsAttentionRouteContext(at: Date) {
  const { readVerifiedAdminContext } = await import(
    "../auth/verified-admin-context.server.ts"
  );
  const verified = await readVerifiedAdminContext();
  if (!verified) return null;
  const selection = selectNeedsAttentionWorkspaceContext({
    projectContactId: verified.projectContactId,
    ownGrants: verified.ownGrants,
    workspaces: verified.workspaces,
    at,
  });
  if (!selection.ok) return null;
  return { supabase: verified.supabase, ...selection } as const;
}

async function readNeedsAttentionCalendar(
  client: AppSupabaseClient,
  workspace: WorkspaceIdentity,
  projectContactId: string,
  rangeStart: string,
  rangeEnd: string,
) {
  // The Calendar read model accepts at most 93 days per request. Read the
  // project's future in bounded windows and deduplicate overnight overlaps.
  const items = new Map<string, CalendarReadModelItem>();
  for (let start = rangeStart; start < rangeEnd; start = addNeedsAttentionDays(start, 90)) {
    const end = [addNeedsAttentionDays(start, 90), rangeEnd].sort()[0];
    const page = await readCalendarReadModelWithClient({
      client: client as unknown as CalendarReadModelQueryClient,
      workspaceId: workspace.id,
      actorContactId: projectContactId,
      workspaceTimezone: workspace.timezone,
      rangeStart: start,
      rangeEnd: end,
      periodKind: "list",
      capabilities: ["calendar.view", "assignments.view"],
    });
    if (!page.ok) return page;
    for (const item of page.items) items.set(item.calendarItemId, item);
  }
  return { ok: true as const, items: [...items.values()] };
}

export async function readNeedsAttentionRouteState(
  at = new Date(),
  options: Readonly<{ includeVolunteerSearch?: boolean; horizonDays?: 14 }> = {},
): Promise<NeedsAttentionRouteState> {
  try {
    const context = await readNeedsAttentionRouteContext(at);
    if (!context) {
      return {
        kind: "unavailable",
        title: "Needs Attention is unavailable",
        message: "We could not safely open staffing and response follow-ups for this project.",
      };
    }

    const today = dateInWorkspaceTimezone(at, context.workspace.timezone);
    const projectRangeEnd = context.workspace.endsOn && context.workspace.endsOn >= today
      ? addNeedsAttentionDays(context.workspace.endsOn, 1)
      : addNeedsAttentionDays(today, 90);
    const rangeEnd = options.horizonDays === 14
      ? [projectRangeEnd, addNeedsAttentionDays(today, 15)].sort()[0]
      : projectRangeEnd;
    const calendar = await readNeedsAttentionCalendar(
      context.supabase,
      context.workspace,
      context.projectContactId,
      today,
      rangeEnd,
    );
    if (!calendar.ok) {
      return {
        kind: "error",
        title: "Needs Attention could not be loaded",
        message: "Upcoming staffing and response follow-ups are temporarily unavailable.",
      };
    }

    const summary = deriveNeedsAttentionSignals(calendar.items, {
      at,
      workspaceTimezone: context.workspace.timezone,
      coverageWindowDays: Math.max(0, Math.ceil((Date.parse(`${rangeEnd}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000)),
      responseWindowDays: Math.max(0, Math.ceil((Date.parse(`${rangeEnd}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000)),
    });
    const seenResult = await (context.supabase as unknown as NeedsAttentionSeenReader)
      .from("needs_attention_seen_states")
      .select("signal_id")
      .eq("workspace_id", context.workspace.id)
      .eq("project_contact_id", context.projectContactId);
    // Earlier releases automatically wrote bare signal IDs when the inbox was
    // opened. Only explicitly reviewed IDs may remove an issue from Active.
    const reviewed = new Set<string>((seenResult.data ?? [])
      .map((row: { signal_id: string }) => row.signal_id)
      .filter(id => id.startsWith("reviewed:"))
      .map(id => id.slice("reviewed:".length)));
    const unseenSignalIds = summary.signals.filter((signal) => !reviewed.has(signal.id)).map((signal) => signal.id);
    const volunteerSearch = await readIssueVolunteerSearch(context.supabase, context.workspace.id, [...new Set(summary.signals.map(signal => signal.calendarItemId))], options.includeVolunteerSearch !== false && context.capabilities.includes("volunteers.view"));
    const issues = groupAttentionIssues(summary.signals, reviewed, volunteerSearch.searchByItem, volunteerSearch.peopleByAssignment);
    return {
      kind: "ready",
      workspaceName: context.workspace.displayName,
      navigationDestinations: adminDestinations(context.capabilities),
      workspaceId: context.workspace.id,
      projectContactId: context.projectContactId,
      workspaceEndsOn: context.workspace.endsOn,
      workspaceTimezone: context.workspace.timezone,
      today,
      summary,
      unseenSignalIds,
      unseenSignalCount: unseenSignalIds.length,
      reviewedSignalIds: [...reviewed],
      issues,
      issueCount: issues.length,
      canSearchVolunteers: volunteerSearch.available,
    };
  } catch {
    return {
      kind: "error",
      title: "Needs Attention could not be loaded",
      message: "Upcoming staffing and response follow-ups are temporarily unavailable.",
    };
  }
}

export function describeNeedsAttentionCutover() {
  return {
    persistedCutoverImplemented: NEEDS_ATTENTION_PERSISTED_CUTOVER_IMPLEMENTED,
    mockFallbackAllowed: NEEDS_ATTENTION_MOCK_FALLBACK_ALLOWED,
    serviceRoleAvailable: NEEDS_ATTENTION_SERVICE_ROLE_AVAILABLE,
    browserScopeInputTrusted: NEEDS_ATTENTION_BROWSER_SCOPE_INPUT_TRUSTED,
    getMutationAvailable: NEEDS_ATTENTION_GET_MUTATION_AVAILABLE,
    persistenceAvailable: NEEDS_ATTENTION_PERSISTENCE_AVAILABLE,
    requiredCapabilities: NEEDS_ATTENTION_REQUIRED_CAPABILITIES,
    responseWindowDays: 90,
  };
}
