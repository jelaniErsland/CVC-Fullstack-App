# Project Local Product Requirements

Status: canonical planning baseline as of 2026-07-05. This document defines future product behavior; it does not describe implemented behavior or authorize route, UI, database, or delivery cutovers. Existing prototype notes remain useful history, but this document controls where they conflict.

Priority labels:

- **MVP/core:** required to replace the Belgrade-style sheet workflow safely.
- **V1:** part of the first practical product, but may follow the narrow MVP path.
- **Later:** explicitly deferred.

## 1. Product direction and real-world MVP

Project Local is a general volunteer and project-coordination product, not a CVC-only application. It coordinates volunteers, reusable task templates, scheduled items, assignments, meals, Communications, Needs Attention, contacts, assistants, on-site personnel, and volunteer-facing schedules.

The **MVP/core** must preserve the real-world workflow:

- Account-light volunteer schedule lookup.
- Per-assignment Confirm and Deny responses.
- Calendar-first project scheduling.
- Basic project-contact scheduling and assignment tools sufficient to replace the sheet workflow.
- Communications and reminders sufficient to notify volunteers and track responses.

The Calendar is the primary scheduling surface from the start. A list can support scanning, but the product must not make a list/form-only builder the main scheduling workflow.

The experience should remain calm and Apple-like: low text density, clear typography, progressive disclosure, minimal required fields, and contextual inspectors, drawers, sheets, and modals instead of overloaded pages.

## 2. Unified scheduling model

### 2.1 Scheduled items (**MVP/core**)

Use one scheduled-item concept for volunteer tasks, crew blocks, security/watch work, food-support work, informational blocks, and custom one-off Calendar items. Do not split tasks and events into separate V1 models. Food, Security, and General are workflow categories within the unified product, not separate mini-apps.

Every created scheduled item must have a scheduled date/time placement. Timed work has a date, start, and end; retained date-based informational/context kinds use an explicit project date or range as their temporal placement. There is no floating draft tray and no unscheduled scheduled-item state.

A scheduled item:

- May come from a reusable task template or a first-class custom definition.
- May be created and published before volunteers are assigned.
- Has a needed volunteer count, including zero.
- Uses **assigned** language: `0/6 assigned`, `4/6 assigned`, `6/6 assigned`.
- Uses `0/0 assigned` for informational items that need no volunteers.

Assignment rows remain the source of truth. Pending and confirmed assignments count toward the active assigned count; denied and removed assignments do not.

### 2.2 Task templates (**MVP/core**)

Templates live under Tasks and are reusable presets, not scheduled assignments. Placing a template on Calendar creates a scheduled item. Templates are encouraged, but custom scheduled items must not feel like a workaround.

Template fields may include name, default needed count, optional category, description/instructions, default duration, default area/location, congregation preference, free-text skill matching, age/driver/equipment/safety notes, future default publication behavior, and a default Follow-up Contact.

Categories are optional. Supported V1 workflow categories are General, Food, and Security. Construction, cleanup, gate work, drywall, concrete, and similar work roll into General rather than becoming top-level categories.

A default Follow-up Contact is optional while building a template. Scheduled items inherit template defaults but allow overrides.

### 2.3 Calendar interaction (**MVP/core**, advanced gestures later)

- Follow familiar Google Calendar interaction patterns without copying its visual design.
- Week and Day support direct empty-space creation.
- Month supports broad day-level creation without chips consuming the whole cell.
- Event blocks remain minimal: task name plus assigned fraction.
- Inspectors/drawers/modals carry details.
- Click, drag, move, and resize are desirable, but reliable click-to-create/edit is the MVP requirement; advanced gestures may follow.
- Volunteers see their own assigned schedules, not a default board of open needs. Open needs are intentionally shared through Communications/email.

### 2.4 Draft and publication state (**MVP/core**)

Draft means saved but private/unpublished, not incomplete or unscheduled.

- Draft items are visible to their creator in the admin Calendar with slight transparency and a dotted outline.
- Draft items are not shareable across accounts in V1.
- Draft items do not appear to volunteers, accept responses, or trigger assignment email/reminders.
- Published items are live to permitted contacts and assigned volunteers.
- Published assignments appear in volunteer lookup immediately even if email is queued or unsent.

