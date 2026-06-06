import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <main
      className={[
        "relative min-h-screen overflow-hidden px-4 py-5 text-slate-950 sm:px-6 lg:px-8",
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(120deg,rgba(255,255,255,0.92),rgba(225,235,255,0.82)_48%,rgba(248,250,252,1))]" />
      {children}
    </main>
  );
}
