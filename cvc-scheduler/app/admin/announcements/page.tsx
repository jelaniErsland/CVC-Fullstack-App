import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { PageShell } from "@/components/PageShell";
import {
  communicationAudienceLabels,
  communicationStatusLabels,
  communicationTypeLabels,
  demoProjectId,
  getCommunicationCounts,
  getProjectById,
  getRecentCommunications,
  getRecommendedCommunicationAction,
  groupCommunicationsByStatus,
  groupCommunicationsByType,
  projectHasModule,
} from "@/lib/mockData";
import type { Communication, CommunicationStatus } from "@/lib/mockData";

const statusStyles: Record<CommunicationStatus, string> = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  scheduledMock: "border-sky-200 bg-sky-50 text-sky-700",
  sentMock: "border-slate-200 bg-white text-slate-500",
};

function StatusLabel({ status }: { status: CommunicationStatus }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
    >
      {communicationStatusLabels[status]}
    </span>
  );
}

function SummaryStrip() {
  const counts = getCommunicationCounts(demoProjectId);
  const items = [
    { label: "Draft", value: counts.drafts, helper: "Being prepared" },
    { label: "Ready", value: counts.ready, helper: "Ready to send later" },
    { label: "Reminder plan", value: counts.scheduledMock, helper: "Mock scheduled" },
    { label: "Past mock", value: counts.sentMock, helper: "No real emails sent" },
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

function PlaceholderActions({ item }: { item: Communication }) {
  const actions =
    item.status === "draft"
      ? ["Preview", "Edit draft"]
      : item.status === "ready"
        ? ["Preview", "Prepare send"]
        : ["Preview"];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
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

function AnnouncementRow({ item }: { item: Communication }) {
  return (
    <details className="group border-b border-white/72 last:border-b-0">
      <summary className="grid min-h-16 cursor-pointer list-none gap-3 px-4 py-3 transition hover:bg-white/46 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-950">{item.title}</p>
            <StatusLabel status={item.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span>{communicationTypeLabels[item.messageType]}</span>
            <span>{communicationAudienceLabels[item.audience]}</span>
            <span>Updated {item.updatedAt}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
          <span className="group-open:hidden">Details</span>
          <span className="hidden group-open:inline">Hide</span>
        </div>
      </summary>

      <div className="grid gap-4 bg-white/34 px-4 pb-4 sm:grid-cols-[1fr_220px] sm:px-5">
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Preview
            </p>
            <p className="mt-1">{item.bodyPreview}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Recipients
            </p>
            <p className="mt-1">{item.recipientExplanation}</p>
          </div>
          {item.scheduledAt ? (
            <p className="text-sm font-medium text-slate-500">
              Reminder plan: {item.scheduledAt}
            </p>
          ) : null}
          {item.relatedRoute ? (
            <Link
              className="inline-flex min-h-10 items-center text-sm font-semibold text-slate-700 hover:text-slate-950"
              href={item.relatedRoute}
            >
              Open related project area
            </Link>
          ) : null}
        </div>

        <div className="rounded-lg border border-white/72 bg-white/56 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Placeholder actions
          </p>
          <div className="mt-3">
            <PlaceholderActions item={item} />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            These buttons do not send email. They show the future workflow shape only.
          </p>
        </div>
      </div>
    </details>
  );
}

function AnnouncementList({ items }: { items: Communication[] }) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="border-b border-white/72 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              Recent and draft announcements
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Compact rows for wording, audience, and reminder planning.
            </p>
          </div>
          <p className="text-sm font-semibold text-slate-500">Sending inactive</p>
        </div>
      </div>
      <div>
        {items.map((item) => (
          <AnnouncementRow item={item} key={item.id} />
        ))}
      </div>
    </GlassCard>
  );
}

function GroupSummary() {
  const byStatus = groupCommunicationsByStatus();
  const byType = groupCommunicationsByType();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <GlassCard className="p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">By status</h2>
        <div className="mt-3 grid gap-2">
          {byStatus.map((group) => (
            <div
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-white/70 bg-white/50 px-3"
              key={group.status}
            >
              <p className="text-sm font-medium text-slate-600">{group.label}</p>
              <p className="text-sm font-semibold text-slate-950">{group.items.length}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">By type</h2>
        <div className="mt-3 grid gap-2">
          {byType.map((group) => (
            <div
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-white/70 bg-white/50 px-3"
              key={group.type}
            >
              <p className="text-sm font-medium text-slate-600">{group.label}</p>
              <p className="text-sm font-semibold text-slate-950">{group.items.length}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const project = getProjectById(demoProjectId);
  const hasAnnouncementsModule = projectHasModule(project, "announcements");
  const recentCommunications = getRecentCommunications(demoProjectId, 5);
  const nextAction = getRecommendedCommunicationAction(demoProjectId);

  return (
    <PageShell>
      <div className="mx-auto grid min-h-[calc(100vh-40px)] w-full max-w-7xl gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="lg:py-4">
          <GlassCard className="p-4 lg:sticky lg:top-6">
            <Link href="/" className="block text-lg font-semibold tracking-tight text-slate-950">
              CVC Scheduler
            </Link>
            <AdminNav active="announcements" />
          </GlassCard>
        </aside>

        <main className="py-4">
          <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Communications
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Announcements
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Prepare project announcements, reminder plans, and recipient notes without sending
              real email yet.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              This overview is mock-only. Resend, SMTP, scheduled jobs, recipient resolution,
              delivery tracking, and real persistence are not active.
            </p>
          </header>

          <section className="mt-6">
            {project && hasAnnouncementsModule ? (
              <div className="space-y-4">
                <SummaryStrip />

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
                      Preview only
                    </span>
                  </div>
                </GlassCard>

                <AnnouncementList items={recentCommunications} />
                <GroupSummary />
              </div>
            ) : (
              <EmptyState
                title="Announcements are not enabled"
                message="This workspace is not using announcement planning yet. If enabled later, calm drafts and reminder plans will appear here."
              />
            )}
          </section>
        </main>
      </div>
    </PageShell>
  );
}
