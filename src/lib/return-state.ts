/**
 * The returning — the room that waited.
 *
 * The emotional inverse of room-state.ts. That module colours the room to
 * the feeling you arrived with; this one notices how long you were *away*
 * and lets the room greet the gap without a trace of shame. Pure and
 * deterministic, from timestamps the app already has.
 *
 * Hard rules, load-bearing (mirrors the no-streaks, no-gamification bans):
 *  - We measure a gap, never a streak, and never "what you missed". There
 *    is no backlog, no count of skipped days, no catching up.
 *  - Absence is honoured, never scored: coming back is not a celebration
 *    (growth stays the app's only one) and never a scolding.
 *  - A brand-new reader (no history) is NOT "returning" — onboarding and
 *    the first blank page already greet them.
 */

export type ReturnState = "present" | "stepped_away" | "been_a_while" | "long_away";

const DAY = 86_400_000;

/** Day thresholds for each greeting. Kept gentle: a few days is nothing, a
 * week earns a soft welcome, a month earns the fullest "still yours". */
export const RETURN_THRESHOLDS = { steppedAway: 3, beenAWhile: 8, longAway: 31 } as const;

/** Whole days between the last sign of the reader and now. Never negative
 * (a future timestamp from clock skew reads as 0). */
export function daysAway(lastActiveMs: number | null, nowMs: number): number {
  if (lastActiveMs == null) return 0;
  const d = Math.floor((nowMs - lastActiveMs) / DAY);
  return d > 0 ? d : 0;
}

/** The newest real activity time across the app's own records, or null if
 * the reader has no history yet. Ignores blank/invalid timestamps. */
export function latestActivityMs(times: (string | null | undefined)[]): number | null {
  let latest: number | null = null;
  for (const t of times) {
    if (!t) continue;
    const ms = new Date(t).getTime();
    if (Number.isNaN(ms)) continue;
    if (latest == null || ms > latest) latest = ms;
  }
  return latest;
}

export function returnStateFor(lastActiveMs: number | null, nowMs: number): ReturnState {
  // No history: a first-timer, not a returner. The blank page welcomes them.
  if (lastActiveMs == null) return "present";
  const d = daysAway(lastActiveMs, nowMs);
  if (d >= RETURN_THRESHOLDS.longAway) return "long_away";
  if (d >= RETURN_THRESHOLDS.beenAWhile) return "been_a_while";
  if (d >= RETURN_THRESHOLDS.steppedAway) return "stepped_away";
  return "present";
}

/** True only when the room should say something about the gap at all. */
export function isReturning(state: ReturnState): boolean {
  return state !== "present";
}
