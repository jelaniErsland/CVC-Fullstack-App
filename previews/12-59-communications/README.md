# 12.59 Communications visual review

These screenshots use **disposable local fixtures**, with transports disabled. No production data or real email is used. The On badge is intentionally absent from the navigation tab; the panel retains its authoritative status.

| Surface | Before | After |
| --- | --- | --- |
| Desktop Welcome | [Before](before/welcome-1280.png) | [After](after/welcome-1280.png) |
| Desktop Schedule deliveries | [Before](before/schedule-1280.png) | [After](after/schedule-1280.png) |
| Desktop reminder summary | [Before](before/reminders-summary-1280.png) | [After](after/reminders-summary-1280.png) |
| Desktop Upcoming | [Before](before/reminders-upcoming-1280.png) | [After](after/reminders-upcoming-1280.png) |
| Desktop reminder History | [Before](before/reminders-history-1280.png) | [After](after/reminders-history-1280.png) |
| Desktop Delivery history | [Before](before/delivery-history-1280.png) | [After](after/delivery-history-1280.png) |
| 390px navigation / Welcome | [Before](before/welcome-390.png) | [After](after/welcome-390.png) |
| 390px Schedule deliveries | [Before](before/schedule-390.png) | [After](after/schedule-390.png) |
| 390px reminder summary | [Before](before/reminders-summary-390.png) | [After](after/reminders-summary-390.png) |
| 390px Upcoming | [Before](before/reminders-upcoming-390.png) | [After](after/reminders-upcoming-390.png) |
| 390px reminder History | [Before](before/reminders-history-390.png) | [After](after/reminders-history-390.png) |
| 390px Delivery history | [Before](before/delivery-history-390.png) | [After](after/delivery-history-390.png) |

Geometry and scoped accessibility evidence: [before](before/tab-switch-proof.json), [after](after/tab-switch-proof.json). At every tested width, all four final panels retain identical x/width and tab-row geometry. Eight widths cover 320, 390, 430, 768, 1280, 1440, 1920 and the owner's 2560px viewport.

Additional large-screen composition review: [1440px](after/reminders-summary-1440.png), [1920px](after/reminders-summary-1920.png), [2560px](after/reminders-summary-2560.png).

Approved design reference: [Communications](../../cvc-scheduler/docs/design/approved-project-local-ui/AE64A963-B909-41D1-8C91-0E423DEA915F.PNG). The candidate uses its tint, icon, typography, control and hierarchy principles with current supported workflows; illustrative analytics were not implemented.
