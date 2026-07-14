import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractFromText,
  eventsFromCheckins,
  eventsFromJournal,
  eventsFromMemories,
  eventsFromChat,
  mergeEvents,
  sourceMixFor,
  describeMix,
  sourceCount,
  isInferredOnly,
  toMoodEntries,
  changeSignals,
  skyReading,
  type ChatMessageRow,
} from "../insight-events.ts";

const T0 = new Date("2026-07-10T10:00:00Z").getTime();
const iso = (minOffset: number) => new Date(T0 + minOffset * 60000).toISOString();

function msg(id: string, conv: string, minOffset: number, role: string, content: string, risk: string | null = null): ChatMessageRow {
  return { id, conversation_id: conv, created_at: iso(minOffset), role, content, risk_label: risk };
}

describe("lexicon extraction (chat intelligence, deterministic)", () => {
  it("finds emotions and triggers with word boundaries", () => {
    const r = extractFromText("I'm anxious about a work deadline and I can't stop thinking about it.");
    assert.ok(r.emotions.includes("Anxious"));
    assert.ok(r.emotions.includes("Overthinking"));
    assert.ok(r.triggers.includes("Work"));
  });
  it("a fear statement becomes a signal, never a verdict — and matching is not substring-sloppy", () => {
    // "workshop" must not match Work's \bwork\b... it does ("work" prefix)? \bwork\b won't match "workshop" (no boundary after k). Verify:
    const r = extractFromText("The workshop was fine.");
    assert.ok(!r.triggers.includes("Work"), "workshop does not count as Work");
    const r2 = extractFromText("I feel like everyone is leaving me and I'm lonely.");
    assert.ok(r2.emotions.includes("Lonely"));
  });
});

describe("chat events: user-authored, non-safety, episode-grouped", () => {
  it("assistant text is never analysed", () => {
    const events = eventsFromChat([
      msg("a1", "c1", 0, "assistant", "It sounds like work anxiety is heavy for you."),
      msg("u1", "c1", 1, "user", "yeah maybe"),
    ]);
    assert.equal(events.length, 0, "assistant emotional language creates nothing; bare 'yeah maybe' has no signals");
  });

  it("safety-flagged messages stay with the safety system", () => {
    const events = eventsFromChat([
      msg("u1", "c1", 0, "user", "I'm anxious about work.", "support"),
      msg("u2", "c1", 2, "user", "I'm anxious about work.", "crisis"),
    ]);
    assert.equal(events.length, 0);
  });

  it("twenty messages in one difficult hour count as ONE episode", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      msg(`u${i}`, "c1", i * 3, "user", "I'm so anxious about my job and this deadline."));
    const events = eventsFromChat(rows);
    assert.equal(events.length, 1);
    assert.ok(events[0].emotions.includes("Anxious"));
    assert.ok(events[0].triggers.includes("Work"));
  });

  it("a gap beyond the episode window starts a new episode; different conversations always do", () => {
    const events = eventsFromChat([
      msg("u1", "c1", 0, "user", "anxious about work"),
      msg("u2", "c1", 200, "user", "anxious about work again"), // > 90 min later
      msg("u3", "c2", 210, "user", "lonely tonight"),
    ]);
    assert.equal(events.length, 3);
  });

  it("episodes with no lexicon hits produce nothing — silence is not data", () => {
    const events = eventsFromChat([msg("u1", "c1", 0, "user", "ok thanks, talk tomorrow")]);
    assert.equal(events.length, 0);
  });

  it("chat events are marked inferred", () => {
    const events = eventsFromChat([msg("u1", "c1", 0, "user", "anxious about work")]);
    assert.equal(events[0].method, "inferred");
  });
});

describe("selected-source events", () => {
  it("check-ins carry user-selected tags at selected confidence with weight", () => {
    const ev = eventsFromCheckins([{ id: "m1", created_at: iso(0), mood_score: 3, emotion_tags: ["Anxious"], trigger_tags: ["Work"], note: "long note here" }]);
    assert.equal(ev[0].method, "selected");
    assert.equal(ev[0].weight, 3);
    assert.deepEqual(ev[0].triggers, ["Work"]);
  });
  it("journal pages count only when the user tagged them; memories only with a feeling", () => {
    assert.equal(eventsFromJournal([{ id: "j1", created_at: iso(0), body: "sad text", emotion_tags: [] }]).length, 0);
    assert.equal(eventsFromJournal([{ id: "j2", created_at: iso(0), body: "x", emotion_tags: ["Heavy"] }]).length, 1);
    assert.equal(eventsFromMemories([{ id: "k1", created_at: iso(0), story: "x", feeling_tag: null }]).length, 0);
    assert.equal(eventsFromMemories([{ id: "k2", created_at: iso(0), story: "x", feeling_tag: "Grateful" }]).length, 1);
  });
  it("excerpts are clipped, never full text", () => {
    const long = "a".repeat(500);
    const ev = eventsFromCheckins([{ id: "m1", created_at: iso(0), mood_score: 5, emotion_tags: [], trigger_tags: [], note: long }]);
    assert.ok((ev[0].excerpt ?? "").length <= 90);
  });
});

