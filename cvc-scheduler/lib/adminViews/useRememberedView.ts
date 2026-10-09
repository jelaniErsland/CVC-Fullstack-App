"use client";
import { useCallback, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { adminViewKey, defaultAdminViews, readAdminView, validateAdminView, writeAdminView, type AdminViewMap, type AdminViewScope, type AdminViewSurface } from "./preferences";

const changeEvent = "project-local:admin-view-change";
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverPending = () => false;

/** One versioned store shared by all admin surfaces. Browser storage never controls server access. */
export function useRememberedView<S extends AdminViewSurface>(surface: S, scope: AdminViewScope | null): readonly [AdminViewMap[S], Dispatch<SetStateAction<AdminViewMap[S]>>, () => void, boolean] {
  const key = scope ? adminViewKey(scope, surface) : null;
  const [unscopedValue, setUnscopedValue] = useState<AdminViewMap[S]>(defaultAdminViews[surface]);
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverPending);
  const subscribe = useCallback((notify: () => void) => {
    const onChange = (event: Event) => { if (event.type === "storage" ? (event as StorageEvent).key === key : (event as CustomEvent<string>).detail === key) notify(); };
    window.addEventListener("storage", onChange);
    window.addEventListener(changeEvent, onChange);
    return () => { window.removeEventListener("storage", onChange); window.removeEventListener(changeEvent, onChange); };
  }, [key]);
  const snapshot = useSyncExternalStore(subscribe, () => { try { return key ? window.localStorage.getItem(key) : null; } catch { return null; } }, () => null);
  const stored = useMemo(() => {
    if (!key || !scope || !snapshot) return defaultAdminViews[surface];
    try {
      const envelope = JSON.parse(snapshot);
      return envelope?.version === 1 && envelope?.surface === surface ? validateAdminView(surface, envelope.value) : defaultAdminViews[surface];
    } catch { return defaultAdminViews[surface]; }
  }, [key, snapshot, surface, scope]);
  const value = key ? stored : unscopedValue;
  const setValue: Dispatch<SetStateAction<AdminViewMap[S]>> = useCallback((update) => {
    if (!key || !scope) { setUnscopedValue(update); return; }
    const current = readAdminView(window.localStorage, scope, surface);
    const next = typeof update === "function" ? (update as (value: AdminViewMap[S]) => AdminViewMap[S])(current) : update;
    writeAdminView(window.localStorage, scope, surface, next);
    window.dispatchEvent(new CustomEvent(changeEvent, { detail: key }));
  }, [key, scope, surface]);
  const reset = useCallback(() => setValue(defaultAdminViews[surface]), [setValue, surface]);
  return [value, setValue, reset, hydrated] as const;
}
