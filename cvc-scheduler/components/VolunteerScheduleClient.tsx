"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import type { VolunteerScheduleActionResult } from "@/app/v/schedule/actions";
import { formatScheduleClockRange } from "@/lib/scheduleFormatting";
import type { VolunteerScheduleAssignment } from "@/lib/volunteerScheduleAccess/token";

type VolunteerScheduleClientProps = Readonly<{
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
  declined: "border-slate-200 bg-slate-50 text-slate-600",
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

function hasFollowUpContact(assignment: VolunteerScheduleAssignment) {
  return Boolean(
    assignment.followUpContact.displayName ||
      assignment.followUpContact.email ||
      assignment.followUpContact.phone,
  );
}

export function VolunteerScheduleClient({
  assignments,
  confirmAllAction,
  submitResponseAction,
}: VolunteerScheduleClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const confirmAllCount = assignments.filter(
    (assignment) =>
      assignment.currentResponseStatus === "needs_response" && assignment.canConfirm,
  ).length;

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
      const result = await submitResponseAction(formData);
      setActionNotice(result);
      setPendingAssignmentId(null);
    });
  }

  function confirmAll() {
    setActionNotice(null);
    startConfirmAllTransition(async () => {
      const result = await confirmAllAction();
      setActionNotice(result);
    });
  }

  useEffect(() => {
    if (!selected) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedId(null);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) => !element.hasAttribute("hidden") && element.getClientRects().length > 0,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, [selected]);

  useEffect(() => {
    if (selected) return;
    returnFocusRef.current?.focus();
  }, [selected]);

  return (
    <>
      <div className="mt-3 space-y-3">
        {confirmAllCount > 1 ? (
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
        <div className="overflow-hidden rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)]">
        {assignments.map((assignment, index) => (
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
              "group flex w-full min-w-0 items-start gap-3 border-t border-[var(--pl-border)] text-left transition first:border-t-0 hover:bg-[var(--pl-surface-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500",
              index === 0
                ? "bg-[linear-gradient(115deg,rgba(234,242,255,.95),rgba(255,255,255,1)_64%,rgba(242,237,255,.7))] p-4 sm:p-5"
                : "px-3.5 py-3 sm:px-4",
            ].join(" ")}
          >
            <span className={index === 0 ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--pl-blue)] text-white shadow-[0_8px_18px_rgba(23,105,255,.22)]" : "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]"}>
              <CalendarDays aria-hidden="true" className={index === 0 ? "size-5" : "size-4"} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              {index === 0 ? (
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">Next assignment</span>
              ) : null}
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={index === 0 ? "text-lg font-bold tracking-[-0.02em] text-[var(--pl-ink)]" : "text-sm font-semibold text-[var(--pl-ink)]"}>{assignment.taskTitle}</span>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${responseStyles[assignment.currentResponseStatus]}`}
                >
                  {responseLabels[assignment.currentResponseStatus]}
                </span>
              </span>
              <span className={index === 0 ? "mt-1.5 block text-sm font-medium leading-5 text-[var(--pl-text)]" : "mt-0.5 block text-xs leading-5 text-[var(--pl-muted)]"}>
                {dateTimeLabel(assignment)}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--pl-muted)]">
                {hasFollowUpContact(assignment)
                  ? `Follow-up: ${assignment.followUpContact.displayName ?? "Project contact"}`
                  : "Open for assignment details"}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg px-1.5 py-1 text-[11px] font-semibold text-[var(--pl-blue)] sm:px-2">
              {assignment.currentResponseStatus === "needs_response" ? (
                <span>Review &amp; respond</span>
              ) : null}
              <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </button>
        ))}
        </div>
      </div>

      {selected ? (
        <div
          aria-labelledby="assignment-detail-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end overflow-hidden overscroll-none bg-slate-950/24 p-0 sm:items-center sm:p-6"
          role="dialog"
        >
          <div
            ref={dialogRef}
            data-testid="volunteer-assignment-detail-panel"
            tabIndex={-1}
            className="flex max-h-[100vh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-raised)] sm:mx-auto sm:max-h-[90vh] sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl"
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
              <dl className="grid overflow-hidden rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] sm:grid-cols-2">
                <div className="border-b border-[var(--pl-border)] p-3 sm:border-r">
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <Clock3 aria-hidden="true" className="size-4" />
                    Date and time
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-slate-800">
                    {dateTimeLabel(selected)}
                  </dd>
                </div>
                <div className="border-b border-[var(--pl-border)] p-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Current response
                  </dt>
                  <dd className="mt-2">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${responseStyles[selected.currentResponseStatus]}`}
                    >
                      {responseLabels[selected.currentResponseStatus]}
                    </span>
                  </dd>
                </div>
                <div className="p-3 sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Follow-up Contact
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-slate-800">
                    {hasFollowUpContact(selected) ? (
                      <>
                        {selected.followUpContact.displayName ?? "Project contact"}
                        {selected.followUpContact.email ? (
                          <>
                            <br />
                            <a
                              className="font-semibold text-sky-700"
                              href={`mailto:${selected.followUpContact.email}`}
                            >
                              Email
                            </a>
                          </>
                        ) : null}
                        {selected.followUpContact.phone ? (
                          <>
                            <br />
                            <a
                              className="font-semibold text-sky-700"
                              href={`sms:${selected.followUpContact.phone}`}
                            >
                              Text
                            </a>
                          </>
                        ) : null}
                      </>
                    ) : (
                      "Ask the project team for the best contact."
                    )}
                  </dd>
                </div>
              </dl>

              {selected.scheduleNotes ? (
                <section className="mt-4 border-l-2 border-blue-200 bg-blue-50/45 px-3 py-2.5">
                  <h3 className="text-sm font-semibold text-slate-950">Notes</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {selected.scheduleNotes}
                  </p>
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
  const canSubmitConfirm =
    assignment.canConfirm && assignment.currentResponseStatus !== "confirmed";
  const canSubmitDecline =
    assignment.canDecline && assignment.currentResponseStatus !== "declined";
  const isStarted = assignment.responseLockReason === "started";
  const isCloseToStart = assignment.responseLockReason === "inside_48_hours";
  const lockCopy = isStarted
    ? "This assignment has already started, so responses are locked."
    : isCloseToStart && canSubmitConfirm
      ? "A response is still needed. You can still confirm. If you can’t make it, contact your Follow-up Contact."
      : isCloseToStart
        ? "Need to change your response? Changes are closed this close to the assignment. Contact your Follow-up Contact."
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

      {isStarted || (isCloseToStart && !canSubmitConfirm) ? null : isCloseToStart ? (
        <button
          type="button"
          onClick={() => onSubmit(assignment, "confirmed")}
          disabled={isPending}
          className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-200 sm:w-auto"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
          Confirm
        </button>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onSubmit(assignment, "confirmed")}
              disabled={!canSubmitConfirm || isPending}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-200"
            >
              {isPending && canSubmitConfirm ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="size-4" />
              )}
              {assignment.currentResponseStatus === "confirmed" ? "Confirmed" : "Confirm"}
            </button>
            {canSubmitDecline || assignment.currentResponseStatus === "declined" ? (
              <button
                type="button"
                onClick={() => onSubmit(assignment, "declined", declineNote)}
                disabled={!canSubmitDecline || isPending}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-[var(--pl-border)] bg-white px-4 text-sm font-semibold text-[var(--pl-text)] shadow-sm transition hover:bg-[var(--pl-surface-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                <X aria-hidden="true" className="size-4" />
                Can’t make it
              </button>
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                Need to change? Contact your Follow-up Contact.
              </p>
            )}
          </div>

          {canSubmitDecline ? (
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Notes <span className="font-normal text-slate-400">(optional)</span>
              <textarea
                value={declineNote}
                onChange={(event) => setDeclineNote(event.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                placeholder="Add a brief note if you can’t make it"
              />
            </label>
          ) : null}
        </>
      )}
    </section>
  );
}
