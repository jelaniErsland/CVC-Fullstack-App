"use server";

import { readNeedsAttentionRouteState } from "@/lib/needsAttention/routeRead.server";

type NeedsAttentionSeenWriter = {
  rpc: (
    functionName: "mark_needs_attention_signal_seen",
    args: { p_workspace_id: string; p_signal_id: string },
  ) => Promise<{ error: unknown | null }>;
};

export async function getNeedsAttentionUnseenCountAction() {
  const state = await readNeedsAttentionRouteState();
  return state.kind === "ready" ? state.unseenSignalCount : 0;
}

export async function markNeedsAttentionSignalsSeenAction(workspaceId: string, signalIds: readonly string[]) {
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId) || signalIds.length > 100) return false;
  const { readVerifiedAdminContext } = await import("@/lib/auth/verified-admin-context.server");
  const context = await readVerifiedAdminContext();
  if (!context) return false;
  const supabase = context.supabase as unknown as NeedsAttentionSeenWriter;
  const results = await Promise.all(
    signalIds.map((signalId) =>
      supabase.rpc("mark_needs_attention_signal_seen", {
        p_workspace_id: workspaceId,
        p_signal_id: signalId,
      }),
    ),
  );
  return results.every((result) => result.error === null);
}
