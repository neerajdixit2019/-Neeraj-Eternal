/**
 * InnerMate relevant-memory retrieval + emotional-pattern summary (pipeline v2,
 * stage 3). PURE ranking/derivation — the DB fetch stays in the route; this
 * module scores an already-fetched pool by RELEVANCE to the current message
 * (the today-code passes the 3 most RECENT memories regardless of topic).
 *
 * No embeddings/pgvector: relevance is lexical token-overlap against the
 * interpreter's memory_queries + the named emotion. Cheap, deterministic,
 * SSR-safe, and testable. When nothing scores, it returns [] so the writer is
 * told the context is insufficient rather than handed an irrelevant memory.
 */

export interface MemoryRow {
  title: string | null;
  story: string | null;
  memory_date: string | null;
  feeling_tag: string | null;
  created_at?: string | null;
}

export type Confidence = "low" | "medium" | "high";

export interface RankedMemory {
  title: string;
  snippet: string;
  date: string;
  feeling_tag: string | null;
  score: number;
  confidence: Confidence;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with",
  "my", "me", "i", "her", "him", "his", "she", "he", "it", "is", "was", "were",
  "that", "this", "about", "not", "no", "do", "did", "have", "had", "what",
  "why", "how", "when", "should", "would", "could", "am", "are", "be", "been",
]);

function tokenize(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/**
 * Light stem-free overlap: exact, or the shorter token (>=4 chars) is a prefix
 * of the longer. Connects "contacting"/"contact", "withdrawn"/"withdrawal"
 * without a stemmer, while staying precise ("call" never matches "contact").
 */
function prefixMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 4 && long.startsWith(short);
}

/**
 * Rank a memory pool by relevance to the interpreter's search terms + emotion.
 * Title hits weigh 2×, story/feeling hits 1×; a tiny recency tiebreak keeps
 * newer memories ahead when scores tie. Returns the top-k with score > 0.
 */
export function rankMemories(
  pool: MemoryRow[],
  queries: string[],
  primaryEmotion = "",
  k = 3,
): RankedMemory[] {
  const terms = new Set<string>();
  for (const q of queries) for (const t of tokenize(q)) terms.add(t);
  for (const t of tokenize(primaryEmotion)) terms.add(t);
  if (terms.size === 0) return [];

  const scored = pool.map((m, idx) => {
    const titleTokens = tokenize(m.title ?? "");
    const bodyTokens = [...tokenize(m.story ?? ""), ...tokenize(m.feeling_tag ?? "")];
    let score = 0;
    for (const t of terms) {
      if (titleTokens.some((tt) => prefixMatch(t, tt))) score += 2;
      else if (bodyTokens.some((bt) => prefixMatch(t, bt))) score += 1;
    }
    // Recency tiebreak in [0,1): earlier index (newer, pool is newest-first).
    const recency = pool.length > 1 ? (pool.length - idx) / (pool.length + 1) : 0;
    return { m, score, tiebreak: score + recency * 0.01 };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.tiebreak - a.tiebreak)
    .slice(0, k)
    .map((s) => ({
      title: (s.m.title ?? "untitled").trim(),
      snippet: (s.m.story ?? "").replace(/\s+/g, " ").slice(0, 160).trim(),
      date: s.m.memory_date ?? "undated",
      feeling_tag: s.m.feeling_tag ?? null,
      score: s.score,
      confidence: s.score >= 4 ? "high" : s.score >= 2 ? "medium" : "low",
    }));
}

// ── Emotional-pattern summary (structured, derived from raw rows) ─────────────

export interface MoodRow {
  mood_score?: number | null;
  emotion_tags?: string[] | null;
  trigger_tags?: string[] | null;
  note?: string | null;
  created_at?: string | null;
}

export interface EmotionalPatternSummary {
  /** Most frequent trigger tag across recent check-ins, or "". */
  recurring_trigger: string;
  /** Most frequent emotion tag, or "". */
  common_emotion: string;
  /** Direction of the recent mood arc. */
  arc: "lifting" | "heavier" | "steady" | "unknown";
  /** Commitments the user made earlier (e.g. "not to contact her"), if given. */
  boundaries: string[];
  /** Number of check-ins the summary is built from (honesty about the window). */
  sampleSize: number;
}

function topTag(rows: MoodRow[], key: "emotion_tags" | "trigger_tags"): string {
  const counts = new Map<string, number>();
  for (const r of rows) for (const t of r[key] ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best = "";
  let bestN = 0;
  for (const [t, n] of counts) if (n > bestN) { best = t; bestN = n; }
  return bestN >= 2 ? best : ""; // require a repeat to call it "recurring"
}

/**
 * Derive a small honest pattern summary from recent check-ins + any explicit
 * boundaries the user chose. Only claims a recurring trigger/emotion when it
 * repeats (>=2). The arc mirrors the route's newest-3-vs-rest comparison.
 */
export function buildEmotionalPatternSummary(
  moods: MoodRow[],
  boundaries: string[] = [],
): EmotionalPatternSummary {
  const arc: EmotionalPatternSummary["arc"] = (() => {
    if (moods.length < 4) return "unknown";
    const nums = moods.map((m) => m.mood_score ?? 0);
    const recent = nums.slice(0, 3).reduce((s, n) => s + n, 0) / 3;
    const before = nums.slice(3).reduce((s, n) => s + n, 0) / (nums.length - 3);
    if (recent - before > 0.8) return "lifting";
    if (before - recent > 0.8) return "heavier";
    return "steady";
  })();
  return {
    recurring_trigger: topTag(moods, "trigger_tags"),
    common_emotion: topTag(moods, "emotion_tags"),
    arc,
    boundaries: boundaries.filter(Boolean).slice(0, 3),
    sampleSize: moods.length,
  };
}
