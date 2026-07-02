import "server-only";

import { redirect } from "next/navigation";

import {
  classifyPublicAssignmentResponseSubmissionError,
  submitPublicAssignmentResponseForRoute,
} from "@/lib/responseTokens/publicRoute";

export async function submitPublicAssignmentResponseAction(
  token: string,
  formData: FormData,
) {
  const status = formData.get("response");
  const noteValue = formData.get("note");
  const normalizedNote = typeof noteValue === "string" ? noteValue.trim() : "";
  const note = normalizedNote || null;
  let outcome: string;

  try {
    const result = await submitPublicAssignmentResponseForRoute({
      token,
      status,
      note,
    });
    outcome = result.status;
  } catch (error) {
    outcome = classifyPublicAssignmentResponseSubmissionError(error);
  }

  redirect(`/respond/${encodeURIComponent(token)}?outcome=${outcome}`);
}
