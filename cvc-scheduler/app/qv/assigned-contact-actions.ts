"use server";

import { cookies } from "next/headers";
import type { AssignedContactResult } from "@/lib/calendar/assignedContact.server";
import { createQuickViewReadClient, projectQuickViewAccessCookie } from "@/lib/projectQuickViewAccess/server";
import { validateOptionalProjectDate, validateQuickViewBearer } from "@/lib/projectQuickViewAccess/token";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function readSharedAssignedContactAction(assignmentId: string, projectDate: string): Promise<AssignedContactResult> {
  if (!uuid.test(assignmentId)) return { kind: "unavailable" };
  try {
    const token = validateQuickViewBearer((await cookies()).get(projectQuickViewAccessCookie.name)?.value);
    const date = validateOptionalProjectDate(projectDate);
    if (!date) return { kind: "unavailable" };
    const { data, error } = await createQuickViewReadClient().rpc("read_project_quick_view_assigned_contact", {
      p_bearer_token: token,
      p_assignment_id: assignmentId,
      p_project_date: date,
    });
    if (error || !data || data.length !== 1) return { kind: "unavailable" };
    const row = data[0];
    if (typeof row.contact_name !== "string" || !row.contact_name.trim() ||
      (row.phone !== null && typeof row.phone !== "string") ||
      (row.email !== null && typeof row.email !== "string") ||
      (row.congregation !== null && typeof row.congregation !== "string")) return { kind: "unavailable" };
    return { kind: "ready", contact: {
      name: row.contact_name,
      phone: row.phone,
      email: row.email,
      congregation: row.congregation,
    } };
  } catch {
    return { kind: "unavailable" };
  }
}
