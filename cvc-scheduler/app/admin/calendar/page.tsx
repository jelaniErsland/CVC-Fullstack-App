import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import CalendarClient from "@/components/CalendarClient";
import {
  cancelAssignmentWithClient,
  createAssignmentsBatchWithClient,
} from "@/lib/assignments/server";
import {
  InitialAssignmentNotificationBoundaryError,
  sendInitialAssignmentNotificationsForItemWithClient,
} from "@/lib/calendar/assignmentNotifications.server";
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
  archiveCalendarItemWithClient,
  createCalendarItemWithClient,
  publishCalendarItemWithClient,
  updateCalendarOneOffTimedItemWithClient,
  updateCalendarPresetTimedItemWithClient,
} from "@/lib/calendar/server";
import {
  emitOperationalEvent,
  type OperationalEventName,
} from "@/lib/observability/server";
import { readVerifiedAdminContext } from "@/lib/auth/verified-admin-context.server";
import {
  normalizeProjectDate,
  parseProjectDayExpectedOnSiteFormValue,
  ProjectDayValidationError,
  type ProjectDayMutationState,
} from "@/lib/operations/projectDay";
import { setProjectDayExpectedOnSiteWithVerifiedContext } from "@/lib/operations/projectDay.server";
import {
  updateCurrentVolunteerFacingContactDetails,
  VolunteerFacingContactDetailsValidationError,
} from "@/lib/projectContacts/volunteerFacingDetails.server";

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
  "archived",
  "assignment_email_sent",
  "assignment_email_already_sent",
  "assignment_email_partial",
  "published",
  "follow_up_contact_updated",
  "follow_up_contact_validation",
  "follow_up_contact_unavailable",
  "follow_up_contact_error",
  "validation",
  "unavailable",
  "error",
]);

const calendarItemIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportedInspectorSections = new Set([
  "details",
  "volunteers",
  "visibility",
  "notification",
]);

function safeCalendarRedirect(
  formData: FormData,
  notice: string,
  createdCalendarItemId?: string,
  preserveRequestedItem = true,
) {
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
  const requestedItem = preserveRequestedItem
    ? createdCalendarItemId ?? formData.get("redirectItem")
    : undefined;
  const requestedSection = createdCalendarItemId
    ? "volunteers"
    : formData.get("redirectSection");
  if (typeof requestedItem === "string" && calendarItemIdPattern.test(requestedItem)) {
    params.set("item", requestedItem);
    if (
      typeof requestedSection === "string" &&
      supportedInspectorSections.has(requestedSection)
    ) {
      params.set("section", requestedSection);
    }
  }
  params.set("notice", supportedNoticeValues.has(notice) ? notice : "error");
  return `/admin/calendar?${params.toString()}`;
}

function calendarSourceModeFromFormData(formData: FormData) {
  return formData.get("sourceMode") === "preset" ? "preset" : "oneOff";
}

function observeMutationFailure(
  event: Extract<
    OperationalEventName,
    | "calendar.create_failure"
    | "calendar.update_failure"
    | "calendar.publish_failure"
    | "assignment.create_failure"
    | "assignment.cancel_failure"
    | "assignment_email.request_failure"
  >,
  notice: "unavailable" | "validation" | "error",
) {
  emitOperationalEvent({
    event,
    failureCode:
      notice === "unavailable"
        ? "context_unavailable"
        : notice === "validation"
          ? "validation_failed"
          : event === "assignment_email.request_failure"
            ? "unexpected_failure"
            : "persistence_failed",
  });
}

async function createCalendarItemAction(formData: FormData) {
  "use server";

  let notice: "unavailable" | "validation" | "error" | "created" = "error";
  let createdCalendarItemId: string | undefined;
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) {
      notice = "unavailable";
      observeMutationFailure("calendar.create_failure", "unavailable");
    } else {
      const input =
        calendarSourceModeFromFormData(formData) === "preset"
          ? calendarPresetTimedCreateInputFromFormData(formData, context.workspace.id)
          : calendarOneOffTimedCreateInputFromFormData(
              formData,
              context.workspace.id,
            );
      const result = await createCalendarItemWithClient(context.supabase, input);
      createdCalendarItemId = result.calendarItemId;
      notice = "created";
    }
  } catch (error) {
    notice = error instanceof Error && error.message.toLowerCase().includes("invalid")
      ? "validation"
      : "error";
    observeMutationFailure(
      "calendar.create_failure",
      notice === "validation" ? "validation" : "error",
    );
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice, createdCalendarItemId));
}

