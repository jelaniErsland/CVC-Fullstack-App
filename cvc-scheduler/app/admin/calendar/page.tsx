import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import CalendarClient from "@/components/CalendarClient";
import {
  readCalendarMutationRouteContext,
  readCalendarRouteState,
} from "@/lib/calendar/routeRead.server";
import {
  calendarOneOffTimedCreateInputFromFormData,
  calendarOneOffTimedUpdateInputFromFormData,
  createCalendarItemWithClient,
  updateCalendarOneOffTimedItemWithClient,
} from "@/lib/calendar/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type CalendarPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

const supportedNoticeValues = new Set([
  "created",
  "updated",
  "validation",
  "unavailable",
  "error",
]);

function safeCalendarRedirect(formData: FormData, notice: string) {
  const view = formData.get("redirectView");
  const date = formData.get("redirectDate");
  const params = new URLSearchParams();
  if (
    typeof view === "string" &&
    ["day", "week", "month", "list"].includes(view) &&
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    params.set("view", view);
    params.set("date", date);
  }
  params.set("notice", supportedNoticeValues.has(notice) ? notice : "error");
  return `/admin/calendar?${params.toString()}`;
}

async function createCalendarItemAction(formData: FormData) {
  "use server";

  let notice = "error";
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) {
      notice = "unavailable";
    } else {
      const input = calendarOneOffTimedCreateInputFromFormData(
        formData,
        context.workspace.id,
      );
      await createCalendarItemWithClient(context.supabase, input);
      notice = "created";
    }
  } catch (error) {
    notice = error instanceof Error && error.message.toLowerCase().includes("invalid")
      ? "validation"
      : "error";
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function updateCalendarItemAction(formData: FormData) {
  "use server";

  let notice = "error";
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) {
      notice = "unavailable";
    } else {
      const input = calendarOneOffTimedUpdateInputFromFormData(formData);
      await updateCalendarOneOffTimedItemWithClient(context.supabase, input);
      notice = "updated";
    }
  } catch (error) {
    notice = error instanceof Error && error.message.toLowerCase().includes("invalid")
      ? "validation"
      : "error";
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

export default async function AdminCalendarPage({ searchParams }: CalendarPageProps) {
  const resolvedSearchParams = await searchParams;
  const state = await readCalendarRouteState(resolvedSearchParams);
  const noticeValue = resolvedSearchParams?.notice;
  const notice = typeof noticeValue === "string" ? noticeValue : undefined;

  return (
    <CalendarClient
      createAction={createCalendarItemAction}
      key={`${state.view}:${state.anchorDate}:${state.kind}:${notice ?? ""}`}
      notice={notice}
      state={state}
      updateAction={updateCalendarItemAction}
    />
  );
}
