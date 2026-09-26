/** Presentation only. Every route still authorizes its own reads and actions. */
export function adminDestinations(capabilities: readonly string[]) {
  const has = (...required: string[]) => required.every(c => capabilities.includes(c));
  const ids = ["overview"];
  if (has("calendar.view", "assignments.view")) ids.push("calendar", "needs-attention");
  if (has("volunteers.view")) ids.push("volunteers");
  if (has("tasks.view")) ids.push("tasks");
  if (has("calendar.view", "assignments.view", "volunteers.view", "tasks.view")) ids.push("quick-view");
  if (has("workspace.read", "volunteers.view", "volunteers.edit", "calendar.view", "assignments.view", "assignments.edit")) ids.push("announcements");
  return ids;
}
