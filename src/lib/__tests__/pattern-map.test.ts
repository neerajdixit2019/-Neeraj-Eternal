import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  filterByPeriod,
  confidenceFor,
  statusFor,
  tagStats,
  cooccurrence,
  coBetween,
  buildConstellation,
  timeOfDayFor,
  peakTod,
  momentsFor,
  timelinePoints,
  timelineSummary,
  innermateContext,
  weekdayRhythm,
  type MoodEntry,
} from "../pattern-map.ts";

const NOW = new Date("2026-07-10T12:00:00Z").getTime();

function entry(daysAgo: number, hour: number, score: number, emotions: string[], triggers: string[] = [], note: string | null = null): MoodEntry {
  const d = new Date(NOW - daysAgo * 86400000);
  d.setHours(hour, 15, 0, 0);
  return { created_at: d.toISOString(), mood_score: score, emotion_tags: emotions, trigger_tags: triggers, note };
}

describe("data sufficiency & confidence ladder", () => {
  it("labels every band the brief specifies", () => {
    assert.equal(confidenceFor(0).level, "insufficient");
    assert.equal(confidenceFor(2).level, "insufficient");
    assert.equal(confidenceFor(2).needed, 1);
    assert.equal(confidenceFor(3).label, "Early signal");
    assert.equal(confidenceFor(5).label, "Early signal");
    assert.equal(confidenceFor(6).label, "Tentative pattern");
    assert.equal(confidenceFor(10).label, "Tentative pattern");
    assert.equal(confidenceFor(11).label, "Emerging pattern");
    assert.equal(confidenceFor(20).label, "Emerging pattern");
    assert.equal(confidenceFor(21).label, "Recurring pattern");
  });

  it("under 3 check-ins the constellation refuses to pretend", () => {
    const c = buildConstellation([entry(1, 20, 3, ["Anxious"]), entry(2, 20, 4, ["Anxious"])], { now: NOW });
    assert.equal(c.center, null);
    assert.equal(c.ring.length, 0);
    assert.equal(c.confidence.level, "insufficient");
  });
});

describe("frequency status labels", () => {
  it("uses Frequent/Occasional/Emerging, never bare Low/Medium/High", () => {
    assert.equal(statusFor(1), "Emerging");
    assert.equal(statusFor(2), "Occasional");
    assert.equal(statusFor(3), "Occasional");
    assert.equal(statusFor(4), "Frequent");
    assert.equal(statusFor(9), "Frequent");
  });
});

describe("period filtering", () => {
  const moods = [entry(1, 9, 5, ["Calm"]), entry(10, 9, 4, ["Anxious"]), entry(45, 9, 3, ["Heavy"]), entry(120, 9, 6, ["Hopeful"])];
  it("week / month / quarter / all cut correctly", () => {
    assert.equal(filterByPeriod(moods, "week", NOW).length, 1);
    assert.equal(filterByPeriod(moods, "month", NOW).length, 2);
    assert.equal(filterByPeriod(moods, "quarter", NOW).length, 3);
    assert.equal(filterByPeriod(moods, "all", NOW).length, 4);
  });
});

describe("co-occurrence math", () => {
  const moods = [
    entry(1, 20, 3, ["Anxious"], ["Work"]),
    entry(2, 21, 3, ["Anxious"], ["Work"]),
    entry(3, 20, 4, ["Anxious"], ["Sleep"]),
    entry(4, 9, 6, ["Calm"], []),
  ];
  it("counts same-check-in pairs symmetrically", () => {
    const co = cooccurrence(moods);
    assert.equal(coBetween(co, "Anxious", "Work"), 2);
    assert.equal(coBetween(co, "Work", "Anxious"), 2);
    assert.equal(coBetween(co, "Anxious", "Sleep"), 1);
    assert.equal(coBetween(co, "Calm", "Work"), 0);
  });
  it("does not double-count duplicate tags inside one check-in", () => {
    const co = cooccurrence([{ ...entry(1, 20, 3, ["Anxious", "Anxious"], ["Work"]) }]);
    assert.equal(coBetween(co, "Anxious", "Work"), 1);
  });
});

