"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  LogOut,
  MessageCircle,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import type { VolunteerScheduleActionResult } from "@/app/v/schedule/actions";
import type { VolunteerScheduleAssignment } from "@/lib/volunteerScheduleAccess/token";

type VolunteerScheduleClientProps = Readonly<{
  assignments: readonly VolunteerScheduleAssignment[];
  confirmAllAction: () => Promise<VolunteerScheduleActionResult>;
  leaveAction: () => Promise<void>;
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

function formatTime(value: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}

function dateTimeLabel(assignment: VolunteerScheduleAssignment) {
  const dateLabel = assignment.endDate
    ? `${formatDate(assignment.startDate)} – ${formatDate(assignment.endDate)}`
    : formatDate(assignment.startDate);
  const start = formatTime(assignment.startTime);
  const end = formatTime(assignment.endTime);
  return `${dateLabel} · ${start ? `${start}${end ? `–${end}` : ""}` : "No specific time"}`;
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
  leaveAction,
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
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  useEffect(() => {
    if (selected) return;
    returnFocusRef.current?.focus();
  }, [selected]);

  return (
    <>
      <div className="divide-y divide-slate-200/80 border-y border-slate-200/80">
        {confirmAllCount > 1 ? (
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-600">
              {confirmAllCount} assignments are waiting for your reply.
            </p>
            <button
              type="button"
              onClick={confirmAll}
              disabled={isConfirmAllPending}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-200"
            >
              {isConfirmAllPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Check aria-hidden="true" className="size-4" />
              )}
              Confirm all pending
            </button>
          </div>
        ) : null}
        {actionNotice ? (
          <div
            aria-live="polite"
            className={`my-4 rounded-2xl border p-4 text-sm leading-6 ${
              actionNotice.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {actionNotice.message}
          </div>
        ) : null}
        {assignments.map((assignment) => (
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
            className="group flex w-full min-w-0 items-center gap-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <CalendarDays
              aria-hidden="true"
              className="size-5 shrink-0 text-slate-400"
              strokeWidth={1.7}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-slate-900">{assignment.taskTitle}</span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${responseStyles[assignment.currentResponseStatus]}`}
                >
                  {responseLabels[assignment.currentResponseStatus]}
                </span>
              </span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                {dateTimeLabel(assignment)}
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                {assignment.activeAssignedCount}/{assignment.neededCount} assigned
              </span>
            </span>
            <span className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-sky-700 group-hover:text-sky-900 sm:inline-flex">
              Details <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </button>
        ))}
      </div>

      <form action={leaveAction} className="mt-8">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Not you? Leave this schedule
        </button>
      </form>

      {selected ? (
        <div
          aria-labelledby="assignment-detail-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end bg-slate-950/28 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
        >
          <div
            ref={dialogRef}
            className="max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] border border-white/80 bg-white p-6 shadow-[0_32px_110px_rgba(15,23,42,0.22)] sm:mx-auto sm:max-w-2xl sm:rounded-[2rem] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-sky-700">Assignment details</p>
                <h2
                  id="assignment-detail-title"
                  className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950"
                >
                  {selected.taskTitle}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setSelectedId(null)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-label="Close assignment details"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  <Clock3 aria-hidden="true" className="size-4" />
                  Date and time
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-800">
                  {dateTimeLabel(selected)}
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
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
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Coverage
                </dt>
                <dd className="mt-2 text-sm leading-6 text-slate-800">
                  {selected.activeAssignedCount}/{selected.neededCount} assigned
                  <br />
                  {selected.confirmedCount} confirmed · {selected.declinedCount} can’t make it
                </dd>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
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
                    "The project team will include contact details in a later beta slice."
                  )}
                </dd>
              </div>
            </dl>

            {selected.scheduleNotes ? (
              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-950">Notes</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {selected.scheduleNotes}
                </p>
              </section>
            ) : null}

            <p className="mt-6 flex gap-2 rounded-2xl bg-sky-50 p-4 text-sm leading-6 text-sky-900">
              <MessageCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Responses are saved to the project schedule. If you need to decline
              within 48 hours of the start time, please contact the project team.
            </p>

            {selected.responseNote ? (
              <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
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
  const lockCopy =
    assignment.responseLockReason === "started"
      ? "This assignment has already started, so responses are locked."
      : assignment.responseLockReason === "inside_48_hours"
        ? "This assignment starts within 48 hours. You can still confirm, but please contact the project team if you can’t make it."
        : null;

  return (
    <section
      className="mt-6 rounded-[1.35rem] border border-slate-200 bg-white p-4 sm:p-5"
      aria-labelledby="volunteer-response-actions-title"
    >
      <h3
        id="volunteer-response-actions-title"
        className="text-sm font-semibold text-slate-950"
      >
        Your response
      </h3>
      {lockCopy ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{lockCopy}</p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSubmit(assignment, "confirmed")}
          disabled={!canSubmitConfirm || isPending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-emerald-200"
        >
          {isPending && canSubmitConfirm ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
          {assignment.currentResponseStatus === "confirmed" ? "Confirmed" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => onSubmit(assignment, "declined", declineNote)}
          disabled={!canSubmitDecline || isPending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <X aria-hidden="true" className="size-4" />
          {assignment.currentResponseStatus === "declined"
            ? "Can’t make it"
            : "Can’t make it"}
        </button>
      </div>

      {canSubmitDecline ? (
        <label className="mt-4 block text-sm font-semibold text-slate-700">
          Note for the project team{" "}
          <span className="font-normal text-slate-400">(optional)</span>
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
    </section>
  );
}
