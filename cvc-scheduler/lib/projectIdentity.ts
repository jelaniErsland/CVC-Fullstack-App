/** Keep the project-specific name visible while applying the LDC convention once. */
export function ldcProjectName(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return "Project workspace";
  return /^LDC(?:\s|[-:])|^LDC$/i.test(trimmed) ? trimmed : `LDC ${trimmed}`;
}
