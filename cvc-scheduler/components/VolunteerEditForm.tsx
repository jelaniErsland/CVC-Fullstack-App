"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { VolunteerProfile } from "@/lib/volunteers/profile";
import type { VolunteerUpdateResult } from "@/lib/volunteers/updateResult";
import { useVolunteerFormDirty } from "@/hooks/useVolunteerFormDirty";
import styles from "./VolunteerSideSheet.module.css";
import { Button } from "./Button";
import { VolunteerFields } from "./VolunteerCard";

const rejectionCopy: Record<Extract<VolunteerUpdateResult, { kind: "rejected" }>["reason"], string> = {
  unavailable: "Editing is unavailable for this signed-in contact. Your changes have not been saved.",
  validation: "Check the volunteer details and try again. Your changes have not been saved.",
  conflict: "This profile changed while you were editing it. Your edits are still here. Return to the profile to review the latest version.",
  error: "We couldn’t confirm this change. Your edits are still here. Review the latest profile before retrying.",
};

export function VolunteerEditForm({ volunteer, updateAction, secondaryAction, onCancel, onDirty, onSaved, onPending }: {
  volunteer: VolunteerProfile;
  updateAction: (formData: FormData) => Promise<VolunteerUpdateResult>;
  secondaryAction?: ReactNode;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
  onSaved: (volunteer: VolunteerProfile) => void;
  onPending?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const formRef = useVolunteerFormDirty(onDirty);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Exclude<VolunteerUpdateResult, { kind: "updated" }>["reason"] | null>(null);
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFailure(null);
    setPending(true);
    onPending?.(true);
    let result: VolunteerUpdateResult;
    try {
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        result = await Promise.race([updateAction(new FormData(event.currentTarget)), new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error("Volunteer save confirmation timed out")), 25000); })]);
      } finally { clearTimeout(deadline); }
    } catch {
      if (activeRef.current) { setFailure("error"); router.refresh(); }
      return;
    } finally {
      if (activeRef.current) { setPending(false); onPending?.(false); }
    }
    if (!activeRef.current) return;
    if (result.kind === "rejected") {
      setFailure(result.reason);
      if (result.reason === "conflict" || result.reason === "error") router.refresh();
      return;
    }
    onSaved(result.volunteer);
    router.refresh();
  }

  return <form ref={formRef} className={styles.form} onChange={() => setFailure(null)} onSubmit={submit}>
    <input name="profileId" type="hidden" value={volunteer.id} />
    <div className={styles.formFields} data-sheet-scroll="volunteer editor">
    <fieldset className="grid min-w-0 gap-4" disabled={pending}>
      <VolunteerFields volunteer={volunteer} />
    </fieldset>
    {secondaryAction}
    </div>
    <div className={styles.formFooter}>
      {failure ? <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{rejectionCopy[failure]}</p> : null}
      <div className="flex gap-3">
        <button className="min-h-11 rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] px-4 text-sm font-semibold text-[var(--pl-text)]" onClick={onCancel} type="button">Cancel</button>
        <Button className="min-h-11 flex-1" pending={pending} pendingLabel="Saving…" type="submit">Save changes</Button>
      </div>
    </div>
  </form>;
}
