export const taskPresetTypes = ["general", "food", "security", "custom"] as const;
export const taskPresetCustomFieldTypes = [
  "short_text",
  "long_text",
  "number",
  "select",
  "checkbox",
] as const;

export type TaskPresetType = (typeof taskPresetTypes)[number];
export type TaskPresetCustomFieldType = (typeof taskPresetCustomFieldTypes)[number];

export type TaskPresetCustomField = Readonly<{
  key: string;
  label: string;
  type: TaskPresetCustomFieldType;
  required: boolean;
  options?: readonly string[];
}>;

export type CreateTaskPresetInput = Readonly<{
  workspaceId: string;
  name: string;
  description?: string | null;
  taskType: TaskPresetType;
  defaultNeededCount: number;
  volunteerVisible: boolean;
  customFields: readonly TaskPresetCustomField[];
}>;

export type TaskPreset = Readonly<{
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  taskType: TaskPresetType;
  defaultNeededCount: number;
  volunteerVisible: boolean;
  isSystemPreset: boolean;
  systemKey: string | null;
  customFields: readonly TaskPresetCustomField[];
  lifecycle: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}>;

export class TaskPresetValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Task preset input is invalid.");
    this.name = "TaskPresetValidationError";
    this.issues = issues;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fieldKeyPattern = /^[a-z][a-z0-9_]{0,39}$/;
const createInputKeys = new Set([
  "workspaceId",
  "name",
  "description",
  "taskType",
  "defaultNeededCount",
  "volunteerVisible",
  "customFields",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeUuid(value: unknown, field: string, issues: string[]) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    issues.push(`${field} must be a UUID.`);
    return "";
  }
  return value.trim().toLowerCase();
}

function boundedText(
  value: unknown,
  field: string,
  issues: string[],
  minimum: number,
  maximum: number,
) {
  if (typeof value !== "string") {
    issues.push(`${field} must be text.`);
    return "";
  }
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    issues.push(`${field} must be ${minimum}-${maximum} characters.`);
  }
  return normalized;
}

function parseCustomFields(value: unknown, issues: string[]) {
  if (!Array.isArray(value) || value.length > 20) {
    issues.push("customFields must contain at most 20 fields.");
    return [];
  }

  const seen = new Set<string>();
  return value.map((field, index): TaskPresetCustomField => {
    if (!isRecord(field)) {
      issues.push(`customFields[${index}] must be an object.`);
      return { key: "invalid", label: "Invalid", type: "short_text", required: false };
    }

    const unknownKeys = Object.keys(field).filter(
      (key) => !["key", "label", "type", "required", "options"].includes(key),
    );
    if (unknownKeys.length > 0) {
      issues.push(`customFields[${index}] contains unsupported fields.`);
    }

    const key = typeof field.key === "string" ? field.key.trim() : "";
    const label = boundedText(field.label, `customFields[${index}].label`, issues, 1, 80);
    const type = field.type;
    if (!fieldKeyPattern.test(key) || seen.has(key)) {
      issues.push(`customFields[${index}].key is invalid or duplicated.`);
    }
    seen.add(key);
    if (
      typeof type !== "string" ||
      !taskPresetCustomFieldTypes.includes(type as TaskPresetCustomFieldType)
    ) {
      issues.push(`customFields[${index}].type is unsupported.`);
    }
    if (typeof field.required !== "boolean") {
      issues.push(`customFields[${index}].required must be true or false.`);
    }

    let options: string[] | undefined;
    if (type === "select") {
      if (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 20) {
        issues.push(`customFields[${index}].options must contain 1-20 choices.`);
      } else {
        options = field.options.map((option, optionIndex) =>
          boundedText(
            option,
            `customFields[${index}].options[${optionIndex}]`,
            issues,
            1,
            100,
          ),
        );
        if (new Set(options).size !== options.length) {
          issues.push(`customFields[${index}].options must be unique.`);
        }
      }
    } else if (field.options !== undefined && (!Array.isArray(field.options) || field.options.length > 0)) {
      issues.push(`customFields[${index}].options is only valid for select fields.`);
    }

    return {
      key,
      label,
      type: taskPresetCustomFieldTypes.includes(type as TaskPresetCustomFieldType)
        ? (type as TaskPresetCustomFieldType)
        : "short_text",
      required: field.required === true,
      ...(options ? { options } : {}),
    };
  });
}

