"use client";
import { useLayoutEffect, useEffectEvent } from "react";
import { useFormStatus } from "react-dom";
import styles from "./VolunteerSideSheet.module.css";
import { Button } from "./Button";

export function VolunteerAddSubmit({ onPending }: { onPending: (pending: boolean) => void }) {
  const { pending } = useFormStatus();
  const notify = useEffectEvent(onPending);
  useLayoutEffect(() => { notify(pending); return () => notify(false); }, [pending]);
  return <div className={styles.formFooter}><Button className="min-h-11 w-full" pending={pending} pendingLabel="Saving…" type="submit">Save volunteer</Button></div>;
}
