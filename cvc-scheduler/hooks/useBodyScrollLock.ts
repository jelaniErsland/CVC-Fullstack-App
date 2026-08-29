"use client";

import { useEffect } from "react";

let activeLocks = 0;
let previousBodyOverflow = "";
let previousBodyOverscrollBehavior = "";
let previousBodyPaddingRight = "";
let previousRootOverflow = "";
let previousRootOverscrollBehavior = "";

function lockDocumentScroll() {
  if (activeLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    previousBodyPaddingRight = document.body.style.paddingRight;
    previousRootOverflow = document.documentElement.style.overflow;
    previousRootOverscrollBehavior =
      document.documentElement.style.overscrollBehavior;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const currentPaddingRight = Number.parseFloat(
        window.getComputedStyle(document.body).paddingRight,
      );
      document.body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
  }

  activeLocks += 1;
}

function unlockDocumentScroll() {
  activeLocks = Math.max(0, activeLocks - 1);

  if (activeLocks !== 0) {
    return;
  }

  document.body.style.overflow = previousBodyOverflow;
  document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
  document.body.style.paddingRight = previousBodyPaddingRight;
  document.documentElement.style.overflow = previousRootOverflow;
  document.documentElement.style.overscrollBehavior =
    previousRootOverscrollBehavior;
}

export function useBodyScrollLock(enabled: boolean, mediaQuery?: string) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const media = mediaQuery ? window.matchMedia(mediaQuery) : null;
    let locked = false;

    const synchronize = () => {
      const shouldLock = media ? media.matches : true;

      if (shouldLock && !locked) {
        lockDocumentScroll();
        locked = true;
      } else if (!shouldLock && locked) {
        unlockDocumentScroll();
        locked = false;
      }
    };

    synchronize();
    media?.addEventListener("change", synchronize);

    return () => {
      media?.removeEventListener("change", synchronize);
      if (locked) {
        unlockDocumentScroll();
      }
    };
  }, [enabled, mediaQuery]);
}
