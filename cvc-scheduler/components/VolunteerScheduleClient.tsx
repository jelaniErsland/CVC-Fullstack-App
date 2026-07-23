"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock3,
  LogOut,
  MessageCircle,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { VolunteerScheduleAssignment } from "@/lib/volunteerScheduleAccess/token";

type VolunteerScheduleClientProps = Readonly<{
  assignments: readonly VolunteerScheduleAssignment[];
  leaveAction: () => Promise<void>;
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
  leaveAction,
}: VolunteerScheduleClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const selected = assignments.find(
    (assignment) => assignment.assignmentReference === selectedId,
  );

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
              Confirm/Deny actions are not active here yet. This schedule is read-only
              for 12.20.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
