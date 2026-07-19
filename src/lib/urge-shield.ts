import { fnv1a } from "./wind-down.ts";

/**
 * The urge-shield's "write it, don't send it" drain.
 *
 * When the urge is to send something, the honest release is to write the
 * whole thing — get it out of the body — and then let it go UNSENT and
 * UNKEPT. The text is never saved and never transmitted; it exists only for
 * the seconds it takes to write. The acknowledgement is hand-written and
 * chosen deterministically (no Math.random on the render path), so the same
 * words always settle the same way.
 */

/** Warm, honest closings for a drained message — never scolding, never
 * pretending the feeling is gone; only that the words are out and going
 * nowhere. English keys; the room renders their Hindi through tx(). */
export const RELEASE_LINES = [
  "Out of you, and going nowhere. It never sends, and it isn't kept.",
  "Said, and let go. Nothing left this room — not the message, not a record of it.",
  "You got it all out. Now it dissolves: unsent, unsaved, yours alone.",
  "That's the whole of it, released. No one receives it, and nothing keeps it.",
];

export function releaseLineFor(text: string): string {
  return RELEASE_LINES[fnv1a(text.trim().toLowerCase()) % RELEASE_LINES.length];
}
