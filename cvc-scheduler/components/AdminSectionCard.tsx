import { GlassCard } from "./GlassCard";

type AdminSectionCardProps = {
  title: string;
  description: string;
};

export function AdminSectionCard({ title, description }: AdminSectionCardProps) {
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex min-h-32 flex-col justify-between gap-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Coming soon
        </span>
      </div>
    </GlassCard>
  );
}
