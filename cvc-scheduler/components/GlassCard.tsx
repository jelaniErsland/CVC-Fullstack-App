import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function GlassCard({ children, className = "", ...props }: GlassCardProps) {
  return (
    <div
      className={[
        "rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-[var(--pl-surface)] shadow-[var(--pl-shadow-panel)]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
