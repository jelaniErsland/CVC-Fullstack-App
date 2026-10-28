import type { VolunteerProfile } from "./profile.ts";
export type VolunteerUpdateResult =
  | Readonly<{ kind: "updated"; volunteer: VolunteerProfile }>
  | Readonly<{ kind: "rejected"; reason: "unavailable" | "validation" | "error" | "conflict" }>;
