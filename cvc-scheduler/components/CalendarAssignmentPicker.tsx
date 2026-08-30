"use client";

import Link from "next/link";
import {
  Check,
  Ellipsis,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MobileOverlaySheet } from "@/components/MobileOverlaySheet";

const calmFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 focus-visible:ring-offset-1";

type AssignmentResponseStatus = "needs_response" | "confirmed" | "declined";
type PickerSort = "name-asc" | "name-desc" | "congregation-asc";
type PickerSurface = "filters" | "sort" | "profile" | null;
type CalendarMutationAction = (formData: FormData) => void | Promise<void>;

export type CalendarPickerVolunteer = Readonly<{
  id: string;
  displayName: string;
  congregation: string | null;
  lifecycle: string;
  readinessStatus: string;
  emailAvailable: boolean;
  phoneAvailable: boolean;
  preferredContactMethod: string | null;
  profileNotes: string | null;
}>;

export type CalendarPickerAssignment = Readonly<{
  assignmentId: string;
  calendarItemId: string;
  volunteerProfileId: string;
  volunteerDisplayName: string;
  volunteerCongregation: string | null;
  volunteerLifecycle: string;
  volunteerReadinessStatus: string;
  volunteerEmailAvailable: boolean;
  volunteerPhoneAvailable: boolean;
  volunteerPreferredContactMethod: string | null;
  volunteerProfileNotes: string | null;
  responseStatus: AssignmentResponseStatus;
}>;

export type CalendarPickerState =
  | Readonly<{
      kind: "ready";
      volunteers: readonly CalendarPickerVolunteer[];
      assignments: readonly CalendarPickerAssignment[];
    }>
  | Readonly<{ kind: "unavailable"; reason: "missing_volunteers_view" }>
  | Readonly<{ kind: "error"; reason: "query_unavailable" | "invalid_projection" }>;

type VolunteerContext = Readonly<{
  id: string;
  displayName: string;
  congregation: string | null;
  lifecycle: string;
  readinessStatus: string;
  emailAvailable: boolean;
  phoneAvailable: boolean;
  preferredContactMethod: string | null;
  profileNotes: string | null;
}>;

function responseLabel(status: AssignmentResponseStatus) {
  if (status === "confirmed") return "Confirmed";
  if (status === "declined") return "Denied";
  return "Needs response";
}

