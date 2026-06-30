"use client";

import { useState } from "react";

type ConfirmationState = "pending" | "confirmed" | "unavailable";

const statusCopy: Record<ConfirmationState, { label: string; className: string; message: string }> = {
  pending: {
    label: "Needs reply",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    message: "Let the project contact know whether you can make this assignment.",
  },
  confirmed: {
    label: "Confirmed",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    message: "Preview updated: you can make this assignment.",
  },
  unavailable: {
    label: "Can't make it",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    message: "Preview updated: the project contact would be told you cannot make it.",
  },
};

export function VolunteerConfirmationPreview() {
  const [status, setStatus] = useState<ConfirmationState>("pending");
  const current = statusCopy[status];

  return (
    <div className="border-t border-slate-200/70 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
      <div>
        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${current.className}`}>
          {current.label}
        </span>
        <p aria-live="polite" className="mt-2 text-xs leading-5 text-slate-500">
          {current.message} This preview does not send a response and resets when you leave.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-0 sm:flex">
        <button
          type="button"
          onClick={() => setStatus("confirmed")}
          disabled={status === "confirmed"}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-default disabled:bg-emerald-700"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setStatus("unavailable")}
          disabled={status === "unavailable"}
          className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white/80 px-5 text-sm font-semibold text-slate-700 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-500"
        >
          Can&apos;t make it
        </button>
      </div>
    </div>
  );
}
