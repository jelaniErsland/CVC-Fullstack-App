"use server";

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
  const note = typeof noteValue === "string" ? noteValue : null;
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
