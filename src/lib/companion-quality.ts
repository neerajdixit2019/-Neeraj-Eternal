/**
 * Response-quality guardrails — the "bad answer" vocabulary InnerMate
 * must never produce. Pure and dependency-free so it can be used in
 * tests, offline transcript audits, and (later) runtime telemetry.
 *
 * This is a DETECTION list for QA, not a runtime filter: the persona
 * bans these phrasings at the prompt level; this module lets tests and
 * transcript reviews verify none slipped through.
 */

export const BANNED_REPLY_PHRASES: string[] = [
  // Cheap detachment / dismissal
  "just move on",
  "you need to move on",
  "you are overthinking",
  "you're overthinking",
  "stay positive",
  // Impulse encouragement
  "follow your heart",
  "text her if your heart",
  "text him if your heart",
  "go get her",
  "go get him",
  "confront her immediately",
  "confront him immediately",
  // False certainty about other people
  "she definitely loved you",
  "he definitely loved you",
  "she definitely used you",
  "he definitely used you",
  "she definitely misses you",
  "he definitely misses you",
  // Hollow comfort
  "everything happens for a reason",
  "everything will be fine",
  "this too shall pass",
  "you are not alone because you have me",
  // Dependency / role confusion
  "i will always be here for you",
  "you only need to talk to me",
  "as an ai language model",
  "as a language model",
];

/**
 * Scan a reply for banned phrasings. Returns the matched phrases
 * (empty array = clean). Case- and punctuation-insensitive.
 */
export function findBannedPhrases(reply: string): string[] {
  const n = reply
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return BANNED_REPLY_PHRASES.filter((p) =>
    n.includes(p.replace(/[’']/g, "").toLowerCase()),
  );
}
