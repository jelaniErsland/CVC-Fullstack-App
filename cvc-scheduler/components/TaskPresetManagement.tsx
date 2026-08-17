"use client";

import {
  Archive,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  ListFilter,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Utensils,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type {
  TaskManagementNotice,
  TaskManagementPreset,
} from "@/lib/tasks/routeRead.server";

type TaskPresetManagementProps = Readonly<{
  presets: readonly TaskManagementPreset[];
  workspaceName: string;
  canEdit: boolean;
  notice: TaskManagementNotice | null;
  initialSelectedId?: string;
  createAction: (formData: FormData) => void | Promise<void>;
  archiveAction: (formData: FormData) => void | Promise<void>;
}>;

const categoryDetails: Record<
  TaskManagementPreset["taskType"],
  { label: string; icon: LucideIcon; className: string }
> = {
  general: {
    label: "General",
    icon: ClipboardList,
    className: "bg-[var(--pl-teal-soft)] text-teal-700",
  },
  food: {
    label: "Food",
    icon: Utensils,
    className: "bg-[var(--pl-amber-soft)] text-amber-700",
  },
  security: {
    label: "Security",
    icon: ShieldCheck,
    className: "bg-[var(--pl-lavender-soft)] text-violet-700",
  },
  custom: {
    label: "Custom",
    icon: Sparkles,
    className: "bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]",
  },
};

const fieldTypeLabels = {
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
  select: "Choice",
  checkbox: "Checkbox",
} as const;

function Notice({ notice }: { notice: TaskManagementNotice | null }) {
  if (!notice) return null;
  const messages: Record<TaskManagementNotice, { title: string; message: string }> = {
    created: {
      title: "Task created",
      message: "It’s ready to use when you add work to Calendar.",
    },
    archived: {
      title: "Task archived",
      message: "Existing scheduled items were not changed.",
    },
    validation: {
      title: "Check the task details",
      message: "Use a name, supported category, and 1–99 volunteers.",
    },
    unavailable: {
      title: "Task change unavailable",
      message: "This signed-in project contact cannot safely make that change.",
    },
    error: {
      title: "Task change not saved",
      message: "Something went wrong while saving. Please try again.",
    },
  };
  const selected = messages[notice];
  return (
    <div
      aria-live="polite"
      className="mt-4 flex flex-col gap-0.5 rounded-xl border border-[var(--pl-blue)]/15 bg-[var(--pl-blue-soft)] px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-2"
    >
      <p className="text-sm font-semibold text-[var(--pl-ink)]">{selected.title}</p>
      <p className="text-xs leading-5 text-[var(--pl-text)]">{selected.message}</p>
    </div>
  );
}

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex min-h-[var(--pl-control-height)] items-center justify-center rounded-[var(--pl-radius-control)] bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,105,255,0.2)] transition hover:bg-[var(--pl-blue-deep)] disabled:cursor-wait disabled:opacity-65"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

function CreateTaskDialog({
  action,
  open,
  onClose,
}: {
  action: TaskPresetManagementProps["createAction"];
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;
  const inputClass =
    "min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white px-3.5 text-sm text-[var(--pl-ink)] outline-none transition placeholder:text-[var(--pl-muted)] focus:border-blue-300 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center sm:p-6">
      <button
        aria-label="Close new task"
        className="absolute inset-0 bg-slate-950/28 backdrop-blur-[2px]"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby="new-task-title"
        aria-modal="true"
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-[var(--pl-border)] bg-white p-5 shadow-[var(--pl-shadow-raised)] sm:max-w-xl sm:rounded-2xl sm:p-6"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
              Reusable task
            </p>
            <h2
              className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--pl-ink)]"
              id="new-task-title"
            >
              New task
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--pl-text)]">
              Set the defaults now. Dates and assignments belong on Calendar.
            </p>
          </div>
          <button
            aria-label="Close new task"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--pl-muted)] transition hover:bg-[var(--pl-surface-subtle)] hover:text-[var(--pl-ink)]"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <form action={action} className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-semibold text-[var(--pl-ink)]">
            Task name
            <input
              autoFocus
              className={inputClass}
              maxLength={160}
              name="name"
              placeholder="e.g. Gate Attendant"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--pl-ink)]">
              Category
              <select className={inputClass} defaultValue="general" name="taskType">
                <option value="general">General</option>
                <option value="food">Food</option>
                <option value="security">Security</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-[var(--pl-ink)]">
              Volunteers needed
              <input
                className={inputClass}
                defaultValue="1"
                max={99}
                min={1}
                name="defaultNeededCount"
                required
                type="number"
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold text-[var(--pl-ink)]">
            Description <span className="font-normal text-[var(--pl-muted)]">Optional</span>
            <textarea
              className={`${inputClass} min-h-28 resize-y py-3`}
              maxLength={2000}
              name="description"
              placeholder="What should volunteers know about this work?"
            />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-3.5">
            <input
              className="mt-0.5 size-4 rounded border-slate-300 text-[var(--pl-blue)] focus:ring-blue-200"
              defaultChecked
              name="volunteerVisible"
              type="checkbox"
              value="true"
            />
            <span>
              <span className="block text-sm font-semibold text-[var(--pl-ink)]">
                Visible to volunteers
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-[var(--pl-muted)]">
                Use this as the default when the task is scheduled.
              </span>
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--pl-border)] pt-4 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-[var(--pl-control-height)] items-center justify-center rounded-[var(--pl-radius-control)] px-4 text-sm font-semibold text-[var(--pl-text)] transition hover:bg-[var(--pl-surface-subtle)]"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <SubmitButton>Save task</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}

