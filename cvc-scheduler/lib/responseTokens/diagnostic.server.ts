import "server-only";

import {
  ResponseLinkValidationError,
  validateResponseLinkBaseUrl,
} from "@/lib/responseTokens/link";
import { issueAssignmentResponseLink } from "@/lib/responseTokens/link.server";
import { revokeAssignmentResponseToken } from "@/lib/responseTokens/server";

type ResponseLinkDiagnosticEnvironment = Readonly<{
  RESPONSE_LINK_BASE_URL?: string;
}>;

export type IssueResponseLinkDiagnosticInput = Readonly<{
  assignmentId: unknown;
  expiresInHours?: unknown;
}>;

export type ResponseLinkDiagnosticFailure =
  | "configuration"
  | "invalid"
  | "unavailable";

export class ResponseLinkDiagnosticError extends Error {
  readonly reason: ResponseLinkDiagnosticFailure;

  constructor(reason: ResponseLinkDiagnosticFailure) {
    super("Response link diagnostic is unavailable.");
    this.name = "ResponseLinkDiagnosticError";
    this.reason = reason;
  }
}

export function readResponseLinkDiagnosticConfiguration(
  environment: ResponseLinkDiagnosticEnvironment = {
    RESPONSE_LINK_BASE_URL: process.env.RESPONSE_LINK_BASE_URL,
  },
) {
  const configured = environment.RESPONSE_LINK_BASE_URL;
  if (!configured?.trim()) return { status: "unconfigured" } as const;

  try {
    return {
      status: "configured",
      baseUrl: validateResponseLinkBaseUrl(configured),
    } as const;
  } catch {
    return { status: "unconfigured" } as const;
  }
}

export async function issueResponseLinkDiagnostic(
  input: IssueResponseLinkDiagnosticInput,
) {
  const configuration = readResponseLinkDiagnosticConfiguration();
  if (configuration.status !== "configured") {
    throw new ResponseLinkDiagnosticError("configuration");
  }

  try {
    const issued = await issueAssignmentResponseLink({
      assignmentId: input.assignmentId,
      expiresInHours: input.expiresInHours,
      baseUrl: configuration.baseUrl,
    });
    try {
      if (!issued.redactedUrl.endsWith("/respond/[redacted]")) {
        throw new Error("Unexpected redacted response link.");
      }

      return {
        assignmentId: String(input.assignmentId).trim().toLowerCase(),
        expiresAt: issued.expiresAt,
        redactedUrl: issued.redactedUrl,
      } as const;
    } finally {
      await revokeAssignmentResponseToken({ tokenId: issued.tokenId });
    }
  } catch (error) {
    if (error instanceof ResponseLinkValidationError) {
      throw new ResponseLinkDiagnosticError("invalid");
    }
    if (error instanceof ResponseLinkDiagnosticError) throw error;
    throw new ResponseLinkDiagnosticError("unavailable");
  }
}
