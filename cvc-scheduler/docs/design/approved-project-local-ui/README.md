# Project Local Approved UI Reference

The images in this directory are the approved visual reference for Project Local.

They are NOT loose inspiration and they are NOT disposable mockups.

Future UI work on real product surfaces should adhere closely to the visual language established here.

## What is authoritative

The reference images are authoritative for:

- overall visual identity
- Project Local branding
- typography hierarchy and scale
- spacing and density
- desktop shell/sidebar proportions and treatment
- mobile navigation treatment
- surface/background treatment
- borders, shadows, and radii
- primary and semantic color usage
- icon treatment
- button/input/control styling
- table/list/card density
- contextual inspector/drawer styling
- Calendar composition and visual density
- volunteer-facing warmth and simplicity
- hierarchy between primary information and secondary metadata
- general level of polish

A finished beta-critical screen should clearly look like it belongs to the same product family as these references.

If a side-by-side comparison makes the implementation look like a generic prototype with similar colors rather than the same design system, the visual integration is not complete.

## What is illustrative rather than authoritative

Some reference screens show future or conceptual functionality that is not currently implemented.

Examples may include:

- weather
- project-progress analytics
- reports
- advanced dashboards
- announcements
- Needs Attention metrics
- profile photos
- lunch information
- project updates
- communications analytics
- future quick actions

These must NOT be fabricated merely to match a screenshot.

Use the layout, hierarchy, styling, density, and interaction patterns from the reference while displaying only functionality and persisted data that the real implementation currently supports.

## Functional truth wins

Approved visual references must never be used to justify:

- mock data on persisted routes
- fake controls
- fake metrics
- fake actions
- weakened authorization
- changed persistence semantics
- changed RLS
- changed capability rules
- changed token/cookie security
- backend shortcuts

Adapt the approved design to the real product capability.

## Visual acceptance standard

For beta-critical surfaces, compare the implementation directly with these references before marking visual integration complete.

Ask:

1. Does this immediately look like the same product?
2. Is the density comparable?
3. Is the typography hierarchy comparable?
4. Are navigation and inspectors treated similarly?
5. Is generic card stacking minimized?
6. Are colors restrained and purposeful?
7. Is Project Local branding clearly recognizable?
8. Does Calendar feel like a professional scheduling workspace?
9. Does the volunteer experience feel welcoming and simple?
10. Would the product owner reasonably recognize the approved concept direction without being told what changed?

If not, continue refinement.

Product-owner approval is always explicit and cannot be inferred from passing automated tests.
