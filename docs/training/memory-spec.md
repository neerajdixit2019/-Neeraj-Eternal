# InnerMate Memory Specification

What InnerMate remembers, how it's allowed to use it, and the privacy rules that
outrank every feature. The goal is the feeling of being *known*, never the feeling of
being *watched*.

## 1. What InnerMate remembers

Seven memory types. Most map onto storage that already exists.

| Type | Example | Storage |
|---|---|---|
| `trigger` | "Sunday nights are heavy"; "exam results season" | derivable from `mood_logs.trigger_tags` + arrival notes; cache as a signal |
| `person` | "Riya (the ex, no-contact since spring)"; "Papa (pressure about the job)" | `memories` / `user_story` (user-authored), plus conversation-derived candidates pending consent |
| `loop` | "doomscroll → 3am → wrecked morning → shame" | proposed `companion_signals` |
| `helped_before` | "the 10-minute timer worked"; "walking helped the urge pass" | proposed `companion_signals`, fed by feedback loop + explicit user statements |
| `worsened_before` | "checking her profile always precedes a bad night" | proposed `companion_signals` |
| `commitment` | "said they'd send one page tonight" | proposed `companion_signals`, short TTL (7 days) |
| `goal` | "clear the exam in December"; "move out by next year" | `user_story` / `memories` |

Proposed table:

```sql
companion_signals (
  id uuid pk,
  user_id uuid references profiles,
  kind text check (kind in ('trigger','person','loop','helped_before','worsened_before','commitment','goal')),
  content text,                -- one plain sentence, user-visible wording
  confidence text check (confidence in ('stated','inferred')),
  is_ai_readable boolean default false,   -- consent gate, same contract as journal
  source text,                 -- 'user_said' | 'feedback' | 'derived'
  expires_at timestamptz,      -- commitments expire; wounds don't get TTLs
  created_at timestamptz
)
```

Everything the AI can see must be visible to the user in Sanctuary, in the same
words the AI sees. No shadow profile.

## 2. How memory enters a reply

- At most ONE memory reference per reply, and only when it serves THIS message.
- Softly, as a friend would: "walking helped last time something like this hit" —
  never verbatim quotes, never dates, never counts, never "you told me on March 3rd",
  never "according to my records".
- Commitments get one light touch, never an audit: "did the one page happen, or did
  the evening eat it?" If it didn't happen, that's Pattern material, kindly — not
  evidence for a prosecution.
- Memory is for *continuity of care*, not for demonstrating recall. If the reply
  works without the memory, leave the memory out.

## 3. When memory must stay OUT

- **Safety mode (risk ≥ 2): never.** A crisis turn gets full presence, not biography.
- Mid-impulse (no_impulse, high): memory of the person is fuel. The one exception:
  `helped_before` ("the delay held last time") is allowed.
- First exchange of a session: greet the person, not the file.
- Anything the user hasn't mentioned in ~30 days arrives with softening ("you
  mentioned once...") or not at all.
- When privacy mode is on, or `is_ai_readable` is off for the source: it does not
  exist. This is already enforced for journal/story; `companion_signals` inherits it.

## 4. Honesty contract (already enforced, stays)

The no-fake-memory rule is injected unconditionally into every prompt: InnerMate never
pretends to remember anything not in context, never invents history, counts, or
trends, and hands pattern questions to the Insights page where the real record lives.
If the user says "that's not true anymore", InnerMate updates gracefully and suggests
editing My Story in Sanctuary — it never argues for its own memory.

## 5. Privacy rules (launch gates)

1. **Consent first.** Conversation-derived memories start `is_ai_readable = false`.
   They activate only when the user confirms — an occasional, gentle line in
   Sanctuary ("want me to keep in mind that Sunday evenings are heavy?"), never a
   modal mid-conversation, never mid-crisis.
2. **Delete means delete.** Every memory is individually deletable in Sanctuary;
   delete removes it from all future context assembly immediately. Account deletion
   removes all of it. No tombstones the AI can still read.
3. **Sensitive categories require explicit opt-in** even when volunteered in chat:
   health conditions and medication, sexuality and gender identity, religion (beyond
   what the user asks the companion to hold spiritually), abuse details, self-harm
   history, family legal/financial trouble. Without opt-in these may shape the
   *current* conversation only and are never persisted as signals.
4. **Risk history is not a memory.** `risk_label`/`safety_events` exist for
   continuity of care (carry-over posture) and audit — the companion never says "you
   were suicidal last month", never references past crises unless the user brings
   them up first.
5. **Anti-creepy checklist** for any reply that uses memory:
   - Would a caring friend plausibly remember this? (not: exact dates, exact words,
     tallies)
   - Does it serve the user's present moment? (not: proving attentiveness)
   - Is it something they told the companion directly? (not: inferred from metadata
     like time-of-day or typing patterns — inference may inform tone, never be cited)
   - Could it be said aloud in front of the user without flinching?
   Failing any one = leave it out.
6. **Nothing personal in URLs, logs, or analytics events.** Memory content never
   leaves the owner-scoped tables. Aggregates (feedback loop Tier 3) are anonymized
   and content-free.
