import "server-only";

import type { VerifiedAdminContext } from "../auth/verified-admin-context.server.ts";
import { listAuthorizedOperationalWorkspaces, normalizeProjectDate } from "./projectDay.ts";
import { readAuthorizedQuickViewSafeProjection } from "./projectQuickView.server.ts";
import type { QuickViewSafeProjection } from "./projections.ts";

export type QuickViewProjectOption = Readonly<{
  key: string;
  displayName: string;
}>;

export type ProjectQuickViewRouteState =
  | Readonly<{
      kind: "ready";
      projects: readonly QuickViewProjectOption[];
      selectedProjectKey: string;
      date: string;
      today: string;
      projection: QuickViewSafeProjection;
    }>
  | Readonly<{
      kind: "unavailable";
      projects: readonly QuickViewProjectOption[];
      selectedProjectKey: string | null;
      date: string;
      today: string;
      reason: "unauthenticated" | "unauthorized" | "project_unavailable" | "invalid_date" | "read_unavailable";
    }>;

type QuickViewSearchParams = Record<string, string | string[] | undefined> | undefined;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function currentProjectDate(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Denver",
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function safeProjects(context: VerifiedAdminContext): readonly QuickViewProjectOption[] {
  return listAuthorizedOperationalWorkspaces({
    projectContactId: context.projectContactId,
    ownGrants: context.ownGrants,
    workspaces: context.workspaces,
    requiredCapability: "calendar.view",
  }).map(({ workspace }) => ({
    key: workspace.key,
    displayName: workspace.displayName,
  }));
}

export async function readProjectQuickViewRouteState(
  searchParams?: QuickViewSearchParams,
  dependencies: Readonly<{
    resolveContext?: () => Promise<
      | Readonly<{ kind: "ready"; context: VerifiedAdminContext }>
      | Readonly<{ kind: "unauthenticated" | "unauthorized" }>
    >;
    readProjection?: typeof readAuthorizedQuickViewSafeProjection;
    now?: Date;
  }> = {},
): Promise<ProjectQuickViewRouteState> {
  const today = currentProjectDate(dependencies.now);
  const rawDate = firstValue(searchParams?.date) ?? today;
  let date: string;
  try {
    date = normalizeProjectDate(rawDate);
  } catch {
    return {
      kind: "unavailable",
      projects: [],
      selectedProjectKey: null,
      date: today,
      today,
      reason: "invalid_date",
    };
  }
  const resolveContext = dependencies.resolveContext ?? (async () => {
    const { resolveVerifiedAdminContext } = await import(
      "../auth/verified-admin-context.server.ts"
    );
    return resolveVerifiedAdminContext();
  });
  const contextResult = await resolveContext();
  if (contextResult.kind !== "ready") {
    return {
      kind: "unavailable",
      projects: [],
      selectedProjectKey: null,
      date,
      today,
      reason: contextResult.kind,
    };
  }
  const context = contextResult.context;
  const projects = safeProjects(context);
  if (projects.length === 0) {
    return {
      kind: "unavailable",
      projects,
      selectedProjectKey: null,
      date,
      today,
      reason: "unauthorized",
    };
  }
  const requestedProjectKey = firstValue(searchParams?.project);
  const selectedProject = requestedProjectKey === undefined
    ? projects[0]
    : projects.find(({ key }) => key === requestedProjectKey);
  if (!selectedProject) {
    return {
      kind: "unavailable",
      projects,
      selectedProjectKey: null,
      date,
      today,
      reason: "project_unavailable",
    };
  }
  try {
    const projection = await (
      dependencies.readProjection ?? readAuthorizedQuickViewSafeProjection
    )(context, date, selectedProject.key);
    return {
      kind: "ready",
      projects,
      selectedProjectKey: selectedProject.key,
      date,
      today,
      projection,
    };
  } catch {
    return {
      kind: "unavailable",
      projects,
      selectedProjectKey: selectedProject.key,
      date,
      today,
      reason: "read_unavailable",
    };
  }
}
