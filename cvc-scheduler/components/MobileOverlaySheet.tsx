"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusContainment } from "@/hooks/useFocusContainment";

type MobileOverlaySheetProps = Readonly<{
  children: ReactNode;
  description?: string;
  label: string;
  onClose: () => void;
  open: boolean;
  title: string;
}>;

export function MobileOverlaySheet({
  children,
  description,
  label,
  onClose,
  open,
  title,
}: MobileOverlaySheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useBodyScrollLock(open, "(max-width: 639px)");
  useFocusContainment(open, dialogRef);

  useEffect(() => {
    if (!open) {
      return;
    }

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      const trigger = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (trigger?.isConnected) {
          trigger.focus();
        }
      });
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:hidden">
      <button
        aria-label={`Close ${label} backdrop`}
        className="absolute inset-0 bg-slate-950/28 backdrop-blur-[2px]"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <section
        aria-label={label}
        aria-modal="true"
        className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-raised)]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--pl-border)] bg-white px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-[-0.025em] text-[var(--pl-ink)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-5 text-[var(--pl-text)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label={`Close ${label}`}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--pl-muted)] transition hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>
        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
          data-overlay-scroll={label}
        >
          {children}
        </div>
      </section>
    </div>
  );
}
