import type { KeyboardEvent } from "react";

// Native dialog keeps the background inert; explicitly wrap its edge controls
// so browser chrome does not become the next Shift+Tab stop during sheet edits.
export function containVolunteerSheetFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return;
  const dialog = event.currentTarget;
  const controls = [...dialog.querySelectorAll<HTMLElement>('a[href],button,input:not([type="hidden"]),select,textarea,[tabindex]')]
    .filter(node => !node.matches(':disabled,[tabindex="-1"]') && node.getClientRects().length > 0);
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
}
