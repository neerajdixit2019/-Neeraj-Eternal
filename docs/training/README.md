# InnerMate Training System

This directory is the complete training and evaluation system for InnerMate — the
emotionally intelligent companion inside My Quiet Space. It exists so InnerMate never
behaves like a generic chatbot: every reply is preceded by an understanding pass
(emotional state, hidden need, risk, impulse, mode), and every change to the companion
can be measured against a fixed golden standard.

**Design principle: the code is the source of truth.** Everything here is anchored to
contracts that already run in production. Nothing in these documents may contradict
`src/lib/companion-risk.ts` (the safety classifier), `src/lib/crisis-resources.ts`
(deterministic crisis templates), `src/lib/companion-quality.ts` (banned-phrase
detector), or `src/lib/ai-gateway.server.ts` (the persona). When this document and the
code disagree, the code wins and this document has a bug.

## Files

| File | What it is |
|---|---|
| `classifier-schema.json` | JSON Schema for the full per-message classification record (runtime fields + training-layer fields) |
| `modes.md` | Behavior rules for the 9 training modes and their mapping onto the 7 runtime response modes |
| `golden-examples.json` | 100+ verified training examples across 13 categories (machine-readable, consumed by the regression test) |
| `golden-examples.md` | The same library rendered for human review |
| `evaluation-rubric.md` | 7-dimension 1–10 scoring system with anchors and pass gates |
| `feedback-loop.md` | Post-chat feedback design (calmer / clearer / steadier / less pull / still stuck / worse) and how it adapts future replies |
| `memory-spec.md` | What InnerMate remembers, how it references it, and the privacy rules |
| `test-suite-prompts.md` | Live-transcript QA prompts per mode, for manual and agent-driven evaluation |

Executable counterpart: `src/lib/__tests__/golden-library.test.ts` validates every
example in `golden-examples.json` against the real classifier and quality rules.
Run with `npm run test:companion`.

## The two-layer architecture

InnerMate's intelligence is split deliberately:

**Layer 1 — deterministic understanding (never the model).**
`classifyInnerMateMessage(message, userContext)` in `src/lib/companion-risk.ts` runs on
every message *before* any model call. It produces the `RiskClassification` record:
risk level 0–3, response mode, safety flags, quick replies. Level 3 replies come from
`buildActiveDangerReply()` config templates and are never model-generated. Level 2
detection, safe/not-safe follow-up parsing, harm-others and third-party routing are all
deterministic. This layer is why InnerMate's safety behavior is testable and cannot be
prompt-injected or hallucinated away.

**Layer 2 — the model, steered per turn.**
The API route (`src/routes/api/companion.ts`) converts the classification into a
`riskModifier` steer appended to `COMPANION_SYSTEM_PROMPT`, plus context (name, mood
trajectory, latest arrival note, journal snippets, previous thread). The model writes
the reply *inside* the mode the classifier chose. The golden library trains and
evaluates this layer.

Training-layer fields that are **not** yet in the runtime record (`emotional_state`
granularity, `hidden_need`, `impulse_risk`, `use_memory`, `response_length`,
`next_best_action`) are defined in `classifier-schema.json` as the target shape. See
"Extending the runtime classifier" below before implementing them.

## How the golden library is used

The 100+ examples are **not** pasted into the system prompt. They serve three jobs:

1. **Regression evaluation.** Every persona or steer change is scored against the
   library using `evaluation-rubric.md`. A change that makes replies more "helpful" but
   more generic fails the non-generic dimension and is rejected.
2. **In-prompt exemplars.** The persona carries 6–8 short Good/Bad example pairs.
   When rotating them, pick from this library only — they are verified against the
   banned-phrase list, length rule, and em-dash rule.
3. **Fine-tuning corpus (future).** If a dedicated model is ever trained, this library
   (with the bad_generic_response as rejected output and innermate_response as chosen
   output) is preference-pair-ready.

## Implementation instructions (Lovable / Claude Code)

### Ground rules — read first

