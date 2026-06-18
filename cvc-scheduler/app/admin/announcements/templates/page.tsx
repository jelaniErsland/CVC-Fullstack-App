import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  demoProjectId,
  getProjectById,
  getRecommendedReminderTemplateAction,
  getReminderTemplateAudienceLabel,
  getReminderTemplatesForActiveWorkspace,
  getReminderTemplateTimingLabel,
  groupReminderTemplatesByModule,
  projectHasModule,
  reminderTemplateCategoryLabels,
  reminderTemplateModuleLabels,
} from "@/lib/mockData";
import type { ReminderTemplate } from "@/lib/mockData";

function TemplateActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {["Preview template", "Use later", "Start from this"].map((action) => (
        <button
          className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          key={action}
          type="button"
        >
          {action}
        </button>
      ))}
    </div>
  );
}

function TemplateRow({ template }: { template: ReminderTemplate }) {
  return (
    <details className="group border-b border-white/72 last:border-b-0">
      <summary className="grid min-h-16 cursor-pointer list-none gap-3 px-4 py-3 transition hover:bg-white/46 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-950">{template.title}</p>
            <span className="inline-flex min-h-8 items-center rounded-full border border-white/80 bg-white/62 px-3 py-1 text-xs font-semibold text-slate-600">
              {reminderTemplateCategoryLabels[template.category]}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{template.description}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span>Suggested audience: {getReminderTemplateAudienceLabel(template)}</span>
            <span>Suggested timing: {getReminderTemplateTimingLabel(template)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
          <span className="group-open:hidden">Preview</span>
          <span className="hidden group-open:inline">Hide</span>
        </div>
      </summary>

      <div className="grid gap-4 bg-white/34 px-4 pb-4 sm:grid-cols-[1fr_260px] sm:px-5">
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Title suggestion
            </p>
            <p className="mt-1 font-medium text-slate-800">
              {template.subjectSuggestion}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Body preview
            </p>
            <p className="mt-1">{template.bodyPreview}</p>
          </div>
          {template.variables?.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Placeholders
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {template.variables.map((variable) => (
                  <span
                    className="inline-flex min-h-8 items-center rounded-full border border-white/80 bg-white/62 px-3 text-xs font-semibold text-slate-600"
                    key={variable}
                  >
                    {variable}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-white/72 bg-white/56 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Future actions
          </p>
          <div className="mt-3">
            <TemplateActions />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            These starting points do not create drafts or send messages yet.
          </p>
        </div>
      </div>
    </details>
  );
}

function TemplateGroups({ templates }: { templates: ReminderTemplate[] }) {
  const groups = groupReminderTemplatesByModule(templates);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <GlassCard className="overflow-hidden" key={group.module}>
          <div className="border-b border-white/72 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  {group.label}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {group.templates.length} starting point
                  {group.templates.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-sm font-semibold text-slate-500">
                {reminderTemplateModuleLabels[group.module]}
              </span>
            </div>
          </div>
          <div>
            {group.templates.map((template) => (
              <TemplateRow key={template.id} template={template} />
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

export default function AnnouncementTemplatesPage() {
  const project = getProjectById(demoProjectId);
  const hasAnnouncementsModule = projectHasModule(project, "announcements");
  const templates = hasAnnouncementsModule
    ? getReminderTemplatesForActiveWorkspace()
    : [];
  const nextAction = getRecommendedReminderTemplateAction(demoProjectId);

  return (
    <AdminShell active="announcements">
          <Link
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-slate-600 transition hover:bg-white/56 hover:text-slate-950"
            href="/admin/announcements"
          >
            Back to Communications
          </Link>

          <header className="mt-4 rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Communications
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Reminder templates
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Calm starting points for reminders, updates, food notes, security notes, and
              schedule messages inside the Communications area.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              These templates do not create drafts, schedule delivery, resolve recipients, or
              send email yet.
            </p>
          </header>

          <section className="mt-6">
            {templates.length > 0 ? (
              <div className="space-y-4">
                <GlassCard className="p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Coming next
                  </p>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                        {nextAction.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {nextAction.detail}
                      </p>
                    </div>
                    <span className="inline-flex min-h-10 w-fit items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                      Sending is not active yet
                    </span>
                  </div>
                </GlassCard>

                <TemplateGroups templates={templates} />
              </div>
            ) : (
              <EmptyState
                title="No reminder templates available"
                message="This workspace does not have communication template starting points for its enabled areas yet."
              />
            )}
          </section>
    </AdminShell>
  );
}
