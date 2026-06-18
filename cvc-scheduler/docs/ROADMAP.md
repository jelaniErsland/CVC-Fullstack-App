# Roadmap

## 1. Development Strategy

- Belgrade Remodel remains the production Sheets/App Script workflow.
- The full-stack app is being built in parallel.
- Belgrade is the research/testing blueprint.
- The goal is to be ready for the next project after Belgrade.
- Do not rush the full-stack app into the live Belgrade remodel unless a narrow slice becomes safe.

## 2. Real-World Readiness Plan

Rough phases:

- Mock prototype foundation.
- Real-data alpha.
- Practical MVP for next project.
- Multi-module platform version.

## 3. Near-Term Roadmap

- 05B.1 Questionnaire data model/helpers. Completed.
- 05B.2 Public questionnaire form shell. Completed.
- 05B.3 Admin questionnaire review queue. Completed.
- 05B.4 Questionnaire detail/review page. Completed.
- 05B.5 Questionnaire-to-volunteer profile readiness. Completed.
- 05B.6 Questionnaire review workflow states. Completed.
- 05B.7 Intake flow stabilization / visual QA. Completed.
- 06.1 Scheduling data model + mock schedule view. Completed.
- 06.5 Role Landing Page UX Alignment. Completed.
- 06.6 Role-home visual QA/stabilization. Completed.
- 07.1 Needs Attention data model + calm overview. Completed.
- 07.2 Conflict/coverage detail patterns. Completed.
- 07.3 Needs Attention visual QA/stabilization. Completed.
- 08.1 Emails and Announcements data model + admin overview. Completed.
- 08.2 Announcement detail/preview page. Completed.
- 08.3 Reminder templates. Completed.
- 08.4 Emails/Announcements visual QA and stabilization. Completed.
- 08.5 Preview Screenshot Refresh + Visual Review Coverage. Completed.
- 09.1 Food module foundation. Completed.
- 09.2 Food detail/day view. Next recommended step.

## 4. Mid-Term Roadmap

- 06 Scheduling foundation.
- 06.5 Role Landing Page UX Alignment for Primary CVC, Assistant CVC, Primary Food Contact, Primary Security Contact, and possible On-site Contact homes.
- 06.6 Role-home visual QA/stabilization.
- 07 Needs Attention / Conflicts.
- 07.2 Conflict/coverage detail patterns.
- 07.3 Needs Attention visual QA/stabilization.
- 08 Emails and announcements.
- 08.1 Emails and Announcements data model + admin overview.
- 08.2 Announcement detail/preview page.
- 08.3 Reminder templates.
- 08.4 Emails/Announcements visual QA and stabilization.
- 08.5 Preview Screenshot Refresh + Visual Review Coverage.
- 09.1 Food module foundation.
- 09.2 Food detail/day view.
- 09 Food and Security modules.
- 10 Public volunteer portal.

## 5. Later Roadmap

- 11 Supabase/auth/persistence.
- 12 Platform admin.
- Copy previous project/workspace.
- Archive completed projects.
- Multi-workspace management.
- More complete permissions.

## 6. Real-World MVP Definition

For the next project, the app should eventually support:

- Create project workspace.
- Configure modules.
- Invite/add primary contacts.
- Send volunteer questionnaire link.
- Review questionnaire submissions.
- Create volunteer profiles.
- Build assignments.
- Let volunteers confirm/deny.
- Show needs-attention items.
- Send reminder emails.
- Support food/security if enabled.
- Archive project when done.

## 7. Build Discipline

- Keep Codex prompts small.
- Prefer vertical slices.
- Stabilize before adding large new features.
- Keep mock flow feeling right before database work.
- Do not connect Supabase too early if the user flow is still changing.
- Every future iteration should update the docs.

## 8. Questionnaire Intake Notes

05B.3 added a mock admin questionnaire review queue at `/admin/questionnaires`.
It uses existing questionnaire submission data plus review helpers to show new,
needs-review, incomplete, and reviewed submissions with calm card-first filtering.

05B.4 added a focused mock detail review page at
`/admin/questionnaires/[submissionId]` with full questionnaire answers,
review flags, section completion cues, linked volunteer context, and
placeholder-only review actions.

05B.5 added a mock-only volunteer profile preview/readiness layer that shows
how a reviewed questionnaire could become a schedule-ready volunteer record.
It does not create records or mutate state.

05B.6 added mock-only workflow state helpers and detail-page guidance for new
submissions, needs-review items, needs-follow-up items, missing required info,
ready-for-profile submissions, and already linked/reviewed questionnaires.

