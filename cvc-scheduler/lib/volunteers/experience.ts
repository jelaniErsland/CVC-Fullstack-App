import type { VolunteerProfile } from "./profile.ts";

export type ExperienceSource = Readonly<{ kind: "profile" | "questionnaire" | "categories"; label: string; text: string }>;
export type ExperienceMatch = Readonly<{ source: ExperienceSource; terms: readonly string[]; excerpt: string }>;
const lower = (value: string) => value.toLocaleLowerCase("en-US");
function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// Explicit allowlist of already-authorized profile fields. Never walk arbitrary
// snapshot keys, raw submissions, private notes, or assignment instructions.
export function volunteerExperienceSources(volunteer: VolunteerProfile): readonly ExperienceSource[] {
  const experience = record(volunteer.skillsHelpSnapshot.skillsExperience);
  const categories = Array.isArray(experience.categories) ? experience.categories.filter((value): value is string => typeof value === "string" && !!value.trim()) : [];
  const candidates: ExperienceSource[] = [
    { kind: "profile", label: "Experience note", text: volunteer.skillsExperience?.trim() ?? "" },
    { kind: "questionnaire", label: "Questionnaire experience response", text: typeof experience.details === "string" ? experience.details.trim() : "" },
    { kind: "categories", label: "Historical questionnaire categories", text: categories.join(", ") },
  ];
  const seen = new Set<string>();
  return candidates.filter(source => { const key = lower(source.text); if (!key || seen.has(key)) return false; seen.add(key); return true; });
}

export function experienceExcerpt(text: string, terms: readonly string[]) {
  if (text.length <= 260) return text;
  const positions = terms.map(term => lower(text).indexOf(lower(term))).filter(index => index >= 0);
  const first = positions.length ? Math.min(...positions) : 0;
  let start = Math.max(0, first - 80);
  if (start > 0) { const space = text.indexOf(" ", start); if (space >= start && space < first) start = space + 1; }
  let end = Math.min(text.length, start + 230);
  if (end < text.length) { const space = text.lastIndexOf(" ", end); if (space > first) end = space; }
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function experienceMatches(entry: { sources: readonly ExperienceSource[]; experienceText: string; volunteer: VolunteerProfile }, query: string, selectedTerms: readonly string[]): readonly ExperienceMatch[] {
  let terms = selectedTerms;
  if (!terms.length) {
    const term = query.trim();
    if (!term || !entry.experienceText.includes(lower(term))) return [];
    const v = entry.volunteer;
    const other = [v.fullName, v.email, v.phone, v.congregation, v.lifecycle, v.readinessStatus, v.profileNotes, v.otherSupport].join(" ");
    if (lower(other).includes(lower(term))) return [];
    terms = [term];
  }
  const unexplained = new Set(terms);
  const matches: ExperienceMatch[] = [];
  for (const source of entry.sources) {
    const found = terms.filter(term => lower(source.text).includes(lower(term)));
    if (!found.some(term => unexplained.has(term))) continue;
    matches.push({ source, terms: found, excerpt: experienceExcerpt(source.text, found) });
    found.forEach(term => unexplained.delete(term));
    if (!unexplained.size) break;
  }
  return matches;
}
