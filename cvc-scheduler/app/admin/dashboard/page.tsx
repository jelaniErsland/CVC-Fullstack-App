import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileQuestion,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import {
  demoProjectId,
  getAssignedProjectWorkspace,
  getCalendarCompactDayLabel,
  getCalendarFilledLabel,
  getCalendarHighLevelTaskType,
  getCalendarHighLevelTaskTypeLabel,
  getCalendarItemDisplayName,
  getCalendarItemTimeWindow,
  getCalendarItemsByWeek,
  getCalendarStatusLabel,
  getNeedsAttentionCounts,
  getNeedsAttentionItemsForProject,
  getNeedsAttentionReviewHref,
  getQuestionnaireReviewCounts,
} from "@/lib/mockData";
import type { CalendarItem, NeedsAttentionItem } from "@/lib/mockData";

type QuickAction = {
  href: string;
  icon: LucideIcon;
  label: string;
  note: string;
};

const quickActions: QuickAction[] = [
  {
    href: "/admin/questionnaires",
    icon: FileQuestion,
    label: "Review questionnaires",
    note: "Read new volunteer intake",
  },
  {
    href: "/admin/calendar",
    icon: CalendarDays,
    label: "Open Calendar",
    note: "Check the week schedule",
  },
  {
    href: "/admin/tasks",
    icon: ClipboardList,
    label: "Open Tasks",
    note: "Manage reusable work",
  },
  {
    href: "/admin/announcements",
    icon: MessageSquare,
    label: "Prepare communication",
    note: "Draft or review updates",
  },
];

function OverviewHeader({
  dateRange,
  location,
  projectName,
  status,
}: {
  dateRange: string;
  location: string;
  projectName: string;
  status: "active" | "draft" | "archived";
}) {
  return (
    <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Overview
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Good place to start
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            {projectName} in {location}. Use this page to see what is coming up,
            what needs a look, and where to go next.
          </p>
        </div>
        <div className="flex w-fit flex-wrap items-center gap-2">
          <StatusPill status={status} />
          <span className="inline-flex min-h-8 items-center rounded-full border border-white/80 bg-white/62 px-3 text-xs font-semibold text-slate-600">
            {dateRange}
          </span>
        </div>
      </div>
    </header>
  );
}

