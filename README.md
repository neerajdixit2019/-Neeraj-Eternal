# Neeraj Eternal

A mobile-first emotional flow for youth: check in with a feeling, write what is present, and receive a gentle reflection.

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

If `node` is not available on PATH in this Codex environment, use:

```powershell
& "C:\Users\neera\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

The app loads React, Babel, and Tailwind from CDNs. Journal state is stored in `localStorage`; there is no backend yet.

## Deploy to Vercel

This is a static site. Deploy the project folder as-is with no build command.

- Framework preset: `Other`
- Build command: leave empty
- Output directory: `.`

## Repository

Project source: https://github.com/neerajdixit2019/-Neeraj-Eternal
