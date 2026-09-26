import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  as?: "main" | "div";
};

export function PageShell({ children, className = "", as: Container = "main" }: PageShellProps) {
  return (
    <Container
      className={[
        "relative min-h-screen overflow-x-hidden text-[var(--pl-ink)]",
        className,
      ].join(" ")}
    >
      {children}
    </Container>
  );
}
