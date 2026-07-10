import "server-only";

import type { AssignmentDetailContext } from "../assignments/detailContext.server.ts";
import type {
  AuditedAssignmentResponseLinkReveal,
  createAuditedAssignmentResponseLinkReveal,
} from "./auditedReveal.server.ts";
import {
  ResponseLinkValidationError,
  validateResponseLinkBaseUrl,
} from "./link.ts";
import {
  normalizeResponseLinkTtlHours,
  ResponseLinkPolicyError,
} from "./policy.ts";

export const ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_ROUTE_CONTEXT =
  "/admin/assignments/[assignmentId]" as const;
export const ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REVEAL_MODE = "copy_link" as const;
export const ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REASON_CODE =
  "assignment_detail_product_action" as const;
export const ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_WARNING =
  "This link grants assignment response access for this assignment until it expires." as const;

type ProductActionEnvironment = Readonly<{
  RESPONSE_LINK_BASE_URL?: string;
}>;

export type AssignmentDetailResponseLinkActionInput = Readonly<{
  assignmentId: string;
  expiresInHours?: number;
}>;

export type AssignmentDetailResponseLinkActionFailure = Readonly<{
  status: "invalid" | "unavailable";
}>;

export type AssignmentDetailResponseLinkActionSuccess = Readonly<{
  status: "issued";
  responseUrl: string;
  expiresAt: string;
  warning: typeof ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_WARNING;
}>;

export type AssignmentDetailResponseLinkActionResult =
  | AssignmentDetailResponseLinkActionFailure
  | AssignmentDetailResponseLinkActionSuccess;

type AssignmentDetailResponseLinkActionDependencies = Readonly<{
  environment?: ProductActionEnvironment;
  readContext?: (input: AssignmentDetailResponseLinkActionInput) => Promise<
    Pick<AssignmentDetailContext, "assignmentId" | "canEditAssignment"> | null
  >;
  reveal?: (
    input: Parameters<typeof createAuditedAssignmentResponseLinkReveal>[0],
  ) => Promise<Pick<AuditedAssignmentResponseLinkReveal, "responseUrl" | "expiresAt">>;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedInputKeys = new Set(["assignmentId", "expiresInHours"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeInput(
  input: AssignmentDetailResponseLinkActionInput | unknown,
): AssignmentDetailResponseLinkActionInput {
  if (!isRecord(input) || Object.keys(input).some((key) => !allowedInputKeys.has(key))) {
    throw new ResponseLinkValidationError(["input contains unsupported fields."]);
  }

  if (typeof input.assignmentId !== "string" || !uuidPattern.test(input.assignmentId.trim())) {
    throw new ResponseLinkValidationError(["assignmentId must be a UUID."]);
  }

  let expiresInHours: number;
  try {
    expiresInHours = normalizeResponseLinkTtlHours("product", input.expiresInHours);
  } catch (error) {
    if (error instanceof ResponseLinkPolicyError) {
      throw new ResponseLinkValidationError([
        "expiresInHours exceeds the response-link product policy.",
      ]);
    }
    throw error;
  }

  return {
    assignmentId: input.assignmentId.trim().toLowerCase(),
    expiresInHours,
  };
}

function readTrustedResponseLinkBaseUrl(environment: ProductActionEnvironment) {
  const configured = environment.RESPONSE_LINK_BASE_URL;
  if (!configured?.trim()) throw new ResponseLinkValidationError(["base URL missing."]);
  return validateResponseLinkBaseUrl(configured);
}

export async function createAssignmentDetailResponseLinkProductAction(
  input: AssignmentDetailResponseLinkActionInput | unknown,
): Promise<AssignmentDetailResponseLinkActionResult> {
  return createAssignmentDetailResponseLinkProductActionWithDependencies(input);
}

export async function createAssignmentDetailResponseLinkProductActionWithDependencies(
  input: AssignmentDetailResponseLinkActionInput | unknown,
  dependencies: AssignmentDetailResponseLinkActionDependencies = {},
): Promise<AssignmentDetailResponseLinkActionResult> {
  let request: AssignmentDetailResponseLinkActionInput;
  let baseUrl: string;
  try {
    request = normalizeInput(input);
  } catch (error) {
    if (error instanceof ResponseLinkValidationError) return { status: "invalid" };
    throw error;
  }

  try {
    baseUrl = readTrustedResponseLinkBaseUrl(
      dependencies.environment ?? {
        RESPONSE_LINK_BASE_URL: process.env.RESPONSE_LINK_BASE_URL,
      },
    );
  } catch (error) {
    if (error instanceof ResponseLinkValidationError) return { status: "unavailable" };
    throw error;
  }

  const readContext =
    dependencies.readContext ??
    (await import("../assignments/detailContext.server.ts")).readAssignmentDetailContext;
  const context = await readContext({ assignmentId: request.assignmentId });
  if (!context || context.assignmentId !== request.assignmentId || !context.canEditAssignment) {
    return { status: "unavailable" };
  }

  const reveal =
    dependencies.reveal ??
    (await import("./auditedReveal.server.ts")).createAuditedAssignmentResponseLinkReveal;
  let revealed: Pick<AuditedAssignmentResponseLinkReveal, "responseUrl" | "expiresAt">;
  try {
    revealed = await reveal({
      assignmentId: request.assignmentId,
      expiresInHours: request.expiresInHours,
      revealMode: ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REVEAL_MODE,
      metadata: {
        reason_code: ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_REASON_CODE,
        delivery_requested: false,
      },
      baseUrl,
    });
  } catch {
    return { status: "unavailable" };
  }

  return {
    status: "issued",
    responseUrl: revealed.responseUrl,
    expiresAt: revealed.expiresAt,
    warning: ASSIGNMENT_DETAIL_RESPONSE_LINK_ACTION_WARNING,
  };
}
