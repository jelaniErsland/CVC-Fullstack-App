"use client";

import { MoreHorizontal, Pencil, SearchX, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VolunteerAddForm } from "./VolunteerAddForm";
import { EmptyState } from "./EmptyState";
import { VolunteerSideSheet } from "./VolunteerSideSheet";
import { VolunteerCard } from "./VolunteerCard";
import { VolunteerCsvTools } from "./VolunteerCsvTools";
import { newerVolunteerProfile, type VolunteerProfile } from "@/lib/volunteers/profile";
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

import { withReadTimeout } from "@/lib/readTimeout";
import { DeleteVolunteerDialog } from "./DeleteVolunteerDialog";
import type { VolunteerDeletionInput, VolunteerDeletionOutcome, VolunteerDeletionReviewResult } from "@/lib/volunteers/deletion";

type VolunteerDirectoryProps = {
  volunteers: readonly VolunteerProfile[];
  congregations: string[];
  canEdit: boolean;
  canCommunicate?: boolean;
  canViewSchedule: boolean;
  workspaceTimezone: string;
  workspaceKey: string;
  readProfileAction?: (id: string) => Promise<VolunteerProfile | null>;
  readScheduleAction: (profileId: string) => Promise<VolunteerScheduleResult>;
  createAction?: (formData: FormData) => void | Promise<void>;
  deleteAction?: (input: VolunteerDeletionInput) => Promise<VolunteerDeletionOutcome>;
  reviewDeletionAction?: (id: string) => Promise<VolunteerDeletionReviewResult>;
  updateAction?: (formData: FormData) => Promise<VolunteerUpdateResult>;
};

