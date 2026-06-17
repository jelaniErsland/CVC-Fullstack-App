import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { NeedsAttentionOverview } from "@/components/NeedsAttentionOverview";
import { PageShell } from "@/components/PageShell";
import {
  demoProjectId,
  getNeedsAttentionCounts,
  getProjectById,
  groupNeedsAttentionItemsByArea,
  projectHasModule,
} from "@/lib/mockData";

export default function AdminNeedsAttentionPage() {
  const project = getProjectById(demoProjectId);
  const counts = getNeedsAttentionCounts(demoProjectId);
  const groups = groupNeedsAttentionItemsByArea();
  const hasNeedsAttentionModule = projectHasModule(project, "needsAttention");

  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <AdminNav active="needs-attention" />
          </GlassCard>
        </aside>

        <main className="py-4">
          <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Project Follow-up
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Needs Attention
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              A quiet list of follow-ups, open coverage, and setup notes for the active project.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              This mock overview does not resolve items yet. It helps coordinators see the next
              useful step without turning the workspace into an alert dashboard.
            </p>
          </header>

          <section className="mt-6">
            {project && hasNeedsAttentionModule ? (
              <NeedsAttentionOverview counts={counts} groups={groups} />
            ) : (
              <EmptyState
                title="Needs Attention is not enabled"
                message="This workspace is not using follow-up tracking yet. If enabled later, calm project follow-ups will appear here."
              />
            )}
          </section>
        </main>
      </div>
    </PageShell>
  );
}
