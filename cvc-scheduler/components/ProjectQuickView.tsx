"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { QuickViewProjectOption } from "@/lib/operations/projectQuickViewRoute.server";
import type { QuickViewSafeProjection } from "@/lib/operations/projections";

function shiftProjectDate(date: string, amount: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return shifted.toISOString().slice(0, 10);
}

function buildQuickViewHref(project: string, date: string) {
  const params = new URLSearchParams({ project, date });
  return `/admin/quick-view?${params.toString()}`;
}

function getLongDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function getTimeLabel(value: string) {
  const [hourText, minuteText] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function categoryLabel(category: "general" | "food" | "custom") {
  if (category === "food") return "Food";
  if (category === "custom") return "Custom";
  return "General";
}

export function ProjectQuickView({
  date,
  projects,
  projection,
  selectedProjectKey,
  today,
}: {
  date: string;
  projects: readonly QuickViewProjectOption[];
  projection: QuickViewSafeProjection;
  selectedProjectKey: string;
  today: string;
}) {
  const [projectQuery, setProjectQuery] = useState("");
  const normalizedQuery = projectQuery.trim().toLocaleLowerCase();
  const visibleProjects = useMemo(
    () => projects.filter((project) =>
      project.displayName.toLocaleLowerCase().includes(normalizedQuery),
    ),
    [normalizedQuery, projects],
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <section className="rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white p-4 shadow-[var(--pl-shadow-panel)] sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label className="block text-sm font-semibold text-[var(--pl-ink)]" htmlFor="quick-view-project-search">
              Find a project
            </label>
            <div className="relative mt-2">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--pl-muted)]" />
              <input
                autoComplete="off"
                className="min-h-11 w-full rounded-xl border border-[var(--pl-border)] bg-white pl-10 pr-3 text-sm font-medium text-[var(--pl-ink)] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
                id="quick-view-project-search"
                onChange={(event) => setProjectQuery(event.target.value)}
                placeholder="Search authorized projects"
                type="search"
                value={projectQuery}
              />
            </div>
          </div>
          <form action="/admin/quick-view" className="grid grid-cols-[minmax(0,1fr)_auto] gap-2" method="get">
            <input name="project" type="hidden" value={selectedProjectKey} />
            <label className="sr-only" htmlFor="quick-view-date">Project date</label>
            <input
              className="min-h-11 min-w-0 rounded-xl border border-[var(--pl-border)] bg-white px-3 text-sm font-semibold text-[var(--pl-ink)] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20"
              defaultValue={date}
              id="quick-view-date"
              name="date"
              type="date"
            />
            <button className="min-h-11 rounded-xl border border-[var(--pl-border)] px-3 text-sm font-semibold text-[var(--pl-text)] transition hover:bg-[var(--pl-surface-subtle)]" type="submit">
              Go
            </button>
          </form>
        </div>

        <div aria-label="Authorized project results" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {visibleProjects.length > 0 ? visibleProjects.map((project) => (
            <Link
              aria-current={project.key === selectedProjectKey ? "page" : undefined}
              className={[
                "inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
                project.key === selectedProjectKey
                  ? "border-[var(--pl-blue)] bg-[var(--pl-blue)] text-white"
                  : "border-[var(--pl-border)] bg-white text-[var(--pl-text)] hover:border-blue-200 hover:bg-blue-50",
              ].join(" ")}
              href={buildQuickViewHref(project.key, date)}
              key={project.key}
            >
              {project.displayName}
            </Link>
          )) : (
            <p className="py-2 text-sm text-[var(--pl-muted)]">No authorized projects match.</p>
          )}
        </div>
      </section>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Link
          aria-label="Previous day"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--pl-border)] bg-white text-[var(--pl-text)] shadow-sm transition hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          href={buildQuickViewHref(selectedProjectKey, shiftProjectDate(date, -1))}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-bold text-[var(--pl-ink)] sm:text-lg">
            {getLongDateLabel(date)}
          </p>
          {date !== today ? (
            <Link className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--pl-blue)] hover:underline" href={buildQuickViewHref(selectedProjectKey, today)}>
              <CalendarDays aria-hidden="true" className="size-3.5" />
              Today
            </Link>
          ) : (
            <p className="mt-1 text-xs font-semibold text-[var(--pl-blue)]">Today</p>
          )}
        </div>
        <Link
          aria-label="Next day"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--pl-border)] bg-white text-[var(--pl-text)] shadow-sm transition hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          href={buildQuickViewHref(selectedProjectKey, shiftProjectDate(date, 1))}
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      </div>

      <section className="mt-4 overflow-hidden rounded-[var(--pl-radius-panel)] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)]">
        <div className="border-b border-[var(--pl-border)] bg-blue-50/55 px-5 py-5 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">Expected on site</p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.045em] text-[var(--pl-ink)]">
            {projection.expectedOnSiteCount === null
              ? "Not set"
              : `${projection.expectedOnSiteCount} ${projection.expectedOnSiteCount === 1 ? "person" : "people"}`}
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--pl-text)]">{projection.projectDisplayName}</p>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-[-0.02em] text-[var(--pl-ink)]">Published schedule</h2>
            <span className="text-xs font-semibold text-[var(--pl-muted)]">
              {projection.publishedSchedule.length} item{projection.publishedSchedule.length === 1 ? "" : "s"}
            </span>
          </div>
          {projection.publishedSchedule.length > 0 ? (
            <ul className="mt-3 divide-y divide-[var(--pl-border)]">
              {projection.publishedSchedule.map((item, index) => (
                <li className="grid gap-1 py-4 first:pt-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4" key={`${item.title}:${index}`}>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--pl-ink)]">{item.title}</p>
                    <p className="mt-1 text-xs font-medium text-[var(--pl-muted)]">
                      {categoryLabel(item.category)} · Planned staffing {item.plannedStaffingCount}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-[var(--pl-text)]">
                    {item.schedule.kind === "timed"
                      ? `${getTimeLabel(item.schedule.startTime)}–${getTimeLabel(item.schedule.endTime)}`
                      : "Time not set"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] px-4 py-5 text-sm leading-6 text-[var(--pl-muted)]">
              No published project schedule for this day.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