type Selected = { kind: "add" } | { kind: "view" | "edit"; volunteer: VolunteerProfile; fromProfile?: boolean };
export function VolunteerDirectory({ canEdit, canCommunicate = false, canViewSchedule, workspaceTimezone, workspaceKey, readScheduleAction, readProfileAction, createAction, deleteAction, reviewDeletionAction, updateAction, volunteers, congregations }: VolunteerDirectoryProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DirectoryFilters>(emptyDirectoryFilters);
  const [sort, setSort] = useState<DirectorySort>("name_asc");
  const [selected, setSelected] = useState<Selected | null>(null);
  // Only server-confirmed edited rows are retained until the RSC refresh catches up.
  const [savedProfiles, setSavedProfiles] = useState<Record<string, VolunteerProfile>>({});
  const [schedule, setSchedule] = useState<VolunteerScheduleResult | null>(null);
  const [profileState, setProfileState] = useState<"ready" | "loading" | "unavailable">("ready");
  const profileRequest = useRef(0);
  const dirtyRef = useRef(false);
  const pendingRef = useRef(false);
  const [discardIntent, setDiscardIntent] = useState<"close" | "profile" | "delete" | null>(null);
  const scheduleRequestRef = useRef(0);
  const [deleteCandidate, setDeleteCandidate] = useState<VolunteerProfile | null>(null);
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [deletedNotice, setDeletedNotice] = useState(false);
  const dataMenuRef = useRef<HTMLDetailsElement>(null);
  const dataMenuTriggerRef = useRef<HTMLElement>(null);
  const loadSchedule = useCallback((profileId: string) => {
    const request = ++scheduleRequestRef.current;
    if (!canViewSchedule) { setSchedule({ kind: "unavailable" }); return; }
    setSchedule(null);
    void withReadTimeout(readScheduleAction(profileId)).then(result => { if (request === scheduleRequestRef.current) setSchedule(result); }).catch(() => { if (request === scheduleRequestRef.current) setSchedule({ kind: "error" }); });
  }, [canViewSchedule, readScheduleAction]);
  useEffect(() => () => { profileRequest.current += 1; scheduleRequestRef.current += 1; }, []);
  const finishClose = (intent: "close" | "profile" | "delete") => {
    dirtyRef.current = false;
    profileRequest.current += 1;
    setDiscardIntent(null);
    if (selected && selected.kind !== "add" && intent === "delete") {
      setDeleteCandidate(selected.volunteer); setSelected({ kind: "view", volunteer: selected.volunteer }); return;
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
    const request = ++profileRequest.current;
    setProfileState(readProfileAction ? "loading" : "ready");
    if (readProfileAction) void withReadTimeout(readProfileAction(volunteer.id)).then(current => {
      if (request !== profileRequest.current) return;
      if (!current) { setProfileState("unavailable"); return; }
      setProfileState("ready"); setSavedProfiles(saved => ({ ...saved, [current.id]: current }));
      setSelected(selected => selected && selected.kind !== "add" && selected.volunteer.id === current.id ? { ...selected, volunteer: current } : selected);
    }).catch(() => { if (request === profileRequest.current) setProfileState("unavailable"); });
    if (kind === "view") loadSchedule(volunteer.id);
  };
  const saved = (volunteer: VolunteerProfile) => {
    dirtyRef.current = false; pendingRef.current = false; setProfileState("ready");
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
    const outside = (event: PointerEvent) => { const menu = dataMenuRef.current; if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false; };
    const escape = (event: KeyboardEvent) => { const menu = dataMenuRef.current; if (event.key === "Escape" && menu?.open && !menu.querySelector("dialog[open]")) { event.preventDefault(); menu.open = false; dataMenuTriggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  const currentProfiles = useMemo(() => volunteers.filter(profile => !removedIds.has(profile.id)).map(profile => newerVolunteerProfile(profile, savedProfiles[profile.id])), [volunteers, savedProfiles, removedIds]);
  const directoryIndex = useMemo(() => indexDirectory(currentProfiles), [currentProfiles]);
  const filteredEntries = useMemo(() => sortDirectory(filterDirectory(directoryIndex, query, filters), sort), [directoryIndex, query, filters, sort]);
  const filteredVolunteers = filteredEntries.map(entry => entry.volunteer);
  const resultCopy = directoryResultCopy(query, directoryCategoryCount(filters));
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: workspaceTimezone }).format(new Date());
  return <>
    {deletedNotice ? <p role="status" className="mb-3 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-950">Volunteer deleted. Past project history is retained.</p> : null}
    <div role="group" aria-label="Volunteer actions" className={filterStyles.managementActions}>
      {canEdit && createAction ? <button className={`${filterStyles.button} ${filterStyles.primary}`} type="button" onClick={() => { dirtyRef.current = false; setSelected({ kind: "add" }); }}>+ Add volunteer</button> : <p className="mr-auto text-xs text-amber-900">Volunteer profile editing is unavailable for this signed-in contact.</p>}
      <details ref={dataMenuRef} className={filterStyles.dataMenu}><summary ref={node => { dataMenuTriggerRef.current = node; }} aria-label="More volunteer data actions" className={`${filterStyles.button} ${filterStyles.quiet}`}><MoreHorizontal aria-hidden="true" />More</summary><div className={filterStyles.dataPopup}><VolunteerCsvTools canEdit={canEdit} filteredIds={filteredVolunteers.map(volunteer => volunteer.id)} /></div></details>
    </div>
    <div className="overflow-visible rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-soft)]">
      <VolunteerFilters query={query} onQueryChange={setQuery} filters={filters} onChange={setFilters} congregations={congregations} resultCount={filteredEntries.length} total={currentProfiles.length} sortControl={<VolunteerSort value={sort} onChange={setSort} />} />
      {filteredEntries.length > 0 ? <section className="divide-y divide-[var(--pl-border)]">{filteredEntries.map(entry => <VolunteerCard canEdit={canEdit} experienceMatches={experienceMatches(entry, query, filters.experienceTerms)} key={entry.volunteer.id} onEdit={() => openVolunteer(entry.volunteer, "edit")} onView={() => openVolunteer(entry.volunteer, "view")} volunteer={entry.volunteer} />)}</section> : currentProfiles.length ? <section className={filterStyles.empty} aria-label="No matching volunteers"><span className={`${filterStyles.well} mx-auto mb-3`} aria-hidden="true"><SearchX /></span><h3>{resultCopy.emptyTitle}</h3><p className="mx-auto max-w-md text-sm leading-6">{resultCopy.explanation}</p><button className={`${filterStyles.button} ${filterStyles.primary} mt-5`} type="button" onClick={() => { setQuery(""); setFilters(emptyDirectoryFilters()); }}>{resultCopy.resetLabel}</button></section> : <EmptyState title="No volunteers yet" message="Add a volunteer profile when a helper is ready to be scheduled." />}
    </div>
    <VolunteerSideSheet open={selected !== null} title={selected && selected.kind !== "add" ? selected.volunteer.fullName : "Add volunteer"} description={selected?.kind === "add" ? "Saving does not send a message." : selected?.volunteer.congregation ?? "Volunteer profile"} label={selected?.kind === "view" ? "volunteer profile" : "volunteer editor"} icon={<UserRound />} wide formBody={selected?.kind !== "view"} onRequestClose={() => requestClose()} action={selected?.kind === "view" && canEdit && profileState === "ready" ? <button className={`${filterStyles.button} ${filterStyles.quiet}`} onClick={() => { dirtyRef.current = false; setSelected({ kind: "edit", volunteer: selected.volunteer, fromProfile: true }); }} type="button"><Pencil aria-hidden="true" />Edit</button> : undefined}>
      {selected && selected.kind !== "add" && profileState !== "ready" ? <div className="p-5 text-sm leading-6" role="status">{profileState === "loading" ? "Checking current profile…" : <><p>This volunteer profile is unavailable. Refresh the directory to see current volunteers.</p><button type="button" className={`${filterStyles.button} mt-4`} onClick={() => openVolunteer(selected.volunteer, selected.kind)}>Check again</button></>}</div> : selected?.kind === "view" ? <VolunteerProfileView key={selected.volunteer.id} volunteer={selected.volunteer} schedule={schedule} today={today} workspaceKey={workspaceKey} canCommunicate={canCommunicate} onNavigate={() => setSelected(null)} onRetry={() => loadSchedule(selected.volunteer.id)} /> : selected?.kind === "edit" && updateAction ? <VolunteerEditForm key={selected.volunteer.id} volunteer={selected.volunteer} updateAction={updateAction} onCancel={() => requestClose()} onDirty={dirty => { dirtyRef.current = dirty; }} onPending={pending => { pendingRef.current = pending; }} onSaved={saved} secondaryAction={deleteAction && <div className="mt-8 border-t border-rose-100 pt-4"><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-400" onClick={() => requestClose("delete")}><Trash2 aria-hidden="true" className="size-4" />Delete volunteer</button></div>} /> : selected?.kind === "add" && createAction ? <VolunteerAddForm action={createAction} onDirty={dirty => { dirtyRef.current = dirty; }} onPending={pending => { pendingRef.current = pending; }} /> : null}
    </VolunteerSideSheet>
    <DiscardVolunteerChanges open={discardIntent !== null} onKeep={() => setDiscardIntent(null)} onDiscard={() => { if (discardIntent) finishClose(discardIntent); }} />
    {deleteCandidate && deleteAction && reviewDeletionAction ? <DeleteVolunteerDialog key={deleteCandidate.id} profileId={deleteCandidate.id} name={deleteCandidate.fullName} review={reviewDeletionAction} remove={deleteAction}
      onCancel={() => setDeleteCandidate(null)} onDeleted={() => { const id = deleteCandidate.id; setRemovedIds(current => new Set([...current, id])); setSavedProfiles(current => { const next = { ...current }; delete next[id]; return next; }); setDeleteCandidate(null); setSelected(null); scheduleRequestRef.current += 1; setSchedule(null); setDeletedNotice(true); }} /> : null}
  </>;
}
