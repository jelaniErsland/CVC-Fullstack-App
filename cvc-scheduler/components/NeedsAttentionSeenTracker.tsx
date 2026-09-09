"use client";

import { useEffect } from "react";
import { markNeedsAttentionSignalsSeenAction } from "@/app/admin/needs-attention/actions";

export function NeedsAttentionSeenTracker({ workspaceId, signalIds }: { workspaceId: string; signalIds: readonly string[] }) {
  useEffect(() => {
    if (!signalIds.length) return;
    void markNeedsAttentionSignalsSeenAction(workspaceId, signalIds).then((marked) => {
      if (marked) window.dispatchEvent(new Event("project-local:needs-attention-seen"));
    });
  }, [signalIds, workspaceId]);
  return null;
}
