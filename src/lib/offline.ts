/**
 * The lamp that stays lit — client wiring for the offline sanctuary.
 *
 * Registers the hand-rolled service worker (public/sw.js) and, once the
 * browser is idle, warms the SOS room: the router preloads its chunks
 * (cached under /assets by the worker) and the worker pre-stores the /sos
 * page itself, so the room opens with no connection even on a cold start.
 *
 * Production only — the dev server has no sw.js pipeline, and a worker
 * would mask HMR. Every step is best-effort: offline support must never
 * be able to break the online app.
 */

type PreloadingRouter = { preloadRoute: (opts: { to: "/sos" }) => Promise<unknown> };

export function initOfflineSanctuary(router: PreloadingRouter) {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  const start = () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Ask the browser not to evict our origin's storage under pressure —
    // the offline sanctuary should be the last thing to go.
    void navigator.storage?.persist?.().catch(() => {});
    const warm = () => {
      // .ready resolves only once a worker is ACTIVE — right after register()
      // both reg.active and controller can still be null on a first visit,
      // and a message sent then would silently warm nothing.
      navigator.serviceWorker.ready
        .then((reg) => {
          void router.preloadRoute({ to: "/sos" }).catch(() => {});
          reg.active?.postMessage({ type: "warm", urls: ["/sos", "/offline.html"] });
        })
        .catch(() => {});
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(warm, { timeout: 5000 });
    } else {
      window.setTimeout(warm, 3000);
    }
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
