"use client";

import { ArrowDownWideNarrow, Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { directorySortOptions, type DirectorySort } from "@/lib/volunteers/directorySort";
import styles from "./VolunteerFilters.module.css";

export function VolunteerSort({ value, onChange }: { value: DirectorySort; onChange: (value: DirectorySort) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div ref={root} className={styles.sortHost} onKeyDown={event => {
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault(); const choices = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
      const current = choices.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === "Home" ? 0 : event.key === "End" ? choices.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length;
      choices[index]?.focus();
    }
    if (event.key === "Tab") setOpen(false);
  }}>
    <button type="button" ref={trigger} className={`${styles.button} ${styles.sortButton}`} aria-label={`Sort: ${directorySortOptions[value]}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(current => !current)}><ArrowDownWideNarrow aria-hidden="true" /><span>{directorySortOptions[value]}</span></button>
    {open && <div role="menu" aria-label="Sort volunteers" id={id} className={styles.sortMenu}>{Object.entries(directorySortOptions).map(([key, label]) => <button type="button" role="menuitemradio" aria-checked={key === value} className={styles.sortOption} key={key} onClick={() => { onChange(key as DirectorySort); close(); }}><span>{label}</span>{key === value && <Check aria-hidden="true" />}</button>)}</div>}
  </div>;
}
