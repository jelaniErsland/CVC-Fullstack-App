"use client";

import { MoreHorizontal, Pencil, SearchX, Trash2, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VolunteerAddForm } from "./VolunteerAddForm";
import { EmptyState } from "./EmptyState";
import { VolunteerSideSheet } from "./VolunteerSideSheet";
import { VolunteerCard } from "./VolunteerCard";
import { VolunteerCsvTools } from "./VolunteerCsvTools";
import { newerVolunteerProfile, type VolunteerProfile } from "@/lib/volunteers/profile";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { VolunteerProfileView } from "./VolunteerProfileView";
import { VolunteerEditForm } from "./VolunteerEditForm";
import { VolunteerFilters } from "./VolunteerFilters";
import { VolunteerSort } from "./VolunteerSort";
import { sortDirectory, type DirectorySort } from "@/lib/volunteers/directorySort";
import { directoryCategoryCount, emptyDirectoryFilters, filterDirectory, indexDirectory, type DirectoryFilters } from "@/lib/volunteers/directoryFilters";
import { directoryResultCopy } from "@/lib/volunteers/directoryPresentation";
import filterStyles from "./VolunteerFilters.module.css";
import type { VolunteerScheduleResult } from "@/lib/volunteers/schedule.server";
import type { VolunteerUpdateResult } from "@/lib/volunteers/updateResult";
import { experienceMatches } from "@/lib/volunteers/experience";
import { DiscardVolunteerChanges } from "./DiscardVolunteerChanges";

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

