import {
  BadgeCheck,
  ClipboardList,
  Copy,
  Eye,
  ListChecks,
  Pencil,
  Plus,
  Tags,
  Users,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  demoProjectId,
  getNextTaskPresetDuplicateName,
  getRequiredSystemFieldsForTaskPreset,
  getTaskPresetCategoryLabel,
  getTaskPresetCounts,
  getTaskPresetFieldTypeLabel,
  getTaskPresetVisibilityLabel,
  getTaskPresetsForActiveWorkspace,
  groupTaskPresetsByCategory,
  isLunchTaskPreset,
  isSystemTaskPreset,
} from "@/lib/mockData";
import type { TaskPreset, TaskPresetCategory } from "@/lib/mockData";

const categoryStyles: Record<TaskPresetCategory, string> = {
  general: "border-slate-200 bg-slate-50 text-slate-700",
  lunch: "border-emerald-200 bg-emerald-50 text-emerald-700",
  security: "border-sky-200 bg-sky-50 text-sky-700",
  cleanup: "border-amber-200 bg-amber-50 text-amber-700",
  construction: "border-indigo-200 bg-indigo-50 text-indigo-700",
  custom: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
};

function MetaPill({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white/70 bg-white/54 px-3 text-xs font-semibold text-slate-600">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
      {label}
    </span>
  );
}

function SummaryStrip() {
  const counts = getTaskPresetCounts(demoProjectId);
  const items = [
    { label: "Presets", value: counts.total, helper: "Reusable task blocks" },
    { label: "System", value: counts.system, helper: "Recognized presets" },
    { label: "Custom", value: counts.custom, helper: "Workspace presets" },
    { label: "Security", value: counts.byCategory.security, helper: "Task category" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="rounded-lg border border-white/72 bg-white/54 px-4 py-3"
          key={item.label}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">{item.label}</p>
            <p className="text-2xl font-semibold tracking-tight text-slate-950">
              {item.value}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
        </div>
      ))}
    </section>
  );
}

function PlaceholderActions() {
  const actions = [
    { label: "New task", icon: Plus },
    { label: "Duplicate", icon: Copy },
    { label: "Edit preset", icon: Pencil },
    { label: "Use on calendar later", icon: ClipboardList },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ label, icon: Icon }) => (
        <button
          className="inline-flex min-h-10 cursor-not-allowed items-center gap-1.5 rounded-full border border-slate-200 bg-white/72 px-3 text-sm font-semibold text-slate-500 opacity-75"
          disabled
          key={label}
          type="button"
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

function getFieldSummary(preset: TaskPreset) {
  if (preset.customFields.length === 0) {
    return "No custom fields";
  }

  return preset.customFields
    .map((field) => `${field.label}${field.required ? " required" : ""}`)
    .join(", ");
}

function TaskPresetRow({ preset }: { preset: TaskPreset }) {
  return (
    <div className="border-b border-white/72 px-4 py-4 last:border-b-0 sm:px-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-950">{preset.name}</p>
            <span
              className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${categoryStyles[preset.category]}`}
            >
              {getTaskPresetCategoryLabel(preset.category)}
            </span>
            {isSystemTaskPreset(preset) ? (
              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
                System
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <MetaPill icon={Users} label={`${preset.neededCount} needed`} />
            <MetaPill icon={Eye} label={getTaskPresetVisibilityLabel(preset.visibility)} />
            <MetaPill icon={ListChecks} label={getFieldSummary(preset)} />
          </div>
        </div>
        <div className="inline-flex min-h-10 w-fit items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
          Preview
        </div>
      </div>
    </div>
  );
}

function TaskGroups({ presets }: { presets: TaskPreset[] }) {
  const groups = groupTaskPresetsByCategory(presets);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <GlassCard className="overflow-hidden" key={group.category}>
          <div className="border-b border-white/72 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                {group.label}
              </h2>
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                <Tags aria-hidden="true" className="h-4 w-4" />
                {group.presets.length} preset
                {group.presets.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div>
            {group.presets.map((preset) => (
              <TaskPresetRow key={preset.id} preset={preset} />
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function SelectedTaskPanel({ preset }: { preset?: TaskPreset }) {
  if (!preset) {
    return (
      <GlassCard className="p-4 sm:p-5">
        <p className="text-sm leading-6 text-slate-600">
          Select a preset later to review its fields and duplication pattern.
        </p>
      </GlassCard>
    );
  }

  const requiredFields = getRequiredSystemFieldsForTaskPreset(preset);
  const nextDuplicateName = getNextTaskPresetDuplicateName(preset.name);

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Focused preset
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            {preset.name}
          </h2>
        </div>
        {isSystemTaskPreset(preset) ? (
          <span className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
            System preset
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">
        This is a reusable preset. Dates, times, assigned volunteers, filled counts,
        and schedule notes belong on future Calendar items.
      </p>

      {isLunchTaskPreset(preset) ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          <div className="flex items-center gap-2 font-semibold">
            <Utensils aria-hidden="true" className="h-4 w-4" />
            Lunch is recognizable by the system.
          </div>
          <p className="mt-1">
            It keeps a required Menu field so a future volunteer-facing lunch
            schedule/menu view can be generated.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/70 bg-white/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Needed count
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-800">
            {preset.neededCount}
          </p>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Next duplicate name
          </p>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-800">
            {nextDuplicateName}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Fields
        </p>
        <div className="mt-2 grid gap-2">
          {preset.customFields.map((field) => (
            <div
              className="flex flex-col gap-1 rounded-lg border border-white/70 bg-white/50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              key={field.id}
            >
              <span className="font-semibold text-slate-800">
                {field.label}
                {field.required ? " required" : ""}
              </span>
              <span className="text-slate-500">
                {getTaskPresetFieldTypeLabel(field.type)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {requiredFields.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Required system field: {requiredFields.map((field) => field.label).join(", ")}
        </p>
      ) : null}

      <div className="mt-4">
        <PlaceholderActions />
      </div>
    </GlassCard>
  );
}

export default function AdminTasksPage() {
  const presets = getTaskPresetsForActiveWorkspace();
  const lunchPreset = presets.find((preset) => isLunchTaskPreset(preset));

  return (
    <AdminShell active="tasks">
      <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Preset library
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Tasks
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          Reusable blocks for project work. Put them on the Calendar later when
          they need dates, times, and assigned helpers.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Preview only. This page does not create presets, duplicate tasks,
          edit fields, schedule work, or assign volunteers.
        </p>
      </header>

      <section className="mt-6">
        {presets.length > 0 ? (
          <div className="space-y-4">
            <SummaryStrip />

            <div className="grid gap-4 xl:grid-cols-[1fr_0.82fr]">
              <TaskGroups presets={presets} />
              <SelectedTaskPanel preset={lunchPreset} />
            </div>
          </div>
        ) : (
          <EmptyState
            title="No task presets yet"
            message="Task presets will appear here as reusable blocks. Dates, times, and assigned helpers will belong on Calendar items later."
          />
        )}
      </section>
    </AdminShell>
  );
}
