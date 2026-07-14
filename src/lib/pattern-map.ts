/**
 * pattern-map — the pure math behind the Insights observatory.
 *
 * Everything here is computed from real check-ins; nothing is invented.
 * The route renders what these functions return, so the visual rules the
 * redesign promises (node size = frequency, glow = recency, line thickness =
 * co-occurrence strength, centre = strongest connected pattern, positions
 * never random) are all decided here, deterministically, and covered by
 * tests in __tests__/pattern-map.test.ts.
 */

export type MoodEntry = {
  created_at: string;
  mood_score: number | null;
  emotion_tags?: string[] | null;
  trigger_tags?: string[] | null;
  note?: string | null;
};

export type Period = "week" | "month" | "quarter" | "all";

export const PERIOD_DAYS: Record<Period, number | null> = {
  week: 7,
  month: 30,
  quarter: 90,
  all: null,
};

export const PERIOD_LABEL: Record<Period, string> = {
  week: "This week",
  month: "Last 30 days",
  quarter: "Last 90 days",
  all: "All history",
};

/** Check-ins inside the selected period, newest first. */
export function filterByPeriod(moods: MoodEntry[], period: Period, now = Date.now()): MoodEntry[] {
  const days = PERIOD_DAYS[period];
  if (days == null) return [...moods];
  const cutoff = now - days * 86400000;
  return moods.filter((m) => new Date(m.created_at).getTime() >= cutoff);
}

/* ── Data sufficiency (the brief's honesty ladder) ── */

export type Confidence =
  | { level: "insufficient"; label: string; needed: number }
  | { level: "early" | "tentative" | "emerging" | "established"; label: string; needed: 0 };

export function confidenceFor(checkinCount: number): Confidence {
  if (checkinCount < 3) return { level: "insufficient", label: "Just beginning", needed: 3 - checkinCount };
  if (checkinCount <= 5) return { level: "early", label: "Early signal", needed: 0 };
  if (checkinCount <= 10) return { level: "tentative", label: "Tentative pattern", needed: 0 };
  if (checkinCount <= 20) return { level: "emerging", label: "Emerging pattern", needed: 0 };
  return { level: "established", label: "Recurring pattern", needed: 0 };
}

/* ── Frequency status (no vague Low/Medium/High) ── */

export function statusFor(count: number): "Frequent" | "Occasional" | "Emerging" {
  if (count >= 4) return "Frequent";
  if (count >= 2) return "Occasional";
  return "Emerging";
}

/* ── Tag counting + co-occurrence ── */

export type TagKind = "emotion" | "trigger";
export type TagStat = {
  label: string;
  kind: TagKind;
  count: number;
  /** days since this tag last appeared (0 = today) */
  lastSeenDays: number;
};

function tagsOf(m: MoodEntry): { label: string; kind: TagKind }[] {
  return [
    ...(m.emotion_tags ?? []).map((label) => ({ label, kind: "emotion" as const })),
    ...(m.trigger_tags ?? []).map((label) => ({ label, kind: "trigger" as const })),
  ];
}

