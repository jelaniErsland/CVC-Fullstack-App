export type CommunicationPlan = { kind: "welcome" | "schedule"; mode: "new" | "all" | "resend"; volunteerIds: string[]; startDate?: string; endDate?: string };
export type CommunicationAssignment = { assignmentId: string; itemId: string; date: string; title: string; startTime: string | null; endTime: string | null; delivered: boolean | null };
export type CommunicationRecipient = { volunteerId: string; name: string; email: string; assignments: CommunicationAssignment[]; newAssignments: number; previousAssignments: number; excludedAssignments: number; emailChanged: boolean };
export type CommunicationPreview = { workspaceName: string; kind: "welcome" | "schedule"; mode: string; recipients: CommunicationRecipient[]; exclusions: { volunteerId: string; name: string; reason: string; excludedAssignments: number }[]; fingerprint: string };
export type CommunicationHistory = { operation_id: string; recipient_id: string; volunteer_id: string; kind: string; mode: string; created_at: string; name: string; email: string; state: "ready" | "sending" | "sent" | "failed" | "unknown" | "excluded"; attempt: number; failure_code: string | null; assignment_count: number };
export type CommunicationActionState = { kind: "preview"; preview: CommunicationPreview } | { kind: "results"; history: CommunicationHistory[] } | { kind: "error"; message: string };
export const communicationCapabilities = ["workspace.read", "volunteers.view", "volunteers.edit", "calendar.view", "assignments.view", "assignments.edit"] as const;
export function parseCommunicationPlan(value: unknown): CommunicationPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid selection");
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !["kind", "mode", "volunteerIds", "startDate", "endDate"].includes(k)) || !["welcome", "schedule"].includes(p.kind as string) || !["new", "all", "resend"].includes(p.mode as string) || !Array.isArray(p.volunteerIds) || p.volunteerIds.length > 200 || p.volunteerIds.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) || new Set(p.volunteerIds).size !== p.volunteerIds.length || (p.mode === "resend" && !p.volunteerIds.length) || (p.kind === "welcome" && p.mode === "all")) throw new Error("Invalid selection");
  if (p.kind === "schedule" && (typeof p.startDate !== "string" || typeof p.endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(p.endDate))) throw new Error("Invalid dates");
  return p as CommunicationPlan;
}
const html = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function buildCommunicationMessage(input: { kind: "welcome" | "schedule"; workspaceName: string; name: string; assignments: CommunicationAssignment[]; url: string }) {
  const subject = `${input.kind === "welcome" ? "Welcome to Project Local" : "Your project schedule"} · ${input.workspaceName}`;
  const lines = input.kind === "welcome" ? [
    `Hi ${input.name},`, `Welcome to Project Local for ${input.workspaceName}.`,
    "Project Local helps you see your assigned work and let the project team know whether you can make it.",
    "To find your schedule, enter the email address or phone number you shared with the project team, then your last name. Choose your project if asked.",
    "Open an assignment to Confirm or choose Can't make it. Each assignment has its own response.",
    "Your schedule also shows the posted weekly lunch menu. You can record dates when you'll be away so the project team can plan around your availability.",
    "If your schedule is empty, the project team has not posted work for you yet.",
    `Find your schedule: ${input.url}`,
  ] : [
    `Hi ${input.name},`, `Here is your current schedule for ${input.workspaceName}.`,
    ...input.assignments.map(a => `${a.date} · ${a.title} · ${a.startTime ? `${a.startTime.slice(0,5)}–${a.endTime?.slice(0,5) ?? ""}` : "Time not specified"}`),
    "Review each assignment and Confirm or choose Can't make it. Existing responses are preserved.",
    `View schedule & respond: ${input.url}`,
  ];
  return { subject, text: lines.join("\n\n"), html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#10233f"><p style="color:#246bfd;font-weight:700">PROJECT LOCAL</p>${lines.slice(0,-1).map(l => `<p style="line-height:1.6">${html(l)}</p>`).join("")}<a style="display:inline-block;background:#246bfd;color:white;padding:14px 20px;border-radius:10px;text-decoration:none" href="${html(input.url)}">${input.kind === "welcome" ? "Find your schedule" : "View schedule &amp; respond"}</a></div>` };
}
