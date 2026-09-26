"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { VolunteerProfile } from "@/lib/volunteers/profile";
import type { VolunteerUpdateResult } from "@/lib/volunteers/updateResult";
import { Button } from "./Button";
import { VolunteerFields } from "./VolunteerCard";

const rejectionCopy: Record<Extract<VolunteerUpdateResult, { kind: "rejected" }>["reason"], string> = {
  unavailable: "Editing is unavailable for this signed-in contact. Your changes have not been saved.",
  validation: "Check the volunteer details and try again. Your changes have not been saved.",
  conflict: "This profile changed while you were editing it. Review the latest version before saving again.",
  error: "The volunteer change was not saved. Please try again.",
};

export function VolunteerEditForm({ volunteer, updateAction, mobile, onCancel, onDirty, onSaved }: {
  volunteer: VolunteerProfile;
  updateAction: (formData: FormData) => Promise<VolunteerUpdateResult>;
  mobile: boolean;
  onCancel: () => void;
  onDirty: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
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
    let result: VolunteerUpdateResult;
    try {
      result = await updateAction(new FormData(event.currentTarget));
    } catch {
      if (activeRef.current) setFailure("error");
      return;
    } finally {
      if (activeRef.current) setPending(false);
    }
    if (!activeRef.current) return;
    if (result.kind === "rejected") {
      setFailure(result.reason);
      return;
    }
    onSaved();
    router.replace("/admin/volunteers?notice=updated");
  }

  return <form className={mobile ? "grid gap-4" : "flex min-h-0 flex-1 flex-col"} onChange={() => { onDirty(); setFailure(null); }} onSubmit={submit}>
    <input name="profileId" type="hidden" value={volunteer.id} />
    <fieldset className={mobile ? "contents" : "min-h-0 flex-1 overflow-y-auto p-5"} disabled={pending}>
      <VolunteerFields volunteer={volunteer} />
    </fieldset>
    <div className={mobile ? "sticky bottom-0 z-10 -mx-4 border-t border-[var(--pl-border)] bg-white px-4 py-3 shadow-[0_-10px_24px_rgba(15,23,42,.06)]" : "sticky bottom-0 border-t border-[var(--pl-border)] bg-white px-5 py-4"}>
      {failure ? <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{rejectionCopy[failure]}</p> : null}
      <div className="flex gap-3">
        <button className="min-h-11 rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] px-4 text-sm font-semibold text-[var(--pl-text)]" onClick={onCancel} type="button">Cancel</button>
        <Button className="min-h-11 flex-1" pending={pending} pendingLabel="Saving…" type="submit">Save changes</Button>
      </div>
    </div>
  </form>;
}
