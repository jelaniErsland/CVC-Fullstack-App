import "server-only";

import {
  readAssignmentResponseByToken,
  submitAssignmentResponseByToken,
} from "@/lib/responseTokens/server";
import {
  ResponseTokenValidationError,
  validateReadAssignmentResponseByTokenInput,
  type PublicAssignmentResponseContext,
  type PublicAssignmentResponseResult,
  type PublicAssignmentResponseStatus,
} from "@/lib/responseTokens/token";
import { PublicAssignmentResponseConfigurationError } from "@/lib/responseTokens/publicRouteState";

export { classifyPublicAssignmentResponseSubmissionError } from "@/lib/responseTokens/publicRouteState";

export type PublicAssignmentResponseRouteContext = Readonly<
  Pick<
    PublicAssignmentResponseContext,
    | "workspaceDisplayName"
    | "taskTitle"
    | "scheduleKind"
    | "startDate"
    | "endDate"
    | "startTime"
    | "endTime"
    | "timezone"
    | "currentResponseStatus"
  >
>;

export type PublicAssignmentResponseRouteState =
  | Readonly<{ kind: "ready"; context: PublicAssignmentResponseRouteContext }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "configuration_unavailable" }>
  | Readonly<{ kind: "error" }>;

function hasPublicSupabaseConfiguration() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

function requirePublicSupabaseConfiguration() {
  if (!hasPublicSupabaseConfiguration()) {
    throw new PublicAssignmentResponseConfigurationError();
  }
}

function toRouteContext(
  context: PublicAssignmentResponseContext,
): PublicAssignmentResponseRouteContext {
  return {
    workspaceDisplayName: context.workspaceDisplayName,
    taskTitle: context.taskTitle,
    scheduleKind: context.scheduleKind,
    startDate: context.startDate,
    endDate: context.endDate,
    startTime: context.startTime,
    endTime: context.endTime,
    timezone: context.timezone,
    currentResponseStatus: context.currentResponseStatus,
  };
}

export async function loadPublicAssignmentResponseRoute(
  token: string,
): Promise<PublicAssignmentResponseRouteState> {
  let validatedToken: string;

  try {
    validatedToken = validateReadAssignmentResponseByTokenInput({ token }).token;
  } catch (error) {
    if (error instanceof ResponseTokenValidationError) return { kind: "unavailable" };
    return { kind: "error" };
  }

  if (!hasPublicSupabaseConfiguration()) {
    return { kind: "configuration_unavailable" };
  }

  try {
    const context = await readAssignmentResponseByToken({ token: validatedToken });
    return context
      ? { kind: "ready", context: toRouteContext(context) }
      : { kind: "unavailable" };
  } catch {
    return { kind: "error" };
  }
}

export async function submitPublicAssignmentResponseForRoute(input: {
  token: string;
  status: PublicAssignmentResponseStatus | unknown;
  note: string | null;
}): Promise<PublicAssignmentResponseResult> {
  requirePublicSupabaseConfiguration();
  return submitAssignmentResponseByToken(input);
}