async function updateCalendarItemAction(formData: FormData) {
  "use server";

  let notice: "unavailable" | "validation" | "error" | "updated" = "error";
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) {
      notice = "unavailable";
      observeMutationFailure("calendar.update_failure", "unavailable");
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
    observeMutationFailure(
      "calendar.update_failure",
      notice === "validation" ? "validation" : "error",
    );
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function createCalendarAssignmentsAction(formData: FormData) {
  "use server";

  let notice: "unavailable" | "validation" | "error" | "assigned" = "error";
  try {
    const context = await readCalendarAssignmentMutationRouteContext();
    if (!context) {
      notice = "unavailable";
      observeMutationFailure("assignment.create_failure", "unavailable");
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
    observeMutationFailure(
      "assignment.create_failure",
      notice === "validation" ? "validation" : "error",
    );
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function cancelCalendarAssignmentAction(formData: FormData) {
  "use server";

  let notice:
    | "unavailable"
    | "validation"
    | "error"
    | "assignment_canceled" = "error";
  try {
    const context = await readCalendarAssignmentMutationRouteContext();
    if (!context) {
      notice = "unavailable";
      observeMutationFailure("assignment.cancel_failure", "unavailable");
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
    observeMutationFailure(
      "assignment.cancel_failure",
      notice === "validation" ? "validation" : "error",
    );
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function publishCalendarItemAction(formData: FormData) {
  "use server";

  let notice: "unavailable" | "validation" | "error" | "published" = "error";
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) {
      notice = "unavailable";
      observeMutationFailure("calendar.publish_failure", "unavailable");
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
    observeMutationFailure(
      "calendar.publish_failure",
      notice === "validation" ? "validation" : "error",
    );
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function archiveCalendarItemAction(formData: FormData) {
  "use server";

  let notice: "unavailable" | "validation" | "error" | "archived" = "error";
  try {
    const context = await readCalendarMutationRouteContext();
    if (!context) {
      notice = "unavailable";
    } else {
      await archiveCalendarItemWithClient(
        context.supabase,
        String(formData.get("calendarItemId") ?? ""),
      );
      notice = "archived";
    }
  } catch (error) {
    notice = error instanceof Error && error.message.toLowerCase().includes("invalid")
      ? "validation"
      : "error";
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/needs-attention");
  revalidatePath("/admin/quick-view");
  redirect(safeCalendarRedirect(formData, notice, undefined, false));
}

async function sendInitialAssignmentNotificationsAction(formData: FormData) {
  "use server";

  let notice:
    | "unavailable"
    | "validation"
    | "error"
    | "assignment_email_sent"
    | "assignment_email_already_sent"
    | "assignment_email_partial" = "error";
  try {
    const context = await readCalendarAssignmentMutationRouteContext();
    if (!context) {
      notice = "unavailable";
      observeMutationFailure("assignment_email.request_failure", "unavailable");
    } else {
      const result = await sendInitialAssignmentNotificationsForItemWithClient(
        context.supabase,
        {
          calendarItemId: formData.get("calendarItemId"),
        },
      );
      if (result.sentCount > 0 && result.failedCount === 0) {
        notice = "assignment_email_sent";
      } else if (result.sentCount === 0 && result.alreadySentCount > 0) {
        notice = "assignment_email_already_sent";
      } else if (result.sentCount > 0 || result.failedCount > 0) {
        notice = "assignment_email_partial";
      } else {
        notice = "unavailable";
      }
    }
  } catch (error) {
    notice = error instanceof Error && error.message.toLowerCase().includes("invalid")
      ? "validation"
      : "error";
    if (!(error instanceof InitialAssignmentNotificationBoundaryError)) {
      observeMutationFailure(
        "assignment_email.request_failure",
        notice === "validation" ? "validation" : "error",
      );
    }
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function updateCurrentVolunteerFacingContactDetailsAction(formData: FormData) {
  "use server";

  let notice:
    | "follow_up_contact_updated"
    | "follow_up_contact_validation"
    | "follow_up_contact_unavailable"
    | "follow_up_contact_error" = "follow_up_contact_error";
  try {
    const updated = await updateCurrentVolunteerFacingContactDetails({
      displayName: formData.get("volunteerFacingDisplayName"),
      email: formData.get("volunteerFacingEmail"),
      phone: formData.get("volunteerFacingPhone"),
    });
    notice = updated ? "follow_up_contact_updated" : "follow_up_contact_unavailable";
  } catch (error) {
    notice =
      error instanceof VolunteerFacingContactDetailsValidationError
        ? "follow_up_contact_validation"
        : "follow_up_contact_error";
  }

  revalidatePath("/admin/calendar");
  redirect(safeCalendarRedirect(formData, notice));
}

async function updateProjectDayExpectedOnSiteAction(
  _previousState: ProjectDayMutationState,
  formData: FormData,
): Promise<ProjectDayMutationState> {
  "use server";

  const rawDate = formData.get("projectDate");
  let date = typeof rawDate === "string" ? rawDate : "";
  try {
    date = normalizeProjectDate(rawDate);
    const expectedOnSiteCount = parseProjectDayExpectedOnSiteFormValue(
      formData.get("expectedOnSiteCount"),
    );
    const context = await readVerifiedAdminContext();
    if (!context) {
      return {
        status: "unavailable",
        date,
        expectedOnSiteCount,
        message: "Expected-on-site editing is unavailable for this contact.",
      };
    }
    const updated = await setProjectDayExpectedOnSiteWithVerifiedContext(context, {
      date,
      expectedOnSiteCount,
    });
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/quick-view");
    return {
      status: "success",
      date: updated.date,
      expectedOnSiteCount: updated.expectedOnSiteCount,
      message: updated.expectedOnSiteCount === null
        ? "Expected on site cleared."
        : "Expected on site saved.",
    };
  } catch (error) {
    if (error instanceof ProjectDayValidationError) {
      return {
        status: "validation",
        date,
        expectedOnSiteCount: null,
        message: error.issues[0] ?? "Enter a valid whole number.",
      };
    }
    return {
      status: "error",
      date,
      expectedOnSiteCount: null,
      message: "Expected on site could not be saved. Try again.",
    };
  }
}

export default async function AdminCalendarPage({ searchParams }: CalendarPageProps) {
  const resolvedSearchParams = await searchParams;
  const state = await readCalendarRouteState(resolvedSearchParams);
  const noticeValue = resolvedSearchParams?.notice;
  const notice = typeof noticeValue === "string" ? noticeValue : undefined;
  const requestedItemValue = resolvedSearchParams?.item;
  const requestedItem =
    typeof requestedItemValue === "string" &&
    calendarItemIdPattern.test(requestedItemValue) &&
    (state.kind === "ready_with_items" || state.kind === "ready_empty") &&
    state.items.some((item) => item.id === requestedItemValue)
      ? requestedItemValue
      : undefined;
  const requestedSectionValue = resolvedSearchParams?.section;
  const requestedSection =
    requestedItem &&
    typeof requestedSectionValue === "string" &&
    supportedInspectorSections.has(requestedSectionValue)
      ? (requestedSectionValue as "details" | "volunteers" | "visibility" | "notification")
      : undefined;

  return (
    <CalendarClient
      assignAction={createCalendarAssignmentsAction}
      archiveAction={archiveCalendarItemAction}
      cancelAssignmentAction={cancelCalendarAssignmentAction}
      createAction={createCalendarItemAction}
      initialInspectorItemId={requestedItem}
      initialInspectorSection={requestedSection}
      notice={notice}
      publishAction={publishCalendarItemAction}
      sendInitialAssignmentNotificationsAction={sendInitialAssignmentNotificationsAction}
      updateCurrentVolunteerFacingContactDetailsAction={
        updateCurrentVolunteerFacingContactDetailsAction
      }
      state={state}
      updateProjectDayAction={updateProjectDayExpectedOnSiteAction}
      updateAction={updateCalendarItemAction}
    />
  );
}
