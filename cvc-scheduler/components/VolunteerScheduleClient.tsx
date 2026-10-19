"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { DisclosureSection } from "@/components/DisclosureSection";

import type { VolunteerScheduleActionResult } from "@/app/v/schedule/actions";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import { formatScheduleClockRange } from "@/lib/scheduleFormatting";
import type { VolunteerScheduleAssignment } from "@/lib/volunteerScheduleAccess/token";
import { groupScheduleByStartDate, sameDayShiftLabel } from "@/lib/volunteerSchedulePresentation";

type VolunteerScheduleClientProps = Readonly<{
  showMeals?: boolean;
  presentation?: "default" | "next" | "compact" | "home";
  showConfirmAll?: boolean;
  confirmAllAssignments?: readonly VolunteerScheduleAssignment[];
  assignments: readonly VolunteerScheduleAssignment[];
  confirmAllAction: () => Promise<VolunteerScheduleActionResult>;
  submitResponseAction: (formData: FormData) => Promise<VolunteerScheduleActionResult>;
}>;

const responseLabels: Record<
  VolunteerScheduleAssignment["currentResponseStatus"],
  string
> = {
  needs_response: "Needs reply",
  confirmed: "Confirmed",
  declined: "Can’t make it",
};

const responseStyles: Record<
  VolunteerScheduleAssignment["currentResponseStatus"],
  string
