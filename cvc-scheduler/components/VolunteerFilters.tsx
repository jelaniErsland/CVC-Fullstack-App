"use client";

import { CalendarDays, Check, Filter, HeartHandshake, Plus, Search, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import { VolunteerSideSheet } from "./VolunteerSideSheet";
import { directoryCategoryCount, emptyDirectoryFilters, type DirectoryFilters } from "@/lib/volunteers/directoryFilters";
import { volunteerWeekdays } from "@/lib/volunteers/profile";
import { directoryResultCopy } from "@/lib/volunteers/directoryPresentation";
import styles from "./VolunteerFilters.module.css";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  filters: DirectoryFilters;
  onChange: (filters: DirectoryFilters) => void;
  congregations: readonly string[];
  resultCount: number;
  total: number;
  sortControl?: ReactNode;
};
const triLabels = { yes: "Yes", no: "No", unknown: "Not recorded" };
const labels = { active: "Active", inactive: "Inactive", archived: "Archived" };
const removeOrAppend = <T extends string,>(selected: T[], value: T) => selected.includes(value) ? selected.filter(entry => entry !== value) : [...selected, value];

function Choice({ children, selected, onClick, tone = "blue" }: { children: ReactNode; selected: boolean; onClick: () => void; tone?: string }) {
  return <button type="button" aria-pressed={selected} className={styles.option} data-tone={tone} onClick={onClick}>{selected && <Check aria-hidden="true" />}{children}</button>;
}
function FilterSection({ title, children, icon, tone, active, onClear }: { title: string; children: ReactNode; icon: ReactNode; tone?: string; active: boolean; onClear: () => void }) {
  const id = useId();
  return <section className={styles.section} aria-labelledby={id}><div className={styles.sectionHeading}><span className={styles.well} data-tone={tone} aria-hidden="true">{icon}</span><h3 id={id}>{title}</h3>{active && <button className={`${styles.button} ${styles.quiet}`} type="button" aria-label={`Clear ${title.toLowerCase()}`} onClick={onClear}>Clear</button>}</div>{children}</section>;
}

