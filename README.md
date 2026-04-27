# Youth Stress Wisdom

A self-contained React page for youth stress support, devotional reflection, Bhagavad Gita wisdom, philosopher quotes, poetry excerpts, journaling, breathing practice, and growth missions.

## Run

Run:

```powershell
node server.js
```

Then open `http://127.0.0.1:5180`.

If `node` is not available on PATH in this Codex environment, use:

```powershell
& "C:\Users\neera\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
```

The app loads React, Babel, and Tailwind from CDNs.

## Live Wisdom Sources

- Bhagavad Gita: https://vedicscriptures.github.io
- Poetry: https://poetrydb.org
- Philosophy: https://philosophersapi.com

If a live source is unavailable, the app shows built-in fallback wisdom so the support experience does not go blank.

## Deploy to Vercel

This is a static site. Deploy the project folder as-is with no build command.

- Framework preset: `Other`
- Build command: leave empty
- Output directory: `.`

## Repository

Project source: https://github.com/neerajdixit2019/-Neeraj-Eternal
