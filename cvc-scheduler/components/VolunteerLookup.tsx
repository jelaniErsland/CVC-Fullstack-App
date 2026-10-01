"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { lookupFailureMessage, type LookupVolunteer } from "@/lib/volunteerScheduleAccess/lookup";

const inputClass = "min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1769ff] to-[#0f9f94] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(23,105,255,0.22)] transition hover:from-[#1358d9] hover:to-[#0d877f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 disabled:opacity-60";

export function VolunteerLookup() {
  const [contact, setContact] = useState("");
  const [volunteers, setVolunteers] = useState<LookupVolunteer[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (volunteers.length) headingRef.current?.focus(); }, [volunteers]);

  async function lookup(choice?: string) {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/v/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, choice }), cache: "no-store",
      });
      const result = await response.json();
      if (response.ok && result.status === "verified") {
        setContact("");
        window.location.assign("/v/schedule");
        return;
      }
      if (response.ok && result.status === "choose_volunteer" && Array.isArray(result.volunteers)) {
        setVolunteers(result.volunteers);
      } else {
        setVolunteers([]);
        setFailed(true);
      }
    } catch {
      setVolunteers([]);
      setFailed(true);
    } finally { setPending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void lookup(); }
  return <div>
    <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-slate-950 outline-none sm:text-4xl">{volunteers.length ? "Who are you?" : "Find your schedule"}</h1>
    {volunteers.length ? <div aria-busy={pending} className="mt-8 space-y-3">
      {volunteers.map(volunteer => <button key={volunteer.choice} type="button" className={`${buttonClass} flex-col items-start text-left`} disabled={pending} onClick={() => void lookup(volunteer.choice)}>
        <span className="flex w-full items-center justify-between gap-2"><span className="min-w-0 break-words">{volunteer.name}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></span>
        <span className="text-xs font-normal">{volunteer.project}{volunteer.congregation ? ` · ${volunteer.congregation}` : ""}</span>
      </button>)}
      <button type="button" disabled={pending} onClick={() => { setVolunteers([]); setFailed(false); contactRef.current?.focus(); }} className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600"><ArrowLeft aria-hidden="true" className="size-4" /> Use another email or phone</button>
    </div> : <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={pending}>
      <label htmlFor="lookup-contact" className="block text-sm font-medium text-slate-700">Email or phone number</label>
      <input aria-label="Email or phone number" ref={contactRef} id="lookup-contact" name="contact" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={contact} onChange={event => { setContact(event.target.value); setFailed(false); }} required maxLength={254} disabled={pending} aria-invalid={failed || undefined} aria-describedby={failed ? "lookup-error" : undefined} className={inputClass} />
      {failed && <p id="lookup-error" role="alert" className="text-sm leading-6 text-rose-800">{lookupFailureMessage}</p>}
      <button type="submit" disabled={pending || !contact.trim()} className={buttonClass}>{pending ? <><Loader2 aria-hidden="true" className="size-4 animate-spin" /> Checking…</> : "Open schedule"}</button>
      <p className="text-xs leading-5 text-slate-600">If this contact is shared, choose your name on the next screen. Project Local uses contact-based access for volunteers on this device.</p>
    </form>}
    <div role="status" className="sr-only">{pending ? "Checking your information" : ""}</div>
  </div>;
}
