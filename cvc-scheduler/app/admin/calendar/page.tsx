import CalendarClient from "@/components/CalendarClient";
import { readCalendarRouteState } from "@/lib/calendar/routeRead.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminCalendarPage() {
  const state = await readCalendarRouteState();

  return <CalendarClient state={state} />;
}
