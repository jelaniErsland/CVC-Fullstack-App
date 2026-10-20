"use client";
import { usePathname } from "next/navigation";
import { primaryAdminDestination } from "@/lib/adminRouteHandoff";
import { AdminRouteCommit } from "@/components/AdminRouteHandoff";

export default function AdminRouteError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const destination = primaryAdminDestination(usePathname());
  return <section role="alert" className="rounded-xl border border-[var(--pl-border)] bg-white p-5">
    {destination && <AdminRouteCommit route={destination.route} />}
    <h1 className="text-xl font-semibold text-[var(--pl-ink)]">{destination?.title ?? "This page could not be loaded"}</h1>
    {destination && <p className="mt-3 font-semibold text-[var(--pl-ink)]">This page could not be loaded.</p>}
    <p className="mt-2 text-sm text-[var(--pl-muted)]">Please try again. You can also choose another page from the navigation.</p>
    <button type="button" onClick={unstable_retry} className="mt-4 min-h-11 rounded-lg border border-[var(--pl-border)] px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Try again</button>
  </section>;
}