## 3. Follow-up Contact (**MVP/core**)

Use **Follow-up Contact**, never “scheduling contact.” Every scheduled item must have one.

Defaults:

- Template-created item: inherit the template default when present.
- Custom item or missing template default: use the creator/scheduler.
- Main Contacts appear in selection suggestions.
- The scheduler may choose an assistant, on-call person, or other contact information.

The Follow-up Contact appears in assignment details, initial assignment email, reminder email, schedule-change email, and Add to Calendar details. It does not appear on compact volunteer assignment cards. Volunteer actions emphasize Text and Email; calling is not the primary action.

Changing the contact is quiet and does not notify volunteers. Volunteer-specific overrides are later work.

## 4. Assignment responses and volunteer schedule

### 4.1 Response states (**MVP/core**)

Support per-assignment Confirm, per-assignment Deny, and Confirm All. Allowed changes before the cutoff/start are Pending to Confirmed, Pending to Denied, Confirmed to Denied, and Denied to Confirmed while still attached.

Deny opens an optional **Notes** field; do not call it a cancellation reason. A denied assignment remains attached and immediately appears as denied in the inspector. If the volunteer reconfirms, related Needs Attention clears quietly. If a contact removes/replaces them, the assignment disappears from the volunteer schedule without a removal email or V1 history section.

Responses lock when the assignment starts/passes. Confirmation does not reset merely because the schedule changes; date/time changes use the schedule-change workflow.

### 4.2 Hard-coded 48-hour cutoff (**MVP/core**)

Within 48 hours of assignment start, volunteers may Confirm but may not Deny or change Confirmed to Denied in-app. Replace the Deny action with “Need to change? Contact your Follow-up Contact” and Text/Email actions; do not leave a disabled Deny button.

### 4.3 Old and stale links (**MVP/core**)

- Passed assignment: open the schedule with a calm cannot-confirm message.
- Removed assignment: open the schedule and say it is no longer on the volunteer’s schedule/cannot be acted on, without alarming “removed” language.
- Date/start/end changed after email generation: do not auto-confirm; open the schedule and require review.
- Notes/instructions changes do not invalidate a Confirm link.

### 4.4 Volunteer home (**MVP/core**)

Keep the volunteer experience schedule-focused: greeting/avatar, announcement bell, compact upcoming assignments, contextual assignment details, a short relevant announcement card, and meal card when applicable. Secondary `...` actions include unavailable dates, contact edits, photo, and help. Volunteers do not need full navigation.

Informational Calendar items do not appear on volunteer schedules unless intentionally surfaced through an announcement/email or the Meals surface.

## 5. Email confirmation, publishing, and reminders

### 5.1 One-click confirmation (**MVP/core**)

Tokenized Confirm links are sufficient verification. A valid click confirms and opens the volunteer schedule with a success alert. Emails never include a Deny button.

Multi-assignment emails provide an individual Confirm action for each pending assignment, **Confirm all listed assignments**, and a View/Review Schedule action for detail and Deny.

### 5.2 Publishing and queued assignment emails (**MVP/core**)

Publishing assigned items prompts with affected item/volunteer counts and offers send now or queue/review. Publishing creates a queued assignment batch by default, which Main Contacts may remove.

Queued batches resolve live schedule details and recipients at review/send time: never send to someone removed, include newly assigned people where appropriate, and make schedule corrections on the item rather than editing system-controlled details in the email. Main Contacts may adjust recipients, short note, subject, timing, and preview.

Group by volunteer wherever practical for initial, copied/repeated, reminder, and schedule-change emails.

### 5.3 Schedule-change email (**MVP/core**)

Trigger only when an assigned item’s date, start time, or end time changes. Do not trigger for instructions, Follow-up Contact, minor details, or location unless location later becomes an explicit major field.

Use a system-generated preview with an optional short Main Contact note. Show previous and new date/time, provide no Confirm button, and direct volunteers to Follow-up Contact or in-app Deny when allowed. This is email-only, not an announcement.

