import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import CalendarClient from "@/components/CalendarClient";
import {
  cancelAssignmentWithClient,
  createAssignmentsBatchWithClient,
} from "@/lib/assignments/server";
import {
  readCalendarAssignmentMutationRouteContext,
  readCalendarMutationRouteContext,
  readCalendarRouteState,
} from "@/lib/calendar/routeRead.server";
import {
  calendarOneOffTimedCreateInputFromFormData,
  calendarOneOffTimedUpdateInputFromFormData,
  calendarPresetTimedCreateInputFromFormData,
  calendarPresetTimedUpdateInputFromFormData,
  createCalendarItemWithClient,
  publishCalendarItemWithClient,
  updateCalendarOneOffTimedItemWithClient,
  updateCalendarPresetTimedItemWithClient,
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
  "assigned",
  "assignment_canceled",
  "published",
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

function calendarSourceModeFromFormData(formData: FormData) {
  return formData.get("sourceMode") === "preset" ? "preset" : "oneOff";
}

async function createCalendarItemAction(formData: FormData) {
  "use server";

  let notice = "error";
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) {
      notice = "unavailable";
    } else {
      const input =
        calendarSourceModeFromFormData(formData) === "preset"
          ? calendarPresetTimedCreateInputFromFormData(formData, context.workspace.id)
          : calendarOneOffTimedCreateInputFromFormData(
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
      if (calendarSourceModeFromFormData(formData) === "preset") {
        const input = calendarPresetTimedUpdateInputFromFormData(formData);
        await updateCalendarPresetTimedItemWithClient(context.supabase, input);
      } else {
        const input = calendarOneOffTimedUpdateInputFromFormData(formData);
        await updateCalendarOneOffTimedItemWithClient(context.supabase, input);
      }
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

async function createCalendarAssignmentsAction(formData: FormData) {
  "use server";

  let notice = "error";
  try {
    const context = await readCalendarAssignmentMutationRouteContext();
    if (!context) {
      notice = "unavailable";
    } else {
      const calendarItemId = formData.get("calendarItemId");
      const volunteerProfileIds = formData.getAll("volunteerProfileIds");
      await createAssignmentsBatchWithClient(context.supabase, {
        calendarItemId,
        volunteerProfileIds,
        note: formData.get("assignmentNote"),
      });
      notice = "assigned";
    }
  } catch (error) {
    notice = error instanceof Error && error.message.toLowerCase().includes("invalid")
      ? "validation"
      : "error";
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function cancelCalendarAssignmentAction(formData: FormData) {
  "use server";

  let notice = "error";
  try {
    const context = await readCalendarAssignmentMutationRouteContext();
    if (!context) {
      notice = "unavailable";
    } else {
      await cancelAssignmentWithClient(context.supabase, {
        assignmentId: formData.get("assignmentId"),
      });
      notice = "assignment_canceled";
    }
  } catch (error) {
    notice = error instanceof Error && error.message.toLowerCase().includes("invalid")
      ? "validation"
      : "error";
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function publishCalendarItemAction(formData: FormData) {
  "use server";

  let notice = "error";
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) {
      notice = "unavailable";
    } else {
      await publishCalendarItemWithClient(context.supabase, {
        calendarItemId: formData.get("calendarItemId"),
      });
      notice = "published";
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
      assignAction={createCalendarAssignmentsAction}
      cancelAssignmentAction={cancelCalendarAssignmentAction}
      createAction={createCalendarItemAction}
      key={`${state.view}:${state.anchorDate}:${state.kind}:${notice ?? ""}`}
      notice={notice}
      publishAction={publishCalendarItemAction}
      state={state}
      updateAction={updateCalendarItemAction}
    />
  );
}
