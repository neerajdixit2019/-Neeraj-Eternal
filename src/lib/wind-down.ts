/**
 * The night, made whole — the logic behind the wind-down room's worry path.
 *
 * When a thought won't stop circling at 2am, the honest thing is not to
 * solve it (nothing gets solved well at 2am) but to name it and let it wait
 * for morning — a plain version of the evidence-based "worry postponement"
 * a person can do without a clinician. The reframe is hand-written and
 * chosen deterministically (no Math.random on the render path, per the SSR
 * rule): the worry is real, this hour is just not when it's answered.
 */

/** FNV-1a 32-bit — deterministic, seedable, SSR-safe. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Warm, honest closings for the worry-postponement path. Never clinical,
 * never dismissive: the worry is taken seriously; only its timing is
 * refused. English keys — the room renders their Hindi through tx().
 */
export const PARKING_LINES = [
  "Noted — and nothing here needs solving at this hour. It'll keep till morning.",
  "It's written down now, so your mind can set it down too. Morning is soon enough.",
  "Whatever this is, it isn't asking to be fixed tonight. Let it wait where it's safe.",
  "You've named it, and that's enough for now. Rested, tomorrow, you'll meet it clearer.",
];

/** The same worry always parks to the same line — steady, not random. */
export function parkingLineFor(text: string): string {
  const key = text.trim().toLowerCase();
  return PARKING_LINES[fnv1a(key) % PARKING_LINES.length];
}

/** What the saved journal line reads as, so a parked worry is legible later
 * without pretending it was a resolved reflection. */
export function parkedEntry(text: string): string {
  return `Parked till morning: ${text.trim()}`;
}
