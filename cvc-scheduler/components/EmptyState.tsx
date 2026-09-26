import { GlassCard } from "./GlassCard";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  message: string;
  action?: ReactNode;
  kind?: "empty" | "no-results" | "unavailable" | "denied" | "error";
};

export function EmptyState({ title, message, action, kind = "empty" }: EmptyStateProps) {
  return (
    <GlassCard className="p-5 text-center" data-state={kind}>
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--pl-muted)]">{message}</p>
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </GlassCard>
  );
}