function responseTone(status: AssignmentResponseStatus) {
  if (status === "confirmed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "declined") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compareVolunteers(first: CalendarPickerVolunteer, second: CalendarPickerVolunteer, sort: PickerSort) {
  if (sort === "name-desc") {
    return (
      second.displayName.localeCompare(first.displayName) || second.id.localeCompare(first.id)
    );
  }
  if (sort === "congregation-asc") {
    return (
      (first.congregation ?? "ZZZZ").localeCompare(second.congregation ?? "ZZZZ") ||
      first.displayName.localeCompare(second.displayName) ||
      first.id.localeCompare(second.id)
    );
  }
  return first.displayName.localeCompare(second.displayName) || first.id.localeCompare(second.id);
}

function ContextDetails({ volunteer }: { volunteer: VolunteerContext }) {
  return (
    <div className="space-y-4" data-volunteer-context={volunteer.id}>
      <div>
        <p className="text-lg font-bold text-slate-950">{volunteer.displayName}</p>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {volunteer.congregation ?? "No congregation recorded"}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</dt>
          <dd className="mt-1 font-semibold text-slate-800">{humanize(volunteer.lifecycle)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Readiness</dt>
          <dd className="mt-1 font-semibold text-slate-800">{humanize(volunteer.readinessStatus)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
          <dd className="mt-1 font-semibold text-slate-800">{volunteer.emailAvailable ? "On file" : "Not on file"}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</dt>
          <dd className="mt-1 font-semibold text-slate-800">{volunteer.phoneAvailable ? "On file" : "Not on file"}</dd>
        </div>
      </dl>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Preferred contact</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">
          {volunteer.preferredContactMethod ?? "Not specified"}
        </p>
      </div>
      {volunteer.profileNotes ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Profile notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{volunteer.profileNotes}</p>
        </div>
      ) : null}
      <p className="text-xs leading-5 text-slate-500">
        Contact details remain private here. This summary uses the existing authorized volunteer read.
      </p>
    </div>
  );
}

function ChoiceList({
  congregation,
  congregations,
  onCongregationChange,
  onReset,
  sort,
  onSortChange,
  surface,
}: {
  congregation: string;
  congregations: readonly string[];
  onCongregationChange: (value: string) => void;
  onReset: () => void;
  sort: PickerSort;
  onSortChange: (value: PickerSort) => void;
  surface: Exclude<PickerSurface, "profile" | null>;
}) {
  if (surface === "filters") {
    return (
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">Congregation</legend>
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">
          {["", ...congregations].map((value) => (
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-50" key={value || "all"}>
              <input
                checked={congregation === value}
                name="picker-congregation"
                onChange={() => onCongregationChange(value)}
                type="radio"
              />
              {value || "All congregations"}
            </label>
          ))}
        </div>
        <button className={`mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 ${calmFocusRing}`} onClick={onReset} type="button">
          <RotateCcw aria-hidden="true" className="h-4 w-4" /> Reset filters
        </button>
      </fieldset>
    );
  }
  const options: readonly [PickerSort, string][] = [
    ["name-asc", "Name A–Z"],
    ["name-desc", "Name Z–A"],
    ["congregation-asc", "Congregation A–Z"],
  ];
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">Sort volunteers</legend>
      <div className="mt-2 space-y-1">
        {options.map(([value, label]) => (
          <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-50" key={value}>
            <input checked={sort === value} name="picker-sort" onChange={() => onSortChange(value)} type="radio" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CalendarAssignmentPicker({
  assignAction,
  assignmentPicker,
  canEditAssignments,
  cancelAssignmentAction,
  currentAssignments,
  currentDate,
  currentView,
  itemId,
  neededCount,
}: {
  assignAction?: CalendarMutationAction;
  assignmentPicker: CalendarPickerState;
  canEditAssignments: boolean;
  cancelAssignmentAction?: CalendarMutationAction;
  currentAssignments: readonly CalendarPickerAssignment[];
  currentDate: string;
  currentView: string;
  itemId: string;
  neededCount: number;
}) {
  const [search, setSearch] = useState("");
  const [congregation, setCongregation] = useState("");
  const [sort, setSort] = useState<PickerSort>("name-asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [surface, setSurface] = useState<PickerSurface>(null);
  const [contextVolunteer, setContextVolunteer] = useState<VolunteerContext | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const assignedIds = useMemo(
    () => new Set(currentAssignments.map((assignment) => assignment.volunteerProfileId)),
    [currentAssignments],
  );
  const volunteers = useMemo(
    () => (assignmentPicker.kind === "ready" ? assignmentPicker.volunteers : []),
    [assignmentPicker],
  );
  const eligible = useMemo(
    () => volunteers.filter((volunteer) => !assignedIds.has(volunteer.id)),
    [assignedIds, volunteers],
  );
  const eligibleIds = useMemo(() => new Set(eligible.map((volunteer) => volunteer.id)), [eligible]);
  const selectedEligibleIds = selectedIds.filter((id) => eligibleIds.has(id));
  const congregations = useMemo(
    () => [...new Set(eligible.map((volunteer) => volunteer.congregation).filter((value): value is string => Boolean(value)))].sort(),
    [eligible],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleVolunteers = useMemo(
    () =>
      eligible
        .filter((volunteer) => !congregation || volunteer.congregation === congregation)
        .filter((volunteer) => {
          if (!normalizedSearch) return true;
          return `${volunteer.displayName} ${volunteer.congregation ?? ""}`
            .toLocaleLowerCase()
            .includes(normalizedSearch);
        })
        .sort((first, second) => compareVolunteers(first, second, sort)),
    [congregation, eligible, normalizedSearch, sort],
  );
  const canAssign = Boolean(assignAction) && canEditAssignments && selectedEligibleIds.length > 0;
  const capacityWarning =
    neededCount > 0 && currentAssignments.length + selectedEligibleIds.length > neededCount;
  const actionLabel =
    selectedEligibleIds.length === 0
      ? "Assign selected"
      : selectedEligibleIds.length === 1
        ? "Assign 1 volunteer"
        : `Assign ${selectedEligibleIds.length} volunteers`;

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const openContext = (volunteer: VolunteerContext) => {
    setContextVolunteer(volunteer);
    setSurface("profile");
  };
  const closeSurface = () => setSurface(null);
  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };
  const desktopSurface = surface && !isMobile ? surface : null;

  return (
    <div className="space-y-3">
      <div className="divide-y divide-[var(--pl-border)] overflow-hidden rounded-lg border border-[var(--pl-border)]">
        {currentAssignments.length > 0 ? (
          currentAssignments.map((assignment) => {
            const context: VolunteerContext = {
              id: assignment.volunteerProfileId,
              displayName: assignment.volunteerDisplayName,
              congregation: assignment.volunteerCongregation,
              lifecycle: assignment.volunteerLifecycle,
              readinessStatus: assignment.volunteerReadinessStatus,
              emailAvailable: assignment.volunteerEmailAvailable,
              phoneAvailable: assignment.volunteerPhoneAvailable,
              preferredContactMethod: assignment.volunteerPreferredContactMethod,
              profileNotes: assignment.volunteerProfileNotes,
            };
            return (
              <div className="bg-white px-3 py-2.5" key={assignment.assignmentId}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{assignment.volunteerDisplayName}</p>
                    {assignment.volunteerCongregation ? <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{assignment.volunteerCongregation}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${responseTone(assignment.responseStatus)}`}>
                      {responseLabel(assignment.responseStatus)}
                    </span>
                    <button aria-label={`View volunteer context for ${assignment.volunteerDisplayName}`} className={`inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 ${calmFocusRing}`} onClick={() => openContext(context)} type="button">
                      <Ellipsis aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link aria-label={`View assignment for ${assignment.volunteerDisplayName}`} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--pl-border)] bg-white px-2.5 text-xs font-semibold text-[var(--pl-blue)] hover:bg-[var(--pl-blue-soft)] ${calmFocusRing}`} href={`/admin/assignments/${encodeURIComponent(assignment.assignmentId)}`}>
                    <SquareArrowOutUpRight aria-hidden="true" className="h-3.5 w-3.5" /> View assignment
                  </Link>
                  {canEditAssignments && cancelAssignmentAction ? (
                    <form action={cancelAssignmentAction}>
                      <input name="assignmentId" type="hidden" value={assignment.assignmentId} />
                      <input name="redirectView" type="hidden" value={currentView} />
                      <input name="redirectDate" type="hidden" value={currentDate} />
                      <input name="redirectItem" type="hidden" value={itemId} />
                      <input name="redirectSection" type="hidden" value="volunteers" />
                      <button aria-label={`Remove assignment for ${assignment.volunteerDisplayName}`} className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--pl-border)] bg-white px-2.5 text-xs font-semibold text-[var(--pl-text)] hover:bg-[var(--pl-surface-subtle)] ${calmFocusRing}`} type="submit">
                        <UserMinus aria-hidden="true" className="h-3.5 w-3.5" /> Remove assignment
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <p className="px-3 py-2.5 text-sm font-medium leading-6 text-slate-500">No volunteers are assigned yet.</p>
        )}
      </div>

      <div className="rounded-lg bg-[var(--pl-surface-subtle)] px-3 py-3">
        {assignmentPicker.kind === "unavailable" ? (
          <p className="text-sm leading-6 text-slate-600">Volunteer choices are unavailable for this signed-in contact.</p>
        ) : assignmentPicker.kind === "error" ? (
          <p className="text-sm leading-6 text-slate-600">Volunteer choices could not be loaded safely right now.</p>
        ) : canEditAssignments && assignAction ? (
          <form action={assignAction} className="space-y-3">
            <input name="calendarItemId" type="hidden" value={itemId} />
            <input name="redirectView" type="hidden" value={currentView} />
            <input name="redirectDate" type="hidden" value={currentDate} />
            <input name="redirectItem" type="hidden" value={itemId} />
            <input name="redirectSection" type="hidden" value="volunteers" />
            {selectedEligibleIds.map((id) => <input key={id} name="volunteerProfileIds" type="hidden" value={id} />)}

            <div>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <UserPlus aria-hidden="true" className="h-4 w-4" /> Assign ready volunteers
              </span>
              <div className="mt-2 flex gap-2">
                <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 focus-within:ring-2 focus-within:ring-slate-900/30 focus-within:ring-offset-1">
                  <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="sr-only">Search ready volunteers</span>
                  <input aria-label="Search ready volunteers" className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400" onChange={(event) => setSearch(event.target.value)} placeholder="Name or congregation" type="search" value={search} />
                  {search ? <button aria-label="Clear volunteer search" className="text-xs font-semibold text-[var(--pl-blue)]" onClick={() => setSearch("")} type="button">Clear</button> : null}
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button aria-expanded={surface === "filters"} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${congregation ? "border-blue-200 bg-blue-50 text-[var(--pl-blue)]" : "border-slate-200 bg-white text-slate-700"} ${calmFocusRing}`} onClick={() => setSurface(surface === "filters" ? null : "filters")} type="button">
                  <Filter aria-hidden="true" className="h-3.5 w-3.5" /> Filters{congregation ? " · 1" : ""}
                </button>
                <button aria-expanded={surface === "sort"} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 ${calmFocusRing}`} onClick={() => setSurface(surface === "sort" ? null : "sort")} type="button">
                  <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" /> Sort
                </button>
                {(search || congregation || sort !== "name-asc") ? <button className={`inline-flex min-h-9 items-center gap-1.5 px-1 text-xs font-semibold text-[var(--pl-blue)] ${calmFocusRing}`} onClick={() => { setSearch(""); setCongregation(""); setSort("name-asc"); }} type="button">Reset</button> : null}
              </div>
            </div>

            {desktopSurface === "filters" || desktopSurface === "sort" ? (
              <div className="hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:block">
                <ChoiceList congregation={congregation} congregations={congregations} onCongregationChange={setCongregation} onReset={() => setCongregation("")} onSortChange={setSort} sort={sort} surface={desktopSurface} />
              </div>
            ) : desktopSurface === "profile" && contextVolunteer ? (
              <div className="hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:block">
                <div className="mb-2 flex justify-end"><button className={`text-xs font-semibold text-[var(--pl-blue)] ${calmFocusRing}`} onClick={closeSurface} type="button">Back to volunteers</button></div>
                <ContextDetails volunteer={contextVolunteer} />
              </div>
            ) : null}

            <div className="max-h-60 space-y-1.5 overflow-y-auto overscroll-contain pr-1" data-picker-scroll="volunteer-candidates">
              {visibleVolunteers.length > 0 ? visibleVolunteers.map((volunteer) => (
                <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-2" key={volunteer.id}>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input aria-label={`Select ${volunteer.displayName}`} checked={selectedEligibleIds.includes(volunteer.id)} className="h-4 w-4 shrink-0 rounded border-slate-300 text-slate-950" onChange={() => toggleSelection(volunteer.id)} type="checkbox" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">{volunteer.displayName}</span>
                      {volunteer.congregation ? <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{volunteer.congregation}</span> : null}
                    </span>
                  </label>
                  <button aria-label={`View volunteer context for ${volunteer.displayName}`} className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 ${calmFocusRing}`} onClick={() => openContext(volunteer)} type="button">
                    <Ellipsis aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-sm leading-6 text-slate-500">
                  <p>{eligible.length === 0 ? "No ready unassigned volunteers are available for this workspace." : "No ready volunteers match the current search and filters."}</p>
                  {eligible.length > 0 ? <button className={`mt-2 text-sm font-semibold text-[var(--pl-blue)] ${calmFocusRing}`} onClick={() => { setSearch(""); setCongregation(""); }} type="button">Clear search and filters</button> : null}
                </div>
              )}
            </div>
            <p aria-live="polite" className="text-sm font-semibold text-slate-700">{selectedEligibleIds.length} selected</p>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Assignment note</span>
              <textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-3 text-sm font-medium leading-6 text-slate-800 outline-none focus:ring-2 focus:ring-slate-900/30 focus:ring-offset-1" maxLength={2000} name="assignmentNote" placeholder="Optional internal note for this assignment" />
            </label>
            {capacityWarning ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">This will assign more volunteers than the current needed count. That is allowed for now, but coverage will show over target.</p> : null}
            <button className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition ${canAssign ? "border-[var(--pl-blue)] bg-[var(--pl-blue)] text-white hover:bg-[var(--pl-blue-deep)]" : "cursor-not-allowed border-slate-200 bg-white/72 text-slate-500 opacity-75"}`} disabled={!canAssign} type="submit">
              <Check aria-hidden="true" className="h-4 w-4" /> {actionLabel}
            </button>
          </form>
        ) : (
          <p className="text-sm leading-6 text-slate-600">This contact can view Calendar assignments but cannot change them.</p>
        )}
      </div>

      {isMobile && (surface === "filters" || surface === "sort") ? (
        <MobileOverlaySheet description={surface === "filters" ? "Narrow the ready volunteer list." : "Choose a neutral list order."} label={`Volunteer ${surface}`} onClose={closeSurface} open title={surface === "filters" ? "Filter volunteers" : "Sort volunteers"}>
          <ChoiceList congregation={congregation} congregations={congregations} onCongregationChange={setCongregation} onReset={() => setCongregation("")} onSortChange={setSort} sort={sort} surface={surface} />
        </MobileOverlaySheet>
      ) : null}
      {isMobile && surface === "profile" && contextVolunteer ? (
        <MobileOverlaySheet description="Read-only scheduling context." label={`Volunteer context for ${contextVolunteer.displayName}`} onClose={closeSurface} open title="Volunteer context">
          <ContextDetails volunteer={contextVolunteer} />
        </MobileOverlaySheet>
      ) : null}
    </div>
  );
}
