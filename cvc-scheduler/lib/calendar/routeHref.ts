/** Product route context comes from the route caller, never from a query string.
 * This helper constructs links only; it does not establish viewing/editing rights.
 * Filters are currently component-local and are deliberately not invented as URL parameters.
 */
export type CalendarRouteBase = "/admin/calendar" | "/admin/quick-view" | "/qv";
export type CalendarRouteContext = { routeBase: CalendarRouteBase; projectKey?: string };
export const calendarInspectorSections = ["details", "volunteers", "visibility", "notification"] as const;
export type RouteInspectorSection = typeof calendarInspectorSections[number];

export function readInspectorSection(value: unknown): RouteInspectorSection {
  return calendarInspectorSections.includes(value as RouteInspectorSection) ? value as RouteInspectorSection : "details";
}

/** Civil dates only; reject invalid deep links before date formatting in the UI. */
export function readCalendarRouteDay(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

export function calendarRouteHref(context: CalendarRouteContext, values: {
  view: string; date: string; item?: string; section?: string; day?: string;
}) {
  if (!["/admin/calendar", "/admin/quick-view", "/qv"].includes(context.routeBase)) {
    throw new Error("Unsupported Calendar route context");
  }
  const params = new URLSearchParams();
  if (["day", "week", "month", "list"].includes(values.view)) params.set("view", values.view);
  if (/^\d{4}-\d{2}-\d{2}$/.test(values.date)) params.set("date", values.date);
  if (context.routeBase === "/admin/quick-view" && context.projectKey) params.set("project", context.projectKey);
  if (values.item) {
    params.set("item", values.item);
    params.set("section", readInspectorSection(values.section));
  } else if (values.day && /^\d{4}-\d{2}-\d{2}$/.test(values.day)) {
    params.set("day", values.day);
  }
  return `${context.routeBase}?${params.toString()}`;
}
