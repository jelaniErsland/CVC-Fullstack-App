"use server";

import {
  issueProjectQuickViewAccess,
  revokeProjectQuickViewAccess,
} from "@/lib/projectQuickViewAccess/server";

export type QuickViewShareActionState = Readonly<{
  status: "idle" | "created" | "disabled" | "error";
  enabled: boolean;
  activeLinkCount: number;
  expiresAt: string | null;
  accessPath: string | null;
  message: string;
}>;

function projectKey(formData: FormData) {
  const value = formData.get("project");
  return typeof value === "string" ? value : "";
}

export async function manageQuickViewShareAction(
  previous: QuickViewShareActionState,
  formData: FormData,
): Promise<QuickViewShareActionState> {
  const operation = formData.get("operation");
  if (operation === "disable") {
    try {
      await revokeProjectQuickViewAccess(projectKey(formData));
      return {
        status: "disabled",
        enabled: false,
        activeLinkCount: 0,
        expiresAt: null,
        accessPath: null,
        message: "Shared access disabled",
      };
    } catch {
      return {
        ...previous,
        status: "error",
        accessPath: null,
        message: "Shared access could not be disabled.",
      };
    }
  }
  if (operation !== "create") {
    return { ...previous, status: "error", message: "Sharing action is unavailable." };
  }
  try {
    const issued = await issueProjectQuickViewAccess(projectKey(formData));
    return {
      status: "created",
      enabled: true,
      activeLinkCount: Math.min(previous.activeLinkCount + 1, 5),
      expiresAt: issued.expiresAt,
      accessPath: `/qv/access/${encodeURIComponent(issued.token)}`,
      message: "Quick View link created",
    };
  } catch {
    return {
      ...previous,
      status: "error",
      accessPath: null,
      message: "A Quick View link could not be created.",
    };
  }
}
