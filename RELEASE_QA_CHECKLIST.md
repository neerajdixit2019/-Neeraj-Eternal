# Release QA Checklist — My Quiet Space / InnerMate

Run this before every release. Mark each item Pass / Fail / N/A.

## Functional QA
- [ ] Auth: sign-in, sign-up, password reset, sign-out
- [ ] Onboarding: every step renders, skip works, completion lands on Home
- [ ] Home: greeting, primary CTA, quick actions, reminder card
- [ ] InnerMate: empty state, send message, streaming reply, follow-up chips, history drawer, new chat
- [ ] Mood Check-in: 1–10 slider, emotion/trigger chips, save, completion screen
- [ ] Journal: list loads, new entry, edit, delete, AI-readable toggle
- [ ] Weekly Letter: empty state, "create" flow, generated letter renders, keep/un-keep
- [ ] Memories: upload, list, AI-readable toggle, delete
- [ ] Wind-down: ritual starts, breathing animation, completion
- [ ] Settings: profile edit, reminder time, privacy mode toggle
- [ ] Export & delete: export downloads, delete-account flow confirms twice

## Safety QA
- [ ] Crisis keywords still trigger Tele-MANAS 14416 reminder
- [ ] Self-harm phrases route to SOS resources
- [ ] "InnerMate is not therapy or emergency support" disclaimer is visible in Settings/Privacy
- [ ] Emergency guidance points to real human help, not the AI
- [ ] AI memory permission toggle is honored — disabling hides memory from AI context

## Privacy QA
- [ ] Privacy mode copy: "visually blurs your screen for shoulder-surfing protection. It does not encrypt your screen."
- [ ] AI-readable memory toggle copy reflects: "InnerMate may use this memory to support future reflections."
- [ ] Data export contains expected tables and no other users' data
- [ ] Data delete removes journal, memories, mood logs, conversations, profile
- [ ] No private text (journal/chat/memory bodies) appears in any analytics event payload

## Mobile QA (390×844 and 360×800)
- [ ] iPhone width: no horizontal scroll, no overflow
- [ ] Android width: no horizontal scroll, no overflow
- [ ] Chat composer remains visible with on-screen keyboard open
- [ ] Bottom nav does not overlap primary CTAs or composer
- [ ] Long text wraps; no clipped buttons or cards

## Accessibility QA
- [ ] Keyboard tab order is logical on every page
- [ ] Visible focus ring on buttons, chips, links, inputs
- [ ] Every icon-only button has aria-label
- [ ] Text contrast meets WCAG AA on soft backgrounds
- [ ] Tap targets ≥ 44×44 on mobile
- [ ] No hover-only critical actions
- [ ] Streaming responses announce loading via aria-live

## Analytics QA
- [ ] Each event in `src/lib/analytics.ts` EventName union fires at the right call site
- [ ] No event payload contains journal/chat/memory text, emails, or names
- [ ] Analytics failure (e.g. provider 500) does not break the UI
- [ ] Dev console logs `[analytics] <event>` for every tracked action

## Copy QA
- [ ] Mood is described as 1–10 everywhere (no `/5` or "out of 5" remains)
- [ ] Reminder copy mentions browser-only limitation
- [ ] Weekly letter copy never promises a letter "waiting" before it is generated
- [ ] Privacy copy never claims encryption that does not exist

## Final sweep
- [ ] `bun run typecheck` passes
- [ ] `bun run build` passes
- [ ] No console errors on Home, InnerMate, Check-in, Journal, Letter, Memories, Settings
- [ ] No broken routes (404s) from in-app links