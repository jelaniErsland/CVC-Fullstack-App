"use client";

import { Check, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { structuredSkillOptions, type StructuredSkill } from "@/lib/volunteers/skills";
import styles from "./VolunteerFilters.module.css";

export function VolunteerSkillsEditor({ initialSkills = [], onValueChange }: { initialSkills?: readonly StructuredSkill[]; onValueChange?: () => void }) {
  const [selected, setSelected] = useState(initialSkills);
  const id = useId();
  const change = (values: readonly StructuredSkill[]) => { setSelected(values); onValueChange?.(); };
  return <section className="border-y border-violet-100 bg-violet-50/20 py-5" aria-labelledby={id}>
    <div className="mb-3 flex items-center gap-2.5"><span className={styles.well} data-tone="violet" aria-hidden="true"><Sparkles /></span><h3 id={id} className="text-base font-semibold text-[var(--pl-ink)]">Skills</h3><span className="ml-auto text-xs font-medium text-violet-800" aria-live="polite">{selected.length} selected</span></div>
    <p className="mb-4 text-sm leading-6 text-[var(--pl-muted)]">Select the areas this volunteer has experience helping with. Experience notes remain separate.</p>
    <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2" role="group" aria-label="Structured skills">
      {structuredSkillOptions.map(skill => <button className={`${styles.option} !justify-start !text-left`} data-tone="violet" key={skill} aria-pressed={selected.includes(skill)} type="button" onClick={() => change(selected.includes(skill) ? selected.filter(value => value !== skill) : [...selected, skill])}><span className="inline-flex size-4 shrink-0 items-center justify-center">{selected.includes(skill) && <Check aria-hidden="true" />}</span>{skill}</button>)}
    </div>
    <input type="hidden" name="structuredSkillsPresent" value="1" />
    {selected.map(skill => <input type="hidden" name="structuredSkills" value={skill} key={skill} />)}
    {selected.length > 0 && <button type="button" className={`${styles.button} ${styles.quiet} mt-2`} onClick={() => change([])}>Clear skills</button>}
  </section>;
}
