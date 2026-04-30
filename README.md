# Neeraj Eternal

A mobile-first emotional safe space for young people. No accounts; SOS mode, care kit, pressure reset, daily ritual, guided calm, quiet pattern, emotion timeline, journal, pause, journey, museum, and chat state stay in the current browser through `localStorage`.

**Features:**
- **Home Hub** - a warmer main doorway with a primary next step, quick feeling chips, progress hints, and safety support.
- **My Quiet Space** - a private local pattern page that shows what helped before and suggests a gentle next step.
- **Emotion Timeline** - a private date-based view of daily notes, journal reflections, calm sessions, and journey entries.
- **Daily Sanctuary** - one gentle daily ritual to name a feeling, receive a short wisdom line, release a note, and choose one calming action.
- **Guided Calm** - body-first breathing, grounding, unclenching, and kind self-talk exercises for high-stress moments.
- **SOS Mode** - a fast grounding path for intense moments, with emergency support language and gentle next steps.
- **Care Kit** - a private support kit with trusted person, safe place, calming action, and a reminder.
- **Pressure Reset** - a student-focused room for exams, family expectations, comparison, career, money, and future worry.
- **Check-in** - choose a feeling, including "not sure", with real-life examples before writing.
- **Journal + Reflection** - write privately, then receive a cleaner reflection based on both the chosen emotion and journal text.
- **Wisdom Chat** - a private chat-like companion with starter prompts, mood chips, and optional journal draft reuse.
- **Pause Before You Text** - a flow that slows you down before sending an impulsive message.
- **Healing Journeys** - 7-day guided writing journeys with today's step, saved previews, and continue states.
- **Museum of Unsaid Things** - an anonymous local wall with featured notes and feeling-based browsing.

## Run

Run:

```powershell
node server.js
```

Then open `http://127.0.0.1:5180`.

You can test the core flow at:

- `http://127.0.0.1:5180/`
- `http://127.0.0.1:5180/me`
- `http://127.0.0.1:5180/timeline`
- `http://127.0.0.1:5180/today`
- `http://127.0.0.1:5180/calm`
- `http://127.0.0.1:5180/sos`
- `http://127.0.0.1:5180/care`
- `http://127.0.0.1:5180/pressure`
- `http://127.0.0.1:5180/check-in`
- `http://127.0.0.1:5180/journal`
- `http://127.0.0.1:5180/reflect`
- `http://127.0.0.1:5180/wisdom`
- `http://127.0.0.1:5180/pause`
- `http://127.0.0.1:5180/journeys`
- `http://127.0.0.1:5180/journeys/letting-go`
- `http://127.0.0.1:5180/museum`

**Scripture API (local server only):**
- `GET /api/scriptures` - all themes and scripture collections.
- `GET /api/wisdom/:theme` - scriptures for a theme (longing, anxiety, rejection, heavy, numb, loss, self-worth, hope, letting-go, overthinking, lost).
- `POST /api/wisdom` - send `{ text }` or `{ theme }`, receive a scripture response.

If `node` is not available on PATH in this Codex environment, use:

```powershell
& "C:\Users\neera\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

The app loads React, Babel, and Tailwind from CDNs. The canonical app experience lives in `src/App.jsx`; Vercel rewrites the main routes back to `index.html` so the React router handles them consistently. Route folders also include small `index.html` fallbacks so direct links like `/care`, `/pressure`, and `/sos` keep working on static hosts.

Journal, daily sanctuary, guided calm, pause, journey, museum, and wisdom chat progress are stored in `localStorage`; there is no backend account system.

My Quiet Space at `/me` does not create a new storage key. It reads existing local data and summarizes it on the current device only.

Emotion Timeline at `/timeline` does not create a new storage key. It reads existing local data and groups saved moments by date.

Daily Sanctuary entries are stored under `neeraj-eternal-daily-sanctuary` by local date, shaped like `{ date, emotionId, note, action, savedAt }`.

Guided Calm history is stored under `neeraj-eternal-guided-calm` as `{ completedCount, latestExerciseId, latestCompletedAt }`.

Care Kit is stored under `neeraj-eternal-care-kit` as `{ person, place, action, reminder, updatedAt }`. It is local-only and warns users not to save contact details.

Pressure Reset history is stored under `neeraj-eternal-pressure-reset` as `{ latest, history }`, with local entries for pressure type, worry text, reframe, action, and saved time.

Healing Journeys progress is stored under `neeraj-eternal-healing-journeys` by journey id, with `currentDay` and saved daily `entries`.

Museum notes are stored under `museum_unsaid_notes` as anonymous `{ id, category, text, createdAt }` entries. Seed notes are added when the wall is empty.

The safety/support panel is intentionally gentle: it encourages pausing, breathing, contacting a trusted person, seeking local emergency help if there is immediate danger, and opening SOS Mode for a fast grounding path. The app is reflective support, not therapy or medical care.

## Deploy to Vercel

This is a static site. Deploy the project folder as-is with no build command.

- Framework preset: `Other`
- Build command: leave empty
- Output directory: `.`

## Repository

Project source: https://github.com/neerajdixit2019/-Neeraj-Eternal