05B.7 stabilized the intake surfaces with copy cleanup, mobile tap-target polish,
route checks, visual QA, and expanded preview screenshot coverage for the admin
questionnaire queue and detail review page.

Future questionnaire iterations still need:

- Real approve / needs-follow-up workflow actions.
- Real persistence.
- Role-scoped review views.
- Converting approved questionnaire submissions into schedule-ready volunteer records.
- Scheduling integration after conversion.

## 9. Scheduling Notes

06.1 added mock schedule assignment data, grouping/count helpers, and a first
admin schedule view at `/admin/schedule`. The page shows the active Belgrade
project week as compact day groups with expandable assignment rows, soft
coverage counts, status explanations, and linked volunteer details where
available.

Scheduling is still mock-only. Future scheduling work still needs:

- Real scheduling engine.
- Assignment creation and editing.
- Conflict and coverage logic.
- Volunteer confirmation / denial workflow.
- Real persistence.
- Role-specific schedule landing pages.

## 10. Role Home Notes

06.5 reshaped `/admin/dashboard` into a mock role-aware landing page. The
current admin sees a Primary CVC home first, with compact metrics, one next
best action, a week snapshot, coordinator focus rows, recent updates, and
expandable preview patterns for Assistant CVC, Primary Food Contact, Primary
Security Contact, and On-site Contact.

06.6 stabilized the role home visually with tighter dashboard hierarchy, a
lighter project context panel, more prominent next-action treatment, clearer
preview-only language, and mobile/desktop checks for overflow and tap targets.

Role homes are preview/mock-only. Future role work still needs:

- Real role permissions and scoped data.
- Real persistence.
- Full Food and Security module surfaces.
- On-site contact workflows.
- Platform owner/admin homes.

## 11. Needs Attention / Conflicts Notes

07.1 added a mock Needs Attention foundation with follow-up items across
questionnaires, schedule, volunteers, food, security, and setup. The new
`/admin/needs-attention` route uses compact grouped rows, expandable details,
soft priority labels, related links, and calm next-step language. The Primary
CVC dashboard now derives its top next action from the Needs Attention helper.

07.2 added mock conflict and coverage detail patterns at
`/admin/needs-attention/[itemId]`, including coverage gaps, denied assignments,
possible overlaps, missing information before scheduling, food detail gaps, and
security/night-watch coverage. These detail pages show calm explanations,
related assignments/people, suggested next steps, related links, and
placeholder-only actions.

Needs Attention is mock-only. Future work still needs:

- Real conflict detection.
- Real resolution actions.
- Notification logic.
- Role-scoped follow-up views.
- Real persistence.

## 12. Emails and Announcements Notes

08.1 added a mock communication foundation for announcements, reminders,
updates, schedule changes, food notes, and security notes. The new
`/admin/announcements` route shows compact summary counts, recent and draft
announcement rows, audience/status labels, status/type grouping, and clear
copy that sending is not active yet.

08.2 added focused mock detail/preview pages at
`/admin/announcements/[communicationId]` with message preview, audience and
recipient explanation, dates, author/role, reminder plan where present,
related links, placeholder-only actions, and a helpful not-found state.

08.3 added a mock reminder-template foundation at
`/admin/announcements/templates`. Templates provide calm starting points for
schedule reminders, pending confirmations, questionnaire follow-up, food
service notes, security/night-watch reminders, project updates, plan changes,
and thank-you/wrap-up notes. They are grouped by module and show suggested
audience, timing, subject suggestions, body previews, and placeholders.

08.4 stabilized the communication surfaces and admin shell. The checked admin
routes now use a shared shell that preserves the persistent desktop sidebar and
shows a compact mobile top bar with a collapsible navigation drawer. The drawer
uses the existing admin nav, closes on outside tap or link selection, and keeps
mobile layouts from showing a cramped permanent sidebar.

Announcements and emails are mock-only. Future work still needs:

- Food module foundation.
- Real email sending.
- Recipient resolution.
- Scheduled reminders and background jobs.
- Message templates.
- Unsubscribe and suppression logic.
- Delivery tracking.
- Real persistence.

## 13. Food Module Notes

09.1 added a mock Food module foundation at `/admin/food`. The overview shows
upcoming lunch support, water/coffee, snack support, and cleanup items for the
active Belgrade workspace with compact counts, a next suggested food action,
date-grouped rows, headcount notes, food contact/congregation responsibility,
helpers, expandable meal/helper notes, related links, and placeholder-only
actions.

Food is mock-only. Future work still needs:

- Food detail/day view.
- Real helper assignment actions.
- Real persistence.
- Food-role scoped views.
- Deeper schedule integration.
- Food contact communication workflows.
