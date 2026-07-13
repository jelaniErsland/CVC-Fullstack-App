import "server-only";

import type { AssignmentDetailResponseLinkEnablementReadiness } from "../assignments/detailResponseLinkEnablementChecklist.server.ts";
import {
  ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE,
  assignmentDetailResponseLinkEnablementChecklist,
} from "../assignments/detailResponseLinkEnablementChecklist.server.ts";
import {
  type AssignmentDetailResponseLinkActionResult,
  createAssignmentDetailResponseLinkProductAction,
} from "./productAction.server.ts";
import { RESPONSE_LINK_PRODUCT_ACTION_SERVER_BOUNDARY_AVAILABLE } from "./productActionPolicy.server.ts";

export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE = true;
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE =
  false;
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_DEFAULT_STATE = "disabled";
export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ROUTE_CONTEXT =
  "/admin/assignments/[assignmentId]" as const;

export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ALLOWED_BROWSER_INPUTS = [
  "assignmentId",
  "expiresInHours",
] as const;

export const RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FORBIDDEN_BROWSER_INPUTS = [
  "workspaceId",
  "volunteerId",
  "actorId",
  "origin",
  "responseId",
  "responseTokenId",
  "tokenId",
  "bearer",
  "rawBearer",
  "verifier",
  "tokenVerifierHash",
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
] as const;

export type AssignmentDetailResponseLinkDisabledAdapterInput = Readonly<{
  assignmentId: string;
  expiresInHours?: number;
}>;

export type AssignmentDetailResponseLinkDisabledAdapterFailureReason =
  | "invalid_input"
  | "blocked_by_checklist"
  | "not_approved"
  | "action_boundary_unavailable"
  | "action_failed";

export type AssignmentDetailResponseLinkDisabledAdapterFailure = Readonly<{
  status: "disabled";
  reason: AssignmentDetailResponseLinkDisabledAdapterFailureReason;
  blockers?: readonly string[];
}>;

export type AssignmentDetailResponseLinkDisabledAdapterSuccess = Readonly<{
  status: "issued";
  responseUrl: string;
  expiresAt: string;
  warning: string;
}>;

export type AssignmentDetailResponseLinkDisabledAdapterResult =
  | AssignmentDetailResponseLinkDisabledAdapterFailure
  | AssignmentDetailResponseLinkDisabledAdapterSuccess;

type AssignmentDetailResponseLinkDisabledAdapterDependencies = Readonly<{
  readiness?: AssignmentDetailResponseLinkEnablementReadiness;
  productAction?: (
    input: AssignmentDetailResponseLinkDisabledAdapterInput,
  ) => Promise<AssignmentDetailResponseLinkActionResult>;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedInputKeys = new Set<string>(
  RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ALLOWED_BROWSER_INPUTS,
);
const productMaximumTtlHours = 168;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDisabledAdapterInput(
  input: unknown,
): AssignmentDetailResponseLinkDisabledAdapterInput | null {
  if (!isRecord(input)) return null;
  if (Object.keys(input).some((key) => !allowedInputKeys.has(key))) return null;
  if (typeof input.assignmentId !== "string") return null;

  const assignmentId = input.assignmentId.trim().toLowerCase();
  if (!uuidPattern.test(assignmentId)) return null;

  if (input.expiresInHours === undefined) {
    return { assignmentId };
  }

  if (
    typeof input.expiresInHours !== "number" ||
    !Number.isInteger(input.expiresInHours) ||
    input.expiresInHours < 1 ||
    input.expiresInHours > productMaximumTtlHours
  ) {
    return null;
  }

  return { assignmentId, expiresInHours: input.expiresInHours };
}

function evaluateChecklistPrerequisites(
  readiness: AssignmentDetailResponseLinkEnablementReadiness | undefined,
) {
  const blockers: string[] = [];
  if (!ASSIGNMENT_DETAIL_RESPONSE_LINK_ENABLEMENT_CHECKLIST_AVAILABLE) {
    blockers.push("enablement_checklist_unavailable");
  }
  if (!readiness?.routeSafety) blockers.push("route_safety_incomplete");
  if (!readiness?.entrySafety) blockers.push("entry_safety_incomplete");
  if (!readiness?.actionSafety) blockers.push("action_safety_incomplete");
  if (!readiness?.uiSafety) blockers.push("ui_safety_incomplete");
  if (!readiness?.credentialLogSafety) {
    blockers.push("credential_log_safety_incomplete");
  }
  if (!readiness?.browserProof) blockers.push("browser_proof_incomplete");
  if (!readiness?.productOwnerCheckpoint) {
    blockers.push("product_owner_checkpoint_missing");
  }
  return blockers;
}

export function describeAssignmentDetailResponseLinkDisabledAdapter() {
  return {
    adapterAvailable: RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_AVAILABLE,
    defaultState: RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_DEFAULT_STATE,
    finalApprovalAvailable:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE,
    routeContext: RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ROUTE_CONTEXT,
    actionBoundaryAvailable: RESPONSE_LINK_PRODUCT_ACTION_SERVER_BOUNDARY_AVAILABLE,
    enablementChecklistStatus:
      assignmentDetailResponseLinkEnablementChecklist.currentStatus,
    allowedBrowserInputs:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_ALLOWED_BROWSER_INPUTS,
    forbiddenBrowserInputs:
      RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FORBIDDEN_BROWSER_INPUTS,
  } as const;
}

export async function createAssignmentDetailResponseLinkDisabledAdapter(
  input: AssignmentDetailResponseLinkDisabledAdapterInput | unknown,
): Promise<AssignmentDetailResponseLinkDisabledAdapterResult> {
  return createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(input);
}

export async function createAssignmentDetailResponseLinkDisabledAdapterWithDependencies(
  input: AssignmentDetailResponseLinkDisabledAdapterInput | unknown,
  dependencies: AssignmentDetailResponseLinkDisabledAdapterDependencies = {},
): Promise<AssignmentDetailResponseLinkDisabledAdapterResult> {
  const request = normalizeDisabledAdapterInput(input);
  if (!request) return { status: "disabled", reason: "invalid_input" };

  const checklistBlockers = evaluateChecklistPrerequisites(dependencies.readiness);
  if (checklistBlockers.length > 0) {
    return {
      status: "disabled",
      reason: "blocked_by_checklist",
      blockers: checklistBlockers,
    };
  }

  if (!RESPONSE_LINK_PRODUCT_ACTION_DISABLED_ADAPTER_FINAL_APPROVAL_AVAILABLE) {
    return { status: "disabled", reason: "not_approved" };
  }

  if (!RESPONSE_LINK_PRODUCT_ACTION_SERVER_BOUNDARY_AVAILABLE) {
    return { status: "disabled", reason: "action_boundary_unavailable" };
  }

  const action = dependencies.productAction ?? createAssignmentDetailResponseLinkProductAction;
  try {
    const actionResult = await action(request);
    if (actionResult.status !== "issued") {
      return { status: "disabled", reason: "action_failed" };
    }

    return {
      status: "issued",
      responseUrl: actionResult.responseUrl,
      expiresAt: actionResult.expiresAt,
      warning: actionResult.warning,
    };
  } catch {
    return { status: "disabled", reason: "action_failed" };
  }
}
