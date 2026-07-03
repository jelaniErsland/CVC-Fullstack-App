import "server-only";

import { normalizeResponseLinkTtlHours } from "@/lib/responseTokens/policy";
import { parseIssuedAssignmentResponseToken } from "@/lib/responseTokens/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";

export type ReplaceAssignmentResponseTokenInput = Readonly<{
  assignmentId: string;
  expiresInHours?: number;
}>;

export class ResponseTokenReplacementValidationError extends Error {
  constructor() {
    super("Assignment response token replacement input is invalid.");
    this.name = "ResponseTokenReplacementValidationError";
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeReplacementInput(input: unknown) {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ResponseTokenReplacementValidationError();
  }

  const record = input as Record<string, unknown>;
  if (
    Object.keys(record).some(
      (key) => !["assignmentId", "expiresInHours"].includes(key),
    ) ||
    typeof record.assignmentId !== "string" ||
    !uuidPattern.test(record.assignmentId.trim())
  ) {
    throw new ResponseTokenReplacementValidationError();
  }

  let expiresInHours: number;
  try {
    expiresInHours = normalizeResponseLinkTtlHours(
      "product",
      record.expiresInHours,
    );
  } catch {
    throw new ResponseTokenReplacementValidationError();
  }

  return {
    assignmentId: record.assignmentId.trim().toLowerCase(),
    expiresInHours,
  } as const;
}

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Token replacement requires an authenticated contact.");
  }
}

export async function replaceAssignmentResponseTokenWithClient(
  supabase: AppSupabaseClient,
  input: ReplaceAssignmentResponseTokenInput | unknown,
) {
  await requireAuthenticatedContact(supabase);
  const request = normalizeReplacementInput(input);
  const { data, error } = await supabase.rpc(
    "replace_assignment_response_token",
    {
      p_assignment_id: request.assignmentId,
      p_ttl_hours: request.expiresInHours,
    } as PublicRpcArgs<"replace_assignment_response_token">,
  );
  if (error) {
    throw new Error("Assignment response token could not be replaced.", {
      cause: error,
    });
  }
  return parseIssuedAssignmentResponseToken(data);
}

export async function replaceAssignmentResponseToken(
  input: ReplaceAssignmentResponseTokenInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return replaceAssignmentResponseTokenWithClient(supabase, input);
}
