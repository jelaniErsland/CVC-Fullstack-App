"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import styles from "./VolunteerSideSheet.module.css";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

// Deliberately scoped to volunteer surfaces. Native modal semantics make the
// background inert and contain focus, including a nested discard confirmation.
export function VolunteerSideSheet({ open, title, description, label, icon, action, footer, wide = false, onRequestClose, children }: {
  open: boolean; title: string; description?: string; label: string; icon?: ReactNode;
  action?: ReactNode; footer?: ReactNode; wide?: boolean; children: ReactNode;
  onRequestClose: () => void;
}) {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  useBodyScrollLock(open);
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal();
    node.querySelector<HTMLButtonElement>("[data-sheet-close]")?.focus();
    return () => {
      node.close();
      const target = trigger.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('main [data-admin-shortcut="search"]')?.focus({ preventScroll: true });
    };
  }, [open, mounted]);
  if (!mounted) return null;
  return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-label={label}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onRequestClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onRequestClose(); }}>
    <section className={styles.panel} data-wide={wide || undefined}>
      <header className={styles.header}>
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
        <div className="min-w-0 flex-1"><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
        {action}
        <button data-sheet-close aria-label={`Close ${label}`} className={styles.close} onClick={onRequestClose} type="button"><X aria-hidden="true" /></button>
      </header>
      <div className={styles.body} data-sheet-scroll={label}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </section>
  </dialog>, document.body);
}
