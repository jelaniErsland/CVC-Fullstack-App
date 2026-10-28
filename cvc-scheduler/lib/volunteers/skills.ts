// Existing questionnaire-v1 categories. Current profile skills never derive from prose.
export const structuredSkillOptions = ["Painting", "Demo", "Framing", "Finish work", "Electrical assist", "Plumbing assist", "General cleanup", "Check-in desk", "Food service", "Security"] as const;
export type StructuredSkill = (typeof structuredSkillOptions)[number];
export function validateStructuredSkills(value: unknown): StructuredSkill[] {
  if (!Array.isArray(value) || value.length > 10 || value.some(skill => typeof skill !== "string" || !structuredSkillOptions.includes(skill as StructuredSkill)) || new Set(value).size !== value.length) {
    throw new Error("Structured skills are invalid. Choose only the recorded skill categories without duplicates.");
  }
  return [...value].sort();
}
