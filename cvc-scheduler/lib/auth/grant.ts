export const projectContactRoles = [
  "main_contact",
  "assistant_contact",
  "on_site_contact",
] as const;

export type ProjectContactRole = (typeof projectContactRoles)[number];

export type ProjectContactGrant = Readonly<{
  id: string;
  workspaceId: string;
  projectContactId: string;
  role: ProjectContactRole;
  capabilities: readonly string[];
  status: "active" | "inactive" | "revoked";
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(row: Record<string, unknown>, field: string) {
  const value = row[field];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Project contact grant has an invalid ${field}.`);
  }

  return value;
}

function nullableString(row: Record<string, unknown>, field: string) {
  const value = row[field];

  if (value !== null && typeof value !== "string") {
    throw new Error(`Project contact grant has an invalid ${field}.`);
  }

  return value;
}

export function parseProjectContactGrant(value: unknown): ProjectContactGrant {
  if (!isRecord(value)) {
    throw new Error("Project contact grant read returned an invalid row.");
  }

  const role = value.role;
  const status = value.status;
  const capabilities = value.capabilities;

  if (
    typeof role !== "string" ||
    !projectContactRoles.includes(role as ProjectContactRole)
  ) {
    throw new Error("Project contact grant has an invalid role.");
  }

  if (status !== "active" && status !== "inactive" && status !== "revoked") {
    throw new Error("Project contact grant has an invalid status.");
  }

  if (
    !Array.isArray(capabilities) ||
    capabilities.length === 0 ||
    capabilities.some((capability) => typeof capability !== "string")
  ) {
    throw new Error("Project contact grant has invalid capabilities.");
  }

  return {
    id: requireString(value, "id"),
    workspaceId: requireString(value, "workspace_id"),
    projectContactId: requireString(value, "project_contact_id"),
    role: role as ProjectContactRole,
    capabilities,
    status,
    validFrom: requireString(value, "valid_from"),
    validUntil: nullableString(value, "valid_until"),
    revokedAt: nullableString(value, "revoked_at"),
  };
}

export function isEffectiveWorkspaceReadGrant(
  grant: ProjectContactGrant,
  at = new Date(),
) {
  const atTime = at.getTime();
  const validFrom = Date.parse(grant.validFrom);
  const validUntil = grant.validUntil === null ? null : Date.parse(grant.validUntil);

  return (
    grant.status === "active" &&
    grant.revokedAt === null &&
    grant.capabilities.includes("workspace.read") &&
    Number.isFinite(validFrom) &&
    validFrom <= atTime &&
    (validUntil === null || (Number.isFinite(validUntil) && validUntil > atTime))
  );
}

