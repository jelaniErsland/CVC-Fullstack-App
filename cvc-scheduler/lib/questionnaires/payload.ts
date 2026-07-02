export const questionnaireAnswerVersion = 1 as const;

const weekdayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const preferredTimeOptions = ["Morning", "Afternoon", "Evening"] as const;
const skillOptions = [
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
] as const;
const contactMethodOptions = ["Text", "Phone", "Email"] as const;
const otherWayKeys = [
  "housing",
  "transportation",
  "laundryDryCleaning",
  "housekeeping",
  "hairCare",
  "medicalSupport",
  "foodService",
] as const;

export type QuestionnaireAnswersV1 = Readonly<{
  aboutYou: Readonly<{
    name: string;
    email: string | null;
    phone: string;
    congregation: string;
    preferredContactMethod: (typeof contactMethodOptions)[number];
  }>;
  availability: Readonly<{
    weekdays: readonly (typeof weekdayOptions)[number][];
    preferredTimes: readonly (typeof preferredTimeOptions)[number][];
    notes: string;
  }>;
  skillsExperience: Readonly<{
    categories: readonly (typeof skillOptions)[number][];
    maintenanceTaskCards: boolean;
    details: string;
    physicalWorkNotes: string;
  }>;
  emergencyContact: Readonly<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  otherWaysToHelp: Readonly<{
    selected: Readonly<Record<(typeof otherWayKeys)[number], boolean>>;
    other: string;
    notes: string;
  }>;
}>;

export class QuestionnairePayloadValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Questionnaire submission payload is invalid.");
    this.name = "QuestionnairePayloadValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function section(
  record: Record<string, unknown>,
  key: string,
  issues: string[],
) {
  const value = record[key];
  if (!isRecord(value)) {
    issues.push(`${key} must be an object.`);
    return {};
  }
  return value;
}

function textField(
  record: Record<string, unknown>,
  key: string,
  issues: string[],
  options: { required?: boolean; min?: number; max: number },
) {
  const value = record[key];
  if (typeof value !== "string") {
    issues.push(`${key} must be text.`);
    return "";
  }
  const normalized = value.trim();
  const minimum = options.required ? (options.min ?? 1) : 0;
  if (normalized.length < minimum || normalized.length > options.max) {
    issues.push(`${key} must be ${minimum}-${options.max} characters.`);
  }
  return normalized;
}

function optionalEmail(record: Record<string, unknown>, issues: string[]) {
  const email = textField(record, "email", issues, { max: 254 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    issues.push("email must be a valid address.");
  }
  return email || null;
}

function oneOf<const T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowed: T,
  issues: string[],
): T[number] {
  const value = record[key];
  if (typeof value !== "string" || !allowed.includes(value)) {
    issues.push(`${key} has an unsupported value.`);
    return allowed[0] as T[number];
  }
  return value as T[number];
}

function stringChoices<const T extends readonly string[]>(
  record: Record<string, unknown>,
  key: string,
  allowed: T,
  issues: string[],
) {
  const value = record[key];
  if (
    !Array.isArray(value) ||
    value.length > allowed.length ||
    value.some((item) => typeof item !== "string" || !allowed.includes(item)) ||
    new Set(value).size !== value.length
  ) {
    issues.push(`${key} contains unsupported or duplicate choices.`);
    return [] as T[number][];
  }
  return value as T[number][];
}

function booleanField(record: Record<string, unknown>, key: string, issues: string[]) {
  const value = record[key];
  if (typeof value !== "boolean") {
    issues.push(`${key} must be true or false.`);
    return false;
  }
  return value;
}

export function validateQuestionnaireSubmissionPayload(
  input: unknown,
): QuestionnaireAnswersV1 {
  if (!isRecord(input)) {
    throw new QuestionnairePayloadValidationError(["payload must be an object."]);
  }

  const issues: string[] = [];
  const aboutYou = section(input, "aboutYou", issues);
  const availability = section(input, "availability", issues);
  const skillsExperience = section(input, "skillsExperience", issues);
  const emergencyContact = section(input, "emergencyContact", issues);
  const otherWaysToHelp = section(input, "otherWaysToHelp", issues);
  const selected = section(otherWaysToHelp, "selected", issues);

  const answers: QuestionnaireAnswersV1 = {
    aboutYou: {
      name: textField(aboutYou, "name", issues, { required: true, max: 160 }),
      email: optionalEmail(aboutYou, issues),
      phone: textField(aboutYou, "phone", issues, {
        required: true,
        min: 7,
        max: 40,
      }),
      congregation: textField(aboutYou, "congregation", issues, {
        required: true,
        max: 160,
      }),
      preferredContactMethod: oneOf(
        aboutYou,
        "preferredContactMethod",
        contactMethodOptions,
        issues,
      ),
    },
    availability: {
      weekdays: stringChoices(availability, "weekdays", weekdayOptions, issues),
      preferredTimes: stringChoices(
        availability,
        "preferredTimes",
        preferredTimeOptions,
        issues,
      ),
      notes: textField(availability, "notes", issues, { max: 2000 }),
    },
    skillsExperience: {
      categories: stringChoices(skillsExperience, "categories", skillOptions, issues),
      maintenanceTaskCards: booleanField(
        skillsExperience,
        "maintenanceTaskCards",
        issues,
      ),
      details: textField(skillsExperience, "details", issues, { max: 3000 }),
      physicalWorkNotes: textField(skillsExperience, "physicalWorkNotes", issues, {
        max: 3000,
      }),
    },
    emergencyContact: {
      name: textField(emergencyContact, "name", issues, {
        required: true,
        max: 160,
      }),
      relationship: textField(emergencyContact, "relationship", issues, { max: 160 }),
      phone: textField(emergencyContact, "phone", issues, {
        required: true,
        min: 7,
        max: 40,
      }),
    },
    otherWaysToHelp: {
      selected: Object.fromEntries(
        otherWayKeys.map((key) => [key, booleanField(selected, key, issues)]),
      ) as Record<(typeof otherWayKeys)[number], boolean>,
      other: textField(otherWaysToHelp, "other", issues, { max: 500 }),
      notes: textField(otherWaysToHelp, "notes", issues, { max: 3000 }),
    },
  };

  if (new TextEncoder().encode(JSON.stringify(answers)).byteLength > 65536) {
    issues.push("payload exceeds 65536 bytes.");
  }

  if (issues.length > 0) {
    throw new QuestionnairePayloadValidationError(issues);
  }

  return answers;
}
