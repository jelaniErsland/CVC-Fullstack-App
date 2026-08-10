import { useId, type SVGProps } from "react";

export function ProjectLocalMark({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  const gradientId = useId().replaceAll(":", "");

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 48 56"
      fill="none"
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="7" y1="5" x2="42" y2="51">
          <stop stopColor="#38BDF8" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M24 2C12.4 2 3 11.1 3 22.3c0 14.9 17 30.4 19.7 32.8.7.6 1.9.6 2.6 0C28 52.7 45 37.2 45 22.3 45 11.1 35.6 2 24 2Z"
        fill={`url(#${gradientId})`}
      />
      <circle cx="24" cy="18" r="5" fill="white" />
      <circle cx="15.5" cy="21.5" r="3.6" fill="white" fillOpacity=".96" />
      <circle cx="32.5" cy="21.5" r="3.6" fill="white" fillOpacity=".96" />
      <path d="M17.5 34.5v-5.2a6.5 6.5 0 0 1 13 0v5.2c0 2-1.6 3.5-3.5 3.5h-6a3.5 3.5 0 0 1-3.5-3.5Z" fill="white" />
      <path d="M10.5 33v-4a4.5 4.5 0 0 1 6.4-4.1c-.8 1.3-1.2 2.8-1.2 4.4v6.4h-2.1a3.1 3.1 0 0 1-3.1-2.7ZM37.5 33v-4a4.5 4.5 0 0 0-6.4-4.1c.8 1.3 1.2 2.8 1.2 4.4v6.4h2.1a3.1 3.1 0 0 0 3.1-2.7Z" fill="white" fillOpacity=".96" />
    </svg>
  );
}

export function ProjectLocalBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <ProjectLocalMark className="h-9 w-8 shrink-0 drop-shadow-[0_6px_12px_rgba(59,130,246,0.18)]" />
      <span className={compact ? "sr-only" : "truncate text-[17px] font-bold tracking-[-0.035em] text-[var(--pl-ink)]"}>
        Project Local
      </span>
    </span>
  );
}
