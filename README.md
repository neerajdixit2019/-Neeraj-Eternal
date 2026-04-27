# Neeraj Eternal

A mobile-first emotional safe space for young people. No accounts, no data sent anywhere — everything stays on the device.

**Features:**
- **Home Hub** — a calm main doorway at `/` linking to every emotional space
- **Check-in** — choose a feeling (7 emotions including longing and feeling lost), write, and receive a gentle reflection with a scripture quote
- **Wisdom Chat** — a private chat-like companion that listens and responds with words from Bhagavad Gita, Quran, Bible, Rumi, Buddha, and other ancient wisdom
- **Pause Before You Text** — a flow that slows you down before sending an impulsive message
- **Healing Journeys** — 7-day guided writing journeys for letting go, self-worth, and understanding love
- **Museum of Unsaid Things** — an anonymous wall for words never sent

## Run

Run:

```powershell
node server.js
```

Then open `http://127.0.0.1:5180`.

You can test the core flow at:

- `http://127.0.0.1:5180/`
- `http://127.0.0.1:5180/check-in`
- `http://127.0.0.1:5180/journal`
- `http://127.0.0.1:5180/reflect`
- `http://127.0.0.1:5180/wisdom`
- `http://127.0.0.1:5180/pause`
- `http://127.0.0.1:5180/journeys`
- `http://127.0.0.1:5180/journeys/letting-go`
- `http://127.0.0.1:5180/museum`

**Scripture API (local server only):**
- `GET /api/scriptures` — all themes and scripture collections
- `GET /api/wisdom/:theme` — scriptures for a theme (longing, anxiety, rejection, heavy, numb, loss, self-worth, hope, letting-go, overthinking, lost)
- `POST /api/wisdom` — send `{ text }` or `{ theme }`, receive a scripture response

If `node` is not available on PATH in this Codex environment, use:

```powershell
& "C:\Users\neera\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

The app loads React, Babel, and Tailwind from CDNs. The `/` home hub links to Check-in, Wisdom Chat, Pause, Healing Journeys, and Museum of Unsaid Things. Journal, pause, and journey progress are stored in `localStorage`; there is no backend yet.

Healing Journeys progress is stored under `neeraj-eternal-healing-journeys` by journey id, with `currentDay` and saved daily `entries`.

Museum notes are stored under `museum_unsaid_notes` as anonymous `{ id, category, text, createdAt }` entries. Seed notes are added when the wall is empty.

## Deploy to Vercel

This is a static site. Deploy the project folder as-is with no build command.

- Framework preset: `Other`
- Build command: leave empty
- Output directory: `.`

## Repository

Project source: https://github.com/neerajdixit2019/-Neeraj-Eternal
