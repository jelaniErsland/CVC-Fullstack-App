"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { questionnaireReviewQueueStatuses } from "@/lib/mockData";
import type {
  QuestionnaireReviewItem,
  QuestionnaireReviewQueueStatus,
} from "@/lib/mockData";

type QuestionnaireReviewQueueProps = {
  items: QuestionnaireReviewItem[];
};

type QueueStatusFilter = QuestionnaireReviewQueueStatus | "all";

const sourceLabels = {
  online: "Online",
  paper: "Paper",
  manualEntry: "Manual entry",
};

function QueueStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </GlassCard>
  );
}

function ReviewCard({ item }: { item: QuestionnaireReviewItem }) {
  return (
    <GlassCard className="flex h-full flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:bg-white/72 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {item.congregation} Congregation
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {item.volunteerName}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {item.projectLocation} - {sourceLabels[item.sourceType]}
          </p>
        </div>
        <StatusPill status={item.status} />
      </div>

      <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
        <p>
          <span className="font-medium text-slate-800">Submitted:</span>{" "}
          {item.submittedDate}
        </p>
        {item.email ? (
          <a className="break-words hover:text-slate-950" href={`mailto:${item.email}`}>
            {item.email}
          </a>
        ) : (
          <p>No email listed</p>
        )}
        <p>
          <span className="font-medium text-slate-800">Availability:</span>{" "}
          {item.availabilitySummary}
        </p>
        <p>
          <span className="font-medium text-slate-800">Skills:</span>{" "}
          {item.skillsSummary}
        </p>
        <p>
          <span className="font-medium text-slate-800">Other help:</span>{" "}
          {item.otherWaysToHelpSummary}
        </p>
      </div>

      {item.flagLabels.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {item.flagLabels.map((flag) => (
            <span
              key={flag}
              className="rounded-full border border-white/80 bg-white/62 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {flag}
            </span>
          ))}
        </div>
      ) : null}

      {item.notes.length > 0 ? (
        <div className="mt-5 rounded-lg border border-white/70 bg-white/44 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Review note
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.notes[0]}</p>
        </div>
      ) : null}

      <Button href={`/admin/questionnaires/${item.id}`} variant="secondary" className="mt-6 w-full">
        Review details
      </Button>
    </GlassCard>
  );
}

export function QuestionnaireReviewQueue({ items }: QuestionnaireReviewQueueProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<QueueStatusFilter>("all");
  const [congregation, setCongregation] = useState("all");

  const congregations = useMemo(
    () => Array.from(new Set(items.map((item) => item.congregation))).sort(),
    [items],
  );

  const stats = useMemo(
    () =>
      questionnaireReviewQueueStatuses.map((queueStatus) => ({
        label: queueStatus,
        value: items.filter((item) => item.status === queueStatus).length,
      })),
    [items],
  );

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesStatus = status === "all" || item.status === status;
      const matchesCongregation =
        congregation === "all" || item.congregation === congregation;
      const searchableText = [
        item.volunteerName,
        item.email,
        item.congregation,
        item.projectName,
        item.projectLocation,
        item.availabilitySummary,
        item.skillsSummary,
        item.otherWaysToHelpSummary,
        item.flagLabels.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        normalizedQuery.length === 0 || searchableText.includes(normalizedQuery);

      return matchesStatus && matchesCongregation && matchesQuery;
    });
  }, [congregation, items, query, status]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No questionnaires yet"
        message="Incoming volunteer questionnaires will appear here when people begin responding."
      />
    );
  }

  return (
    <div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <QueueStat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </section>

      <GlassCard className="mt-6 p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Search</span>
            <input
              className="mt-2 min-h-12 w-full rounded-full border border-white/80 bg-white/64 px-5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:bg-white/86 focus:ring-2 focus:ring-slate-300/60"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email, congregation, project"
              type="search"
              value={query}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-600">Status</span>
            <select
              className="mt-2 min-h-12 w-full rounded-full border border-white/80 bg-white/64 px-5 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:bg-white/86 focus:ring-2 focus:ring-slate-300/60"
              onChange={(event) => setStatus(event.target.value as QueueStatusFilter)}
              value={status}
            >
              <option value="all">All statuses</option>
              {questionnaireReviewQueueStatuses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-600">Congregation</span>
            <select
              className="mt-2 min-h-12 w-full rounded-full border border-white/80 bg-white/64 px-5 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-slate-300 focus:bg-white/86 focus:ring-2 focus:ring-slate-300/60"
              onChange={(event) => setCongregation(event.target.value)}
              value={congregation}
            >
              <option value="all">All congregations</option>
              {congregations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
          <p>
            {filteredItems.length} of {items.length} questionnaires
          </p>
          {(query || status !== "all" || congregation !== "all") && (
            <button
              className="rounded-full px-3 py-2 font-semibold text-slate-600 transition hover:bg-white/56 hover:text-slate-950"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setCongregation("all");
              }}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
      </GlassCard>

      {filteredItems.length > 0 ? (
        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          {filteredItems.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </section>
      ) : (
        <div className="mt-5">
          <EmptyState
            title="No matching questionnaires"
            message="Try a different name, email, congregation, project, or status."
          />
        </div>
      )}
    </div>
  );
}
