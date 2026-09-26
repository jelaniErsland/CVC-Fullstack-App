import type { HTMLAttributes, ReactNode } from "react";
export function Panel({ children, className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className={`min-w-0 rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)] ${className}`}>{children}</section>;
}
export function SectionHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--pl-border)] px-4 py-4 sm:px-6">
    <div className="min-w-0"><h2 className="pl-section-title">{title}</h2>{description && <div className="pl-metadata mt-1">{description}</div>}</div>
    {action && <div className="max-w-full">{action}</div>}
  </header>;
}
