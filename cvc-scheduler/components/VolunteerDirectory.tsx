"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { MobileOverlaySheet } from "./MobileOverlaySheet";
import { VolunteerCard, VolunteerFields } from "./VolunteerCard";
import type { VolunteerProfile } from "@/lib/volunteers/profile";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

type VolunteerDirectoryProps = {
  volunteers: readonly VolunteerProfile[];
  congregations: string[];
  canEdit: boolean;
  createAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  updateAction?: (formData: FormData) => void | Promise<void>;
};

const lifecycles: Array<VolunteerProfile["lifecycle"] | "all"> = [
  "all",
  "active",
  "inactive",
  "archived",
];

export function VolunteerDirectory({
  canEdit,
  createAction,
  deleteAction,
  updateAction,
  volunteers,
  congregations,
}: VolunteerDirectoryProps) {
  const [query, setQuery] = useState("");
  const [congregation, setCongregation] = useState("all");
  const [lifecycle, setLifecycle] = useState<VolunteerProfile["lifecycle"] | "all">("all");
  const [mobileEditor, setMobileEditor] = useState<
    { kind: "add" } | { kind: "edit"; volunteer: VolunteerProfile } | null
  >(null);
  const [deleteCandidate, setDeleteCandidate] = useState<VolunteerProfile | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  useBodyScrollLock(deleteCandidate !== null);

  useEffect(() => {
    if (!deleteCandidate) return;
    const frame = window.requestAnimationFrame(() => deleteCancelRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteCandidate(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [deleteCandidate]);

  const filteredVolunteers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return volunteers.filter((volunteer) => {
      const matchesCongregation =
        congregation === "all" || volunteer.congregation === congregation;
      const matchesLifecycle = lifecycle === "all" || volunteer.lifecycle === lifecycle;
      const searchableText = [
        volunteer.fullName,
        volunteer.email,
        volunteer.phone,
        volunteer.congregation,
        volunteer.lifecycle,
        volunteer.readinessStatus,
        volunteer.profileNotes,
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return matchesCongregation && matchesLifecycle && matchesQuery;
    });
  }, [congregation, lifecycle, query, volunteers]);

  const addForm = canEdit && createAction ? (
    <>
      <button
        className="m-3 inline-flex min-h-[42px] items-center rounded-[var(--pl-radius-control)] bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,105,255,0.18)] hover:bg-[var(--pl-blue-deep)] sm:hidden"
        onClick={() => setMobileEditor({ kind: "add" })}
        type="button"
      >
        + Add volunteer
      </button>
      <details className="group hidden border-b border-[var(--pl-border)] bg-white sm:block">
        <summary className="m-4 inline-flex min-h-[42px] cursor-pointer list-none items-center rounded-[var(--pl-radius-control)] bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,105,255,0.18)] marker:hidden hover:bg-[var(--pl-blue-deep)]">
          + Add volunteer
        </summary>
        <div className="border-t border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-5">
          <p className="max-w-2xl text-sm leading-6 text-[var(--pl-text)]">
            Saving does not send a message.
          </p>
          <form action={createAction} className="mt-4 grid gap-4">
            <VolunteerFields />
            <Button className="mt-1 w-full sm:w-auto" type="submit">
              Save volunteer
            </Button>
          </form>
        </div>
      </details>
    </>
  ) : (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
      Volunteer profile editing is unavailable for this signed-in contact.
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)]">
      {addForm}
      <div className="border-b border-[var(--pl-border)] bg-white p-3 sm:p-4">
      <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_190px_160px]">
        <label className="block">
          <span className="sr-only">Search</span>
          <input
            className="min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] px-3.5 text-sm text-[var(--pl-ink)] outline-none transition placeholder:text-[var(--pl-muted)] focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search volunteers"
            type="search"
            value={query}
          />
        </label>

        <label className="block">
          <span className="sr-only">Congregation</span>
          <select
            className="min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white px-3 text-sm font-medium text-[var(--pl-text)] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setCongregation(event.target.value)}
            value={congregation}
          >
            <option value="all">All congregations</option>
            {congregations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Status</span>
          <select
            className="min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white px-3 text-sm font-medium text-[var(--pl-text)] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            onChange={(event) =>
              setLifecycle(event.target.value as VolunteerProfile["lifecycle"] | "all")
            }
            value={lifecycle}
          >
            {lifecycles.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All statuses" : item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--pl-muted)]">
        <p>
          {filteredVolunteers.length} of {volunteers.length} volunteers
        </p>
        {(query || congregation !== "all" || lifecycle !== "all") && (
          <button
            className="rounded-lg px-2.5 py-1.5 font-semibold text-[var(--pl-blue)] transition hover:bg-[var(--pl-blue-soft)]"
            onClick={() => {
              setQuery("");
              setCongregation("all");
              setLifecycle("all");
            }}
            type="button"
          >
            Clear
          </button>
        )}
      </div>
      </div>

      {filteredVolunteers.length > 0 ? (
        <section className="divide-y divide-[var(--pl-border)]">
          {filteredVolunteers.map((volunteer) => (
            <VolunteerCard
              canEdit={canEdit}
              key={volunteer.id}
              onDeleteRequest={deleteAction ? () => setDeleteCandidate(volunteer) : undefined}
              onMobileEdit={() => setMobileEditor({ kind: "edit", volunteer })}
              updateAction={updateAction}
              volunteer={volunteer}
            />
          ))}
        </section>
      ) : (
        <div>
          <EmptyState
            title={volunteers.length === 0 ? "No volunteers yet" : "No search results"}
            message={
              volunteers.length === 0
                ? "Add a manual volunteer profile when a Bozeman helper is ready to be scheduled."
                : "Try a different name, congregation, lifecycle, phone number, or note."
            }
          />
        </div>
      )}

      <MobileOverlaySheet
        description={mobileEditor?.kind === "add" ? "Saving does not send a message." : undefined}
        label="volunteer editor"
        onClose={() => setMobileEditor(null)}
        open={mobileEditor !== null}
        title={mobileEditor?.kind === "edit" ? "Edit volunteer" : "Add volunteer"}
      >
        {mobileEditor?.kind === "edit" && updateAction ? (
          <>
            <form action={updateAction} className="grid gap-4">
              <input
                name="profileId"
                type="hidden"
                value={mobileEditor.volunteer.id}
              />
              <VolunteerFields volunteer={mobileEditor.volunteer} />
              <Button className="mt-1 w-full" type="submit">
                Save changes
              </Button>
            </form>
            {deleteAction ? (
              <div
                className="mt-5 border-t border-[var(--pl-border)] pt-4"
              >
                <button
                  className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--pl-radius-control)] border border-rose-200 text-sm font-semibold text-rose-700"
                  onClick={() => {
                    setDeleteCandidate(mobileEditor.volunteer);
                    setMobileEditor(null);
                  }}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Delete volunteer
                </button>
              </div>
            ) : null}
          </>
        ) : mobileEditor?.kind === "add" && createAction ? (
          <form action={createAction} className="grid gap-4">
            <VolunteerFields />
            <Button className="mt-1 w-full" type="submit">
              Save volunteer
            </Button>
          </form>
        ) : null}
      </MobileOverlaySheet>
      {deleteCandidate && deleteAction ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button aria-label="Close delete confirmation backdrop" className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={() => setDeleteCandidate(null)} tabIndex={-1} type="button" />
          <section aria-label={`Delete ${deleteCandidate.fullName}`} aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-[var(--pl-border)] bg-white p-5 shadow-[var(--pl-shadow-raised)]" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">Permanent removal</p>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[var(--pl-ink)]">Delete {deleteCandidate.fullName}?</h2>
              </div>
              <button aria-label="Close delete confirmation" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => setDeleteCandidate(null)} type="button">
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--pl-text)]">Only volunteers with no scheduling history can be deleted.</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
              <button ref={deleteCancelRef} className="min-h-11 rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white px-4 text-sm font-semibold text-[var(--pl-text)]" onClick={() => setDeleteCandidate(null)} type="button">Cancel</button>
              <form action={deleteAction}>
                <input name="profileId" type="hidden" value={deleteCandidate.id} />
                <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--pl-radius-control)] border border-rose-300 bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700" type="submit">
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Delete permanently
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
