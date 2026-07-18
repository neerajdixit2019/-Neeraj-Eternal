/*
 * My Quiet Space — the lamp that stays lit.
 *
 * Hand-rolled on purpose: no build plugin, no new dependency, nothing for
 * the publish pipeline's install step to trip on.
 *
 * Strategy:
 *  - /assets/* (content-hashed, immutable): cache-first, cached on first use.
 *  - Page navigations: network-first so a fresh deploy is never masked.
 *    Only pages on a small allowlist are ever stored — pages that carry no
 *    personal content. Authed rooms (Today, Journal, …) are never written
 *    to CacheStorage, so a shared phone can't replay someone's private
 *    pages from cache. Everything else falls back to /offline.html.
 *  - Only same-origin GETs are touched. Server functions (POST) and
 *    Supabase traffic pass straight through, always.
 */
/* Bump VERSION whenever offline.html changes materially (numbers, copy) —
 * install re-caches it. Routine warms also refresh it on every online load. */
const VERSION = "qs-sw-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const OFFLINE_URL = "/offline.html";
/* pages with no personal content — the only navigations we ever store */
const PAGE_ALLOWLIST = ["/", "/login", "/sos", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/* The app asks us to warm safe pages (the SOS room, the offline fallback)
 * right after load, so the sanctuary works offline even if it was never
 * visited — and the fallback's crisis numbers refresh on every online load
 * instead of being pinned at install time. Warming a page also pulls its
 * shell assets (scripts, styles) into the assets cache, so a cold offline
 * start can fully hydrate; then the assets cache is trimmed so it can't
 * grow without bound across deploys. */
const ASSETS_CAP = 200;

async function warmPage(pages, assets, url) {
  try {
    const res = await fetch(url, { credentials: "same-origin", cache: "no-cache" });
    if (!res.ok) return;
    const html = await res.clone().text();
    await pages.put(url, res);
    const shell = [...new Set(html.match(/\/assets\/[A-Za-z0-9_.-]+/g) ?? [])];
    for (const a of shell) {
      if (await assets.match(a)) continue;
      try {
        const r = await fetch(a);
        if (r.ok) await assets.put(a, r);
      } catch {
        /* offline mid-warm: keep what we have */
      }
    }
  } catch {
    /* best-effort only */
  }
}

async function trimAssets(assets) {
  const keys = await assets.keys();
  for (let i = 0; i < keys.length - ASSETS_CAP; i++) await assets.delete(keys[i]);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "warm" || !Array.isArray(data.urls)) return;
  const work = Promise.all([caches.open(PAGES), caches.open(ASSETS)]).then(
    async ([pages, assets]) => {
      const urls = data.urls.filter(
        (u) => typeof u === "string" && PAGE_ALLOWLIST.includes(u),
      );
      for (const u of urls) await warmPage(pages, assets, u);
      await trimAssets(assets);
    },
  );
  if (event.waitUntil) event.waitUntil(work);
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* immutable hashed assets: cache-first */
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  /* page navigations: network-first, allowlisted cache fallback, then the lamp */
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          if (res.ok && PAGE_ALLOWLIST.includes(url.pathname)) {
            /* keyed by pathname so query variants collapse to one entry */
            cache.put(url.pathname, res.clone());
          }
          return res;
        } catch {
          const hit = await cache.match(req, { ignoreSearch: true });
          if (hit) return hit;
          const lamp = await cache.match(OFFLINE_URL);
          if (lamp) return lamp;
          return new Response("You appear to be offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })(),
    );
  }
});
