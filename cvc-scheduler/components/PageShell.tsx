import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main
      className={[
        "relative min-h-screen overflow-x-hidden text-[var(--pl-ink)]",
        className,
      ].join(" ")}
    >
      {children}
    </main>
  );
}
