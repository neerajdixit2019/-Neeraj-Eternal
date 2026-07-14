/**
 * insight-events — the unified insight data layer.
 *
 * Every relevant thing the user intentionally does in the app (check-ins,
 * journal pages, kept memories, InnerMate messages) is converted AT READ TIME
 * into one consistent InsightEvent shape. Nothing derived is ever stored:
 * originals stay untouched, deleted sources vanish from insights automatically,
 * there is no backfill to run and no stale summary to invalidate.
 *
 * Honesty rules enforced here, deterministically and under test:
 *  - assistant text is never analysed — user-authored content only
 *  - safety-flagged messages (risk_label "support"/"crisis") never become
 *    pattern evidence; the safety system stays separate
 *  - chat inference is LEXICON-based (transparent word matching), always
 *    marked method:"inferred" and never presented with the same confidence
 *    as tags the user selected by hand (method:"selected")
 *  - one emotional episode = one event: many messages in the same
 *    conversation within a 90-minute window count once, not twenty times
 */

export type InsightSource = "daily_checkin" | "journal" | "memory" | "innermate_chat";

export const SOURCE_LABEL: Record<InsightSource, string> = {
  daily_checkin: "check-ins",
  journal: "journal",
  memory: "memories",
  innermate_chat: "chats",
};

export type InsightEvent = {
  /** stable id derived from the source record (idempotent by construction) */
  id: string;
  source: InsightSource;
  sourceId: string;
  created_at: string;
  emotions: string[];
  triggers: string[];
  /** 1–10 emotional weight when the source records one (check-ins) */
  weight: number | null;
  /** short excerpt for "why am I seeing this" — never the full text */
  excerpt: string | null;
  /** selected = the user chose these words; inferred = matched from their writing */
  method: "selected" | "inferred";
};

/* ── Deterministic lexicon (transparent, no model) ──
   Word-boundary matching over user-authored text. Vocabulary deliberately
   reuses the app's existing tag names so chat evidence merges with check-in
   evidence, plus two cognitive patterns from the reference boards. */

