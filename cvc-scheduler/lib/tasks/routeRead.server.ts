import "server-only";

import {
  isEffectiveWorkspaceReadGrant,
  type ProjectContactGrant,
} from "../auth/grant.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
import type { WorkspaceIdentity } from "../workspaces/identity.ts";
import type { TaskPresetCustomField, TaskPresetType } from "./preset.ts";
import { readTaskPresetsWithClient } from "./server.ts";

export type TaskManagementPreset = Readonly<{
  id: string;
  name: string;
  description: string | null;
  taskType: TaskPresetType;
  defaultNeededCount: number;
  volunteerVisible: boolean;
  isSystemPreset: boolean;
  customFields: readonly TaskPresetCustomField[];
  lifecycle: "active" | "archived";
}>;

export type TaskManagementNotice =
  | "created"
  | "archived"
  | "validation"
  | "unavailable"
  | "error";

export type TaskManagementReadyRouteState = Readonly<{
  kind: "ready_with_presets" | "ready_empty";
  workspaceName: string;
  canEdit: boolean;
  presets: readonly TaskManagementPreset[];
  notice: TaskManagementNotice | null;
}>;

export type TaskManagementRouteState =
  | TaskManagementReadyRouteState
  | Readonly<{
      kind: "unavailable" | "error";
      title: string;
      message: string;
      notice: TaskManagementNotice | null;
    }>;

type TaskManagementWorkspaceSelection =
  | Readonly<{
      ok: true;
      workspace: WorkspaceIdentity;
      projectContactId: string;
      canEdit: boolean;
      capabilities: readonly string[];
    }>
  | Readonly<{
      ok: false;
      reason: "unauthorized" | "missing_tasks_view" | "workspace_unavailable";
    }>;

export const TASKS_MANAGEMENT_ROUTE_CUTOVER_IMPLEMENTED = true;
export const TASKS_MANAGEMENT_PERSISTED_TRUTH_SOURCE = true;
export const TASKS_MANAGEMENT_MOCK_FALLBACK_ALLOWED = false;
export const TASKS_MANAGEMENT_SERVICE_ROLE_AVAILABLE = false;
export const TASKS_MANAGEMENT_CREATE_AVAILABLE = true;
export const TASKS_MANAGEMENT_ARCHIVE_AVAILABLE = true;
export const TASKS_MANAGEMENT_GENERAL_EDIT_AVAILABLE = false;
export const TASKS_MANAGEMENT_BROWSER_SCOPE_INPUT_TRUSTED = false;

