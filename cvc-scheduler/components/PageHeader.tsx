import type { ReactNode } from "react";
export function PageHeader({ title, description, context, primaryAction, secondaryActions, className = "" }: {
  title: string; description?: ReactNode; context?: ReactNode; primaryAction?: ReactNode; secondaryActions?: ReactNode; className?: string;
}) {
  return <header className={`flex min-w-0 flex-wrap items-start justify-between gap-4 ${className}`}>
    <div className="min-w-0 flex-1 basis-56"><h1 className="pl-page-title">{title}</h1>
      {description && <div className="mt-2 text-sm leading-6 text-[var(--pl-text)]">{description}</div>}
      {context && <div className="pl-metadata mt-2">{context}</div>}
    </div>
    {(primaryAction || secondaryActions) && <div className="flex max-w-full flex-wrap items-center gap-2">{secondaryActions}{primaryAction}</div>}
  </header>;
}
