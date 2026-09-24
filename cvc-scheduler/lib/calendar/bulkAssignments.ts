import { validateCreateRepeatedCalendarItemsInput } from "./repeat.ts";

export type BulkAssignmentPlan = {
  itemIds: string[];
  volunteers: { id: string; excludeDates: string[] }[];
  note: string | null;
  create?: {
    presetId: string | null; title: string | null; taskType: string | null;
    startDate: string; endDate: string; weekdays: number[];
    startTime: string; endTime: string; neededCount: number;
    notes: string | null; customValues: Record<string, string | number | boolean | null>;
    meal: { kind: "breakfast" | "lunch"; provider: string | null; contact: string | null; menu: string | null; total: number | null } | null;
  };
};
export type BulkAssignmentPreview = {
  saved: false; fingerprint: string;
  items: { id: string | null; date: string; title: string; startTime: string | null; endTime: string | null; neededCount: number; assignedCount: number; publication: string }[];
  volunteers: { id: string; name: string; version: string }[];
  existingAssignments: { itemId: string; volunteerId: string; assignmentId: string }[];
  sameDayWork: { volunteerId: string; date: string; title: string; assignmentId: string }[];
  awayPeriods?: { id: string; volunteerId: string; start: string; end: string }[];
};
export type BulkAssignmentResult = { saved: true; createdAssignmentCount: number; itemIds: string[]; createdItemIds: string[]; assignmentIds: string[] };
export type BulkAssignmentActionState = { kind: "preview"; preview: BulkAssignmentPreview } | { kind: "saved"; count: number } | { kind: "error"; message: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null && !Array.isArray(v); }
function ids(v: unknown, maximum: number) {
  if (!Array.isArray(v) || v.length > maximum || v.some(id => typeof id !== "string" || !uuid.test(id)) || new Set(v).size !== v.length) throw new Error("Invalid selection.");
  return v as string[];
}
export function validateBulkAssignmentPlan(input: unknown, workspaceId: string, requestId: string): BulkAssignmentPlan {
  if (!uuid.test(requestId) || !record(input) || JSON.stringify(input).length > 100000 || Object.keys(input).some(k => !["itemIds", "volunteers", "note", "create"].includes(k))) throw new Error("Invalid selection.");
  const itemIds = ids(input.itemIds, 100);
  if (!Array.isArray(input.volunteers) || input.volunteers.length < 1 || input.volunteers.length > 25) throw new Error("Choose up to 25 volunteers.");
  const volunteers = input.volunteers.map(v => {
    if (!record(v) || Object.keys(v).some(k => !["id", "excludeDates"].includes(k)) || typeof v.id !== "string" || !uuid.test(v.id) || !Array.isArray(v.excludeDates) || v.excludeDates.length > 100 || v.excludeDates.some(d => typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d))) throw new Error("Invalid volunteer or exception date.");
    return { id: v.id, excludeDates: [...new Set(v.excludeDates as string[])] };
  });
  ids(volunteers.map(v => v.id), 25);
  if (input.note !== null && (typeof input.note !== "string" || input.note.length > 2000)) throw new Error("Assignment note is too long.");
  const result: BulkAssignmentPlan = { itemIds, volunteers, note: input.note as string | null };
  if (input.create != null) {
    if (!record(input.create) || itemIds.length || Object.keys(input.create).some(k => !["presetId", "title", "taskType", "startDate", "endDate", "weekdays", "startTime", "endTime", "neededCount", "notes", "customValues", "meal"].includes(k))) throw new Error("Invalid creation selection.");
    const c = input.create;
    if (typeof c.startDate !== "string" || typeof c.endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(c.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(c.endDate) || (Date.parse(c.endDate) - Date.parse(c.startDate)) / 86400000 > 366) throw new Error("Choose a date range of up to one year.");
    const normalized = validateCreateRepeatedCalendarItemsInput({
      requestKey: requestId, workspaceId,
      source: c.presetId ? { kind: "preset", taskPresetId: c.presetId } : { kind: "one_off", title: c.title, taskType: c.taskType },
      startDate: c.startDate, endDate: c.endDate, weekdays: c.weekdays,
      startTime: c.startTime, endTime: c.endTime, neededCount: c.neededCount,
      notes: c.notes, customValues: c.customValues, meal: c.meal,
    });
    result.create = {
      presetId: normalized.source.kind === "preset" ? normalized.source.taskPresetId : null,
      title: normalized.source.kind === "one_off" ? normalized.source.title : null,
      taskType: normalized.source.kind === "one_off" ? normalized.source.taskType : null,
      startDate: normalized.startDate, endDate: normalized.endDate, weekdays: [...normalized.weekdays],
      startTime: normalized.startTime, endTime: normalized.endTime, neededCount: normalized.neededCount,
      notes: normalized.notes, customValues: { ...normalized.customValues }, meal: normalized.meal,
    };
  } else if (!itemIds.length) throw new Error("Choose Calendar items.");
  return result;
}

export function assignmentPreviewCounts(preview: BulkAssignmentPreview, plan: BulkAssignmentPlan) {
  let added = 0, existing = 0, exceptions = 0;
  for (const item of preview.items) for (const volunteer of plan.volunteers) {
    if (volunteer.excludeDates.includes(item.date)) { exceptions++; continue; }
    if (preview.existingAssignments.some(a => a.itemId === item.id && a.volunteerId === volunteer.id)) existing++;
    else added++;
  }
  return { added, existing, exceptions };
}
