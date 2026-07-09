# InnerMate Feedback Loop

How the app learns whether a conversation actually helped — and how that signal
changes future replies without ever touching safety behavior.

## 1. What we ask

One soft question, chips only, no stars, no thumbs (a companion is not an Uber ride):

> **before you go, how do you feel compared to when you came?**

| Chip | Stored value | What it signals |
|---|---|---|
| a little calmer | `calmer` | Calm/grounding worked |
| clearer | `clearer` | Mirror/deep thinking worked |
| a little steadier | `steadier` | Shame-guilt/pattern work landed ("stronger" in product terms, but the softer word tests better with this audience) |
| less pull to act | `less_impulsive` | No-impulse delay held |
| still stuck | `still_stuck` | Mode may have been wrong, not the person |
| worse | `worse` | Priority signal, handled specially |

Plus a silent option: dismissing the prompt stores `skipped` — also a signal (nagging
kills trust).

## 2. When we ask

- Only after a session with ≥ 6 user messages, OR when the user navigates away after
  ≥ 3 — whichever comes first, at most once per day.
- NEVER during or immediately after a safety flow. If the session contained a
  `risk_label`, the prompt is suppressed for that session entirely; the follow-up for
  safety sessions is the companion's own soft check-in next visit, not a survey.
- Phrasing rotates from a small pool so it never becomes furniture.

## 3. Where it goes

Proposed table (owner-only RLS, like everything else):

```sql
companion_feedback (
  id uuid pk,
  user_id uuid references profiles,
  conversation_id uuid references ai_conversations,
  outcome text check (outcome in ('calmer','clearer','steadier','less_impulsive','still_stuck','worse','skipped')),
  dominant_mode text,          -- most frequent wire mode in the session
  message_count int,
  had_risk boolean,            -- true if any risk_label in session (kept for analysis; see rule 5)
  created_at timestamptz
)
```

`dominant_mode` and `message_count` are computed at write time so analysis never has
to re-read message content. No message text is ever stored with feedback.

## 4. How it changes future replies

Three tiers, from safe-and-cheap to careful:

**Tier 1 — per-user steer line (ship first).**
A nightly (or on-read) aggregate computes the user's outcome pattern per mode. The
companion route already injects per-user context; add ONE line, plain language, only
when a pattern is strong (≥ 5 sessions, ≥ 70% agreement):

- `action` sessions → calmer/steadier: "Small concrete steps have helped this person
  before; prefer one tiny step over reflection when they're stuck."
- `deep_thinking` → still_stuck: "Long reflection tends to leave this person stuck;
  keep it grounded and practical."
- `no_impulse` → less_impulsive: "The 10-minute delay has worked for them before;
  you can reference that softly."

One line maximum. Never stack. Never mention the feedback system itself.

**Tier 2 — mode-routing nudges (needs more data).**
If a user's `mirror` sessions repeatedly end `still_stuck` while `action` ends
`calmer`, bias borderline mirror/action classifications toward action FOR THAT USER
(a weight in `UserContext`, applied only where the deterministic classifier is
genuinely on the boundary — never overriding clear signals).

**Tier 3 — product analytics (aggregate, anonymized).**
Mode × outcome tables across all users answer: which mode underperforms, which
categories of opener precede `worse`, does the wisdom block help or hurt
`deep_thinking` outcomes. Feed the losers back into this training system as new
adversarial test cases, re-run the rubric, ship, re-measure.

## 5. Hard rules

- **Safety behavior never adapts to feedback.** Risk classification, escalation,
  templates, and chips are invariant. `worse` after a safety session triggers human
  review of the transcript flow (not the user), never a behavior change by feedback.
- `worse` twice in 14 days → the next session opens with the companion acknowledging
  it plainly ("last couple of talks didn't leave you better, I want to get this
  right") and the app surfaces the option to write to a human / adjust expectations.
  Honesty beats optimization.
- Feedback is metadata about the user — it obeys privacy mode, export, and delete
  exactly like journal data. Deleting the account deletes it.
- Never show the user their own "success rates". This is a quiet space, not a
  dashboard of their pain.
- Re-evaluate any Tier-1 steer line quarterly: stale adaptation is creepier than none.

## 6. Loop closure checklist (per release)

1. Pull mode × outcome deltas since last release.
2. Worst cell → write 5 new adversarial examples for that category → add to library.
3. Adjust the steer or persona section for that mode only.
4. Re-run `npm run test:companion` + rubric pass on the library (regression gate).
5. Ship; watch the same cell for two weeks.