- `src/integrations/**` is auto-generated. Never edit.
- Never overwrite Lovable's `package.json` / `package-lock.json` during syncs; send
  script-line changes as an instruction to the Lovable agent instead.
- Crisis behavior is sacred: emergency numbers live only in `crisis-resources.ts`
  config; the model is prompt-forbidden from writing hotline numbers; Level-3 replies
  are deterministic templates. Any change touching `companion-risk.ts` or
  `crisis-resources.ts` requires the full test suite green *plus* the manual G-category
  checks in `docs/QA-CHECKLIST.md` before deploy.
- AI features are never load-bearing: every model call has strict validation and a
  hand-written fallback.

### Extending the runtime classifier (training fields → production)

The safe path, in order:

1. Add the new fields (`primaryEmotion` already exists; add `hiddenNeed`,
   `impulseRisk`, `responseLength`, `nextBestAction`, `useMemory`) to
   `RiskClassification` as **optional** fields so nothing downstream breaks.
2. Populate them deterministically where signals already exist: `impulseRisk` from
   `NO_IMPULSE` signal hits (high when paired with "right now"/"about to"),
   `responseLength` from mode (safety → medium, everything else short),
   `useMemory` false whenever `riskLevel >= 2` (memory never surfaces in safety mode).
3. `hiddenNeed` and `nextBestAction` are judgment calls: either extend the signal-list
   heuristics, or add a *second, non-safety* model classification pass. If a model
   pass is added, it must run AFTER the deterministic classifier and must never be able
   to lower `riskLevel` or change `responseMode` away from `safety`. Audit it via
   `registerPromptVersion`/`logInvocation` and add it to `AI_RATE_LIMITS`.
4. Pin every new behavior with tests in `src/lib/__tests__/` before shipping.

### Adding the two prompt-level modes

`shame_guilt` and `spiritual` are training modes that today run as flavors of `mirror`
and `deep_thinking` (see `modes.md`). To make them first-class:

1. Add signal lists (`SHAME_GUILT_SIGNALS`, spiritual already routes via
   `DEEP_SIGNALS` + `wisdom.ts` triggers) to `companion-risk.ts`.
2. Add the steer text in the `riskModifier` switch in `src/routes/api/companion.ts`
   (copy the behavior rules from `modes.md` — they are written to be pasteable).
3. Map to wire modes in `toWireMode()` — `shame_guilt → "listen"`,
   `spiritual → "wisdom"` — so the chat client needs no changes.
4. Extend the classification tests; run `npm run test:companion` and
   `npm run test:risk`.

### Wiring the feedback loop

Follow `feedback-loop.md`. Summary: a `companion_feedback` table (RLS: owner-only),
one soft prompt after a session's 6th+ message or on leaving the chat, chips only, no
free text at first. Feed aggregates into the per-user steer as a single line (e.g.
"Small steps have helped this person before; long reflections have not."). Never adapt
safety behavior from feedback.

### Wiring memory

Follow `memory-spec.md`. It maps every memory type onto tables that already exist
(`memories`, `user_story`, `mood_logs`, `ai_messages.risk_label`) plus one proposed
`companion_signals` table. The privacy rules there (consent-first, hard delete,
sensitive-category opt-in, anti-creepy reference rules) are launch gates, not
suggestions.

### Sync & deploy playbook (unchanged)

Local: edit → `npm run test:companion` green → commit (`git commit -F msgfile`) → push.
Lovable: archive changed files → upload → instruct "apply VERBATIM, run tests, report
don't fix" → deploy → verify a live bundle marker. Remember server-only strings never
appear in client bundles; pick client-visible markers.

## Voice, in one paragraph

InnerMate is a wise friend, an emotional mirror, a discipline partner, and a quiet
space. Warm, direct, grounding, personal, practical. Two to three sentences, about 40
words, never more than 55. At most one question, often none. Contractions. No
em-dashes. No lists in replies. Feeling met first, one small thing second. No verdicts
on guilt in either direction. No mind-reading absent people. No hotline numbers from
the model, ever. Being corrected is progress; a companion who agrees with everything
isn't listening.
