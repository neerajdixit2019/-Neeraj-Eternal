# A/B Test Plan (draft)

Three experiments to ship alongside the quality release. Each runs for at
least 2 calendar weeks **or** until 400 users per arm — whichever is
longer. Stop early only for harm signals (see Guardrails).

## Assignment

- Deterministic by `hash(user_id + experiment_key) % 100`.
- Persisted client-side; logged once as `experiment.assigned { key, arm }`.
- Power: detect a 5pp lift on primary metric at 80% power, alpha = 0.05.

## Experiments

### EXP-1 · InnerMate empty state

- **Hypothesis**: a single calm prompt with 4 large quick-reply chips
  outperforms a long welcome paragraph for activation.
- **Arms**:
  - `control` — current welcome copy + chips
  - `treatment` — minimal greeting + chips only
- **Primary metric**: `% sessions that send >=1 message after opening companion`
- **Secondary**: D7 return rate of users in their first companion session;
  `companion.followup_tapped` rate
- **Stop early if**: crisis-trigger rate diverges by >20% between arms

### EXP-2 · Weekly letter "what to expect" microcopy

- **Hypothesis**: setting the right expectation on Home increases letter
  read-through and `kept` rates.
- **Arms**:
  - `control` — current label
  - `treatment` — "A short, hand-written-feeling letter from us — once a
    week, on Sunday. About 150 words. No tasks, no scores."
- **Primary metric**: `letter.viewed / letter.generated` (read-through)
- **Secondary**: % of letters with `kept = true` 7 days later
- **Surface**: Home weekly-letter card + Settings toggle description

### EXP-3 · Check-in follow-up nudge

- **Hypothesis**: offering one tiny next step after a check-in (companion,
  journal, or wind-down) increases same-session depth without feeling
  pushy.
- **Arms**:
  - `control` — silent confirmation only
  - `treatment` — one rotating gentle suggestion ("Sit with this for a
    moment in the Journal?", "Talk it through with InnerMate?")
- **Primary metric**: `% check-ins followed by another meaningful event
  within 5 minutes`
- **Secondary**: dismissal rate of the suggestion; D7 retention
- **Stop early if**: dismissal rate > 60% — the nudge is annoying

## Guardrails (every experiment)

- Crisis path latency and trigger rate must not regress
- AI error rate per route must not increase >2pp
- Privacy: no experiment arm changes what is sent to the model

## Analysis

- Daily cohort dashboard for the duration of the test
- Final write-up with effect size, CI, and qualitative notes from any
  user feedback received during the window
- Decision: ship, kill, or iterate within 1 week of test end

## What we are NOT testing

- Crisis copy, SOS flow, or Tele-MANAS routing — never A/B safety surfaces
- Notification cadence (no push notifications in this release)
- Pricing or upsells