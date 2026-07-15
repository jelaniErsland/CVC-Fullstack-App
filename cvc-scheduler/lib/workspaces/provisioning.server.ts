import "server-only";

import { projectContactRoles, type ProjectContactRole } from "../auth/grant.ts";
import {
  normalizeWorkspaceReference,
  workspaceLifecycles,
  type WorkspaceLifecycle,
} from "./identity.ts";

export const BOZEMAN_WORKSPACE_PROVISIONING_READINESS_AVAILABLE = true;
export const BOZEMAN_WORKSPACE_PROVISIONING_OPERATOR_BOUNDARY_AVAILABLE = true;
export const BOZEMAN_WORKSPACE_PROVISIONING_PRODUCT_UI_AVAILABLE = false;
export const BOZEMAN_WORKSPACE_PROVISIONING_SERVICE_ROLE_AVAILABLE = false;
export const BOZEMAN_WORKSPACE_PROVISIONING_SEED_DATA_AVAILABLE = false;
export const BOZEMAN_WORKSPACE_PROVISIONING_HARDCODED_REAL_CONTACT_AVAILABLE = false;
export const BOZEMAN_WORKSPACE_PROVISIONING_BELGRADE_MIGRATION_AVAILABLE = false;
export const BOZEMAN_WORKSPACE_PROVISIONING_ROUTE_CUTOVER_AVAILABLE = false;
export const BOZEMAN_WORKSPACE_PROVISIONING_RESPONSE_LINK_REOPENED = false;

export const existingProjectLocalCapabilities = [
  "workspace.read",
  "questionnaires.review",
  "volunteers.view",
  "volunteers.edit",
  "tasks.view",
  "tasks.edit",
  "calendar.view",
  "calendar.edit",
  "assignments.view",
  "assignments.edit",
] as const;

export type ExistingProjectLocalCapability =
  (typeof existingProjectLocalCapabilities)[number];

export const bozemanBetaCapabilitySets = {
  mainScheduler: [
    "workspace.read",
    "questionnaires.review",
    "volunteers.view",
    "volunteers.edit",
    "tasks.view",
    "tasks.edit",
    "calendar.view",
    "calendar.edit",
    "assignments.view",
    "assignments.edit",
  ],
  volunteerDataEntry: [
    "workspace.read",
    "questionnaires.review",
    "volunteers.view",
    "volunteers.edit",
  ],
  schedulingReadOnly: [
    "workspace.read",
    "volunteers.view",
    "tasks.view",
    "calendar.view",
    "assignments.view",
  ],
} as const satisfies Record<string, readonly ExistingProjectLocalCapability[]>;

