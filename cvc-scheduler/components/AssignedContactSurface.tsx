"use client";

import { Mail, MessageSquare, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readAssignedContactAction } from "@/app/admin/calendar/assigned-contact-actions";
import { readSharedAssignedContactAction } from "@/app/qv/assigned-contact-actions";
import type { AssignedContactResult } from "@/lib/calendar/assignedContact.server";
import { useFocusContainment } from "@/hooks/useFocusContainment";
import { MobileOverlaySheet } from "./MobileOverlaySheet";

function ContactDetails({ result, quickView }: { result: AssignedContactResult | null; quickView: boolean }) {
  if (!result) return <p className="text-sm text-slate-600" role="status">Loading contact…</p>;
  if (result.kind !== "ready") return <p className="text-sm text-slate-600" role="status">This assigned volunteer is no longer available to view.</p>;
  const { contact } = result;
  const phoneHref = contact.phone?.replace(/[^+\d]/g, "") ?? "";
  const emailHref = contact.email && !/[\r\n]/.test(contact.email) ? `mailto:${contact.email}` : "";
  return <div className="space-y-4" data-testid="assigned-contact-details">
    <div>
      <p className="break-words text-lg font-bold text-slate-950">{contact.name}</p>
      <p className="mt-1 text-sm text-slate-600">{contact.congregation || "Congregation not listed"}</p>
    </div>
    <dl className="space-y-2 text-sm">
      <div><dt className="font-semibold text-slate-500">Phone</dt><dd className="break-all font-medium text-slate-900">{contact.phone || "Not listed"}</dd></div>
      <div><dt className="font-semibold text-slate-500">Email</dt><dd className="break-all font-medium text-slate-900">{contact.email || "Not listed"}</dd></div>
      {!quickView && result.responseStatus ? <div><dt className="font-semibold text-slate-500">Response to this assignment</dt><dd className="font-medium text-slate-900">{result.responseStatus === "confirmed" ? "Confirmed" : result.responseStatus === "declined" ? "Can't make it" : "Awaiting reply"}</dd></div> : null}
    </dl>
    {(phoneHref || emailHref) && <div className="flex flex-wrap gap-2">
      {phoneHref && <><a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[var(--pl-blue)] focus-visible:ring-2 focus-visible:ring-blue-500" href={`tel:${phoneHref}`}><Phone aria-hidden="true" className="size-4" />Call</a><a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[var(--pl-blue)] focus-visible:ring-2 focus-visible:ring-blue-500" href={`sms:${phoneHref}`}><MessageSquare aria-hidden="true" className="size-4" />Text</a></>}
      {emailHref && <a className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-[var(--pl-blue)] focus-visible:ring-2 focus-visible:ring-blue-500" href={emailHref}><Mail aria-hidden="true" className="size-4" />Email</a>}
    </div>}
    {!quickView && result.upcoming && result.upcoming.length > 0 && <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Other assignments</p>
      <ul className="mt-2 space-y-2 text-sm text-slate-700">{result.upcoming.map((item, index) => <li className="rounded-lg bg-slate-50 px-3 py-2" key={`${item.date}:${item.title}:${index}`}><span className="font-semibold">{item.title}</span><span className="ml-2 text-slate-500">{item.date}</span></li>)}</ul>
    </div>}
  </div>;
}

export function AssignedContactSurface({ assignmentId, projectReference, projectDate, mode, onClose }: {
  assignmentId: string;
  projectReference?: string;
  projectDate: string;
  mode: "calendar" | "quickView" | "shared";
  onClose: () => void;
}) {
  const [result, setResult] = useState<AssignedContactResult | null>(null);
  const desktopRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusContainment(true, desktopRef);
  useEffect(() => {
    let current = true;
    const request = mode === "shared"
      ? readSharedAssignedContactAction(assignmentId, projectDate)
      : projectReference
        ? readAssignedContactAction(assignmentId, projectReference, mode === "quickView")
        : Promise.resolve({ kind: "unavailable" } as const);
    request
      .then(value => { if (current) setResult(value); })
      .catch(() => { if (current) setResult({ kind: "unavailable" }); });
    return () => { current = false; };
  }, [assignmentId, projectReference, projectDate, mode]);
  useEffect(() => {
    if (window.matchMedia("(min-width: 640px)").matches) closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const body = <ContactDetails quickView={mode !== "calendar"} result={result} />;
  return <>
    <div className="fixed inset-0 z-[80] hidden sm:block" data-testid="assigned-contact-desktop">
      <button aria-label="Close volunteer contact backdrop" className="absolute inset-0 bg-slate-950/20" onClick={onClose} tabIndex={-1} type="button" />
      <aside aria-label="Assigned volunteer contact" aria-modal="true" className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl" ref={desktopRef} role="dialog" tabIndex={-1}>
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-base font-bold text-slate-950">Volunteer contact</h2><button aria-label="Close volunteer contact" className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500" onClick={onClose} ref={closeRef} type="button"><X aria-hidden="true" className="size-5" /></button></header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{body}</div>
      </aside>
    </div>
    <MobileOverlaySheet label="Assigned volunteer contact" onClose={onClose} open title="Volunteer contact">{body}</MobileOverlaySheet>
  </>;
}
