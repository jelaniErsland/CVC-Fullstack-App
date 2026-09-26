/** Display-only mapping; persisted lifecycle/response values are unchanged. */
export const statusDisplay = {
  needs_response: { label: "Awaiting reply", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "info" },
  active: { label: "Active", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
  canceled: { label: "Canceled", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
} as const;
