export const lookupFailureMessage = "We couldn't find an available volunteer schedule for that email or phone. Check it and try again, or ask your project contact for help.";

export type LookupVolunteer = Readonly<{ choice: string; name: string; project: string; congregation: string | null }>;
export type LookupResult =
  | Readonly<{ status: "unverified" }>
  | Readonly<{ status: "choose_volunteer"; volunteers: LookupVolunteer[] }>
  | Readonly<{ status: "verified"; bearer_token: string; expires_at: string }>;

export function parseLookupInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["contact", "choice"].includes(key))) return null;
  if (typeof record.contact !== "string") return null;
  const contact = record.contact.trim();
  if (contact.length < 3 || contact.length > 254) return null;
  if (record.choice !== undefined && (typeof record.choice !== "string" || !/^[0-9a-f]{64}$/.test(record.choice))) return null;
  return { contact, choice: record.choice as string | undefined };
}

export function parseLookupResult(value: unknown): LookupResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "unverified" };
  const record = value as Record<string, unknown>;
  if (record.status === "verified" && typeof record.bearer_token === "string"
    && /^[A-Za-z0-9_-]{43}$/.test(record.bearer_token) && typeof record.expires_at === "string"
    && Number.isFinite(Date.parse(record.expires_at)) && Date.parse(record.expires_at) > Date.now()) {
    return { status: "verified", bearer_token: record.bearer_token, expires_at: record.expires_at };
  }
  if (record.status === "choose_volunteer" && Array.isArray(record.volunteers) && record.volunteers.length > 1
    && record.volunteers.length <= 20 && record.volunteers.every((p) => p && typeof p === "object"
      && typeof p.choice === "string" && /^[0-9a-f]{64}$/.test(p.choice)
      && typeof p.name === "string" && p.name.length > 0 && p.name.length <= 160
      && typeof p.project === "string" && p.project.length > 0 && p.project.length <= 160
      && (p.congregation === null || typeof p.congregation === "string"))) {
    return { status: "choose_volunteer", volunteers: record.volunteers.map((p) => ({ choice: p.choice, name: p.name, project: p.project, congregation: p.congregation })) };
  }
  return { status: "unverified" };
}
