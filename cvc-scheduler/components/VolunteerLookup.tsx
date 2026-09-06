"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { lookupFailureMessage, type LookupProject } from "@/lib/volunteerScheduleAccess/lookup";

const inputClass = "min-h-14 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-950 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100";
const buttonClass = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 disabled:opacity-60";

export function VolunteerLookup() {
  const [step, setStep] = useState<"name" | "contact" | "project">("name");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [projects, setProjects] = useState<LookupProject[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) {
      if (step === "contact") contactRef.current?.focus();
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
        body: JSON.stringify({ name, contact, projectChoice }), cache: "no-store",
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
        setStep("contact");
        setFailed(true);
      }
    } catch {
      setStep("contact");
      setFailed(true);
    } finally { setPending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "name") { setFailed(false); setStep("contact"); }
    else void verify();
  }

  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-slate-950 outline-none sm:text-4xl">
        {step === "name" ? "Find your schedule" : step === "contact" ? "Confirm it’s you" : "Choose a project"}
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
            <label htmlFor={step === "name" ? "lookup-name" : "lookup-contact"} className="mb-2 block text-sm font-medium text-slate-700">
              {step === "name" ? "Full name" : "Email or phone"}
            </label>
            {step === "name" ? (
              <input key="name" id="lookup-name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} className={inputClass} />
            ) : (
              <input key="contact" ref={contactRef} id="lookup-contact" name="contact" type="text" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} value={contact} onChange={(event) => { setContact(event.target.value); setFailed(false); }} required maxLength={254} disabled={pending} aria-invalid={failed || undefined} aria-describedby={failed ? "lookup-error" : undefined} className={inputClass} />
            )}
          </div>
          {failed && <p id="lookup-error" role="alert" className="text-sm leading-6 text-rose-800">{lookupFailureMessage}</p>}
          <button type="submit" disabled={pending || (step === "name" && !name.trim())} className={buttonClass}>
            {pending ? <><Loader2 aria-hidden="true" className="size-4 animate-spin" /> Checking…</> : step === "name" ? "Continue" : "View schedule"}
          </button>
        </form>
      )}
      <div role="status" className="sr-only">{pending ? "Checking your information" : ""}</div>
      {step !== "name" && (
        <button type="button" disabled={pending} onClick={() => { setStep("name"); setContact(""); setProjects([]); setFailed(false); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
          <ArrowLeft aria-hidden="true" className="size-4" /> Start again
        </button>
      )}
    </div>
  );
}