### 5.4 Automatic reminders (**MVP/core**)

Pending reminders begin immediately after notification/publication and repeat every three days until Confirmed, Denied, or started/passed. They continue inside the 48-hour cutoff, still allow Confirm, and direct inability-to-attend cases to the Follow-up Contact.

Confirmed reminder cadence is one month, one week, three days, and one day before. Do not backfill missed cadence points for late assignments. Include details, Follow-up Contact, Add to Calendar, and View Schedule.

Stack reminders per volunteer where practical. Log automatic reminders in Communications history with content, recipient, included assignments, send time, and later delivery status.

Main Contacts can pause project-level automatic reminders. Pause holds/cancels unsent automatic reminders but not manual Communications; resume continues from the current point without retroactive sends. Per-item reminder disablement is optional/lower priority. Zero-volunteer items have no reminders.

## 6. Add to Calendar (**V1**)

Offer Add to Calendar in assignment email, volunteer schedule, and assignment detail before confirmation. Support per-assignment export and, if practical, bulk upcoming/current export.

V1 uses one-time `.ics` downloads/links; do not call it sync. A live personal subscribed feed is later work. Title includes project plus assignment. Description includes assignment details, instructions, Follow-up Contact, and Project Local schedule link, but not confirmation status. Hide/disable it for denied assignments.

## 7. Volunteers and availability

### 7.1 Availability Blocks (**V1**)

Use the admin concept **Availability Blocks** and volunteer copy “Mark dates you’re unavailable.” These are date exceptions to normal questionnaire availability.

Individual blocks are volunteer-managed, full-day, non-recurring, and have no reason/note. Scheduling/volunteer-management users see only “Unavailable” and the range. Congregation-wide away periods may carry a shared label, are managed directly by that congregation’s permitted Assistant Contact, remain admin-only, and are editable/removable by Main Contacts. Log congregation-block changes.

Conflicts warn rather than hard-block. New individual/congregation exceptions overlapping assignments create Needs Attention. Quiet profile/availability updates create Needs Attention only when they create a conflict.

### 7.2 Profile, contact edits, and photo (**V1**)

The initial questionnaire has no photo. A volunteer may later upload/change/remove an optional, non-public photo with help text explaining recognition use. Main Contacts and assistants with scheduling permissions may see it; regular volunteers and unpermitted assistants may not.

Volunteer contact edits are submitted for review by the congregation Assistant Contact and Main Contact/Admin; either can approve. Old official email/phone remains authoritative for lookup, links, and reminders until approval. Congregation changes remain contact/admin-only after direct communication.

Availability, skills, and profile questionnaire answers may later be edited directly with a quiet notification, escalating only if a conflict results.

### 7.3 Volunteers page and scheduling picker (**V1**)

Volunteers supports congregation cards and optional name/age views, with filters always available. Congregation cards identify relevant volunteer, security, and food assistants and expand to the volunteer list.

The picker defaults to eligible project volunteers and filters by congregation, skills search, availability, age, and relevant criteria. Weekly conflicts are hidden by default with a toggle to show them; date-specific conflicts use stronger warnings. Conflicts warn but do not block.

Compact cards show permitted photo/avatar, name, specific age, contact icons, and warnings—not full contact values or large skills text. Details open contextually. Multi-select is required, with a running count such as `4 selected / 6 assigned`; over-assignment warns but is allowed.

Age is limited to scheduling/volunteer contexts.

## 8. Needs Attention (**V1**, core staffing signals in MVP)

Needs Attention is a main-navigation, expandable action inbox grouped by problem type and sorted by date/urgency. Use compact expandable rows, contextual actions, and an option to open Calendar focused on the item. Overview shows a compact urgent summary.

Timing:

- Pending/denied assignments enter within three weeks.
- Underfilled published items enter within two weeks, including `5/6 assigned`.
- Urgency may increase within seven days/48 hours.
- Draft warnings remain private to the creator/publish preview.

