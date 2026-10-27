# Future reminder settings: architecture only

12.58 adds no settings, activation, pause, resend or channel controls. The operational
surface remains status, next persisted batch, actual activity and read-only lists.
The independent **How reminders work** disclosure is the natural future entry point
for a separate permission-controlled **Reminder settings** surface. Do not mix a
policy editor into Upcoming or History.

Recommended product model: Project Local supplies recommended defaults. A later
approved project-scoped policy could allow bounded response frequency/local time,
enabled confirmed stages, daytime time and day-before time. Use typed structured
values, authoritative project timezone and versioned policy provenance; no arbitrary
Cron language. Retain existing baseline and truthful sent/unknown history. Changes
must affect only future eligible work, never backfill or reopen accepted/unknown
logical deliveries.

Before save: human-readable policy, next affected reminders, volume-change warning
and a truthful comparison with the current schedule. Require server-side capability
checks, explicit confirmation, audit history and Restore recommended settings.
Restoring defaults is another prospective policy change, not a history reset.
Permission changes must invalidate authorization normally; no global private cache.

Do not add per-volunteer, per-assignment or per-task overrides, free-form dates,
Send now, disabled SMS/push placeholders or automatic cross-channel fallback.
Additional channels would need separate consent, destination verification, privacy,
idempotency and unknown-outcome review. Shared-household identities stay separate.

## Needs Attention follow-up

The current Needs Attention signal model does not provide a supported reminder
failure/review issue or durable automation-health evidence. Adding one requires a
separate reviewed backend contract for issue identity, priority, reviewed-state
invalidation and recovery. 12.58 instead shows existing definite failures and
unknown outcomes in the reminder feature, linking to read-only History. Sending
stays neutral. On is a delivery setting, never a scheduler-health assertion.

Long-term canonical Delivery history may gain a read-only Reminder filter. It must
not inherit manual resend/retry actions. Until separately approved, reminder History
remains isolated inside Automatic reminders, derived from existing occurrences,
actual events and canonical reminder recipient state.
