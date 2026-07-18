import { useCallback, useSyncExternalStore } from "react";
import { STRINGS, type StringKey } from "./i18n-strings";

/**
 * अपनी भाषा में — the app's display-language layer. Deliberately tiny and
 * dependency-free: one localStorage key, one dictionary module, two hooks.
 *
 * Hard rules:
 *  - This layer changes DISPLAY ONLY. Every stored value (emotion/trigger
 *    tags, onboarding answers, entry_type keys) stays English — the pattern
 *    engine, server functions, and tests all match on those strings.
 *  - The server render is always English; the client swaps after hydration
 *    (useSyncExternalStore's server snapshot), so SSR never mismatches.
 *  - Crisis numbers and tel: links are never part of a translation.
 */

export type Lang = "en" | "hi";
const KEY = "mqs-lang";

const listeners = new Set<() => void>();

function readLang(): Lang {
  try {
    return window.localStorage.getItem(KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

/** Reflect the language onto <html lang> so screen readers pronounce the
 * page in the right tongue. A no-op on the server. */
export function applyDocLang(lang: Lang) {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}

export function setLang(lang: Lang) {
  try { window.localStorage.setItem(KEY, lang); } catch { /* noop */ }
  applyDocLang(lang);
  listeners.forEach((l) => l());
}

/** Read the stored language and reflect it onto the document. Call once on
 * mount so a Hindi reader's page is announced as Hindi from the start. */
export function syncDocLang() {
  applyDocLang(readLang());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { applyDocLang(readLang()); cb(); } };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, readLang, () => "en");
}

/** t("nav.journal") — falls back to English, then to the key itself. */
export function useT() {
  const lang = useLang();
  return useCallback(
    (key: StringKey): string => STRINGS[lang][key] ?? STRINGS.en[key] ?? key,
    [lang],
  );
}

/**
 * Display name for a stored English feeling/trigger tag ("Heavy" → "भारी").
 * Unknown tags come back unchanged — never invent language for user data.
 */
export function tagLabel(tag: string, lang: Lang): string {
  if (lang === "en") return tag;
  return TAG_HI[tag] ?? tag;
}

const TAG_HI: Record<string, string> = {
  Heavy: "भारी",
  Anxious: "बेचैन",
  Lonely: "अकेलापन",
  Numb: "सुन्न",
  Confused: "उलझन",
  Calm: "शांत",
  Hopeful: "उम्मीद",
  Grateful: "आभार",
  Angry: "गुस्सा",
  Overwhelmed: "सब बहुत ज़्यादा",
  Work: "काम",
  Relationship: "रिश्ता",
  Family: "परिवार",
  Health: "सेहत",
  Money: "पैसा",
  Memories: "यादें",
  Sleep: "नींद",
  Future: "भविष्य",
};
