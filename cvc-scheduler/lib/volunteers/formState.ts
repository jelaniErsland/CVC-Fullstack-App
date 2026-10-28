// Presentation equality only: validation and writes remain server-authoritative.
const metadata = new Set(["profileId", "expectedUpdatedAt", "structuredSkillsPresent"]);
const sets = new Set(["availableWorkDays", "structuredSkills"]);
export function volunteerFormFingerprint(entries: Iterable<readonly [string, string]>) {
  const fields = new Map<string, string[]>();
  for (const [name, raw] of entries) {
    if (metadata.has(name)) continue;
    const text = raw.replace(/\r\n?/g, "\n").trim();
    const value = name === "fullName" ? text.replace(/\s+/g, " ") : text;
    fields.set(name, [...(fields.get(name) ?? []), value]);
  }
  return JSON.stringify([...fields].sort(([a], [b]) => a.localeCompare(b)).map(([name, values]) => [name, sets.has(name) ? [...values].sort() : values]));
}
