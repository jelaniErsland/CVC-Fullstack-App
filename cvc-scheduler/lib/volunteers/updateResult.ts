export type VolunteerUpdateResult =
  | Readonly<{ kind: "updated" }>
  | Readonly<{ kind: "rejected"; reason: "unavailable" | "validation" | "error" | "conflict" }>;