> = {
  needs_response: "border-amber-200 bg-amber-50 text-amber-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  declined: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatDate(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return value;
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function dateTimeLabel(assignment: VolunteerScheduleAssignment) {
  const dateLabel = assignment.endDate
    ? `${formatDate(assignment.startDate)} – ${formatDate(assignment.endDate)}`
    : formatDate(assignment.startDate);
  const timeLabel = formatScheduleClockRange(
    assignment.startTime,
    assignment.endTime,
  );
  return `${dateLabel} · ${timeLabel ?? "No specific time"}`;
}

function cardDateTimeLabel(assignment: VolunteerScheduleAssignment) {
  const shortDate = (value: string) => new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
  const date = assignment.endDate && assignment.endDate !== assignment.startDate
    ? `${shortDate(assignment.startDate)} – ${shortDate(assignment.endDate)}`
    : shortDate(assignment.startDate);
  return `${date} · ${formatScheduleClockRange(assignment.startTime, assignment.endTime) ?? "No specific time"}`;
}

function hasFollowUpContact(assignment: VolunteerScheduleAssignment) {
  return Boolean(
    assignment.followUpContact.displayName ||
      assignment.followUpContact.email ||
      assignment.followUpContact.phone,
  );
}

function HomeDayGroups({ assignments, allAssignments, featured, suppressFirstHeading, onSelect }: Readonly<{
  assignments: readonly VolunteerScheduleAssignment[];
  allAssignments: readonly VolunteerScheduleAssignment[];
  featured: boolean;
  suppressFirstHeading?: boolean;
  onSelect: (assignment: VolunteerScheduleAssignment, button: HTMLButtonElement) => void;
}>) {
  const groups = groupScheduleByStartDate(assignments);
  const dayCounts = new Map<string, number>();
  for (const assignment of allAssignments) dayCounts.set(assignment.startDate, (dayCounts.get(assignment.startDate) ?? 0) + 1);
  return <div className="space-y-4">
    {groups.map((group, groupIndex) => {
      const headingId = `volunteer-day-${featured ? "featured" : "later"}-${group.date}`;
      const sameDayCount = dayCounts.get(group.date) ?? 0;
      const continuedDay = suppressFirstHeading && groupIndex === 0;
      return <section key={group.date} aria-labelledby={continuedDay ? undefined : headingId} aria-label={continuedDay ? `${formatDate(group.date)} continued` : undefined}>
        {!continuedDay && <h3 id={headingId} className="mb-1 text-sm font-semibold tracking-[-0.01em] text-[var(--pl-ink)]">{formatDate(group.date)}</h3>}
        <div className="grid gap-2">
          {group.assignments.map(assignment => {
            const shift = sameDayShiftLabel(assignment, sameDayCount);
            const time = formatScheduleClockRange(assignment.startTime, assignment.endTime) ?? "No specific time";
            const spansDates = Boolean(assignment.endDate && assignment.endDate !== assignment.startDate);
            return <button key={assignment.assignmentReference} type="button" onClick={event => onSelect(assignment, event.currentTarget)}
              className={`group w-full min-w-0 rounded-xl border border-[var(--pl-border)] px-4 py-3 text-left transition hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${featured ? "bg-[linear-gradient(115deg,rgba(234,242,255,.75),rgba(255,255,255,1)_68%)] shadow-[var(--pl-shadow-card)]" : "bg-white/80"}`}>
              <span className="sr-only">{formatDate(assignment.startDate)}. </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`min-w-0 break-words font-semibold text-[var(--pl-ink)] ${featured ? "text-base" : "text-sm"}`}>{assignment.taskTitle}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${responseStyles[assignment.currentResponseStatus]}`}>{responseLabels[assignment.currentResponseStatus]}</span>
              </span>
              <span className="mt-1 block text-sm leading-5 text-[var(--pl-text)]">{shift && <span className="mr-2 font-medium text-[var(--pl-blue)]">{shift} ·</span>}{time}{spansDates ? ` · ends ${formatDate(assignment.endDate!)}` : ""}</span>
              {assignment.fellowWorkerNames.length > 0 && <span className="mt-1 block break-words text-xs leading-5 text-[var(--pl-text)]">{assignment.fellowWorkerNames.length === 1 ? "Fellow worker" : "Fellow workers"} · {assignment.fellowWorkerNames.join(", ")}</span>}
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--pl-blue)]">View assignment details <ArrowRight aria-hidden className="size-3.5" /></span>
            </button>;
          })}
        </div>
      </section>;
    })}
  </div>;
}

export function VolunteerScheduleClient({
  showMeals = true,
  presentation = "default",
  showConfirmAll = true,
  assignments,
  confirmAllAssignments = assignments,
  confirmAllAction,
  submitResponseAction,
}: VolunteerScheduleClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(true);
  const [actionNotice, setActionNotice] =
    useState<VolunteerScheduleActionResult | null>(null);
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(null);
  const [isConfirmAllPending, startConfirmAllTransition] = useTransition();
  const [isResponsePending, startResponseTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const selected = assignments.find(
    (assignment) => assignment.assignmentReference === selectedId,
  );
  const confirmAllCount = confirmAllAssignments.filter(
    (assignment) =>
      assignment.currentResponseStatus === "needs_response" && assignment.canConfirm,
  ).length;

  useBodyScrollLock(Boolean(selected));
  useFocusContainment(Boolean(selected), dialogRef);

  function submitResponse(
    assignment: VolunteerScheduleAssignment,
    status: "confirmed" | "declined",
    note?: string | null,
  ) {
    setPendingAssignmentId(assignment.assignmentReference);
    setActionNotice(null);
    const formData = new FormData();
    formData.set("assignmentId", assignment.assignmentReference);
    formData.set("status", status);
    if (note) formData.set("note", note);
    startResponseTransition(async () => {
      try {
        const result = await submitResponseAction(formData);
        setActionNotice(result);
        if (result.ok && status === "declined") setSelectedId(null);
      } catch {
        setActionNotice({ ok: false, code: "error", message: "Could not save your response. Please try again." });
      } finally {
        setPendingAssignmentId(null);
      }
    });
  }

  function confirmAll() {
    setActionNotice(null);
    startConfirmAllTransition(async () => {
      try {
        setActionNotice(await confirmAllAction());
      } catch {
        setActionNotice({ ok: false, code: "error", message: "Could not confirm assignments. Please try again." });
      }
    });
  }

  useEffect(() => {
    if (!selected) return undefined;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  useEffect(() => {
    if (selected) return;
    returnFocusRef.current?.focus();
  }, [selected]);

  return (
    <>
      {presentation === "home" ? <div>
        <div className="mb-1 flex min-h-9 items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-[-0.02em] text-[var(--pl-ink)]">Your schedule</h2>
          {assignments.length > 3 && <button type="button" aria-expanded={scheduleExpanded} aria-controls="volunteer-inline-schedule" onClick={() => setScheduleExpanded(value => !value)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[var(--pl-blue)] hover:bg-[var(--pl-blue-soft)] focus-visible:outline-2 focus-visible:outline-blue-600">{scheduleExpanded ? "Show less" : "Show all"}{scheduleExpanded ? <ChevronUp aria-hidden className="size-4" /> : <ChevronDown aria-hidden className="size-4" />}</button>}
        </div>
        {confirmAllCount > 1 && <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-sm text-emerald-900">{confirmAllCount} assignments need your response.</p><button type="button" aria-label="Confirm all pending" disabled={isConfirmAllPending} onClick={confirmAll} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50">{isConfirmAllPending && <Loader2 aria-hidden className="size-4 animate-spin" />}{isConfirmAllPending ? "Confirming…" : "Confirm all"}</button></div>}
        {actionNotice && <p aria-live="polite" className={`mb-3 rounded-xl border px-3 py-2 text-sm ${actionNotice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{actionNotice.message}</p>}
        {assignments.length ? <>
          <HomeDayGroups assignments={assignments.slice(0, 3)} allAssignments={assignments} featured onSelect={(assignment, button) => { returnFocusRef.current = button; setSelectedId(assignment.assignmentReference); }} />
          {assignments.length > 3 && <div id="volunteer-inline-schedule" className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${scheduleExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!scheduleExpanded} inert={!scheduleExpanded}>
            <div className="min-h-0 overflow-hidden"><div className="pt-4"><HomeDayGroups assignments={assignments.slice(3)} allAssignments={assignments} featured={false} suppressFirstHeading={assignments[2].startDate === assignments[3].startDate} onSelect={(assignment, button) => { returnFocusRef.current = button; setSelectedId(assignment.assignmentReference); }} /></div></div>
          </div>}
        </> : <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No upcoming assignments yet. Your published work will appear here.</p>}
      </div> : null}
      {presentation !== "home" ? <div className={presentation === "compact" ? "space-y-3" : "mt-3 space-y-3"}>
        {showMeals && assignments.filter((assignment, index) => assignment.meals?.length && assignments.findIndex(other => other.startDate === assignment.startDate) === index).map(assignment => (
          <section key={assignment.startDate} aria-label={`Meals for ${assignment.startDate}`} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <h2 className="text-sm font-bold">Meals · {formatDate(assignment.startDate)}</h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {assignment.meals?.map(meal => <div key={meal.kind} className="min-w-0 text-sm break-words">
                <h3 className="font-semibold">{meal.kind === "breakfast" ? "Breakfast" : "Lunch"}</h3>
                {meal.startTime ? <p>{formatScheduleClockRange(meal.startTime, meal.endTime)}</p> : null}
                {meal.provider ? <p>{meal.provider}</p> : null}
                {meal.menu ? <p className="mt-1 whitespace-pre-wrap">{meal.menu}</p> : null}
              </div>)}
            </div>
          </section>
        ))}
        {showConfirmAll && confirmAllCount > 1 ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 sm:px-4 sm:py-2.5">
            <p className="text-xs font-medium leading-5 text-emerald-900 sm:text-sm">
              {confirmAllCount} assignments need your response.
            </p>
            <button
              aria-label="Confirm all pending"
              type="button"
              onClick={confirmAll}
              disabled={isConfirmAllPending}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-200"
            >
              {isConfirmAllPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="size-4" />
              )}
              Confirm all
            </button>
          </div>
        ) : null}
        {actionNotice ? (
          <div
            aria-live="polite"
            className={`rounded-xl border px-3 py-2.5 text-sm leading-6 ${
              actionNotice.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {actionNotice.message}
          </div>
        ) : null}
        <div className={presentation === "compact" || presentation === "next" ? "grid gap-2" : "overflow-hidden rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)]"}>
        {assignments.map((assignment) => {
          if (presentation === "compact") return (
            <button
              key={assignment.assignmentReference}
              type="button"
              onClick={(event) => {
                returnFocusRef.current = event.currentTarget;
                setSelectedId(assignment.assignmentReference);
              }}
              className="grid min-h-11 w-full min-w-0 grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-[var(--pl-border)] bg-blue-50/40 px-3 py-3 text-left hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-4"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]"><CalendarDays aria-hidden="true" className="size-4" strokeWidth={1.8} /></span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 max-w-full break-words text-sm font-semibold text-[var(--pl-ink)]">{assignment.taskTitle}</span>
                  <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${responseStyles[assignment.currentResponseStatus]}`}>{responseLabels[assignment.currentResponseStatus]}</span>
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--pl-muted)]">{cardDateTimeLabel(assignment)}</span>
                {assignment.fellowWorkerNames.length > 0 && <span className="mt-1 block break-words text-xs leading-5 text-[var(--pl-text)]">{assignment.fellowWorkerNames.length === 1 ? "Fellow worker" : "Fellow workers"} · {assignment.fellowWorkerNames.join(", ")}</span>}
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--pl-blue)]">View assignment details <ArrowRight aria-hidden className="size-3.5" /></span>
              </span>
            </button>
          );
          const isNext = presentation !== "next" && assignment.currentResponseStatus !== "declined" && !assignments.some(
            (other) => other.currentResponseStatus !== "declined" && other.assignmentReference !== assignment.assignmentReference && other.startDate < assignment.startDate,
          );
          return (
          <button
            key={assignment.assignmentReference}
            ref={(node) => {
              if (assignment.assignmentReference === selectedId && node) {
                returnFocusRef.current = node;
              }
            }}
            type="button"
            onClick={(event) => {
              returnFocusRef.current = event.currentTarget;
              setSelectedId(assignment.assignmentReference);
            }}
            className={[
              "group grid w-full min-w-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-[var(--pl-border)] text-left transition first:border-t-0 hover:bg-[var(--pl-surface-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
              presentation === "next" ? "sm:grid" : "sm:flex sm:gap-3",
              presentation === "next"
                ? "rounded-xl border border-[var(--pl-border)] bg-[linear-gradient(115deg,rgba(234,242,255,.75),rgba(255,255,255,1)_68%)] px-4 py-3 shadow-[var(--pl-shadow-card)] first:border-t sm:px-5"
                : isNext
                ? "bg-[linear-gradient(115deg,rgba(234,242,255,.95),rgba(255,255,255,1)_64%,rgba(242,237,255,.7))] p-4 sm:p-5"
                : "px-3.5 py-3 sm:px-4",
            ].join(" ")}
          >
            <span className={isNext ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--pl-blue)] text-white shadow-[0_8px_18px_rgba(23,105,255,.22)]" : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]"}>
              <CalendarDays aria-hidden="true" className={isNext ? "size-5" : "size-4"} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              {isNext ? (
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">Next assignment</span>
              ) : null}
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={isNext ? "min-w-0 max-w-full break-words text-lg font-bold tracking-[-0.02em] text-[var(--pl-ink)]" : presentation === "next" ? "min-w-0 max-w-full break-words text-base font-semibold text-[var(--pl-ink)]" : "min-w-0 max-w-full break-words text-sm font-semibold text-[var(--pl-ink)]"}>{assignment.taskTitle}</span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${responseStyles[assignment.currentResponseStatus]}`}
                >
                  {responseLabels[assignment.currentResponseStatus]}
                </span>
              </span>
              <span className={isNext || presentation === "next" ? "mt-1 block text-sm leading-5 text-[var(--pl-text)]" : "mt-0.5 block text-xs leading-5 text-[var(--pl-muted)]"}>
                {cardDateTimeLabel(assignment)}
              </span>
              {assignment.fellowWorkerNames.length > 0 && <span className="mt-1 block break-words text-xs leading-5 text-[var(--pl-text)]">{assignment.fellowWorkerNames.length === 1 ? "Fellow worker" : "Fellow workers"} · {assignment.fellowWorkerNames.join(", ")}</span>}
              {presentation !== "next" && (hasFollowUpContact(assignment) || presentation === "default") ? <span className="mt-0.5 block text-xs leading-5 text-[var(--pl-muted)]">
                {hasFollowUpContact(assignment)
                  ? `Follow-up: ${assignment.followUpContact.displayName ?? "Project contact"}`
                  : "Open for assignment details"}
              </span> : null}
            </span>
            <span className={`col-start-2 inline-flex shrink-0 items-center gap-1 rounded-lg py-1 text-[11px] font-semibold text-[var(--pl-blue)] ${presentation === "next" ? "sm:px-0" : "sm:self-center sm:px-2"}`}>
              {presentation === "next" ? <span className="text-sm">View assignment details</span> : assignment.currentResponseStatus === "declined" ? <span>Change response</span> : assignment.currentResponseStatus === "needs_response" ? (
                <span>Review &amp; respond</span>
              ) : null}
              <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </button>
          );
        })}
        </div>
      </div> : null}

      {selected ? (
        <div
          aria-labelledby="assignment-detail-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end overflow-hidden overscroll-none p-0 sm:items-center sm:p-6"
          role="dialog"
        >
          <button
            aria-label="Close assignment details backdrop"
            className="absolute inset-0 bg-slate-950/24"
            onClick={() => setSelectedId(null)}
            tabIndex={-1}
            type="button"
          />
          <div
            ref={dialogRef}
            data-testid="volunteer-assignment-detail-panel"
            tabIndex={-1}
            className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-raised)] sm:mx-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl"
          >
            <div className="relative z-10 flex shrink-0 items-start justify-between gap-4 border-b border-[var(--pl-border)] bg-white px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-6">
              <div>
                <p className="text-xs font-semibold text-[var(--pl-blue)]">Assignment details</p>
                <h2
                  id="assignment-detail-title"
                  className="mt-1 text-2xl font-bold tracking-[-0.04em] text-[var(--pl-ink)]"
                >
                  {selected.taskTitle}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--pl-muted)]">{dateTimeLabel(selected)}</p>
                <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${responseStyles[selected.currentResponseStatus]}`}>{responseLabels[selected.currentResponseStatus]}</span>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--pl-border)] text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Close assignment details"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div
              data-testid="volunteer-assignment-detail-scroll"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6"
            >
              {hasFollowUpContact(selected) && <div className="rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-3 text-sm leading-6 text-slate-800">
                <h3 className="font-semibold text-[var(--pl-ink)]">Follow-up Contact</h3>
                <p>{selected.followUpContact.displayName ?? "Project contact"}</p>
                <div className="flex gap-4">
                  {selected.followUpContact.email && <a className="font-semibold text-sky-700" href={`mailto:${selected.followUpContact.email}`}>Email</a>}
                  {selected.followUpContact.phone && <a className="font-semibold text-sky-700" href={`sms:${selected.followUpContact.phone}`}>Text</a>}
                </div>
              </div>}

              {selected.scheduleNotes?.trim() ? (
                <DisclosureSection className="mt-4" summary="Instructions">
                  <p className="whitespace-pre-wrap break-words">{selected.scheduleNotes}</p>
                </DisclosureSection>
              ) : null}

              {selected.fellowWorkerNames.length > 0 ? (
                <section className="mt-4 rounded-xl border border-[var(--pl-border)] p-3" aria-label={selected.fellowWorkerNames.length === 1 ? "Fellow worker" : "Fellow workers"}>
                  <h3 className="text-sm font-semibold text-slate-950">{selected.fellowWorkerNames.length === 1 ? "Fellow worker" : "Fellow workers"}</h3>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
                    {selected.fellowWorkerNames.map((name, index) => <li key={`${name}-${index}`} className="break-words">{name}</li>)}
                  </ul>
                </section>
              ) : null}

              {selected.responseNote ? (
                <section className="mt-4 border-l-2 border-violet-200 bg-violet-50/45 px-3 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-950">Your note</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {selected.responseNote}
                  </p>
                </section>
              ) : null}

              <ResponseActions
                key={selected.assignmentReference}
                assignment={selected}
                isPending={
                  isResponsePending && pendingAssignmentId === selected.assignmentReference
                }
                onSubmit={submitResponse}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ResponseActions({
  assignment,
  isPending,
  onSubmit,
}: Readonly<{
  assignment: VolunteerScheduleAssignment;
  isPending: boolean;
  onSubmit: (
    assignment: VolunteerScheduleAssignment,
    status: "confirmed" | "declined",
    note?: string | null,
  ) => void;
}>) {
  const [declineNote, setDeclineNote] = useState("");
  const [declineOpen, setDeclineOpen] = useState(false);
  const declineTriggerRef = useRef<HTMLButtonElement>(null);
  const declineNoteRef = useRef<HTMLTextAreaElement>(null);
  const restoreDeclineFocusRef = useRef(false);
  useEffect(() => { if (declineOpen) declineNoteRef.current?.focus(); }, [declineOpen]);
  useEffect(() => { if (!declineOpen && restoreDeclineFocusRef.current) { restoreDeclineFocusRef.current = false; declineTriggerRef.current?.focus(); } }, [declineOpen]);
  const canSubmitConfirm =
    assignment.canConfirm && assignment.currentResponseStatus !== "confirmed";
  const canSubmitDecline =
    assignment.canDecline && assignment.currentResponseStatus !== "declined";
  const isStarted = assignment.responseLockReason === "started";
  const isCloseToStart = assignment.responseLockReason === "inside_48_hours";
  const hasContact = hasFollowUpContact(assignment);
  const contactHelp = hasContact ? " Contact your Follow-up Contact." : "";
  const lockCopy = isStarted
    ? "This assignment has already started, so responses are locked."
    : isCloseToStart && canSubmitConfirm
      ? hasContact ? "A response is still needed. You can still confirm. If you can’t make it, contact your Follow-up Contact." : "A response is still needed. You can still confirm. Declining is unavailable this close to the assignment."
      : isCloseToStart
        ? `Response changes are closed this close to the assignment.${contactHelp}`
        : null;

  return (
    <section
      className="mt-4 border-t border-[var(--pl-border)] pt-4"
      aria-labelledby="volunteer-response-actions-title"
    >
      <h3
        id="volunteer-response-actions-title"
        className="text-sm font-semibold text-slate-950"
      >
        Your response
      </h3>
      {lockCopy ? (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900">
          {lockCopy}
        </p>
      ) : null}

      {!isStarted && <div className="mt-3 flex flex-wrap gap-2">
        {canSubmitConfirm && <button type="button" onClick={() => onSubmit(assignment, "confirmed")} disabled={isPending} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50 sm:flex-none">
          {isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}Confirm
        </button>}
        {canSubmitDecline && !isCloseToStart && !declineOpen && <button ref={declineTriggerRef} type="button" onClick={() => setDeclineOpen(true)} disabled={isPending} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--pl-border)] bg-white px-4 text-sm font-semibold text-[var(--pl-text)] shadow-sm hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50 sm:flex-none"><X aria-hidden className="size-4" />Can’t make it</button>}
      </div>}
      {declineOpen && canSubmitDecline && !isStarted && !isCloseToStart && <div className="mt-3 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-3">
        <label className="block text-sm font-semibold text-slate-700">Note <span className="font-normal text-slate-500">(optional)</span>
          <textarea ref={declineNoteRef} value={declineNote} onChange={event => setDeclineNote(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" placeholder="Add a brief note if you can’t make it" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => onSubmit(assignment, "declined", declineNote)} disabled={isPending} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">{isPending ? "Saving…" : "Save Can’t make it"}</button>
          <button type="button" onClick={() => { restoreDeclineFocusRef.current = true; setDeclineOpen(false); }} disabled={isPending} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-[var(--pl-text)] hover:bg-white focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">Cancel</button>
        </div>
      </div>}
    </section>
  );
}