export function tagStats(moods: MoodEntry[], now = Date.now()): TagStat[] {
  const map = new Map<string, TagStat>();
  for (const m of moods) {
    const days = Math.max(0, Math.floor((now - new Date(m.created_at).getTime()) / 86400000));
    for (const t of tagsOf(m)) {
      const cur = map.get(t.label);
      if (cur) {
        cur.count += 1;
        cur.lastSeenDays = Math.min(cur.lastSeenDays, days);
      } else {
        map.set(t.label, { label: t.label, kind: t.kind, count: 1, lastSeenDays: days });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** How often two tags were named in the SAME check-in. Key "A|B" with A<B. */
export function cooccurrence(moods: MoodEntry[]): Map<string, number> {
  const co = new Map<string, number>();
  for (const m of moods) {
    const labels = [...new Set(tagsOf(m).map((t) => t.label))].sort();
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const key = `${labels[i]}|${labels[j]}`;
        co.set(key, (co.get(key) ?? 0) + 1);
      }
    }
  }
  return co;
}

export function coBetween(co: Map<string, number>, a: string, b: string): number {
  return co.get(a < b ? `${a}|${b}` : `${b}|${a}`) ?? 0;
}

/* ── The constellation itself ── */

export type MapNode = TagStat & {
  x: number; // 0..100
  y: number; // 0..100
  /** 0..1 — frequency relative to the strongest node */
  weight: number;
  /** 0..1 — recency (1 = seen today) */
  glow: number;
  /** co-occurrence count with the centre node (0 for the centre itself) */
  linkToCenter: number;
};

export type MapEdge = { a: string; b: string; strength: number };

export type Constellation = {
  center: MapNode | null;
  ring: MapNode[];
  edges: MapEdge[];
  checkinCount: number;
  confidence: Confidence;
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Centre = the emotion with the highest total co-occurrence to everything
 * else (the most CONNECTED pattern, per the brief), tie-broken by frequency.
 * Ring = up to `ringSize` other tags ranked by (link to centre, then count).
 * Positions are deterministic: ring nodes sit on a circle ordered by rank,
 * radius pulled slightly inward for stronger links, with a small stable
 * jitter from the label hash so the sky doesn't look mechanical.
 */
export function buildConstellation(
  moods: MoodEntry[],
  opts: { hidden?: string[]; ringSize?: number; now?: number } = {},
): Constellation {
  const now = opts.now ?? Date.now();
  const hidden = new Set((opts.hidden ?? []).map((h) => h.toLowerCase()));
  const ringSize = opts.ringSize ?? 6;

  const stats = tagStats(moods, now).filter((t) => !hidden.has(t.label.toLowerCase()));
  const co = cooccurrence(moods);
  const checkinCount = moods.length;
  const confidence = confidenceFor(checkinCount);

  if (stats.length === 0 || confidence.level === "insufficient") {
    return { center: null, ring: [], edges: [], checkinCount, confidence };
  }

  const connectedness = (label: string) =>
    stats.reduce((sum, other) => (other.label === label ? sum : sum + coBetween(co, label, other.label)), 0);

  // Prefer an emotion at the centre; fall back to the top tag of any kind.
  const emotions = stats.filter((s) => s.kind === "emotion");
  const centerPool = emotions.length ? emotions : stats;
  const centerStat = [...centerPool].sort(
    (a, b) => connectedness(b.label) - connectedness(a.label) || b.count - a.count || a.label.localeCompare(b.label),
  )[0];

  const maxCount = stats[0].count;
  const periodSpanDays = Math.max(
    1,
    ...moods.map((m) => Math.floor((now - new Date(m.created_at).getTime()) / 86400000) + 1),
  );
  const toNode = (s: TagStat, x: number, y: number, linkToCenter: number): MapNode => ({
    ...s,
    x,
    y,
    weight: s.count / maxCount,
    glow: Math.max(0.2, 1 - s.lastSeenDays / periodSpanDays),
    linkToCenter,
  });

  const center = toNode(centerStat, 50, 46, 0);

  const ringStats = stats
    .filter((s) => s.label !== centerStat.label)
    .sort((a, b) => {
      const la = coBetween(co, centerStat.label, a.label);
      const lb = coBetween(co, centerStat.label, b.label);
      return lb - la || b.count - a.count || a.label.localeCompare(b.label);
    })
    .slice(0, ringSize);

  const maxLink = Math.max(1, ...ringStats.map((s) => coBetween(co, centerStat.label, s.label)));
  const ring = ringStats.map((s, i) => {
    const link = coBetween(co, centerStat.label, s.label);
    // Rank walks the circle from the top; stronger links sit closer in.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(3, ringStats.length);
    const jitter = ((hashStr(s.label) % 100) / 100 - 0.5) * 0.18; // ±0.09 rad, stable
    const radius = 34 - (link / maxLink) * 9; // 25..34
    const x = 50 + Math.cos(angle + jitter) * radius;
    const y = 46 + Math.sin(angle + jitter) * radius * 0.82; // slightly flattened sky
    return toNode(s, Math.min(92, Math.max(8, x)), Math.min(84, Math.max(12, y)), link);
  });

  // Edges: centre→ring where they truly co-occurred, plus the few strongest
  // ring↔ring ties (≥2 shared check-ins) so real clusters become visible
  // without turning into a hairball.
  const edges: MapEdge[] = ring
    .filter((n) => n.linkToCenter > 0)
    .map((n) => ({ a: center.label, b: n.label, strength: n.linkToCenter }));
  const cross: MapEdge[] = [];
  for (let i = 0; i < ring.length; i++) {
    for (let j = i + 1; j < ring.length; j++) {
      const s = coBetween(co, ring[i].label, ring[j].label);
      if (s >= 2) cross.push({ a: ring[i].label, b: ring[j].label, strength: s });
    }
  }
  cross.sort((a, b) => b.strength - a.strength);
  edges.push(...cross.slice(0, 4));

  return { center, ring, edges, checkinCount, confidence };
}

/* ── Time-of-day rhythm for one tag or the whole period ── */

export const TOD_LABELS = ["Morning", "Midday", "Evening", "Night"] as const;
export type TodLabel = (typeof TOD_LABELS)[number];

export function todOf(iso: string): TodLabel {
  const h = new Date(iso).getHours();
  if (h < 6) return "Night";
  if (h < 12) return "Morning";
  if (h < 18) return "Midday";
  return "Evening";
}

export function timeOfDayFor(moods: MoodEntry[], tag?: string): Record<TodLabel, number> {
  const out: Record<TodLabel, number> = { Morning: 0, Midday: 0, Evening: 0, Night: 0 };
  for (const m of moods) {
    if (tag && !tagsOf(m).some((t) => t.label === tag)) continue;
    out[todOf(m.created_at)] += 1;
  }
  return out;
}

export function peakTod(tod: Record<TodLabel, number>): { label: TodLabel; count: number } | null {
  const entries = TOD_LABELS.map((l) => ({ label: l, count: tod[l] }));
  const best = entries.sort((a, b) => b.count - a.count)[0];
  return best && best.count > 0 ? best : null;
}

/* ── Supporting moments for a selected node ── */

export function momentsFor(moods: MoodEntry[], tag: string, limit = 4): MoodEntry[] {
  return moods.filter((m) => tagsOf(m).some((t) => t.label === tag)).slice(0, limit);
}

/* ── Timeline ── */

export type TimelinePoint = {
  iso: string;
  score: number;
  emotions: string[];
  triggers: string[];
  note: string | null;
};

export function timelinePoints(moods: MoodEntry[], filterTag?: string): TimelinePoint[] {
  return moods
    .filter((m) => m.mood_score != null)
    .filter((m) => !filterTag || tagsOf(m).some((t) => t.label === filterTag))
    .map((m) => ({
      iso: m.created_at,
      score: m.mood_score as number,
      emotions: m.emotion_tags ?? [],
      triggers: m.trigger_tags ?? [],
      note: m.note ?? null,
    }))
    .sort((a, b) => a.iso.localeCompare(b.iso));
}

/**
 * Plain-language summary of the visible timeline. Compares the mean weight of
 * the first and second half (needs ≥4 points to say anything directional) and
 * names the heaviest time of day when one exists. Never fills gaps.
 */
export function timelineSummary(points: TimelinePoint[], moods: MoodEntry[]): string {
  if (points.length === 0) return "No check-ins in this period yet.";
  if (points.length < 4) {
    return `${points.length} ${points.length === 1 ? "moment" : "moments"} in this period — a few more and a direction may appear.`;
  }
  const half = Math.floor(points.length / 2);
  const mean = (xs: TimelinePoint[]) => xs.reduce((a, p) => a + p.score, 0) / xs.length;
  const first = mean(points.slice(0, half));
  const second = mean(points.slice(half));
  const delta = second - first;
  const direction =
    delta > 0.7 ? "Your recent check-ins became lighter over this period"
    : delta < -0.7 ? "Your recent check-ins grew heavier over this period"
    : "Your check-ins held fairly steady over this period";
  const heavy = moods.filter((m) => (m.mood_score ?? 10) <= 4);
  const peak = peakTod(timeOfDayFor(heavy));
  const todPart = peak ? `, with the heavier moments most often around ${peak.label.toLowerCase()}` : "";
  return `${direction}${todPart}.`;
}

/* ── Structured InnerMate handoff ── */

export function innermateContext(c: Constellation, moods: MoodEntry[], periodLabel: string): string {
  if (!c.center) return "I'd like to look at my check-in patterns together.";
  const linked = c.ring.filter((n) => n.linkToCenter > 0).slice(0, 2);
  const alongside = linked.length
    ? ` It appeared alongside ${linked.map((n) => n.label.toLowerCase()).join(" and ")}.`
    : "";
  const peak = peakTod(timeOfDayFor(moods, c.center.label));
  const when = peak ? ` It tended to occur in the ${peak.label.toLowerCase()}.` : "";
  return (
    `I've been looking at my patterns (${periodLabel.toLowerCase()}, ${c.checkinCount} check-ins — ${c.confidence.label.toLowerCase()}). ` +
    `${c.center.label} came up ${c.center.count} ${c.center.count === 1 ? "time" : "times"}.${alongside}${when} ` +
    `Would you help me understand what usually happens in those moments, or what might help next?`
  );
}
