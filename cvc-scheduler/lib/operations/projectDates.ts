import { normalizeProjectDate } from "./projectDay.ts";

export type ProjectDates = Readonly<{
  startsOn: string;
  endsOn: string;
}>;

export type ProjectDatesMutationState = Readonly<{
  status: "idle" | "success" | "validation" | "unavailable" | "error";
  startsOn: string;
  endsOn: string;
  message: string;
}>;

export class ProjectDatesValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Project dates are invalid.");
    this.name = "ProjectDatesValidationError";
    this.issues = issues;
  }
}

export function validateProjectDates(input: unknown): ProjectDates {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ProjectDatesValidationError(["Enter a start and end date."]);
  }
  const value = input as Record<string, unknown>;
  const issues: string[] = [];
  let startsOn = "";
  let endsOn = "";
  try {
    startsOn = normalizeProjectDate(value.startsOn);
  } catch {
    issues.push("Enter a valid project start date.");
  }
  try {
    endsOn = normalizeProjectDate(value.endsOn);
  } catch {
    issues.push("Enter a valid project end date.");
  }
  if (startsOn && endsOn && startsOn > endsOn) {
    issues.push("Project end date must be on or after the start date.");
  }
  if (issues.length > 0) throw new ProjectDatesValidationError(issues);
  return { startsOn, endsOn };
}

export function projectDatesFromFormData(formData: FormData) {
  return validateProjectDates({
    startsOn: formData.get("projectStartsOn"),
    endsOn: formData.get("projectEndsOn"),
  });
}
