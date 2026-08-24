"use client";

import { useLinkStatus } from "next/link";

type AdminNavigationPendingIndicatorProps = Readonly<{
  compact?: boolean;
  disabled?: boolean;
}>;

/**
 * Must remain a descendant of the Link it describes. The fixed footprint
 * acknowledges a pending client transition without shifting navigation labels.
 */
export function AdminNavigationPendingIndicator({
  compact = false,
  disabled = false,
}: AdminNavigationPendingIndicatorProps) {
  const { pending } = useLinkStatus();
  const visible = pending && !disabled;

  return (
    <span
      aria-hidden="true"
      className={
        compact
          ? "pointer-events-none absolute left-1/2 top-2 z-10 flex size-2.5 translate-x-2 items-center justify-center"
          : "ml-auto flex size-4 shrink-0 items-center justify-center"
      }
      data-navigation-pending={visible ? "true" : "false"}
    >
      <span
        className={[
          "size-2.5 rounded-full border-2 border-[var(--pl-blue)] bg-white transition-opacity duration-150 motion-reduce:transition-none",
          visible
            ? "opacity-100 shadow-[0_0_0_2px_rgba(229,237,255,0.9)] motion-safe:animate-pulse"
            : "opacity-0",
        ].join(" ")}
      />
    </span>
  );
}
