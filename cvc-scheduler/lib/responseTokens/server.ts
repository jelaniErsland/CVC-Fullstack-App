import "server-only";

import {
  parseIssuedAssignmentResponseToken,
  parsePublicAssignmentResponseContext,
  parsePublicAssignmentResponseResult,
  validateIssueAssignmentResponseTokenInput,
  validateReadAssignmentResponseByTokenInput,
  validateRevokeAssignmentResponseTokenInput,
  validateSubmitAssignmentResponseByTokenInput,
  type IssueAssignmentResponseTokenInput,
  type ReadAssignmentResponseByTokenInput,
  type RevokeAssignmentResponseTokenInput,
  type SubmitAssignmentResponseByTokenInput,
} from "@/lib/responseTokens/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppSupabaseClient, PublicRpcArgs } from "@/lib/supabase/types";
import { normalizeWorkspaceReference } from "@/lib/workspaces/identity";

async function requireAuthenticatedContact(supabase: AppSupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Token changes require an authenticated contact.");
}

export async function issueAssignmentResponseTokenWithClient(
  supabase: AppSupabaseClient,
  input: IssueAssignmentResponseTokenInput | unknown,
) {
  await requireAuthenticatedContact(supabase);
  const tokenRequest = validateIssueAssignmentResponseTokenInput(input);
  const { data, error } = await supabase.rpc(
    "issue_assignment_response_token",
    {
      p_assignment_id: tokenRequest.assignmentId,
      p_ttl_hours: tokenRequest.expiresInHours,
      p_internal_note: tokenRequest.internalNote,
    } as PublicRpcArgs<"issue_assignment_response_token">,
  );
  if (error) throw new Error("Assignment response token could not be issued.", { cause: error });
  return parseIssuedAssignmentResponseToken(data);
}

export async function issueAssignmentResponseToken(
  input: IssueAssignmentResponseTokenInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return issueAssignmentResponseTokenWithClient(supabase, input);
}

export async function revokeAssignmentResponseTokenWithClient(
  supabase: AppSupabaseClient,
  input: RevokeAssignmentResponseTokenInput | unknown,
) {
  await requireAuthenticatedContact(supabase);
  const tokenRequest = validateRevokeAssignmentResponseTokenInput(input);
  const { data, error } = await supabase.rpc("revoke_assignment_response_token", {
    p_token_id: tokenRequest.tokenId,
  });
  if (error || typeof data !== "string") {
    throw new Error("Assignment response token could not be revoked.", { cause: error });
  }
  return { tokenId: normalizeWorkspaceReference({ id: data }).value };
}

export async function revokeAssignmentResponseToken(
  input: RevokeAssignmentResponseTokenInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return revokeAssignmentResponseTokenWithClient(supabase, input);
}

export async function readAssignmentResponseByTokenWithClient(
  supabase: AppSupabaseClient,
  input: ReadAssignmentResponseByTokenInput | unknown,
) {
  const tokenRequest = validateReadAssignmentResponseByTokenInput(input);
  const { data, error } = await supabase.rpc("read_assignment_response_by_token", {
    p_bearer_token: tokenRequest.token,
  });
  if (error) throw new Error("Assignment response link is unavailable.", { cause: error });
  return parsePublicAssignmentResponseContext(data);
}

export async function readAssignmentResponseByToken(
  input: ReadAssignmentResponseByTokenInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return readAssignmentResponseByTokenWithClient(supabase, input);
}

export async function submitAssignmentResponseByTokenWithClient(
  supabase: AppSupabaseClient,
  input: SubmitAssignmentResponseByTokenInput | unknown,
) {
  const response = validateSubmitAssignmentResponseByTokenInput(input);
  const { data, error } = await supabase.rpc(
    "submit_assignment_response_by_token",
    {
      p_bearer_token: response.token,
      p_response_status: response.status,
      p_response_note: response.note ?? null,
    } as PublicRpcArgs<"submit_assignment_response_by_token">,
  );
  if (error) throw new Error("Assignment response could not be recorded.", { cause: error });
  return parsePublicAssignmentResponseResult(data);
}

export async function submitAssignmentResponseByToken(
  input: SubmitAssignmentResponseByTokenInput | unknown,
) {
  const supabase = await createServerSupabaseClient();
  return submitAssignmentResponseByTokenWithClient(supabase, input);
}
