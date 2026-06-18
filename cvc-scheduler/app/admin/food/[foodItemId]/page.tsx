import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import {
  foodCoordinationItems,
  foodServiceTypeLabels,
  getFoodCoverageStatusLabel,
  getFoodCoverageStatusTone,
  getFoodDetailHref,
  getFoodItemById,
  getFoodNotFoundHref,
  getNextFoodActionForItem,
  getProjectById,
  getRelatedFoodItemsForSameDay,
} from "@/lib/mockData";
import type {
  FoodCoordinationItem,
  FoodCoverageStatus,
  FoodStatusTone,
} from "@/lib/mockData";

type FoodDetailPageProps = {
  params: Promise<{
    foodItemId: string;
  }>;
};

const statusStyles: Record<FoodStatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

function StatusLabel({ status }: { status: FoodCoverageStatus }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[getFoodCoverageStatusTone(status)]}`}
    >
      {getFoodCoverageStatusLabel(status)}
    </span>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{value}</p>
    </div>
  );
}

function PlaceholderActions({ item }: { item: FoodCoordinationItem }) {
  const actions =
    item.status === "needsHeadcount"
      ? ["Review headcount", "Prepare food note"]
      : item.status === "needsHelpers"
        ? ["Add helper later", "Open related follow-up"]
        : ["Prepare food note", "Add helper later"];

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

function RelatedLinks({ item }: { item: FoodCoordinationItem }) {
  const links = [
    item.relatedScheduleId
      ? {
          href: "/admin/schedule",
          label: "Open related schedule",
        }
      : undefined,
    item.relatedAnnouncementId
      ? {
          href: `/admin/announcements/${item.relatedAnnouncementId}`,
          label: "Open food note",
        }
      : undefined,
    item.relatedNeedsAttentionId
      ? {
          href: `/admin/needs-attention/${item.relatedNeedsAttentionId}`,
          label: "Open related follow-up",
        }
      : undefined,
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  if (links.length === 0) {
    return (
      <p className="text-sm leading-6 text-slate-500">
        No related schedule, announcement, or follow-up is linked in this mock data.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          className="inline-flex min-h-10 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
          href={link.href}
          key={link.href}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function SameDayItems({ items }: { items: FoodCoordinationItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm leading-6 text-slate-500">
        No other food support items are listed for this day.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Link
          className="rounded-lg border border-white/70 bg-white/50 px-4 py-3 transition hover:bg-white/74"
          href={getFoodDetailHref(item)}
          key={item.id}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {foodServiceTypeLabels[item.serviceType]}
                {item.estimatedHeadcount ? ` - Headcount ${item.estimatedHeadcount}` : ""}
              </p>
            </div>
            <StatusLabel status={item.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function NotFoundState() {
  return (
    <EmptyState
      title="Food support item not found"
      message="This is mock preview data, so the food support item may have been renamed or removed. Return to Food to choose another day or meal note."
    />
  );
}

export function generateStaticParams() {
  return foodCoordinationItems.map((item) => ({
    foodItemId: item.id,
  }));
}

export default async function FoodDetailPage({ params }: FoodDetailPageProps) {
  const { foodItemId } = await params;
  const item = getFoodItemById(foodItemId);
  const project = getProjectById(item?.projectId ?? "");
  const relatedItems = item ? getRelatedFoodItemsForSameDay(item) : [];
  const nextAction = item ? getNextFoodActionForItem(item) : undefined;
  const helpers =
    item && item.assignedHelpers.length > 0
      ? item.assignedHelpers.join(", ")
      : "Helpers to add";

  return (
    <AdminShell active="food">
      <Link
        className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-slate-600 transition hover:bg-white/56 hover:text-slate-950"
        href={getFoodNotFoundHref()}
      >
        Back to Food
      </Link>

      {!item ? (
        <div className="mt-4">
          <NotFoundState />
          <div className="mt-4">
            <Button href="/admin/food" variant="secondary">
              Return to Food
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <header className="rounded-2xl border border-white/60 bg-white/28 px-5 py-5 backdrop-blur-xl sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.dayLabel}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  {item.title}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex min-h-8 items-center rounded-full border border-white/80 bg-white/62 px-3 py-1 text-xs font-semibold text-slate-600">
                  {foodServiceTypeLabels[item.serviceType]}
                </span>
                <StatusLabel status={item.status} />
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Review this food support item, including headcount, helpers, food contact
              responsibility, and related notes.
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Preview only. This page does not save changes, assign helpers, order food, or
              send messages.
            </p>
          </header>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <GlassCard className="p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Coming next
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {nextAction?.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {nextAction?.detail}
              </p>
            </GlassCard>

            <GlassCard className="p-4 sm:p-5">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                Food details
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoTile label="Date" value={item.dayLabel} />
                <InfoTile
                  label="Headcount"
                  value={item.estimatedHeadcount ?? "To review"}
                />
                <InfoTile
                  label="Congregation"
                  value={item.congregation ?? "To confirm"}
                />
                <InfoTile
                  label="Food contact"
                  value={item.responsibleContact ?? "To confirm"}
                />
                <InfoTile label="Helpers" value={helpers} />
                <InfoTile label="Project" value={project?.name ?? "Active workspace"} />
              </div>
            </GlassCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <GlassCard className="overflow-hidden">
              <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  Meal notes
                </h2>
              </div>
              <div className="space-y-4 p-4 text-sm leading-6 text-slate-600 sm:p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Meal / menu notes
                  </p>
                  <p className="mt-1">{item.mealNotes ?? "No meal notes yet."}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Headcount
                  </p>
                  <p className="mt-1">{item.headcountNotes ?? "No headcount note yet."}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Helpers
                  </p>
                  <p className="mt-1">{item.helperNotes ?? "No helper note yet."}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="overflow-hidden">
              <div className="border-b border-white/72 px-4 py-4 sm:px-5">
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                  Placeholder actions
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  These show likely future actions and do not save changes.
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <PlaceholderActions item={item} />
              </div>
            </GlassCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <GlassCard className="p-4 sm:p-5">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                Related items
              </h2>
              <div className="mt-4">
                <RelatedLinks item={item} />
              </div>
            </GlassCard>

            <GlassCard className="p-4 sm:p-5">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                Same-day food support
              </h2>
              <div className="mt-4">
                <SameDayItems items={relatedItems} />
              </div>
            </GlassCard>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
