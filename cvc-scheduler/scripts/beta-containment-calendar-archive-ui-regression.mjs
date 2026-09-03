import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

const [nav, shell, proxy, unavailable, calendar, calendarPage, volunteerCard, statusPill] =
  await Promise.all([
    read("components/AdminNav.tsx"),
    read("components/AdminShell.tsx"),
    read("proxy.ts"),
    read("app/admin/beta-unavailable/page.tsx"),
    read("components/CalendarClient.tsx"),
    read("app/admin/calendar/page.tsx"),
    read("components/VolunteerCard.tsx"),
    read("components/StatusPill.tsx"),
  ]);

for (const href of [
  "/admin/announcements",
  "/admin/food",
  "/admin/projects",
  "/admin/questionnaires",
  "/admin/schedule",
  "/admin/security",
  "/admin/settings",
]) {
  assert.match(proxy, new RegExp(`"${href.replaceAll("/", "\\/")}"`));
  assert.doesNotMatch(nav, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
  assert.doesNotMatch(shell, new RegExp(`href: "${href.replaceAll("/", "\\/")}"`));
}

assert.match(unavailable, /This area isn&apos;t available in the beta yet/);
assert.match(unavailable, /Calendar, Tasks, Volunteers, Needs Attention, or Quick View/);
assert.doesNotMatch(nav, /href="\/admin\/projects"/);
assert.match(nav, /aria-label=\{`Current project:/);

assert.match(calendar, /Lifecycle/);
assert.match(calendar, /Archive item/);
assert.match(calendar, /Archive this calendar item\?/);
assert.match(calendar, /This does not notify assigned volunteers\./);
assert.match(calendar, /canArchiveSelectedItem = canEdit && Boolean\(archiveAction\)/);
assert.match(calendarPage, /archiveCalendarItemWithClient/);
assert.match(calendarPage, /archiveAction=\{archiveCalendarItemAction\}/);
assert.match(calendarPage, /safeCalendarRedirect\(formData, notice, undefined, false\)/);

assert.match(volunteerCard, /lifecycle === "inactive"\) return "inactive"/);
assert.match(statusPill, /inactive: "border-amber-200/);

console.log("Beta containment, Calendar archive UI, and Volunteer inactive-label checks passed.");
