"use server";

import { redirect } from "next/navigation";

import {
  issueResponseLinkDiagnostic,
  ResponseLinkDiagnosticError,
} from "@/lib/responseTokens/diagnostic.server";

const diagnosticPath = "/admin/diagnostics/response-link";

export async function issueResponseLinkDiagnosticAction(formData: FormData) {
  const assignmentValue = formData.get("assignmentId");
  const ttlValue = formData.get("expiresInHours");
  const assignmentId = typeof assignmentValue === "string" ? assignmentValue : "";
  const expiresInHours =
    typeof ttlValue === "string" && ttlValue.trim() !== ""
      ? Number(ttlValue)
      : undefined;
  const params = new URLSearchParams();

  try {
    const result = await issueResponseLinkDiagnostic({
      assignmentId,
      expiresInHours,
    });
    params.set("result", "issued");
    params.set("assignment", result.assignmentId);
    params.set("expires", result.expiresAt);
  } catch (error) {
    params.set(
      "result",
      error instanceof ResponseLinkDiagnosticError ? error.reason : "error",
    );
  }

  redirect(`${diagnosticPath}?${params.toString()}`);
}
