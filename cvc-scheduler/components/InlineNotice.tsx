import type { ReactNode } from "react";
const tones = { info: "border-blue-200 bg-blue-50 text-blue-900", error: "border-red-200 bg-red-50 text-red-900", warning: "border-amber-200 bg-amber-50 text-amber-900", success: "border-emerald-200 bg-emerald-50 text-emerald-900" };
/** Announce asynchronous outcomes, not every static page message. */
export function InlineNotice({ title, children, tone = "info", announce = false }: { title: string; children?: ReactNode; tone?: keyof typeof tones; announce?: boolean }) {
  return <div role={announce ? "status" : undefined} className={`rounded-xl border p-4 text-sm leading-6 ${tones[tone]}`}><p className="font-semibold">{title}</p>{children}</div>;
}
