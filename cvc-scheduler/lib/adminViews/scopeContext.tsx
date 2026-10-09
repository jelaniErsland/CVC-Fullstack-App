"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { AdminViewScope } from "./preferences";

const AdminViewScopeContext = createContext<AdminViewScope | null>(null);
export function AdminViewScopeProvider({ scope, children }: { scope: AdminViewScope | null; children: ReactNode }) {
  return <AdminViewScopeContext.Provider value={scope}>{children}</AdminViewScopeContext.Provider>;
}
export function useAdminViewScope() { return useContext(AdminViewScopeContext); }
