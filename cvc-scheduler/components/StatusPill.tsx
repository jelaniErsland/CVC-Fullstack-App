import type { PillStatus } from "@/lib/mockData";

type StatusPillProps = {
  status: PillStatus;
};

const statusStyles: Record<StatusPillProps["status"], string> = {
  Confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  "Needs Reply": "border-rose-200 bg-rose-50 text-rose-700",
  Declined: "border-slate-200 bg-slate-50 text-slate-600",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  archived: "border-slate-200 bg-slate-50 text-slate-600",
  Submitted: "border-slate-200 bg-slate-50 text-slate-600",
  "Needs Review": "border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Needs Info": "border-sky-200 bg-sky-50 text-sky-700",
  "Not Approved": "border-rose-200 bg-rose-50 text-rose-700",
  New: "border-sky-200 bg-sky-50 text-sky-700",
  Incomplete: "border-slate-200 bg-slate-50 text-slate-600",
  Reviewed: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function StatusPill({ status }: StatusPillProps) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {label}
    </span>
  );
}
