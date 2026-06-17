"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import type {
  Project,
  ScheduleAssignmentCategory,
  ScheduleAssignmentCounts,
  ScheduleAssignmentWithVolunteers,
  ScheduleDayGroup,
} from "@/lib/mockData";

type ScheduleWeekViewProps = {
  project: Project;
  dayGroups: ScheduleDayGroup[];
  counts: ScheduleAssignmentCounts;
};

const categoryStyles: Record<ScheduleAssignmentCategory, string> = {
  Construction: "bg-slate-700",
  Food: "bg-emerald-600",
  Security: "bg-indigo-600",
  Cleaning: "bg-sky-600",
  Other: "bg-amber-600",
};

function SummaryItem({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-white/72 bg-white/54 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{label}</p>
        <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function AssignmentRow({
  assignment,
  isExpanded,
  onToggle,
}: {
  assignment: ScheduleAssignmentWithVolunteers;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const volunteerSummary =
    assignment.volunteers.length > 0
      ? assignment.volunteers.map((volunteer) => volunteer.name).join(", ")
      : "Unassigned";
  const timeLabel =
    assignment.startTime && assignment.endTime
      ? `${assignment.startTime} - ${assignment.endTime}`
      : assignment.shiftLabel;

  return (
    <div className="border-t border-white/72 first:border-t-0">
      <button
        className="grid min-h-[72px] w-full gap-3 px-4 py-3 text-left transition hover:bg-white/48 sm:grid-cols-[128px_1fr_auto] sm:items-center sm:px-5"
        onClick={onToggle}
        type="button"
      >
        <div>
          <p className="text-sm font-semibold text-slate-950">{timeLabel}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{assignment.shiftLabel}</p>
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${categoryStyles[assignment.category]}`}
            />
            <p className="truncate text-base font-semibold text-slate-950">
              {assignment.title}
            </p>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">
            {assignment.category} - {volunteerSummary}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:justify-end">
          <StatusPill status={assignment.status} />
          <span className="text-xs font-semibold text-slate-400">
            {isExpanded ? "Hide" : "Details"}
          </span>
        </div>
      </button>

      {isExpanded ? (
        <div className="grid gap-4 bg-white/38 px-4 pb-4 pt-1 text-sm leading-6 text-slate-600 sm:grid-cols-2 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Coverage
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {assignment.volunteers.length > 0 ? (
                assignment.volunteers.map((volunteer) => (
                  <Link
                    className="rounded-full border border-white/80 bg-white/64 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white/88 hover:text-slate-950"
                    href={`/admin/volunteers/${volunteer.id}`}
                    key={volunteer.id}
                  >
                    {volunteer.name}
                  </Link>
                ))
              ) : (
                <span className="rounded-full border border-white/80 bg-white/64 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  No volunteer assigned yet
                </span>
              )}
            </div>
            <p className="mt-3">
              <span className="font-medium text-slate-800">Congregation:</span>{" "}
              {assignment.congregation ?? "Any supporting congregation"}
            </p>
            {assignment.location ? (
              <p>
                <span className="font-medium text-slate-800">Location:</span>{" "}
                {assignment.location}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Notes
            </p>
            <p className="mt-2">{assignment.notes ?? "No notes added yet."}</p>
            {assignment.statusExplanation ? (
              <p className="mt-3 rounded-lg border border-white/70 bg-white/52 px-3 py-2 text-slate-600">
                {assignment.statusExplanation}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ScheduleWeekView({
  project,
  dayGroups,
  counts,
}: ScheduleWeekViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const weekLabel = useMemo(() => {
    const first = dayGroups[0]?.dayLabel;
    const last = dayGroups[dayGroups.length - 1]?.dayLabel;

    return first && last ? `${first} to ${last}, 2026` : project.dateRange;
  }, [dayGroups, project.dateRange]);

  if (dayGroups.length === 0) {
    return (
      <EmptyState
        title="No schedule assignments yet"
        message="Mock assignments for the active project week will appear here when the scheduling module has data."
      />
    );
  }

  return (
    <div className="space-y-5">
      <GlassCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
              Project week
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {weekLabel}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Mock schedule foundation for {project.name}. The highlighted reference day is
              January 12, 2026 for this preview dataset.
            </p>
          </div>
          <Button
            className="cursor-not-allowed opacity-70"
            disabled
            type="button"
            variant="secondary"
          >
            Add assignment coming next
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem
            hint="Ready to fill"
            label="Open"
            value={counts.open}
          />
          <SummaryItem
            hint="Volunteer selected"
            label="Assigned"
            value={counts.assigned}
          />
          <SummaryItem
            hint="Covered"
            label="Confirmed"
            value={counts.confirmed}
          />
          <SummaryItem
            hint="Needs a coordinator look"
            label="Needs Attention"
            value={counts.needsAttention}
          />
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="border-b border-white/72 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                Schedule
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Assignment rows
              </h2>
            </div>
            <p className="text-sm text-slate-500">{counts.total} mock assignments</p>
          </div>
        </div>

        <div>
          {dayGroups.map((dayGroup) => (
            <section
              className="grid border-b border-white/72 last:border-b-0 lg:grid-cols-[156px_1fr]"
              key={dayGroup.date}
            >
              <div className="border-b border-white/72 bg-white/38 px-4 py-4 lg:border-b-0 lg:border-r lg:px-5">
                <p className="text-base font-semibold text-slate-950">{dayGroup.dayLabel}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{dayGroup.date}</p>
                {dayGroup.isToday ? (
                  <span className="mt-3 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    Reference day
                  </span>
                ) : dayGroup.isThisWeek ? (
                  <span className="mt-3 inline-flex rounded-full border border-white/80 bg-white/62 px-3 py-1 text-xs font-semibold text-slate-500">
                    Project week
                  </span>
                ) : null}
              </div>

              <div>
                {dayGroup.assignments.map((assignment) => (
                  <AssignmentRow
                    assignment={assignment}
                    isExpanded={expandedId === assignment.id}
                    key={assignment.id}
                    onToggle={() =>
                      setExpandedId((current) =>
                        current === assignment.id ? null : assignment.id,
                      )
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
