"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readCalendarMutationRouteContext } from "./routeRead.server";
import { normalizeProjectDate } from "../operations/projectDay";
import type { PublicRpcArgs } from "../supabase/types";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function mutate(form: FormData, kind: "meal" | "duplicate") {
  const params = new URLSearchParams();
  const view = field(form, "redirectView");
  params.set("view", ["day", "week", "month", "list"].includes(view) ? view : "day");
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) throw new Error("Unauthorized");
    const date = normalizeProjectDate(field(form, kind === "meal" ? "date" : "targetDate"));
    params.set("date", date);
    const start = field(form, "startTime") || null;
    const end = field(form, "endTime") || null;
    if (Boolean(start) !== Boolean(end) || (start && end && end <= start)) throw new Error("Invalid time");
    const itemId = field(form, "calendarItemId");
    const totalText = field(form, "total");
    if (totalText && !/^\d{1,6}$/.test(totalText)) throw new Error("Invalid total");
    const result = kind === "meal"
      ? await context.supabase.rpc("save_calendar_meal", {
          p_workspace_id: context.workspace.id, p_calendar_item_id: itemId || null,
          p_meal_kind: field(form, "mealKind"), p_date: date,
          p_start_time: start, p_end_time: end, p_provider: field(form, "provider") || null,
          p_contact: field(form, "contact") || null, p_menu: field(form, "menu") || null,
          p_total: totalText === "" ? null : Number(totalText), p_notes: field(form, "notes") || null,
        } as PublicRpcArgs<"save_calendar_meal">)
      : await context.supabase.rpc("duplicate_calendar_item", {
          p_calendar_item_id: itemId, p_target_date: date, p_start_time: start, p_end_time: end,
        } as PublicRpcArgs<"duplicate_calendar_item">);
    if (result.error || typeof result.data !== "string") throw new Error("Unavailable");
    params.set("item", result.data);
    params.set("notice", kind === "meal" ? "meal_saved" : "duplicated");
    for (const path of ["/admin/calendar", "/admin/quick-view", "/qv", "/schedule"]) revalidatePath(path);
  } catch {
    params.set("notice", "operation_unavailable");
  }
  redirect("/admin/calendar?" + params.toString());
}

export async function saveCalendarMealAction(form: FormData) { await mutate(form, "meal"); }
export async function duplicateCalendarItemAction(form: FormData) { await mutate(form, "duplicate"); }
