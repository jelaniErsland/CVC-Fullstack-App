import "server-only";

import type { ProjectContactGrant } from "../auth/grant.ts";
import {
  readCalendarReadModelWithClient,
  type CalendarReadModelQueryClient,
} from "../calendar/readModelQuery.server.ts";
import { dateInWorkspaceTimezone, selectOverviewWorkspaceContext } from "../overview/routeRead.server.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
import type { WorkspaceIdentity } from "../workspaces/identity.ts";
import {
  addNeedsAttentionDays,
  deriveNeedsAttentionSignals,
  NEEDS_ATTENTION_RESPONSE_WINDOW_DAYS,
  type NeedsAttentionSummary,
} from "./derive.server.ts";

type NeedsAttentionSeenReader = {
  from: (table: "needs_attention_seen_states") => {
    select: (columns: "signal_id") => {
      eq: (column: "workspace_id", value: string) => {
        eq: (column: "project_contact_id", value: string) => Promise<{ data: Array<{ signal_id: string }> | null }>;
      };
    };
  };
};

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
  workspaceTimezone: string;
  today: string;
  summary: NeedsAttentionSummary;
  workspaceId: string;
  unseenSignalIds: readonly string[];
  unseenSignalCount: number;
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
  return readCalendarReadModelWithClient({
    client: client as unknown as CalendarReadModelQueryClient,
    workspaceId: workspace.id,
    actorContactId: projectContactId,
    workspaceTimezone: workspace.timezone,
    rangeStart,
    rangeEnd,
    periodKind: "list",
    capabilities: ["calendar.view", "assignments.view"],
  });
}

export async function readNeedsAttentionRouteState(
  at = new Date(),
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
    const rangeEnd = addNeedsAttentionDays(today, NEEDS_ATTENTION_RESPONSE_WINDOW_DAYS);
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
    });
    const seenResult = await (context.supabase as unknown as NeedsAttentionSeenReader)
      .from("needs_attention_seen_states")
      .select("signal_id")
      .eq("workspace_id", context.workspace.id)
      .eq("project_contact_id", context.projectContactId);
    const seen = new Set<string>((seenResult.data ?? []).map((row: { signal_id: string }) => row.signal_id));
    const unseenSignalIds = summary.signals.filter((signal) => !seen.has(signal.id)).map((signal) => signal.id);
    return {
      kind: "ready",
      workspaceName: context.workspace.displayName,
      workspaceId: context.workspace.id,
      workspaceTimezone: context.workspace.timezone,
      today,
      summary,
      unseenSignalIds,
      unseenSignalCount: unseenSignalIds.length,
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
    responseWindowDays: NEEDS_ATTENTION_RESPONSE_WINDOW_DAYS,
  };
}
