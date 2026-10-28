"use client";
import { useVolunteerFormDirty } from "@/hooks/useVolunteerFormDirty";
import { VolunteerFields } from "./VolunteerCard";
import { VolunteerAddSubmit } from "./VolunteerAddSubmit";
import styles from "./VolunteerSideSheet.module.css";

export function VolunteerAddForm({ action, onDirty, onPending }: {
  action: (data: FormData) => void | Promise<void>;
  onDirty: (dirty: boolean) => void;
  onPending: (pending: boolean) => void;
}) {
  const ref = useVolunteerFormDirty(onDirty);
  return <form ref={ref} action={action} className={styles.form}>
    <div className={styles.formFields} data-sheet-scroll="volunteer editor"><div className="grid gap-4"><VolunteerFields /></div></div>
    <VolunteerAddSubmit onPending={onPending} />
  </form>;
}