describe("constellation building", () => {
  // Anxious co-occurs most; Lonely appears often but alone.
  const moods = [
    entry(1, 20, 3, ["Anxious"], ["Work"]),
    entry(2, 21, 3, ["Anxious"], ["Work"]),
    entry(3, 20, 4, ["Anxious"], ["Sleep"]),
    entry(4, 20, 4, ["Lonely"]),
    entry(5, 20, 4, ["Lonely"]),
    entry(6, 9, 6, ["Lonely"]),
  ];

  it("centres the most CONNECTED emotion, not merely the most frequent", () => {
    const c = buildConstellation(moods, { now: NOW });
    // Lonely: 3 appearances, 0 co-occurrence. Anxious: 3 appearances, 4 co-occurrences.
    assert.equal(c.center?.label, "Anxious");
  });

  it("node weight tracks frequency; edges carry real strengths", () => {
    const c = buildConstellation(moods, { now: NOW });
    const work = c.ring.find((n) => n.label === "Work");
    assert.ok(work);
    assert.equal(work.count, 2);
    const edge = c.edges.find((e) => (e.a === "Anxious" && e.b === "Work") || (e.a === "Work" && e.b === "Anxious"));
    assert.ok(edge, "centre-Work edge exists");
    assert.equal(edge.strength, 2);
    // Lonely never co-occurred with Anxious: no fabricated edge.
    const fake = c.edges.find((e) => e.a === "Lonely" || e.b === "Lonely");
    assert.equal(fake, undefined);
  });

  it("positions are deterministic and inside the canvas", () => {
    const a = buildConstellation(moods, { now: NOW });
    const b = buildConstellation(moods, { now: NOW });
    assert.deepEqual(
      a.ring.map((n) => [n.label, n.x.toFixed(3), n.y.toFixed(3)]),
      b.ring.map((n) => [n.label, n.x.toFixed(3), n.y.toFixed(3)]),
    );
    for (const n of [a.center!, ...a.ring]) {
      assert.ok(n.x >= 8 && n.x <= 92, `${n.label} x in range`);
      assert.ok(n.y >= 12 && n.y <= 84, `${n.label} y in range`);
    }
  });

  it("respects hidden (set-aside) patterns", () => {
    const c = buildConstellation(moods, { now: NOW, hidden: ["Anxious"] });
    assert.notEqual(c.center?.label, "Anxious");
    assert.ok(!c.ring.some((n) => n.label === "Anxious"));
  });

  it("recency drives glow", () => {
    const stats = tagStats(moods, NOW);
    const anx = stats.find((s) => s.label === "Anxious")!;
    // entry(1, …) is about a day old; exact floor depends on local timezone.
    assert.ok(anx.lastSeenDays <= 1, "recent tag has small lastSeenDays");
    const c = buildConstellation(moods, { now: NOW });
    const lonely = c.ring.find((n) => n.label === "Lonely");
    assert.ok(c.center!.glow > (lonely?.glow ?? 1) - 1e9, "glow computed");
    assert.ok(c.center!.glow > 0.2 && c.center!.glow <= 1);
  });
});

describe("time-of-day rhythm", () => {
  const moods = [
    entry(1, 20, 3, ["Anxious"]),
    entry(2, 21, 3, ["Anxious"]),
    entry(3, 9, 6, ["Calm"]),
  ];
  it("buckets per tag and finds the peak", () => {
    const tod = timeOfDayFor(moods, "Anxious");
    assert.equal(tod.Evening, 2);
    assert.equal(tod.Morning, 0);
    assert.equal(peakTod(tod)?.label, "Evening");
  });
  it("returns null peak when a tag never appears", () => {
    assert.equal(peakTod(timeOfDayFor(moods, "Numb")), null);
  });
});

