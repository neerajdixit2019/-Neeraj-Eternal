/**
 * The morning, gently begun — the dawn bookend to the wind-down night.
 *
 * Before the day asks anything, you choose HOW to meet it — a tone, not a
 * task. Deliberately the opposite of a productivity ritual, and the opposite
 * of the insights "kept intention": this is NOT tracked, scored, or followed
 * up on. It is held for today only, carried quietly on Home, then cleared —
 * no streak, no guilt for a morning missed (growth is the app's only
 * celebration). Pure and SSR-safe; the day is always passed in, never read
 * from a clock on the render path.
 */

import { istDayKey } from "./ist.ts";

export type MorningPosture = {
  /** English key rendered through tx() — the word you tap. */
  key: string;
  /** The warm line Home carries through the day if you choose it. */
  echo: string;
};

/** Ways to meet the day — gentle, self-compassionate, never a to-do. */
export const MORNING_POSTURES: MorningPosture[] = [
  { key: "gently", echo: "today, gently." },
  { key: "one thing at a time", echo: "one thing at a time, today." },
  { key: "kinder to myself", echo: "a little kinder to myself, today." },
  { key: "steady", echo: "steady, today — no need to rush." },
  { key: "open to what comes", echo: "open to what today brings." },
  { key: "just here", echo: "just here, today. that's enough." },
];

/** Deterministic per-day opening line (seeded by the day-of-month, mirroring
 * dailyVerse) — the same greeting all of one morning, a new one tomorrow. */
export const MORNING_LINES = [
  "The day hasn't asked anything of you yet. Meet it however you can.",
  "A new page, still blank. There's no wrong way to begin it.",
  "Morning. You don't have to be ready — just here is a fine place to start.",
  "The light is back. However you slept, this is a fresh beginning.",
  "Before the noise of the day, one quiet moment that's only yours.",
];

export function morningLineFor(dayOfMonth: number): string {
  const i = ((dayOfMonth % MORNING_LINES.length) + MORNING_LINES.length) % MORNING_LINES.length;
  return MORNING_LINES[i];
}

/* ── device-local carry: the chosen posture accompanies today, then clears ── */

const KEY = "mqs-morning";

/** IST calendar day so "today" matches the reader's morning in India. */
export function dayStamp(now: Date): string {
  return istDayKey(now);
}

export function saveMorningPosture(echo: string, now: Date): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ day: dayStamp(now), echo }));
  } catch {
    /* ignore */
  }
}

/** The echo to carry on Home — but only if it was set TODAY. A posture from
 * yesterday quietly disappears; the morning is not a debt. */
export function readMorningPosture(now: Date): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as { day?: string; echo?: string };
    if (rec.day !== dayStamp(now) || !rec.echo) return null;
    return rec.echo;
  } catch {
    return null;
  }
}

export function clearMorningPosture(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
