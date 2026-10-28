"use client";

import { useId, useState } from "react";
import type { ExperienceMatch } from "@/lib/volunteers/experience";
import styles from "./VolunteerFilters.module.css";

function Highlight({ text, terms }: { text: string; terms: readonly string[] }) {
  const escaped = [...terms].sort((a, b) => b.length - a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return text;
  const matches: RegExpExecArray[] = [];
  for (const match of text.matchAll(new RegExp(escaped.join("|"), "gi"))) { matches.push(match); if (matches.length === 6) break; }
  let cursor = 0;
  const parts = matches.map(match => { const start = match.index; const prefix = text.slice(cursor, start); cursor = start + match[0].length; return <span key={start}>{prefix}<mark className={styles.matchHighlight}>{match[0]}</mark></span>; });
  return <>{parts}{text.slice(cursor)}</>;
}
function Response({ match }: { match: ExperienceMatch }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return <div className={styles.matchResponse}>
    <p className={styles.sourceLabel}>{match.source.label}</p>
    <p className={styles.matchText} id={id}><Highlight text={expanded ? match.source.text : match.excerpt} terms={match.terms} /></p>
    {match.excerpt !== match.source.text && <button className={`${styles.button} ${styles.quiet}`} type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{expanded ? "Show less" : "Show full response"}<span className="sr-only">: {match.source.label}</span></button>}
  </div>;
}
export function VolunteerExperienceMatch({ matches }: { matches: readonly ExperienceMatch[] }) {
  return <section className={styles.matchArea} aria-label="Skills and experience match">
    <h3>Skills &amp; experience</h3>
    {matches.map(match => <Response key={`${match.source.kind}:${match.terms.join("|")}`} match={match} />)}
    <p className={styles.matchTerms}>Matched text: {Array.from(new Set(matches.flatMap(match => match.terms))).map(term => `“${term}”`).join(" · ")}</p>
  </section>;
}
