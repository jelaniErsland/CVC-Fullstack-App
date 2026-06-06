import Link from "next/link";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import { ProjectCombobox } from "@/components/ProjectCombobox";
import { projects } from "@/lib/mockData";

export default function Home() {
  return (
    <PageShell className="flex flex-col px-3 py-4 sm:px-6 sm:py-5">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-end">
        <Link
          href="/admin/login"
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/58 hover:text-slate-950"
        >
          Admin Login
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center py-8 sm:py-20">
        <GlassCard className="w-full max-w-[430px] p-5 sm:p-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-sm">
              Volunteer Portal
            </p>
            <h1 className="mt-4 text-[2.45rem] font-semibold leading-none tracking-tight text-slate-950 sm:text-5xl">
              CVC Scheduler
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Find your volunteer schedule
            </p>
          </div>

          <div className="mt-7 space-y-4 sm:mt-8 sm:space-y-5">
            <ProjectCombobox projects={projects} />

            <Field
              id="congregation"
              label="Congregation"
              placeholder="e.g. Bozeman South"
            />
            <Field
              id="identity"
              label="Name or email"
              placeholder="alex@example.com"
            />

            <Button href="/v/demo" className="mt-1 w-full">
              View My Schedule
            </Button>
          </div>

          <p className="mt-6 text-center text-[0.84rem] leading-6 text-slate-500 sm:text-sm">
            Schedule links sent by email will be able to open a volunteer portal
            directly. This lookup is a placeholder for the MVP shell.
          </p>
        </GlassCard>
      </section>
    </PageShell>
  );
}