type Selected = { kind: "add" } | { kind: "view" | "edit"; volunteer: VolunteerProfile; fromProfile?: boolean };
export function VolunteerDirectory({ canEdit, canCommunicate = false, canViewSchedule, workspaceTimezone, workspaceKey, readScheduleAction, createAction, deleteAction, updateAction, volunteers, congregations }: VolunteerDirectoryProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DirectoryFilters>(emptyDirectoryFilters);
  const [sort, setSort] = useState<DirectorySort>("name_asc");
  const [selected, setSelected] = useState<Selected | null>(null);
  // Only server-confirmed edited rows are retained until the RSC refresh catches up.
  const [savedProfiles, setSavedProfiles] = useState<Record<string, VolunteerProfile>>({});
  const [schedule, setSchedule] = useState<VolunteerScheduleResult | null>(null);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const [discardIntent, setDiscardIntent] = useState<"close" | "profile" | "delete" | null>(null);
  const scheduleRequestRef = useRef(0);
  const [deleteCandidate, setDeleteCandidate] = useState<VolunteerProfile | null>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const dataMenuRef = useRef<HTMLDetailsElement>(null);
  const dataMenuTriggerRef = useRef<HTMLElement>(null);
  useBodyScrollLock(deleteCandidate !== null);
  const loadSchedule = useCallback((profileId: string) => {
    const request = ++scheduleRequestRef.current;
    if (!canViewSchedule) { setSchedule({ kind: "unavailable" }); return; }
    setSchedule(null);
    void readScheduleAction(profileId).then(result => { if (request === scheduleRequestRef.current) setSchedule(result); }).catch(() => { if (request === scheduleRequestRef.current) setSchedule({ kind: "error" }); });
  }, [canViewSchedule, readScheduleAction]);
  const finishClose = (intent: "close" | "profile" | "delete") => {
    dirtyRef.current = false;
    setDiscardIntent(null);
    if (selected && selected.kind !== "add" && intent === "delete") {
      setDeleteCandidate(selected.volunteer); setSelected(null); return;
    }
    if (selected?.kind === "edit" && (intent === "profile" || selected.fromProfile)) {
      setSelected({ kind: "view", volunteer: newerVolunteerProfile(volunteers.find(profile => profile.id === selected.volunteer.id) ?? selected.volunteer, savedProfiles[selected.volunteer.id]) }); loadSchedule(selected.volunteer.id);
    } else { scheduleRequestRef.current += 1; setSelected(null); }
  };
  const requestClose = (intent: "close" | "profile" | "delete" = "close") => {
    if (pendingRef.current) return;
    if (dirtyRef.current) setDiscardIntent(intent); else finishClose(intent);
  };
  const openVolunteer = (volunteer: VolunteerProfile, kind: "view" | "edit") => {
    dirtyRef.current = false; setSelected({ kind, volunteer });
    if (kind === "view") loadSchedule(volunteer.id);
  };
  const saved = (volunteer: VolunteerProfile) => {
    dirtyRef.current = false; pendingRef.current = false;
    setSavedProfiles(current => ({ ...current, [volunteer.id]: volunteer }));
    setSelected({ kind: "view", volunteer }); loadSchedule(volunteer.id);
  };
  useEffect(() => {
    if (selected?.kind !== "edit" && selected?.kind !== "add") return;
    const unload = (event: BeforeUnloadEvent) => { if (dirtyRef.current || pendingRef.current) event.preventDefault(); };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [selected?.kind]);
  useEffect(() => {
    if (!deleteCandidate) return;
    deleteCancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setDeleteCandidate(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteCandidate]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { const menu = dataMenuRef.current; if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false; };
    const escape = (event: KeyboardEvent) => { const menu = dataMenuRef.current; if (event.key === "Escape" && menu?.open && !menu.querySelector("dialog[open]")) { event.preventDefault(); menu.open = false; dataMenuTriggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const currentProfiles = useMemo(() => volunteers.map(profile => newerVolunteerProfile(profile, savedProfiles[profile.id])), [volunteers, savedProfiles]);
  const directoryIndex = useMemo(() => indexDirectory(currentProfiles), [currentProfiles]);
  const filteredEntries = useMemo(() => sortDirectory(filterDirectory(directoryIndex, query, filters), sort), [directoryIndex, query, filters, sort]);
  const filteredVolunteers = filteredEntries.map(entry => entry.volunteer);
  const resultCopy = directoryResultCopy(query, directoryCategoryCount(filters));
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: workspaceTimezone }).format(new Date());
  return <>
    <div role="group" aria-label="Volunteer actions" className={filterStyles.managementActions}>
      {canEdit && createAction ? <button className={`${filterStyles.button} ${filterStyles.primary}`} type="button" onClick={() => { dirtyRef.current = false; setSelected({ kind: "add" }); }}>+ Add volunteer</button> : <p className="mr-auto text-xs text-amber-900">Volunteer profile editing is unavailable for this signed-in contact.</p>}
      <details ref={dataMenuRef} className={filterStyles.dataMenu}><summary ref={node => { dataMenuTriggerRef.current = node; }} aria-label="More volunteer data actions" className={`${filterStyles.button} ${filterStyles.quiet}`}><MoreHorizontal aria-hidden="true" />More</summary><div className={filterStyles.dataPopup}><VolunteerCsvTools canEdit={canEdit} filteredIds={filteredVolunteers.map(volunteer => volunteer.id)} /></div></details>
    </div>
    <div className="overflow-visible rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-soft)]">
      <VolunteerFilters query={query} onQueryChange={setQuery} filters={filters} onChange={setFilters} congregations={congregations} resultCount={filteredEntries.length} total={currentProfiles.length} sortControl={<VolunteerSort value={sort} onChange={setSort} />} />
      {filteredEntries.length > 0 ? <section className="divide-y divide-[var(--pl-border)]">{filteredEntries.map(entry => <VolunteerCard canEdit={canEdit} experienceMatches={experienceMatches(entry, query, filters.experienceTerms)} key={entry.volunteer.id} onEdit={() => openVolunteer(entry.volunteer, "edit")} onView={() => openVolunteer(entry.volunteer, "view")} volunteer={entry.volunteer} />)}</section> : currentProfiles.length ? <section className={filterStyles.empty} aria-label="No matching volunteers"><span className={`${filterStyles.well} mx-auto mb-3`} aria-hidden="true"><SearchX /></span><h3>{resultCopy.emptyTitle}</h3><p className="mx-auto max-w-md text-sm leading-6">{resultCopy.explanation}</p><button className={`${filterStyles.button} ${filterStyles.primary} mt-5`} type="button" onClick={() => { setQuery(""); setFilters(emptyDirectoryFilters()); }}>{resultCopy.resetLabel}</button></section> : <EmptyState title="No volunteers yet" message="Add a volunteer profile when a helper is ready to be scheduled." />}
    </div>
    <VolunteerSideSheet open={selected !== null} title={selected && selected.kind !== "add" ? selected.volunteer.fullName : "Add volunteer"} description={selected?.kind === "add" ? "Saving does not send a message." : selected?.volunteer.congregation ?? "Volunteer profile"} label={selected?.kind === "view" ? "volunteer profile" : "volunteer editor"} icon={<UserRound />} wide formBody={selected?.kind !== "view"} onRequestClose={() => requestClose()} action={selected?.kind === "view" && canEdit ? <button className={`${filterStyles.button} ${filterStyles.quiet}`} onClick={() => { dirtyRef.current = false; setSelected({ kind: "edit", volunteer: selected.volunteer, fromProfile: true }); }} type="button"><Pencil aria-hidden="true" />Edit</button> : undefined}>
      {selected?.kind === "view" ? <VolunteerProfileView key={selected.volunteer.id} volunteer={selected.volunteer} schedule={schedule} today={today} workspaceKey={workspaceKey} canCommunicate={canCommunicate} onNavigate={() => setSelected(null)} onRetry={() => loadSchedule(selected.volunteer.id)} /> : selected?.kind === "edit" && updateAction ? <VolunteerEditForm key={selected.volunteer.id} volunteer={selected.volunteer} updateAction={updateAction} onCancel={() => requestClose()} onDirty={dirty => { dirtyRef.current = dirty; }} onPending={pending => { pendingRef.current = pending; }} onSaved={saved} secondaryAction={deleteAction && <div className="mt-8 border-t border-rose-100 pt-4"><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-400" onClick={() => requestClose("delete")}><Trash2 aria-hidden="true" className="size-4" />Delete volunteer</button></div>} /> : selected?.kind === "add" && createAction ? <VolunteerAddForm action={createAction} onDirty={dirty => { dirtyRef.current = dirty; }} onPending={pending => { pendingRef.current = pending; }} /> : null}
    </VolunteerSideSheet>
    <DiscardVolunteerChanges open={discardIntent !== null} onKeep={() => setDiscardIntent(null)} onDiscard={() => { if (discardIntent) finishClose(discardIntent); }} />
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

  </>;
}
