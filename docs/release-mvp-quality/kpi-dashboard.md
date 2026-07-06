# KPI Dashboard Spec (draft)

Audience: founders. One page; updated daily; powered by the
`analytics_events` table plus `ai_prompt_invocations` and `safety_events`.

## North-star metric

**Weekly returning users** — distinct `user_id` with >=1 meaningful event
in the current ISO week, who also had >=1 meaningful event in the prior
week. "Meaningful" = `checkin.submitted`, `companion.message_sent`,
`journal.entry_created`, `reflection.turn_submitted`, or `letter.viewed`.

## Activation (first 24h after signup)

| Metric | Definition |
|---|---|
| Signup -> onboarding completion | `onboarding.completed / onboarding.started` |
| Signup -> first check-in | `% users` with `checkin.submitted` within 24h of signup |
| Signup -> first companion reply | `% users` with `companion.reply_received` within 24h of signup |
| Activation rate | `%` of new users who hit >=2 of {check-in, companion, journal} in first 24h |

## Trust

| Metric | Definition |
|---|---|
| Crisis path triggered | count of `companion.crisis_shown` per day, 7d rolling |
| Rate-limit hits | count of `companion.rate_limited` and 429s on `weekly_letter.generate` |
| AI error rate | `status='error' / total` from `ai_prompt_invocations` per route, daily |
| AI p95 latency | `percentile_cont(0.95)` of `latency_ms` from `ai_prompt_invocations` per route, daily |
| Memory AI-readable opt-in | `% memories` with `is_ai_readable = true` |

## Repeat usage

| Metric | Definition |
|---|---|
| D1 / D7 / D30 retention | `% users` who returned on day N after signup |
| Weekly active users | distinct active users this ISO week |
| Check-in cadence | mean check-ins per active week per user |
| Companion conversations per WAU | `companion.message_sent` distinct conversations / WAU |
| Weekly letter open rate | `letter.viewed / letter.generated` per cohort |

## Funnels

- **Onboarding funnel**: `onboarding.started -> step_completed (each) -> completed`
- **Companion first-reply funnel**: `companion.opened -> empty_state_chip_tapped OR message_sent -> reply_received`
- **Weekly letter funnel**: Sunday eligible -> `letter.viewed` -> `letter.kept_toggled(true)`

## Layout

```text
┌──────────────────────────────────────────────────────────┐
│  Weekly returning users (line, 8 wk)        TODAY: 312   │
├────────────────────┬─────────────────────────────────────┤
│ Activation 24h     │ AI p95 latency by route (line)      │
│ (4 bar metrics)    │                                     │
├────────────────────┼─────────────────────────────────────┤
│ Onboarding funnel  │ Crisis path (line, 28d) + count     │
│ (funnel chart)     │                                     │
├────────────────────┴─────────────────────────────────────┤
│ D1/D7/D30 cohort table                                   │
└──────────────────────────────────────────────────────────┘
```

## Implementation notes

- Materialized views for cohort tables, refreshed every 30 min.
- Build internally with Supabase + a simple chart route at `/admin/kpis`,
  gated to `has_role(_user_id, 'admin')`.
- No third-party analytics in v1 — keep telemetry inside the user's data
  boundary.