import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { roomFor, SIGNAL_WINDOW_MS, type RoomMood } from "../room-state.ts";

const NOW = new Date("2026-07-16T20:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400_000).toISOString();

const mood = (over: Partial<RoomMood> & { created_at: string }): RoomMood => ({
  mood_score: 6,
  emotion_tags: [],
  trigger_tags: [],
  ...over,
});

describe("roomFor — absent or stale signals", () => {
  it("no moods → neutral", () => {
    assert.equal(roomFor([], NOW), "neutral");
  });

  it("a heavy check-in outside the 12h window no longer colours the room", () => {
    const m = [mood({ created_at: hoursAgo(13), mood_score: 2, emotion_tags: ["Heavy"] })];
    assert.equal(roomFor(m, NOW), "neutral");
  });

  it("a heavy check-in just inside the window does", () => {
    const m = [mood({ created_at: hoursAgo(11), mood_score: 2, emotion_tags: ["Heavy"] })];
    assert.equal(roomFor(m, NOW), "grief");
  });

  it("a future-dated row is ignored rather than trusted", () => {
    const m = [mood({ created_at: hoursAgo(-2), mood_score: 2, emotion_tags: ["Anxious"] })];
    assert.equal(roomFor(m, NOW), "neutral");
  });

  it("signal window constant matches 12 hours", () => {
    assert.equal(SIGNAL_WINDOW_MS, 12 * 3600_000);
  });
});

describe("roomFor — acute states from the latest check-in only", () => {
  it("low + anxious → panic", () => {
    const m = [mood({ created_at: hoursAgo(1), mood_score: 4, emotion_tags: ["Anxious"] })];
    assert.equal(roomFor(m, NOW), "panic");
  });

  it("low + overwhelmed → panic", () => {
    const m = [mood({ created_at: hoursAgo(1), mood_score: 3, emotion_tags: ["Overwhelmed"] })];
    assert.equal(roomFor(m, NOW), "panic");
  });

  it("anxious but not low is NOT panic — a settled anxious day stays neutral", () => {
    const m = [mood({ created_at: hoursAgo(1), mood_score: 6, emotion_tags: ["Anxious"] })];
    assert.equal(roomFor(m, NOW), "neutral");
  });

  it("angry at any score → anger", () => {
    const m = [mood({ created_at: hoursAgo(1), mood_score: 7, emotion_tags: ["Angry"] })];
    assert.equal(roomFor(m, NOW), "anger");
  });

  it("lonely → loneliness", () => {
    const m = [mood({ created_at: hoursAgo(2), mood_score: 5, emotion_tags: ["Lonely"] })];
    assert.equal(roomFor(m, NOW), "loneliness");
  });

  it("very low score alone → grief, even untagged", () => {
    const m = [mood({ created_at: hoursAgo(2), mood_score: 2 })];
    assert.equal(roomFor(m, NOW), "grief");
  });

  it("low + numb → grief", () => {
    const m = [mood({ created_at: hoursAgo(2), mood_score: 4, emotion_tags: ["Numb"] })];
    assert.equal(roomFor(m, NOW), "grief");
  });

  it("panic outranks anger, anger outranks loneliness, loneliness outranks grief", () => {
    const all = mood({
      created_at: hoursAgo(1), mood_score: 2,
      emotion_tags: ["Anxious", "Angry", "Lonely", "Heavy"],
    });
    assert.equal(roomFor([all], NOW), "panic");
    const noPanic = mood({ created_at: hoursAgo(1), mood_score: 2, emotion_tags: ["Angry", "Lonely", "Heavy"] });
    assert.equal(roomFor([noPanic], NOW), "anger");
    const noAnger = mood({ created_at: hoursAgo(1), mood_score: 2, emotion_tags: ["Lonely", "Heavy"] });
    assert.equal(roomFor([noAnger], NOW), "loneliness");
  });

  it("only the LATEST check-in decides — an older heavy one cannot override a calm one", () => {
    const m = [
      mood({ created_at: hoursAgo(6), mood_score: 2, emotion_tags: ["Heavy"] }),
      mood({ created_at: hoursAgo(1), mood_score: 8, emotion_tags: ["Calm"] }),
    ];
    assert.equal(roomFor(m, NOW), "neutral");
  });

  it("order of the input array does not matter", () => {
    const a = mood({ created_at: hoursAgo(1), mood_score: 8, emotion_tags: ["Calm"] });
    const b = mood({ created_at: hoursAgo(6), mood_score: 2, emotion_tags: ["Anxious"] });
    assert.equal(roomFor([a, b], NOW), roomFor([b, a], NOW));
  });

  it("trigger tags count too", () => {
    const m = [mood({ created_at: hoursAgo(1), mood_score: 3, trigger_tags: ["Anxious"] })];
    assert.equal(roomFor(m, NOW), "panic");
  });
});

describe("roomFor — growth is evidenced or absent", () => {
  const week = (offsetDays: number, scores: number[]) =>
    scores.map((s, i) => mood({ created_at: daysAgo(offsetDays + i), mood_score: s }));

  it("a clearly lighter week with 3+ check-ins each side → growth", () => {
    const m = [...week(1, [8, 8, 7]), ...week(8, [5, 5, 6])];
    assert.equal(roomFor(m, NOW), "growth");
  });

  it("fewer than 3 check-ins in either week → no growth claim", () => {
    const m = [...week(1, [9, 9]), ...week(8, [4, 4, 4])];
    assert.equal(roomFor(m, NOW), "neutral");
  });

  it("a small improvement is not celebrated", () => {
    const m = [...week(1, [6, 6, 6]), ...week(8, [5.5, 5.5, 5.5])];
    assert.equal(roomFor(m, NOW), "neutral");
  });

  it("an acute state outranks growth", () => {
    const m = [
      mood({ created_at: hoursAgo(1), mood_score: 3, emotion_tags: ["Heavy"] }),
      ...week(1, [8, 8, 8]),
      ...week(8, [4, 4, 4]),
    ];
    assert.equal(roomFor(m, NOW), "grief");
  });

  it("rows without scores are ignored in the averages", () => {
    const m = [
      ...week(1, [8, 8, 8]),
      mood({ created_at: daysAgo(2), mood_score: null }),
      ...week(8, [5, 5, 5]),
    ];
    assert.equal(roomFor(m, NOW), "growth");
  });
});
