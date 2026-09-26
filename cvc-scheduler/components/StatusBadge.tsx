import { statusDisplay } from "@/lib/statusDisplay";
const tones = { neutral: "border-slate-200 bg-slate-50 text-slate-700", info: "border-blue-200 bg-blue-50 text-blue-800", warning: "border-amber-200 bg-amber-50 text-amber-900", success: "border-emerald-200 bg-emerald-50 text-emerald-800", danger: "border-red-200 bg-red-50 text-red-800" };
export function StatusBadge({ status }: { status: keyof typeof statusDisplay }) {
  const display = statusDisplay[status];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium leading-4 ${tones[display.tone]}`}>{display.label}</span>;
}
