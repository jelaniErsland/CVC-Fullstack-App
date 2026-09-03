import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { EyeOff } from "lucide-react";

import { ProjectLocalBrand } from "@/components/ProjectLocalBrand";
import { SharedProjectQuickView } from "@/components/SharedProjectQuickView";
import {
  projectQuickViewAccessCookie,
  readSharedProjectQuickView,
} from "@/lib/projectQuickViewAccess/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Project Quick View | Project Local",
  description: "A secure shared Project Local Quick View.",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

type PageProps = Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function UnavailableView() {
  return (
    <main className="mx-auto flex min-h-[70dvh] w-full max-w-lg items-center px-5 py-10">
      <section className="w-full rounded-[1.5rem] border border-[var(--pl-border)] bg-white p-7 text-center shadow-[var(--pl-shadow-panel)] sm:p-9">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <EyeOff aria-hidden="true" className="size-5" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-[-0.035em] text-[var(--pl-ink)]">This project view is no longer available.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--pl-muted)]">Ask the person who shared it with you for a current link.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-xl border border-[var(--pl-border)] px-4 text-sm font-semibold text-[var(--pl-text)] hover:bg-[var(--pl-surface-subtle)]" href="/">
          Project Local home
        </Link>
      </section>
    </main>
  );
}

export default async function SharedQuickViewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(projectQuickViewAccessCookie.name)?.value;
  let view: Awaited<ReturnType<typeof readSharedProjectQuickView>> = { kind: "unavailable" };
  try {
    view = await readSharedProjectQuickView({ token, date: first(params?.date) });
  } catch {
    view = { kind: "unavailable" };
  }
  const today = view.kind === "ready"
    ? new Intl.DateTimeFormat("en-CA", {
        day: "2-digit",
        month: "2-digit",
        timeZone: view.workspaceTimezone,
        year: "numeric",
      }).format(new Date())
    : "";

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#f8fbff_0%,#f6f7f9_45%,#ffffff_100%)]">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 sm:pt-6">
        <ProjectLocalBrand />
      </div>
      {view.kind === "ready" ? (
        <SharedProjectQuickView
          projectEndsOn={view.projectEndsOn}
          projection={view.projection}
          today={today}
        />
      ) : <UnavailableView />}
    </div>
  );
}