const EMOTION_LEXICON: Record<string, RegExp> = {
  Anxious: /\b(anxious|anxiety|panick?y?|panicking|worried|worrying|nervous|on edge|dread)\b/i,
  Heavy: /\b(sad|heavy[- ]?hearted|down lately|miserable|crying|cried|tearful|grief|grieving)\b/i,
  Lonely: /\b(lonely|loneliness|isolated|left out|no one (?:to talk|understands|cares))\b/i,
  Angry: /\b(angry|furious|rage|resent(?:ful|ment)?|fed up)\b/i,
  Overwhelmed: /\b(overwhelmed|too much at once|drowning in|can'?t cope|burn(?:ed|t)? out)\b/i,
  Numb: /\b(numb|feel nothing|feel empty|emptiness)\b/i,
  Confused: /\b(confused|torn between|can'?t decide|don'?t know what to)\b/i,
  Calm: /\b(calm(?:er)?|at peace|peaceful|settled down)\b/i,
  Hopeful: /\b(hopeful|feeling better|looking forward|lighter today)\b/i,
  Grateful: /\b(grateful|thankful|gratitude)\b/i,
  Overthinking: /\b(overthink(?:ing)?|can'?t stop thinking|replaying|ruminating|spirall?ing|racing thoughts)\b/i,
  "Self-criticism": /\b(hate myself|not good enough|i'?m (?:such )?a failure|my own fault|beat(?:ing)? myself up|stupid of me)\b/i,
};

const TRIGGER_LEXICON: Record<string, RegExp> = {
  Work: /\b(work|job|boss|deadline|office|colleague|project|career|interview)\b/i,
  Relationship: /\b(relationship|partner|boyfriend|girlfriend|breakup|broke up|dating|crush|marriage)\b/i,
  Family: /\b(family|mom|mum|dad|mother|father|parents|brother|sister)\b/i,
  Money: /\b(money|rent|salary|debt|bills|finances|broke)\b/i,
  Health: /\b(health|sick|illness|pain|doctor|hospital)\b/i,
  Sleep: /\b(sleep|slept|insomnia|awake at night|sleepless|3 ?am)\b/i,
  Memories: /\b(the past|old memories|nostalgia|remember when|miss(?:ing)? (?:him|her|them|those days))\b/i,
  Future: /\b(future|what if|uncertain(?:ty)?|unknown ahead)\b/i,
};

export function extractFromText(text: string): { emotions: string[]; triggers: string[] } {
  const emotions: string[] = [];
  const triggers: string[] = [];
  for (const [label, rx] of Object.entries(EMOTION_LEXICON)) if (rx.test(text)) emotions.push(label);
  for (const [label, rx] of Object.entries(TRIGGER_LEXICON)) if (rx.test(text)) triggers.push(label);
  return { emotions, triggers };
}

/* ── Source rows (narrow views of the real tables) ── */

export type CheckinRow = { id: string; created_at: string; mood_score: number | null; emotion_tags?: string[] | null; trigger_tags?: string[] | null; note?: string | null };
export type JournalRow = { id: string; created_at: string; title?: string | null; body?: string | null; emotion_tags?: string[] | null };
export type MemoryRow = { id: string; created_at: string; memory_date?: string | null; title?: string | null; story?: string | null; feeling_tag?: string | null };
export type ChatMessageRow = { id: string; conversation_id: string; created_at: string; role: string; content: string; risk_label?: string | null };

const clip = (s: string | null | undefined, n = 90) => {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  return t ? (t.length > n ? `${t.slice(0, n - 1)}…` : t) : null;
};

/* ── Per-source converters ── */

export function eventsFromCheckins(rows: CheckinRow[]): InsightEvent[] {
  return rows.map((r) => ({
    id: `checkin:${r.id}`,
    source: "daily_checkin",
    sourceId: r.id,
    created_at: r.created_at,
    emotions: r.emotion_tags ?? [],
    triggers: r.trigger_tags ?? [],
    weight: r.mood_score ?? null,
    excerpt: clip(r.note),
    method: "selected",
  }));
}

export function eventsFromJournal(rows: JournalRow[]): InsightEvent[] {
  return rows
    .filter((r) => (r.emotion_tags?.length ?? 0) > 0) // only pages the user tagged
    .map((r) => ({
      id: `journal:${r.id}`,
      source: "journal",
      sourceId: r.id,
      created_at: r.created_at,
      emotions: r.emotion_tags ?? [],
      triggers: [],
      weight: null,
      excerpt: clip(r.title || r.body),
      method: "selected",
    }));
}

export function eventsFromMemories(rows: MemoryRow[]): InsightEvent[] {
  return rows
    .filter((r) => !!r.feeling_tag)
    .map((r) => ({
      id: `memory:${r.id}`,
      source: "memory",
      sourceId: r.id,
      created_at: r.created_at,
      emotions: [r.feeling_tag as string],
      triggers: [],
      weight: null,
      excerpt: clip(r.title || r.story),
      method: "selected",
    }));
}

/**
 * Chat → events. User-authored, non-safety messages only; grouped into
 * emotional episodes (same conversation, ≤ episodeGapMin between messages);
 * each episode yields at most ONE event carrying the union of matches.
 * Episodes with no lexicon hits produce nothing — silence is not data.
 */
export function eventsFromChat(rows: ChatMessageRow[], episodeGapMin = 90): InsightEvent[] {
  const user = rows
    .filter((m) => m.role === "user")
    .filter((m) => !m.risk_label) // "support"/"crisis" stay with the safety system
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  type Episode = { convId: string; first: ChatMessageRow; last: string; texts: string[] };
  const episodes: Episode[] = [];
  for (const m of user) {
    const cur = episodes[episodes.length - 1];
    const gapOk = cur && cur.convId === m.conversation_id &&
      new Date(m.created_at).getTime() - new Date(cur.last).getTime() <= episodeGapMin * 60000;
    if (gapOk) {
      cur.texts.push(m.content);
      cur.last = m.created_at;
    } else {
      episodes.push({ convId: m.conversation_id, first: m, last: m.created_at, texts: [m.content] });
    }
  }

  const out: InsightEvent[] = [];
  for (const ep of episodes) {
    const emotions = new Set<string>();
    const triggers = new Set<string>();
    let excerpt: string | null = null;
    for (const text of ep.texts) {
      const hit = extractFromText(text);
      if (!excerpt && (hit.emotions.length || hit.triggers.length)) excerpt = clip(text);
      hit.emotions.forEach((e) => emotions.add(e));
      hit.triggers.forEach((t) => triggers.add(t));
    }
    if (emotions.size === 0 && triggers.size === 0) continue;
    out.push({
      id: `chat:${ep.first.id}`,
      source: "innermate_chat",
      sourceId: ep.first.conversation_id,
      created_at: ep.first.created_at,
      emotions: [...emotions],
      triggers: [...triggers],
      weight: null,
      excerpt,
      method: "inferred",
    });
  }
  return out;
}

/* ── Merge + evidence mix ── */

export function mergeEvents(...groups: InsightEvent[][]): InsightEvent[] {
  const seen = new Set<string>();
  const out: InsightEvent[] = [];
  for (const g of groups) for (const e of g) {
    if (seen.has(e.id)) continue; // idempotent by construction
    seen.add(e.id);
    out.push(e);
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export type SourceMix = Partial<Record<InsightSource, number>>;

/** How many events per source mention a tag — the node's evidence mix. */
export function sourceMixFor(events: InsightEvent[], tag: string): SourceMix {
  const mix: SourceMix = {};
  for (const e of events) {
    if (e.emotions.includes(tag) || e.triggers.includes(tag)) {
      mix[e.source] = (mix[e.source] ?? 0) + 1;
    }
  }
  return mix;
}

export function describeMix(mix: SourceMix): string {
  const order: InsightSource[] = ["daily_checkin", "innermate_chat", "journal", "memory"];
  return order
    .filter((s) => (mix[s] ?? 0) > 0)
    .map((s) => `${mix[s]} ${SOURCE_LABEL[s]}`)
    .join(" · ");
}

/** Distinct sources supporting a tag — cross-source corroboration. */
export function sourceCount(mix: SourceMix): number {
  return Object.values(mix).filter((n) => (n ?? 0) > 0).length;
}

/** Whether a tag rests only on inferred (chat) evidence — shown honestly in UI. */
export function isInferredOnly(events: InsightEvent[], tag: string): boolean {
  let any = false;
  for (const e of events) {
    if (e.emotions.includes(tag) || e.triggers.includes(tag)) {
      any = true;
      if (e.method === "selected") return false;
    }
  }
  return any;
}

/** Adapter: events → the MoodEntry shape pattern-map already understands. */
export function toMoodEntries(events: InsightEvent[]): {
  created_at: string; mood_score: number | null;
  emotion_tags: string[]; trigger_tags: string[]; note: string | null;
}[] {
  return events.map((e) => ({
    created_at: e.created_at,
    mood_score: e.weight,
    emotion_tags: e.emotions,
    trigger_tags: e.triggers,
    note: e.excerpt,
  }));
}

/* ── "What is changing" — honest positive-progress signals ── */

export type ChangeSignal = { text: string; evidence: string };

/**
 * Only signals with real evidence: weight trend needs ≥3 scored events per
 * half; practice cadence compares distinct active days. No claims of "helped".
 */
export function changeSignals(events: InsightEvent[], now = Date.now()): ChangeSignal[] {
  const out: ChangeSignal[] = [];
  const scored = events.filter((e) => e.weight != null).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (scored.length >= 6) {
    const half = Math.floor(scored.length / 2);
    const mean = (xs: InsightEvent[]) => xs.reduce((a, e) => a + (e.weight as number), 0) / xs.length;
    const delta = mean(scored.slice(half)) - mean(scored.slice(0, half));
    if (delta >= 0.8) {
      out.push({
        text: "Your check-ins have been arriving lighter than they did earlier in this period.",
        evidence: `mean weight moved from ${mean(scored.slice(0, half)).toFixed(1)} to ${mean(scored.slice(half)).toFixed(1)} across ${scored.length} check-ins`,
      });
    }
  }
  const weekAgo = now - 7 * 86400000;
  const prevWeek = now - 14 * 86400000;
  const days = (from: number, to: number) =>
    new Set(events.filter((e) => { const t = new Date(e.created_at).getTime(); return t >= from && t < to; })
      .map((e) => e.created_at.slice(0, 10))).size;
  const thisWeek = days(weekAgo, now + 1);
  const lastWeek = days(prevWeek, weekAgo);
  if (thisWeek >= lastWeek + 2 && thisWeek >= 3) {
    out.push({
      text: "You've been showing up for yourself more often this week.",
      evidence: `${thisWeek} active days this week vs ${lastWeek} the week before`,
    });
  }
  const grate = events.filter((e) => e.emotions.some((x) => x === "Grateful" || x === "Hopeful"));
  if (grate.length >= 3) {
    const recent = grate.filter((e) => new Date(e.created_at).getTime() >= now - 14 * 86400000).length;
    if (recent >= 2) {
      out.push({
        text: "Gratitude and hope have kept appearing in what you've named recently.",
        evidence: `${recent} moments in the last two weeks`,
      });
    }
  }
  return out;
}
