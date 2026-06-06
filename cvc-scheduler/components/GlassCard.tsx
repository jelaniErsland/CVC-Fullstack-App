import type { HTMLAttributes, ReactNode } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function GlassCard({ children, className = "", ...props }: GlassCardProps) {
  return (
    <div
      className={[
        "rounded-lg border border-white/70 bg-white/58 shadow-[0_24px_80px_rgba(15,23,42,0.10)]",
        "backdrop-blur-2xl backdrop-saturate-150",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
