import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { ProjectLocalBrand } from "@/components/ProjectLocalBrand";
import { VolunteerLookup } from "@/components/VolunteerLookup";
import { readVolunteerSchedule, volunteerScheduleAccessCookie } from "@/lib/volunteerScheduleAccess/server";

export const metadata: Metadata = {
  title: "Find your schedule | Project Local",
  description: "Find your volunteer schedule.",
};

export default async function Home() {
  const token = (await cookies()).get(volunteerScheduleAccessCookie.name)?.value;
  if (token) {
    let valid = false;
    try { valid = (await readVolunteerSchedule({ token })).kind !== "unavailable"; } catch { /* expired or unavailable */ }
    if (valid) redirect("/v/schedule");
  }
  return (
    <PageShell className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_70%_10%,rgba(219,234,254,.65),transparent_65%),var(--pl-canvas)] px-5 py-6 sm:px-8">
      <header className="mx-auto w-full max-w-6xl">
        <Link href="/" aria-label="Project Local home" className="inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
          <ProjectLocalBrand />
        </Link>
      </header>
      <section aria-label="Volunteer schedule access" className="mx-auto w-full max-w-sm flex-1 pt-[clamp(3rem,14vh,9rem)] pb-12">
        <VolunteerLookup />
      </section>
      <footer className="mx-auto w-full max-w-6xl">
        <Link href="/admin/login" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500">
          <KeyRound aria-hidden="true" className="size-3.5" /> Project contact sign in
        </Link>
      </footer>
    </PageShell>
  );
}
