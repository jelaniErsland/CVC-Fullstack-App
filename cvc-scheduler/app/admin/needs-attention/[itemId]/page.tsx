import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import {
  demoProjectId,
  getConflictCoverageContextById,
  getConflictCoverageIssueTypeLabel,
  getNeedsAttentionRelatedHref,
  getProjectById,
} from "@/lib/mockData";
import type {
  NeedsAttentionPriority,
  NeedsAttentionStatus,
} from "@/lib/mockData";

type NeedsAttentionDetailPageProps = {
  params: Promise<{
    itemId: string;
  }>;
};

const priorityStyles: Record<NeedsAttentionPriority, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-600",
  normal: "border-sky-200 bg-sky-50 text-sky-700",
  important: "border-amber-200 bg-amber-50 text-amber-700",
};

const statusLabels: Record<NeedsAttentionStatus, string> = {
  open: "Open",
  inReview: "In review",
  resolved: "Resolved",
};

function PriorityPill({ priority }: { priority: NeedsAttentionPriority }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold capitalize ${priorityStyles[priority]}`}
    >
      {priority}
    </span>
  );
}

function NotFoundState() {
  return (
    <EmptyState
      title="Needs attention item not found"
      message="This mock item may have been renamed or removed. Return to the follow-up list to choose another item."
    />
  );
}

export default async function NeedsAttentionDetailPage({
  params,
}: NeedsAttentionDetailPageProps) {
  const { itemId } = await params;
  const project = getProjectById(demoProjectId);
  const { item, detail, assignments, volunteers } =
    getConflictCoverageContextById(itemId);

  return (
    <AdminShell active="needs-attention">
          <Link
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-slate-600 transition hover:bg-white/56 hover:text-slate-950"
            href="/admin/needs-attention"
          >
            Back to Needs Attention
          </Link>

          {!item || !detail ? (
            <div className="mt-4">
              <NotFoundState />
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {getConflictCoverageIssueTypeLabel(detail.issueType)}
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                      {detail.title}
                    </h1>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PriorityPill priority={item.priority} />
                    <span className="inline-flex min-h-8 items-center rounded-full border border-white/80 bg-white/62 px-3 text-xs font-semibold text-slate-600">
                      {statusLabels[item.status]}
                    </span>
                  </div>
                </div>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  {detail.explanation}
                </p>
              </header>

              <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                <GlassCard className="p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Suggested next step
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                    {detail.suggestedNextStep}
                  </h2>
                  <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-600">
                    <p>
                      <span className="font-medium text-slate-800">Area:</span>{" "}
                      {detail.module}
                    </p>
                    {detail.affectedDate ? (
                      <p>
                        <span className="font-medium text-slate-800">Date:</span>{" "}
                        {detail.affectedDate}
                      </p>
                    ) : null}
                    {detail.affectedTime ? (
                      <p>
                        <span className="font-medium text-slate-800">Time:</span>{" "}
                        {detail.affectedTime}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-medium text-slate-800">Project:</span>{" "}
                      {project?.name ?? "Active workspace"}
                    </p>
                  </div>
                </GlassCard>

                <GlassCard className="overflow-hidden">
                  <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                      Placeholder actions
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      These show the future workflow shape and do not save changes.
                    </p>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                    {detail.placeholderActions.map((action) => (
                      <Button
                        className="min-h-16 cursor-not-allowed opacity-70"
                        disabled
                        key={action.label}
                        type="button"
                        variant="secondary"
                      >
                        <span className="text-left">
                          <span className="block">{action.label}</span>
                          <span className="mt-1 block text-xs font-medium text-slate-500">
                            {action.description}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                </GlassCard>
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <GlassCard className="overflow-hidden">
                  <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                      Related assignments
                    </h2>
                  </div>
                  {assignments.length > 0 ? (
                    <div>
                      {assignments.map((assignment) => (
                        <div
                          className="grid gap-2 border-b border-white/72 px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                          key={assignment.id}
                        >
                          <div>
                            <p className="font-semibold text-slate-950">
                              {assignment.title}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {assignment.date} - {assignment.shiftLabel}
                              {assignment.location ? ` - ${assignment.location}` : ""}
                            </p>
                          </div>
                          <StatusPill status={assignment.status} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-sm leading-6 text-slate-500 sm:px-5">
                      No schedule assignment is linked to this detail pattern.
                    </div>
                  )}
                </GlassCard>

                <GlassCard className="overflow-hidden">
                  <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                      Related people
                    </h2>
                  </div>
                  {volunteers.length > 0 ? (
                    <div>
                      {volunteers.map((volunteer) => (
                        <Link
                          className="grid min-h-16 gap-1 border-b border-white/72 px-4 py-3 last:border-b-0 transition hover:bg-white/46 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                          href={`/admin/volunteers/${volunteer.id}`}
                          key={volunteer.id}
                        >
                          <div>
                            <p className="font-semibold text-slate-950">{volunteer.name}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {volunteer.congregation} - {volunteer.email}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-slate-500">
                            View
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-4 text-sm leading-6 text-slate-500 sm:px-5">
                      No volunteer profile is linked yet.
                    </div>
                  )}
                </GlassCard>
              </section>

              <GlassCard className="overflow-hidden">
                <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    Related links
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3 p-4 sm:p-5">
                  {detail.relatedRoutes.map((route) => (
                    <Link
                      className="inline-flex min-h-11 items-center rounded-full border border-white/80 bg-white/64 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
                      href={route.href}
                      key={`${route.label}-${route.href}`}
                    >
                      {route.label}
                    </Link>
                  ))}
                  <Link
                    className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-slate-500 transition hover:bg-white/50 hover:text-slate-900"
                    href={getNeedsAttentionRelatedHref(item)}
                  >
                    Open source item
                  </Link>
                </div>
              </GlassCard>
            </div>
          )}
    </AdminShell>
  );
}
