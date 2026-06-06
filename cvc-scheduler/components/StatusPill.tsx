type StatusPillProps = {
  status: "Confirmed" | "Pending" | "Needs reply" | "Complete" | "Open";
};

const statusStyles: Record<StatusPillProps["status"], string> = {
  Confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  "Needs reply": "border-rose-200 bg-rose-50 text-rose-700",
  Complete: "border-sky-200 bg-sky-50 text-sky-700",
  Open: "border-slate-200 bg-slate-50 text-slate-600",
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}
