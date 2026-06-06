import { GlassCard } from "./GlassCard";
import { StatusPill } from "./StatusPill";

type AssignmentCardProps = {
  date: string;
  time: string;
  role: string;
  crew: string;
  location: string;
  status: "Confirmed" | "Pending" | "Needs reply" | "Complete" | "Open";
};

export function AssignmentCard({
  date,
  time,
  role,
  crew,
  location,
  status,
}: AssignmentCardProps) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{date}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{role}</h3>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="mt-5 space-y-2 text-sm text-slate-600">
        <p>{time}</p>
        <p>{crew}</p>
        <p>{location}</p>
      </div>
    </GlassCard>
  );
}