export function validateCreateTaskPresetInput(input: unknown): CreateTaskPresetInput {
  if (!isRecord(input)) {
    throw new TaskPresetValidationError(["input must be an object."]);
  }

  const issues: string[] = [];
  const unknownKeys = Object.keys(input).filter((key) => !createInputKeys.has(key));
  if (unknownKeys.length > 0) {
    issues.push(`unsupported fields: ${unknownKeys.sort().join(", ")}.`);
  }

  const description =
    input.description === null || input.description === undefined
      ? null
      : boundedText(input.description, "description", issues, 1, 2000);
  const taskType = input.taskType;
  if (typeof taskType !== "string" || !taskPresetTypes.includes(taskType as TaskPresetType)) {
    issues.push("taskType is unsupported.");
  }
  if (
    typeof input.defaultNeededCount !== "number" ||
    !Number.isInteger(input.defaultNeededCount) ||
    input.defaultNeededCount < 1 ||
    input.defaultNeededCount > 99
  ) {
    issues.push("defaultNeededCount must be an integer from 1 to 99.");
  }
  if (typeof input.volunteerVisible !== "boolean") {
    issues.push("volunteerVisible must be true or false.");
  }

  const customFields = parseCustomFields(input.customFields, issues);
  const normalized: CreateTaskPresetInput = {
    workspaceId: normalizeUuid(input.workspaceId, "workspaceId", issues),
    name: boundedText(input.name, "name", issues, 1, 160),
    description,
    taskType: taskPresetTypes.includes(taskType as TaskPresetType)
      ? (taskType as TaskPresetType)
      : "custom",
    defaultNeededCount:
      typeof input.defaultNeededCount === "number" ? input.defaultNeededCount : 1,
    volunteerVisible: input.volunteerVisible === true,
    customFields,
  };

  if (new TextEncoder().encode(JSON.stringify(customFields)).byteLength > 16384) {
    issues.push("customFields exceeds 16384 bytes.");
  }
  if (issues.length > 0) {
    throw new TaskPresetValidationError(issues);
  }
  return normalized;
}

export function parseTaskPreset(value: unknown): TaskPreset {
  if (!isRecord(value)) {
    throw new Error("Task preset read returned an invalid row.");
  }
  const issues: string[] = [];
  const taskType = value.task_type;
  const lifecycle = value.lifecycle;
  if (typeof taskType !== "string" || !taskPresetTypes.includes(taskType as TaskPresetType)) {
    throw new Error("Task preset has an invalid task type.");
  }
  if (lifecycle !== "active" && lifecycle !== "archived") {
    throw new Error("Task preset has an invalid lifecycle.");
  }
  if (
    typeof value.default_needed_count !== "number" ||
    !Number.isInteger(value.default_needed_count) ||
    value.default_needed_count < 1 ||
    value.default_needed_count > 99 ||
    typeof value.volunteer_visible !== "boolean" ||
    typeof value.is_system_preset !== "boolean"
  ) {
    throw new Error("Task preset has invalid defaults.");
  }
  const customFields = parseCustomFields(value.custom_field_definitions, issues);
  const id = normalizeUuid(value.id, "id", issues);
  const workspaceId = normalizeUuid(value.workspace_id, "workspace_id", issues);
  const nullable = (field: string) => {
    const fieldValue = value[field];
    if (fieldValue !== null && typeof fieldValue !== "string") {
      throw new Error(`Task preset has an invalid ${field}.`);
    }
    return fieldValue;
  };
  const required = (field: string) => {
    const fieldValue = value[field];
    if (typeof fieldValue !== "string" || fieldValue.length === 0) {
      throw new Error(`Task preset has an invalid ${field}.`);
    }
    return fieldValue;
  };
  const systemKey = nullable("system_key");
  if (value.is_system_preset !== (systemKey !== null)) {
    issues.push("system preset identity is inconsistent.");
  }
  if (issues.length > 0) {
    throw new Error("Task preset row is invalid.");
  }

  return {
    id,
    workspaceId,
    name: required("name"),
    description: nullable("description"),
    taskType: taskType as TaskPresetType,
    defaultNeededCount: value.default_needed_count,
    volunteerVisible: value.volunteer_visible,
    isSystemPreset: value.is_system_preset,
    systemKey,
    customFields,
    lifecycle,
    createdAt: required("created_at"),
    updatedAt: required("updated_at"),
  };
}
