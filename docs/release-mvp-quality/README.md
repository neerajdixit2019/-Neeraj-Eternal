# MVP Quality & Retention Release

This folder holds the planning and ops docs for the multi-PR release that
adds analytics, error monitoring, trust/logic fixes, InnerMate UX polish,
accessibility, i18n foundations, AI rate limiting, and prompt versioning.

## Status by slice

| Slice | Status | Notes |
|---|---|---|
| Analytics + error monitoring | Planned | Event taxonomy in [`event-taxonomy.md`](./event-taxonomy.md) |
| Trust / logic fixes | Planned | Mood scale, reminder copy, weekly-letter expectation |
| InnerMate UX simplification | Planned | Empty state, composer, mobile history, follow-ups |
| Accessibility pass | Planned | WCAG AA review |
| Copy extraction for i18n | Planned | en.json scaffolding |
| **Rate limiting + prompt versioning** | **Shipped** | This PR — see [`rate-limiting-and-prompt-versioning.md`](./rate-limiting-and-prompt-versioning.md) |

## Deliverables in this folder

- [`event-taxonomy.md`](./event-taxonomy.md) — every analytics event, props, when it fires
- [`kpi-dashboard.md`](./kpi-dashboard.md) — KPI definitions and dashboard layout
- [`qa-checklist.md`](./qa-checklist.md) — manual QA pass before release
- [`release-notes.md`](./release-notes.md) — public-facing draft
- [`ab-test-plan.md`](./ab-test-plan.md) — experiments planned for retention
- [`rate-limiting-and-prompt-versioning.md`](./rate-limiting-and-prompt-versioning.md) — shipped infra

## Brand guardrails

Every change in this release must keep the calm, private, non-clinical
brand tone. No clinical jargon, no streaks/gamification, no urgent
notifications, no shaming copy.