"use client";

import { CalendarDays, Check, Filter, HeartHandshake, Search, ShieldCheck, Sparkles, Users, X } from "lucide-react";
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
  skills: readonly string[];
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

export function VolunteerFilters({ query, onQueryChange, filters, onChange, congregations, skills, resultCount, total, sortControl }: Props) {
  const [open, setOpen] = useState(false);
  const [congregationQuery, setCongregationQuery] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const count = directoryCategoryCount(filters);
  const resultCopy = directoryResultCopy(query, count);
  const reset = () => { onChange(emptyDirectoryFilters()); onQueryChange(""); };
  const chips: { category: keyof DirectoryFilters; value: string; label: string }[] = [
    ...filters.statuses.map(value => ({ category: "statuses" as const, value, label: labels[value] })),
    ...filters.congregations.map(value => ({ category: "congregations" as const, value, label: value })),
    ...filters.days.map(value => ({ category: "days" as const, value, label: value.slice(0, 3) })),
    ...filters.skills.map(value => ({ category: "skills" as const, value, label: value })),
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
        <FilterSection title="Congregation" icon={<Users />} active={filters.congregations.length > 0} onClear={() => onChange({ ...filters, congregations: [] })}><label><span className="sr-only">Search congregations</span><input className={styles.input} type="search" placeholder="Find a congregation…" value={congregationQuery} onChange={event => setCongregationQuery(event.target.value)} /></label><div className={styles.choiceList} role="group" aria-label="Congregation">{congregations.filter(value => matches(value, congregationQuery)).map(value => <Choice key={value} selected={filters.congregations.includes(value)} onClick={() => onChange({ ...filters, congregations: removeOrAppend(filters.congregations, value) })}>{value}</Choice>)}</div>{!congregations.some(value => matches(value, congregationQuery)) && <p className={styles.hint}>No recorded congregations match.</p>}<p className={styles.hint}>Volunteers from any selected congregation.</p></FilterSection>
        <FilterSection title="Availability" icon={<CalendarDays />} tone="warm" active={filters.days.length > 0} onClear={() => onChange({ ...filters, days: [] })}><div className={styles.days} role="group" aria-label="Available weekdays">{volunteerWeekdays.map(day => <button className={styles.option} data-tone="warm" type="button" key={day} aria-label={day} aria-pressed={filters.days.includes(day)} onClick={() => onChange({ ...filters, days: removeOrAppend(filters.days, day) })}>{filters.days.includes(day) && <Check aria-hidden="true" />}{day.slice(0, 3).toUpperCase()}</button>)}</div><p className={styles.hint}>Available on any of these days. Recorded weekday preferences, not date-specific availability.</p></FilterSection>
        <FilterSection title="Skills" icon={<Sparkles />} tone="violet" active={filters.skills.length > 0} onClear={() => onChange({ ...filters, skills: [] })}><label><span className="sr-only">Search skills</span><input className={styles.input} type="search" placeholder="Find a recorded skill…" value={skillQuery} onChange={event => setSkillQuery(event.target.value)} /></label><div className={styles.choiceList} role="group" aria-label="Skills">{skills.filter(value => matches(value, skillQuery)).map(skill => <Choice key={skill} tone="violet" selected={filters.skills.includes(skill)} onClick={() => onChange({ ...filters, skills: removeOrAppend(filters.skills, skill) })}>{skill}</Choice>)}</div><p className={styles.hint}>{skills.length ? "Volunteers must have every selected skill recorded." : "No structured skills are recorded in this directory yet. Skills and experience notes are still searchable."}</p>{skills.length > 0 && !skills.some(value => matches(value, skillQuery)) && <p className={styles.hint}>No recorded skills match this search.</p>}</FilterSection>
        <div role="group" aria-label="Other criteria" className={styles.otherCriteria}><h3>Other criteria</h3>{([{ key: "security", title: "After-hours security", icon: <ShieldCheck />, tone: "teal" }, { key: "twoPlusDays", title: "Two or more days a week", icon: <CalendarDays />, tone: "warm" }, { key: "housing", title: "Housing support", icon: <HeartHandshake />, tone: "blue" }] as const).map(section => <FilterSection key={section.key} title={section.title} icon={section.icon} tone={section.tone} active={filters[section.key] !== "all"} onClear={() => onChange({ ...filters, [section.key]: "all" })}><div className={styles.options} role="group" aria-label={section.title}>{(["yes", "no", "unknown"] as const).map(value => <Choice key={value} tone={section.tone} selected={filters[section.key] === value} onClick={() => onChange({ ...filters, [section.key]: filters[section.key] === value ? "all" : value })}>{triLabels[value]}</Choice>)}</div></FilterSection>)}</div>
      </div>
    </VolunteerSideSheet>
  </>;
}
