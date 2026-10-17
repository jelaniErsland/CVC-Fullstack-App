import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  announcements,
  communicationAudienceLabels,
  communicationStatusLabels,
  communicationTypeLabels,
  demoProjectId,
  getCommunicationAudienceExplanation,
  getCommunicationById,
  getCommunicationNotFoundHref,
  getCommunicationStatusTone,
  getProjectById,
  getRecommendedCommunicationActionForItem,
} from "@/lib/mockData";
import type {
  Communication,
  CommunicationStatus,
  CommunicationStatusTone,
} from "@/lib/mockData";

type AnnouncementDetailPageProps = {
  params: Promise<{
    communicationId: string;
  }>;
};

const statusStyles: Record<CommunicationStatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function StatusLabel({ status }: { status: CommunicationStatus }) {
  const tone = getCommunicationStatusTone(status);

  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[tone]}`}
    >
      {communicationStatusLabels[status]}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function PlaceholderActions({ communication }: { communication: Communication }) {
  const actions =
    communication.status === "draft"
      ? ["Edit draft", "Duplicate", "Use as reminder template"]
      : communication.status === "ready"
        ? ["Prepare send", "Edit draft", "Duplicate"]
        : communication.status === "scheduledMock"
          ? ["Preview reminder plan", "Use as reminder template", "Duplicate"]
          : ["Duplicate", "Use as reminder template"];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => (
        <Button
          className="min-h-12 cursor-not-allowed opacity-70"
          disabled
          key={action}
          type="button"
          variant="secondary"
        >
          {action}
        </Button>
      ))}
    </div>
  );
}

function NotFoundState() {
  return (
    <EmptyState
      title="Communication preview not found"
      message="This planning item may have been renamed or removed. Return to Communications to choose another draft or reminder."
    />
  );
}

export function generateStaticParams() {
  return announcements.map((communication) => ({
    communicationId: communication.id,
  }));
}

export default async function AnnouncementDetailPage({
  params,
}: AnnouncementDetailPageProps) {
  const { communicationId } = await params;
  const communication = getCommunicationById(communicationId);
  const project = getProjectById(communication?.projectId ?? demoProjectId);
  const nextAction = communication
    ? getRecommendedCommunicationActionForItem(communication)
    : undefined;

  return (
    <AdminShell active="announcements">
          <Link
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-slate-600 transition hover:bg-white/56 hover:text-slate-950"
            href={getCommunicationNotFoundHref()}
          >
            Back to Communications
          </Link>

          {!communication ? (
            <div className="mt-4">
              <NotFoundState />
              <div className="mt-4">
                <Button href="/admin/announcements" variant="secondary">
                  Return to Communications
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Communications preview
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                      {communication.title}
                    </h1>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex min-h-8 items-center rounded-full border border-white/80 bg-white/62 px-3 py-1 text-xs font-semibold text-slate-600">
                      {communicationTypeLabels[communication.messageType]}
                    </span>
                    <StatusLabel status={communication.status} />
                  </div>
                </div>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                  Review the message, audience, and reminder plan before sending is active.
                </p>
              </header>

              <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <GlassCard className="overflow-hidden">
                  <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                      Message preview
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Current message body for coordinator review.
                    </p>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="rounded-lg border border-white/72 bg-white/62 p-4">
                      <p className="text-sm leading-7 text-slate-700">
                        {communication.bodyPreview}
                      </p>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Sending is not active yet
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                    {nextAction?.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {nextAction?.detail}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    This page does not send email, schedule jobs, resolve recipients, or save
                    changes. It is a planning surface for future communication review.
                  </p>
                </GlassCard>
              </section>

              <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                <GlassCard className="p-4 sm:p-5">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    Recipients
                  </h2>
                  <div className="mt-4 grid gap-3">
                    <InfoRow
                      label="Audience"
                      value={communicationAudienceLabels[communication.audience]}
                    />
                    <InfoRow
                      label="Recipient explanation"
                      value={getCommunicationAudienceExplanation(communication)}
                    />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 sm:p-5">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    Message details
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoRow label="Project" value={project?.name ?? "Active workspace"} />
                    <InfoRow
                      label="Author"
                      value={`${communication.author} - ${communication.authorRole}`}
                    />
                    <InfoRow label="Created" value={formatDate(communication.createdAt)} />
                    <InfoRow label="Updated" value={formatDate(communication.updatedAt)} />
                    {communication.scheduledAt ? (
                      <InfoRow label="Reminder plan" value={communication.scheduledAt} />
                    ) : null}
                    <InfoRow
                      label="Status"
                      value={communicationStatusLabels[communication.status]}
                    />
                  </div>
                </GlassCard>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <GlassCard className="overflow-hidden">
                  <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                    <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                      Future actions
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      These show likely future actions and do not save or send anything.
                    </p>
                  </div>
                  <div className="p-4 sm:p-5">
                    <PlaceholderActions communication={communication} />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Coming next
                  </p>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                    Detail patterns first, sending later
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Real email delivery, templates, unsubscribe handling, suppression logic, and
                    delivery tracking remain future work.
                  </p>
                  {communication.relatedRoute ? (
                    <Button
                      className="mt-4"
                      href={communication.relatedRoute}
                      variant="secondary"
                    >
                      Open related project area
                    </Button>
                  ) : null}
                  <Button
                    className="mt-3"
                    href="/admin/announcements/templates"
                    variant="ghost"
                  >
                    View reminder templates
                  </Button>
                </GlassCard>
              </section>
            </div>
          )}
    </AdminShell>
  );
}
