export const workspaceLifecycles = ["draft", "active", "archived"] as const;

export type WorkspaceLifecycle = (typeof workspaceLifecycles)[number];

export type WorkspaceIdentity = Readonly<{
  id: string;
  key: string;
  displayName: string;
  lifecycle: WorkspaceLifecycle;
  timezone: string;
  startsOn: string | null;
  endsOn: string | null;
  publicIntakeEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type WorkspaceReference =
  | Readonly<{ id: string; key?: never }>
  | Readonly<{ id?: never; key: string }>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const workspaceKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeWorkspaceReference(reference: WorkspaceReference) {
  if ("id" in reference && reference.id !== undefined) {
    const id = reference.id.trim().toLowerCase();

    if (!uuidPattern.test(id)) {
      throw new Error("Workspace id must be a valid UUID.");
    }

    return { column: "id", value: id } as const;
  }

  const key = reference.key.trim();

  if (
    key.length < 3 ||
    key.length > 80 ||
    !workspaceKeyPattern.test(key)
  ) {
    throw new Error(
      "Workspace key must be 3-80 lowercase letters, numbers, or single hyphens.",
    );
  }

  return { column: "workspace_key", value: key } as const;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(row: Record<string, unknown>, field: string) {
  const value = row[field];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Workspace row has an invalid ${field}.`);
  }

  return value;
}

function requireNullableDate(row: Record<string, unknown>, field: string) {
  const value = row[field];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !datePattern.test(value)) {
    throw new Error(`Workspace row has an invalid ${field}.`);
  }

  return value;
}

export function parseWorkspaceIdentity(value: unknown): WorkspaceIdentity {
  if (!isRecord(value)) {
    throw new Error("Workspace read returned an invalid row.");
  }

  const lifecycle = value.lifecycle;

  if (
    typeof lifecycle !== "string" ||
    !workspaceLifecycles.includes(lifecycle as WorkspaceLifecycle)
  ) {
    throw new Error("Workspace row has an invalid lifecycle.");
  }

  if (typeof value.public_intake_enabled !== "boolean") {
    throw new Error("Workspace row has an invalid public_intake_enabled.");
  }

  const id = normalizeWorkspaceReference({
    id: requireString(value, "id"),
  }).value;
  const key = normalizeWorkspaceReference({
    key: requireString(value, "workspace_key"),
  }).value;

  return {
    id,
    key,
    displayName: requireString(value, "display_name"),
    lifecycle: lifecycle as WorkspaceLifecycle,
    timezone: requireString(value, "timezone"),
    startsOn: requireNullableDate(value, "starts_on"),
    endsOn: requireNullableDate(value, "ends_on"),
    publicIntakeEnabled: value.public_intake_enabled,
    createdAt: requireString(value, "created_at"),
    updatedAt: requireString(value, "updated_at"),
  };
}
