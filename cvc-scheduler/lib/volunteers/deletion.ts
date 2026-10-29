export type VolunteerDeletionReview = {
  kind: "review"; profileId: string; name: string; version: string;
  affectedCount: number; upcomingCount: number; inProgressCount: number;
  fingerprint: string; canDelete: boolean;
  nearest?: { title: string; date: string; startTime: string | null; timezone: string } | null;
};
export type VolunteerDeletionReviewResult = VolunteerDeletionReview | { kind: "already_deleted" | "unavailable" | "error" };
export type VolunteerDeletionOutcome = { kind: "deleted" | "already_deleted" } | { kind: "rejected"; reason: "changed" | "permission" | "error" };
export type VolunteerDeletionInput = { profileId: string; version: string; fingerprint: string };
