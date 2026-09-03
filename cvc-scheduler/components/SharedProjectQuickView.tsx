import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import type { QuickViewSafeProjection } from "@/lib/operations/projections";

function shiftDate(date: string, amount: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return shifted.toISOString().slice(0, 10);
}

function dateHref(date: string) {
  return `/qv?date=${encodeURIComponent(date)}`;
}

function longDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function compactDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function timeLabel(value: string) {
  const [hourText, minuteText] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minuteText} ${hour >= 12 ? "PM" : "AM"}`;
}

export function SharedProjectQuickView({
  projectEndsOn,
  projection,
  today,
}: {
  projectEndsOn: string;
  projection: QuickViewSafeProjection;
  today: string;
}) {
  const previous = shiftDate(projection.date, -1);
  const next = shiftDate(projection.date, 1);
  const nextAvailable = next <= projectEndsOn;
  const todayAvailable = today <= projectEndsOn;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">Project</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.045em] text-[var(--pl-ink)] sm:text-4xl">
          {projection.projectDisplayName}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--pl-muted)]">Quick View</p>
      </header>

      <nav aria-label="Project date" className="mt-5 flex items-center justify-between gap-2 rounded-2xl border border-[var(--pl-border)] bg-white p-2 shadow-sm">
        <Link aria-label="Previous day" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--pl-text)] transition hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" href={dateHref(previous)}>
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Link>
        <div className="min-w-0 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--pl-muted)]">Date</p>
          <p className="mt-0.5 text-sm font-bold text-[var(--pl-ink)] sm:text-base">
            <span className="sm:hidden">{compactDate(projection.date)}</span>
            <span className="hidden sm:inline">{longDate(projection.date)}</span>
          </p>
          {projection.date === today ? (
            <span className="mt-0.5 block text-xs font-semibold text-[var(--pl-blue)]">Today</span>
          ) : todayAvailable ? (
            <Link className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--pl-blue)] hover:underline" href={dateHref(today)}>
              <CalendarDays aria-hidden="true" className="size-3.5" /> Today
            </Link>
          ) : null}
        </div>
        {nextAvailable ? (
          <Link aria-label="Next day" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--pl-text)] transition hover:bg-[var(--pl-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" href={dateHref(next)}>
            <ChevronRight aria-hidden="true" className="size-5" />
          </Link>
        ) : (
          <span aria-hidden="true" className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-300">
            <ChevronRight className="size-5" />
          </span>
        )}
      </nav>

      <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-panel)]">
        <div className="border-b border-blue-100 bg-blue-50/70 px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--pl-blue)]">Expected on site</p>
          <p className="mt-2 text-4xl font-bold tracking-[-0.045em] text-[var(--pl-ink)]">
            {projection.expectedOnSiteCount === null
              ? "Not set"
              : `${projection.expectedOnSiteCount} ${projection.expectedOnSiteCount === 1 ? "person" : "people"}`}
          </p>
        </div>
        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold tracking-[-0.02em] text-[var(--pl-ink)]">Published schedule</h2>
            <span className="text-xs font-semibold text-[var(--pl-muted)]">
              {projection.publishedSchedule.length} item{projection.publishedSchedule.length === 1 ? "" : "s"}
            </span>
          </div>
          {projection.publishedSchedule.length ? (
            <ul className="mt-3 divide-y divide-[var(--pl-border)]">
              {projection.publishedSchedule.map((item, index) => (
                <li className="grid gap-1 py-4 first:pt-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4" key={`${item.title}:${index}`}>
                  <p className="font-semibold text-[var(--pl-ink)]">{item.title}</p>
                  <p className="text-sm font-semibold text-[var(--pl-text)]">
                    {item.schedule.kind === "timed"
                      ? `${timeLabel(item.schedule.startTime)}–${timeLabel(item.schedule.endTime)}`
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
    </main>
  );
}
