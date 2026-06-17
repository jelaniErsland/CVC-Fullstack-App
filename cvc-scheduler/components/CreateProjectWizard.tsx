"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { GlassCard } from "@/components/GlassCard";
import { currentMockUser, moduleLabels } from "@/lib/mockData";
import type { ProjectModule } from "@/lib/mockData";

const steps = [
  "Basics",
  "Dates",
  "Congregations",
  "Modules",
  "Contacts",
  "Review",
];

const workdayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const moduleOptions: ProjectModule[] = [
  "volunteers",
  "scheduling",
  "food",
  "security",
  "announcements",
  "emails",
  "needsAttention",
  "conflicts",
];

type WizardState = {
  name: string;
  projectType: string;
  description: string;
  startDate: string;
  endDate: string;
  timezone: string;
  workingDays: string[];
  supportingCongregations: string;
  enabledModules: ProjectModule[];
  primaryCvc: string;
  assistantCvcs: string;
  primaryFoodContact: string;
  assistantFoodContacts: string;
  primarySecurityContact: string;
  assistantSecurityContacts: string;
};

const initialState: WizardState = {
  name: "",
  projectType: "Major Remodel",
  description: "",
  startDate: "",
  endDate: "",
  timezone: "America/Denver",
  workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  supportingCongregations: "",
  enabledModules: ["volunteers", "scheduling", "announcements"],
  primaryCvc: currentMockUser.name,
  assistantCvcs: "",
  primaryFoodContact: "",
  assistantFoodContacts: "",
  primarySecurityContact: "",
  assistantSecurityContacts: "",
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-white/70 bg-white/48 px-4 py-3 text-sm text-slate-700 transition hover:bg-white/70">
      <span>
        <span className="block font-semibold text-slate-900">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-5 shrink-0 accent-slate-950"
      />
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/54 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value || "Not set"}</p>
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CreateProjectWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [created, setCreated] = useState(false);

  const currentStep = steps[stepIndex];
  const progress = useMemo(() => `${stepIndex + 1} of ${steps.length}`, [stepIndex]);
  const congregations = splitList(state.supportingCongregations);

  function updateField(field: keyof WizardState, value: string | ProjectModule[] | string[]) {
    setState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateFromInput(field: keyof WizardState) {
    return (event: ChangeEvent<HTMLInputElement>) => updateField(field, event.target.value);
  }

  function updateFromSelect(field: keyof WizardState) {
    return (event: ChangeEvent<HTMLSelectElement>) => updateField(field, event.target.value);
  }

  function toggleWorkday(day: string) {
    setState((current) => ({
      ...current,
      workingDays: current.workingDays.includes(day)
        ? current.workingDays.filter((item) => item !== day)
        : [...current.workingDays, day],
    }));
  }

  function toggleModule(module: ProjectModule) {
    setState((current) => ({
      ...current,
      enabledModules: current.enabledModules.includes(module)
        ? current.enabledModules.filter((item) => item !== module)
        : [...current.enabledModules, module],
    }));
  }

  if (created) {
    return (
      <GlassCard className="w-full p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Mock Workspace Created
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {state.name || "New project workspace"}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
          This is a client-only success state for the workspace foundation. The workspace
          is ready to review here, but it will not persist after refresh until storage
          is added in a later iteration.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SummaryItem label="Status" value="Draft" />
          <SummaryItem label="Dates" value={`${state.startDate} to ${state.endDate}`} />
          <SummaryItem label="Modules" value={state.enabledModules.map((item) => moduleLabels[item]).join(", ")} />
          <SummaryItem label="Congregations" value={congregations.join(", ")} />
          <SummaryItem label="Primary CVC" value={state.primaryCvc} />
          <SummaryItem label="Timezone" value={state.timezone} />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button href="/admin/projects">Back to Workspaces</Button>
          <Button href="/admin/dashboard" variant="secondary">
            Open Belgrade Workspace
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full p-5 sm:p-8">
      <div className="flex flex-col gap-4 border-b border-white/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Create Project Workspace
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            {currentStep}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Start with only what your local contact knows today. Draft workspaces stay
            quiet until they are ready to use.
          </p>
        </div>
        <p className="text-sm font-medium text-slate-500">{progress}</p>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((step, index) => (
          <button
            key={step}
            type="button"
            onClick={() => setStepIndex(index)}
            className={[
              "min-h-11 rounded-lg px-3 py-2 text-left text-xs font-semibold transition",
              index === stepIndex
                ? "bg-slate-950 text-white"
                : "bg-white/50 text-slate-500 hover:bg-white/80 hover:text-slate-950",
            ].join(" ")}
          >
            {step}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {stepIndex === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              id="project-name"
              label="Project name"
              placeholder="Belgrade Major Remodel 2026"
              value={state.name}
              onChange={updateFromInput("name")}
            />
            <Field
              id="project-type"
              label="Project type"
              options={["Major Remodel", "Refresh", "New Construction", "Support Project"]}
              value={state.projectType}
              onChange={updateFromSelect("projectType")}
            />
            <label className="block md:col-span-2" htmlFor="project-description">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Short description
              </span>
              <textarea
                id="project-description"
                className="min-h-28 w-full rounded-lg border border-white/80 bg-white/68 px-4 py-3 text-base text-slate-950 shadow-inner shadow-white/35 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/86 focus:ring-4 focus:ring-slate-200/70"
                placeholder="A simple note about the project scope."
                value={state.description}
                onChange={(event) => updateField("description", event.target.value)}
              />
            </label>
          </div>
        ) : null}

        {stepIndex === 1 ? (
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-4">
              <Field
                id="start-date"
                label="Start date"
                type="date"
                value={state.startDate}
                onChange={updateFromInput("startDate")}
              />
              <Field
                id="end-date"
                label="End date"
                type="date"
                value={state.endDate}
                onChange={updateFromInput("endDate")}
              />
              <Field
                id="project-timezone"
                label="Timezone"
                options={["America/Denver", "America/Chicago", "America/New_York", "America/Los_Angeles"]}
                value={state.timezone}
                onChange={updateFromSelect("timezone")}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Working days
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Choose the normal days for this project. You can refine exact shifts later.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {workdayOptions.map((day) => (
                  <ToggleRow
                    key={day}
                    label={day}
                    checked={state.workingDays.includes(day)}
                    onChange={() => toggleWorkday(day)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {stepIndex === 2 ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <Field
              id="supporting-congregations"
              label="Supporting congregations"
              hint="Separate names with commas."
              placeholder="Belgrade, Bozeman, Helena"
              value={state.supportingCongregations}
              onChange={updateFromInput("supportingCongregations")}
            />
            <div className="rounded-lg border border-white/70 bg-white/44 p-4">
              <p className="text-sm font-semibold text-slate-900">Preview</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {congregations.length > 0 ? (
                  congregations.map((congregation) => (
                    <span
                      key={congregation}
                      className="rounded-full border border-white/80 bg-white/64 px-3 py-1.5 text-sm font-medium text-slate-700"
                    >
                      {congregation}
                    </span>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    Congregations will appear here as you add them.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {stepIndex === 3 ? (
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Enabled modules
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Keep the workspace small at first. Primary contacts can turn modules on
              or off later as project needs change.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {moduleOptions.map((module) => (
                <ToggleRow
                  key={module}
                  label={moduleLabels[module]}
                  description={
                    module === "volunteers"
                      ? "Questionnaires, approvals, and simple volunteer records."
                      : undefined
                  }
                  checked={state.enabledModules.includes(module)}
                  onChange={() => toggleModule(module)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {stepIndex === 4 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              id="primary-cvc"
              label="Primary CVC"
              value={state.primaryCvc}
              onChange={updateFromInput("primaryCvc")}
            />
            <Field
              id="assistant-cvcs"
              label="Assistant CVCs"
              placeholder="Optional"
              value={state.assistantCvcs}
              onChange={updateFromInput("assistantCvcs")}
            />
            <Field
              id="primary-food-contact"
              label="Primary Food Contact"
              placeholder="Optional"
              value={state.primaryFoodContact}
              onChange={updateFromInput("primaryFoodContact")}
            />
            <Field
              id="assistant-food-contacts"
              label="Assistant Food Contacts"
              placeholder="Optional"
              value={state.assistantFoodContacts}
              onChange={updateFromInput("assistantFoodContacts")}
            />
            <Field
              id="primary-security-contact"
              label="Primary Security Contact"
              placeholder="Optional"
              value={state.primarySecurityContact}
              onChange={updateFromInput("primarySecurityContact")}
            />
            <Field
              id="assistant-security-contacts"
              label="Assistant Security Contacts"
              placeholder="Optional"
              value={state.assistantSecurityContacts}
              onChange={updateFromInput("assistantSecurityContacts")}
            />
          </div>
        ) : null}

        {stepIndex === 5 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryItem label="Project" value={`${state.name} - ${state.projectType}`} />
            <SummaryItem label="Description" value={state.description} />
            <SummaryItem
              label="Dates"
              value={`${state.startDate || "Not set"} to ${state.endDate || "Not set"}`}
            />
            <SummaryItem label="Timezone" value={state.timezone} />
            <SummaryItem label="Working days" value={state.workingDays.join(", ")} />
            <SummaryItem label="Congregations" value={congregations.join(", ")} />
            <SummaryItem
              label="Modules"
              value={state.enabledModules.map((module) => moduleLabels[module]).join(", ")}
            />
            <SummaryItem label="Primary CVC" value={state.primaryCvc} />
            <SummaryItem
              label="Optional contacts"
              value={[
                state.primaryFoodContact && `Food: ${state.primaryFoodContact}`,
                state.primarySecurityContact && `Security: ${state.primarySecurityContact}`,
              ]
                .filter(Boolean)
                .join(" | ")}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-white/70 pt-6 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          disabled={stepIndex === 0}
          className="disabled:cursor-not-allowed disabled:opacity-45"
        >
          Back
        </Button>

        {stepIndex < steps.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))}
          >
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={() => setCreated(true)}>
            Create Draft Workspace
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
