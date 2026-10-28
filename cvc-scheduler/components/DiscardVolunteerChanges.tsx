"use client";

import { useLayoutEffect, useRef } from "react";
import { containVolunteerSheetFocus } from "@/lib/volunteers/sheetFocus";
import styles from "./VolunteerFilters.module.css";

export function DiscardVolunteerChanges({ open, onKeep, onDiscard }: { open: boolean; onKeep: () => void; onDiscard: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialog.showModal(); keep.current?.focus();
    return () => dialog.close();
  }, [open]);
  return <dialog ref={ref} aria-labelledby="discard-volunteer-title" aria-describedby="discard-volunteer-description" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-blue-100 bg-[#fffdfa] p-6 text-[#0b1733] shadow-xl backdrop:bg-slate-950/30"
    onKeyDown={containVolunteerSheetFocus}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onKeep(); }}>
    <h2 id="discard-volunteer-title" className="text-xl font-semibold tracking-tight">Discard unsaved changes?</h2>
    <p id="discard-volunteer-description" className="mt-3 text-sm leading-6 text-slate-600">You have changes that haven’t been saved.</p>
    <div className="mt-5 flex flex-wrap gap-2"><button ref={keep} className={`${styles.button} ${styles.primary}`} type="button" onClick={onKeep}>Keep editing</button><button className={`${styles.button} border-rose-200 text-rose-800`} type="button" onClick={onDiscard}>Discard changes</button></div>
  </dialog>;
}
