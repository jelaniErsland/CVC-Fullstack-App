export const lookupFailureMessage = "We couldn't verify that information. Check what you entered and try again.";

export type LookupProject = Readonly<{ choice: string; name: string }>;
export type LookupResult =
  | Readonly<{ status: "unverified" }>
  | Readonly<{ status: "choose_project"; projects: LookupProject[] }>
  | Readonly<{ status: "verified"; bearer_token: string; expires_at: string }>;

export function parseLookupInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["lastName", "contact", "projectChoice"].includes(key))) return null;
  if (typeof record.lastName !== "string" || typeof record.contact !== "string") return null;
  const lastName = record.lastName.trim().replace(/\s+/g, " ");
  const contact = record.contact.trim();
  if (!lastName || lastName.length > 160 || contact.length < 3 || contact.length > 254) return null;
  if (record.projectChoice !== undefined && (typeof record.projectChoice !== "string" || !/^[0-9a-f]{64}$/.test(record.projectChoice))) return null;
  return { lastName, contact, projectChoice: record.projectChoice as string | undefined };
}

export function parseLookupResult(value: unknown): LookupResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "unverified" };
  const record = value as Record<string, unknown>;
  if (record.status === "verified" && typeof record.bearer_token === "string"
    && /^[A-Za-z0-9_-]{43}$/.test(record.bearer_token) && typeof record.expires_at === "string"
    && Number.isFinite(Date.parse(record.expires_at)) && Date.parse(record.expires_at) > Date.now()) {
    return { status: "verified", bearer_token: record.bearer_token, expires_at: record.expires_at };
  }
  if (record.status === "choose_project" && Array.isArray(record.projects) && record.projects.length > 1
    && record.projects.length <= 20 && record.projects.every((p) => p && typeof p === "object"
      && typeof p.choice === "string" && /^[0-9a-f]{64}$/.test(p.choice)
      && typeof p.name === "string" && p.name.length > 0 && p.name.length <= 160)) {
    return { status: "choose_project", projects: record.projects.map((p) => ({ choice: p.choice, name: p.name })) };
  }
  return { status: "unverified" };
}
