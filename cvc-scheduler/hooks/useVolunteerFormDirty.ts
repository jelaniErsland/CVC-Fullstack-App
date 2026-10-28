"use client";

import { useEffectEvent, useLayoutEffect, useRef } from "react";
import { volunteerFormFingerprint } from "@/lib/volunteers/formState";

function fingerprint(form: HTMLFormElement) {
  const entries: [string, string][] = [];
  // Include disabled controls while saving. FormData would omit the disabled
  // fieldset and incorrectly describe a pending form as a changed draft.
  for (const control of Array.from(form.elements)) {
    if (control instanceof HTMLInputElement) {
      if (!control.name || ["submit", "button", "reset", "file"].includes(control.type)) continue;
      if (["checkbox", "radio"].includes(control.type) && !control.checked) continue;
      entries.push([control.name, control.value]);
    } else if (control instanceof HTMLSelectElement) {
      if (control.name) for (const option of Array.from(control.selectedOptions)) entries.push([control.name, option.value]);
    } else if (control instanceof HTMLTextAreaElement && control.name) entries.push([control.name, control.value]);
  }
  return volunteerFormFingerprint(entries);
}

export function useVolunteerFormDirty(onDirty: (dirty: boolean) => void) {
  const ref = useRef<HTMLFormElement>(null);
  const notify = useEffectEvent(onDirty);
  useLayoutEffect(() => {
    const form = ref.current;
    if (!form) return;
    const initial = fingerprint(form);
    const compare = () => notify(fingerprint(form) !== initial);
    form.addEventListener("input", compare);
    form.addEventListener("change", compare);
    // Custom Skills controls update successful hidden inputs after React commits.
    const observer = new MutationObserver(compare);
    observer.observe(form, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "checked", "selected"] });
    compare();
    return () => { observer.disconnect(); form.removeEventListener("input", compare); form.removeEventListener("change", compare); };
  }, []);
  return ref;
}
