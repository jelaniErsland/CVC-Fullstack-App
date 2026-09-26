"use client";

import Link from "next/link";
import { useState } from "react";
import { calendarRouteHref } from "@/lib/calendar/routeHref";
import { statusDisplay } from "@/lib/statusDisplay";
import { volunteerAge, type VolunteerProfile } from "@/lib/volunteers/profile";
import type { VolunteerScheduleResult } from "@/lib/volunteers/schedule.server";
import { DisclosureSection } from "./DisclosureSection";

function value(text: string | null | undefined) { return text?.trim() || "Not listed"; }
function yesNoUnknown(text: string) { return text === "yes" ? "Yes" : text === "no" ? "No" : "Not recorded"; }
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
function clock(time: string | null) {
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function VolunteerProfileView({ volunteer, schedule, today, workspaceKey, canCommunicate, onNavigate, onRetry }: {
  volunteer: VolunteerProfile;
  schedule: VolunteerScheduleResult | null;
  today: string;
  workspaceKey: string;
  canCommunicate: boolean;
  onNavigate: () => void;
  onRetry: () => void;
}) {
  const [period, setPeriod] = useState<"upcoming" | "past">("upcoming");
  const rows = schedule?.kind === "ready" ? schedule.items
    .filter(item => period === "upcoming" ? item.date >= today : item.date < today)
    .sort((a, b) => period === "upcoming"
      ? a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.assignmentId.localeCompare(b.assignmentId)
      : b.date.localeCompare(a.date) || (b.startTime ?? "").localeCompare(a.startTime ?? "") || a.assignmentId.localeCompare(b.assignmentId)) : [];
  return <div className="space-y-5 text-sm text-[var(--pl-text)]">
    <section className="grid gap-3 rounded-xl border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-4 sm:grid-cols-2">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--pl-muted)]">Contact</p><p className="mt-1 break-words font-semibold text-[var(--pl-ink)]">{volunteer.fullName}</p><p>{value(volunteer.congregation)}</p></div>
      <div className="min-w-0 space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--pl-muted)]">Get in touch</p><p className="break-all">{volunteer.email ? <a className="text-[var(--pl-blue)] underline" href={`mailto:${volunteer.email}`}>{volunteer.email}</a> : "No email listed"}</p><p>{volunteer.phone ? <a className="text-[var(--pl-blue)] underline" href={`tel:${volunteer.phone}`}>{volunteer.phone}</a> : "No phone listed"}</p><p>Preferred: {value(volunteer.preferredContactMethod)}</p></div>
      <p><strong>Lifecycle:</strong> {volunteer.lifecycle[0].toUpperCase() + volunteer.lifecycle.slice(1)}</p><p><strong>Scheduling:</strong> {volunteer.readinessStatus === "ready" ? "Schedule-ready" : "On hold"}</p>
    </section>
    <section aria-label="Volunteer schedule" className="rounded-xl border border-[var(--pl-border)] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold text-[var(--pl-ink)]">Schedule</h3><p className="mt-0.5 text-xs text-[var(--pl-muted)]">Select an assignment to open its Calendar day.</p></div>{canCommunicate && <Link className="inline-flex min-h-10 items-center rounded-lg border border-[var(--pl-border)] px-3 text-xs font-semibold text-[var(--pl-blue)] focus-visible:ring-2 focus-visible:ring-blue-500" href={`/admin/announcements?kind=schedule&volunteer=${encodeURIComponent(volunteer.id)}`} onClick={onNavigate}>Resend schedule</Link>}</div>
      <div className="mt-4 inline-flex rounded-lg border border-[var(--pl-border)] bg-[var(--pl-surface-subtle)] p-0.5" role="group" aria-label="Schedule period">{(["upcoming", "past"] as const).map(tab => <button key={tab} aria-pressed={period === tab} className={`min-h-10 rounded-md px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-blue-500 ${period === tab ? "bg-white text-[var(--pl-blue)] shadow-sm" : "text-[var(--pl-text)]"}`} onClick={() => setPeriod(tab)} type="button">{tab === "upcoming" ? "Upcoming" : "Past"}</button>)}</div>
      {schedule === null ? <p className="mt-4" role="status">Loading schedule…</p> : schedule.kind === "error" ? <div className="mt-4" role="alert"><p>Schedule could not be loaded.</p><button className="mt-2 min-h-10 font-semibold text-[var(--pl-blue)] underline" onClick={onRetry} type="button">Try again</button></div> : schedule.kind === "unavailable" ? <p className="mt-4">Schedule is unavailable for this contact or project.</p> : rows.length === 0 ? <p className="mt-4 text-[var(--pl-muted)]">No {period} assignments.</p> : <ul className="mt-3 divide-y divide-[var(--pl-border)]">{rows.map(item => <li key={item.assignmentId}><Link className="block rounded-lg px-2 py-3 hover:bg-[var(--pl-surface-subtle)] focus-visible:ring-2 focus-visible:ring-blue-500" href={calendarRouteHref({ routeBase: "/admin/calendar", projectKey: workspaceKey }, { view: "day", date: item.date, item: item.itemId })} onClick={onNavigate}><span className="block font-semibold text-[var(--pl-ink)]">{item.title}</span><span className="mt-1 block text-xs">{dateLabel(item.date)} · {clock(item.startTime) ? `${clock(item.startTime)}${clock(item.endTime) ? ` – ${clock(item.endTime)}` : ""}` : "No specific time"}</span><span className="mt-1 block text-xs font-semibold">{statusDisplay[item.responseStatus].label}</span></Link></li>)}</ul>}
    </section>
    <section className="rounded-xl border border-[var(--pl-border)] p-4"><h3 className="font-bold text-[var(--pl-ink)]">Availability</h3><p className="mt-2">Work days: {volunteer.availableWorkDays.length ? volunteer.availableWorkDays.join(", ") : "Not recorded"}</p><p>Two or more days per week: {yesNoUnknown(volunteer.availableTwoPlusDays)}</p><p>After-hours security: {yesNoUnknown(volunteer.afterHoursSecurityAvailability)}</p></section>
    <DisclosureSection summary="Skills and support"><div className="space-y-2 text-sm"><p><strong>Skills and experience:</strong> {value(volunteer.skillsExperience)}</p><p><strong>Other support:</strong> {value(volunteer.otherSupport)}</p><p><strong>Housing possible:</strong> {yesNoUnknown(volunteer.housingOption)}</p><p><strong>Builder Assistant communication:</strong> {yesNoUnknown(volunteer.builderAssistantCommunication)}</p></div></DisclosureSection>
    <DisclosureSection summary="Other profile details"><div className="space-y-2 text-sm"><p><strong>Notes:</strong> {value(volunteer.profileNotes)}</p><p><strong>Source:</strong> {volunteer.profileSource === "manual" ? "Added directly" : "From questionnaire"}</p><p><strong>Date of birth:</strong> {volunteer.dateOfBirth ? `${dateLabel(volunteer.dateOfBirth)}${volunteerAge(volunteer.dateOfBirth) !== null ? ` · Age ${volunteerAge(volunteer.dateOfBirth)}` : ""}` : "Not listed"}</p><p><strong>Emergency contact:</strong> {value(volunteer.emergencyContactName)}{volunteer.emergencyContactRelationship ? ` · ${volunteer.emergencyContactRelationship}` : ""}{volunteer.emergencyContactPhone ? ` · ${volunteer.emergencyContactPhone}` : ""}</p></div></DisclosureSection>
  </div>;
}
