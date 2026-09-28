# Volunteer home schedule polish — production release

Completed **2026-09-28, 23:46 UTC**. Exact deployed application: **`80203cb77ecd3c02427888958d10d62dd0a6a5f7`**. Production baseline: `0efa0427e8cc0290ab87d70ecbafb759afdcbf7a`. This is a frontend-only release; no migration or backup-task operation occurred.

## Candidate and deployment

Fresh fetch verified `origin/master` at the expected baseline. The approved commit descends from it. The functional diff contains only `VolunteerHomeDashboard.tsx`, `VolunteerScheduleClient.tsx` and the two related browser regression scripts. Remaining files are the approved synthetic screenshots/review documentation plus the prior Task Details documentation-only closeout in `c939bb0`. No changes to migrations, RPCs, RLS, Auth, instruction privacy, notification code, response persistence, project isolation or backup tooling.

The committed application tree was clean and matched the approved candidate exactly. A fresh regression regenerated two screenshot binaries; those fresh captures were retained in ignored local evidence, and the approved committed images were restored before deployment. Existing unrelated untracked directories and `volunteer-home-schedule.zip` were preserved and excluded.

Master was fast-forwarded with a normal, non-force push of the exact reviewed SHA. Local master and fresh remote verification both equal `80203cb77ecd3c02427888958d10d62dd0a6a5f7`. Vercel's existing Git production integration deployed it without configuration changes.

[Vercel deployment](https://vercel.com/jelanierslands-projects/project-local/44isdAvV3uF9smfFSGABw9H8HueC) reports **Production / Ready**, source commit `80203cb77ecd3c02427888958d10d62dd0a6a5f7`, with canonical `projectlocal.app` assigned to this deployment. Deployment duration shown: **53 seconds** (Build Logs: 52 seconds). The canonical volunteer page was freshly reloaded and showed the matching new frontend. No independent in-app SHA endpoint is present; exact release identity is established by the Vercel source/domain mapping and Git SHA, corroborated by the live UI.

## Refreshed release gates

| Executed check | Result |
| --- | --- |
| Production-to-candidate `git diff --check` | Passed |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| Fresh local production `next build` | Passed |
| Checked-in focused volunteer-home browser regression | Passed unmodified at 320/390/768/1440: one/two/many/empty/past/long/duplicate/priority/same-title cases, all additional assignments, inline placement, collapse, smooth/reduced-motion scroll, keyboard/focus, exact identity and zero mutation/provider requests |
| Complete checked-in volunteer-response browser regression | Passed unmodified against that fresh production build: Confirm, decline/notes, Confirm All, reload persistence, maximum-length instructions, mobile, token privacy and cleanup |
| Real local volunteer schedule access/response suites | Passed: authorization, project/volunteer isolation, revocation, response persistence and direct-table denial |
| Assignment notification and resend safety suites | Passed with recording transports and disabled real providers |
| Volunteer home/menu/away/photo regression | Passed on disposable local fixtures |

Build/full-browser/real-suite receipt: `2026-09-28T23:42:14.437Z`, all seven entries exit 0. The focused fixture suite also exited 0 before the push. Shared real-data suites ran serially against loopback Supabase with real providers disabled; fixture browser work used its separate temporary app. No production fixture or email was used.

## Authorized live smoke

Used the existing authorized volunteer schedule and administrator sessions. No new account, credential or assignment was created.

- Canonical `/v/schedule` renders the existing Next Assignment and its explicit **View assignment details** action.
- This legitimate volunteer has **one upcoming assignment**. There is correctly no View full schedule toggle, Coming up section or redundant schedule disclosure.
- Opening the card shows the existing assignment sheet with the matching task/date/time and unchanged Confirmed response. The response controls remain present. Closing restores focus to the original card.
- At an **actual measured 390px viewport**, `document.documentElement.scrollWidth` is **390px** on the home and while the sheet is open. The sheet close control remains inside the viewport. Lunch follows Next; Availability follows Lunch. Visual inspection agrees with the measured order.
- Authorized admin `/admin/dashboard` was freshly reloaded after deployment and renders Overview normally.

**Live multi-assignment expansion/collapse was not exercised:** the available authorized volunteer has no additional assignments. No production data was changed to manufacture that state. All-upcoming compact cards, duplicate-title identity, expansion/collapse, ordering and Confirm All are covered by the refreshed local browser and real-data regressions. This distinction is retained rather than claiming synthetic tests were live production checks.

Only read-only navigation, reload and detail-sheet open/close were used in production. No response, assignment, volunteer, away-period, resend or email action was submitted. No migration, backup-task mutation or manual backup was performed. Existing access/session bookkeeping may occur through normal authorized reads; this release did not conduct or claim a new production-table fingerprint audit.

## Closeout

Release/current-state documentation is committed separately on the development branch after verification. That documentation commit is **not** the deployed application and is not pushed to master for another deployment. Synthetic [review gallery](previews/volunteer-home-schedule/index.html) and [implementation report](VOLUNTEER_HOME_SCHEDULE_POLISH_REVIEW.md) remain available.

The previously verified database terminal remains outside this frontend change: 45 migrations / `20260927120000`; no database command was run for this release. No claim of a fresh backup artifact is made. Development Server Action transport, reported busy-month production latency, desktop assigned-person ellipsis and disabled site-map upload/recovery remain outside scope. No Batch 3 work was started.
