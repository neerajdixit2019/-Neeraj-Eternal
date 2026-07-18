import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTrustedLetterPdf,
  letterHasDevanagari,
  type TrustedLetterInput,
} from "../trusted-letter.ts";

const base: TrustedLetterInput = {
  preparedBy: "Neeraj",
  forName: "Dr. Mehta",
  windowLabel: "the last two weeks",
  personalNote: "Doing okay, mostly. Sleep is still hard.",
  moodOverview: {
    count: 5,
    avg: 6.4,
    topEmotions: [["Anxious", 3], ["Calm", 2]],
    topTriggers: [["Exams", 2]],
  },
  patterns: [{ label: "Overwhelmed", count: 3 }],
  journalEntries: [
    {
      created_at: "2026-07-10T10:00:00Z",
      title: "A hard day",
      body: "College was a lot today. The evening walk helped.",
    },
  ],
};

const hindi: TrustedLetterInput = {
  ...base,
  preparedBy: "नीरज",
  personalNote: "मैं पिछले कुछ हफ़्तों से बेहतर महसूस कर रहा हूँ।",
  patterns: [{ label: "सब बहुत ज़्यादा", count: 3 }],
  journalEntries: [
    ...base.journalEntries,
    {
      created_at: "2026-07-14T10:00:00Z",
      title: "एक मुश्किल दिन",
      body: "आज कॉलेज में बहुत दबाव था।",
    },
  ],
};

const pdfBytes = async (input: TrustedLetterInput) =>
  Buffer.from(await buildTrustedLetterPdf(input).arrayBuffer());

describe("letterHasDevanagari", () => {
  it("is false for an English-only letter", () => {
    assert.equal(letterHasDevanagari(base), false);
  });

  it("sees Devanagari in the personal note", () => {
    assert.equal(letterHasDevanagari({ ...base, personalNote: "नींद मुश्किल है" }), true);
  });

  it("sees Devanagari in a journal body", () => {
    assert.equal(
      letterHasDevanagari({
        ...base,
        journalEntries: [{ created_at: "2026-07-10T10:00:00Z", title: null, body: "आज का दिन" }],
      }),
      true,
    );
  });

  it("sees Devanagari in a pattern label", () => {
    assert.equal(
      letterHasDevanagari({ ...base, patterns: [{ label: "सब बहुत ज़्यादा", count: 2 }] }),
      true,
    );
  });

  it("sees Devanagari in the recipient's name", () => {
    assert.equal(letterHasDevanagari({ ...base, forName: "माँ" }), true);
  });

  it("sees Devanagari in the signature", () => {
    assert.equal(letterHasDevanagari({ ...base, preparedBy: "नीरज" }), true);
  });
});

describe("buildTrustedLetterPdf", () => {
  it("produces a real PDF", async () => {
    const buf = await pdfBytes(base);
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  it("leaves the Devanagari font out of English-only letters", async () => {
    const buf = await pdfBytes(base);
    assert.equal(buf.includes("NotoDevanagari"), false);
  });

  it("embeds the Devanagari font when the letter needs it", async () => {
    const buf = await pdfBytes(hindi);
    assert.equal(buf.includes("NotoDevanagari"), true);
  });

  it("builds a letter that is only a personal note", async () => {
    const buf = await pdfBytes({
      ...base,
      moodOverview: null,
      patterns: null,
      journalEntries: [],
    });
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });

  it("survives a missing display name", async () => {
    const buf = await pdfBytes({ ...base, preparedBy: null });
    assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  });
});
