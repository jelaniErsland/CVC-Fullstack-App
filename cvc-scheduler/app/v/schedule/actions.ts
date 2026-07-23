"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  confirmAllVolunteerScheduleAssignments,
  submitVolunteerScheduleAssignmentResponse,
  volunteerScheduleAccessCookie,
} from "@/lib/volunteerScheduleAccess/server";

export type VolunteerScheduleActionResult = Readonly<{
  ok: boolean;
  code: "saved" | "confirmed_all" | "unavailable" | "locked" | "changed" | "invalid" | "error";
  message: string;
}>;

const safeFailure: VolunteerScheduleActionResult = {
  ok: false,
  code: "unavailable",
  message: "That response is no longer available. Refresh your schedule or contact the project team.",
};

function findSqlState(error: unknown) {
  const visited = new Set<unknown>();
  let current = error;

  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }

  return null;
}

function classifyVolunteerScheduleResponseError(error: unknown): VolunteerScheduleActionResult {
  const sqlState = findSqlState(error);
  if (sqlState === "40001") {
    return {
      ok: false,
      code: "changed",
      message: "This response changed. Refresh your schedule and try again.",
    };
  }
  if (sqlState === "42501") return safeFailure;
  return {
    ok: false,
    code: "error",
    message: "We could not save that response. Please try again shortly.",
  };
}

async function readScheduleCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(volunteerScheduleAccessCookie.name)?.value ?? null;
}

export async function submitVolunteerScheduleResponseAction(
  formData: FormData,
): Promise<VolunteerScheduleActionResult> {
  const token = await readScheduleCookie();
  if (!token) return safeFailure;

  const assignmentId = formData.get("assignmentId");
  const status = formData.get("status");
  const noteValue = formData.get("note");
  const note = typeof noteValue === "string" ? noteValue : null;

  try {
    const result = await submitVolunteerScheduleAssignmentResponse({
      token,
      assignmentId,
      status,
      note,
    });
    revalidatePath("/v/schedule");
    return {
      ok: true,
      code: "saved",
      message:
        result.status === "confirmed"
          ? "Your response is now Confirmed."
          : "Your response is now Can’t make it.",
    };
  } catch (error) {
    return classifyVolunteerScheduleResponseError(error);
  }
}

export async function confirmAllVolunteerScheduleAction(): Promise<VolunteerScheduleActionResult> {
  const token = await readScheduleCookie();
  if (!token) return safeFailure;

  try {
    const result = await confirmAllVolunteerScheduleAssignments({ token });
    revalidatePath("/v/schedule");
    return {
      ok: true,
      code: "confirmed_all",
      message:
        result.confirmedCount === 1
          ? "Confirmed 1 assignment."
          : `Confirmed ${result.confirmedCount} assignments.`,
    };
  } catch (error) {
    return classifyVolunteerScheduleResponseError(error);
  }
}
