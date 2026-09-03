import Link from "next/link";

import { AdminShell } from "@/components/AdminShell";
import { GlassCard } from "@/components/GlassCard";

export default function AdminBetaUnavailablePage() {
  return (
    <AdminShell active="overview">
      <GlassCard className="mx-auto max-w-2xl px-6 py-8 sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--pl-blue)]">
          Project Local beta
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[var(--pl-ink)] sm:text-4xl">
          This area isn&apos;t available in the beta yet.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--pl-muted)] sm:text-base">
          Use Calendar, Tasks, Volunteers, Needs Attention, or Quick View for current
          project work.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center rounded-xl bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--pl-blue-deep)]"
            href="/admin/calendar"
          >
            Open Calendar
          </Link>
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--pl-border)] bg-white px-4 text-sm font-semibold text-[var(--pl-text)] transition hover:bg-[var(--pl-surface-subtle)]"
            href="/admin/dashboard"
          >
            Overview
          </Link>
        </div>
      </GlassCard>
    </AdminShell>
  );
}
