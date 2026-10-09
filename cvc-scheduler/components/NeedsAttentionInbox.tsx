"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ChevronDown, Search } from "lucide-react";
import { markNeedsAttentionSignalsSeenAction } from "@/app/admin/needs-attention/actions";
import { defaultAdminViews, type AttentionCategory, type AttentionView, type SupportType } from "@/lib/adminViews/preferences";
import { useRememberedView } from "@/lib/adminViews/useRememberedView";
import { filterAttentionIssues, type AttentionIssue } from "@/lib/needsAttention/issues";
import type { NeedsAttentionReadyRouteState } from "@/lib/needsAttention/routeRead.server";

const supportLabels: Record<SupportType, string> = { general: "General", food: "Food", security: "Security" };
const categoryLabels: Record<AttentionCategory, string> = { declined: "Declined", staffing: "Needs staffing", awaiting: "Awaiting response" };
const horizons = { today: "Today", "7": "Next 7 days", "14": "Next 14 days", "30": "Next 30 days", project: "Whole project" } as const;
const field = "min-h-10 rounded-lg border border-[var(--pl-border)] bg-white px-3 text-sm text-[var(--pl-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-blue)]";
const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-blue)] focus-visible:ring-offset-2";
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
function timeLabel(time: string | null) { if (!time) return "All day"; const [h, m] = time.split(":"); const hour = Number(h); return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`; }
function toggle<T>(values: T[], value: T) { return values.includes(value) ? values.filter(entry => entry !== value) : [...values, value]; }

function IssueCard({ issue, onReview, busy }: { issue: AttentionIssue; onReview: (issue: AttentionIssue) => void; busy: boolean }) {
  const needsReplacement = issue.categories.includes("declined") || issue.categories.includes("staffing");
  return <article className="border-b border-[var(--pl-border)] px-4 py-4 last:border-b-0 sm:px-5" data-issue-id={issue.id}>
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1"><div className="min-w-0"><h3 className="text-base font-semibold leading-6 text-[var(--pl-ink)]">{issue.title}</h3><p className="mt-0.5 text-xs font-medium text-[var(--pl-muted)]">{dateLabel(issue.date)} · {timeLabel(issue.time)}{issue.endDate && issue.endDate !== issue.date ? ` – ${dateLabel(issue.endDate)} ${timeLabel(issue.endTime)}` : ""} · {supportLabels[issue.supportType]}</p></div><span className="text-xs font-semibold text-[var(--pl-muted)]">{issue.assignedFractionLabel}</span></div>
    <p className="mt-2 text-sm font-medium text-[var(--pl-text)]">{issue.problems.join(" · ")}</p>
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><Link className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--pl-blue)] px-3 text-sm font-semibold text-white hover:bg-blue-700 ${focus}`} href={issue.href}>{needsReplacement ? "Find replacement" : "Open Calendar item"}<ArrowRight aria-hidden className="size-4" /></Link>{!issue.reviewed ? <button className={`inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--pl-blue)] disabled:opacity-50 ${focus}`} disabled={busy} onClick={() => onReview(issue)} type="button"><Check aria-hidden className="size-4" />Mark reviewed</button> : <span className="text-xs font-semibold text-emerald-800">Reviewed</span>}</div>
    <details className="group mt-2 text-xs text-[var(--pl-muted)]"><summary className={`flex w-fit min-h-8 cursor-pointer list-none items-center gap-1 font-semibold ${focus} [&::-webkit-details-marker]:hidden`}>Details <ChevronDown aria-hidden className="size-3.5 group-open:rotate-180" /></summary><div className="mt-1 rounded-lg bg-[var(--pl-surface-subtle)] p-3"><p>Coverage: {issue.assignedFractionLabel} assigned.</p>{issue.affectedAssignments.length ? <ul className="mt-2 space-y-1">{issue.affectedAssignments.map(assignment => <li key={assignment.assignmentId}><Link className="font-semibold text-[var(--pl-blue)] hover:underline" href={`/admin/assignments/${encodeURIComponent(assignment.assignmentId)}`}>{assignment.name ? `${assignment.name}${assignment.congregation ? ` · ${assignment.congregation}` : ""} · ` : ""}{assignment.responseStatus === "declined" ? "Can’t make it" : "Awaiting response"} · View assignment</Link></li>)}</ul> : null}</div></details>
  </article>;
}