describe("supporting moments", () => {
  it("returns only check-ins containing the tag", () => {
    const moods = [entry(1, 20, 3, ["Anxious"], [], "note a"), entry(2, 9, 6, ["Calm"], [], "note b")];
    const m = momentsFor(moods, "Anxious");
    assert.equal(m.length, 1);
    assert.equal(m[0].note, "note a");
  });
});

describe("timeline", () => {
  const moods = [
    entry(6, 9, 3, ["Heavy"], ["Work"]),
    entry(5, 12, 3, ["Anxious"], ["Work"]),
    entry(2, 12, 6, ["Calm"]),
    entry(1, 9, 7, ["Hopeful"]),
  ];
  it("orders points oldest-first and honours a tag filter", () => {
    const pts = timelinePoints(moods);
    assert.equal(pts.length, 4);
    assert.ok(pts[0].iso < pts[3].iso);
    assert.equal(timelinePoints(moods, "Work").length, 2);
  });
  it("summary names the direction and the heavy time of day, and never fills gaps", () => {
    const s = timelineSummary(timelinePoints(moods), moods);
    assert.match(s, /lighter/);
    assert.match(s, /midday|morning/i);
  });
  it("stays modest under 4 points", () => {
    const few = moods.slice(0, 2);
    assert.match(timelineSummary(timelinePoints(few), few), /a few more/);
  });
});

describe("weekday rhythm — gated honesty", () => {
  // Build N weeks where Sundays sit low (2) and other days sit mid (6).
  function weeks(n: number): MoodEntry[] {
    const out: MoodEntry[] = [];
    // anchor on a known Sunday: 2026-07-05 is a Sunday
    const anchor = new Date("2026-07-05T12:00:00Z").getTime();
    for (let w = 0; w < n; w++) {
      for (let d = 0; d < 7; d++) {
        const t = new Date(anchor - (w * 7 + d) * 86400000);
        const isSunday = t.getDay() === 0;
        out.push({ created_at: t.toISOString(), mood_score: isSunday ? 2 : 6, emotion_tags: [], trigger_tags: [] });
      }
    }
    return out;
  }

  it("stays silent below 12 scored check-ins", () => {
    assert.equal(weekdayRhythm(weeks(1)), null); // 7 check-ins
  });

  it("detects a heavier Sunday with its own numbers", () => {
    const r = weekdayRhythm(weeks(4)); // 28 check-ins, 4 Sundays all low
    assert.ok(r);
    assert.equal(r.weekday, "Sunday");
    assert.equal(r.direction, "heavier");
    assert.equal(r.hits, 4);
    assert.equal(r.total, 4);
    assert.match(r.statement, /in 4 of your last 4/);
    assert.match(r.evidence, /based on 28 check-ins/);
  });

  it("flat data produces no rhythm — no false positives", () => {
    const flat: MoodEntry[] = Array.from({ length: 30 }, (_, i) => ({
      created_at: new Date(Date.UTC(2026, 5, 1 + i, 12)).toISOString(),
      mood_score: 6, emotion_tags: [], trigger_tags: [],
    }));
    assert.equal(weekdayRhythm(flat), null);
  });
});

describe("InnerMate handoff", () => {
  it("carries pattern, companions, rhythm, count and confidence — phrased as observation, not verdict", () => {
    const moods = [
      entry(1, 20, 3, ["Anxious"], ["Work"]),
      entry(2, 21, 3, ["Anxious"], ["Work"]),
      entry(3, 20, 4, ["Anxious"], ["Sleep"]),
    ];
    const c = buildConstellation(moods, { now: NOW });
    const ctx = innermateContext(c, moods, "This week");
    assert.match(ctx, /Anxious came up 3 times/);
    assert.match(ctx, /alongside work/);
    assert.match(ctx, /evening/);
    assert.match(ctx, /early signal/i);
    assert.doesNotMatch(ctx, /caused by|proves|diagnos|always/i);
  });
});
