import { cookies } from "next/headers";
import CalendarClient from "@/components/CalendarClient";
import { sharedCalendarState } from "@/lib/calendar/quickView.server";
import { createQuickViewReadClient, projectQuickViewAccessCookie } from "@/lib/projectQuickViewAccess/server";
import { validateQuickViewBearer, validateOptionalProjectDate } from "@/lib/projectQuickViewAccess/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Project Quick View", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function SharedQuickViewPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  let state = null;
  try {
    const token = validateQuickViewBearer((await cookies()).get(projectQuickViewAccessCookie.name)?.value);
    const date = validateOptionalProjectDate(typeof params?.date === "string" ? params.date : undefined);
    const { data, error } = await createQuickViewReadClient().rpc("read_project_quick_view_by_token", { p_bearer_token: token, p_project_date: date ?? undefined });
    if (!error) state = sharedCalendarState(data, params);
  } catch { /* Invalid, expired and revoked links share one contained state. */ }
  return state ? <CalendarClient readOnly routeBase="/qv" state={state} initialInspectorItemId={typeof params?.item === "string" ? params.item : undefined} />
    : <main className="mx-auto max-w-2xl p-6"><h1 className="text-2xl font-bold">This project view is no longer available.</h1><p className="mt-3 text-sm text-slate-600">Ask the person who shared it for a current project link.</p></main>;
}
