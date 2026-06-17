import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  getNeedsAttentionRelatedHref,
  groupNeedsAttentionItemsByArea,
} from "@/lib/mockData";
import type {
  NeedsAttentionCounts,
  NeedsAttentionGroup,
  NeedsAttentionItem,
  NeedsAttentionPriority,
  NeedsAttentionStatus,
} from "@/lib/mockData";

type NeedsAttentionOverviewProps = {
  counts: NeedsAttentionCounts;
  groups: NeedsAttentionGroup[];
};

const priorityLabels: Record<NeedsAttentionPriority, string> = {
  low: "Low",
  normal: "Normal",
  important: "Important",
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

function SummaryItem({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-white/72 bg-white/54 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

function PriorityPill({ priority }: { priority: NeedsAttentionPriority }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${priorityStyles[priority]}`}
    >
      {priorityLabels[priority]}
    </span>
  );
}

function NeedsAttentionRow({ item }: { item: NeedsAttentionItem }) {
  const href = getNeedsAttentionRelatedHref(item);

  return (
    <details className="group border-t border-white/72 first:border-t-0">
      <summary className="grid min-h-[76px] cursor-pointer list-none gap-3 px-4 py-3 transition hover:bg-white/46 sm:grid-cols-[120px_1fr_auto] sm:items-center sm:px-5">
        <div>
          <p className="text-sm font-semibold text-slate-950">{item.area}</p>
          {item.relatedDate ? (
            <p className="mt-1 text-xs font-medium text-slate-500">{item.relatedDate}</p>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
            <PriorityPill priority={item.priority} />
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
        </div>

        <div className="flex items-center gap-3 sm:justify-end">
          <span className="rounded-full border border-white/80 bg-white/62 px-3 py-1 text-xs font-semibold text-slate-500">
            {statusLabels[item.status]}
          </span>
          <span className="text-xs font-semibold text-slate-400 group-open:hidden">
            Details
          </span>
          <span className="hidden text-xs font-semibold text-slate-400 group-open:inline">
            Hide
          </span>
        </div>
      </summary>

      <div className="grid gap-4 bg-white/36 px-4 pb-4 text-sm leading-6 text-slate-600 sm:grid-cols-[1fr_auto] sm:items-end sm:px-5">
        <div>
          <p>
            <span className="font-medium text-slate-800">Next step:</span>{" "}
            {item.suggestedNextStep}
          </p>
          {item.detail ? <p className="mt-2">{item.detail}</p> : null}
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/80 bg-white/70 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950"
          href={href}
        >
          Open related
        </Link>
      </div>
    </details>
  );
}

export function NeedsAttentionOverview({
  counts,
  groups,
}: NeedsAttentionOverviewProps) {
  const visibleGroups =
    groups.length > 0 ? groups : groupNeedsAttentionItemsByArea([]);

  if (counts.total === 0) {
    return (
      <EmptyState
        title="Nothing needs attention right now"
        message="When follow-ups, open coverage, or setup notes appear, they will show here in a calm list."
      />
    );
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem helper="Ready for a coordinator" label="Open" value={counts.open} />
          <SummaryItem
            helper="Worth looking at first"
            label="Important"
            value={counts.important}
          />
          <SummaryItem helper="Already being reviewed" label="In review" value={counts.inReview} />
          <SummaryItem helper="Kept for context" label="Resolved" value={counts.resolved} />
        </div>
      </GlassCard>

      {visibleGroups.map((group) => (
        <GlassCard className="overflow-hidden" key={group.area}>
          <div className="border-b border-white/72 px-4 py-4 sm:px-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Area
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                  {group.area}
                </h2>
              </div>
              <p className="text-sm text-slate-500">{group.items.length} items</p>
            </div>
          </div>
          <div>
            {group.items.map((item) => (
              <NeedsAttentionRow item={item} key={item.id} />
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
