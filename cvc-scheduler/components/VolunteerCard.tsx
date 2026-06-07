import { Button } from "./Button";
import { GlassCard } from "./GlassCard";
import type { Volunteer } from "@/lib/mockData";

type VolunteerCardProps = {
  volunteer: Volunteer;
};

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-white/80 bg-white/64 px-3 py-1 text-xs font-semibold text-slate-600"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export function VolunteerCard({ volunteer }: VolunteerCardProps) {
  const tags = [...volunteer.roles, ...volunteer.skills, ...volunteer.tags];
  const counts = [
    { label: "Confirmed", value: volunteer.assignmentCounts.confirmed },
    { label: "Pending", value: volunteer.assignmentCounts.pending },
    { label: "Denied", value: volunteer.assignmentCounts.denied },
  ];

  return (
    <GlassCard className="flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-white/72 sm:p-6">
      <div>
        <p className="text-sm font-medium text-slate-500">{volunteer.congregation}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          {volunteer.name}
        </h2>
      </div>

      <div className="mt-5 grid gap-2 text-sm leading-6 text-slate-600">
        <a className="break-words hover:text-slate-950" href={`mailto:${volunteer.email}`}>
          {volunteer.email}
        </a>
        <a className="hover:text-slate-950" href={`tel:${volunteer.phone}`}>
          {volunteer.phone}
        </a>
      </div>

      <div className="mt-5">
        <TagList items={tags} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {counts.map((count) => (
          <div key={count.label} className="rounded-lg bg-white/54 p-3 text-center">
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {count.value}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {count.label}
            </p>
          </div>
        ))}
      </div>

      <Button
        href={`/admin/volunteers/${volunteer.id}`}
        variant="secondary"
        className="mt-6 w-full"
      >
        View Profile
      </Button>
    </GlassCard>
  );
}
