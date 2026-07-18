import { useSyncExternalStore } from "react";

/**
 * The reading room — comfort for the eyes that read at length.
 *
 * The app's prose surfaces (journal, letters, InnerMate) are the places a
 * reader lingers, often in a second language. This layer lets them size
 * that reading up without touching the UI chrome: it publishes a single
 * `--reading-scale` custom property that the .reading-text surfaces consume
 * through calc(). Deliberately tiny, in the shape of the i18n store.
 *
 * Honest scope: this is reading comfort for long-form prose, not a global
 * zoom — the browser's own zoom already does that. The scale is capped so
 * the study's layout never breaks.
 */

export type ReadingSize = "cosy" | "roomy" | "large";

const KEY = "mqs-reading";

/** The multiplier each level applies to a reading surface's base size.
 * Capped at 1.3 so lines still wrap gracefully in the fixed measure. */
export const READING_SCALE: Record<ReadingSize, number> = {
  cosy: 1,
  roomy: 1.15,
  large: 1.3,
};

export function isReadingSize(v: string | null): v is ReadingSize {
  return v === "cosy" || v === "roomy" || v === "large";
}

export function scaleFor(size: ReadingSize): number {
  return READING_SCALE[size];
}

const listeners = new Set<() => void>();

function readSize(): ReadingSize {
  try {
    const v = window.localStorage.getItem(KEY);
    return isReadingSize(v) ? v : "cosy";
  } catch {
    return "cosy";
  }
}

/** Reflect the choice onto the document so CSS can act on it. Safe to call
 * on every change; a no-op on the server. */
export function applyReadingSize(size: ReadingSize) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.reading = size;
  document.documentElement.style.setProperty("--reading-scale", String(scaleFor(size)));
}

export function setReadingSize(size: ReadingSize) {
  try { window.localStorage.setItem(KEY, size); } catch { /* noop */ }
  applyReadingSize(size);
  listeners.forEach((l) => l());
}

/** Read the stored choice and reflect it onto the document. Call once on
 * app mount so a returning reader's size is there before they read. */
export function syncReadingSize() {
  applyReadingSize(readSize());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // A change in another tab must re-apply the scale to THIS document, not
  // just re-render the settings hook — the prose reads from the DOM variable.
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { applyReadingSize(readSize()); cb(); } };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Server renders at "cosy" (scale 1); the client swaps after hydration,
 * so SSR never mismatches — the same contract the language store keeps. */
export function useReadingSize(): ReadingSize {
  return useSyncExternalStore(subscribe, readSize, () => "cosy");
}
