# Event Taxonomy (draft)

Status: **planned**, not yet instrumented. This is the contract the
analytics PR will implement against a Lovable Cloud `analytics_events`
table.

## Principles

- One event per meaningful user intent or system outcome. Not page views.
- Names are `domain.action` in `snake_case` — e.g. `companion.message_sent`.
- Every event includes: `user_id` (auth.uid), `event_name`, `props` (jsonb), `client_ts`, `server_ts`, `session_id`.
- Never log raw message bodies, journal text, memory text, mood notes. Log lengths, counts, flags — not content.
- Tone words ("tender", "gentle") are fine. Verbatim user text is not.

## Onboarding

| Event | Props | Fires when |
|---|---|---|
| `onboarding.started` | `{ entry: 'signup' \| 'invited' }` | First load of onboarding |
| `onboarding.step_completed` | `{ step: string, step_index: int }` | Each step Next |
| `onboarding.completed` | `{ steps_total: int, duration_ms: int }` | Reaches the end |
| `onboarding.abandoned` | `{ last_step: string }` | Leaves before completion (beacon on unload) |

## Home

| Event | Props | Fires when |
|---|---|---|
| `home.viewed` | `{ time_of_day: 'morning' \| 'afternoon' \| 'evening' \| 'night' \| 'late_night' }` | Mount |
| `home.quick_action_tapped` | `{ action: 'checkin' \| 'companion' \| 'journal' \| 'reflect' \| 'sos' }` | Tap |

## Check-in

| Event | Props | Fires when |
|---|---|---|
| `checkin.opened` | `{ source: 'home' \| 'nav' \| 'reminder' }` | Mount |
| `checkin.submitted` | `{ mood_score: 1..5, has_tags: bool, tag_count: int, has_trigger: bool, has_note: bool }` | Save |
| `checkin.dismissed` | `{}` | Closed without save |

## Journal

| Event | Props | Fires when |
|---|---|---|
| `journal.opened` | `{ source: string }` | Mount |
| `journal.entry_created` | `{ entry_type: 'free' \| 'wind_down', is_ai_readable: bool, body_chars: int }` | Save |
| `journal.entry_edited` | `{ entry_id: uuid, body_chars: int }` | Save edit |
| `journal.entry_deleted` | `{ entry_id: uuid }` | Delete |

## Reflection

| Event | Props | Fires when |
|---|---|---|
| `reflection.session_started` | `{ prompt_id: string \| null }` | Start |
| `reflection.turn_submitted` | `{ session_id: uuid, turn_index: int, chars: int }` | Each user turn |
| `reflection.session_completed` | `{ session_id: uuid, turns: int, duration_ms: int }` | End |

## Companion (InnerMate)

| Event | Props | Fires when |
|---|---|---|
| `companion.opened` | `{ source: string }` | Mount |
| `companion.empty_state_chip_tapped` | `{ chip_id: string, position: int }` | Tap quick-reply |
| `companion.message_sent` | `{ conversation_id: uuid, chars: int, tone: string \| null, has_history: bool }` | Submit |
| `companion.reply_received` | `{ conversation_id: uuid, mode: string, latency_ms: int }` | Stream done |
| `companion.followup_tapped` | `{ mode: string, action_id: string }` | Followup chip tap |
| `companion.rate_limited` | `{ retry_after_seconds: int }` | 429 from /api/companion |
| `companion.crisis_shown` | `{}` | Crisis path served |
| `companion.history_opened` | `{ source: 'drawer' \| 'sidebar' }` | Mobile drawer / desktop sidebar opens |

## Weekly Letter

| Event | Props | Fires when |
|---|---|---|
| `letter.viewed` | `{ week_start: date, tone: string, has_check_in: bool }` | Mount |
| `letter.generated` | `{ week_start: date, tone: string, latency_ms: int, uses_memories: bool }` | First generation |
| `letter.kept_toggled` | `{ kept: bool }` | Toggle keep |
| `letter.deleted` | `{}` | Delete |
| `letter.check_in_submitted` | `{ chars: int }` | Pre-letter note saved |

## Memories

| Event | Props | Fires when |
|---|---|---|
| `memories.opened` | `{}` | Mount |
| `memory.created` | `{ has_image: bool, feeling_tag: string \| null, is_ai_readable: bool }` | Save |
| `memory.edited` | `{ memory_id: uuid }` | Save edit |
| `memory.deleted` | `{}` | Delete |
| `memory.ai_readable_toggled` | `{ enabled: bool }` | Toggle |

## Errors

| Event | Props | Fires when |
|---|---|---|
| `app.client_error` | `{ name, message, stack_top_line, route, build_id }` | window.onerror / React error boundary |
| `app.server_error` | `{ route, status, error_code }` | Server function or API throw |

## Tables (planned)

```sql
-- Sketch only; final schema lands with the analytics PR.
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}',
  client_ts TIMESTAMPTZ NOT NULL,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## What NOT to log

- Message bodies, journal text, memory text, mood notes, weekly-letter bodies
- The exact emotion tag set per check-in (counts only)
- Anything that would let an analyst reconstruct a person's story