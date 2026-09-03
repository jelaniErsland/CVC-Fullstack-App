import "server-only";

import { createClient } from "@supabase/supabase-js";

import { resolveVerifiedAdminContextWithClient } from "../auth/verified-admin-context.server.ts";
import { selectAuthorizedOperationalWorkspace } from "../operations/projectDay.ts";
import { readSupabasePublicConfig } from "../supabase/config.ts";
import type { Database } from "../supabase/database.types.ts";
import { createServerSupabaseClient } from "../supabase/server.ts";
import type { AppSupabaseClient, PublicRpcArgs } from "../supabase/types.ts";
import {
  parseIssuedProjectQuickViewAccess,
  parseProjectQuickViewShareState,
  parseSharedProjectQuickView,
  validateOptionalProjectDate,
  validateQuickViewBearer,
  validateWorkspaceId,
} from "./token.ts";

export const projectQuickViewAccessCookie = {
  name: "pl-project-quick-view",
  path: "/qv",
} as const;

function createQuickViewReadClient(): AppSupabaseClient {
  const config = readSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function requireShareWorkspace(workspaceKey: unknown) {
  const supabase = await createServerSupabaseClient();
  const contextResult = await resolveVerifiedAdminContextWithClient(supabase);
  if (contextResult.kind !== "ready") {
    throw new Error("Project Quick View sharing is unavailable.");
  }
  const selection = selectAuthorizedOperationalWorkspace({
    projectContactId: contextResult.context.projectContactId,
    ownGrants: contextResult.context.ownGrants,
    workspaces: contextResult.context.workspaces,
    requiredCapability: "calendar.edit",
    workspaceKey,
  });
  if (!selection) throw new Error("Project Quick View sharing is unavailable.");
  return { supabase, workspace: selection.workspace };
}

export async function issueProjectQuickViewAccess(workspaceKey: unknown) {
  const { supabase, workspace } = await requireShareWorkspace(workspaceKey);
  const workspaceId = validateWorkspaceId(workspace.id);
  const { data, error } = await supabase.rpc("issue_project_quick_view_access", {
    p_workspace_id: workspaceId,
  } as PublicRpcArgs<"issue_project_quick_view_access">);
  if (error) throw new Error("Project Quick View link could not be created.", { cause: error });
  return parseIssuedProjectQuickViewAccess(data);
}

export async function readProjectQuickViewShareState(workspaceKey: unknown) {
  const { supabase, workspace } = await requireShareWorkspace(workspaceKey);
  const { data, error } = await supabase.rpc("read_project_quick_view_share_state", {
    p_workspace_id: validateWorkspaceId(workspace.id),
  } as PublicRpcArgs<"read_project_quick_view_share_state">);
  if (error) throw new Error("Project Quick View sharing state is unavailable.", { cause: error });
  return parseProjectQuickViewShareState(data);
}

export async function revokeProjectQuickViewAccess(workspaceKey: unknown) {
  const { supabase, workspace } = await requireShareWorkspace(workspaceKey);
  const { data, error } = await supabase.rpc("revoke_project_quick_view_access", {
    p_workspace_id: validateWorkspaceId(workspace.id),
  } as PublicRpcArgs<"revoke_project_quick_view_access">);
  if (error || typeof data !== "number") {
    throw new Error("Project Quick View shared access could not be disabled.", { cause: error });
  }
  return { revokedCount: data };
}

export async function readSharedProjectQuickView(input: {
  token: unknown;
  date?: unknown;
}) {
  const token = validateQuickViewBearer(input.token);
  const date = validateOptionalProjectDate(input.date);
  const supabase = createQuickViewReadClient();
  const { data, error } = await supabase.rpc("read_project_quick_view_by_token", {
    p_bearer_token: token,
    p_project_date: date,
  } as unknown as PublicRpcArgs<"read_project_quick_view_by_token">);
  if (error) throw new Error("Project Quick View is unavailable.", { cause: error });
  return parseSharedProjectQuickView(data);
}
