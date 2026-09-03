"use client";

import { Check, Copy, Link2, ShieldOff } from "lucide-react";
import { useActionState, useState } from "react";

import {
  manageQuickViewShareAction,
  type QuickViewShareActionState,
} from "@/app/admin/quick-view/actions";

function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled: boolean }) {
  return (
    <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60" disabled={disabled} type="submit">
      {children}
    </button>
  );
}

export function ProjectQuickViewShareControl({
  initialState,
  projectKey,
}: {
  initialState: QuickViewShareActionState;
  projectKey: string;
}) {
  const [state, action, isPending] = useActionState(
    manageQuickViewShareAction,
    initialState,
  );
  const [copied, setCopied] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const createLabel = state.activeLinkCount > 0 ? "Create new link" : "Create share link";

  async function copyLink() {
    if (!state.accessPath) return;
    await navigator.clipboard.writeText(new URL(state.accessPath, window.location.origin).toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section aria-labelledby="quick-view-share-title" className="mt-4 rounded-[var(--pl-radius-panel)] border border-blue-100 bg-blue-50/45 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
            <Link2 aria-hidden="true" className="size-3.5" />
            Share
          </p>
          <h2 className="mt-1 text-lg font-bold text-[var(--pl-ink)]" id="quick-view-share-title">
            Share this Quick View
          </h2>
          <p className="mt-1 text-sm leading-5 text-[var(--pl-text)]">
            Anyone with the link can view this project’s daily schedule and expected attendance until the project ends.
          </p>
        </div>

        {state.accessPath ? (
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={copyLink}
            type="button"
          >
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        ) : (
          <form action={action}>
            <input name="project" type="hidden" value={projectKey} />
            <input name="operation" type="hidden" value="create" />
            <SubmitButton disabled={isPending}>
              <Link2 aria-hidden="true" className="size-4" />
              {isPending ? "Creating…" : createLabel}
            </SubmitButton>
          </form>
        )}
      </div>

      {state.status !== "idle" ? (
        <p aria-live="polite" className={`mt-3 text-sm font-semibold ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>
          {state.message}
        </p>
      ) : null}

      {state.enabled ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-blue-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--pl-muted)]">
            Shared access is on until this project ends.
            {` ${state.activeLinkCount} active ${state.activeLinkCount === 1 ? "link" : "links"}.`}
          </p>
          {confirmDisable ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--pl-text)]">Existing links will stop working.</span>
              <form action={action}>
                <input name="project" type="hidden" value={projectKey} />
                <input name="operation" type="hidden" value="disable" />
                <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-700 px-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2" disabled={isPending} type="submit">
                  <ShieldOff aria-hidden="true" className="size-4" />
                  Disable now
                </button>
              </form>
              <button className="min-h-10 rounded-xl px-3 text-xs font-semibold text-[var(--pl-text)] hover:bg-white" onClick={() => setConfirmDisable(false)} type="button">
                Keep sharing
              </button>
            </div>
          ) : (
            <button className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[var(--pl-muted)] transition hover:bg-white hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => setConfirmDisable(true)} type="button">
              <ShieldOff aria-hidden="true" className="size-4" />
              Disable shared access
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