export function selectTaskManagementWorkspaceContext(input: {
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
}): TaskManagementWorkspaceSelection {
  if (input.ownGrants.length === 0) return { ok: false, reason: "unauthorized" };

  const activeWorkspaces = new Map(
    input.workspaces
      .filter((workspace) => workspace.lifecycle === "active")
      .map((workspace) => [workspace.id, workspace]),
  );
  const workspaceCapabilities = new Map<
    string,
    { workspace: WorkspaceIdentity; capabilities: Set<string> }
  >();

  for (const grant of input.ownGrants) {
    if (grant.projectContactId !== input.projectContactId) continue;
    if (!isEffectiveWorkspaceReadGrant(grant)) continue;
    const workspace = activeWorkspaces.get(grant.workspaceId);
    if (!workspace) continue;
    const existing = workspaceCapabilities.get(workspace.id) ?? {
      workspace,
      capabilities: new Set<string>(),
    };
    for (const capability of grant.capabilities) existing.capabilities.add(capability);
    workspaceCapabilities.set(workspace.id, existing);
  }

  if (workspaceCapabilities.size === 0) {
    return { ok: false, reason: "workspace_unavailable" };
  }

  const eligible = [...workspaceCapabilities.values()].filter(({ capabilities }) =>
    capabilities.has("tasks.view"),
  );

  if (eligible.length === 1) {
    return {
      ok: true,
      workspace: eligible[0].workspace,
      projectContactId: input.projectContactId,
      canEdit: eligible[0].capabilities.has("tasks.edit"),
      capabilities: [...eligible[0].capabilities].sort(),
    };
  }

  return {
    ok: false,
    reason: eligible.length > 1 ? "workspace_unavailable" : "missing_tasks_view",
  };
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeTaskManagementNotice(
  value: string | string[] | undefined,
): TaskManagementNotice | null {
  const notice = firstSearchParam(value);
  return notice === "created" ||
    notice === "archived" ||
    notice === "validation" ||
    notice === "unavailable" ||
    notice === "error"
    ? notice
    : null;
}

function unavailableState(
  notice: TaskManagementNotice | null,
): TaskManagementRouteState {
  return {
    kind: "unavailable",
    title: "Tasks are unavailable",
    message:
      "We could not safely open reusable tasks for this workspace. Check that the signed-in project contact has the right workspace access.",
    notice,
  };
}

function errorState(notice: TaskManagementNotice | null): TaskManagementRouteState {
  return {
    kind: "error",
    title: "Tasks could not be loaded",
    message: "Something went wrong while loading reusable tasks. Please try again.",
    notice,
  };
}

export async function readTaskManagementRouteContext() {
  try {
    const { readVerifiedAdminContext } = await import(
      "../auth/verified-admin-context.server.ts"
    );
    const verified = await readVerifiedAdminContext();
    if (!verified) return null;
    const selection = selectTaskManagementWorkspaceContext({
      projectContactId: verified.projectContactId,
      ownGrants: verified.ownGrants,
      workspaces: verified.workspaces,
    });
    if (!selection.ok) return null;

    return { supabase: verified.supabase, ...selection } as const;
  } catch {
    return null;
  }
}

function toRoutePreset(preset: Awaited<ReturnType<typeof readTaskPresetsWithClient>>[number]) {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    taskType: preset.taskType,
    defaultNeededCount: preset.defaultNeededCount,
    volunteerVisible: preset.volunteerVisible,
    isSystemPreset: preset.isSystemPreset,
    customFields: preset.customFields,
    lifecycle: preset.lifecycle,
  } satisfies TaskManagementPreset;
}

export async function readTaskManagementRouteState(
  searchParams?: Record<string, string | string[] | undefined>,
): Promise<TaskManagementRouteState> {
  const notice = normalizeTaskManagementNotice(searchParams?.notice);

  try {
    const context = await readTaskManagementRouteContext();
    if (!context) return unavailableState(notice);
    const presets = (
      await readTaskPresetsWithClient(context.supabase, context.workspace.id)
    ).map(toRoutePreset);

    return {
      kind: presets.length > 0 ? "ready_with_presets" : "ready_empty",
      workspaceName: context.workspace.displayName,
      canEdit: context.canEdit,
      presets,
      notice,
    };
  } catch {
    return errorState(notice);
  }
}

export function describeTaskManagementCutover() {
  return {
    routeCutoverImplemented: TASKS_MANAGEMENT_ROUTE_CUTOVER_IMPLEMENTED,
    persistedTruthSource: TASKS_MANAGEMENT_PERSISTED_TRUTH_SOURCE,
    mockFallbackAllowed: TASKS_MANAGEMENT_MOCK_FALLBACK_ALLOWED,
    serviceRoleAvailable: TASKS_MANAGEMENT_SERVICE_ROLE_AVAILABLE,
    createAvailable: TASKS_MANAGEMENT_CREATE_AVAILABLE,
    archiveAvailable: TASKS_MANAGEMENT_ARCHIVE_AVAILABLE,
    generalEditAvailable: TASKS_MANAGEMENT_GENERAL_EDIT_AVAILABLE,
    browserScopeInputTrusted: TASKS_MANAGEMENT_BROWSER_SCOPE_INPUT_TRUSTED,
    readCapability: "tasks.view",
    editCapability: "tasks.edit",
    routeStates: ["ready_with_presets", "ready_empty", "unavailable", "error"],
    routeProjection: [
      "id",
      "name",
      "description",
      "taskType",
      "defaultNeededCount",
      "volunteerVisible",
      "isSystemPreset",
      "customFields",
      "lifecycle",
    ],
  } as const;
}

export type TaskManagementRouteContext = NonNullable<
  Awaited<ReturnType<typeof readTaskManagementRouteContext>>
>;
export type TaskManagementSupabaseClient = AppSupabaseClient;
