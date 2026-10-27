"use client";

import { Pencil, SearchX, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { MobileOverlaySheet } from "./MobileOverlaySheet";
import { VolunteerCard, VolunteerFields } from "./VolunteerCard";
import { VolunteerCsvTools } from "./VolunteerCsvTools";
import type { VolunteerProfile } from "@/lib/volunteers/profile";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import { VolunteerProfileView } from "./VolunteerProfileView";
import { VolunteerEditForm } from "./VolunteerEditForm";
import { VolunteerFilters } from "./VolunteerFilters";
import { emptyDirectoryFilters, filterDirectory, indexDirectory, type DirectoryFilters } from "@/lib/volunteers/directoryFilters";
import filterStyles from "./VolunteerFilters.module.css";
import type { VolunteerScheduleResult } from "@/lib/volunteers/schedule.server";
import type { VolunteerUpdateResult } from "@/lib/volunteers/updateResult";

type VolunteerDirectoryProps = {
  volunteers: readonly VolunteerProfile[];
  congregations: string[];
  canEdit: boolean;
  canCommunicate?: boolean;
  canViewSchedule: boolean;
  workspaceTimezone: string;
  workspaceKey: string;
  readScheduleAction: (profileId: string) => Promise<VolunteerScheduleResult>;
  createAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (formData: FormData) => void | Promise<void>;
  updateAction?: (formData: FormData) => Promise<VolunteerUpdateResult>;
};

export function VolunteerDirectory({
  canEdit,
  canCommunicate = false,
  canViewSchedule,
  workspaceTimezone,
  workspaceKey,
  readScheduleAction,
  createAction,
  deleteAction,
  updateAction,
  volunteers,
  congregations,
}: VolunteerDirectoryProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DirectoryFilters>(emptyDirectoryFilters);
  const [desktopAddOpen, setDesktopAddOpen] = useState(false);
  const [mobileEditor, setMobileEditor] = useState<
    { kind: "add" } | { kind: "view" | "edit"; volunteer: VolunteerProfile } | null
  >(null);
  const [schedule, setSchedule] = useState<VolunteerScheduleResult | null>(null);
  const dirtyRef = useRef(false);
  const desktopDrawerRef = useRef<HTMLElement>(null);
  const desktopCloseRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const scheduleRequestRef = useRef(0);
  const [deleteCandidate, setDeleteCandidate] = useState<VolunteerProfile | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  useBodyScrollLock(deleteCandidate !== null);
  useBodyScrollLock(mobileEditor !== null, "(min-width: 640px)");
  useFocusContainment(mobileEditor !== null, desktopDrawerRef);

  const closeEditor = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Discard unsaved volunteer changes?")) return;
    scheduleRequestRef.current += 1;
    setMobileEditor(null);
    dirtyRef.current = false;
    window.requestAnimationFrame(() => returnFocusRef.current?.isConnected && returnFocusRef.current.focus());
  }, []);
  const completeEdit = () => {
    dirtyRef.current = false;
    closeEditor();
  };
  const loadSchedule = useCallback((profileId: string) => {
    const request = ++scheduleRequestRef.current;
    if (!canViewSchedule) { setSchedule({ kind: "unavailable" }); return; }
    setSchedule(null);
    void readScheduleAction(profileId).then(result => { if (request === scheduleRequestRef.current) setSchedule(result); }).catch(() => { if (request === scheduleRequestRef.current) setSchedule({ kind: "error" }); });
  }, [canViewSchedule, readScheduleAction]);
  const openVolunteer = (volunteer: VolunteerProfile, kind: "view" | "edit") => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dirtyRef.current = false;
    setMobileEditor({ kind, volunteer });
    if (kind === "view") loadSchedule(volunteer.id);
  };
  const showProfile = () => {
    if (mobileEditor?.kind !== "edit") return;
    if (dirtyRef.current && !window.confirm("Discard unsaved volunteer changes?")) return;
    dirtyRef.current = false;
    setMobileEditor({ kind: "view", volunteer: mobileEditor.volunteer });
    loadSchedule(mobileEditor.volunteer.id);
  };
  useEffect(() => {
    if (mobileEditor?.kind !== "edit") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mobileEditor]);
  useEffect(() => {
    if (!mobileEditor) return;
    const frame = window.requestAnimationFrame(() => desktopCloseRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && window.innerWidth >= 640) closeEditor(); };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", onKeyDown); };
  }, [mobileEditor, closeEditor]);
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: workspaceTimezone }).format(new Date());

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

  const directoryIndex = useMemo(() => indexDirectory(volunteers), [volunteers]);
  const skillOptions = useMemo(() => [...new Set(directoryIndex.flatMap(entry => entry.skills))].sort((a, b) => a.localeCompare(b)), [directoryIndex]);
  const filteredEntries = useMemo(() => filterDirectory(directoryIndex, query, filters), [directoryIndex, query, filters]);
  const filteredVolunteers = useMemo(() => filteredEntries.map(entry => entry.volunteer), [filteredEntries]);

  const addForm = canEdit && createAction ? (
    <>
      <button
        className="m-3 inline-flex min-h-[44px] items-center rounded-[var(--pl-radius-control)] bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,105,255,0.18)] hover:bg-[var(--pl-blue-deep)] sm:hidden"
        onClick={() => setMobileEditor({ kind: "add" })}
        type="button"
      >
        + Add volunteer
      </button>
      <div className="hidden border-b border-[var(--pl-border)] bg-white sm:block">
        <button
          aria-expanded={desktopAddOpen}
          className="m-4 inline-flex min-h-[44px] items-center rounded-[var(--pl-radius-control)] bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,105,255,0.18)] hover:bg-[var(--pl-blue-deep)]"
          onClick={() => setDesktopAddOpen((open) => !open)}
          type="button"
        >
          + Add volunteer
        </button>
        {desktopAddOpen ? <div className="border-t border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-5">
          <p className="max-w-2xl text-sm leading-6 text-[var(--pl-text)]">
            Saving does not send a message.
          </p>
          <form
            action={createAction}
            className="mt-4 grid gap-4"
            onSubmit={() => setDesktopAddOpen(false)}
          >
            <VolunteerFields />
            <Button className="mt-1 w-full sm:w-auto" type="submit">
              Save volunteer
            </Button>
          </form>
        </div> : null}
      </div>
    </>
  ) : (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
      Volunteer profile editing is unavailable for this signed-in contact.
    </div>
  );

  return (
    <div className="overflow-hidden rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)]">
      <VolunteerFilters query={query} onQueryChange={setQuery} filters={filters} onChange={setFilters} congregations={congregations} skills={skillOptions} resultCount={filteredVolunteers.length} total={volunteers.length} />
      {addForm}
      <VolunteerCsvTools canEdit={canEdit} filteredIds={filteredVolunteers.map(v => v.id)} />

      {filteredVolunteers.length > 0 ? (
        <section className="divide-y divide-[var(--pl-border)]">
          {filteredEntries.map(({ volunteer, skills }) => (
            <VolunteerCard
              canEdit={canEdit}
              skills={skills}
              skillQuery={query}
              selectedSkills={filters.skills}
              key={volunteer.id}
              onEdit={() => openVolunteer(volunteer, "edit")}
              onView={() => openVolunteer(volunteer, "view")}
              volunteer={volunteer}
            />
          ))}
        </section>
      ) : (
        <div>
          {volunteers.length > 0 ? <section className={filterStyles.empty} aria-label="No matching volunteers"><span className={`${filterStyles.well} mx-auto mb-3`} aria-hidden="true"><SearchX /></span><h3>No volunteers match these filters</h3><p className="mx-auto max-w-md text-sm leading-6">Try another search, remove a skill, or choose another congregation. Skills match only what is recorded in Project Local.</p><button className={`${filterStyles.button} ${filterStyles.primary} mt-5`} type="button" onClick={() => { setQuery(""); setFilters(emptyDirectoryFilters()); }}>Clear filters</button></section> : <>
          <EmptyState
            title={volunteers.length === 0 ? "No volunteers yet" : "No volunteers match these filters"}
            message={
              volunteers.length === 0
                ? "Add a manual volunteer profile when a Bozeman helper is ready to be scheduled."
                : "Try another search, remove a skill, or choose another congregation. Skills match only what is recorded in Project Local."
            }
          />
          </>}
        </div>
      )}

      <MobileOverlaySheet
        description={
          mobileEditor?.kind === "edit" || mobileEditor?.kind === "view"
            ? (mobileEditor.volunteer.congregation ?? "Volunteer profile")
            : "Saving does not send a message."
        }
        eyebrow={mobileEditor?.kind === "edit" ? "Editing volunteer" : mobileEditor?.kind === "view" ? "Volunteer profile" : undefined}
        headerAction={mobileEditor?.kind === "view" && canEdit ? <button className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--pl-blue)] focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => setMobileEditor({ kind: "edit", volunteer: mobileEditor.volunteer })} type="button"><Pencil aria-hidden className="size-4" />Edit</button> : mobileEditor?.kind === "edit" ? <button className="min-h-10 shrink-0 rounded-lg px-2 text-sm font-semibold text-[var(--pl-blue)] focus-visible:ring-2 focus-visible:ring-blue-500" onClick={showProfile} type="button">View profile</button> : null}
        label={mobileEditor?.kind === "view" ? "volunteer profile" : "volunteer editor"}
        onClose={closeEditor}
        open={mobileEditor !== null}
        title={mobileEditor?.kind === "edit" || mobileEditor?.kind === "view" ? mobileEditor.volunteer.fullName : "Add volunteer"}
      >
        {mobileEditor?.kind === "view" ? <VolunteerProfileView key={mobileEditor.volunteer.id} volunteer={mobileEditor.volunteer} schedule={schedule} today={today} workspaceKey={workspaceKey} canCommunicate={canCommunicate} onNavigate={() => setMobileEditor(null)} onRetry={() => loadSchedule(mobileEditor.volunteer.id)} /> : mobileEditor?.kind === "edit" && updateAction ? (
          <>
            <VolunteerEditForm key={mobileEditor.volunteer.id} mobile volunteer={mobileEditor.volunteer} updateAction={updateAction} onCancel={closeEditor} onDirty={() => { dirtyRef.current = true; }} onSaved={completeEdit} />
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
      {mobileEditor?.kind !== "add" && mobileEditor ? (
        <aside aria-label={`${mobileEditor.kind === "edit" ? "Editing" : "Viewing"} volunteer ${mobileEditor.volunteer.fullName}`} className="fixed inset-y-0 right-0 z-50 hidden w-[min(38rem,calc(100vw-2rem))] border-l border-[var(--pl-border)] bg-white shadow-[-18px_0_48px_rgba(15,23,42,.16)] sm:flex sm:flex-col" ref={desktopDrawerRef} tabIndex={-1}>
          <header className="flex items-start justify-between gap-4 border-b border-[var(--pl-border)] px-5 py-5">
            <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--pl-blue)]">{mobileEditor.kind === "edit" ? "Editing volunteer" : "Volunteer profile"}</p><h2 className="mt-1 truncate text-xl font-bold text-[var(--pl-ink)]">{mobileEditor.volunteer.fullName}</h2><p className="mt-1 truncate text-sm text-[var(--pl-muted)]">{mobileEditor.volunteer.congregation ?? "Volunteer profile"}</p></div>
            <div className="flex shrink-0 items-center gap-1">{mobileEditor.kind === "view" && canEdit ? <button className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[var(--pl-blue)] focus-visible:ring-2 focus-visible:ring-blue-500" onClick={() => setMobileEditor({ kind: "edit", volunteer: mobileEditor.volunteer })} type="button"><Pencil aria-hidden className="size-4" />Edit</button> : mobileEditor.kind === "edit" ? <button className="min-h-10 rounded-lg px-2 text-sm font-semibold text-[var(--pl-blue)] focus-visible:ring-2 focus-visible:ring-blue-500" onClick={showProfile} type="button">View profile</button> : null}<button aria-label={mobileEditor.kind === "view" ? "Close volunteer profile" : "Close volunteer editor"} className="inline-flex size-10 items-center justify-center rounded-lg text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] focus-visible:ring-2 focus-visible:ring-blue-500" onClick={closeEditor} ref={desktopCloseRef} type="button"><X aria-hidden="true" className="size-5" /></button></div>
          </header>
          {mobileEditor.kind === "view" ? <div className="min-h-0 flex-1 overflow-y-auto p-5"><VolunteerProfileView key={mobileEditor.volunteer.id} volunteer={mobileEditor.volunteer} schedule={schedule} today={today} workspaceKey={workspaceKey} canCommunicate={canCommunicate} onNavigate={() => setMobileEditor(null)} onRetry={() => loadSchedule(mobileEditor.volunteer.id)} /></div> : updateAction ? <VolunteerEditForm key={mobileEditor.volunteer.id} volunteer={mobileEditor.volunteer} updateAction={updateAction} mobile={false} onCancel={closeEditor} onDirty={() => { dirtyRef.current = true; }} onSaved={completeEdit} /> : null}
        </aside>
      ) : null}
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
