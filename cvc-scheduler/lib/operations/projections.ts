import type { ProjectDay } from "./projectDay.ts";

export const operationalProjectionAudiences = [
  "general_project_visible",
  "food_authorized",
  "security_authorized",
  "admin_project_contact",
] as const;

export const operationalVisibilityContract = {
  generalProjectVisible: {
    accessOwner: "future_authorized_project_context_not_public_lookup",
    securityCategoryAllowed: false,
    volunteerOrAssignmentDataAllowed: false,
  },
  foodAuthorized: {
    currentAccessOwner: "authenticated_project_contact_with_calendar_view",
    sharedProjectDayCountAllowed: true,
    publishedFoodScheduleAllowed: true,
    assignmentsAllowed: false,
  },
  securityAuthorized: {
    currentAccessOwner: "admin_project_contact_only",
    dedicatedNarrowCapabilityExists: false,
    futureReadModelRequiresExplicitAuthorization: true,
    generalProjectionFallbackAllowed: false,
  },
  adminProjectContact: {
    accessOwner: "verified_admin_context_and_existing_capabilities",
    broadModelMayBeUsedAsQuickViewOutput: false,
  },
} as const;

export type OperationalScheduleSource = Readonly<{
  title: string;
  taskType: "general" | "food" | "security" | "custom";
  scheduleKind: "timed" | "date_based" | "multi_day_window" | "milestone";
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  neededCount: number;
  lifecycle: "active" | "archived" | "canceled";
  publicationState: "draft" | "published";
}>;

export type QuickViewScheduleSummary = Readonly<{
  title: string;
  category: "general" | "food" | "custom";
  schedule:
    | Readonly<{ kind: "timed"; startTime: string; endTime: string }>
    | Readonly<{ kind: "untimed" }>;
  plannedStaffingCount: number;
}>;

export type QuickViewSafeProjection = Readonly<{
  projectDisplayName: string;
  date: string;
  expectedOnSiteCount: number | null;
  publishedSchedule: readonly QuickViewScheduleSummary[];
}>;

export type FoodOperationalProjection = Readonly<{
  date: string;
  expectedOnSiteCount: number | null;
  publishedFoodSchedule: readonly QuickViewScheduleSummary[];
}>;

function safeScheduleSummary(
  source: OperationalScheduleSource,
): QuickViewScheduleSummary | null {
  if (
    source.lifecycle !== "active" ||
    source.publicationState !== "published" ||
    source.taskType === "security"
  ) {
    return null;
  }
  if (source.taskType !== "general" && source.taskType !== "food" && source.taskType !== "custom") {
    return null;
  }
  const schedule =
    source.scheduleKind === "timed" && source.startTime && source.endTime
      ? { kind: "timed" as const, startTime: source.startTime, endTime: source.endTime }
      : { kind: "untimed" as const };
  return {
    title: source.title,
    category: source.taskType,
    schedule,
    plannedStaffingCount: source.neededCount,
  };
}

export function buildQuickViewSafeProjection(input: {
  projectDisplayName: string;
  date: string;
  projectDay: ProjectDay | null;
  schedule: readonly OperationalScheduleSource[];
}): QuickViewSafeProjection {
  return {
    projectDisplayName: input.projectDisplayName,
    date: input.date,
    expectedOnSiteCount: input.projectDay?.expectedOnSiteCount ?? null,
    publishedSchedule: input.schedule
      .map(safeScheduleSummary)
      .filter((item): item is QuickViewScheduleSummary => item !== null),
  };
}

export function buildFoodOperationalProjection(input: {
  date: string;
  projectDay: ProjectDay | null;
  schedule: readonly OperationalScheduleSource[];
}): FoodOperationalProjection {
  return {
    date: input.date,
    expectedOnSiteCount: input.projectDay?.expectedOnSiteCount ?? null,
    publishedFoodSchedule: input.schedule
      .filter((item) => item.taskType === "food")
      .map(safeScheduleSummary)
      .filter((item): item is QuickViewScheduleSummary => item !== null),
  };
}

export const quickViewExplicitlyExcludedFields = [
  "internal_ids",
  "volunteer_names",
  "volunteer_email",
  "volunteer_phone",
  "assignments",
  "assignment_ids",
  "questionnaire_answers",
  "profile_notes",
  "schedule_notes",
  "custom_values",
  "contact_details",
  "draft_or_unpublished_work",
  "security_category_work",
  "bearers_tokens_credentials_or_verifiers",
] as const;
