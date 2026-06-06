import { GlassCard } from "./GlassCard";

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <GlassCard className="p-5 text-center">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
    </GlassCard>
  );
}
