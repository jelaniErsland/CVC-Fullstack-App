import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  loadVerifiedProjectContactGrantsWithClient,
  readVerifiedProjectContactIdWithClient,
  type ProjectContactGrantState,
} from "./project-contact-grants.ts";
import type { ProjectContactGrant } from "./grant.ts";
import type { AppSupabaseClient } from "../supabase/types.ts";
import type { WorkspaceIdentity } from "../workspaces/identity.ts";

export type VerifiedAdminContext = Readonly<{
  supabase: AppSupabaseClient;
  authenticatedUserId: string;
  projectContactId: string;
  ownGrants: readonly ProjectContactGrant[];
  workspaces: readonly WorkspaceIdentity[];
}>;

export type VerifiedAdminContextResult =
  | Readonly<{ kind: "ready"; context: VerifiedAdminContext }>
  | Readonly<{ kind: "unauthenticated" | "unauthorized" }>;

export const VERIFIED_ADMIN_CONTEXT_CALL_GRAPH = {
  proxyVerifiedAuthCalls: 1,
  pageSupabaseClients: 1,
  pageVerifiedAuthCalls: 1,
  contextDatabaseReads: 3,
  contextDatabaseReadStagesAfterAuth: 1,
  expectedRemoteCallsIncludingProxy: {
    tasksEmpty: { before: 8, after: 6 },
    volunteersEmpty: { before: 8, after: 6 },
    needsAttentionEmpty: { before: 8, after: 6 },
    overviewEmpty: { before: 10, after: 8 },
    calendarEmpty: { before: 10, after: 8 },
  },
} as const;

type VerifiedAdminContextDependencies = Readonly<{
  readVerifiedUser: (
    supabase: AppSupabaseClient,
  ) => Promise<Readonly<{ user: User | null; error: unknown }>>;
  loadVerifiedGrants: (
    supabase: AppSupabaseClient,
  ) => Promise<ProjectContactGrantState>;
  readVerifiedProjectContactId: (
    supabase: AppSupabaseClient,
    authenticatedUserId: string,
  ) => Promise<string | null>;
  readGrantedWorkspaces: (
    supabase: AppSupabaseClient,
  ) => Promise<readonly WorkspaceIdentity[]>;
}>;

const defaultDependencies: VerifiedAdminContextDependencies = {
  async readVerifiedUser(supabase) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return { user, error };
  },
  loadVerifiedGrants: loadVerifiedProjectContactGrantsWithClient,
  readVerifiedProjectContactId: readVerifiedProjectContactIdWithClient,
  async readGrantedWorkspaces(supabase) {
    const { readGrantedWorkspacesWithClient } = await import(
      "../workspaces/granted.ts"
    );
    return readGrantedWorkspacesWithClient(supabase);
  },
};

/**
 * Builds one explicit, server-only authorization context for a page render.
 * The verified identity is fresh for this request; all later reads reuse the
 * same RLS-bound client and never trust browser-provided identity or scope.
 */
export async function resolveVerifiedAdminContextWithClient(
  supabase: AppSupabaseClient,
  dependencies: VerifiedAdminContextDependencies = defaultDependencies,
): Promise<VerifiedAdminContextResult> {
  const { user, error } = await dependencies.readVerifiedUser(supabase);
  if (error || !user) return { kind: "unauthenticated" };

  const [grantState, projectContactId, workspaces] = await Promise.all([
    dependencies.loadVerifiedGrants(supabase),
    dependencies.readVerifiedProjectContactId(supabase, user.id),
    dependencies.readGrantedWorkspaces(supabase),
  ]);
  if (grantState.status !== "authorized" || !projectContactId) {
    return { kind: "unauthorized" };
  }

  const ownGrants = grantState.grants.filter(
    (grant) => grant.projectContactId === projectContactId,
  );
  if (ownGrants.length === 0) return { kind: "unauthorized" };

  return {
    kind: "ready",
    context: {
      supabase,
      authenticatedUserId: user.id,
      projectContactId,
      ownGrants,
      workspaces,
    },
  };
}

export async function readVerifiedAdminContextWithClient(
  supabase: AppSupabaseClient,
  dependencies: VerifiedAdminContextDependencies = defaultDependencies,
) {
  const result = await resolveVerifiedAdminContextWithClient(supabase, dependencies);
  return result.kind === "ready" ? result.context : null;
}

export async function resolveVerifiedAdminContext() {
  const { createServerSupabaseClient } = await import("../supabase/server.ts");
  const supabase = await createServerSupabaseClient();
  return resolveVerifiedAdminContextWithClient(supabase);
}

export async function readVerifiedAdminContext() {
  const result = await resolveVerifiedAdminContext();
  return result.kind === "ready" ? result.context : null;
}
