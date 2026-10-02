import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { readCalendarMutationRouteContext } from "@/lib/calendar/routeRead.server";
import { readCalendarDraftReviewWithClient } from "@/lib/calendar/draftReview.server";

export const dynamic = "force-dynamic";

export default async function CalendarDraftReviewPage() {
  const context = await readCalendarMutationRouteContext();
  if (!context) return <AdminShell active="calendar"><div className="mx-auto max-w-3xl"><h1 className="text-2xl font-semibold">Draft review unavailable</h1><p className="mt-2 text-sm text-slate-600">Calendar editing permission is required.</p></div></AdminShell>;
  const { data, error } = await readCalendarDraftReviewWithClient(context.supabase, context.workspace.id);
  return <AdminShell active="calendar" workspaceName={context.workspace.displayName} destinations={context.navigationDestinations}><div className="mx-auto max-w-3xl space-y-5">
    <Link className="text-sm font-semibold text-blue-800 underline" href="/admin/calendar">← Calendar</Link>
    <div><h1 className="text-2xl font-semibold text-slate-950">Drafts to review</h1><p className="mt-1 text-sm text-slate-600">These items need an administrator to choose whether to activate or archive them. Activation sends no email.</p></div>
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-900">Drafts could not be loaded. Refresh to try again.</p>
      : !data?.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">No drafts need review.</p>
      : <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">{data.map(item => <li key={item.id}>
        <Link className="flex min-h-14 items-center justify-between gap-3 p-4 hover:bg-slate-50" href={`/admin/calendar?view=day&date=${item.start_date}&item=${item.id}&section=visibility`}>
          <span className="min-w-0"><span className="block break-words font-semibold text-slate-900">{item.title_snapshot}</span><span className="text-xs text-slate-600">{item.start_date}{item.end_date && item.end_date !== item.start_date ? ` – ${item.end_date}` : ""}</span></span>
          <span className="shrink-0 text-xs font-semibold text-blue-800">Review →</span>
        </Link>
      </li>)}</ul>}
  </div></AdminShell>;
}
