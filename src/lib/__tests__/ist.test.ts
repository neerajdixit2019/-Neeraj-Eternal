import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  istParts, istDayKey, istHour, istWeekday, istDayOfMonth,
  istStartOfDay, istWeekStartKey, istIsSunday, istTimeOfDay, IST_OFFSET_MIN,
} from "../ist.ts";

/** The app's day and time-of-day are anchored to India (UTC+5:30, no DST),
 *  not the UTC server clock. IST midnight is 18:30 UTC the previous day. */

describe("ist: civil fields", () => {
  it("reads IST wall-clock fields for an instant", () => {
    // 2026-07-19T06:00:00Z → 11:30 IST on Sunday 19 Jul 2026
    const p = istParts("2026-07-19T06:00:00Z");
    assert.deepEqual(
      { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute, wd: p.weekday },
      { y: 2026, mo: 7, d: 19, h: 11, mi: 30, wd: 0 },
    );
  });

  it("offset is a fixed +5:30 (no DST)", () => {
    assert.equal(IST_OFFSET_MIN, 330);
    // Same offset in January and July (India has no daylight saving)
    assert.equal(istHour("2026-01-15T00:00:00Z"), 5); // 05:30 IST
    assert.equal(istHour("2026-07-15T00:00:00Z"), 5); // 05:30 IST
  });

  it("accepts a number (epoch ms) or a Date", () => {
    const ms = Date.parse("2026-07-19T06:00:00Z");
    assert.equal(istDayKey(ms), "2026-07-19");
    assert.equal(istDayKey(new Date(ms)), "2026-07-19");
  });
});

describe("ist: the day boundary is IST midnight (18:30 UTC prev day)", () => {
  it("just before IST midnight is still the old day", () => {
    // 18:29:59Z → 23:59:59 IST same date
    assert.equal(istDayKey("2026-07-19T18:29:59Z"), "2026-07-19");
    assert.equal(istHour("2026-07-19T18:29:59Z"), 23);
    assert.equal(istIsSunday("2026-07-19T18:29:59Z"), true); // 19 Jul is Sunday
  });

  it("at 18:30 UTC the IST day rolls over", () => {
    // 18:30:00Z → 00:00:00 IST next date
    assert.equal(istDayKey("2026-07-19T18:30:00Z"), "2026-07-20");
    assert.equal(istHour("2026-07-19T18:30:00Z"), 0);
    assert.equal(istWeekday("2026-07-19T18:30:00Z"), 1); // Monday 20 Jul
    assert.equal(istIsSunday("2026-07-19T18:30:00Z"), false);
  });

  it("a UTC-based day key would be WRONG here (regression guard)", () => {
    const iso = "2026-07-19T20:00:00Z"; // 01:30 IST on the 20th
    assert.equal(istDayKey(iso), "2026-07-20");
    assert.notEqual(istDayKey(iso), new Date(iso).toISOString().slice(0, 10)); // UTC says "2026-07-19"
  });
});

describe("ist: derived helpers", () => {
  it("istStartOfDay returns the UTC instant of IST midnight", () => {
    // IST midnight on 19 Jul 2026 == 18:30 UTC on 18 Jul 2026
    assert.equal(istStartOfDay("2026-07-19T06:00:00Z").toISOString(), "2026-07-18T18:30:00.000Z");
  });

  it("istWeekStartKey is the IST Monday of the week", () => {
    // Wed 15 Jul 2026 → Monday is 13 Jul
    assert.equal(istWeekStartKey("2026-07-15T12:00:00Z"), "2026-07-13");
    // Sunday 19 Jul → still the week that began Mon 13 Jul
    assert.equal(istWeekStartKey("2026-07-19T06:00:00Z"), "2026-07-13");
    // Monday 20 Jul (from the boundary instant) → new week starts 20 Jul
    assert.equal(istWeekStartKey("2026-07-19T18:30:00Z"), "2026-07-20");
  });

  it("istDayOfMonth in IST", () => {
    assert.equal(istDayOfMonth("2026-07-19T18:29:00Z"), 19);
    assert.equal(istDayOfMonth("2026-07-19T18:30:00Z"), 20);
  });
});

describe("ist: time-of-day bands", () => {
  const at = (h: number, m = 0) => {
    // Build a UTC instant that reads as h:m IST: IST = UTC + 5:30, so
    // UTC = h:m - 5:30 on a base date; just subtract the offset from a
    // fixed IST wall-clock using istParts inverse is overkill — use known map.
    const utcMs = Date.UTC(2026, 6, 20, h, m) - IST_OFFSET_MIN * 60_000;
    return new Date(utcMs);
  };
  it("maps hours to the shared bands", () => {
    assert.equal(istTimeOfDay(at(2)), "late night"); // <5
    assert.equal(istTimeOfDay(at(8)), "morning");    // <12
    assert.equal(istTimeOfDay(at(14)), "afternoon"); // <17
    assert.equal(istTimeOfDay(at(17)), "evening");   // 17..20
    assert.equal(istTimeOfDay(at(20)), "evening");
    assert.equal(istTimeOfDay(at(21)), "night");     // >=21
    assert.equal(istTimeOfDay(at(23)), "night");
  });
  it("the band hour matches istHour for the same instant", () => {
    assert.equal(istHour(at(17, 30)), 17);
  });
});
