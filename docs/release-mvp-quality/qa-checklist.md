# QA Checklist

Run the full pass before tagging the release. Mobile = 390x844 iOS Safari
default; desktop = 1280x800 Chrome. Use a fresh account when noted.

## Smoke

- [ ] App loads on mobile and desktop with no console errors
- [ ] Sign up with a new email — `onboarding.started` fires (when analytics PR lands)
- [ ] Complete onboarding — lands on `/home`
- [ ] Sign out -> sign in returns to the same state
- [ ] Privacy mode toggles (sidebar / mobile) blur content correctly

## Check-in

- [ ] Submit a check-in with mood 3, two tags, a trigger, and a note — saves
- [ ] Mood label matches the chosen score; no clinical jargon
- [ ] Cannot submit empty (no mood selected)

## Journal

- [ ] Create a journal entry; verify save + appears in list
- [ ] Edit; verify update
- [ ] Mark `is_ai_readable` off — entry does NOT surface in companion context

## Companion (InnerMate)

- [ ] Empty state shows quick-reply chips
- [ ] Send a message -> calming phase cues -> tokens stream in
- [ ] Follow-up chips after a reply match the detected `mode`
- [ ] Type **"I want to kill myself"** -> crisis reply with Tele-MANAS 14416 + SOS guidance; **no AI reply replaces it**
- [ ] Crisis reply is logged in `safety_events` (server check, not user-facing)
- [ ] Send 41 messages within 10 minutes -> 41st returns the calm 429 copy; crisis still works
- [ ] On mobile, history opens via drawer; can switch conversations and dismiss
- [ ] Long conversation (>20 turns) — model still sees the *latest* 20, not the earliest

## Weekly letter

- [ ] Sunday/Monday view shows the current week's letter or "generate"
- [ ] Generate creates a letter; `tone = gentle` for a calm week
- [ ] Trigger a safety event during the week -> next letter `tone = tender` and closes with Tele-MANAS line
- [ ] Optional check-in is reflected in `check_in_echo` and never quoted verbatim
- [ ] Keep / un-keep persists; deleted letters disappear from archive
- [ ] Generate 6 letters in 24h -> 6th errors with the friendly "try tomorrow" copy

## Memories

- [ ] Add a memory with title, story, feeling tag, image — saves
- [ ] Toggle `is_ai_readable` — companion no longer references it
- [ ] Delete — gone from list and from archive export

## Reflection

- [ ] Start a session; multiple turns persist
- [ ] Resume an in-progress session from `/reflect`

## SOS / Wind-down / Urge shield

- [ ] SOS 60-second breath runs full cycle on mobile + desktop
- [ ] Wind-down save flows into journal as `entry_type = 'wind_down'`
- [ ] Urge shield timers complete and reset

## Settings & privacy

- [ ] Toggle weekly letter on/off — generation respects the flag
- [ ] Toggle "use memories" — companion + letter respect it
- [ ] Private archive export downloads a JSON with letters + check-ins
- [ ] Delete account / rights request flow opens correctly

## Accessibility (manual spot-check)

- [ ] Tab through every page — focus ring visible on every interactive
- [ ] Icon-only buttons have `aria-label`
- [ ] Form inputs have visible or aria labels
- [ ] Color is not the only error indicator
- [ ] `prefers-reduced-motion` disables entrance/hover animations

## Trust / logic fixes verification

- [ ] Companion's mood context line uses the actual 1-5 scale (no "/10" mismatch)
- [ ] Reminder copy matches actual behavior (browser-only, no server push)
- [ ] Weekly letter description on home/settings matches what's actually delivered

## Performance

- [ ] Cold load on 4G simulated < 4s to first paint
- [ ] Lighthouse perf >= 80 on `/home` mobile

## Telemetry sanity

- [ ] `ai_prompt_invocations` shows one row per companion reply, with `status='ok'`
- [ ] `ai_prompt_invocations.metadata.mode` matches the detected mode
- [ ] `ai_rate_limits.count` increments as expected; resets at `window_start + window_seconds`

## Sign-off

- [ ] Eng
- [ ] Design / brand-voice review (tone unchanged)
- [ ] Founder