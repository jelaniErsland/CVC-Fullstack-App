export function Skeleton({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return <div role="status" className="space-y-3 p-4"><span className="sr-only">{label}</span>{Array.from({ length: rows }, (_, i) => <div key={i} aria-hidden="true" className="h-11 animate-pulse rounded-lg bg-[var(--pl-surface-subtle)]" />)}</div>;
}
