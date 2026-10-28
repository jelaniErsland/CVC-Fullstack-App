export const schedulerFacetDefinitions = [
  {
    key: "availability_weekdays",
    sourceSnapshot: "availability_snapshot",
    sourcePath: ["weekdays"],
    valueType: "choice_list",
    allowedValues: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  {
    key: "availability_preferred_times",
    sourceSnapshot: "availability_snapshot",
    sourcePath: ["preferredTimes"],
    valueType: "choice_list",
    allowedValues: ["Morning", "Afternoon", "Evening"],
  },
  {
    key: "skill_categories",
    sourceSnapshot: "skills_help_snapshot",
    sourcePath: ["skillsExperience", "categories"],
    valueType: "choice_list",
    allowedValues: [
      "Painting",
      "Demo",
      "Framing",
      "Finish work",
      "Electrical assist",
      "Plumbing assist",
      "General cleanup",
      "Check-in desk",
      "Food service",
      "Security",
    ],
  },
] as const;

export const schedulerFacetContract = {
  metadataVersion: 1,
  metadataOwner: "explicit_code_registry_for_fixed_questionnaire_v1_snapshots",
  rawQuestionnaireReadAllowed: false,
  sourceTable: "volunteer_profiles",
  sourceAuthority:
    "persisted_approved_volunteer_profile_snapshots_copied_during_explicit_questionnaire_v1_conversion_or_empty_for_manual_profiles",
  prototypeOrMockSourceAllowed: false,
  explicitlySupported: [
    "profile_congregation",
    "availability_weekdays",
    "availability_preferred_times",
    "skill_categories",
  ],
  explicitlyUnsupported: {
    age: "not_collected",
    ageBand: "not_derivable_without_age_or_birthdate",
    selectedDateAvailability:
      "current_snapshot_has_weekday_and_preferred_time_only_not_away_or_partial_date_status",
    freeTextSkillDetails: "not_scheduler_approved",
    availabilityNotes: "not_scheduler_approved",
    physicalWorkNotes: "not_scheduler_approved",
    emergencyContact: "sensitive_and_unrelated",
    otherWaysToHelp: "not_scheduler_approved",
  },
  extensionSeams: {
    normalizedKeywordSkills:
      "add_an_explicit_bounded_adapter_and_registry_entry_for_an_approved_profile_field",
    selectedDateAvailability:
      "add_an_explicit_profile_projection_then_a_bounded_date_availability_adapter",
    derivedAgeBand:
      "add_an_explicit_source_and_server_side_derivation_adapter_without_returning_birthdate",
    authorizationArchitectureChangeRequired: false,
  },
} as const;

export type SchedulerFacetProjection = Readonly<{
  volunteerProfileId: string;
  congregation: string | null;
  skillTags: readonly string[];
  availability: Readonly<{
    weekdays: readonly string[];
    preferredTimes: readonly string[];
  }>;
  keywordTerms: readonly string[];
}>;

export type SchedulerFacetProfileSource = Readonly<{
  volunteerProfileId: string;
  congregation: string | null;
  availabilitySnapshot: unknown;
  skillsHelpSnapshot: unknown;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPath(source: unknown, path: readonly string[]) {
  let value = source;
  for (const segment of path) {
    if (!isRecord(value)) return undefined;
    value = value[segment];
  }
  return value;
}

function explicitChoiceList(
  source: unknown,
  path: readonly string[],
  allowedValues: readonly string[],
) {
  const value = readPath(source, path);
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((choice) => typeof choice !== "string" || !allowedValues.includes(choice)) ||
    new Set(value).size !== value.length
  ) {
    return [];
  }
  return value as string[];
}

export function projectSchedulerFacetsFromProfile(
  source: SchedulerFacetProfileSource,
): SchedulerFacetProjection {
  const weekdayDefinition = schedulerFacetDefinitions[0];
  const timeDefinition = schedulerFacetDefinitions[1];
  const skillDefinition = schedulerFacetDefinitions[2];
  const weekdays = explicitChoiceList(
    source.availabilitySnapshot,
    weekdayDefinition.sourcePath,
    weekdayDefinition.allowedValues,
  );
  const preferredTimes = explicitChoiceList(
    source.availabilitySnapshot,
    timeDefinition.sourcePath,
    timeDefinition.allowedValues,
  );
  const skillTags = explicitChoiceList(
    source.skillsHelpSnapshot,
    skillDefinition.sourcePath,
    skillDefinition.allowedValues,
  );
  return {
    volunteerProfileId: source.volunteerProfileId,
    congregation: source.congregation,
    skillTags,
    availability: { weekdays, preferredTimes },
    keywordTerms: [...new Set([source.congregation, ...skillTags]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map((value) => value.toLocaleLowerCase("en-US")))],
  };
}

export function schedulerFacetDefinitionIsSupported(value: unknown) {
  if (!isRecord(value)) return false;
  const structurallyValid =
    value.valueType === "choice_list" &&
    (value.sourceSnapshot === "availability_snapshot" ||
      value.sourceSnapshot === "skills_help_snapshot") &&
    Array.isArray(value.sourcePath) &&
    value.sourcePath.length > 0 &&
    value.sourcePath.length <= 4 &&
    value.sourcePath.every(
      (segment) => typeof segment === "string" && /^[a-z][a-zA-Z0-9]*$/.test(segment),
    ) &&
    Array.isArray(value.allowedValues) &&
    value.allowedValues.length > 0 &&
    value.allowedValues.length <= 64 &&
    value.allowedValues.every(
      (choice) => typeof choice === "string" && choice.length > 0 && choice.length <= 80,
    ) &&
    new Set(value.allowedValues).size === value.allowedValues.length;
  if (!structurallyValid || typeof value.key !== "string") return false;
  const approved = schedulerFacetDefinitions.find((definition) => definition.key === value.key);
  return (
    approved !== undefined &&
    approved.sourceSnapshot === value.sourceSnapshot &&
    JSON.stringify(approved.sourcePath) === JSON.stringify(value.sourcePath) &&
    JSON.stringify(approved.allowedValues) === JSON.stringify(value.allowedValues)
  );
}
