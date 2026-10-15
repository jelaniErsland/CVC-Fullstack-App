"use client";

import { useCallback, useSyncExternalStore } from "react";
import { calendarRouteHref, readCalendarRouteDay } from "@/lib/calendar/routeHref";

type CalendarReturn = { view: "day" | "week" | "month" | "list"; date: string };
const changeEvent = "project-local:calendar-return-change";
const views = ["day", "week", "month", "list"] as const;

function returnKey(workspaceKey: string | null) {
  return workspaceKey && workspaceKey.length >= 3 && workspaceKey.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceKey)
    ? `project-local:calendar-return:v1:${workspaceKey}`
    : null;
}

function parseCalendarReturn(raw: string | null): CalendarReturn | null {
  try {
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const route = value as Record<string, unknown>;
    const date = readCalendarRouteDay(route.date);
    return views.includes(route.view as CalendarReturn["view"]) && date
      ? { view: route.view as CalendarReturn["view"], date }
      : null;
  } catch { return null; }
}

export function readCalendarReturn(storage: Pick<Storage, "getItem">, workspaceKey: string | null): CalendarReturn | null {
  const key = returnKey(workspaceKey);
  if (!key) return null;
  try { return parseCalendarReturn(storage.getItem(key)); }
  catch { return null; }
}

export function writeCalendarReturn(storage: Pick<Storage, "setItem">, workspaceKey: string | null, route: CalendarReturn) {
  const key = returnKey(workspaceKey);
  if (!key || !views.includes(route.view) || !readCalendarRouteDay(route.date)) return;
  try { storage.setItem(key, JSON.stringify(route)); }
  catch { return; }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(changeEvent, { detail: key }));
}

/** A route hint only. The destination still performs its normal authorized server read. */
export function useCalendarReturnHref(workspaceKey: string | null) {
  const key = returnKey(workspaceKey);
  const subscribe = useCallback((notify: () => void) => {
    const onChange = (event: Event) => {
      if (event.type === "storage" ? (event as StorageEvent).key === key : (event as CustomEvent<string>).detail === key) notify();
    };
    window.addEventListener("storage", onChange);
    window.addEventListener(changeEvent, onChange);
    return () => { window.removeEventListener("storage", onChange); window.removeEventListener(changeEvent, onChange); };
  }, [key]);
  const snapshot = useSyncExternalStore(subscribe, () => {
    try { return key ? window.localStorage.getItem(key) : null; } catch { return null; }
  }, () => null);
  if (!snapshot || !workspaceKey) return "/admin/calendar";
  const route = parseCalendarReturn(snapshot);
  return route ? calendarRouteHref({ routeBase: "/admin/calendar" }, route) : "/admin/calendar";
}
