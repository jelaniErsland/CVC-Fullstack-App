"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Trash2, X } from "lucide-react";
import type { VolunteerDeletionInput, VolunteerDeletionOutcome, VolunteerDeletionReviewResult } from "@/lib/volunteers/deletion";
import { containVolunteerSheetFocus } from "@/lib/volunteers/sheetFocus";
import { withReadTimeout } from "@/lib/readTimeout";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50";
export function DeleteVolunteerDialog({ profileId, name, review, remove, onCancel, onDeleted }: {
  profileId: string; name: string;
  review: (id: string) => Promise<VolunteerDeletionReviewResult>;
  remove: (input: VolunteerDeletionInput) => Promise<VolunteerDeletionOutcome>;
  onCancel: () => void; onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null);
  const [result, setResult] = useState<VolunteerDeletionReviewResult | null>(null);
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const mounted = useRef(true);
  useLayoutEffect(() => {
    const previous = document.activeElement, node = dialog.current;
    node?.showModal(); cancel.current?.focus();
    return () => { node?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    void withReadTimeout(review(profileId)).then(value => { if (current) setResult(value); }).catch(() => { if (current) setResult({ kind: "error" }); });
    return () => { current = false; };
  }, [profileId, review, revision]);
  const reload = () => { setResult(null); setError(""); setRevision(value => value + 1); };
  const confirm = async () => {
    if (busy || result?.kind !== "review" || !result.canDelete) return;
    setBusy(true); setError("");
    // Do not abort a mutation or call a timeout a failure. Its acknowledgement
    // may be lost; a fresh review safely checks the same identity before retry.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const outcome = await Promise.race([remove({ profileId, version: result.version, fingerprint: result.fingerprint }), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 25_000); })]);
      if (!mounted.current) return;
      if (outcome?.kind === "deleted" || outcome?.kind === "already_deleted") { onDeleted(); return; }
      setResult(null);
      setError(outcome?.kind === "rejected" && outcome.reason === "changed" ? "The profile or assignments changed. Review the latest impact before deleting." : outcome?.kind === "rejected" && outcome.reason === "permission" ? "Deletion is unavailable with your current access. Review again or contact the project coordinator." : "Deletion could not be confirmed. Review the current state before retrying; it may already have completed.");
    } catch { if (mounted.current) { setResult(null); setError("Deletion could not be confirmed. Review the current state before retrying."); } }
    finally { clearTimeout(timer); if (mounted.current) setBusy(false); }
  };
  return <dialog ref={dialog} aria-labelledby="delete-volunteer-title" aria-describedby="delete-volunteer-description" aria-busy={busy}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-rose-100 bg-[#fffdfa] p-5 text-[#0b1733] shadow-xl backdrop:bg-slate-950/30 sm:p-6"
    onKeyDown={containVolunteerSheetFocus} onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onCancel(); }}>
    <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Remove from project</p><h2 id="delete-volunteer-title" className="mt-2 text-xl font-semibold">Delete {name}?</h2></div><button type="button" aria-label="Close delete confirmation" disabled={busy} onClick={onCancel} className={`${button} size-11 shrink-0 border-transparent px-0`}><X aria-hidden className="size-5" /></button></header>
    <div id="delete-volunteer-description" className="mt-4 space-y-3 text-sm leading-6 text-slate-600"><p>This removes {name} from this project and prevents future assignments, access, reminders, and communications.</p><p>Past schedule and communication history will remain for project records. This cannot be undone in the app.</p></div>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">{error}</p> : null}
    {!result && !error ? <p role="status" className="mt-4 text-sm">Checking current assignments…</p> : null}
    {result?.kind === "review" ? <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm leading-6"><p className="font-semibold">{result.affectedCount ? `${result.affectedCount} current/upcoming assignment${result.affectedCount === 1 ? "" : "s"} will be removed.` : "No current or upcoming assignments will be removed."}</p>{result.affectedCount > 0 ? <p>Those staffing positions will become open.</p> : null}{result.nearest ? <p className="mt-1 text-slate-600">Nearest: {result.nearest.title} · {result.nearest.date}</p> : null}{!result.canDelete ? <p className="mt-2 text-amber-950">Assignment viewing and editing access is also required to remove current or upcoming work.</p> : null}</div> : null}
    {result?.kind === "already_deleted" ? <p role="status" className="mt-4 text-sm">This volunteer is already unavailable. Close this message to update the directory.</p> : null}
    {result?.kind === "error" || result?.kind === "unavailable" ? <p role="alert" className="mt-4 text-sm text-amber-950">The deletion review is unavailable. Nothing has been changed by this review.</p> : null}
    <footer className="mt-6 flex flex-wrap justify-end gap-2"><button ref={cancel} className={`${button} border-slate-200 bg-white`} type="button" disabled={busy} onClick={result?.kind === "already_deleted" ? onDeleted : onCancel}>{result?.kind === "already_deleted" ? "Close and update directory" : "Cancel"}</button>{error || result?.kind === "error" || result?.kind === "unavailable" ? <button className={`${button} border-blue-200 text-blue-800`} type="button" onClick={reload}>Review again</button> : result?.kind === "review" && result.canDelete ? <button className={`${button} border-rose-700 bg-rose-700 text-white hover:bg-rose-800`} type="button" disabled={busy} onClick={() => void confirm()}><Trash2 aria-hidden className="size-4" />{busy ? "Deleting…" : "Delete volunteer"}</button> : null}</footer>
  </dialog>;
}