Per-user dismissal hides an item until restored via Show dismissed, without resurfacing for trivial changes. Main Contacts can accept/resolve an exception globally, optionally note it, reverse it, and leave a subtle “Reviewed exception” marker in the Calendar inspector. No full issue-history UI is required in V1.

## 9. Communications (**MVP/core** for assignment/reminder delivery; broader authoring V1)

Main Contacts alone create/send group Communications in V1. Assistants and on-site personnel may receive/view targeted messages but do not send group messages.

Audiences may include all volunteers, this week’s assignees, one scheduled item, one congregation, unconfirmed or denied volunteers, assistants, on-site personnel, or contact groups. Delivery modes are announcement only, email only, or both.

Announcements support expiration and normal/important/critical importance. Newer items rank higher; critical items remain pinned until expired/deleted. They are not intrusive takeovers and volunteers do not dismiss them. Volunteer-targeted announcements appear in volunteer announcement/home surfaces; contact-targeted announcements appear in admin. Main Contacts see history.

Volunteer-facing information belongs in Communications, assignment details, Meals, or email—not Notes.

## 10. Meals / Food Menu (**V1**)

Use **Meals** or **Food Menu**, not hard-coded Lunch. Project setup independently enables breakfast and lunch; if neither is enabled, hide meal UI.

Meals are special Calendar-owned entries under the unified scheduling concept. Manage them from Calendar/day context, not a separate heavy Food app. Meal chips count toward Calendar overflow and open a meal editor rather than the normal assignment inspector. Saved meals are immediately visible; there is no meal draft/publish state, separate meal-notes field, or automatic meal email. V1 supports Breakfast and Lunch, not Dinner.

Volunteer schedules do not list meal chips. A separate meal card shows today and the coming week to everyone with project access. Clarify no meal, provided/menu pending, or the known menu. Changes are quiet unless a Main Contact intentionally communicates them.

Breakfast and lunch provider assignments are separate. Provider is free text with congregation suggestions and does not confer edit permission. Main Contacts and trusted Main Food Service Contacts can manage meal entries. A permitted Assistant Food Service Contact may edit only their congregation’s assigned meal details.

Lunch supports optional Main, multiple Sides, multiple Desserts, special/additional items, Provided by, and Menu TBD. Breakfast uses a simpler repeatable item list, Provided by, and Menu TBD. Volunteer cards show clean food lines without structural field labels.

## 11. Questionnaire and supporting congregations (**MVP/core**)

Project setup requires supporting congregations. The editable list populates the public questionnaire dropdown; V1 has no blank, unsure, Other, manual-entry, or inactive-congregation hidden state. Contacts are assigned later, not during congregation creation.

General links require congregation selection. Assistant invite links lock the associated congregation and explain how to request a correct link.

Submissions route first to an Assistant Contact with review permission; otherwise to Main Contact. Main Contact sees waiting submissions and can override/approve without an urgent assistant notification; the assistant queue then shows the completed review. V1 actions are Approve, Duplicate/already exists, Needs follow-up, and Discard/do not use. Remove the “Not from this congregation” workflow; correct it manually when authorized. Field-level correction links are later.

Needs follow-up remains primarily in the questionnaire queue and may enter Needs Attention after roughly seven unresolved days. Assistants see only their congregation unless broader scope is granted.

## 12. Contacts, permissions, and scope (**MVP/core**)

Use a simple model:

- Access type determines the broad experience.
- Permissions determine actions.
- Scope determines where actions apply.
- Role/title describes responsibility only.

Assistant Contacts start view-only. Main Contacts explicitly grant permissions one by one; there are no automatic role presets. Examples include View Calendar, Edit Schedule, Manage Meals, Review Questionnaires, Manage Volunteers, Manage congregation unavailable dates, and View Communications history. Sending Communications and managing project settings remain Main Contact-only in V1.

Calendar viewing may be project-wide, while edits are more tightly scoped to a congregation, assigned item/category, or project. Assistants with Calendar access may see the full item roster, but may contact volunteers only within their permission scope unless explicitly broadened.

