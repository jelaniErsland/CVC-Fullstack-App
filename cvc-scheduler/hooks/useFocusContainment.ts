"use client";

import type { RefObject } from "react";
import { useEffect } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function isVisibleFocusable(element: HTMLElement) {
  const style = window.getComputedStyle(element);

  return (
    element.tabIndex >= 0 &&
    !element.closest("[inert]") &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    element.getClientRects().length > 0
  );
}

function getVisibleContainer(
  primaryRef: RefObject<HTMLElement | null>,
  secondaryRef?: RefObject<HTMLElement | null>,
) {
  return [primaryRef.current, secondaryRef?.current].find(
    (container): container is HTMLElement =>
      Boolean(container && container.getClientRects().length > 0),
  );
}

export function useFocusContainment(
  enabled: boolean,
  primaryRef: RefObject<HTMLElement | null>,
  secondaryRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const container = getVisibleContainer(primaryRef, secondaryRef);

      if (!container) {
        return;
      }

      const focusableElements = Array.from(
        container.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter(isVisibleFocusable);
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements.at(-1);

      if (!firstFocusable || !lastFocusable) {
        event.preventDefault();
        container.focus();
        return;
      }

      const activeElement = document.activeElement;
      const focusIsOutside = !container.contains(activeElement);

      if (event.shiftKey && (activeElement === firstFocusable || focusIsOutside)) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastFocusable || focusIsOutside)
      ) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, primaryRef, secondaryRef]);
}
