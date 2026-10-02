import "server-only";
import type { AppSupabaseClient } from "../supabase/types";

export async function readCalendarDraftReviewWithClient(
  supabase: AppSupabaseClient,
  workspaceId: string,
) {
  return supabase.from("calendar_items")
    .select("id,title_snapshot,start_date,end_date")
    .eq("workspace_id", workspaceId)
    .eq("lifecycle", "active")
    .eq("publication_state", "draft")
    .order("start_date", { ascending: false })
    .limit(500);
}
