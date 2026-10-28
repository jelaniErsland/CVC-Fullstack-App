import type { KeyboardEvent } from "react";

// Native dialog keeps the background inert; explicitly wrap its edge controls
// so browser chrome does not become the next Shift+Tab stop during sheet edits.
export function containVolunteerSheetFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return;
  const dialog = event.currentTarget;
  // Only the first direct summary is a native disclosure control. Leave the
  // browser in charge of intermediate Tab order, including revealed content.
  const controls = [...dialog.querySelectorAll<HTMLElement>('a[href],button,input:not([type="hidden"]),select,textarea,details > summary:first-of-type,[tabindex]')]
    .filter(node => {
      if (node.matches(':disabled,[aria-disabled="true"]')
        || node.closest('[hidden],[inert]')
        || (node.hasAttribute('tabindex') && node.tabIndex < 0)
        || node.getClientRects().length === 0
        || getComputedStyle(node).visibility !== "visible") return false;
      // Some browsers give closed disclosure descendants layout rectangles.
      // Only that disclosure's own summary is reachable until it is expanded.
      for (let parent = node.parentElement; parent && parent !== dialog; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement && !parent.open
          && parent.querySelector(":scope > summary") !== node) return false;
      }
      return true;
    });
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
}