export function NeedsAttentionInbox({ state, initialFilters }: { state: NeedsAttentionReadyRouteState; initialFilters: { support?: string; category?: string; horizon?: string } }) {
  const scope = useMemo(() => ({ contactId: state.projectContactId, workspaceId: state.workspaceId }), [state.projectContactId, state.workspaceId]);
  const [view, setView, resetView, hydrated] = useRememberedView("attention", scope);
  const [search, setSearch] = useState("");
  const [reviewedIds, setReviewedIds] = useState(() => new Set(state.reviewedSignalIds));
  const [reviewing, setReviewing] = useState<string | null>(null);
  const filterDetails = useRef<HTMLDetailsElement>(null);
  const appliedDeepLink = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const sync = () => { if (filterDetails.current) filterDetails.current.open = media.matches; };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!hydrated || appliedDeepLink.current) return;
    appliedDeepLink.current = true;
    const support = initialFilters.support?.split(",").filter((value): value is SupportType => value === "general" || value === "food" || value === "security");
    const category = initialFilters.category?.split(",").filter((value): value is AttentionCategory => value === "declined" || value === "staffing" || value === "awaiting");
    const horizon = initialFilters.horizon;
    if (support || category || (horizon && horizon in horizons)) setView(current => ({ ...current, ...(support ? { supportTypes: support } : {}), ...(category ? { categories: category } : {}), ...(horizon && horizon in horizons ? { horizon: horizon as AttentionView["horizon"] } : {}) }));
  }, [hydrated, initialFilters.support, initialFilters.category, initialFilters.horizon, setView]);
  const issues = useMemo(() => state.issues.map(issue => ({ ...issue, reviewed: issue.signalIds.every(id => reviewedIds.has(id)) })), [state.issues, reviewedIds]);
  const visible = useMemo(() => filterAttentionIssues(issues, view, state.today, search), [issues, view, state.today, search]);
  const grouped = useMemo(() => { const result = new Map<string, AttentionIssue[]>(); for (const issue of visible) result.set(issue.date, [...(result.get(issue.date) ?? []), issue]); return result; }, [visible]);
  const horizonLabels = state.workspaceEndsOn ? horizons : { ...horizons, project: "Next 90 days" };
  const activeLabels = [...view.supportTypes.map(type => supportLabels[type]), ...view.categories.map(category => categoryLabels[category]), horizonLabels[view.horizon], view.status !== "active" ? view.status === "reviewed" ? "Reviewed" : "All statuses" : null].filter(Boolean);
  const custom = JSON.stringify(view) !== JSON.stringify(defaultAdminViews.attention) || Boolean(search.trim());
  async function markReviewed(issue: AttentionIssue) { setReviewing(issue.id); const success = await markNeedsAttentionSignalsSeenAction(state.workspaceId, issue.signalIds).catch(() => false); if (success) { setReviewedIds(current => new Set([...current, ...issue.signalIds])); window.dispatchEvent(new Event("project-local:needs-attention-seen")); } setReviewing(null); }
  return <div className="mx-auto max-w-[1120px] space-y-4 pb-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold text-[var(--pl-blue)]">{state.workspaceName}</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--pl-ink)]">Needs Attention</h1><p className="mt-1 text-sm text-[var(--pl-muted)]">Operational follow-ups, grouped by scheduled work.</p></div><p className="text-sm font-semibold text-[var(--pl-text)]">{visible.length} {visible.length === 1 ? "issue" : "issues"} in this view</p></header>
    <section className="rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-card)]" aria-label="Attention filters"><details className="group" ref={filterDetails}><summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-[var(--pl-ink)] sm:hidden ${focus} [&::-webkit-details-marker]:hidden`}>Filters <ChevronDown aria-hidden className="size-4 group-open:rotate-180" /></summary><div className="grid gap-3 border-t border-[var(--pl-border)] p-4 sm:border-t-0 sm:grid-cols-2 lg:grid-cols-4">
      <fieldset><legend className="mb-1 text-xs font-semibold text-[var(--pl-muted)]">Support</legend><div className="flex flex-wrap gap-1">{(["general", "food", "security"] as const).map(type => <button aria-pressed={view.supportTypes.includes(type)} className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold ${view.supportTypes.includes(type) ? "bg-[var(--pl-blue)] text-white" : "bg-[var(--pl-surface-subtle)] text-[var(--pl-text)]"} ${focus}`} key={type} onClick={() => setView(current => ({ ...current, supportTypes: toggle(current.supportTypes, type) }))} type="button">{supportLabels[type]}</button>)}</div></fieldset>
      <fieldset><legend className="mb-1 text-xs font-semibold text-[var(--pl-muted)]">Issue</legend><div className="flex flex-wrap gap-1">{(["declined", "staffing", "awaiting"] as const).map(category => <button aria-pressed={view.categories.includes(category)} className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold ${view.categories.includes(category) ? "bg-[var(--pl-blue)] text-white" : "bg-[var(--pl-surface-subtle)] text-[var(--pl-text)]"} ${focus}`} key={category} onClick={() => setView(current => ({ ...current, categories: toggle(current.categories, category) }))} type="button">{categoryLabels[category]}</button>)}</div></fieldset>
      <label className="grid gap-1 text-xs font-semibold text-[var(--pl-muted)]">When<select className={field} onChange={event => setView(current => ({ ...current, horizon: event.target.value as AttentionView["horizon"] }))} value={view.horizon}>{Object.entries(horizonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs font-semibold text-[var(--pl-muted)]">Status<select className={field} onChange={event => setView(current => ({ ...current, status: event.target.value as AttentionView["status"] }))} value={view.status}><option value="active">Active</option><option value="reviewed">Reviewed</option><option value="all">All</option></select></label><label className="grid gap-1 text-xs font-semibold text-[var(--pl-muted)]">Sort<select className={field} onChange={event => setView(current => ({ ...current, sort: event.target.value as AttentionView["sort"] }))} value={view.sort}><option value="soonest">Soonest</option><option value="urgent">Most urgent</option></select></label></div>
      <label className="relative sm:col-span-2 lg:col-span-4"><Search aria-hidden className="absolute left-3 top-3 size-4 text-[var(--pl-muted)]" /><input aria-label="Search attention issues" className={`${field} w-full pl-9`} onChange={event => setSearch(event.target.value)} placeholder={state.canSearchVolunteers ? "Search work, volunteer, congregation, or date" : "Search work or date"} type="search" value={search} /></label>
    </div></details><div className="flex flex-wrap items-center gap-2 border-t border-[var(--pl-border)] px-4 py-2 text-xs"><span className="font-semibold text-[var(--pl-muted)]">Showing:</span>{activeLabels.map((label, index) => <span className="rounded-md bg-[var(--pl-blue-soft)] px-2 py-1 font-semibold text-[var(--pl-ink)]" key={`${label}-${index}`}>{label}</span>)}{search.trim() && <span className="rounded-md bg-[var(--pl-blue-soft)] px-2 py-1">Search: {search.trim()}</span>}<button className={`ml-auto min-h-9 text-xs font-semibold text-[var(--pl-blue)] ${focus}`} onClick={() => { resetView(); setSearch(""); }} type="button">{custom ? "Reset view" : "Default view"}</button></div></section>
    {state.summary.truncated && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Showing the earliest {state.summary.totalSignalCount} follow-ups. More work exists beyond this list.</p>}
    {visible.length ? <div className="overflow-hidden rounded-2xl border border-[var(--pl-border)] bg-white shadow-[var(--pl-shadow-card)]">{[...grouped].map(([date, dateIssues]) => <section key={date} aria-label={dateLabel(date)}><h2 className="border-y border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] px-4 py-2 text-xs font-bold text-[var(--pl-muted)] first:border-t-0 sm:px-5">{dateLabel(date)}</h2>{dateIssues.map(issue => <IssueCard busy={reviewing === issue.id} issue={issue} key={issue.id} onReview={markReviewed} />)}</section>)}</div> : <section className="rounded-2xl border border-[var(--pl-border)] bg-white px-5 py-8 text-center"><h2 className="text-lg font-semibold text-[var(--pl-ink)]">No issues in this view</h2><p className="mt-2 text-sm text-[var(--pl-muted)]">Try another date, issue type, or support view.</p><button className={`mt-3 min-h-10 text-sm font-semibold text-[var(--pl-blue)] ${focus}`} onClick={() => { resetView(); setSearch(""); }} type="button">Reset view</button><Link className="ml-4 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--pl-blue)]" href={`/admin/calendar?view=week&date=${state.today}`}><CalendarDays aria-hidden className="size-4" />Open Calendar</Link></section>}
  </div>;
}
