import "server-only";

import type { AppSupabaseClient } from "@/lib/supabase/types";
import {
  issueAssignmentResponseLinkWithIssuer,
  type IssueAssignmentResponseLinkInput,
} from "@/lib/responseTokens/link";
import {
  replaceAssignmentResponseToken,
  replaceAssignmentResponseTokenWithClient,
} from "@/lib/responseTokens/replacement.server";

export async function issueReplacementAssignmentResponseLinkWithClient(
  supabase: AppSupabaseClient,
  input: IssueAssignmentResponseLinkInput | unknown,
) {
  return issueAssignmentResponseLinkWithIssuer(input, (tokenInput) =>
    replaceAssignmentResponseTokenWithClient(supabase, {
      assignmentId: tokenInput.assignmentId,
      expiresInHours: tokenInput.expiresInHours,
    }),
  );
}

export async function issueReplacementAssignmentResponseLink(
  input: IssueAssignmentResponseLinkInput | unknown,
) {
  return issueAssignmentResponseLinkWithIssuer(input, (tokenInput) =>
    replaceAssignmentResponseToken({
      assignmentId: tokenInput.assignmentId,
      expiresInHours: tokenInput.expiresInHours,
    }),
  );
}
