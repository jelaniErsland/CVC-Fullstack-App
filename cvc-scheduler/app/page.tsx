import Link from "next/link";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";

export default function Home() {
  const projects = [
    "Belgrade Major Remodel 2026",
    "Bozeman Kingdom Hall Refresh",
    "Helena Roofing Support",
    "Billings Landscape Weekend",
  ];

  return (
    <PageShell className="flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-end">
        <Link
          href="/admin/login"
          className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-white/58 hover:text-slate-950"
        >
          Admin Login
        </Link>
      </header>

      <section className="flex flex-1 items-center justify-center py-12 sm:py-20">
        <GlassCard className="w-full max-w-md p-6 sm:p-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Volunteer Portal
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              CVC Scheduler
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Find your volunteer schedule
            </p>
          </div>

          <div className="mt-8 space-y-5">
            <Field
              id="project"
              label="Project"
              list="project-options"
              placeholder="Search projects"
              defaultValue={projects[0]}
            />
            <datalist id="project-options">
              {projects.map((project) => (
                <option key={project} value={project} />
              ))}
            </datalist>

            <Field
              id="congregation"
              label="Congregation"
              placeholder="e.g. Bozeman South"
            />
            <Field
              id="identity"
              label="Name or email"
              placeholder="e.g. alex@example.com"
            />

            <Button href="/v/demo" className="w-full">
              View My Schedule
            </Button>
          </div>

          <p className="mt-6 text-center text-sm leading-6 text-slate-500">
            Schedule links sent by email will be able to open a volunteer portal
            directly. This lookup is a placeholder for the MVP shell.
          </p>
        </GlassCard>
      </section>
    </PageShell>
  );
}