export type WorkspaceProvisioningInput = Readonly<{
  workspace: Readonly<{
    key: string;
    displayName: string;
    lifecycle: WorkspaceLifecycle;
    timezone: string;
    startsOn: string | null;
    endsOn: string | null;
    publicIntakeEnabled: boolean;
  }>;
  contact: Readonly<{
    authUserId: string;
    status: "active" | "inactive";
  }>;
  grant: Readonly<{
    role: ProjectContactRole;
    capabilities: readonly ExistingProjectLocalCapability[];
    status: "active" | "inactive" | "revoked";
    validFrom: string;
    validUntil: string | null;
  }>;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const knownCapabilities = new Set<string>(existingProjectLocalCapabilities);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string) {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function requireString(row: Record<string, unknown>, field: string) {
  const value = row[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function requireNullableString(row: Record<string, unknown>, field: string) {
  const value = row[field];
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be null or a non-empty string.`);
  }
  return value.trim();
}

function requireBoolean(row: Record<string, unknown>, field: string) {
  const value = row[field];
  if (typeof value !== "boolean") throw new Error(`${field} must be boolean.`);
  return value;
}

function normalizeDateField(value: string | null, field: string) {
  if (value === null) return null;
  if (!datePattern.test(value)) throw new Error(`${field} must be YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} must be a valid date.`);
  }
  return value;
}

function normalizeTimestamp(value: string | null, field: string) {
  if (value === null) return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`${field} must be an ISO timestamp.`);
  return new Date(time).toISOString();
}

function normalizeTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
  } catch {
    throw new Error("workspace.timezone must be a valid IANA timezone.");
  }
  return value;
}

function normalizeLifecycle(value: string) {
  if (!workspaceLifecycles.includes(value as WorkspaceLifecycle)) {
    throw new Error("workspace.lifecycle is invalid.");
  }
  return value as WorkspaceLifecycle;
}

function normalizeRole(value: string) {
  if (!projectContactRoles.includes(value as ProjectContactRole)) {
    throw new Error("grant.role is invalid.");
  }
  return value as ProjectContactRole;
}

function normalizeContactStatus(value: string) {
  if (value !== "active" && value !== "inactive") {
    throw new Error("contact.status is invalid.");
  }
  return value;
}

function normalizeGrantStatus(value: string) {
  if (value !== "active" && value !== "inactive" && value !== "revoked") {
    throw new Error("grant.status is invalid.");
  }
  if (value === "revoked") {
    throw new Error("Provisioning creates active/inactive grants only; revoke separately through a reviewed operation.");
  }
  return value;
}

function normalizeCapabilities(value: unknown) {
  if (!Array.isArray(value)) throw new Error("grant.capabilities must be an array.");
  if (value.length === 0 || value.length > 32) {
    throw new Error("grant.capabilities must contain 1-32 values.");
  }
  const requested = new Set<string>();
  for (const capability of value) {
    if (typeof capability !== "string" || capability.trim().length === 0) {
      throw new Error("grant.capabilities contains an invalid value.");
    }
    const normalized = capability.trim();
    if (!knownCapabilities.has(normalized)) {
      throw new Error(`Unknown capability: ${normalized}`);
    }
    requested.add(normalized);
  }
  if (!requested.has("workspace.read")) {
    throw new Error("grant.capabilities must include workspace.read.");
  }
  return existingProjectLocalCapabilities.filter((capability) =>
    requested.has(capability),
  );
}

function sql(value: string | null) {
  if (value === null) return "null";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlBoolean(value: boolean) {
  return value ? "true" : "false";
}

function sqlCapabilityArray(capabilities: readonly string[]) {
  return `array[${capabilities.map(sql).join(", ")}]::text[]`;
}

export function normalizeWorkspaceProvisioningInput(
  value: unknown,
): WorkspaceProvisioningInput {
  const root = requireObject(value, "Provisioning input");
  const workspace = requireObject(root.workspace, "workspace");
  const contact = requireObject(root.contact, "contact");
  const grant = requireObject(root.grant, "grant");

  const key = normalizeWorkspaceReference({
    key: requireString(workspace, "key"),
  }).value;
  const displayName = requireString(workspace, "displayName");
  if (displayName.length > 160) throw new Error("workspace.displayName is too long.");
  const startsOn = normalizeDateField(
    requireNullableString(workspace, "startsOn"),
    "workspace.startsOn",
  );
  const endsOn = normalizeDateField(
    requireNullableString(workspace, "endsOn"),
    "workspace.endsOn",
  );
  if (startsOn !== null && endsOn !== null && startsOn > endsOn) {
    throw new Error("workspace date range must be ordered.");
  }

  const authUserId = requireString(contact, "authUserId").toLowerCase();
  if (!uuidPattern.test(authUserId)) throw new Error("contact.authUserId must be a UUID.");

  const validFrom = normalizeTimestamp(
    requireString(grant, "validFrom"),
    "grant.validFrom",
  );
  if (validFrom === null) throw new Error("grant.validFrom is required.");
  const validUntil = normalizeTimestamp(
    requireNullableString(grant, "validUntil"),
    "grant.validUntil",
  );
  if (validUntil !== null && Date.parse(validUntil) <= Date.parse(validFrom)) {
    throw new Error("grant.validUntil must be after grant.validFrom.");
  }

  return {
    workspace: {
      key,
      displayName,
      lifecycle: normalizeLifecycle(requireString(workspace, "lifecycle")),
      timezone: normalizeTimezone(requireString(workspace, "timezone")),
      startsOn,
      endsOn,
      publicIntakeEnabled: requireBoolean(workspace, "publicIntakeEnabled"),
    },
    contact: {
      authUserId,
      status: normalizeContactStatus(requireString(contact, "status")),
    },
    grant: {
      role: normalizeRole(requireString(grant, "role")),
      capabilities: normalizeCapabilities(grant.capabilities),
      status: normalizeGrantStatus(requireString(grant, "status")),
      validFrom,
      validUntil,
    },
  } as const;
}

export function buildWorkspaceAccessProvisioningSql(input: WorkspaceProvisioningInput) {
  const normalized = normalizeWorkspaceProvisioningInput(input);
  const capabilities = sqlCapabilityArray(normalized.grant.capabilities);
  const validUntilCheck =
    normalized.grant.validUntil === null
      ? "v_grant.valid_until is null"
      : `v_grant.valid_until = ${sql(normalized.grant.validUntil)}::timestamptz`;

  return `begin;
do $project_local_provisioning$
declare
  v_workspace public.workspaces%rowtype;
  v_workspace_id uuid;
  v_contact public.project_contacts%rowtype;
  v_contact_id uuid;
  v_grant public.workspace_contact_grants%rowtype;
begin
  select * into v_workspace
  from public.workspaces
  where workspace_key = ${sql(normalized.workspace.key)};

  if found then
    if not (
      v_workspace.display_name = ${sql(normalized.workspace.displayName)}
      and v_workspace.lifecycle = ${sql(normalized.workspace.lifecycle)}
      and v_workspace.timezone = ${sql(normalized.workspace.timezone)}
      and v_workspace.starts_on is not distinct from ${sql(normalized.workspace.startsOn)}::date
      and v_workspace.ends_on is not distinct from ${sql(normalized.workspace.endsOn)}::date
      and v_workspace.public_intake_enabled = ${sqlBoolean(normalized.workspace.publicIntakeEnabled)}
    ) then
      raise exception 'workspace_key_conflict';
    end if;
    v_workspace_id := v_workspace.id;
  else
    insert into public.workspaces (
      workspace_key,
      display_name,
      lifecycle,
      timezone,
      starts_on,
      ends_on,
      public_intake_enabled
    )
    values (
      ${sql(normalized.workspace.key)},
      ${sql(normalized.workspace.displayName)},
      ${sql(normalized.workspace.lifecycle)},
      ${sql(normalized.workspace.timezone)},
      ${sql(normalized.workspace.startsOn)}::date,
      ${sql(normalized.workspace.endsOn)}::date,
      ${sqlBoolean(normalized.workspace.publicIntakeEnabled)}
    )
    returning id into v_workspace_id;
  end if;

  if not exists (select 1 from auth.users where id = ${sql(normalized.contact.authUserId)}::uuid) then
    raise exception 'approved_auth_user_missing';
  end if;

  select * into v_contact
  from public.project_contacts
  where auth_user_id = ${sql(normalized.contact.authUserId)}::uuid;

  if found then
    if v_contact.status <> ${sql(normalized.contact.status)} then
      raise exception 'project_contact_status_conflict';
    end if;
    v_contact_id := v_contact.id;
  else
    insert into public.project_contacts (auth_user_id, status)
    values (${sql(normalized.contact.authUserId)}::uuid, ${sql(normalized.contact.status)})
    returning id into v_contact_id;
  end if;

  select * into v_grant
  from public.workspace_contact_grants
  where project_contact_id = v_contact_id
    and workspace_id = v_workspace_id;

  if found then
    if not (
      v_grant.role = ${sql(normalized.grant.role)}
      and v_grant.capabilities = ${capabilities}
      and v_grant.status = ${sql(normalized.grant.status)}
      and v_grant.valid_from = ${sql(normalized.grant.validFrom)}::timestamptz
      and ${validUntilCheck}
      and v_grant.revoked_at is null
    ) then
      raise exception 'workspace_grant_conflict';
    end if;
  else
    insert into public.workspace_contact_grants (
      workspace_id,
      project_contact_id,
      role,
      capabilities,
      status,
      valid_from,
      valid_until,
      revoked_at
    )
    values (
      v_workspace_id,
      v_contact_id,
      ${sql(normalized.grant.role)},
      ${capabilities},
      ${sql(normalized.grant.status)},
      ${sql(normalized.grant.validFrom)}::timestamptz,
      ${sql(normalized.grant.validUntil)}::timestamptz,
      null
    );
  end if;
end
$project_local_provisioning$;

select jsonb_build_object(
  'workspaceKey', ${sql(normalized.workspace.key)},
  'workspaceId', (select id from public.workspaces where workspace_key = ${sql(normalized.workspace.key)}),
  'projectContactId', (
    select id from public.project_contacts
    where auth_user_id = ${sql(normalized.contact.authUserId)}::uuid
  ),
  'grantId', (
    select grant_row.id
    from public.workspace_contact_grants as grant_row
    join public.project_contacts as contact
      on contact.id = grant_row.project_contact_id
    join public.workspaces as workspace
      on workspace.id = grant_row.workspace_id
    where contact.auth_user_id = ${sql(normalized.contact.authUserId)}::uuid
      and workspace.workspace_key = ${sql(normalized.workspace.key)}
  )
)::text;
commit;`;
}

export function describeBozemanWorkspaceProvisioningReadiness() {
  return {
    readinessAvailable: BOZEMAN_WORKSPACE_PROVISIONING_READINESS_AVAILABLE,
    operatorBoundaryAvailable:
      BOZEMAN_WORKSPACE_PROVISIONING_OPERATOR_BOUNDARY_AVAILABLE,
    productUiAvailable: BOZEMAN_WORKSPACE_PROVISIONING_PRODUCT_UI_AVAILABLE,
    serviceRoleAvailable: BOZEMAN_WORKSPACE_PROVISIONING_SERVICE_ROLE_AVAILABLE,
    seedDataAvailable: BOZEMAN_WORKSPACE_PROVISIONING_SEED_DATA_AVAILABLE,
    hardcodedRealContactAvailable:
      BOZEMAN_WORKSPACE_PROVISIONING_HARDCODED_REAL_CONTACT_AVAILABLE,
    belgradeMigrationAvailable: BOZEMAN_WORKSPACE_PROVISIONING_BELGRADE_MIGRATION_AVAILABLE,
    routeCutoverAvailable: BOZEMAN_WORKSPACE_PROVISIONING_ROUTE_CUTOVER_AVAILABLE,
    responseLinkActivationReopened:
      BOZEMAN_WORKSPACE_PROVISIONING_RESPONSE_LINK_REOPENED,
    authIdentityStep:
      "operator_creates_or_invites_approved_auth_user_before_running_provisioning_boundary",
    workspaceArchitecture:
      "existing_public_workspaces_workspace_key_unique_lifecycle_timezone_public_intake_fields",
    contactArchitecture:
      "existing_project_contacts_unique_auth_user_id_active_status",
    grantArchitecture:
      "existing_workspace_contact_grants_contact_workspace_unique_explicit_capabilities_validity_revocation",
    capabilitySets: bozemanBetaCapabilitySets,
    allowedCapabilities: existingProjectLocalCapabilities,
    duplicateBehavior:
      "idempotent_when_existing_workspace_contact_grant_match_input_and_fail_closed_on_conflict",
    realBozemanDataCommitted: false,
  } as const;
}
