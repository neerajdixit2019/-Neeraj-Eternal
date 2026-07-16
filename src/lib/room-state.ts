/**
 * The room that responds — emotional-state adaptation, from data the app
 * already has. Pure and deterministic: the same inputs always give the same
 * room, and absent signals always give the neutral room. Nothing is inferred
 * without data — there is deliberately no "shame" room here, because
 * check-ins carry no shame signal and guessing would break the app's
 * privacy-honest rule.
 *
 * Two hard rules live at the call site (the app shell), not here:
 *  - atmosphere shifts apply on NAVIGATION, never mid-view;
 *  - every dimmed state keeps text at a WCAG-AA contrast floor (the CSS
 *    only ever darkens backgrounds, never lightens text toward them).
 */

export type Room = "neutral" | "grief" | "panic" | "loneliness" | "anger" | "growth";

export type RoomMood = {
  created_at: string;
  mood_score: number | null;
  emotion_tags?: string[] | null;
  trigger_tags?: string[] | null;
};

/** How long a check-in is allowed to colour the room. */
export const SIGNAL_WINDOW_MS = 12 * 60 * 60 * 1000;

const tagsOf = (m: RoomMood): string[] =>
  [...(m.emotion_tags ?? []), ...(m.trigger_tags ?? [])].map((t) => t.toLowerCase());

/**
 * The acute room, from the single most recent check-in inside the signal
 * window. Priority: panic > anger > loneliness > grief — the states that
 * change what the user needs most decide first.
 */
function acuteRoom(latest: RoomMood): Room | null {
  const tags = tagsOf(latest);
  const score = latest.mood_score;
  const low = typeof score === "number" && score <= 4;
  const veryLow = typeof score === "number" && score <= 3;

  if (low && (tags.includes("anxious") || tags.includes("overwhelmed"))) return "panic";
  if (tags.includes("angry")) return "anger";
  if (tags.includes("lonely")) return "loneliness";
  if (veryLow || (low && (tags.includes("heavy") || tags.includes("numb")))) return "grief";
  return null;
}

/**
 * Growth is the app's only celebration, and it must be evidenced: this
 * week's average mood is meaningfully higher than last week's, with at
 * least three check-ins in each week. Real numbers or nothing.
 */
function isGrowth(moods: RoomMood[], now: Date): boolean {
  const week = 7 * 24 * 60 * 60 * 1000;
  const t = now.getTime();
  const thisWeek: number[] = [];
  const lastWeek: number[] = [];
  for (const m of moods) {
    if (typeof m.mood_score !== "number") continue;
    const age = t - new Date(m.created_at).getTime();
    if (age < 0) continue;
    if (age < week) thisWeek.push(m.mood_score);
    else if (age < 2 * week) lastWeek.push(m.mood_score);
  }
  if (thisWeek.length < 3 || lastWeek.length < 3) return false;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return avg(thisWeek) - avg(lastWeek) >= 1.5;
}

/** The room for right now. Moods may arrive in any order. */
export function roomFor(moods: RoomMood[], now: Date): Room {
  if (!moods.length) return "neutral";
  const sorted = [...moods].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const latest = sorted[0];
  const age = now.getTime() - new Date(latest.created_at).getTime();
  if (age >= 0 && age <= SIGNAL_WINDOW_MS) {
    const acute = acuteRoom(latest);
    if (acute) return acute;
  }
  if (isGrowth(sorted, now)) return "growth";
  return "neutral";
}

/** The one margin note growth is allowed — naming the evidenced change. */
export const GROWTH_NOTE =
  "this week has been sitting a little lighter than last — your own check-ins say so.";
