import { GlassCard } from "./GlassCard";
import { StatusPill } from "./StatusPill";
import type { AssignmentStatus } from "@/lib/mockData";

type AssignmentCardProps = {
  date: string;
  time: string;
  role: string;
  crew: string;
  location: string;
  status: AssignmentStatus;
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
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{date}</p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
            {role}
          </h3>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="mt-5 space-y-2 text-sm leading-6 text-slate-600">
        <p>{time}</p>
        <p>{crew}</p>
        <p>{location}</p>
      </div>
      {status === "Pending" || status === "Needs Reply" ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white"
          >
            Confirm
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/80 bg-white/64 px-4 text-sm font-semibold text-slate-700"
          >
            I need help
          </button>
        </div>
      ) : null}
    </GlassCard>
  );
}
