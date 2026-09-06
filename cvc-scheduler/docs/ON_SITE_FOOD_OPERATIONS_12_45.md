# 12.45 — Local on-site / Food operations review

This is uncommitted, undeployed source. Production remains at `20260905130000`. Migration `20260906120000` is UNAPPLIED to production. The product-owner corrections remove dedicated Quick View meal cards and require persisted Project navigation.

## Architecture

`CalendarClient` owns Day, Week, Month, List, navigation, filters, events and the inspector. Quick View passes a read-only state without mutation actions and uses a compact frame without admin navigation. The shared inspector conditionally renders typed meal fields. Neither Quick View route renders an independent Calendar or Food dashboard.

Authenticated grants provide individual identity and immediate grant revocation, but replacing the bearer would also replace the on-site sharing workflow. The existing project-scoped bearer is retained with hash-only storage, a clean HttpOnly-cookie handoff, expiry, project/date gates and explicit revocation. Authenticated Quick View requires existing workspace, Calendar, task, assignment and volunteer viewing capabilities. Both paths produce the same published trusted Calendar content; no role-name authorization or new capability is added. The source-row mapper and item adapter are reused. Private drafts, profile contact values, profile notes, credentials and mutation context are omitted from Quick View. The access exchange parses credential metadata only, not a second redacted content projection.

Previously issued links were described as a narrower schedule view. The migration revokes live old links, preserving token records, so their holders do not silently receive expanded trusted access. Reissued links explicitly identify the trusted audience and exposed names/meal contacts. This is the only deliberate retirement update outside the additive Calendar fields.

## Food and duplication

Typed nullable columns on `calendar_items` own meal kind, provider, contact, menu and total. Breakfast and Lunch remain `food` items with normal Calendar placement. A partial unique index allows one active occurrence of each meal per workspace/date; archived occurrences remain in history. Meal saves are atomic and immediately published, following the approved Calendar-owned meal creation rule. Totals are independent: zero is explicit, null is unset, and no combined total exists. Historical Project Day rows are unchanged and their old operational UI/action is removed.

Duplication locks a visible, active source in the authorized workspace and copies its saved title/type/preset reference, schedule definition, duration for ranges, needed count, notes, validated custom values and meal metadata. Times can be adjusted for timed sources. The duplicate is independent: no assignments, response rows, credentials, notification/delivery rows, repeat request or series relationship is created. Ordinary work duplicates start as private drafts. Meal copies use the same immediately published rule as meal creation. Source/assignment/response history is untouched.

Volunteer schedule returns meals for that volunteer’s published assignment dates. Its explicit meal projection contains only kind, provider, menu and start/end time. It contains no meal contact, total, operational notes, assigned directory or private profile fields. A direct assignment to a meal also omits that meal’s operational notes from the preexisting assignment notes field. Existing assignment-response policy and volunteer-safe follow-up contact handling remain unchanged.

## Migration review

The migration is large because PostgreSQL function bodies must be restated: the existing Quick View reader is replaced, and the volunteer schedule reader is dropped/recreated to add one return column. Their unchanged authorization/response code accounts for most lines.

1. Five additive Calendar meal columns, validation constraint and active meal/day index.
2. A comment explicitly retiring the historical Project Day field from active operations; no row deletion, total conversion or rewrite.
3. Atomic authorized meal save and independent duplicate functions.
4. Exact grants for those two functions: PUBLIC/anon denied; authenticated/service_role granted; `postgres` owner and empty SECURITY DEFINER search path.
5. Revocation of preexisting live narrow-audience Quick View links; historical token rows retained.
6. Existing bearer reader retains identity/expiry/project/date gates and supplies bounded, explicit trusted Calendar rows.
7. Existing volunteer reader adds safe meal JSON for assignment dates, with its original anonymous/authenticated/service_role grants restored exactly.

No unrelated schema, role, table privilege, response, lookup, migration-history or recovery behavior change is included. Exact function inventory is 56: eight reviewed anonymous, 36 authenticated-only and 12 internal. New anonymous functions: zero.

The adjacent recovery contract adds only `20260905130000 -> 20260906120000` and retains prior transitions. Invalid source/target, downgrade, arbitrary future, malformed and skipped transitions remain denied. Source/fixture changes do not alter the live backup task.

## Visual behavior

