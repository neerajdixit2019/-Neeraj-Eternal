# My Quiet Space — working agreements

A private AI mental-wellness companion (InnerMate) for Indian youth. Not therapy,
not diagnosis, not crisis care — and the code enforces that. Stack: TanStack
Start/Router + Supabase (RLS) + Tailwind v4 + Lovable AI gateway.

## The gate (run before any commit)

```
npx tsc --noEmit          # expect 0 errors
npm run test:companion    # node:test suites, expect 587 pass
npm run build             # production build must succeed
```

Tests are plain `node --test` files under `src/lib/__tests__/` — NOT vitest.

## Load-bearing contracts (never change casually)

- **Safety**: the 4-level risk classifier in `src/lib/companion-risk.ts` is pure
  and shared; L3 responses are deterministic templates, never model-generated.
  Crisis resources come ONLY from `src/lib/crisis-resources.ts` (Tele-MANAS
  14416). The model must never write hotline numbers. `normalize()` folds NFD +
  nukta + nasals (ं/ँ) and KEEPS marks (`\p{M}`) — never revert to stripping
  marks, it mangles Devanagari. Signal vocabularies cover English + romanized
  Hinglish + Devanagari; the Devanagari-bearing arrays are `.map(normalize)`-ed
  so patterns fold to match. Any change to the vocab must re-pass the adversarial
  false-positive/false-negative pins in `companion-devanagari.test.ts`.
- **Server functions**: preserve zod shapes, react-query keys, mood scores
  2/4/6/8/10, `is_ai_readable` filters, stream frames (meta/phase/token/mode/
  done — mode includes "safety"), `risk_label` semantics.
- **Offline sanctuary**: `public/sw.js` is hand-rolled (no build plugin — never
  add a PWA dependency). It touches only same-origin GETs; page navigations are
  network-first and only `PAGE_ALLOWLIST` pages (personal-data-free: /, /login,
  /sos, /offline.html) are ever cached — authed rooms must never enter
  CacheStorage. `public/offline.html` is static; its crisis numbers are bound
  to `crisis-resources.ts` by `offline-sanctuary.test.ts` — change either side
  and the gate fails together.
- **The latch** (`src/lib/latch.ts` + `LatchGate`): device-local glance
  protection, honestly framed (not encryption). Safety invariants pinned by
  `latch.test.ts`: /sos is NEVER latched or veiled; attempt pacing is capped
  (slows guessing, never locks out); sign-out clears the latch (the account is
  the real lock); the PIN never leaves the device (salted iterated hash only).
- **`src/integrations/**` is auto-generated — never edit.**
- SSR: browser APIs only inside effects/handlers; all render-path randomness is
  seeded/deterministic (FNV-1a hashes, fixed seeds). `Math.random()` is legal
  only in event handlers.
- AI output is never load-bearing: validate strictly, fall back to hand-written
  content on any failure.

## The Lamplit Study (the design system — complete, phases 0–6)

The app is one room: a lamplit hill-station study at night.

**Materials** — Nightwall (indigo-slate walls), Paper (`--paper`/`--ink`, warm
cream + iron-gall), Brass (`--lamp`, the rationed amber), Clay (`--clay`,
crisis and true deletion ONLY), Moth Silver (`--moth`, starlight — allowed only
inside the Insights window and the Memories sky), Dawnline, Deodar. Legacy token
NAMES (`--violet`, `--forest-deep`, `--moss`) are kept with reassigned values —
do not "clean them up".

**Type** — Fraunces (display, `font-serif`), Newsreader (prose, `.font-reading`),
Spline Sans (UI). All bundled via @fontsource-variable in `src/router.tsx` — no
font CDN requests, ever. Newsreader italic uses the `wght-italic` variant (64KB),
not `opsz-italic` (147KB).

**Hard rules**
1. **One brass action per screen.** `qs-pill-cta` (the doorway lintel,
   `border-radius: 20px 20px 8px 8px`) appears at most once per view; secondary
   actions are quiet bordered buttons.
2. **No glassmorphism** (`backdrop-filter`), no violet/blue AI gradients, no
   starfields outside the two windows, no lotus/om/mascots, no streaks/badges/
   gamification, no cheerful treatment of heavy feelings, no Inter/Roboto.
3. **Destructive confirms are in-world, never `window.confirm()`**: trigger
   stays mounted, focus moves into the confirm (safe choice first), Escape
   cancels, focus returns to the trigger, all targets ≥44px.
4. **Every animation respects reduced motion** — CSS via `motion-safe:` or a
   `prefers-reduced-motion` block, framer-motion via `MotionConfig
   reducedMotion="user"`, no SMIL `<animate>` (it can't be guarded). Breath
   timers (rAF-driven) are the one thing allowed to move during panic.
5. **WCAG-AA floor everywhere**: ink-on-paper mixes ≥66% ink for small text;
   backgrounds may darken, text is never lightened toward its background.

**The room that responds** (`src/lib/room-state.ts`) — `roomFor()` maps the
latest check-in (≤12h) to grief/panic/loneliness/anger, evidenced week-over-week
improvement to growth, everything else to neutral. Applied as `body[data-room]`
by the app shell **on navigation only, never mid-view**. There is no shame room:
check-ins carry no shame signal and nothing is inferred without data. Growth is
the app's only celebration (one amber underline + one evidenced margin note).

## Sync & deploy (local repo is the source of truth)

commit/push GitHub (`neerajdixit2019/-Neeraj-Eternal`) → `git archive` →
upload to Lovable (project `23012686-5a46-42f5-9705-afccfd9dad94`) →
send_message "apply VERBATIM, report don't fix" → verify MD5s (CRLF: archive
output is CRLF; compare `git show HEAD:file | sed 's/$/\r/' | md5sum`) →
deploy_project → verify a marker string in the live CSS/JS bundles.

- **Never overwrite Lovable's `package.json`/`package-lock.json` wholesale** —
  their platform deps live there; apply script changes surgically.
- **`.env.production` is tracked ON PURPOSE** — it holds only the public-by-
  design client values (Supabase URL + publishable/anon key, which ship in
  the bundle anyway; RLS is the boundary). Lovable's publish pipeline builds
  WITHOUT a dev `.env`, and without these the published client throws
  "Missing Supabase environment variable(s)" and login dies. Never add a
  secret to it. Verify fix: `mv .env away → npm run build → grep dist for
  supabase.co → restore`.
- **`bunfig.toml` and `bun.lock` ARE tracked and DO ride in every sync zip** —
  so the repo's `bunfig.toml` must keep every `@lovable.dev/*` package in
  `minimumReleaseAgeExcludes`. When it didn't, Lovable's publish build failed
  `bun install`, shipped without the injected `VITE_SUPABASE_*` env, and the
  live login crashed with "Missing Supabase environment variable(s)" while
  the landing page still looked fine. After ANY deploy, verify `/login`
  renders (not just bundle markers).
- Lovable's tsc may show 1 error in their platform file
  `src/routes/[.]lovable.oauth.consent.tsx` — expected, not ours.
- Publishes can stall 30–60 min; the user's editor **Publish → Update** button
  unsticks them. Production keeps serving the previous good build meanwhile.

## Verification

Dev preview: `.claude/launch.json` server `dev` (port 8080); enable walkthrough
mode with `localStorage.setItem("mqs-dev-preview","1")` (DEV builds only).
Verify via DOM checks (`javascript_exec`) — full-page screenshots time out on
the animated background. Manual QA: `docs/QA-CHECKLIST.md`.
