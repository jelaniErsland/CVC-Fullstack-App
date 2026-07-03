import "server-only";

import type {
  IssueAssignmentResponseTokenInput,
  IssuedAssignmentResponseToken,
} from "@/lib/responseTokens/token";

export type IssueAssignmentResponseLinkInput = Readonly<{
  assignmentId: string;
  expiresInHours?: number;
  baseUrl: string;
}>;

export type IssuedAssignmentResponseLink = Readonly<{
  tokenId: string;
  responseUrl: string;
  redactedUrl: string;
  expiresAt: string;
}>;

export type AssignmentResponseTokenIssuer = (
  input: IssueAssignmentResponseTokenInput,
) => Promise<IssuedAssignmentResponseToken>;

export class ResponseLinkValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super("Assignment response link input is invalid.");
    this.name = "ResponseLinkValidationError";
    this.issues = issues;
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bearerPattern = /^[A-Za-z0-9_-]{43}$/;
const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateResponseLinkBaseUrl(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 2048 ||
    value !== value.trim()
  ) {
    throw new ResponseLinkValidationError(["baseUrl must be a bounded absolute URL."]);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ResponseLinkValidationError(["baseUrl must be a valid absolute URL."]);
  }

  const issues: string[] = [];
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    issues.push("baseUrl must use http or https.");
  }
  if (url.protocol === "http:" && !loopbackHosts.has(url.hostname)) {
    issues.push("http baseUrl is allowed only for loopback development.");
  }
  if (url.username || url.password) issues.push("baseUrl must not contain credentials.");
  if (url.pathname !== "/") issues.push("baseUrl must be an application origin without a path.");
  if (url.search || url.hash) issues.push("baseUrl must not contain a query or fragment.");
  if (url.origin === "null") issues.push("baseUrl must have an origin.");
  if (issues.length > 0) throw new ResponseLinkValidationError(issues);

  return url.origin;
}

function validateInput(input: unknown) {
  if (!isRecord(input)) {
    throw new ResponseLinkValidationError(["input must be an object."]);
  }

  const issues: string[] = [];
  const unknownKeys = Object.keys(input).filter(
    (key) => !["assignmentId", "expiresInHours", "baseUrl"].includes(key),
  );
  if (unknownKeys.length > 0) issues.push("input contains unsupported fields.");

  const assignmentId = input.assignmentId;
  if (typeof assignmentId !== "string" || !uuidPattern.test(assignmentId.trim())) {
    issues.push("assignmentId must be a UUID.");
  }

  const expiresInHours = input.expiresInHours;
  if (
    expiresInHours !== undefined &&
    (typeof expiresInHours !== "number" ||
      !Number.isInteger(expiresInHours) ||
      expiresInHours < 1 ||
      expiresInHours > 720)
  ) {
    issues.push("expiresInHours must be an integer from 1 to 720.");
  }

  let baseUrl = "";
  try {
    baseUrl = validateResponseLinkBaseUrl(input.baseUrl);
  } catch (error) {
    if (error instanceof ResponseLinkValidationError) issues.push(...error.issues);
    else issues.push("baseUrl is invalid.");
  }

  if (issues.length > 0) throw new ResponseLinkValidationError(issues);
  return {
    assignmentId: (assignmentId as string).trim().toLowerCase(),
    expiresInHours: expiresInHours as number | undefined,
    baseUrl,
  };
}

export function redactAssignmentResponseLink(value: unknown) {
  if (typeof value !== "string") return "[invalid response link]";

  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !/^\/respond\/[A-Za-z0-9_-]{43}$/.test(url.pathname)
    ) {
      return "[invalid response link]";
    }
    return `${url.origin}/respond/[redacted]`;
  } catch {
    return "[invalid response link]";
  }
}

export async function issueAssignmentResponseLinkWithIssuer(
  input: IssueAssignmentResponseLinkInput | unknown,
  issueToken: AssignmentResponseTokenIssuer,
): Promise<IssuedAssignmentResponseLink> {
  const request = validateInput(input);
  const issued = await issueToken({
    assignmentId: request.assignmentId,
    expiresInHours: request.expiresInHours,
    internalNote: null,
  });

  if (
    !issued ||
    typeof issued.tokenId !== "string" ||
    !uuidPattern.test(issued.tokenId) ||
    typeof issued.token !== "string" ||
    !bearerPattern.test(issued.token) ||
    typeof issued.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(issued.expiresAt))
  ) {
    throw new Error("Assignment response token issuance returned an invalid result.");
  }

  const responseUrl = new URL(
    `/respond/${encodeURIComponent(issued.token)}`,
    request.baseUrl,
  ).toString();

  return {
    tokenId: issued.tokenId.toLowerCase(),
    responseUrl,
    redactedUrl: redactAssignmentResponseLink(responseUrl),
    expiresAt: issued.expiresAt,
  };
}
