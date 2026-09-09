"use client";

import { ArrowLeft, ArrowRight, Info, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { lookupFailureMessage, type LookupProject } from "@/lib/volunteerScheduleAccess/lookup";

const inputClass = "min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1769ff] to-[#0f9f94] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(23,105,255,0.22)] transition hover:from-[#1358d9] hover:to-[#0d877f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 disabled:opacity-60";

export function VolunteerLookup() {
  const [step, setStep] = useState<"contact" | "lastName" | "project">("contact");
  const [lastName, setLastName] = useState("");
  const [contact, setContact] = useState("");
  const [projects, setProjects] = useState<LookupProject[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      if (step === "contact") contactRef.current?.focus();
      else if (step === "lastName") lastNameRef.current?.focus();
      else headingRef.current?.focus();
      previousStep.current = step;
    }
  }, [step]);

  async function verify(projectChoice?: string) {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch("/v/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastName, contact, projectChoice }), cache: "no-store",
      });
      const result = await response.json();
      if (response.ok && result.status === "verified") {
        setContact("");
        window.location.assign("/v/schedule");
        return;
      }
      if (response.ok && result.status === "choose_project" && Array.isArray(result.projects)) {
        setProjects(result.projects);
        setStep("project");
      } else {
        setProjects([]);
        setStep("lastName");
        setFailed(true);
      }
    } catch {
      setStep("lastName");
      setFailed(true);
    } finally { setPending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "contact") { setFailed(false); setStep("lastName"); }
    else void verify();
  }

  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-slate-950 outline-none sm:text-4xl">
        {step === "contact" ? "Find your schedule" : step === "lastName" ? "Confirm it’s you" : "Choose a project"}
      </h1>
      {step === "project" ? (
        <div aria-busy={pending} className="mt-8 space-y-3">
          {projects.map((project) => (
            <button key={project.choice} type="button" className={buttonClass} disabled={pending} onClick={() => void verify(project.choice)}>
              <span className="min-w-0 break-words">{project.name}</span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5" aria-busy={pending}>
          <div>
            <label htmlFor={step === "contact" ? "lookup-contact" : "lookup-last-name"} className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              {step === "contact" ? "Email or phone number" : "Last name"}
              {step === "contact" ? <span className="group relative inline-flex"><Info aria-hidden="true" className="size-3.5 text-slate-400" /><span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-slate-800 px-2.5 py-2 text-xs font-normal leading-5 text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100">Use the email or phone number you gave on your questionnaire or to the project contact.</span><span className="sr-only">Use the contact information you gave to the project.</span></span> : null}
            </label>
            {step === "contact" ? (
              <input aria-label="Email or phone number" key="contact" ref={contactRef} id="lookup-contact" name="contact" type="text" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} value={contact} onChange={(event) => { setContact(event.target.value); setFailed(false); }} required maxLength={254} disabled={pending} aria-invalid={failed || undefined} aria-describedby={failed ? "lookup-error" : undefined} className={inputClass} />
            ) : (
              <input ref={lastNameRef} id="lookup-last-name" name="lastName" autoComplete="family-name" value={lastName} onChange={(event) => { setLastName(event.target.value); setFailed(false); }} required maxLength={160} disabled={pending} aria-invalid={failed || undefined} aria-describedby={failed ? "lookup-error" : undefined} className={inputClass} />
            )}
          </div>
          {failed && <p id="lookup-error" role="alert" className="text-sm leading-6 text-rose-800">{lookupFailureMessage}</p>}
          <button type="submit" disabled={pending || (step === "contact" ? !contact.trim() : !lastName.trim())} className={buttonClass}>
            {pending ? <><Loader2 aria-hidden="true" className="size-4 animate-spin" /> Checking…</> : step === "contact" ? "Continue" : "Find schedule"}
          </button>
        </form>
      )}
      <div role="status" className="sr-only">{pending ? "Checking your information" : ""}</div>
      {step !== "contact" && (
        <button type="button" disabled={pending} onClick={() => { setStep("contact"); setLastName(""); setProjects([]); setFailed(false); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
          <ArrowLeft aria-hidden="true" className="size-4" /> Start again
        </button>
      )}
    </div>
  );
}