Fixed V1 titles may include Main Contact, Main Food Service Contact, Main Security Contact, Assistant Volunteer Contact, Assistant Food Service Contact, Assistant Security Contact, and an optional view-only helper. One person may hold multiple roles. Do not build a custom role builder.

## 13. On-site personnel (**V1**)

On-site personnel are a separate access type, not an On-Site Contact or Assistant On-Site Contact role. They receive a dedicated view and no full admin/contact navigation.

Their allowed context may include the day/project, permitted scheduled-item inspector detail, assigned volunteers/status, individual contact actions, and optional Arrived check-in. They cannot mark No-show in V1. Check-in is optional, contact/admin/on-site-only, and not a timeclock.

On-site Notes are private to the creating access identity. Whether that identity is a shared on-site session/code or an individual lightweight identity remains open; individual identity is cleaner long-term.

## 14. Notes (**V1, private-only first**)

Notes are lightweight project-level personal notes stored in the project database and scoped to the creator/contact and project. They work across that user’s devices. Contacts/admins access them under More; on-site personnel access them in their dedicated view. Volunteers never see them.

V1 fields are Title and Body. Do not attach Notes to volunteers, items, meals, congregations, or assignments. Do not add categories, tags, comments, collaboration, pins, due dates, reminders, attachments, linked objects, or volunteer visibility.

Read-only sharing to selected roles/groups is later. Notes must never become a second task, Communications, or documentation system.

## 15. Navigation and UX contract

Target main/contact navigation:

- Overview.
- Tasks.
- Calendar.
- Needs Attention.
- More.

More contains Volunteers, Communications, Settings, Contacts/Roles, project setup, Help/support, workspace switcher, and Notes. Needs Attention is not buried in More.

Prefer contextual inspectors, sheets, drawers, and modals for detail. The future persisted assignment route can support secure direct access, but routine volunteer assignment detail should remain contextual rather than becoming an overwhelming page.

## 16. Implementation sequencing

### MVP/core

1. Persisted project/contact/congregation/questionnaire/volunteer foundation.
2. Calendar-first scheduled-item creation/publication with template and custom paths.
3. Assignment picker and assignment-derived counts.
4. Volunteer lookup plus Confirm/Deny/Confirm All and 48-hour rules.
5. Assignment emails, queued publishing, schedule-change email, and automatic reminder engine/history.
6. Basic Needs Attention staffing/response signals.

### V1 following the core

- Availability Blocks and conflict review.
- Add to Calendar `.ics` exports.
- Broader Communications/announcements.
- Meals/Breakfast/Lunch Calendar entries and volunteer cards.
- Contact-edit review, optional photo, richer volunteer picker.
- Scoped assistant and on-site experiences.
- Private Notes.
- Dismiss/accept Needs Attention workflows.

### Later/future

- Live subscribed personal calendar feed.
- Volunteer-specific Follow-up Contact overrides.
- Field-level questionnaire correction links.
- Note sharing/collaboration.
- Custom role builder.
- Full issue/audit history UI.
- Partial-day/recurring availability exceptions.

## 17. Open questions

- Whether on-site Notes use a shared access identity initially or require individual lightweight identities.
- Whether per-item reminder disabling is worth V1 complexity.
- Whether bulk `.ics` export fits V1 after per-assignment export is reliable.
- When volunteer-specific Follow-up Contact overrides become necessary.
- Whether future Notes sharing should remain role/group read-only or support named recipients.
- Exact provider, suppression/unsubscribe, deliverability, retry, and failure-recovery choices for production email.
- Final timezone/DST, overnight timed-work, recurrence, and schedule-edit audit rules remain governed by Calendar architecture work.

## 18. Explicitly deferred or prohibited interpretations

- No volunteer-facing open-needs board by default.
- No unscheduled item draft tray.
- No separate task/event data models for V1.
- No separate Food or Security mini-app as the product architecture.
- No Deny action in email.
- No automatic removal email or removed-assignment history in V1.
- No meal draft/publish workflow or automatic meal email.
- No collaborative Notes or Notes-as-announcements.
- No assistant role presets or title-implied edit authority.
- No volunteer self check-in or on-site No-show action.
