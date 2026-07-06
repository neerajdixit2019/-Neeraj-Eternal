# Rate Limiting & Prompt Versioning

Shipped in this PR. Backend foundation for AI abuse protection and a stable
audit trail of which prompt + model produced which assistant reply.

## Tables

### `ai_rate_limits` (server-only)

Fixed-window counters per (user, route, window_start). RLS on, no policies —
only the service role can read/write. Stale buckets are cleaned opportunistically
(~1% of calls drop rows older than 24h).

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | composite PK |
| `route` | `text` | composite PK — e.g. `companion.stream` |
| `window_start` | `timestamptz` | composite PK — aligned to fixed buckets |
| `count` | `integer` | atomically incremented |

### `ai_prompt_versions` (server-only)

Append-only registry of every unique system prompt + model pairing.
`hash` is the first 32 chars of `sha256(system_text)`. New version row is
created the first time a hash is seen; in-process cache keeps subsequent
calls free.

| Column | Notes |
|---|---|
| `prompt_name` | logical key, e.g. `companion.system` |
| `model` | e.g. `google/gemini-3-flash-preview` |
| `hash` | truncated sha256 of `system_text` |
| `system_text` | full prompt as sent |
| `metadata` | jsonb — flags like tone, support, uses_memories |
| (`prompt_name`, `hash`, `model`) | UNIQUE |

### `ai_prompt_invocations` (server-only)

One row per AI call attempt — including rate-limited, no-key, and error
cases (not just successful generations). Indexed on `(user_id, created_at)`
and `(route, created_at)`.

| Column | Notes |
|---|---|
| `user_id`, `route`, `model` | required |
| `prompt_version_id` | FK to `ai_prompt_versions` (nullable on early-exit paths) |
| `status` | `ok` \| `error` \| `rate_limited` \| `no_key` \| `crisis_bypass` |
| `error_code` | short tag (`stream_error`, `generate_error`, etc.) |
| `latency_ms`, `input_chars`, `output_chars` | observability |
| `metadata` | jsonb — conversation_id, mode, tone, etc. |

## Postgres function

`public.consume_ai_rate_limit(user_id, route, limit, window_seconds)` returns
`(allowed, remaining, reset_at)`. `SECURITY DEFINER`, execute revoked from
`anon` and `authenticated` — only the server role can call it.

## Server helpers

- `src/lib/ai-rate-limit.server.ts` — `consumeAiRateLimit`, `rateLimitedResponse`, `AI_RATE_LIMITS` defaults.
- `src/lib/ai-prompt-registry.server.ts` — `registerPromptVersion`, `logInvocation`.

Both **fail open**. A rate-limit RPC failure or a registry write failure
never blocks a user reply.

## Default limits

| Route | Limit | Window | Why |
|---|---:|---:|---|
| `companion.stream` | 40 | 10 min | Normal reflective use < 10/hr; loops/abuse exceed |
| `companion.fallback` | 40 | 10 min | Legacy non-stream endpoint, same envelope |
| `weekly_letter.generate` | 5 | 24 h | Only one letter expected per week |

## Crisis path bypasses the limit

In `/api/companion`, the crisis-keyword branch returns its safety response
**before** the rate-limit check. Safety responses must never be throttled.
`safety_events` is logged regardless.

## Wired call sites

| File | Route key | Notes |
|---|---|---|
| `src/routes/api/companion.ts` | `companion.stream` | Logs after stream completes; captures mode + tone |
| `src/lib/letters.functions.ts` (`generateWeeklyLetter`) | `weekly_letter.generate` | Limit only counts when we actually call the model (existing letters are served first) |
| `src/lib/companion.functions.ts` (`sendCompanionMessage`) | `companion.fallback` | Legacy fn — kept in parity |

## What this doesn't do (yet)

- No IP-based limit. Per-user is fine for an authenticated app; revisit when we open public endpoints.
- No global per-minute ceiling. Add if a single bad actor exhausts AI gateway credits.
- No admin UI to browse `ai_prompt_invocations`. For now, query directly.
- Token-bucket would smooth bursts better than fixed windows; fine for v1.

## Useful queries

```sql
-- Recent rate-limited users
SELECT user_id, route, count(*) AS hits, max(created_at) AS last_at
FROM public.ai_prompt_invocations
WHERE status = 'rate_limited' AND created_at > now() - interval '24 hours'
GROUP BY user_id, route ORDER BY hits DESC LIMIT 50;

-- p50 / p95 latency per route last 24h
SELECT route,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
       count(*) FILTER (WHERE status = 'ok') AS ok_count,
       count(*) FILTER (WHERE status = 'error') AS error_count
FROM public.ai_prompt_invocations
WHERE created_at > now() - interval '24 hours'
GROUP BY route;

-- Which prompt versions are in active use this week
SELECT v.prompt_name, v.model, v.hash, v.created_at AS version_first_seen,
       count(i.id) AS calls_this_week
FROM public.ai_prompt_versions v
LEFT JOIN public.ai_prompt_invocations i
  ON i.prompt_version_id = v.id AND i.created_at > now() - interval '7 days'
GROUP BY v.id ORDER BY calls_this_week DESC;
```