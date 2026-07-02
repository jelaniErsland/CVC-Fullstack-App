import "server-only";

import {
  issueAssignmentResponseLinkWithIssuer,
  type IssueAssignmentResponseLinkInput,
} from "@/lib/responseTokens/link";
import {
  issueAssignmentResponseToken,
  issueAssignmentResponseTokenWithClient,
} from "@/lib/responseTokens/server";
import type { AppSupabaseClient } from "@/lib/supabase/types";

export async function issueAssignmentResponseLinkWithClient(
  supabase: AppSupabaseClient,
  input: IssueAssignmentResponseLinkInput | unknown,
) {
  return issueAssignmentResponseLinkWithIssuer(input, (tokenInput) =>
    issueAssignmentResponseTokenWithClient(supabase, tokenInput),
  );
}

export async function issueAssignmentResponseLink(
  input: IssueAssignmentResponseLinkInput | unknown,
) {
  return issueAssignmentResponseLinkWithIssuer(input, issueAssignmentResponseToken);
}
