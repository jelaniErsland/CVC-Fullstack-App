# 12.48 volunteer view drawer — local review

Status: implemented on `codex/12.48-batch-1`; **not deployed**. This is a focused Volunteer directory improvement, not the broader Batch 4 redesign.

## Behavior

- A volunteer's name opens the existing right drawer on desktop or responsive sheet on mobile in **view** mode. The independent Edit control still opens the existing form. The drawer header switches between view and edit; leaving dirty edit fields requires confirmation, and page unload is guarded.
- The read-only profile shows contact, lifecycle, scheduling readiness and availability. Skills, support and other profile details use the shared disclosure component.
- Schedule has Upcoming and Past segments, chronological and reverse chronological respectively. Each row shows the actual calendar item's date, task, time and latest response, and links by exact item ID and occurrence date to Calendar Day. The link carries the verified project key; Calendar resolves it against authorized workspaces.
- Schedule data is requested only after opening a profile. The server action re-reads authenticated workspace context and requires `calendar.view` and `assignments.view`; its query is restricted by workspace and volunteer profile ID. The UI distinguishes loading, empty, unavailable and error states. No schedule editing is introduced.
- Resend schedule moved from directory rows into the Schedule section. It opens the pre-existing Communications resend workflow; view and tab interactions do not send messages.
- Edit saves retain the typed form and dirty state through server validation rejection, concurrent-update conflict, or an interrupted request. Only a confirmed server update closes the drawer and shows the existing `notice=updated` success message. Authorization, validation, conflict checks and persistence remain server-side.

## Evidence

- [Screenshot gallery](../../previews/12.48-batch-1/index.html), including desktop and mobile view, Past states, and mobile conflict/validation states with disposable local records.
- Local real Auth/RLS browser regression: `scripts/12-48-volunteer-drawer-browser-regression.mjs` passed at 1440px and 390px. It covers same-day distinct records, recurring-preset occurrences on separate dates, confirmed/declined/awaiting responses, exact Calendar selection, empty/error/retry states, view-only and withheld schedule capabilities, a foreign-project link, Escape and focus restoration, and dirty edit confirmation. It also verifies preserved input and dirty state after conflict, validation rejection and aborted save, plus unchanged notification delivery counts after opening, tab switching, returning from Edit and following Calendar links.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test:volunteer-profile-expansion`, `npm run test:assignment-notification-email:resend`, and the 36-case 12.48 route regression passed.
- `npm run test:volunteer-profile-management` and `npm run test:volunteer-profile-management:browser` now pass. The static test allows only the three reviewed route-context imports (Volunteers, scoped CSV, Communications), still rejects any new product importer and service-role use, and supplies the current optimistic-concurrency timestamp in authorization tests. The browser test requires the entire repository migration chain to match the local applied versions (43 of 43 in this run), rather than pinning one obsolete latest migration. It verifies successful Add/Edit persistence, reload, view-only behavior and mobile width.

## Limits

The Schedule lists active assignments on active calendar items, matching selectable Calendar records. Historical canceled or archived calendar items are not included in this focused pass. The authorized role checks used disposable local users and database records; no production volunteer records were used. No production deployment or notifications were performed.