function SectionShell({
  actionHref,
  actionLabel,
  children,
  eyebrow,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/72 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
        </div>
        {actionHref && actionLabel ? (
          <Link
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-white/80 bg-white/68 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
            href={actionHref}
          >
            {actionLabel}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </GlassCard>
  );
}

function CalendarSnapshot({ items }: { items: CalendarItem[] }) {
  return (
    <SectionShell
      actionHref="/admin/calendar"
      actionLabel="Open Calendar"
      eyebrow="This week"
      title="Coming up soon"
    >
      <div className="divide-y divide-white/72">
        {items.slice(0, 5).map((item) => {
          const taskType = getCalendarHighLevelTaskType(item);

          return (
            <Link
              className="grid gap-2 px-4 py-3 transition hover:bg-white/46 sm:grid-cols-[132px_1fr_auto] sm:items-center sm:px-5"
              href="/admin/calendar"
              key={item.id}
            >
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {getCalendarCompactDayLabel(item.date)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {getCalendarItemTimeWindow(item)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {getCalendarItemDisplayName(item)}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {getCalendarHighLevelTaskTypeLabel(taskType)} ·{" "}
                  {getCalendarStatusLabel(item.status)}
                </p>
              </div>
              <span className="inline-flex min-h-8 w-fit items-center rounded-full border border-slate-200 bg-white/70 px-3 text-xs font-semibold text-slate-600">
                {getCalendarFilledLabel(item)} filled
              </span>
            </Link>
          );
        })}
      </div>
    </SectionShell>
  );
}

function FollowUpSummary({
  counts,
  items,
}: {
  counts: ReturnType<typeof getNeedsAttentionCounts>;
  items: NeedsAttentionItem[];
}) {
  return (
    <SectionShell
      actionHref="/admin/needs-attention"
      actionLabel="See all"
      eyebrow="Worth checking"
      title={`${counts.open} open follow-ups`}
    >
      <div className="divide-y divide-white/72">
        {items.slice(0, 4).map((item) => (
          <Link
            className="block px-4 py-3 transition hover:bg-white/46 sm:px-5"
            href={getNeedsAttentionReviewHref(item)}
            key={item.id}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {item.area}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
              </div>
              <span className="inline-flex min-h-8 w-fit shrink-0 items-center rounded-full border border-slate-200 bg-white/70 px-3 text-xs font-semibold text-slate-600">
                {item.priority === "important" ? "Needs a look" : "Open"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

function QuickActions() {
  return (
    <SectionShell eyebrow="Next actions" title="Common places">
      <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
        {quickActions.map((action) => {
          const Icon = action.icon;

          return (
            <Link
              className="flex min-h-16 items-center gap-3 rounded-lg border border-white/72 bg-white/50 px-3 py-3 transition hover:bg-white/78"
              href={action.href}
              key={action.href}
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-950">
                  {action.label}
                </span>
                <span className="mt-1 block text-xs font-medium text-slate-500">
                  {action.note}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </SectionShell>
  );
}

function ProjectRhythm({
  questionnaireCount,
  roles,
}: {
  questionnaireCount: number;
  roles: string[];
}) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Project rhythm
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
        One shared project home
      </h2>
      <div className="mt-3 grid gap-3 text-sm leading-6 text-slate-600">
        <p>
          Main contacts can start here, then move into Calendar, Tasks,
          Volunteers, or Communications when they need more detail.
        </p>
        <p>
          Your current view includes {roles.join(", ")}. Future role-aware
          versions can emphasize the same shared workspace differently without
          splitting food, security, or on-site contacts into separate dashboards.
        </p>
        <p className="font-semibold text-slate-700">
          {questionnaireCount} questionnaire{questionnaireCount === 1 ? "" : "s"}{" "}
          still need a review pass.
        </p>
      </div>
    </GlassCard>
  );
}

export default function AdminDashboardPage() {
  const workspace = getAssignedProjectWorkspace();
  const project = workspace.project;
  const roles = workspace.roles;

  if (!project) {
    return (
      <AdminShell active="overview">
        <GlassCard className="w-full max-w-lg p-6 text-center sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            No Workspace
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
            Create your project workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            New CVC admins start by creating a workspace. The real-world project is then attached
            to them as the Project CVC / Owner.
          </p>
          <Button href="/admin/projects/new" className="mt-6">
            Start New Workspace
          </Button>
        </GlassCard>
      </AdminShell>
    );
  }

  const projectId = project.id ?? demoProjectId;
  const weekItems = getCalendarItemsByWeek("2026-01-12", projectId);
  const needsAttentionItems = getNeedsAttentionItemsForProject(projectId).filter(
    (item) => item.status !== "resolved",
  );
  const needsAttentionCounts = getNeedsAttentionCounts(projectId);
  const questionnaireCounts = getQuestionnaireReviewCounts(projectId);
  const questionnaireReviewCount =
    questionnaireCounts.submitted +
    questionnaireCounts.needsReview +
    questionnaireCounts.needsFollowUp;

  return (
    <AdminShell active="overview">
      <div className="space-y-4">
        <OverviewHeader
          dateRange={project.dateRange}
          location={project.location}
          projectName={project.name}
          status={project.status}
        />

        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <CalendarSnapshot items={weekItems} />
          <FollowUpSummary counts={needsAttentionCounts} items={needsAttentionItems} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <QuickActions />
          <ProjectRhythm
            questionnaireCount={questionnaireReviewCount}
            roles={roles}
          />
        </div>
      </div>
    </AdminShell>
  );
}
