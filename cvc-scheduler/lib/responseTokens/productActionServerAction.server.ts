import "server-only";

import type {
  AssignmentDetailResponseLinkDisabledAdapterInput,
  AssignmentDetailResponseLinkDisabledAdapterResult,
} from "./productActionDisabledAdapter.server.ts";
import { createAssignmentDetailResponseLinkDisabledAdapterWithDependencies } from "./productActionDisabledAdapter.server.ts";

export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE = true;
export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED = false;
export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_DEFAULT_STATE =
  "disabled";
export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_FINAL_APPROVAL_AVAILABLE =
  false;
export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ELIGIBLE_ROUTE =
  "/admin/assignments/[assignmentId]" as const;

export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ALLOWED_FORM_FIELDS = [
  "expiresInHours",
] as const;

export const RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_FORBIDDEN_BROWSER_FIELDS = [
  "assignmentId",
  "workspaceId",
  "volunteerId",
  "actorId",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
  "origin",
  "fullResponseUrl",
  "redactedResponseUrl",
  "responseUrl",
  "auditEventId",
  "auditMetadata",
  "responseLinkMetadata",
  "capabilities",
  "grant",
  "copyMode",
  "serviceRoleClient",
  "supabaseClient",
  "redirectPath",
  "returnPath",
  "hiddenMetadata",
  "arbitraryHiddenMetadata",
] as const;

export type AssignmentDetailResponseLinkServerActionDisabledReason =
  | "malformed"
  | "checklist_blocked"
  | "not_approved"
  | "action_boundary_unavailable"
  | "action_error";

export type AssignmentDetailResponseLinkServerActionResult = Readonly<{
  status: "disabled";
  reason: AssignmentDetailResponseLinkServerActionDisabledReason;
}>;

type AssignmentDetailResponseLinkServerActionDependencies = Readonly<{
  adapter?: (
    input: AssignmentDetailResponseLinkDisabledAdapterInput,
  ) => Promise<AssignmentDetailResponseLinkDisabledAdapterResult>;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productMaximumTtlHours = 168;
const allowedFormFields = new Set<string>(
  RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ALLOWED_FORM_FIELDS,
);

const routeUnusedServerActionChecklistReadiness = {
  routeSafety: true,
  entrySafety: true,
  actionSafety: true,
  uiSafety: true,
  credentialLogSafety: true,
  browserProof: true,
  productOwnerCheckpoint: true,
} as const;

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function parseOptionalExpiresInHours(formData: FormData | null | undefined) {
  if (!formData) return { ok: true as const };

  const entries = Array.from(formData.entries());
  if (entries.some(([key]) => !allowedFormFields.has(key))) {
    return { ok: false as const };
  }

  const ttlEntries = entries.filter(([key]) => key === "expiresInHours");
  if (ttlEntries.length === 0) return { ok: true as const };
  if (ttlEntries.length > 1) return { ok: false as const };

  const ttlValue = ttlEntries[0]?.[1];
  if (typeof ttlValue !== "string") return { ok: false as const };

  const normalizedTtl = ttlValue.trim();
  if (!/^\d+$/.test(normalizedTtl)) return { ok: false as const };

  const expiresInHours = Number(normalizedTtl);
  if (
    !Number.isInteger(expiresInHours) ||
    expiresInHours < 1 ||
    expiresInHours > productMaximumTtlHours
  ) {
    return { ok: false as const };
  }

  return { ok: true as const, expiresInHours };
}

function normalizeServerActionInput(
  assignmentId: unknown,
  formData?: FormData | null,
): AssignmentDetailResponseLinkDisabledAdapterInput | null {
  if (typeof assignmentId !== "string") return null;

  const normalizedAssignmentId = assignmentId.trim().toLowerCase();
  if (!uuidPattern.test(normalizedAssignmentId)) return null;

  if (formData !== undefined && formData !== null && !isFormData(formData)) {
    return null;
  }

  const ttlResult = parseOptionalExpiresInHours(formData);
  if (!ttlResult.ok) return null;

  return ttlResult.expiresInHours === undefined
    ? { assignmentId: normalizedAssignmentId }
    : {
        assignmentId: normalizedAssignmentId,
        expiresInHours: ttlResult.expiresInHours,
      };
}

function mapDisabledAdapterResult(
  result: AssignmentDetailResponseLinkDisabledAdapterResult,
): AssignmentDetailResponseLinkServerActionResult {
  if (result.status !== "disabled") {
    return { status: "disabled", reason: "not_approved" };
  }

  if (result.reason === "invalid_input") {
    return { status: "disabled", reason: "malformed" };
  }
  if (result.reason === "blocked_by_checklist") {
    return { status: "disabled", reason: "checklist_blocked" };
  }
  if (result.reason === "not_approved") {
    return { status: "disabled", reason: "not_approved" };
  }
  if (result.reason === "action_boundary_unavailable") {
    return { status: "disabled", reason: "action_boundary_unavailable" };
  }

  return { status: "disabled", reason: "action_error" };
}

async function defaultDisabledAdapter(
  input: AssignmentDetailResponseLinkDisabledAdapterInput,
) {
  return createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(input, {
    readiness: routeUnusedServerActionChecklistReadiness,
  });
}

export async function createDisabledAssignmentResponseLinkServerAction(
  assignmentId: string,
  formData?: FormData | null,
): Promise<AssignmentDetailResponseLinkServerActionResult> {
  "use server";

  return createDisabledAssignmentResponseLinkServerActionWithDependencies(
    assignmentId,
    formData,
  );
}

export async function createDisabledAssignmentResponseLinkServerActionWithDependencies(
  assignmentId: unknown,
  formData?: FormData | null,
  dependencies: AssignmentDetailResponseLinkServerActionDependencies = {},
): Promise<AssignmentDetailResponseLinkServerActionResult> {
  const request = normalizeServerActionInput(assignmentId, formData);
  if (!request) return { status: "disabled", reason: "malformed" };

  const adapter = dependencies.adapter ?? defaultDisabledAdapter;

  try {
    const result = await adapter(request);
    return mapDisabledAdapterResult(result);
  } catch {
    return { status: "disabled", reason: "action_error" };
  }
}

export function describeDisabledAssignmentResponseLinkServerAction() {
  return {
    stubAvailable: RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_AVAILABLE,
    routeUnused: RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ROUTE_UNUSED,
    defaultState: RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_DEFAULT_STATE,
    finalApprovalAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_FINAL_APPROVAL_AVAILABLE,
    eligibleRoute: RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_STUB_ELIGIBLE_ROUTE,
    allowedFormFields:
      RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_ALLOWED_FORM_FIELDS,
    forbiddenBrowserFields:
      RESPONSE_LINK_PRODUCT_ACTION_SERVER_ACTION_FORBIDDEN_BROWSER_FIELDS,
  } as const;
}