describe("merge, dedup, evidence mix", () => {
  const checkins = eventsFromCheckins([
    { id: "m1", created_at: iso(0), mood_score: 3, emotion_tags: ["Anxious"], trigger_tags: ["Work"], note: null },
    { id: "m2", created_at: iso(60), mood_score: 4, emotion_tags: ["Anxious"], trigger_tags: [], note: null },
  ]);
  const chat = eventsFromChat([msg("u1", "c1", 120, "user", "anxious about work stuff")]);
  const journal = eventsFromJournal([{ id: "j1", created_at: iso(180), emotion_tags: ["Anxious"], body: "" }]);

  it("merging is idempotent — duplicates by id collapse", () => {
    const merged = mergeEvents(checkins, checkins, chat, journal);
    assert.equal(merged.length, 4);
  });

  it("evidence mix counts per source and describes itself", () => {
    const merged = mergeEvents(checkins, chat, journal);
    const mix = sourceMixFor(merged, "Anxious");
    assert.equal(mix.daily_checkin, 2);
    assert.equal(mix.innermate_chat, 1);
    assert.equal(mix.journal, 1);
    assert.equal(sourceCount(mix), 3);
    assert.equal(describeMix(mix), "2 check-ins · 1 chats · 1 journal");
  });

  it("cross-source corroboration is visible; chat-only tags are flagged inferred-only", () => {
    const merged = mergeEvents(checkins, chat, journal);
    assert.equal(isInferredOnly(merged, "Anxious"), false, "Anxious has selected evidence");
    // Work appears in a check-in (selected) AND chat — not inferred-only:
    assert.equal(isInferredOnly(merged, "Work"), false);
    // A tag only the chat produced:
    const chatOnly = mergeEvents(eventsFromChat([msg("u9", "c9", 0, "user", "I keep replaying the conversation, overthinking everything")]));
    assert.equal(isInferredOnly(chatOnly, "Overthinking"), true);
  });

  it("adapter feeds pattern-map without loss", () => {
    const merged = mergeEvents(checkins, chat);
    const rows = toMoodEntries(merged);
    assert.equal(rows.length, merged.length);
    assert.ok(rows.some((r) => r.emotion_tags.includes("Anxious") && r.trigger_tags.includes("Work")));
  });
});

describe("tonight's sky — narrative reading from real weights only", () => {
  const NOW2 = T0 + 6 * 86400000; // fixed "now" six days after T0

  const scored = (daysAgo: number, w: number, emotions: string[] = [], triggers: string[] = []) => ({
    id: `m${daysAgo}-${w}`, source: "daily_checkin" as const, sourceId: "x",
    created_at: new Date(NOW2 - daysAgo * 86400000).toISOString(),
    emotions, triggers, weight: w, excerpt: null, method: "selected" as const,
  });

  it("no events → an honest empty sky, never a fake one", () => {
    const r = skyReading([], NOW2);
    assert.equal(r.headline, "A sky waiting to be read.");
    assert.equal(r.sources.length, 0);
  });

  it("no check-in today → 'still unread', with the week's real mean", () => {
    const r = skyReading([scored(2, 4), scored(3, 6)], NOW2);
    assert.equal(r.headline, "Tonight's sky, still unread.");
    assert.match(r.reading, /resting near 5\.0/);
  });

  it("heavy today but lighter than the week → thinning clouds", () => {
    const r = skyReading([scored(0, 4, ["Anxious"], ["Work"]), scored(1, 2), scored(2, 2), scored(3, 2)], NOW2);
    assert.equal(r.headline, "Soft clouds, slowly thinning.");
    assert.match(r.reading, /anxious, work/);
    assert.match(r.reading, /lighter than your week/);
  });

  it("light steady day → a clear stretch of sky", () => {
    const r = skyReading([scored(0, 9), scored(1, 8), scored(2, 9)], NOW2);
    assert.equal(r.headline, "A clear stretch of sky.");
  });

  it("sources list one most-recent event per source, max 4", () => {
    const chat = { id: "c1", source: "innermate_chat" as const, sourceId: "cv", created_at: new Date(NOW2 - 3600e3).toISOString(), emotions: ["Anxious"], triggers: [], weight: null, excerpt: "worried about the deadline", method: "inferred" as const };
    const r = skyReading([scored(0, 5), scored(1, 5), chat], NOW2);
    const bySource = r.sources.map((s) => s.source);
    assert.deepEqual([...new Set(bySource)].length, bySource.length, "one per source");
    assert.ok(bySource.includes("innermate_chat"));
  });
});

describe("what is changing — evidence-gated progress", () => {
  it("says nothing without enough scored events", () => {
    const few = eventsFromCheckins([
      { id: "m1", created_at: iso(0), mood_score: 2, emotion_tags: [], trigger_tags: [], note: null },
      { id: "m2", created_at: iso(60), mood_score: 9, emotion_tags: [], trigger_tags: [], note: null },
    ]);
    const signals = changeSignals(few, T0 + 86400000);
    assert.ok(!signals.some((s) => /lighter/.test(s.text)));
  });

  it("reports a lightening trend with the numbers as evidence", () => {
    const rows = [2, 3, 3, 6, 7, 7].map((score, i) => ({
      id: `m${i}`, created_at: iso(i * 1440), mood_score: score,
      emotion_tags: [] as string[], trigger_tags: [] as string[], note: null,
    }));
    const signals = changeSignals(eventsFromCheckins(rows), T0 + 7 * 86400000);
    const trend = signals.find((s) => /lighter/.test(s.text));
    assert.ok(trend, "trend signal present");
    assert.match(trend.evidence, /mean weight moved from/);
  });
});
