"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import type { AdminNavActive } from "@/components/AdminNav";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { demoProjectId, getProjectById } from "@/lib/mockData";

type AdminShellProps = {
  active: AdminNavActive;
  children: ReactNode;
  projectId?: string;
};

function AdminBrand() {
  return (
    <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
      CVC Scheduler
    </Link>
  );
}

export function AdminShell({
  active,
  children,
  projectId = demoProjectId,
}: AdminShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const project = getProjectById(projectId);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-4 lg:hidden">
          <GlassCard className="p-3">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Workspace
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950">
                  {project?.name ?? "Admin workspace"}
                </p>
              </div>
              <button
                aria-label="Open admin navigation"
                className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/80 bg-white/72 px-4 text-sm font-semibold text-slate-800 shadow-sm"
                onClick={() => setIsDrawerOpen(true)}
                type="button"
              >
                Menu
              </button>
            </div>
          </GlassCard>
        </div>

        <div className="grid min-h-[calc(100vh-40px)] w-full gap-4 lg:grid-cols-[240px_1fr]">
          <aside className="hidden lg:block lg:py-4">
            <GlassCard className="p-4 lg:sticky lg:top-6">
              <AdminBrand />
              <AdminNav active={active} projectId={projectId} />
            </GlassCard>
          </aside>

          <main className="min-w-0 py-4 lg:py-4">{children}</main>
        </div>
      </div>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close navigation drawer backdrop"
            className="absolute inset-0 h-full w-full bg-slate-950/24"
            onClick={() => setIsDrawerOpen(false)}
            type="button"
          />
          <div className="absolute inset-y-0 left-0 w-[min(320px,calc(100vw-28px))] p-3">
            <GlassCard className="flex h-full flex-col overflow-y-auto p-4 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
              <div className="flex items-center justify-between gap-3">
                <AdminBrand />
                <button
                  aria-label="Close admin navigation"
                  className="inline-flex min-h-11 items-center rounded-full border border-white/80 bg-white/70 px-4 text-sm font-semibold text-slate-700"
                  onClick={() => setIsDrawerOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
              <AdminNav
                active={active}
                onNavigate={() => setIsDrawerOpen(false)}
                projectId={projectId}
              />
            </GlassCard>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