export function VolunteerFilters({ query, onQueryChange, filters, onChange, congregations, resultCount, total, sortControl }: Props) {
  const [open, setOpen] = useState(false);
  const [congregationQuery, setCongregationQuery] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const termInput = useRef<HTMLInputElement>(null);
  const duplicate = !!skillQuery.trim() && filters.experienceTerms.some(term => term.toLocaleLowerCase("en-US") === skillQuery.trim().toLocaleLowerCase("en-US"));
  const canAdd = !!skillQuery.trim() && !duplicate && filters.experienceTerms.length < 10;
  const addTerm = () => { if (!canAdd) return; onChange({ ...filters, experienceTerms: [...filters.experienceTerms, skillQuery.trim()] }); setSkillQuery(""); termInput.current?.focus(); };
  const count = directoryCategoryCount(filters);
  const resultCopy = directoryResultCopy(query, count);
  const reset = () => { onChange(emptyDirectoryFilters()); onQueryChange(""); setCongregationQuery(""); setSkillQuery(""); };
  const chips: { category: keyof DirectoryFilters; value: string; label: string }[] = [
    ...filters.statuses.map(value => ({ category: "statuses" as const, value, label: labels[value] })),
    ...filters.congregations.map(value => ({ category: "congregations" as const, value, label: value })),
    ...filters.days.map(value => ({ category: "days" as const, value, label: value.slice(0, 3) })),
    ...filters.experienceTerms.map(value => ({ category: "experienceTerms" as const, value, label: value })),
    ...(["security", "housing", "twoPlusDays"] as const).filter(key => filters[key] !== "all").map(key => ({ category: key, value: filters[key], label: `${key === "security" ? "Security" : key === "housing" ? "Housing" : "2+ days/week"}: ${triLabels[filters[key] as keyof typeof triLabels]}` })),
  ];
  const removeChip = (category: keyof DirectoryFilters, value: string) => {
    const current = filters[category];
    onChange({ ...filters, [category]: Array.isArray(current) ? current.filter(entry => entry !== value) : "all" });
    window.requestAnimationFrame(() => trigger.current?.focus());
  };
  const matches = (value: string, term: string) => value.toLocaleLowerCase("en-US").includes(term.trim().toLocaleLowerCase("en-US"));
  return <>
    <div className={styles.toolbar}>
      <div className={styles.searchRow}><label className={styles.search}><Search aria-hidden="true" /><span className="sr-only">Search volunteers or skills</span><input type="search" data-admin-shortcut="search" placeholder="Search volunteers or skills…" value={query} onChange={event => onQueryChange(event.target.value)} /></label><button ref={trigger} className={`${styles.button} ${styles.filterButton}`} data-admin-shortcut="filters" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Filter aria-hidden="true" />Filters{count > 0 ? ` · ${count}` : ""}</button>{sortControl}</div>
      {chips.length > 0 && <div className={styles.chips} aria-label="Active volunteer filters">{chips.slice(0, 6).map(chip => <button type="button" className={styles.chip} data-category={chip.category} key={`${chip.category}:${chip.value}`} aria-label={`Remove ${chip.label} filter`} onClick={() => removeChip(chip.category, chip.value)}>{chip.label}<X aria-hidden="true" /></button>)}{chips.length > 6 && <button className={styles.moreChip} onClick={() => setOpen(true)} type="button">+{chips.length - 6} more</button>}</div>}
      <div className={styles.summary}><p role="status" aria-live="polite" aria-atomic="true">{resultCount} {resultCount === 1 ? "volunteer" : "volunteers"}{resultCopy.countContext ? ` ${resultCount === 1 ? "matches" : "match"} ${resultCopy.countContext}` : ""}{resultCount !== total ? ` · ${total} total` : ""}</p>{resultCount > 0 && (count > 0 || query.trim()) && <button className={`${styles.button} ${styles.quiet}`} type="button" onClick={reset}>{resultCopy.resetLabel}</button>}</div>
    </div>
    <VolunteerSideSheet open={open} title="Filter volunteers" description="Find the right people for the work ahead." label="volunteer filters" icon={<Filter />} onRequestClose={() => setOpen(false)} footer={<><span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{resultCount} matching {resultCount === 1 ? "volunteer" : "volunteers"}</span><button type="button" className={`${styles.button} ${styles.quiet}`} onClick={reset}>Clear all</button><button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => setOpen(false)}>Show {resultCount} {resultCount === 1 ? "volunteer" : "volunteers"}</button></>}>
      <div>
        <FilterSection title="Status" icon={<ShieldCheck />} tone="teal" active={filters.statuses.length > 0} onClear={() => onChange({ ...filters, statuses: [] })}><div className={styles.options} role="group" aria-label="Status">{(["active", "inactive", "archived"] as const).map(value => <Choice key={value} tone="teal" selected={filters.statuses.includes(value)} onClick={() => onChange({ ...filters, statuses: removeOrAppend(filters.statuses, value) })}>{labels[value]}</Choice>)}</div><p className={styles.hint}>Any selected status.</p></FilterSection>
        <FilterSection title="Congregation" icon={<Users />} active={filters.congregations.length > 0} onClear={() => onChange({ ...filters, congregations: [] })}><label><span className="sr-only">Search congregations</span><input className={styles.input} type="search" placeholder="Search congregations…" value={congregationQuery} onChange={event => setCongregationQuery(event.target.value)} /></label><div className={styles.choiceList} role="group" aria-label="Congregation">{congregations.filter(value => matches(value, congregationQuery)).map(value => <Choice key={value} selected={filters.congregations.includes(value)} onClick={() => onChange({ ...filters, congregations: removeOrAppend(filters.congregations, value) })}>{value}</Choice>)}</div>{!congregations.some(value => matches(value, congregationQuery)) && <p className={styles.hint}>No recorded congregations match.</p>}<p className={styles.hint}>Volunteers from any selected congregation.</p></FilterSection>
        <FilterSection title="Availability" icon={<CalendarDays />} tone="warm" active={filters.days.length > 0} onClear={() => onChange({ ...filters, days: [] })}><div className={styles.days} role="group" aria-label="Available weekdays">{volunteerWeekdays.map(day => <button className={styles.option} data-tone="warm" type="button" key={day} aria-label={day} aria-pressed={filters.days.includes(day)} onClick={() => onChange({ ...filters, days: removeOrAppend(filters.days, day) })}>{filters.days.includes(day) && <Check aria-hidden="true" />}{day.slice(0, 3).toUpperCase()}</button>)}</div><p className={styles.hint}>Available on any of these days. Recorded weekday preferences, not date-specific availability.</p></FilterSection>
        <FilterSection title="Skills & experience" icon={<Sparkles />} tone="violet" active={filters.experienceTerms.length > 0} onClear={() => { onChange({ ...filters, experienceTerms: [] }); setSkillQuery(""); }}>
          <div className={styles.termEntry}><label className="min-w-0 flex-1"><span className="sr-only">Search skills or experience</span><input ref={termInput} className={styles.input} type="search" maxLength={120} placeholder="Search skills or experience…" value={skillQuery} onChange={event => setSkillQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addTerm(); } }} /></label><button type="button" className={`${styles.button} ${styles.termAdd}`} disabled={!canAdd} onClick={addTerm} aria-label="Add experience term"><Plus aria-hidden="true" />Add</button></div>
          {filters.experienceTerms.length > 0 && <div className={styles.chips} role="group" aria-label="Experience search terms">{filters.experienceTerms.map(term => <button key={term} type="button" className={styles.chip} data-category="experienceTerms" aria-label={`Remove experience term ${term}`} onClick={() => { onChange({ ...filters, experienceTerms: filters.experienceTerms.filter(value => value !== term) }); termInput.current?.focus(); }}>{term}<X aria-hidden="true" /></button>)}</div>}
          <p className={styles.hint}>All terms must appear in recorded skills or experience text. A match is not a qualification.</p>
          {duplicate && <p className={styles.hint} role="status">This term is already added.</p>}
          {filters.experienceTerms.length >= 10 && <p className={styles.hint}>Use up to 10 terms at a time.</p>}
        </FilterSection>
        <div role="group" aria-label="Other criteria" className={styles.otherCriteria}><h3>Other criteria</h3>{([{ key: "security", title: "After-hours security", icon: <ShieldCheck />, tone: "teal" }, { key: "twoPlusDays", title: "Two or more days a week", icon: <CalendarDays />, tone: "warm" }, { key: "housing", title: "Housing support", icon: <HeartHandshake />, tone: "blue" }] as const).map(section => <FilterSection key={section.key} title={section.title} icon={section.icon} tone={section.tone} active={filters[section.key] !== "all"} onClear={() => onChange({ ...filters, [section.key]: "all" })}><div className={styles.options} role="group" aria-label={section.title}>{(["yes", "no", "unknown"] as const).map(value => <Choice key={value} tone={section.tone} selected={filters[section.key] === value} onClick={() => onChange({ ...filters, [section.key]: filters[section.key] === value ? "all" : value })}>{triLabels[value]}</Choice>)}</div></FilterSection>)}</div>
      </div>
    </VolunteerSideSheet>
  </>;
}
