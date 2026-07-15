import CalendarClient from "@/components/CalendarClient";
import { readCalendarRouteState } from "@/lib/calendar/routeRead.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type CalendarPageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function AdminCalendarPage({ searchParams }: CalendarPageProps) {
  const state = await readCalendarRouteState(await searchParams);

  return <CalendarClient key={`${state.view}:${state.anchorDate}:${state.kind}`} state={state} />;
}
