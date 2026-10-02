import "server-only";

type AdminAction = "calendar.create" | "communications.action" | "calendar.read";
type Failure = "none" | "validation" | "authorization" | "persistence" | "unexpected";

export function recordAdminTiming(input: {
  action: AdminAction;
  stage: string;
  startedAt: number;
  failure?: Failure;
  repeated?: boolean;
}) {
  // Deliberately exclude contacts, item IDs, schedule content and request bodies.
  console.info("project_local.admin_timing", {
    action: input.action,
    stage: input.stage,
    elapsedMs: Math.max(0, Math.round(performance.now() - input.startedAt)),
    failure: input.failure ?? "none",
    repeated: Boolean(input.repeated),
  });
}