Quick View starts with its normal heading and the full Calendar. Breakfast/Lunch are ordinary events with separate totals and labels; detail is in the shared inspector. General uses cyan, Food amber/yellow, Security lavender and Custom neutral slate. Breakfast/Lunch names distinguish them without color. Selection and keyboard focus remain visible.

Project navigation uses the persisted workspace start date in the active view’s existing range semantics. Missing starts disable the control; no mock January or hard-coded Bozeman date is used. The browser regression tests two distinct persisted start dates in admin and authenticated Quick View, and bearer navigation in all four views.

## Verification and captures

Local Docker was restored by the product owner after the interruption. The isolated privilege rerun passed with no concurrent fixture activity. No Docker preferences were edited and production was not accessed.

Passing results from this review:

- Full adjacent local migration application, historical Project Day and Calendar row preservation, prior-link revocation, and generated database type parity.
- On-site Food database/browser regression: independent totals, zero/unset, metadata, duplicate isolation, capability/cross-project denial, trusted and volunteer projections (including a volunteer directly assigned to a meal), all four shared Calendar views, Project navigation from different persisted starts, focus restoration, desktop/390px overflow, and zero console/hydration errors.
- Full admin Calendar browser regression: views/navigation/filters, keyboard interactions, inspector/create/edit, assignment create/cancel and selection preservation, mobile save/assign/publish, overlay exclusivity and focus restoration.
- Quick View share access and privilege regressions; volunteer schedule access regression.
- Final isolated function privilege regression passed with 56 exact functions, zero PUBLIC execution, exact eight anonymous functions, denied defaults/future grants, 13 direct anonymous mutations denied, zero target-row changes, preserved triggers and zero residue.
- Production independent backup and recovery readiness fixture/source regressions; exact adjacent transition and invalid-transition denials. No live backup/task execution.
- Calendar read-model contract/helper/query-helper, route cutover and edit-validation regressions. Historical documentation assertions now point to PROJECT_HISTORY after the approved CURRENT_STATE reconciliation; obsolete UI copy and Project mock-date assertions were updated without weakening authorization checks.
- Latest source: TypeScript, project-source ESLint and production build passed. Git diff --check passed.

The final color correction uses explicit desktop/mobile inspector classes so the generated production CSS includes both accents. The focused browser rerun passed and refreshed only the six affected inspector/duplicate captures; all six were reopened and visually inspected. General is cyan and Food amber on desktop and mobile, with readable text and clear selection/focus. Unchanged approved images are retained. No required verification remains outstanding.

Review captures belong in top-level `previews/12.45-product-review/`. Earlier card-based Quick View captures were removed. No unrelated approved captures are regenerated.

All twelve captures below were opened and inspected. They show ordinary meal events, no Quick View meal dashboard, readable date context, shared meal details, and no 390px horizontal overflow. Inspector accents follow the same General/Food/Security category families as Calendar events.

| Capture | Path from repository root |
| --- | --- |
| Quick View / read-only Week desktop | previews/12.45-product-review/quick-view-week-desktop.png |
| Quick View / read-only Week mobile 390 | previews/12.45-product-review/quick-view-week-mobile.png |
| Read-only inspector desktop | previews/12.45-product-review/readonly-calendar-inspector-desktop.png |
| Read-only inspector mobile 390 | previews/12.45-product-review/readonly-calendar-inspector-mobile.png |
| Day with Breakfast and Lunch desktop | previews/12.45-product-review/day-breakfast-lunch-desktop.png |
| Day with Breakfast and Lunch mobile 390 | previews/12.45-product-review/day-breakfast-lunch-mobile.png |
| Meal inspector desktop | previews/12.45-product-review/meal-inspector-desktop.png |
| Meal inspector mobile 390 | previews/12.45-product-review/meal-inspector-mobile.png |
| Duplicate desktop | previews/12.45-product-review/duplicate-desktop.png |
| Duplicate mobile 390 | previews/12.45-product-review/duplicate-mobile.png |
| General/Food/Security colors | previews/12.45-product-review/mixed-category-colors-desktop.png |
| Persisted non-January Project navigation | previews/12.45-product-review/project-start-navigation-desktop.png |

The resumed run used the existing local database and current source without restarting implementation. The function privilege test ran serially. Only the requested affected captures were regenerated. Production access/mutations, live backup/task actions, emails, staged files, commits, pushes and deployments remain zero.

