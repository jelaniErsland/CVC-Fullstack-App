import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function DisclosureSection({ summary, children, className = "" }: { summary: ReactNode; children: ReactNode; className?: string }) {
  return <details className={`group rounded-xl border border-[var(--pl-border)] bg-white ${className}`}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2 text-sm font-semibold text-[var(--pl-ink)] [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pl-blue)]">
      <span className="min-w-0 flex-1">{summary}</span>
      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-[var(--pl-muted)] transition-transform group-open:rotate-180" />
    </summary>
    <div className="border-t border-[var(--pl-border)] px-4 py-3 text-sm leading-6 text-[var(--pl-text)]">{children}</div>
  </details>;
}
