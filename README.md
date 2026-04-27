# Neeraj Eternal

A mobile-first emotional flow for youth: check in with a feeling, write what is present, and receive a gentle reflection.
It also includes Healing Journeys, a local 7-day writing flow for letting go, self worth, and understanding love.

## Run

Run:

```powershell
node server.js
```

Then open `http://127.0.0.1:5180`.

You can test the core flow at:

- `http://127.0.0.1:5180/check-in`
- `http://127.0.0.1:5180/journal`
- `http://127.0.0.1:5180/reflect`
- `http://127.0.0.1:5180/pause`
- `http://127.0.0.1:5180/journeys`
- `http://127.0.0.1:5180/journeys/letting-go`

If `node` is not available on PATH in this Codex environment, use:

```powershell
& "C:\Users\neera\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

The app loads React, Babel, and Tailwind from CDNs. Journal, pause, and journey progress are stored in `localStorage`; there is no backend yet.

Healing Journeys progress is stored under `neeraj-eternal-healing-journeys` by journey id, with `currentDay` and saved daily `entries`.

## Deploy to Vercel

This is a static site. Deploy the project folder as-is with no build command.

- Framework preset: `Other`
- Build command: leave empty
- Output directory: `.`

## Repository

Project source: https://github.com/neerajdixit2019/-Neeraj-Eternal