function TaskInspector({
  archiveAction,
  canEdit,
  onClose,
  preset,
}: {
  archiveAction: TaskPresetManagementProps["archiveAction"];
  canEdit: boolean;
  onClose?: () => void;
  preset: TaskManagementPreset | undefined;
}) {
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  if (!preset) {
    return (
      <div className="flex min-h-72 items-center justify-center p-6 text-center text-sm leading-6 text-[var(--pl-muted)]">
        Choose a task to review its reusable defaults.
      </div>
    );
  }

  const category = categoryDetails[preset.taskType];
  const CategoryIcon = category.icon;
  const canArchive = canEdit && preset.lifecycle === "active" && !preset.isSystemPreset;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="border-b border-[var(--pl-border)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${category.className}`}>
              <CategoryIcon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-[-0.025em] text-[var(--pl-ink)]">
                  {preset.name}
                </h2>
                {preset.isSystemPreset ? (
                  <span className="rounded-md bg-[var(--pl-teal-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-teal-700">
                    Built-in
                  </span>
                ) : null}
                {preset.lifecycle === "archived" ? (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                    Archived
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-semibold text-[var(--pl-muted)]">
                {category.label}
              </p>
            </div>
          </div>
          {onClose ? (
            <button
              aria-label="Close task details"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--pl-muted)] hover:bg-[var(--pl-surface-subtle)]"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          ) : null}
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--pl-text)]">
          {preset.description || "No description has been added."}
        </p>
      </div>

      <div className="grid gap-5 p-5">
        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--pl-muted)]">
            Defaults
          </h3>
          <dl className="mt-2 divide-y divide-[var(--pl-border)] text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-[var(--pl-text)]">
                <Users aria-hidden="true" className="size-4 text-[var(--pl-muted)]" />
                Volunteers needed
              </dt>
              <dd className="font-semibold text-[var(--pl-ink)]">
                {preset.defaultNeededCount}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="flex items-center gap-2 text-[var(--pl-text)]">
                {preset.volunteerVisible ? (
                  <Eye aria-hidden="true" className="size-4 text-[var(--pl-muted)]" />
                ) : (
                  <EyeOff aria-hidden="true" className="size-4 text-[var(--pl-muted)]" />
                )}
                Volunteer visibility
              </dt>
              <dd className="text-right font-semibold text-[var(--pl-ink)]">
                {preset.volunteerVisible ? "Visible" : "Coordinator only"}
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--pl-muted)]">
            Additional fields
          </h3>
          {preset.customFields.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {preset.customFields.map((field) => (
                <div
                  className="rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] px-3 py-2.5"
                  key={field.key}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--pl-ink)]">{field.label}</p>
                    {field.required ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--pl-blue)]">
                        Required
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--pl-muted)]">
                    {fieldTypeLabels[field.type]}
                    {field.options?.length ? ` · ${field.options.length} choices` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-[var(--pl-muted)]">
              No additional fields.
            </p>
          )}
        </section>

        {canArchive ? (
          <section className="border-t border-[var(--pl-border)] pt-4">
            {confirmingArchive ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                <p className="text-sm font-semibold text-amber-950">Archive this task?</p>
                <p className="mt-1 text-xs leading-5 text-amber-900">
                  Existing scheduled items won’t be changed.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={archiveAction}>
                    <input name="presetId" type="hidden" value={preset.id} />
                    <SubmitButton>Archive task</SubmitButton>
                  </form>
                  <button
                    className="min-h-[var(--pl-control-height)] rounded-[var(--pl-radius-control)] px-3 text-sm font-semibold text-amber-950 hover:bg-amber-100"
                    onClick={() => setConfirmingArchive(false)}
                    type="button"
                  >
                    Keep task
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="inline-flex min-h-[var(--pl-control-height)] items-center gap-2 rounded-[var(--pl-radius-control)] px-3 text-sm font-semibold text-[var(--pl-coral)] transition hover:bg-[var(--pl-coral-soft)]"
                onClick={() => setConfirmingArchive(true)}
                type="button"
              >
                <Archive aria-hidden="true" className="size-4" />
                Archive task
              </button>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function TaskPresetManagement({
  archiveAction,
  canEdit,
  createAction,
  initialSelectedId,
  notice,
  presets,
  workspaceName,
}: TaskPresetManagementProps) {
  const initialPreset =
    presets.find((preset) => preset.id === initialSelectedId) ??
    presets.find((preset) => preset.lifecycle === "active") ??
    presets[0];
  const [selectedId, setSelectedId] = useState<string | undefined>(initialPreset?.id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TaskManagementPreset["taskType"] | "all">("all");
  const [lifecycle, setLifecycle] = useState<TaskManagementPreset["lifecycle"] | "all">("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  const filteredPresets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return presets.filter((preset) => {
      const text = [preset.name, preset.description, categoryDetails[preset.taskType].label]
        .join(" ")
        .toLowerCase();
      return (
        (normalizedQuery.length === 0 || text.includes(normalizedQuery)) &&
        (category === "all" || preset.taskType === category) &&
        (lifecycle === "all" || preset.lifecycle === lifecycle)
      );
    });
  }, [category, lifecycle, presets, query]);

  const selectedPreset = presets.find((preset) => preset.id === selectedId);
  const hasPersistedTasks = presets.length > 0;
  const activeCount = presets.filter((preset) => preset.lifecycle === "active").length;
  const archivedCount = presets.length - activeCount;
  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setLifecycle("active");
  };

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-[var(--pl-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">
            {workspaceName}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[var(--pl-ink)] sm:text-4xl">
            Tasks
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pl-text)]">
            Reusable work definitions ready to place on Calendar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium text-[var(--pl-muted)]">
            <strong className="mr-1 text-base text-[var(--pl-ink)]">{activeCount}</strong>
            active{archivedCount ? ` · ${archivedCount} archived` : ""}
          </p>
          {canEdit ? (
            <button
              className="inline-flex min-h-[var(--pl-control-height)] items-center gap-2 rounded-[var(--pl-radius-control)] bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,105,255,0.2)] transition hover:bg-[var(--pl-blue-deep)]"
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              New task
            </button>
          ) : (
            <span className="rounded-lg bg-[var(--pl-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--pl-muted)]">
              View only
            </span>
          )}
        </div>
      </header>

      <Notice notice={notice} />

      <div
        className={`mt-5 grid min-w-0 gap-4 ${hasPersistedTasks ? "lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]" : "lg:mx-auto lg:w-full lg:max-w-5xl"}`}
      >
        <section className="min-w-0 overflow-hidden rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)]">
          <div className="border-b border-[var(--pl-border)] p-3 sm:p-4">
            <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_160px]">
              <label className="relative block">
                <span className="sr-only">Search tasks</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--pl-muted)]"
                />
                <input
                  className="min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] pl-10 pr-3 text-sm text-[var(--pl-ink)] outline-none transition placeholder:text-[var(--pl-muted)] focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tasks"
                  type="search"
                  value={query}
                />
              </label>
              <label className="relative block">
                <span className="sr-only">Category</span>
                <ListFilter
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--pl-muted)]"
                />
                <select
                  className="min-h-[42px] w-full appearance-none rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white pl-9 pr-3 text-sm font-medium text-[var(--pl-text)] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) =>
                    setCategory(event.target.value as TaskManagementPreset["taskType"] | "all")
                  }
                  value={category}
                >
                  <option value="all">All categories</option>
                  <option value="general">General</option>
                  <option value="food">Food</option>
                  <option value="security">Security</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="block">
                <span className="sr-only">Task status</span>
                <select
                  className="min-h-[42px] w-full rounded-[var(--pl-radius-control)] border border-[var(--pl-border)] bg-white px-3 text-sm font-medium text-[var(--pl-text)] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) =>
                    setLifecycle(
                      event.target.value as TaskManagementPreset["lifecycle"] | "all",
                    )
                  }
                  value={lifecycle}
                >
                  <option value="active">Active tasks</option>
                  <option value="archived">Archived tasks</option>
                  <option value="all">All statuses</option>
                </select>
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--pl-muted)]">
              <p>{filteredPresets.length} task{filteredPresets.length === 1 ? "" : "s"}</p>
              {(query || category !== "all" || lifecycle !== "active") && (
                <button
                  className="rounded-lg px-2.5 py-1.5 font-semibold text-[var(--pl-blue)] hover:bg-[var(--pl-blue-soft)]"
                  onClick={clearFilters}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {filteredPresets.length > 0 ? (
            <div className="divide-y divide-[var(--pl-border)]">
              <div className="hidden grid-cols-[minmax(0,1fr)_120px_100px_36px] gap-3 bg-[var(--pl-surface-subtle)] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--pl-muted)] md:grid">
                <span>Task</span>
                <span>Category</span>
                <span>People</span>
                <span className="sr-only">Open</span>
              </div>
              {filteredPresets.map((preset) => {
                const details = categoryDetails[preset.taskType];
                const Icon = details.icon;
                const selected = preset.id === selectedId;
                return (
                  <button
                    aria-current={selected ? "true" : undefined}
                    className={`grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition md:grid-cols-[auto_minmax(0,1fr)_120px_100px_24px] ${selected ? "bg-[var(--pl-blue-soft)]/65" : "hover:bg-[var(--pl-surface-subtle)]"}`}
                    key={preset.id}
                    onClick={() => {
                      setSelectedId(preset.id);
                      setMobileDetailOpen(true);
                    }}
                    type="button"
                  >
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${details.className}`}>
                      <Icon aria-hidden="true" className="size-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-bold text-[var(--pl-ink)]">
                          {preset.name}
                        </span>
                        {preset.isSystemPreset ? (
                          <span className="rounded bg-[var(--pl-teal-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-teal-700">
                            Built-in
                          </span>
                        ) : null}
                        {preset.lifecycle === "archived" ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-600">
                            Archived
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--pl-muted)]">
                        {preset.description || "No description"}
                      </span>
                      <span className="mt-1 flex gap-2 text-[10px] font-semibold text-[var(--pl-muted)] md:hidden">
                        <span>{details.label}</span>
                        <span>·</span>
                        <span>{preset.defaultNeededCount} needed</span>
                      </span>
                    </span>
                    <span className="hidden text-xs font-semibold text-[var(--pl-text)] md:block">
                      {details.label}
                    </span>
                    <span className="hidden items-center gap-1.5 text-xs font-semibold text-[var(--pl-text)] md:flex">
                      <Users aria-hidden="true" className="size-3.5 text-[var(--pl-muted)]" />
                      {preset.defaultNeededCount}
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 text-[var(--pl-muted)]" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-5 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--pl-blue-soft)] text-[var(--pl-blue)]">
                {presets.length === 0 ? (
                  <ClipboardList aria-hidden="true" className="size-5" />
                ) : (
                  <Search aria-hidden="true" className="size-5" />
                )}
              </span>
              <h2 className="mt-4 text-lg font-bold text-[var(--pl-ink)]">
                {presets.length === 0 ? "No reusable tasks yet" : "No matching tasks"}
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--pl-text)]">
                {presets.length === 0
                  ? "Create a reusable task here, then place it onto Calendar when the work has a date and time."
                  : "Try another name, category, or status."}
              </p>
              {presets.length === 0 && canEdit ? (
                <button
                  className="mt-4 inline-flex min-h-[var(--pl-control-height)] items-center gap-2 rounded-[var(--pl-radius-control)] bg-[var(--pl-blue)] px-4 text-sm font-semibold text-white"
                  onClick={() => setCreateOpen(true)}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  New task
                </button>
              ) : null}
            </div>
          )}
        </section>

        {hasPersistedTasks ? (
          <aside className="hidden min-w-0 self-start overflow-hidden rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)] lg:sticky lg:top-5 lg:block">
            <TaskInspector
              archiveAction={archiveAction}
              canEdit={canEdit}
              key={`desktop-${selectedPreset?.id ?? "none"}`}
              preset={selectedPreset}
            />
          </aside>
        ) : null}
      </div>

      {mobileDetailOpen && selectedPreset ? (
        <div className="fixed inset-0 z-[65] flex items-end lg:hidden">
          <button
            aria-label="Close task details"
            className="absolute inset-0 bg-slate-950/28 backdrop-blur-[2px]"
            onClick={() => setMobileDetailOpen(false)}
            type="button"
          />
          <section
            aria-label="Task details"
            aria-modal="true"
            className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-raised)]"
            role="dialog"
          >
            <TaskInspector
              archiveAction={archiveAction}
              canEdit={canEdit}
              key={`mobile-${selectedPreset.id}`}
              onClose={() => setMobileDetailOpen(false)}
              preset={selectedPreset}
            />
          </section>
        </div>
      ) : null}

      <CreateTaskDialog
        action={createAction}
        onClose={() => setCreateOpen(false)}
        open={createOpen}
      />
    </>
  );
}