Final cleanup: local preview and local Supabase stopped; .next, supabase/.temp and .env.local are absent from the project. Because automatic approval review previously rejected recursive deletion, generated build/runtime folders were moved reversibly outside the repository to C:/Users/mtfis/AppData/Local/Temp/project-local-12.45-generated-9a328a1c14714200a3ff56cab7b9b18a. They are outside source/commit scope. Docker Desktop remains under the product owner’s control; its preferences were not edited. Repository: master, 50 dirty files (38 source/docs/test files plus 12 review PNGs), staged 0, no commit/push/deploy. Production access/mutations, live backup/task actions and emails: 0.

12.45 Bozeman On-Site / Food Calendar Operations: READY FOR PRODUCT REVIEW
## Dirty-path inventory at handoff

```text
 M cvc-scheduler/app/admin/calendar/page.tsx
 M cvc-scheduler/app/admin/quick-view/page.tsx
 M cvc-scheduler/app/qv/page.tsx
 M cvc-scheduler/components/CalendarAssignmentPicker.tsx
 M cvc-scheduler/components/CalendarClient.tsx
 M cvc-scheduler/components/ProjectQuickViewShareControl.tsx
 M cvc-scheduler/components/VolunteerScheduleClient.tsx
 M cvc-scheduler/docs/CURRENT_STATE.md
 M cvc-scheduler/docs/FUNCTION_PRIVILEGE_POLICY.md
 M cvc-scheduler/docs/PRODUCTION_BACKUP_RECOVERY_RUNBOOK.md
 M cvc-scheduler/lib/calendar/readModel.server.ts
 M cvc-scheduler/lib/calendar/readModelQuery.server.ts
 M cvc-scheduler/lib/calendar/routeRead.server.ts
 M cvc-scheduler/lib/mockData.ts
 M cvc-scheduler/lib/projectQuickViewAccess/server.ts
 M cvc-scheduler/lib/projectQuickViewAccess/token.ts
 M cvc-scheduler/lib/supabase/database.types.ts
 M cvc-scheduler/lib/volunteerScheduleAccess/token.ts
 M cvc-scheduler/scripts/calendar-read-model-contract-regression.mjs
 M cvc-scheduler/scripts/calendar-read-model-helper-regression.mjs
 M cvc-scheduler/scripts/calendar-read-model-query-helper-regression.mjs
 M cvc-scheduler/scripts/calendar-regression.mjs
 M cvc-scheduler/scripts/calendar-route-cutover-regression.mjs
 M cvc-scheduler/scripts/function-privilege-policy.mjs
 M cvc-scheduler/scripts/function-privilege-regression.mjs
 M cvc-scheduler/scripts/production-backup/Invoke-ProjectLocalProductionBackup.ps1
 M cvc-scheduler/scripts/production-backup/ProjectLocalProductionMigrationContract.ps1
 M cvc-scheduler/scripts/production-independent-backup-regression.mjs
 M cvc-scheduler/scripts/production-recovery-readiness-regression.mjs
 M cvc-scheduler/scripts/project-quick-view-share-access-regression.mjs
?? cvc-scheduler/components/CalendarMeals.tsx
?? cvc-scheduler/docs/ON_SITE_FOOD_OPERATIONS_12_45.md
?? cvc-scheduler/lib/calendar/meals.ts
?? cvc-scheduler/lib/calendar/operations.actions.ts
?? cvc-scheduler/lib/calendar/quickView.server.ts
?? cvc-scheduler/scripts/on-site-food-migration-regression.mjs
?? cvc-scheduler/scripts/on-site-food-operations-regression.mjs
?? cvc-scheduler/supabase/migrations/20260906120000_on_site_food_calendar_operations.sql
?? previews/12.45-product-review/day-breakfast-lunch-desktop.png
?? previews/12.45-product-review/day-breakfast-lunch-mobile.png
?? previews/12.45-product-review/duplicate-desktop.png
?? previews/12.45-product-review/duplicate-mobile.png
?? previews/12.45-product-review/meal-inspector-desktop.png
?? previews/12.45-product-review/meal-inspector-mobile.png
?? previews/12.45-product-review/mixed-category-colors-desktop.png
?? previews/12.45-product-review/project-start-navigation-desktop.png
?? previews/12.45-product-review/quick-view-week-desktop.png
?? previews/12.45-product-review/quick-view-week-mobile.png
?? previews/12.45-product-review/readonly-calendar-inspector-desktop.png
?? previews/12.45-product-review/readonly-calendar-inspector-mobile.png
```
