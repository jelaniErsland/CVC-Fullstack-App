"use client";

import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { moduleLabels } from "@/lib/mockData";
import type { Project, ProjectContacts, ProjectModule } from "@/lib/mockData";

const moduleOrder: ProjectModule[] = [
  "volunteers",
  "scheduling",
  "food",
  "security",
  "announcements",
  "emails",
  "needsAttention",
  "conflicts",
];

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/52 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{value || "Not set"}</p>
    </div>
  );
}

export function ProjectSettingsPanel({
  project,
  contacts,
}: {
  project: Project;
  contacts?: ProjectContacts;
}) {
  const [enabledModules, setEnabledModules] = useState<ProjectModule[]>(
    project.enabledModules,
  );

  function toggleModule(module: ProjectModule) {
    setEnabledModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module],
    );
  }

  return (
    <div className="grid gap-4">
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Current Workspace
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              {project.name}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Project setup is intentionally simple here. These settings define the
              workspace shape that future data and permissions will attach to.
            </p>
          </div>
          <StatusPill status={project.status} />
        </div>
      </GlassCard>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <GlassCard className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Ownership & Contacts
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoBlock label="Owner" value={contacts?.owner.name ?? project.primaryCvc} />
            <InfoBlock label="Primary CVC" value={project.primaryCvc} />
            <InfoBlock
              label="Assistant CVCs"
              value={project.assistantCvcs.join(", ")}
            />
            <InfoBlock
              label="Primary Food Contact"
              value={project.primaryFoodContact ?? ""}
            />
            <InfoBlock
              label="Food Assistants"
              value={project.assistantFoodContacts.join(", ")}
            />
            <InfoBlock
              label="Primary Security Contact"
              value={project.primarySecurityContact ?? ""}
            />
            <InfoBlock
              label="Security Assistants"
              value={project.assistantSecurityContacts.join(", ")}
            />
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Dates & Congregations
          </h2>
          <div className="mt-5 grid gap-3">
            <InfoBlock label="Date Range" value={project.dateRange} />
            <InfoBlock label="Working Days" value={project.workingDays.join(", ")} />
            <InfoBlock label="Timezone" value={project.timezone} />
            <InfoBlock
              label="Supporting Congregations"
              value={project.supportingCongregations.join(", ")}
            />
          </div>
        </GlassCard>
      </section>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Enabled Modules
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              These toggles are local UI state only. They establish the settings pattern
              for future persistence.
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {enabledModules.length} enabled
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {moduleOrder.map((module) => {
            const enabled = enabledModules.includes(module);

            return (
              <label
                key={module}
                className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-white/70 bg-white/48 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white/70"
              >
                <span>{moduleLabels[module]}</span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleModule(module)}
                  className="size-5 accent-slate-950"
                />
              </label>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
