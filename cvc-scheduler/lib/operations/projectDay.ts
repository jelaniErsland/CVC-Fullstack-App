import { isEffectiveWorkspaceReadGrant, type ProjectContactGrant } from "../auth/grant.ts";
import type { WorkspaceIdentity } from "../workspaces/identity.ts";

export const PROJECT_DAY_EXPECTED_ON_SITE_MAX = 2_147_483_647;

export type ProjectDay = Readonly<{
  date: string;
  expectedOnSiteCount: number | null;
  createdAt: string;
  updatedAt: string;
}>;

export type SetProjectDayExpectedOnSiteInput = Readonly<{
  date: string;
  expectedOnSiteCount: number | null;
}>;

export type ProjectDayMutationState = Readonly<{
  status: "idle" | "success" | "validation" | "unavailable" | "error";
  date: string;
  expectedOnSiteCount: number | null;
  message: string;
}>;

export class ProjectDayValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Project Day input is invalid.");
    this.name = "ProjectDayValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeProjectDate(value: unknown) {
  if (typeof value !== "string") {
    throw new ProjectDayValidationError(["date must use YYYY-MM-DD."]);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new ProjectDayValidationError(["date must use YYYY-MM-DD."]);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ProjectDayValidationError(["date must be a real calendar date."]);
  }
  return value;
}

export function validateSetProjectDayExpectedOnSiteInput(
  input: unknown,
): SetProjectDayExpectedOnSiteInput {
  if (!isRecord(input)) {
    throw new ProjectDayValidationError(["input must be an object."]);
  }
  const unknownKeys = Object.keys(input).filter(
    (key) => key !== "date" && key !== "expectedOnSiteCount",
  );
  const issues = unknownKeys.map((key) => `unsupported field: ${key}.`);
  let date = "";
  try {
    date = normalizeProjectDate(input.date);
  } catch (error) {
    if (error instanceof ProjectDayValidationError) issues.push(...error.issues);
    else throw error;
  }
  const count = input.expectedOnSiteCount;
  if (
    count !== null &&
    (typeof count !== "number" ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > PROJECT_DAY_EXPECTED_ON_SITE_MAX)
  ) {
    issues.push(
      `expectedOnSiteCount must be null or an integer from 0 to ${PROJECT_DAY_EXPECTED_ON_SITE_MAX}.`,
    );
  }
  if (issues.length > 0) throw new ProjectDayValidationError(issues);
  return { date, expectedOnSiteCount: count as number | null };
}

export function parseProjectDayExpectedOnSiteFormValue(value: unknown) {
  if (typeof value !== "string") {
    throw new ProjectDayValidationError(["Enter a whole number or leave it blank."]);
  }
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (!/^(0|[1-9]\d*)$/.test(normalized)) {
    throw new ProjectDayValidationError(["Enter a whole number of zero or more."]);
  }
  const count = Number(normalized);
  if (!Number.isSafeInteger(count) || count > PROJECT_DAY_EXPECTED_ON_SITE_MAX) {
    throw new ProjectDayValidationError([
      `Enter a whole number from 0 to ${PROJECT_DAY_EXPECTED_ON_SITE_MAX}.`,
    ]);
  }
  return count;
}

export function parseProjectDay(value: unknown): ProjectDay {
  if (!isRecord(value)) {
    throw new ProjectDayValidationError(["Project Day row must be an object."]);
  }
  const input = validateSetProjectDayExpectedOnSiteInput({
    date: value.project_date,
    expectedOnSiteCount: value.expected_on_site_count,
  });
  if (typeof value.created_at !== "string" || typeof value.updated_at !== "string") {
    throw new ProjectDayValidationError(["Project Day audit timestamps are invalid."]);
  }
  return {
    ...input,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export type OperationalWorkspaceSelection =
  | Readonly<{
      ok: true;
      workspace: WorkspaceIdentity;
      capabilities: readonly string[];
    }>
  | Readonly<{
      ok: false;
      reason: "unauthorized" | "missing_capability" | "workspace_unavailable";
    }>;

export function selectOperationalWorkspace(input: {
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
  requiredCapability: "calendar.view" | "calendar.edit" | "volunteers.view";
  at?: Date;
}): OperationalWorkspaceSelection {
  const activeWorkspaces = new Map(
    input.workspaces
      .filter((workspace) => workspace.lifecycle === "active")
      .map((workspace) => [workspace.id, workspace]),
  );
  const candidates = new Map<string, Set<string>>();
  for (const grant of input.ownGrants) {
    if (grant.projectContactId !== input.projectContactId) continue;
    if (!isEffectiveWorkspaceReadGrant(grant, input.at)) continue;
    if (!activeWorkspaces.has(grant.workspaceId)) continue;
    const capabilities = candidates.get(grant.workspaceId) ?? new Set<string>();
    for (const capability of grant.capabilities) capabilities.add(capability);
    candidates.set(grant.workspaceId, capabilities);
  }
  if (candidates.size === 0) return { ok: false, reason: "unauthorized" };
  const eligible = [...candidates.entries()].filter(([, capabilities]) =>
    capabilities.has(input.requiredCapability),
  );
  if (eligible.length !== 1) {
    return {
      ok: false,
      reason: eligible.length === 0 ? "missing_capability" : "workspace_unavailable",
    };
  }
  const [workspaceId, capabilities] = eligible[0];
  const workspace = activeWorkspaces.get(workspaceId);
  if (!workspace) return { ok: false, reason: "workspace_unavailable" };
  return { ok: true, workspace, capabilities: [...capabilities].sort() };
}

export type AuthorizedOperationalWorkspace = Readonly<{
  workspace: WorkspaceIdentity;
  capabilities: readonly string[];
}>;

export function listAuthorizedOperationalWorkspaces(input: {
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
  requiredCapability: "calendar.view" | "calendar.edit" | "volunteers.view";
  at?: Date;
}): readonly AuthorizedOperationalWorkspace[] {
  const activeWorkspaces = new Map(
    input.workspaces
      .filter((workspace) => workspace.lifecycle === "active")
      .map((workspace) => [workspace.id, workspace]),
  );
  const candidates = new Map<string, Set<string>>();
  for (const grant of input.ownGrants) {
    if (grant.projectContactId !== input.projectContactId) continue;
    if (!isEffectiveWorkspaceReadGrant(grant, input.at)) continue;
    if (!activeWorkspaces.has(grant.workspaceId)) continue;
    const capabilities = candidates.get(grant.workspaceId) ?? new Set<string>();
    for (const capability of grant.capabilities) capabilities.add(capability);
    candidates.set(grant.workspaceId, capabilities);
  }
  return [...candidates.entries()]
    .filter(([, capabilities]) => capabilities.has(input.requiredCapability))
    .map(([workspaceId, capabilities]) => ({
      workspace: activeWorkspaces.get(workspaceId)!,
      capabilities: [...capabilities].sort(),
    }))
    .sort((left, right) =>
      left.workspace.displayName.localeCompare(right.workspace.displayName),
    );
}

export function selectAuthorizedOperationalWorkspace(input: {
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
  requiredCapability: "calendar.view" | "calendar.edit" | "volunteers.view";
  workspaceKey: unknown;
  at?: Date;
}) {
  if (typeof input.workspaceKey !== "string") return null;
  const workspaceKey = input.workspaceKey.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceKey)) return null;
  return (
    listAuthorizedOperationalWorkspaces(input).find(
      ({ workspace }) => workspace.key === workspaceKey,
    ) ?? null
  );
}
